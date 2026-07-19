import type { GameContext } from "@/ui/context";
import { getActiveAccount } from "@/core/state";
import { fillName, pickMeetingScenario, resolveMeeting } from "@/systems/meeting";
import { el } from "@/utils/dom";

/**
 * DM 상대와의 오프라인 만남 — 웹소설 형식 리더.
 * pages를 한 장씩 넘겨 읽고, 마지막 장에서 선택지가 나타난다.
 * 확인하면 DM 창으로 돌아간다.
 */
export function renderMeetingModal(ctx: GameContext, threadId: string): HTMLElement {
  const container = el("div", { class: "modal modal--novel" });

  // 시나리오는 열 때 한 번 확정한다.
  const state = ctx.store.getState();
  const thread = getActiveAccount(state).dms.find((t) => t.id === threadId);
  if (!thread) {
    container.append(el("div", { class: "modal__body" }, "대화를 찾을 수 없습니다."));
    return container;
  }
  const scenario = pickMeetingScenario(state, thread);
  // 성인 시나리오만 분홍 테마(비성인 만남은 기본색 유지).
  if (scenario.adultOnly) container.classList.add("modal--adult");
  // 본문을 한 문자열에 몰아 쓴 경우(성인 시나리오 대부분) 빈 줄(\n\n) 기준으로
  // 페이지를 자동 분할해 단계형으로 읽히게 한다. 이미 여러 페이지면 그대로 둔다.
  const pages =
    scenario.pages.length === 1 && /\n\s*\n/.test(scenario.pages[0])
      ? scenario.pages[0].split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
      : scenario.pages;
  let pageIndex = 0;

  function renderReader(): void {
    const isLast = pageIndex === pages.length - 1;

    const nav = isLast
      ? el(
          "div",
          { class: "novel-choices" },
          el("div", { class: "novel-choices__hint" }, "— 당신의 선택은? —"),
          ...scenario.choices.map((choice, index) =>
            el(
              "button",
              {
                class: "novel-choice",
                onclick: () => {
                  let result = "";
                  ctx.update((s) => {
                    const live = getActiveAccount(s).dms.find((x) => x.id === threadId);
                    if (live) result = resolveMeeting(s, live, scenario, index);
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
      el("p", { class: "novel-text" }, fillName(pages[pageIndex], thread!)),
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

    // 페이지를 넘길 때마다 본문 상단으로 스크롤
    bodyEl.scrollTop = 0;
  }

  function renderResult(result: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "만남의 끝"),
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
                ctx.ui.snsPage = "dm";
                ctx.ui.dmThreadId = threadId;
                ctx.closeModal();
              },
            },
            "DM으로 돌아가기",
          ),
        ),
      ),
    );
  }

  renderReader();
  return container;
}
