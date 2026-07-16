import type { GameContext } from "./context";
import type { GameEvent } from "@/data/events";
import { resolveEvent } from "@/systems/events";
import { el } from "@/utils/dom";

/**
 * 이벤트 팝업. 두 단계로 동작한다.
 *  1) 선택지 화면 → 2) 결과 화면(확인 버튼으로 닫기)
 */
export function renderEventModal(ctx: GameContext, event: GameEvent): HTMLElement {
  const container = el("div", { class: "modal modal--event" });

  function showChoices(): void {
    const state = ctx.store.getState();
    const choiceButtons = event.choices
      .map((choice, index) => ({ choice, index }))
      .filter(({ choice }) => choice.requires?.(state) ?? true)
      .map(({ choice, index }) =>
        el(
          "button",
          {
            class: "event-choice",
            onclick: () => {
              let result = "";
              ctx.update((s) => {
                result = resolveEvent(s, event, index);
              });
              showResult(result);
            },
          },
          `${choice.label}`,
        ),
      );

    container.replaceChildren(
      el("div", { class: "modal__head" }, event.title),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 16px" },
          event.description,
        ),
        ...choiceButtons,
      ),
    );
  }

  function showResult(result: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "결과"),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.6;margin:0 0 18px" }, result),
        el(
          "div",
          { style: "text-align:right" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  showChoices();
  return container;
}
