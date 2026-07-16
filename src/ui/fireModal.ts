import type { GameContext } from "./context";
import { FIRE_ENDING_REASON } from "@/core/state";
import { el, formatNumber } from "@/utils/dom";

/**
 * 소지금이 100억에 도달했을 때 뜨는 파이어족 제안.
 * - 그렇지: 조기 은퇴(파이어족 엔딩).
 * - 더 벌어야지: 게임을 계속한다(다시 제안하지 않음).
 */
export function renderFireOfferModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "💰 인생의 갈림길"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.8;margin:0 0 6px" },
        `통장에 ${formatNumber(s.money)}원.`,
      ),
      el(
        "p",
        { style: "font-size:15px;line-height:1.8;margin:0 0 16px" },
        "이 정도면... 이제 그만 일해도 노후가 두렵지 않겠는데?",
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
                g.fireDeclined = true;
              });
              ctx.closeModal();
              ctx.toast("아직은 더 벌어야지! 게임을 계속합니다");
            },
          },
          "더 벌어야지",
        ),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update((g) => {
                g.gameOver = FIRE_ENDING_REASON;
              });
            },
          },
          "그렇지",
        ),
      ),
    ),
  );
}
