import type { GameContext } from "./context";
import { el } from "@/utils/dom";

/**
 * 고양이 전원 버튼 팝업.
 * 고양이가 전원 버튼을 밟으면(systems가 advanceTime에서 catPowerPending=true)
 * app.ts가 2초간 화면을 까맣게 만든 뒤 이 팝업을 띄운다.
 * 확인 시 catPowerPending을 클리어해야 다음 render에서 다시 강제로 뜨지 않는다(필수).
 * 페널티는 없다 — 순수 개그.
 */
export function renderCatPowerModal(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "modal modal--catpower" },
    el(
      "div",
      { class: "modal__body catpower__body" },
      el("div", { class: "catpower__cat", "aria-hidden": "true" }, "🐈"),
      el("p", { class: "catpower__line" }, "고양이가 또 컴퓨터 전원 버튼을 눌렀다…"),
      el(
        "div",
        { class: "compose-actions catpower__actions" },
        el(
          "button",
          {
            class: "btn catpower__btn",
            onclick: () => {
              ctx.update((s) => {
                s.catPowerPending = false;
              });
              ctx.closeModal();
            },
          },
          "다시 켠다",
        ),
      ),
    ),
  );
}
