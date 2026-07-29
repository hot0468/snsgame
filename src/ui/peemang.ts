import type { GameContext } from "./context";
import type { ShopItem } from "@/data/shop";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { SKILL_STATS } from "@/data/stats";
import { buyItem, canBuy, effectivePrice, isOwned } from "@/systems/shop";
import { confirmPurchase } from "./confirmModal";
import { itemImg } from "./components";
import { inventoryList } from "./inventory";
import { sellDoll, stockedDolls } from "@/systems/arcade";
import { el, formatNumber } from "@/utils/dom";
import { hashInt } from "@/utils/random";
import { icon } from "./icons";

/* ============================================================
 * 피망마켓 — 동네 중고 직거래(당근마켓 패러디). 상시 탭이 아니라 네이놈 포털에서 진입한다.
 * 구매 화면: PEEMANG_ITEMS(ShopItem)를 기존 buyItem으로 그대로 산다(새 구매 규칙 없음).
 * 판매 화면: 서랍장과 같은 목록(inventoryList)에 판매 버튼만 붙인 것.
 *
 * ⚠️ 이 화면의 검색바·추천 검색어·좌측 필터(위치/상태/카테고리)는 전부 **장식**이다.
 *    개발자 도구 팝업·로또 카드와 같은 취급 — 패러디의 결을 내는 그릇일 뿐,
 *    매물 목록은 언제나 PEEMANG_ITEMS 전체다. 필터가 안 걸리는 건 버그가 아니다.
 *    (라디오·체크박스가 눌리는 건 브라우저 기본 동작이다. 게임 상태와 무관하다.)
 *    실제로 동작하는 네비 칩은 `중고거래`(buy)와 `내 물건 팔기`(sell) 둘뿐이다.
 * ============================================================ */

/** 매물 카드에 붙는 장식용 동네·시간(아이템 id 해시 — 새로고침해도 안 변한다) */
const TOWN_POOL = ["행운동", "새싹동", "달빛동", "구름동", "버들동", "노을동"];
const AGO_POOL = ["방금 전", "3분 전", "22분 전", "1시간 전", "3시간 전", "어제"];

/**
 * 제목("○○동 중고거래")에 쓰는 내 동네. 게임에 위치 개념이 없으니 고정값이다.
 * TOWN_POOL[0]을 그대로 쓴다 — 목록에 없는 동네를 제목에 세우면 "내 동네 매물이
 * 하나도 없는" 꼴이 되고, 첫 원소면 pool을 늘려도 제목이 따라 흔들리지 않는다.
 */
const MY_TOWN = TOWN_POOL[0];

function pickFrom<T>(pool: T[], id: string, key: string): T {
  return pool[hashInt(`${id}:${key}`) % pool.length];
}

function statText(item: ShopItem): string | null {
  if (!item.skill || !item.boost) return null;
  return `${SKILL_STATS[item.skill].label} +${item.boost}`;
}

/** 매물 하나(중고 거래 글 카드) — 정사각 사진 위, 이름 → 가격 → 동네·시간 아래 */
function listingCard(ctx: GameContext, item: ShopItem): HTMLElement {
  const s = ctx.store.getState();
  const owned = isOwned(s, item.id);
  const eff = effectivePrice(s, item);
  const stat = statText(item);
  const hue = hashInt(item.id + "h") % 360;

  return el(
    "button",
    {
      class: "pm-card" + (owned ? " pm-card--owned" : ""),
      disabled: owned,
      // 카드에서 뺀 판매글 본문은 hover로 남긴다(당근 카드엔 본문이 없다).
      title: item.desc ?? "",
      onclick: () => {
        if (owned) return;
        if (!canBuy(ctx.store.getState(), item)) {
          ctx.toast(`잔고가 부족해요 (필요 ${formatNumber(eff)}원)`);
          return;
        }
        confirmPurchase(ctx, {
          title: "거래 확인",
          itemName: item.name,
          priceText: `${formatNumber(eff)}원`,
          message: stat
            ? `직거래로 받아오시겠어요? (${stat})`
            : "직거래로 받아오시겠어요?",
          confirmLabel: "거래하기",
          onConfirm: () => {
            let ok = false;
            ctx.update((st) => {
              ok = buyItem(st, item);
            });
            if (ok) ctx.toast(stat ? `${item.name} 거래 완료! ${stat}` : `${item.name} 거래 완료!`);
            else ctx.toast("소지금이 부족해요");
          },
        });
      },
    },
    el(
      "span",
      {
        class: "pm-card__thumb",
        style: `background:linear-gradient(150deg, hsl(${hue}deg 40% 84%), hsl(${(hue + 28) % 360}deg 36% 70%))`,
      },
      // 이미지가 있으면 그라데이션 위를 덮는다(없는 게 기본).
      itemImg(item.id, item.name),
      owned ? el("span", { class: "pm-card__soldout" }, "거래완료") : null,
    ),
    el("span", { class: "pm-card__name" }, item.name),
    el(
      "span",
      { class: "pm-card__foot" },
      el("span", { class: "pm-card__price" }, `${formatNumber(eff)}원`),
      stat ? el("span", { class: "pm-card__stat" }, stat) : null,
    ),
    el(
      "span",
      { class: "pm-card__where" },
      `${pickFrom(TOWN_POOL, item.id, "town")} · ${pickFrom(AGO_POOL, item.id, "ago")}`,
    ),
  );
}

/** 장식용 필터 사이드바 — 아무것도 안 걸린다(파일 상단 주석 참고). */
function filterSide(): HTMLElement {
  const group = (label: string, ...rows: (HTMLElement | null)[]): HTMLElement =>
    el("div", { class: "pm-side__group" }, el("h3", { class: "pm-side__label" }, label), ...rows);

  // name을 공유하면 브라우저가 알아서 하나만 켜준다 — :checked CSS도 필요 없다.
  const radio = (label: string): HTMLElement =>
    el(
      "label",
      { class: "pm-side__opt" },
      el("input", { type: "radio", name: "pm-cat" }),
      label,
    );

  return el(
    "aside",
    { class: "pm-side" },
    el(
      "div",
      { class: "pm-side__head" },
      el("span", { class: "pm-side__title" }, "필터"),
      el("span", { class: "pm-side__reset" }, "초기화"),
    ),
    group(
      "위치",
      el("span", { class: "pm-side__select" }, MY_TOWN, el("span", { class: "pm-side__caret" }, "▾")),
      el("span", { class: "pm-side__link" }, "현위치로 설정"),
    ),
    group(
      "상태",
      el("label", { class: "pm-side__opt" }, el("input", { type: "checkbox" }), "거래 가능만 보기"),
    ),
    // SKILL_STATS를 돌리지 않고 손으로 적는다 — 그쪽엔 피망마켓이 취급하지 않는
    // 스탯(음란 등)까지 들어 있어서 카테고리로 세울 수 없다.
    group(
      "카테고리",
      ...["운동", "미용", "어휘력", "지식", "친화력", "개그", "창작", "게임", "IT"].map(radio),
    ),
  );
}

/**
 * 인형 재고 판매 구역 — 오락실에서 중복으로 뽑은 인형을 판다.
 * 도감 1호기는 여기 안 나온다(systems/arcade.ts가 재고만 노출한다).
 * 서랍장과 같은 즉시 정산이라 별도 대기 개념이 없다 — 확인창 없이 바로 팔린다.
 */
function dollSellSection(ctx: GameContext): HTMLElement | null {
  const stock = stockedDolls(ctx.store.getState());
  if (stock.length === 0) return null;

  return el(
    "div",
    { class: "pm__dolls" },
    el(
      "p",
      { class: "compose-hint", style: "margin:18px 0 10px" },
      "오락실에서 중복으로 뽑은 인형이에요. 도감에 등록된 첫 개는 그대로 남습니다.",
    ),
    el(
      "div",
      { class: "inv-list" },
      ...stock.map(({ doll, count }) =>
        el(
          "div",
          { class: "inv-row" },
          el(
            "div",
            { class: "inv-row__copy" },
            el(
              "div",
              { class: "inv-row__name" },
              `${doll.emoji} ${doll.name}`,
              count > 1 ? el("span", { class: "inv-row__count" }, `×${count}`) : null,
            ),
            el("div", { class: "inv-row__desc" }, doll.desc),
          ),
          el(
            "button",
            {
              class: "inv-row__sell",
              onclick: () => {
                let paid = 0;
                ctx.update((s) => {
                  paid = sellDoll(s, doll.id);
                });
                if (paid > 0) {
                  ctx.toast(`${doll.name} 판매 완료! +${formatNumber(paid)}원`);
                }
              },
            },
            el("span", {}, `${formatNumber(doll.resale)}원에 팔기`),
          ),
        ),
      ),
    ),
  );
}

export function renderPeemang(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const tab = ctx.ui.peemangTab;

  /** 상단 네비 칩. 동작하는 건 buy·sell 둘, 나머지는 패러디용 장식이다. */
  const navChip = (label: string, id?: "buy" | "sell"): HTMLElement =>
    el(
      "button",
      {
        class: "pm-nav__chip" + (id && tab === id ? " pm-nav__chip--on" : ""),
        onclick: () => {
          if (!id) {
            ctx.toast(`${label}는 준비 중이에요`);
            return;
          }
          ctx.ui.peemangTab = id;
          ctx.refresh();
        },
      },
      label,
    );

  const body =
    tab === "buy"
      ? el(
          "div",
          { class: "pm__pane" },
          el("div", { class: "pm__grid" }, ...PEEMANG_ITEMS.map((it) => listingCard(ctx, it))),
        )
      : el(
          "div",
          { class: "pm__pane" },
          el(
            "p",
            { class: "compose-hint", style: "margin:0 0 12px" },
            "서랍장 물건을 바로 내놓을 수 있어요. 중고 시세는 무조건 정가의 50% — 그리고 그 물건으로 올랐던 스탯도 같이 넘어갑니다.",
          ),
          inventoryList(ctx, true),
          dollSellSection(ctx),
        );

  return el(
    "div",
    { class: "pm" },
    el(
      "header",
      { class: "pm__mast" },
      el(
        "div",
        { class: "pm__mast-row" },
        el("span", { class: "pm__logo" }, "🫑피망마켓"),
        el("span", { class: "pm__cat" }, "중고거래", el("span", { class: "pm__caret" }, "▾")),
        el(
          "label",
          { class: "pm__search" },
          // 장식이다 — 입력해도 목록은 그대로다.
          el("input", { type: "text", placeholder: "검색어를 입력해주세요" }),
          icon("search", { size: 15 }),
        ),
        el("span", { class: "pm__money" }, icon("coin", { size: 14 }), `${formatNumber(s.money)}원`),
      ),
      el(
        "nav",
        { class: "pm-nav" },
        navChip("중고거래", "buy"),
        navChip("내 물건 팔기", "sell"),
        navChip("동네업체"),
        navChip("알바"),
        navChip("중고차"),
        navChip("동네생활"),
        navChip("모임"),
        navChip("부동산"),
        navChip("카페"),
      ),
      el(
        "div",
        { class: "pm__suggest" },
        el("span", { class: "pm__suggest-label" }, "추천 검색어"),
        ...["요가매트", "자전거", "덤벨", "향수", "코트", "키보드", "우쿨렐레"].map((w) =>
          el("span", { class: "pm__suggest-word" }, w),
        ),
      ),
    ),
    el(
      "div",
      { class: "pm__body" },
      tab === "buy" ? filterSide() : null,
      el(
        "main",
        { class: "pm__main" },
        el("h1", { class: "pm__title" }, tab === "buy" ? `${MY_TOWN} 중고거래` : "내 물건 팔기"),
        body,
      ),
    ),
  );
}
