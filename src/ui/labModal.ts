import type { GameContext } from "./context";
import type { LabShiftResult } from "@/systems/lab";
import { LAB_TOTAL_SHIFTS, doLabShift } from "@/systems/lab";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 강제 연구실 출근 팝업(평일 저녁, 터커의 부탁을 수락한 뒤).
 *
 * 근무 팝업(workModal)의 구조를 따르되 **선택지가 없다** — 출근하면 그냥 일한다.
 * 시간대에 묶인 강제 화면이라 닫기 버튼도 없다(결과를 본 뒤에만 닫힌다).
 *
 * ⚠️ 출근 처리·수치·체포 시점은 전부 systems/lab이 계산한다. 여기서는 doLabShift가 준
 *    message를 그대로 보여줄 뿐이다(규칙 재구현 금지).
 * ⚠️ message 문구는 data/lab.ts에서 바뀔 수 있다 — 특정 문장 길이·줄 수에 기대지 않는다.
 *    줄바꿈은 pre-line으로 데이터가 준 그대로 흘린다.
 */
export function renderLabModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function showIntro(): void {
    const lab = ctx.store.getState().lab;
    // 이번에 나갈 출근이 몇 회째인지(shifts는 '지금까지' 나간 횟수).
    const nth = Math.min(lab.shifts + 1, LAB_TOTAL_SHIFTS);

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          icon("article", { size: 18 }),
          "연구실 출근",
        ),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 6px" },
          "저녁이다. 터커 박사의 연구실로 갈 시간이다.",
        ),
        el("p", { class: "compose-hint", style: "margin:0 0 14px" }, `출근 ${nth}/${LAB_TOTAL_SHIFTS}회째`),
        el("button", { class: "event-choice", onclick: () => resolve() }, "연구실로 향한다"),
      ),
    );
  }

  function resolve(): void {
    let result: LabShiftResult | null = null;
    ctx.update((s) => {
      result = doLabShift(s);
    });
    // ctx.update 콜백 안에서 대입하므로 TS 흐름 분석이 null로 좁힌다 — 단언으로 되돌린다
    // (eyeDealReplies 선례와 같은 처리).
    const r = result as LabShiftResult | null;
    if (!r) return;
    showResult(r);
  }

  function showResult(r: LabShiftResult): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, r.arrested ? "연구실 폐쇄" : "출근 종료"),
      el(
        "div",
        { class: "modal__body" },
        // 체포된 회차에는 message 뒤에 체포 소식이 이어 붙어 온다(systems/lab).
        // 통째로 흘리되, 체포일 때는 아래 배너로 한 번 더 못 박아 조용히 지나가지 않게 한다.
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 12px;white-space:pre-line" },
          r.message,
        ),
        r.arrested
          ? el(
              "div",
              { class: "lab-arrest" },
              el("span", { class: "lab-arrest__tag" }, "속보"),
              el(
                "span",
                { class: "lab-arrest__text" },
                "터커 박사가 체포되었다. 연구실은 폐쇄되었고, 저녁 출근은 없던 일이 되었다.",
              ),
            )
          : null,
        el(
          "p",
          { class: "compose-hint", style: "margin:0 0 18px" },
          `출근 ${r.shifts}/${LAB_TOTAL_SHIFTS}회 · 지식 +${r.knowledgeGain}`,
        ),
        el(
          "div",
          { style: "text-align:right" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  showIntro();
  return container;
}
