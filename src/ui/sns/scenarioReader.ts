import type { GameContext } from "@/ui/context";
import type { ShootScenario } from "@/data/lingerie";
import { el } from "@/utils/dom";

export interface ScenarioReaderOpts {
  headTitle: string;
  scenario: ShootScenario;
  resolve: (s: import("@/core/types").GameState, choiceIndex: number) => string;
  resultHead?: string;
}

/**
 * 공용 강제 이수 시나리오 리더(웹소설 형식). crewSecretModal을 일반화한 것.
 * 열 때 시나리오는 호출부가 이미 확정해 넘긴다(리더는 pick 안 함).
 * 닫기(✕) 없음 — 마지막 장 choices로만 종료돼 중도 이탈/리롤을 막는다.
 * 마지막 choices → ctx.update(resolve) → 결과 → 확인 → closeModal + afterAction("day").
 */
export function renderScenarioReaderModal(ctx: GameContext, opts: ScenarioReaderOpts): HTMLElement {
  const container = el("div", { class: "modal modal--novel modal--adult" });
  const { scenario, resolve, headTitle, resultHead = "촬영 종료" } = opts;
  const pages = scenario.pages;
  let pageIndex = 0;

  function renderReader(): void {
    const isLast = pageIndex === pages.length - 1;

    const nav = isLast
      ? el(
          "div",
          { class: "novel-choices" },
          el("div", { class: "novel-choices__hint" }, "— 어떻게 할까? —"),
          ...scenario.choices.map((choice, index) =>
            el(
              "button",
              {
                class: "novel-choice",
                onclick: () => {
                  let result = "";
                  ctx.update((s) => {
                    result = resolve(s, index);
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
        headTitle,
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
      el("div", { class: "modal__head" }, resultHead),
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
