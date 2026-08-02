import type { GameContext } from "./context";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 새해 결산 — 1월 1일 아침에 지난해를 한 장으로 요약한다.
 *
 * 연말 시상식(12/29·30)으로 12월은 채워졌는데 **새해 첫날이 비어 있었다.** 결산에 필요한
 * 값은 전부 이미 상태에 있었다(팔로워·수상·정점·순위·기부) — 모아서 보여주기만 하면 된다.
 *
 * ⚠️ **숫자만 늘어놓지 않는다.** 한 해를 한 줄로 요약하는 문구를 위에 둔다 —
 *    "팔로워 +12,400"보다 "올해는 자리를 잡은 해였다"가 먼저 읽혀야 결산이 된다.
 */
export function renderYearReviewModal(ctx: GameContext): HTMLElement {
  const r = ctx.store.getState().yearReview;

  /** 한 해를 한 줄로 — 가장 크게 움직인 축을 골라 말한다. */
  function headline(): string {
    if (!r) return "한 해가 지나갔다.";
    if (r.awards > 0 && r.peaks > 0) return "상을 받고 정점에도 닿은 해였다.";
    if (r.awards > 0) return "무대에 올라가 본 해였다.";
    if (r.peaks > 0) return "끝까지 올라가 본 해였다.";
    if (r.bestRank != null && r.bestRank <= 10) return "이름이 알려지기 시작한 해였다.";
    if (r.followerGain > 0) return "조금씩이지만 자리를 잡아간 해였다.";
    if (r.followerGain < 0) return "잃은 게 더 많았던 해였다. 그래도 아직 끝은 아니다.";
    return "특별할 것 없이 지나간 해였다. 그런 해도 있다.";
  }

  const rows: [string, string][] = r
    ? [
        [
          "팔로워",
          `${formatNumber(r.followers)}명 (${r.followerGain >= 0 ? "+" : ""}${formatNumber(r.followerGain)})`,
        ],
        ["소지금", `${formatNumber(r.money)}원`],
        ["최고 순위", r.bestRank != null ? `${r.bestRank}위` : "순위권 밖"],
        ["수상", r.awards > 0 ? `${r.awards}회` : "없음"],
        ["경력 정점", r.peaks > 0 ? `${r.peaks}개` : "없음"],
        ["기부", r.donated > 0 ? `${formatNumber(r.donated)}원 (누적)` : "없음"],
      ]
    : [];

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el(
        "span",
        { class: "modal__head-title" },
        icon("sun", { size: 18 }),
        r ? `${r.year}년 결산` : "새해",
      ),
    ),
    el(
      "div",
      { class: "modal__body" },
      el("p", { style: "font-size:15px;line-height:1.7;margin:0 0 14px" }, headline()),
      ...rows.map(([k, v]) =>
        el(
          "div",
          { class: "taxi__payout", style: "margin:0 0 6px" },
          el("span", { class: "taxi__fare" }, k),
          el("span", { class: "taxi__rating" }, v),
        ),
      ),
      el(
        "p",
        { class: "compose-hint", style: "margin:12px 0 16px" },
        "새해가 밝았다. 올해 실적은 오늘부터 다시 센다.",
      ),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((s) => {
              s.pendingYearReview = false;
            });
            ctx.closeModal();
          },
        },
        "확인",
      ),
    ),
  );
}
