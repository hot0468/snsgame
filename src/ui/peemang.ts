import type { GameContext } from "./context";
import type { ShopItem } from "@/data/shop";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { SKILL_STATS } from "@/data/stats";
import { buyItem, canBuy, effectivePrice, isOwned } from "@/systems/shop";
import { confirmPurchase } from "./confirmModal";
import { inventoryList } from "./inventory";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 피망마켓 — 동네 중고 직거래(당근마켓 패러디). 상시 탭이 아니라 네이놈 포털에서 진입한다.
 * 구매 탭: PEEMANG_ITEMS(ShopItem)를 기존 buyItem으로 그대로 산다(새 구매 규칙 없음).
 * 판매 탭: 서랍장과 같은 목록(inventoryList)에 판매 버튼만 붙인 것.
 * ============================================================ */

/** 매물 카드에 붙는 장식용 동네·시간(아이템 id 해시 — 새로고침해도 안 변한다) */
const TOWN_POOL = ["행운동", "새싹동", "달빛동", "구름동", "버들동", "노을동"];
const AGO_POOL = ["방금 전", "3분 전", "22분 전", "1시간 전", "3시간 전", "어제"];

function hashInt(seed: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}
function pickFrom<T>(pool: T[], id: string, key: string): T {
  return pool[hashInt(`${id}:${key}`) % pool.length];
}

function statText(item: ShopItem): string | null {
  if (!item.skill || !item.boost) return null;
  return `${SKILL_STATS[item.skill].label} +${item.boost}`;
}

/** 매물 하나(중고 거래 글 카드) */
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
      owned ? el("span", { class: "pm-card__soldout" }, "거래완료") : null,
    ),
    el(
      "span",
      { class: "pm-card__copy" },
      el("span", { class: "pm-card__name" }, item.name),
      el(
        "span",
        { class: "pm-card__where" },
        `${pickFrom(TOWN_POOL, item.id, "town")} · ${pickFrom(AGO_POOL, item.id, "ago")}`,
      ),
      item.desc ? el("span", { class: "pm-card__desc" }, item.desc) : null,
      el(
        "span",
        { class: "pm-card__foot" },
        el("span", { class: "pm-card__price" }, `${formatNumber(eff)}원`),
        stat ? el("span", { class: "pm-card__stat" }, stat) : null,
      ),
    ),
  );
}

export function renderPeemang(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const tab = ctx.ui.peemangTab;

  const tabBtn = (id: "buy" | "sell", label: string): HTMLElement =>
    el(
      "button",
      {
        class: "pm__tab" + (tab === id ? " pm__tab--on" : ""),
        onclick: () => {
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
          el(
            "p",
            { class: "compose-hint", style: "margin:0 0 12px" },
            "우리 동네 이웃들이 내놓은 중고 물건이에요. 새것보단 못해도 스탯이 조금씩 오릅니다.",
          ),
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
        );

  return el(
    "div",
    { class: "pm" },
    el(
      "header",
      { class: "pm__mast" },
      el("span", { class: "pm__logo" }, "피망마켓"),
      el("span", { class: "pm__slogan" }, "당신 근처의 중고 직거래"),
      el(
        "span",
        { class: "pm__money" },
        icon("coin", { size: 14 }),
        `${formatNumber(s.money)}원`,
      ),
    ),
    el("div", { class: "pm__tabs" }, tabBtn("buy", "동네 매물"), tabBtn("sell", "내 물건 팔기")),
    body,
  );
}
