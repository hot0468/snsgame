import type { GameContext } from "./context";
import { advanceRelStage, relPendingArc } from "@/systems/relationship";
import { getRelChar } from "@/data/relationships";
import { el } from "@/utils/dom";
import { renderKakaoListView } from "./kakaoListView";

/**
 * 관계 이벤트(만남 arc) 웹소설 리더 — meetingModal 패턴 재활용.
 * 지금 열람 가능한 arc(relPendingArc)의 pages를 한 장씩 넘겨 읽고, 마지막 장 choices에서
 * advanceRelStage로 선택을 확정한다({name}은 캐릭터 이름으로 치환). 결과 후 카톡 목록으로 돌아간다.
 */
export function renderRelEventModal(ctx: GameContext, charId: string): HTMLElement {
  const container = el("div", { class: "modal modal--novel" });

  const state = ctx.store.getState();
  const char = getRelChar(charId);
  const arc = relPendingArc(state, charId);
  if (!char || arc === null) {
    container.append(el("div", { class: "modal__body" }, "지금 열람할 이벤트가 없어요."));
    return container;
  }
  const event = char.events[arc];
  const fill = (t: string): string => t.replace(/\{name\}/g, char.name);
  let pageIndex = 0;

  const closeX = (): HTMLElement =>
    el("button", { class: "novel-close", "aria-label": "닫기", onclick: () => ctx.closeModal() }, "✕");

  function renderReader(): void {
    const isLast = pageIndex === event.pages.length - 1;

    const nav = isLast
      ? el(
          "div",
          { class: "novel-choices" },
          el("div", { class: "novel-choices__hint" }, "— 당신의 선택은? —"),
          ...event.choices.map((choice, index) =>
            el(
              "button",
              {
                class: "novel-choice",
                onclick: () => {
                  let result = "";
                  ctx.update((s) => {
                    result = advanceRelStage(s, charId, index);
                  });
                  renderResult(result);
                },
              },
              choice.label,
            ),
          ),
        )
      : el(
          "div",
          { class: "novel-nav" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              disabled: pageIndex === 0,
              onclick: () => {
                if (pageIndex > 0) pageIndex--;
                renderReader();
              },
            },
            "이전",
          ),
          el("span", { class: "novel-nav__page" }, `${pageIndex + 1} / ${event.pages.length}`),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                if (pageIndex < event.pages.length - 1) pageIndex++;
                renderReader();
              },
            },
            "다음",
          ),
        );

    const bodyEl = el(
      "div",
      { class: "novel-body" },
      el("p", { class: "novel-text" }, fill(event.pages[pageIndex])),
    );

    container.replaceChildren(
      closeX(),
      el(
        "div",
        { class: "modal__head" },
        char!.nickname,
        isLast
          ? null
          : el("span", { class: "novel-head__page" }, `${pageIndex + 1} / ${event.pages.length}`),
      ),
      bodyEl,
      el("div", { class: "novel-footer" }, nav),
    );
    bodyEl.scrollTop = 0;
  }

  function renderResult(result: string): void {
    container.replaceChildren(
      closeX(),
      el("div", { class: "modal__head" }, `${char!.nickname} — 만남`),
      el(
        "div",
        { class: "novel-body" },
        el("p", { class: "novel-text novel-text--result" }, result),
      ),
      el(
        "div",
        { class: "novel-footer" },
        el(
          "div",
          { style: "text-align:right;width:100%" },
          el(
            "button",
            { class: "btn", onclick: () => ctx.openModal(renderKakaoListView) },
            "카톡으로 돌아가기",
          ),
        ),
      ),
    );
  }

  renderReader();
  return container;
}
