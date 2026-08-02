import type { GameContext } from "./context";
import { PEAK_STEP } from "@/data/jobRanks";
import { resolveJobPromotion, type PromotionResult } from "@/systems/jobRanks";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 직업 승급 팝업 — 경력 등급이 한 계단 오른 그 순간.
 *
 * 직업 레벨이 무한히 오르기만 하고 아무것도 안 줘서 "여기까지 왔다"는 자리가 없었다.
 * 배구부 전국체전 우승이 코치에게 해준 걸 나머지 직업에도 만든다.
 *
 * ⚠️ **효과 적용은 렌더가 아니라 '확인'에서 한다.** 렌더 중에 update를 부르면 재렌더가
 *    이 함수를 다시 불러 축하금이 반복 지급된다(coachCampModal의 sceneModal과 같은 함정).
 */
export function renderJobRankModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });
  const pending = ctx.store.getState().pendingJobRank;
  const peak = (pending?.step ?? 0) >= PEAK_STEP;

  function showResult(r: PromotionResult): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          icon("star", { size: 18 }),
          r.peak ? `${r.jobLabel} — ${r.title}` : `${r.jobLabel} 승급`,
        ),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "div",
          { class: "taxi__payout", style: "margin-bottom:12px" },
          el("span", { class: "taxi__fare" }, r.title),
          el(
            "span",
            { class: "taxi__rating" },
            r.peak ? `${r.step}/${PEAK_STEP} · 정점` : `${r.step}/${PEAK_STEP}단계`,
          ),
        ),
        el(
          "p",
          { style: "font-size:15px;line-height:1.8;margin:0 0 12px;white-space:pre-wrap" },
          r.text,
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin:0 0 16px" },
          `승급 축하금 ${formatNumber(r.bonus)}원` +
            (r.peak ? " · 평판 +5 · 커리어에 영구히 남는다" : ""),
        ),
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
      ),
    );
  }

  /** 첫 화면 — 열어보기 전의 한 줄. 여기서 확정한다. */
  container.replaceChildren(
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), "경력 소식"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.7;margin:0 0 16px" },
        peak
          ? "그동안 쌓아온 것이 한 자리에 닿았다는 연락이 왔다."
          : "쌓인 시간이 자리를 하나 바꿔놓았다는 연락이 왔다.",
      ),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            let r: PromotionResult | null = null;
            ctx.update((s) => {
              r = resolveJobPromotion(s);
            });
            if (r) showResult(r as PromotionResult);
            else ctx.closeModal();
          },
        },
        "열어본다",
      ),
    ),
  );
  return container;
}
