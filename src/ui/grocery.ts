import type { GameContext } from "./context";
import type { Recipe } from "@/data/grocery";
import {
  INGREDIENTS,
  failTweetLines,
  ingredientById,
  matchRecipe,
} from "@/data/grocery";
import { enqueueEventTweet } from "@/systems/eventTweets";
import type { LemonZResult } from "@/systems/eggs";
import { tryLemonZ } from "@/systems/eggs";
import { pick } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";
import { itemImg } from "./components";

/* ============================================================
 * 마켓걸리버 — 식재료 배달. 장바구니에 담은 재료 조합으로 요리가 결정된다.
 * 레시피에 없는 조합이면 "오늘 요리는 망했다!".
 * ============================================================ */

function cartTotal(cart: string[]): number {
  return cart.reduce((sum, id) => sum + (ingredientById(id)?.price ?? 0), 0);
}

/** 장바구니를 {id: count}로 집계 */
function cartCounts(cart: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const id of cart) m.set(id, (m.get(id) ?? 0) + 1);
  return m;
}

/* ------------------------------------------------------------
 * 카드 장식(쿠폰·할인·리뷰·태그 등)은 전부 겉모습용이다.
 * 재료 id로 결정론적 해시를 돌려 새로고침해도 값이 안 변한다.
 * (실제 가격/담기 동작은 손대지 않음 — portal.ts hashHue와 같은 방식)
 * ------------------------------------------------------------ */
function hashInt(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
/** id+key 해시를 [0, mod) 정수로 */
function pickIdx(id: string, key: string, mod: number): number {
  return hashInt(`${id}:${key}`) % mod;
}

/** 결정론적 브랜드 접두 풀 */
const BRAND_POOL = ["걸리농", "프레팜", "자연드림", "산지직송"];
/** 한줄 설명 풀(범용 문구) */
const ONELINER_POOL = [
  "아침마다 문 앞에 신선하게",
  "산지에서 바로 온 오늘의 재료",
  "오늘 담아 내일 아침 식탁에",
  "깐깐하게 고른 오늘의 신선함",
  "새벽 공기 머금은 제철 그대로",
];
/** 걸리버 테마 태그 풀(Kurly 패러디) */
const TAG_POOL = ["걸리버 Only", "걸리버셀렉션", "샛별특가"];
/** 쿠폰 배지 풀 */
const COUPON_POOL = ["+10%쿠폰", "+5%쿠폰", "+15%쿠폰"];
/** 할인율 풀(0이 섞여 있어 일부는 할인 없음) */
const DISCOUNT_POOL = [0, 0, 0, 10, 15, 20, 25, 30];

/** 재료 하나의 장식 데이터(결정론적) */
interface Decor {
  brandName: string;
  oneLiner: string;
  coupon: string | null;
  discount: number;
  original: number;
  reviews: string;
  tags: string[];
}
function decorFor(id: string, price: number): Decor {
  const discount = DISCOUNT_POOL[pickIdx(id, "disc", DISCOUNT_POOL.length)];
  const original =
    discount > 0 ? Math.round(price / (1 - discount / 100) / 10) * 10 : price;

  const rv = 30 + (hashInt(`${id}:rev`) % 2800);
  const reviews = rv > 999 ? "999+" : formatNumber(rv);

  const tagCount = pickIdx(id, "tagn", 3); // 0~2개
  const tagStart = pickIdx(id, "tags", TAG_POOL.length);
  const tags: string[] = [];
  for (let k = 0; k < tagCount; k++) tags.push(TAG_POOL[(tagStart + k) % TAG_POOL.length]);

  return {
    brandName: BRAND_POOL[pickIdx(id, "brand", BRAND_POOL.length)],
    oneLiner: ONELINER_POOL[pickIdx(id, "desc", ONELINER_POOL.length)],
    coupon: pickIdx(id, "coup", 100) < 45 ? COUPON_POOL[pickIdx(id, "coupt", COUPON_POOL.length)] : null,
    discount,
    original,
    reviews,
    tags,
  };
}

/** 주문 결과 팝업(요리 완성/실패 + 트윗) */
function openOrderResult(ctx: GameContext, recipe: Recipe | null): void {
  ctx.openModal((c) => {
    const success = recipe != null;
    const lines = success ? recipe.tweetLines : failTweetLines();
    return el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          success ? `${recipe.emoji} 요리 완성!` : "🍳💥 요리 실패",
        ),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:16px;font-weight:800;margin:0 0 8px" },
          success ? `『${recipe.name}』 완성!` : "오늘 요리는 망했다!",
        ),
        el(
          "p",
          { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 16px" },
          success
            ? "재료 조합이 딱 맞아떨어졌어요. 완성한 요리를 자랑해볼까요?"
            : "레시피에 없는 조합이라 정체불명의 결과물이 나왔어요... 그래도 트윗은 할 수 있어요.",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "닫기"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                const text = pick(lines);
                c.update((s) => enqueueEventTweet(s, { source: "요리", attr: "cooking", text }));
                c.closeModal();
                c.toast("📝 트윗 소재를 작성 목록에 저장했어요 · 작성 팝업에서 게시");
              },
            },
            success ? "요리 트윗하기" : "망한 요리 트윗하기",
          ),
        ),
      ),
    );
  });
}

/**
 * 레몬Z 이스터에그 팝업.
 * 요리가 아니므로 트윗 게시 버튼은 없다. 문구 "레몬Z다!"는 사용자 지정 — 바꾸지 말 것.
 */
function openLemonZResult(ctx: GameContext, result: LemonZResult): void {
  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "🍋 레몬Z다!"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:16px;font-weight:800;margin:0 0 8px" }, "레몬Z다!"),
        el(
          "p",
          { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 12px" },
          "레몬과 밀감만 담긴 봉투를 열자 노란 섬광이 터졌다. 정신을 차려보니 뭔가… 각성해 있었다.",
        ),
        el(
          "p",
          { class: "grocery-egg__stat" },
          `${result.label} +${result.gained} (${result.before} → ${result.after})`,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn", onclick: () => c.closeModal() }, "닫기"),
        ),
      ),
    ),
  );
}

export function renderGrocery(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "grocery" });

  function paint(): void {
    const s = ctx.store.getState();
    const cart = ctx.ui.groceryCart;
    const total = cartTotal(cart);
    const affordable = s.money >= total;

    // 식재료 카드 그리드 (마켓컬리 스타일 상품 카드)
    const grid = el(
      "div",
      { class: "grocery__grid" },
      ...INGREDIENTS.map((ing) => {
        const d = decorFor(ing.id, ing.price);

        // 이미지 영역: 이모지 + (쿠폰 배지) + 담기 버튼(= add 액션)
        const media = el(
          "div",
          { class: "grocery-item__media" },
          // 이미지가 있으면 이모지 대신 사진. 없는 게 기본이라 이모지가 폴백이다.
          itemImg(ing.id, ing.name) ?? el("span", { class: "grocery-item__emoji" }, ing.emoji),
          d.coupon && el("span", { class: "grocery-item__coupon" }, d.coupon),
          el(
            "button",
            {
              class: "grocery-item__add",
              title: "담기",
              onclick: () => {
                ctx.ui.groceryCart = [...ctx.ui.groceryCart, ing.id];
                paint();
              },
            },
            el("span", { class: "grocery-item__add-ico" }, "🛒"),
            "담기",
          ),
        );

        // 가격 블록
        const priceBlock = el(
          "div",
          { class: "grocery-item__price" },
          d.discount > 0 &&
            el("span", { class: "grocery-item__original" }, `${formatNumber(d.original)}원`),
          el(
            "div",
            { class: "grocery-item__final" },
            d.discount > 0 &&
              el("span", { class: "grocery-item__rate" }, `${d.discount}%`),
            el("span", { class: "grocery-item__amount" }, `${formatNumber(ing.price)}원`),
          ),
        );

        const info = el(
          "div",
          { class: "grocery-item__info" },
          el("span", { class: "grocery-item__delivery" }, "샛별배송"),
          el("div", { class: "grocery-item__name" }, `[${d.brandName}] ${ing.name}`),
          el("div", { class: "grocery-item__desc" }, d.oneLiner),
          priceBlock,
          el(
            "div",
            { class: "grocery-item__meta" },
            el("span", { class: "grocery-item__reviews" }, `💬 ${d.reviews}`),
          ),
          d.tags.length > 0 &&
            el(
              "div",
              { class: "grocery-item__tags" },
              ...d.tags.map((t) => el("span", { class: "grocery-item__tag" }, t)),
            ),
        );

        return el("div", { class: "grocery-item" }, media, info);
      }),
    );

    // 장바구니
    const counts = cartCounts(cart);
    const cartRows =
      counts.size === 0
        ? [el("div", { class: "empty", style: "padding:16px 0" }, "장바구니가 비어 있어요.")]
        : [...counts.entries()].map(([id, n]) => {
            const ing = ingredientById(id)!;
            return el(
              "div",
              { class: "grocery-cart__row" },
              el("span", {}, `${ing.emoji} ${ing.name} × ${n}`),
              el(
                "span",
                { class: "grocery-cart__right" },
                el("span", {}, `${formatNumber(ing.price * n)}원`),
                el(
                  "button",
                  {
                    class: "grocery-cart__remove",
                    title: "하나 빼기",
                    onclick: () => {
                      const idx = cart.lastIndexOf(id);
                      if (idx >= 0) {
                        const next = [...cart];
                        next.splice(idx, 1);
                        ctx.ui.groceryCart = next;
                        paint();
                      }
                    },
                  },
                  "−",
                ),
              ),
            );
          });

    const orderBtn = el(
      "button",
      {
        class: "btn" + (cart.length && affordable ? "" : " btn--ghost"),
        disabled: cart.length === 0 || !affordable,
        onclick: () => {
          if (cart.length === 0) return;
          if (!affordable) {
            ctx.toast(`잔고가 부족해요 (필요 ${formatNumber(total)}원)`);
            return;
          }
          confirmPurchase(ctx, {
            title: "주문 확인",
            itemName: `장바구니 ${cart.length}개 상품`,
            priceText: `${formatNumber(total)}원`,
            message: "결제하고 주문하시겠습니까?",
            confirmLabel: "결제",
            onConfirm: () => {
              const s1 = ctx.store.getState();
              const ids = [...ctx.ui.groceryCart];
              if (ids.length === 0) return;
              if (s1.money < cartTotal(ids)) {
                ctx.toast(`잔고가 부족해요 (필요 ${formatNumber(cartTotal(ids))}원)`);
                return;
              }
              // 대금 지불·장바구니 비우기는 레몬Z든 평범한 요리든 동일하게 수행한다.
              ctx.ui.groceryCart = [];
              const egg: { result: LemonZResult | null } = { result: null };
              ctx.update((st) => {
                st.money -= cartTotal(ids);
                // 레몬Z 판정은 matchRecipe보다 먼저 — {lemon, mandarin}은 어떤 레시피와도
                // 일치하지 않아 그냥 두면 "요리 실패"로 흘러가 버린다.
                egg.result = tryLemonZ(st, ids);
              });
              if (egg.result) openLemonZResult(ctx, egg.result);
              else openOrderResult(ctx, matchRecipe(ids));
            },
          });
        },
      },
      cart.length === 0 ? "재료를 담아주세요" : `주문하기 · ${formatNumber(total)}원`,
    );

    container.replaceChildren(
      el(
        "header",
        { class: "grocery__mast" },
        el("span", { class: "grocery__logo" }, "마켓걸리버"),
        el("span", { class: "grocery__money" }, `보유금 ${formatNumber(s.money)}원`),
      ),
      el(
        "div",
        { class: "grocery__body" },
        el(
          "div",
          { class: "grocery__left" },
          el("div", { class: "grocery__sec-title" }, "신선 식재료"),
          el(
            "p",
            { class: "compose-hint", style: "margin:0 0 10px" },
            "재료를 장바구니에 담아 주문하면, 담은 조합에 따라 요리가 완성돼요. 레시피에 없는 조합이면… 오늘 요리는 망했다!",
          ),
          grid,
        ),
        el(
          "aside",
          { class: "grocery__cart" },
          el("div", { class: "grocery__sec-title" }, "장바구니"),
          el("div", { class: "grocery-cart__list" }, ...cartRows),
          el(
            "div",
            { class: "grocery-cart__total" },
            el("span", {}, "합계"),
            el("b", {}, `${formatNumber(total)}원`),
          ),
          el("div", { style: "margin-top:10px" }, orderBtn),
        ),
      ),
    );
  }

  paint();
  return container;
}
