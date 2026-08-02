import type { GameContext } from "./context";
import { MEDIA_AWARDS_NAME, WORK_AWARDS_NAME } from "@/data/awards";
import { resolveAwards, type AwardsOutcome } from "@/systems/awards";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 연말 시상식 팝업 — 12월 29일 송년회, 12월 30일 방송미디어대상.
 *
 * ⚠️ **상금 지급은 렌더가 아니라 '확인'에서 한다.** 렌더 중에 update를 부르면 재렌더가
 *    이 함수를 다시 불러 상금이 반복 지급된다(coachCampModal·jobRankModal과 같은 함정).
 */
export function renderAwardsModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });
  const show = ctx.store.getState().pendingAwards;
  const showName = show === "media" ? MEDIA_AWARDS_NAME : WORK_AWARDS_NAME;

  function showResult(o: AwardsOutcome): void {
    const win = o.result;
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), o.showName),
      ),
      el(
        "div",
        { class: "modal__body" },
        win
          ? el(
              "div",
              { class: "taxi__payout", style: "margin-bottom:12px" },
              el(
                "span",
                { class: "taxi__fare" },
                `${win.award.label}${win.grand ? " 대상" : ""}`,
              ),
              el("span", { class: "taxi__rating" }, `상금 ${formatNumber(win.prize)}원`),
            )
          : el(
              "div",
              { class: "taxi__payout", style: "margin-bottom:12px" },
              el("span", { class: "taxi__fare" }, "수상 없음"),
              el("span", { class: "taxi__rating" }, "올해는 여기까지"),
            ),
        el(
          "p",
          { style: "font-size:15px;line-height:1.8;margin:0 0 12px;white-space:pre-wrap" },
          win ? (win.grand ? win.award.grandText : win.award.text) : o.missLine,
        ),
        win
          ? el(
              "p",
              { class: "compose-hint", style: "margin:0 0 16px" },
              `평판 ${win.award.reputation >= 0 ? "+" : ""}${win.award.reputation} · ` +
                `팔로워 +${formatNumber(win.award.followers)}`,
            )
          : el("p", { class: "compose-hint", style: "margin:0 0 16px" }, ""),
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
      ),
    );
  }

  container.replaceChildren(
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), showName),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.7;margin:0 0 16px" },
        show === "media"
          ? "연말 시상식장이다. 올해 얼굴이 팔린 사람들이 한자리에 모였다. 후보 명단이 곧 발표된다."
          : "송년회 자리다. 밥을 먹다 말고 사회자가 마이크를 잡았다. 올해 시상 순서라고 한다.",
      ),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            let o: AwardsOutcome | null = null;
            ctx.update((s) => {
              o = resolveAwards(s);
            });
            if (o) showResult(o as AwardsOutcome);
            else ctx.closeModal();
          },
        },
        "발표를 듣는다",
      ),
    ),
  );
  return container;
}
