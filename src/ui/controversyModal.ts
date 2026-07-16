import type { GameContext } from "./context";
import type { GameEvent } from "@/data/events";
import { resolveEvent } from "@/systems/events";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 논란/박제 강제 팝업. 대응(사과문/잠수/역공)을 고르면 결과가 적용된다.
 * 닫기 버튼은 없다(반드시 대응해야 함).
 */
export function renderControversyModal(ctx: GameContext, event: GameEvent): HTMLElement {
  const container = el("div", { class: "modal" });

  function showChoices(): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("megaphone", { size: 18 }), event.title),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 16px" },
          event.description,
        ),
        ...event.choices.map((choice, index) =>
          el(
            "button",
            {
              class: "event-choice",
              onclick: () => {
                let result = "";
                ctx.update((s) => {
                  result = resolveEvent(s, event, index);
                  s.pendingControversy = null;
                });
                showResult(result || choice.result);
              },
            },
            choice.label,
          ),
        ),
      ),
    );
  }

  function showResult(result: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "논란 이후"),
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
