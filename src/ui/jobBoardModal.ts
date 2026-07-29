import type { GameContext } from "./context";
import type { JobPosting } from "@/data/jobs";
import { TIERS, TRACK_LABELS } from "@/data/jobs";
import { DEFAULT_JOB_TRACK, submitJobApplication } from "@/systems/employment";
import { dateLabel } from "@/systems/time";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 채용공고 게시판 모달. 5개 공고 중 하나에 지원한다(하루 1회).
 * 실제 구인사이트 리스트처럼 한 공고를 가로 행으로 표시한다.
 * 상단 '직플래닛' 버튼은 모달을 닫고 브라우저 영역의 직플래닛 사이트(기업정보)를 연다.
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
    // 직군 태그 — 어떤 트랙 공고인지 한눈에 보여야 트랙별 역량(운동/뷰티 신설)이 의미를 갖는다.
    // track 미지정 공고(구 데이터·구세이브)는 기존 동작대로 "office" 취급.
    const track = job.track ?? DEFAULT_JOB_TRACK;
    return el(
      "div",
      { class: "job-item" },
      el(
        "div",
        { class: "job-item__main" },
        el(
          "div",
          { class: "job-item__company" },
          // 등급 배지 — 어느 문턱의 공고인지 목록에서 바로 갈라 보라고 붙인다.
          el("span", { class: `job-tier job-tier--${job.tier}` }, TIERS[job.tier].label),
          job.company,
        ),
        el(
          "div",
          { class: "job-item__role" },
          el("span", { class: `job-track job-track--${track}` }, TRACK_LABELS[track]),
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
            showSubmitted();
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
        el(
          "span",
          { style: "margin-left:auto;display:flex;gap:8px;align-items:center" },
          el(
            "button",
            {
              class: "btn jobplanet-open",
              // 직플래닛은 브라우저 영역 오버레이 사이트 — 모달을 닫고 브라우저에서 연다.
              onclick: () => {
                ctx.closeModal();
                ctx.ui.jobplanetSiteOpen = true;
                ctx.ui.jobplanetQuery = ""; // 열 때마다 검색 초기화
                ctx.refresh();
              },
            },
            "🪐 직플래닛",
          ),
          el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
        ),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          "갈 만한 곳이 없어 보인다...자격증이라도 따야 하나? 합격 가능성이 궁금하면 직플래닛에서 기업정보를 열람해보자.",
        ),
        el("div", { class: "job-list job-list--board" }, ...items),
      ),
    );
  }

  function showSubmitted(): void {
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
          `성공적으로 지원되었다!\n이제 합격 메일이 오기를 기다리자.`,
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
