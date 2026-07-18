import type { GameContext } from "./context";
import { SLOTS_PER_DAY } from "@/core/state";
import {
  CAPTURE_DAYS,
  LOAN_DEFAULT_ENDING_STREAK,
  applyCapturePenalty,
  canRepayLoan,
  repayLoan,
} from "@/systems/loan";
import { addSchedule, advanceTime } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 대출 상환 마감일 팝업(강제).
 * 갚을 수 있으면 상환, 없으면 3일간 잡혀간다(취업 중이면 성과 대폭 하락).
 */
export function renderLoanModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function showDue(): void {
    const s = ctx.store.getState();
    const loan = s.loan;
    if (!loan) {
      queueMicrotask(() => ctx.closeModal());
      return container.replaceChildren();
    }
    const repayable = canRepayLoan(s);

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("coin", { size: 18 }), "빚 상환일"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 16px" },
          `대부업체 상환 마감일이다. 갚아야 할 돈은 ${formatNumber(loan.repayAmount)}원.`,
        ),
        repayable
          ? el(
              "button",
              { class: "event-choice", onclick: () => doRepay() },
              `${formatNumber(loan.repayAmount)}원을 갚는다`,
            )
          : el(
              "div",
              {},
              el(
                "p",
                { class: "compose-hint", style: "margin:0 0 14px" },
                "통장이 텅 비었다. 갚을 돈이 없다...",
              ),
              el(
                "button",
                { class: "event-choice", onclick: () => doCapture() },
                "돈이 없다... (끌려간다)",
              ),
            ),
      ),
    );
  }

  function doRepay(): void {
    let amount = 0;
    ctx.update((s) => {
      amount = repayLoan(s);
      addSchedule(s, `사채 상환 -${formatNumber(amount)}원`, "system");
    });
    showResult(`${formatNumber(amount)}원을 갚아 빚을 청산했다. 겨우 한숨 돌렸다...`);
  }

  function doCapture(): void {
    let performanceHit = false;
    let streak = 0;
    let endingReason: string | null = null;
    // 성인물 해제 시, '몸으로 때운다'는 완곡어를 업소 근무로 명시한다(아래 분기).
    // 메커니즘(정신력 -30·빚 소멸)은 동일 — 강제 성노동을 스탯 보상으로 만들지 않는다.
    let adult = false;
    ctx.update((s) => {
      adult = s.adultMode;
      const r = applyCapturePenalty(s);
      performanceHit = r.performanceHit;
      streak = r.defaultStreak;
      endingReason = r.endingReason;
      addSchedule(
        s,
        `사채 미상환 (${streak}/${LOAN_DEFAULT_ENDING_STREAK}) — ${CAPTURE_DAYS}일간 잡혀감`,
        "system",
      );
      // 엔딩이 확정되면 시간을 더 흘려보내지 않는다(게임 종료).
      if (!endingReason) advanceTime(s, CAPTURE_DAYS * SLOTS_PER_DAY);
    });

    if (endingReason) {
      showResult(endingReason);
      return;
    }
    const perfLine = performanceHit ? " 무단결근으로 회사 성과도 바닥났다..." : "";
    const streakLine = ` (연체 ${streak}/${LOAN_DEFAULT_ENDING_STREAK})`;
    // 성인물 해제 여부로 '몸으로 때운' 3일의 서술이 갈린다. 그래픽하지 않게, 암울한 결과로만.
    showResult(
      adult
        ? `돈을 갚지 못한 대가로 대부업체가 넘긴 뒷골목 업소에서 ${CAPTURE_DAYS}일을 보냈다. ` +
            `밤마다 낯선 손님을 받아 빚을 몸으로 갚는 사흘이었다. 겨우 풀려났을 땐 정신이 너덜너덜했다.` +
            perfLine +
            ` 빚은 그렇게 사라졌지만, 무언가 함께 닳아 없어진 기분이다.` +
            streakLine
        : `돈을 갚지 못해 대부업체에 끌려가 ${CAPTURE_DAYS}일을 붙잡혀 있었다. 정신력이 크게 상했다.` +
            perfLine +
            ` 그래도 빚은 몸으로 때워 사라졌다.` +
            streakLine,
    );
  }

  function showResult(message: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "…"),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.6;margin:0 0 18px" }, message),
        el(
          "div",
          { style: "text-align:right" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  showDue();
  return container;
}
