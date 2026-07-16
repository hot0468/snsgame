import type { GameContext } from "./context";
import { el } from "@/utils/dom";

/**
 * 새 날 아침 딤팝업.
 * 새 날이 시작될 때(systems가 onNewDay에서 dawnPending=true) 가장 먼저 뜬다.
 * 확인 시 dawnPending을 클리어해야 다음 render에서 다시 강제로 뜨지 않는다(필수).
 */
export function renderDawnModal(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "modal modal--dawn" },
    el(
      "div",
      { class: "modal__body dawn__body" },
      el("div", { class: "dawn__sun", "aria-hidden": "true" }),
      el("p", { class: "dawn__line" }, "오늘도 또다시 해가 떴다"),
      el(
        "div",
        { class: "compose-actions dawn__actions" },
        el(
          "button",
          {
            class: "btn dawn__btn",
            onclick: () => {
              ctx.update((s) => {
                s.dawnPending = false;
              });
              ctx.closeModal();
            },
          },
          "하루를 시작한다",
        ),
      ),
    ),
  );
}
