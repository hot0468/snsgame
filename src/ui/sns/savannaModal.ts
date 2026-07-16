import type { GameContext } from "@/ui/context";
import {
  SAVANNA_INTRUSION_CHOICES,
  SAVANNA_INTRUSION_PAGES,
  resolveSavannaIntrusion,
} from "@/systems/savanna";
import { el } from "@/utils/dom";

/**
 * 사바나 방송 중 '시청자 난입' 장문 시나리오(웹소설 형식 리더).
 * 페이지를 넘겨 읽고 마지막 장에서 선택하면, 효과가 적용되고 다음날로 넘어간다.
 */
export function renderSavannaIntrusionModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--novel" });
  const pages = SAVANNA_INTRUSION_PAGES;
  let pageIndex = 0;

  function renderReader(): void {
    const isLast = pageIndex === pages.length - 1;

    const nav = isLast
      ? el(
          "div",
          { class: "novel-choices" },
          el("div", { class: "novel-choices__hint" }, "— 어떻게 할까? —"),
          ...SAVANNA_INTRUSION_CHOICES.map((choice, index) =>
            el(
              "button",
              {
                class: "novel-choice",
                onclick: () => {
                  let result = "";
                  ctx.update((s) => {
                    result = resolveSavannaIntrusion(s, index).message;
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
          el("span", { class: "novel-nav__page" }, `${pageIndex + 1} / ${pages.length}`),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                if (pageIndex < pages.length - 1) pageIndex++;
                renderReader();
              },
            },
            "다음",
          ),
        );

    const bodyEl = el(
      "div",
      { class: "novel-body" },
      el("p", { class: "novel-text" }, pages[pageIndex]),
    );

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        "🔴 시청자 난입",
        isLast
          ? null
          : el("span", { class: "novel-head__page" }, `${pageIndex + 1} / ${pages.length}`),
      ),
      bodyEl,
      el("div", { class: "novel-footer" }, nav),
    );
    bodyEl.scrollTop = 0;
  }

  function renderResult(result: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "방송 종료"),
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
            {
              class: "btn",
              onclick: () => {
                ctx.closeModal();
                ctx.afterAction("day");
              },
            },
            "다음날로",
          ),
        ),
      ),
    );
  }

  renderReader();
  return container;
}
