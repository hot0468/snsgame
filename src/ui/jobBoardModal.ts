import type { GameContext } from "./context";
import type { JobPosting } from "@/data/jobs";
import { submitJobApplication } from "@/systems/employment";
import { dateLabel } from "@/systems/time";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 채용공고 게시판 모달. 5개 공고 중 하나에 지원한다(하루 1회).
 * 실제 구인사이트 리스트처럼 한 공고를 가로 행으로 표시한다.
 * (회사/공고 · 근무일시 · 급여 · 등록일 · 지원)
 * 지원 결과는 즉시 나오지 않고, 지원 익일에 피메일로 통보된다.
 */
export function renderJobBoardModal(ctx: GameContext, postings: JobPosting[]): HTMLElement {
  const container = el("div", { class: "modal modal--life" });

  /** 급여형태 → 색 포인트 클래스 (월급=파랑, 회사내규=주황 등) */
  function salaryTypeClass(type: string): string {
    if (type.includes("연봉")) return "annual";
    if (type.includes("월급")) return "month";
    if (type.includes("시급") || type.includes("일급")) return "hour";
    if (type.includes("내규") || type.includes("협의") || type.includes("면접")) return "nego";
    return "etc";
  }

  function renderRow(job: JobPosting): HTMLElement {
    return el(
      "div",
      { class: "job-item" },
      el(
        "div",
        { class: "job-item__main" },
        el("div", { class: "job-item__company" }, job.company),
        el(
          "div",
          { class: "job-item__role" },
          job.role,
          el("span", { class: "job-item__expand" }, "+"),
        ),
      ),
      el(
        "div",
        { class: "job-item__work" },
        el("div", { class: "job-item__work-days" }, job.workDays),
        el("div", { class: "job-item__work-hours" }, job.workHours),
      ),
      el(
        "div",
        { class: "job-item__pay" },
        el(
          "span",
          { class: `job-pay__type job-pay__type--${salaryTypeClass(job.salaryType)}` },
          job.salaryType,
        ),
        el("span", { class: "job-pay__amount" }, job.salaryText),
      ),
      el("div", { class: "job-item__date" }, dateLabel(job.postedDay)),
      el(
        "button",
        {
          class: "btn job-item__apply",
          onclick: () => {
            ctx.update((s) => submitJobApplication(s, job));
            showSubmitted(job);
          },
        },
        "지원",
      ),
    );
  }

  function showList(): void {
    const items = postings.map(renderRow);

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("article", { size: 18 }), "채용공고"),
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          "지원할 곳을 골라 지원하세요. 스탯(어휘력·친화력·미용)이 높을수록 합격에 유리합니다. (하루 1회)",
        ),
        el("div", { class: "job-list job-list--board" }, ...items),
      ),
    );
  }

  function showSubmitted(job: JobPosting): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("article", { size: 18 }), "지원 완료"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "life-result__flavor", style: "font-size:15px;line-height:1.6" },
          `「${job.company}」에 지원서를 제출했습니다.\n결과는 내일 '피메일'로 통보돼요. 합격하면 메일에서 출근 여부를 결정할 수 있어요.`,
        ),
        el(
          "div",
          { style: "text-align:right;margin-top:16px" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  showList();
  return container;
}
