import type { GameContext } from "./context";
import type { ShopItem } from "@/data/shop";
import { SHOP_ITEMS } from "@/data/shop";
import { monthlyNewCosmetics } from "@/data/cosmetics";
import { SKILL_STATS } from "@/data/stats";
import { monthKey } from "@/systems/time";
import { advertiseItem, buyItem, effectivePrice, ownedCount } from "@/systems/shop";
import { currentSale } from "@/systems/seasonal";
import { GACHA_COST } from "@/systems/gacha";
import { renderGachaModal } from "./gachaModal";
import { confirmPurchase } from "./confirmModal";
import { itemImg } from "./components";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 쇼핑 탭 — 네이버 스토어 스타일 클론.
 * 마스트헤드/사이드바/배너/필터는 전부 장식(클릭 불가)이고,
 * 실제로 클릭되는 건 상품 카드(구매)뿐이다. 상품은 게임 아이템.
 * ============================================================ */

function hashInt(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return h;
}

/** 아이템 id로 결정되는 장식용 할인율(%) */
function discountOf(id: string): number {
  return 20 + (hashInt(id + "d") % 5) * 10; // 20/30/40/50/60
}

/** 장식용 평점/리뷰 수 */
function ratingOf(id: string): { rating: string; reviews: number } {
  const h = hashInt(id + "r");
  return { rating: (4.3 + (h % 7) / 10).toFixed(2), reviews: 20 + (h % 3600) };
}

function coverStyle(id: string): string {
  const hue = hashInt(id + "h") % 360;
  return (
    `background:linear-gradient(150deg, hsl(${hue}deg 45% 82%),` +
    ` hsl(${(hue + 30) % 360}deg 40% 68%))`
  );
}

/* ===================== 마스트헤드(장식) ===================== */

function masthead(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  return el(
    "header",
    { class: "shop__mast" },
    el(
      "div",
      { class: "shop__logo" },
      el("span", { class: "shop__logo-mark" }, "N+"),
      el("span", { class: "shop__logo-text" }, "스토어"),
    ),
    el(
      "div",
      { class: "shop__search" },
      el("span", { class: "shop__search-ph" }, "상품명 또는 브랜드 입력"),
      el("span", { class: "shop__search-ic" }, icon("search", { size: 16 })),
    ),
    el(
      "div",
      { class: "shop__mast-right" },
      el("span", { class: "shop__mast-ic" }, icon("grid", { size: 16 }), "카테고리"),
      el("span", { class: "shop__mast-ic" }, icon("star", { size: 16 }), "마이쇼핑"),
      el(
        "span",
        { class: "shop__mast-ic shop__mast-money" },
        icon("coin", { size: 16 }),
        `${formatNumber(s.money)}원`,
      ),
    ),
  );
}

/* ===================== 사이드바(장식) ===================== */

const SIDE_CATS = [
  "추천 아이템", "외모/뷰티", "창작/장비", "지식/교양", "운동/건강",
  "소통/친화", "개그/재치", "언더웨어", "잠옷/홈웨어", "한정 특가",
];
const FILTER_GROUPS: { title: string; items: string[] }[] = [
  { title: "공통 > 추천", items: ["특가 적립", "공식 브랜드", "무료배송", "배송비 포함", "★ 4.8 이상"] },
  { title: "공통 > 빠른배송", items: ["오늘출발", "내일도착"] },
  { title: "행사", items: ["슈퍼특가", "타임딜", "멤버십 추가적립"] },
];

function sidebar(): HTMLElement {
  return el(
    "aside",
    { class: "shop__side" },
    el("div", { class: "shop__side-title" }, "아이템 스토어"),
    el(
      "div",
      { class: "shop__side-cats" },
      ...SIDE_CATS.map((c, i) =>
        el(
          "div",
          { class: "shop__side-cat" + (i === 0 ? " shop__side-cat--on" : "") },
          c,
          i === 0 ? null : icon("chevron", { size: 13, className: "shop__side-chev" }),
        ),
      ),
    ),
    ...FILTER_GROUPS.map((g) =>
      el(
        "div",
        { class: "shop__side-group" },
        el("div", { class: "shop__side-group-title" }, g.title),
        ...g.items.map((it) =>
          el(
            "label",
            { class: "shop__side-filter" },
            el("span", { class: "shop__side-box" }),
            it,
          ),
        ),
      ),
    ),
  );
}

/* ===================== 상품 카드(클릭 가능) ===================== */

/**
 * 스탯 상승 문구("어휘력 +3"). skill/boost가 없는 아이템(그래픽카드)은 null —
 * 효과를 어떤 형태로도 노출하지 않는다. buyItem의 적용 조건과 같은 판정을 쓴다.
 */
function statText(item: ShopItem): string | null {
  if (!item.skill || !item.boost) return null;
  return `${SKILL_STATS[item.skill].label} +${item.boost}`;
}

/** 상품 클릭 → 구매 확인 팝업 */
function openBuyModal(ctx: GameContext, item: ShopItem): void {
  const stat = statText(item);
  const eff = effectivePrice(ctx.store.getState(), item);
  const onSale = eff < item.price;
  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), "N+ 스토어"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;font-weight:700;margin:0 0 6px" }, item.name),
        item.desc
          ? el(
              "p",
              { style: "font-size:13px;color:var(--text-muted);margin:0 0 12px;line-height:1.5" },
              item.desc,
            )
          : null,
        el(
          "p",
          { style: "font-size:14px;margin:0 0 16px" },
          onSale
            ? el("span", {}, el("s", { style: "color:var(--text-muted)" }, `${formatNumber(item.price)}원`), ` → `)
            : null,
          stat ? `${formatNumber(eff)}원에 구매하시겠습니까? ` : `${formatNumber(eff)}원에 구매하시겠습니까?`,
          stat ? el("b", { style: "color:var(--accent)" }, `(${stat})`) : null,
        ),
        el(
          "p",
          { style: "font-size:12.5px;color:var(--text-muted);margin:0 0 14px;line-height:1.5" },
          "광고하기: 협찬 트윗을 올려 팔로워 수에 비례한 즉석 수익을 법니다. (7일간 광고 3개 이상이면 팔로워 역풍!)",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:8px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "취소"),
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                let res = { revenue: 0, backlash: false, followerLoss: 0 };
                c.update((st) => {
                  res = advertiseItem(st, item);
                });
                c.closeModal();
                if (res.backlash) {
                  c.toast(
                    `광고 수익 +${res.revenue.toLocaleString("ko-KR")}원… 하지만 광고 도배 역풍! 팔로워 -${res.followerLoss}`,
                  );
                } else {
                  c.toast(`${item.name} 광고 등록! 협찬 수익 +${res.revenue.toLocaleString("ko-KR")}원`);
                }
              },
            },
            "광고하기",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                confirmPurchase(c, {
                  itemName: item.name,
                  priceText: `${formatNumber(eff)}원`,
                  onConfirm: () => {
                    let ok = false;
                    c.update((st) => {
                      ok = buyItem(st, item);
                    });
                    if (ok) c.toast(stat ? `${item.name} 구매 완료! ${stat}` : `${item.name} 구매 완료!`);
                    else c.toast("소지금이 부족해요");
                  },
                });
              },
            },
            "구매하기",
          ),
        ),
      ),
    ),
  );
}

function itemCard(ctx: GameContext, item: ShopItem): HTMLElement {
  const s = ctx.store.getState();
  const count = ownedCount(s, item.id);
  // 반복 구매 아이템은 보유해도 계속 살 수 있다 — 차단은 1회 구매 아이템만.
  const blocked = count > 0 && !item.repeatable;
  const stat = statText(item);
  const { rating, reviews } = ratingOf(item.id);

  // 세일 중이면 실제 할인가, 아니면 장식용 할인 표시
  const sale = currentSale(s.day);
  const eff = effectivePrice(s, item);
  const discPct = sale ? Math.round(sale.rate * 100) : discountOf(item.id);
  const strikePrice = sale ? item.price : Math.round(item.price / (1 - discountOf(item.id) / 100));

  return el(
    "button",
    {
      class: "shop-card" + (blocked ? " shop-card--owned" : ""),
      disabled: blocked,
      onclick: () => {
        if (!blocked) openBuyModal(ctx, item);
      },
    },
    el(
      "div",
      { class: "shop-card__thumb", style: coverStyle(item.id) },
      // 이미지가 있으면 그라데이션 위를 덮는다(없는 게 기본 — 그땐 그라데이션 그대로).
      itemImg(item.id),
      el("span", { class: "shop-card__badge" }, sale ? "SALE" : "특가"),
      count > 0
        ? el("span", { class: "shop-card__ownedtag" }, item.repeatable ? `보유 ${count}` : "보유중")
        : null,
      stat ? el("span", { class: "shop-card__stat" }, stat) : null,
    ),
    el("div", { class: "shop-card__name" }, item.name),
    el("div", { class: "shop-card__origin" }, `${formatNumber(strikePrice)}원`),
    el(
      "div",
      { class: "shop-card__price" },
      el("span", { class: "shop-card__disc" }, `${discPct}%`),
      `${formatNumber(eff)}원`,
    ),
    el(
      "div",
      { class: "shop-card__rating" },
      el("span", { class: "shop-card__star" }, "★"),
      `${rating} 리뷰 ${formatNumber(reviews)}`,
    ),
  );
}

/* ===================== 상품 섹션 ===================== */

function section(
  ctx: GameContext,
  title: string,
  items: ShopItem[],
  bannerHue: number,
  subtitle = "아이템 사면 세부 스탯이 영구 상승",
): HTMLElement {
  return el(
    "section",
    { class: "shop__sec" },
    el(
      "div",
      { class: "shop__sec-head" },
      el("div", { class: "shop__sec-title" }, title),
      el("span", { class: "shop__sec-more" }, "더보기 ›"),
    ),
    el(
      "div",
      {
        class: "shop__banner",
        style: `background:linear-gradient(100deg, hsl(${bannerHue}deg 45% 45%), hsl(${(bannerHue + 25) % 360}deg 50% 35%))`,
      },
      el("div", { class: "shop__banner-sub" }, subtitle),
      el("div", { class: "shop__banner-title" }, title),
    ),
    el("div", { class: "shop__grid" }, ...items.map((it) => itemCard(ctx, it))),
  );
}

/* ===================== 쇼핑 홈 ===================== */

/** 세일 배너(세일 기간에만) */
function saleBanner(ctx: GameContext): HTMLElement | null {
  const sale = currentSale(ctx.store.getState().day);
  if (!sale) return null;
  return el(
    "div",
    { class: "shop-sale" },
    el("span", { class: "shop-sale__tag" }, "🔥 " + sale.name),
    el("span", { class: "shop-sale__txt" }, `전 상품 ${Math.round(sale.rate * 100)}% 할인 중!`),
  );
}

/** 가챠(포토카드/굿즈 뽑기) 진입 배너 */
function gachaBanner(ctx: GameContext): HTMLElement {
  return el(
    "button",
    { class: "shop-gacha", onclick: () => ctx.openModal((c) => renderGachaModal(c)) },
    el("span", { class: "shop-gacha__emoji" }, "🎴"),
    el(
      "span",
      { class: "shop-gacha__body" },
      el("span", { class: "shop-gacha__title" }, "포토카드 / 굿즈 뽑기"),
      el(
        "span",
        { class: "shop-gacha__sub" },
        `한 번 ${formatNumber(GACHA_COST)}원 · SSR 최애 실물 굿즈까지! 지금 뽑기 →`,
      ),
    ),
  );
}

export function renderShop(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const adult = s.adultMode;
  const items = SHOP_ITEMS.filter((it) => !it.adultOnly || adult);
  const mid = Math.ceil(items.length / 2);

  return el(
    "div",
    { class: "shop" },
    masthead(ctx),
    saleBanner(ctx),
    el(
      "div",
      { class: "shop__crumb" },
      "홈",
      el("span", { class: "shop__crumb-sep" }, "›"),
      "아이템",
      el("span", { class: "shop__crumb-sep" }, "›"),
      el("span", { class: "shop__crumb-on" }, "추천"),
    ),
    el(
      "div",
      { class: "shop__body" },
      sidebar(),
      el(
        "main",
        { class: "shop__main" },
        gachaBanner(ctx),
        section(
          ctx,
          "🆕 이달의 신상 화장품",
          monthlyNewCosmetics(monthKey(s.day)),
          330,
          "뷰티계 트윗에 신상품으로 홍보하면 팔로워 증가분 UP (매달 교체)",
        ),
        section(ctx, "슈퍼특가 아이템", items.slice(0, mid), 265),
        section(ctx, "이달의 스탯업 대전", items.slice(mid), 175),
      ),
    ),
  );
}
