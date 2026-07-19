import type { GameContext } from "@/ui/context";
import type { CrewSecretScenario } from "@/data/crewSecret";
import { pickCrewSecretScenario, resolveCrewSecret } from "@/systems/crew";
import { el } from "@/utils/dom";

/**
 * 비공개 엘리트 러닝크루의 SM 규율 시나리오(웹소설 형식 리더).
 * savannaModal 패턴 복제 — 열 때 랜덤 시나리오 1종을 확정(클로저 캐시, 재렌더에도 고정),
 * 페이지를 넘겨 읽고 마지막 장 choices에서 규율이 집행된다.
 */
export function renderCrewSecretModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--novel modal--adult" });
  // openModal은 함수 identity로 캐시 → 이 render는 한 번만 실행되므로 시나리오는 여기서 고정된다.
  const scenario: CrewSecretScenario = pickCrewSecretScenario();
  const pages = scenario.pages;
  let pageIndex = 0;

  // 규율은 강제 이수 — 닫기(✕) 없음. 마지막 장 선택으로만 종료돼 중도 이탈/리롤을 막는다.

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
                    result = resolveCrewSecret(s, scenario, index);
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
        scenario.title,
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
      el("div", { class: "modal__head" }, "정기런 종료"),
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
