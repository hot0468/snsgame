import type { GameContext } from "./context";
import type { GameEvent, EventEffect } from "@/data/events";
import { resolveEvent } from "@/systems/events";
import { renderSystemNotice } from "./systemNotice";
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
              // 선택 effect를 넘겨 감기/부상 같은 부정 결과는 자동 레드로 뜨게 한다.
              showResult(result, choice.effect);
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

  function showResult(result: string, effect: EventEffect): void {
    // 결과 알림을 공용 시스템 알림 카드로 통일한다. effect의 핵심 자원 필드가 tone(블루/레드) 자동 판정.
    // openModal로 모달 정체성을 바꿔 app이 노드를 새로 그리게 한다(container 갈아끼우기보다 안전).
    ctx.openModal((c) =>
      renderSystemNotice(c, {
        message: result,
        deltas: {
          action: effect.action,
          mental: effect.mental,
          morality: effect.morality,
          reputation: effect.reputation,
          money: effect.money,
          followers: effect.followers,
        },
      }),
    );
  }

  showChoices();
  return container;
}
