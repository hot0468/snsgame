import type { GameContext } from "./context";
import type { GameEvent, EventEffect } from "@/data/events";
import { resolveEvent } from "@/systems/events";
import { eventImage } from "@/data/eventImages";
import { el, formatNumber } from "@/utils/dom";

/** 이벤트 상단 리본(이모지 없음). 이 팝업이 '돌발 이벤트'임을 한눈에 알린다. */
function eventRibbon(text: string, result = false): HTMLElement {
  return el("div", { class: "event-ribbon" + (result ? " event-ribbon--result" : "") }, text);
}

/** 이벤트 이미지(있을 때만). assets/events/{id}.webp. */
function eventImageEl(eventId: string): HTMLElement | null {
  const url = eventImage(eventId);
  return url ? el("div", { class: "event-img" }, el("img", { src: url, alt: "" })) : null;
}

/** 결과 화면의 스탯 증감 칩들(system-notice와 다른, 이벤트 전용 압축 표기). */
function deltaChips(effect: EventEffect): HTMLElement | null {
  const chips: HTMLElement[] = [];
  const push = (label: string, n: number | undefined, unit = "") => {
    if (!n) return;
    const up = n > 0;
    chips.push(
      el(
        "span",
        { class: "event-chip event-chip--" + (up ? "up" : "down") },
        `${label} ${up ? "+" : "-"}${formatNumber(Math.abs(n))}${unit}`,
      ),
    );
  };
  push("팔로워", effect.followers);
  if (effect.followersPct) push("팔로워", effect.followersPct, "%");
  push("소지금", effect.money, "원");
  push("행동력", effect.action);
  push("정신력", effect.mental);
  push("도덕성", effect.morality);
  push("평판", effect.reputation);
  if (effect.skills) {
    for (const [k, v] of Object.entries(effect.skills)) push(k, v);
  }
  return chips.length ? el("div", { class: "event-chips" }, ...chips) : null;
}

/**
 * 이벤트 팝업. 두 단계로 동작한다.
 *  1) 선택지 화면 → 2) 결과 화면(확인 버튼으로 닫기)
 * 상단 '돌발 이벤트' 리본 + (있으면) 장면 이미지로 일반 알림과 구분된다.
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
              showResult(result, choice.effect, choice.label);
            },
          },
          `${choice.label}`,
        ),
      );

    const img = eventImageEl(event.id);
    container.replaceChildren(
      ...[
        eventRibbon("돌발 이벤트"),
        img,
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
      ].filter((n): n is HTMLElement => n !== null),
    );
  }

  function showResult(result: string, effect: EventEffect, choiceLabel: string): void {
    // 이벤트 전용 결과 화면 — 공용 system-notice 대신 이벤트 정체성(리본·이미지·선택 반향)을 유지한다.
    // openModal로 모달을 새로 그리게 한다(container 갈아끼우기보다 안전 — ctx.update 재렌더 충돌 회피).
    ctx.openModal((c) =>
      el(
        "div",
        { class: "modal modal--event" },
        eventRibbon("이벤트 결과", true),
        eventImageEl(event.id),
        el("div", { class: "modal__head" }, event.title),
        el(
          "div",
          { class: "modal__body" },
          el("div", { class: "event-result__choice" }, `『${choiceLabel}』`),
          el("p", { class: "event-result__narr" }, result),
          deltaChips(effect),
          el(
            "button",
            { class: "event-choice", onclick: () => c.closeModal() },
            "확인",
          ),
        ),
      ),
    );
  }

  showChoices();
  return container;
}
