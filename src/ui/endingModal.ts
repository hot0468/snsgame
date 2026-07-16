import type { GameContext } from "./context";
import type { EndingOffer } from "@/systems/endings";
import { el } from "@/utils/dom";

/**
 * 엔딩 제안 모달(데뷔·작가 등). 조건 충족 시 뜬다.
 * - 수락: 해당 엔딩(gameOver)으로.
 * - 거절: 다시 제안하지 않고 계속 플레이.
 */
export function renderEndingOfferModal(ctx: GameContext, ending: EndingOffer): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, ending.offerTitle),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.8;margin:0 0 16px" },
        ending.offerLead,
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el(
          "button",
          {
            class: "btn btn--ghost",
            onclick: () => {
              ctx.update((g) => {
                if (!g.endingsDeclined.includes(ending.id)) g.endingsDeclined.push(ending.id);
              });
              ctx.closeModal();
              ctx.toast("이번엔 그 길을 택하지 않았어요. 계속 플레이합니다");
            },
          },
          ending.declineLabel,
        ),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update((g) => {
                g.gameOver = ending.reason;
              });
            },
          },
          ending.confirmLabel,
        ),
      ),
    ),
  );
}
