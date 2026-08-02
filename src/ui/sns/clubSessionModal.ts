import type { GameContext } from "@/ui/context";
import type { ClubScenario } from "@/data/privateClub";
import { CLUB_NAME } from "@/data/privateClub";
import { pickClubScenario, resolveClubSession } from "@/systems/privateClub";
import { el } from "@/utils/dom";

/**
 * 비공개 클럽 세션(체벌 위주 SM) 시나리오 리더 — crewSecretModal과 같은 웹소설 구조다.
 *
 * ⚠️ **러닝크루의 SM 규율 리더(crewSecretModal)와 별개 화면이다.** 시나리오 풀도
 *    resolve 함수도 다르다 — 둘을 한 화면으로 합치면 어느 모임의 세션인지 알 수 없게 된다.
 */
export function renderClubSessionModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--novel modal--adult" });
  // openModal은 함수 identity로 캐시 → 이 render는 한 번만 실행되므로 시나리오는 여기서 고정된다.
  const scenario: ClubScenario = pickClubScenario();
  const pages = scenario.pages;
  let pageIndex = 0;

  // 세션은 끝까지 간다 — 닫기(✕) 없음. 마지막 장 선택으로만 종료돼 중도 이탈/리롤을 막는다.
  // (안전어로 멈추는 선택은 시나리오 안의 선택지로 들어 있다.)

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
                    result = resolveClubSession(s, scenario, index);
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
        `${CLUB_NAME} — ${scenario.title}`,
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
