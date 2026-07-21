import type { GameContext } from "./context";
import { doWork, WORK_ACTION_COST } from "@/systems/employment";
import { TIERS, DEV_JOB_COMPANY } from "@/data/jobs";
import { NIGL_COMPANY, NIGL_SHIFT_GOAL } from "@/data/niglnigl";
import { MORNING_SLOT } from "@/core/state";
import { el } from "@/utils/dom";
import { icon } from "./icons";
import { renderCommitGrass } from "./components";

/**
 * 강제 근무 팝업(평일 낮). 야근도 낮 슬롯에서 판정한다(2슬롯 개편).
 *  성실히 근무 / 트위터하기 중 선택 → 결과.
 * 시간대에 묶인 강제 선택이라 닫기 버튼은 없다.
 */
export function renderWorkModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function showChoices(): void {
    const s = ctx.store.getState();
    const emp = s.employment;
    if (!emp) {
      queueMicrotask(() => ctx.closeModal());
      return container.replaceChildren();
    }
    const tier = TIERS[emp.tier];
    const isNigl = emp.company === NIGL_COMPANY;
    const overtime = !isNigl && s.slot === MORNING_SLOT;

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          icon("article", { size: 18 }),
          isNigl ? "니글니글 출근" : overtime ? "야근 중" : "근무 시간",
        ),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 6px" },
          isNigl
            ? `「${emp.company}」 자유 출근. 오늘 나온 김에 어떻게 보낼까?`
            : `「${emp.company}」 (${tier.label})${overtime ? " 야근이다. 오늘 정시 퇴근은 글렀다." : " 근무 시간이다."} 어떻게 보낼까?`,
        ),
        emp.company === DEV_JOB_COMPANY
          ? el(
              "div",
              { style: "margin:0 0 14px" },
              el(
                "p",
                { class: "compose-hint", style: "margin:0 0 6px" },
                `커밋 성과 Lv.${emp.perfLevel}`,
              ),
              renderCommitGrass(emp.performance, emp.perfLevel),
            )
          : el(
              "p",
              { class: "compose-hint", style: "margin:0 0 14px" },
              `성과 ${Math.round(emp.performance)}/100 · 레벨 ${emp.perfLevel}`,
            ),
        // 니글니글: 자유 출근이라 이번 달 출근 진척을 보여준다(20일 미달이면 월급 반감).
        emp.company === NIGL_COMPANY
          ? el(
              "p",
              { class: "compose-hint", style: "margin:-8px 0 14px" },
              `이번 달 출근 ${s.niglShifts}/${NIGL_SHIFT_GOAL}일 · 자유출근(주말·심야 포함, 미달 시 월급 반감)`,
            )
          : null,
        el(
          "button",
          {
            class: "event-choice",
            onclick: () => resolve("work"),
          },
          `성실히 근무한다 (행동력 -${WORK_ACTION_COST}, 성과↑·정신력↓)`,
        ),
        el(
          "button",
          {
            class: "event-choice",
            onclick: () => resolve("slack"),
          },
          "몰래 트위터하며 논다 (정신력↑, 걸리면 성과 폭락)",
        ),
        // 니글니글은 자발적 출근이라 취소할 수 있다(고정 근무는 강제 — 닫기 없음).
        isNigl
          ? el(
              "button",
              { class: "event-choice", style: "opacity:.8", onclick: () => ctx.closeModal() },
              "다음에 하기",
            )
          : null,
      ),
    );
  }

  function resolve(mode: "work" | "slack"): void {
    let message = "";
    ctx.update((s) => {
      message = doWork(s, mode).message;
    });
    showResult(message);
  }

  function showResult(message: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "근무 종료"),
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

  showChoices();
  return container;
}
