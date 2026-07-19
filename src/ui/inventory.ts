import type { GameContext } from "./context";
import type { OwnedItemInfo } from "@/systems/shop";
import {
  DRAWING_TOOL_IDS,
  GIFT_SELL_MORALITY_PENALTY,
  GIFT_SELL_REP_PENALTY,
  isRelGift,
  ownedInventory,
  sellOwnedItem,
  sellPrice,
} from "@/systems/shop";
import { SKILL_STATS } from "@/data/stats";
import type { SkillStatId } from "@/core/types";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 서랍장(보유 아이템) — 목록 하나를 서랍장 모달과 피망마켓 판매 탭이 공유한다.
 * 해석·개수 묶음·판매는 전부 systems/shop이 한다. 여기서는 표시와 확인만.
 * ============================================================ */

/** "미용 +20 · 친화력 +15". 스탯이 없는 아이템(그래픽카드 등)은 null */
function boostText(item: OwnedItemInfo): string | null {
  const parts = (Object.entries(item.boosts) as [SkillStatId, number][]).map(
    ([id, v]) => `${SKILL_STATS[id].label} +${v}`,
  );
  return parts.length ? parts.join(" · ") : null;
}

/**
 * 이 아이템 1개를 팔면 창작 도구가 하나도 안 남는지.
 * 남은 창작 도구 인스턴스가 이것 하나뿐이면 애니/만화 창작이 다시 잠긴다
 * (systems/shop의 hasDrawingTool 판정 대상이 사라지는 것 — 의도된 동작).
 */
function isLastDrawingTool(ctx: GameContext, id: string): boolean {
  if (!DRAWING_TOOL_IDS.includes(id)) return false;
  const owned = ctx.store.getState().ownedItems;
  return owned.filter((o) => DRAWING_TOOL_IDS.includes(o)).length === 1;
}

/** 판매 확인 모달 — 받을 돈과 회수될 스탯을 명시하고, 창작 재잠금이면 경고한다. */
export function openSellConfirm(ctx: GameContext, item: OwnedItemInfo): void {
  const payout = sellPrice(item);
  const boosts = boostText(item);
  const relock = isLastDrawingTool(ctx, item.id);
  const gift = isRelGift(item.id);

  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "판매 확인"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;font-weight:700;margin:0 0 6px" }, item.name),
        el(
          "p",
          { style: "font-size:14px;margin:0 0 10px" },
          `정가 ${formatNumber(item.price)}원의 50% · `,
          el("b", { style: "color:var(--accent)" }, `+${formatNumber(payout)}원`),
        ),
        el(
          "p",
          { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 10px" },
          boosts
            ? "물건을 넘기면 그 물건으로 올랐던 스탯도 같이 사라져요."
            : "이 물건은 스탯을 올려주지 않으니, 회수될 스탯도 없어요.",
        ),
        boosts
          ? el(
              "p",
              { class: "pm-sell__recall" },
              icon("x", { size: 13 }),
              el("span", {}, `회수될 스탯 — ${boosts}`),
            )
          : null,
        relock
          ? el(
              "p",
              { class: "pm-sell__warn" },
              "⚠️ 마지막 남은 창작 도구예요. 이걸 팔면 애니·만화 창작이 다시 잠깁니다.",
            )
          : null,
        gift
          ? el(
              "p",
              { class: "pm-sell__warn" },
              `⚠️ 소중한 사람에게 받은 선물이에요. 팔면 평판 −${GIFT_SELL_REP_PENALTY} · 도덕 −${GIFT_SELL_MORALITY_PENALTY}로 크게 떨어집니다.`,
            )
          : null,
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "취소"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let got: number | null = null;
                c.update((st) => {
                  got = sellOwnedItem(st, item.id);
                });
                c.closeModal();
                if (got == null) c.toast("이미 없는 물건이에요");
                else c.toast(`${item.name} 판매 완료! +${formatNumber(got)}원`);
              },
            },
            "팔기",
          ),
        ),
      ),
    ),
  );
}

/**
 * 보유 아이템 목록. sellable이면 각 줄에 판매 버튼이 붙는다(피망마켓 판매 탭).
 * 개수 묶음(mouse ×3)은 ownedInventory가 이미 해준다.
 */
export function inventoryList(ctx: GameContext, sellable: boolean): HTMLElement {
  const items = ownedInventory(ctx.store.getState());

  if (items.length === 0) {
    return el(
      "div",
      { class: "empty" },
      sellable
        ? "팔 물건이 없어요. 서랍장이 텅 비었습니다."
        : "서랍장이 텅 비었어요. 쇼핑에서 뭐라도 사보는 건 어때요?",
    );
  }

  return el(
    "div",
    { class: "inv-list" },
    ...items.map(({ item, count }) => {
      const boosts = boostText(item);
      return el(
        "div",
        { class: "inv-row" },
        el(
          "div",
          { class: "inv-row__copy" },
          el(
            "div",
            { class: "inv-row__name" },
            item.name,
            count > 1 ? el("span", { class: "inv-row__count" }, `×${count}`) : null,
          ),
          item.desc ? el("div", { class: "inv-row__desc" }, item.desc) : null,
          el(
            "div",
            { class: "inv-row__meta" },
            boosts
              ? el("span", { class: "inv-row__stat" }, boosts)
              : el("span", { class: "inv-row__stat inv-row__stat--none" }, "스탯 효과 없음"),
            el("span", { class: "inv-row__price" }, `정가 ${formatNumber(item.price)}원`),
          ),
        ),
        sellable
          ? el(
              "button",
              { class: "inv-row__sell", onclick: () => openSellConfirm(ctx, item) },
              el("span", {}, `${formatNumber(sellPrice(item))}원에 팔기`),
            )
          : null,
      );
    }),
  );
}

/** 서랍장 모달 — 스테이터스 독의 '서랍장' 버튼으로 연다. 판매는 피망마켓에서 한다. */
export function renderInventoryModal(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("drawer", { size: 18 }), "서랍장"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "compose-hint", style: "margin:0 0 12px" },
        "지금까지 사 모은 물건들이에요. 피망마켓에서 정가의 50%에 되팔 수 있지만, 팔면 그 물건으로 올랐던 스탯도 같이 사라져요.",
      ),
      inventoryList(ctx, false),
    ),
  );
}
