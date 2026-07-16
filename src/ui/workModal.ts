import type { GameContext } from "./context";
import { doWork, WORK_ACTION_COST } from "@/systems/employment";
import { TIERS } from "@/data/jobs";
import { EVENING_SLOT } from "@/core/state";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 강제 근무 팝업(평일 오전, 야근 시 저녁).
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
    const overtime = s.slot === EVENING_SLOT;

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          icon("article", { size: 18 }),
          overtime ? "야근 중" : "근무 시간",
        ),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 6px" },
          `「${emp.company}」 (${tier.label})${overtime ? " 야근이다. 오늘 정시 퇴근은 글렀다." : " 근무 시간이다."} 어떻게 보낼까?`,
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin:0 0 14px" },
          `성과 ${Math.round(emp.performance)}/100 · 레벨 ${emp.perfLevel}`,
        ),
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
