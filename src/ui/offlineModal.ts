import type { GameContext } from "./context";
import type { GameState, SkillStatId } from "@/core/types";
import {
  OFFLINE_ACTIVITIES,
  type OfflineActivity,
  type OfflineOutcome,
  adoptPet,
  doOfflineActivity,
  partTimePay,
  partTimeCountOf,
  partTimeNextRaiseIn,
  petLabel,
  canSpendDay,
  canAffordVacation,
  spendDayResting,
  creatureById,
  collectCreature,
} from "@/systems/offline";
import { postTweet } from "@/systems/tweetSystem";
import { outdoorShoot, blackVanOrgy, wallHoleOrgy } from "@/systems/events";
import { getAdultOfflineEncounter } from "@/data/adultOffline";
import { resolveAdultOfflineEncounter } from "@/systems/adultOffline";
import { canNiglWork, quitCurrentJob } from "@/systems/employment";
import { confirmPurchase } from "./confirmModal";
import { NIGL_COMPANY, NIGL_SHIFT_GOAL } from "@/data/niglnigl";
import { renderWorkModal } from "./workModal";
import { hasCertification } from "@/systems/certification";
import { isWeekday } from "@/systems/time";
import { isAuthorPrepMonth } from "@/systems/author";
import { makeJobPostings, DEV_JOB_IT_REQ } from "@/data/jobs";
import { SKILL_STATS } from "@/data/stats";
import { hasAction, mentalEfficiency, projectSkillGain } from "@/systems/stats";
import { activityFailChance, activityGreatChance, declaredSkillAmount } from "@/systems/offline";
import { LATE_SLOT } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { pick } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";
import { icon, ACTIVITY_ICON } from "./icons";
import { renderJobBoardModal } from "./jobBoardModal";
import { renderSystemNotice } from "./systemNotice";
import { renderKillerWorkModal } from "./killerWorkModal";

/** +/- 부호를 붙인 수치 문자열 */
function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/**
 * 활동의 스탯 변화 요약 한 줄(선택 화면 미리보기 전용 — 확정 전 예고치).
 * 아르바이트면 현재 일당도 함께 표시.
 *
 * ⚠️ **스킬 줄은 선언값이 아니라 `projectSkillGain` 투영값이다** — 실제 지급은 정신력 배율·
 *    퍼크 배율·상단 감쇠·999 상한을 타므로 선언값 "+10"이 실제 "+1"이 되는 괴리가 있었다.
 *    여기서 배율을 재계산하지 마라(공식이 바뀌면 조용히 어긋난다). 계산은 systems가 한다.
 *    등급(실패/대성공) 배율은 굴림 전이라 곱하지 않는다 — 확률은 conditionBanner가 따로 알린다.
 *
 * 리소스(행동력·정신력·도덕성·돈)는 배율을 타지 않으므로 선언값 그대로가 맞다.
 */
function activityDeltaParts(
  state: GameState,
  act: OfflineActivity,
): { text: string; down: boolean }[] {
  const parts: { text: string; down: boolean }[] = [];
  const add = (text: string, n: number) => parts.push({ text, down: n < 0 });
  if (act.action) add(`행동력 ${signed(act.action)}`, act.action);
  if (act.mental) add(`정신력 ${signed(act.mental)}`, act.mental);
  if (act.morality) add(`도덕성 ${signed(act.morality)}`, act.morality);
  if (act.money) add(`${signed(act.money)}원`, act.money);
  for (const [skill, amount] of Object.entries(act.skillGains ?? {})) {
    const key = skill as SkillStatId;
    // 활동 고유 보정(에스테틱 등)을 실지급과 동일하게 먼저 태운 뒤 투영한다.
    const declared = declaredSkillAmount(state, act, key, amount ?? 0);
    const delta = projectSkillGain(state, key, declared);
    // ⚠️ 델타 0은 표시하지 않는다. 이미 0인 스탯에 반대급부(-3)가 걸리면 clamp돼 0이 되는데,
    //    "미용 0"으로 뜨면 고장으로 보인다(실제로 그렇게 렌더됐다).
    //    결과 팝업(outcome.skillDeltas)도 0인 항목을 안 담으므로 두 화면의 규칙이 같아진다.
    if (delta === 0) continue;
    add(`${SKILL_STATS[key].label} ${signed(delta)}`, delta);
  }
  // 일당은 수입이라 항상 이득(음수가 될 수 없다).
  // ⚠️ 카운터는 **알바 종류별**이라 일당도 알바마다 다르다 — 하나로 뭉뚱그리면 개별 카운터가 무의미해진다.
  if (act.partTime) {
    add(`일당 ${formatNumber(partTimePay(partTimeCountOf(state, act.id)))}원`, 1);
  }
  return parts;
}

/**
 * 아르바이트 숙련도 힌트("다음 인상까지 N회" / 상한 도달 시 "최고 시급").
 * ⚠️ `partTimeNextRaiseIn`이 `null`을 반환하면 상한 도달이다 — "0회"로 잘못 표시하면
 *    버그로 보인다(계약서 경고). 아르바이트가 아니면 null(표시 안 함).
 */
function partTimeHint(state: GameState, act: OfflineActivity): string | null {
  if (!act.partTime) return null;
  const count = partTimeCountOf(state, act.id);
  const nextIn = partTimeNextRaiseIn(count);
  return nextIn == null ? "최고 시급 도달" : `다음 인상까지 ${nextIn}회`;
}

/**
 * 델타 파트를 ` · ` 구분자로 잇되 **감소분만 하락색**으로 렌더한다.
 *
 * ⚠️ 한 문자열로 합쳐 넘기면 안 된다 — `.life-item__delta`가 전체를 `var(--good)`(초록)으로
 *    칠해서 `지식 -2`가 `정신력 +12`와 같은 색으로 보인다. 실제로 그렇게 렌더되고 있었고,
 *    반대급부 감소를 플레이어가 '이득'으로 오인하는 원인이었다(계약서: "모르고 깎이면 버그로 오인된다").
 */
function renderDeltaParts(parts: { text: string; down: boolean }[]): (Node | string)[] {
  const out: (Node | string)[] = [];
  parts.forEach((p, i) => {
    if (i > 0) out.push(" · ");
    out.push(p.down ? el("span", { class: "delta--down" }, p.text) : p.text);
  });
  return out;
}

/**
 * 결과 화면의 델타 파트(리소스 + 실제 반영 스킬 델타 + 랜덤 스탯).
 * 미리보기와 같은 `renderDeltaParts`로 그려 **감소분만 하락색**이 되게 한다.
 *
 * 스킬 델타는 여기서 재계산하지 않는다 — systems가 등급 배율·감쇠·정신력 배율을 이미 반영해 넘긴다.
 */
function resultDeltaParts(
  act: OfflineActivity,
  outcome: OfflineOutcome,
): { text: string; down: boolean }[] {
  const parts: { text: string; down: boolean }[] = [];
  const add = (text: string, n: number) => parts.push({ text, down: n < 0 });
  if (act.action) add(`행동력 ${signed(act.action)}`, act.action);
  if (act.mental) add(`정신력 ${signed(act.mental)}`, act.mental);
  if (act.morality) add(`도덕성 ${signed(act.morality)}`, act.morality);
  if (act.money) add(`${signed(act.money)}원`, act.money);
  // 실제 반영된 스킬 델타(음수=반대급부). 여기서 재계산하지 않는다 — systems가 넘긴 값 그대로다.
  for (const d of outcome.skillDeltas) add(`${d.label} ${signed(d.delta)}`, d.delta);
  if (outcome.randomSkillLabel) {
    add(outcome.randomSkillLabel, outcome.randomSkillLabel.includes("-") ? -1 : 1);
  }
  return parts;
}

/** ⑤ 컨디션 판정 등급 한글 라벨(결과 화면 배지용). normal이면 null. */
function gradeLabel(grade: OfflineOutcome["grade"]): string | null {
  if (grade === "fail") return "판정: 실패";
  if (grade === "great") return "판정: 대성공";
  return null;
}

/**
 * '현생 살기' 팝업.
 *  1) 활동 선택 → 2) 결과 화면(분위기 문구 + 얻은 것)
 */
export function renderOfflineModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal modal--life" });
  // 휴식 / 자기개발 2탭. 모달은 함수 identity로 캐시돼 이 클로저 상태가 재렌더에도 보존된다.
  let lifeTab: OfflineActivity["group"] = "rest";

  function closeBtn(): HTMLElement {
    return el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕");
  }

  function activityItem(act: OfflineActivity): HTMLElement {
    // 미리보기 한 벌은 같은 스냅샷으로 계산한다(스킬 투영이 현재 정신력·스킬에 의존).
    const state = ctx.store.getState();
    // 휴가는 심야엔 떠날 수 없다(낮에만 가능).
    const nightVacation = !!act.vacation && state.slot === LATE_SLOT;
    // 휴가는 10만원이 있어야 갈 수 있다 — 소지금 부족이면 비활성.
    const cantAfford = !!act.vacation && !canAffordVacation(state);
    // 행동력을 쓰는 활동(act.action<0)은 잔여 행동력이 비용보다 적으면 막는다(마이너스 방지).
    const notEnoughAction = act.action < 0 && !hasAction(state, -act.action);
    const blocked = nightVacation || cantAfford || notEnoughAction;
    return el(
      "button",
      {
        class: "life-item" + (blocked ? " life-item--off" : ""),
        disabled: blocked,
        onclick: () => {
          if (blocked) return;
          let outcome: OfflineOutcome | undefined;
          ctx.update((s) => {
            outcome = doOfflineActivity(s, act);
          });
          if (outcome) showResult(act, outcome);
        },
      },
      el("span", { class: "life-item__icon" }, icon(ACTIVITY_ICON[act.id] ?? "star", { size: 22 })),
      el(
        "span",
        { class: "life-item__body" },
        el("span", { class: "life-item__label" }, act.label),
        el("span", { class: "life-item__desc" }, act.description),
        el(
          "span",
          { class: "life-item__delta" },
          ...(nightVacation
            ? ["심야에는 휴가를 떠날 수 없어요"]
            : cantAfford
              ? ["소지금이 부족해요 (10만원 필요)"]
              : notEnoughAction
                ? [`행동력이 부족해요 (${-act.action} 필요)`]
                : renderDeltaParts(activityDeltaParts(state, act))),
        ),
        // 아르바이트 숙련도 힌트 — 개별 카운터라 알바마다 다른 값이 뜬다.
        act.partTime && !blocked
          ? el("span", { class: "life-item__hint" }, partTimeHint(state, act) ?? "")
          : null,
      ),
    );
  }

  /**
   * ③⑤ 컨디션(정신력) 배너 — 육성 효율 배율과 실패/대성공 확률을 그대로 보여준다.
   * 이게 없으면 플레이어는 실패/대성공을 "가끔 손해 보는 랜덤"으로만 인식한다(계약서 필수 항목).
   * 계산은 systems/stats.ts·systems/offline.ts의 순수 셀렉터를 그대로 쓴다 — UI는 값을 안 만든다.
   */
  function conditionBanner(): HTMLElement {
    const state = ctx.store.getState();
    const eff = mentalEfficiency(state);
    const fail = activityFailChance(state);
    const great = activityGreatChance(state);
    // 효율 100% 미만은 손해가 보이게 하락색, 이상은 이득이 보이게 강조색.
    const effClass = eff < 1 ? "cond-banner__eff--down" : eff > 1 ? "cond-banner__eff--up" : "";
    return el(
      "div",
      { class: "cond-banner" },
      el(
        "span",
        { class: "cond-banner__item" },
        "육성 효율 ",
        el("b", { class: effClass }, `${Math.round(eff * 100)}%`),
      ),
      el(
        "span",
        { class: "cond-banner__item" },
        "실패 확률 ",
        el("b", { class: fail > 0 ? "cond-banner__eff--down" : "" }, `${Math.round(fail * 100)}%`),
      ),
      el(
        "span",
        { class: "cond-banner__item" },
        "대성공 확률 ",
        el("b", { class: great > 0 ? "cond-banner__eff--up" : "" }, `${Math.round(great * 100)}%`),
      ),
    );
  }

  function showChoices(): void {
    const state = ctx.store.getState();
    // 작가 원고 작업은 계약 중일 때 노출. 단 준비 기간(계약한 달) 내내 숨긴다 —
    // 그 달은 작업량이 요구되지 않고, 미리 채워도 익월 1일에 게이지가 리셋돼 헛일이다(author.settleAuthorMonthly).
    const underContract = state.authorContract != null;
    const showAuthorWork = underContract && !isAuthorPrepMonth(state);

    const adultMode = state.adultMode;
    const items = OFFLINE_ACTIVITIES.filter(
      (act) =>
        act.group === lifeTab &&
        (!act.authorWork || showAuthorWork) &&
        (!act.adultOnly || adultMode), // 해피타임 등 성인 활동은 성인물 보기 ON일 때만
    ).map((act) => activityItem(act));

    const lifeTabBtn = (label: string, group: OfflineActivity["group"]) =>
      el(
        "div",
        {
          class: "feed__tab" + (lifeTab === group ? " feed__tab--active" : ""),
          onclick: () => {
            lifeTab = group;
            showChoices();
          },
        },
        el("span", { class: "feed__tab-label" }, label),
      );

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), "현생 살기"),
        closeBtn(),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0" },
          "오프라인 활동으로 스탯을 관리하고 새 트윗 소재를 얻으세요. (시간 1칸 소요)",
        ),
        conditionBanner(),
        el(
          "div",
          { class: "feed__tabs life-tabs" },
          lifeTabBtn("휴식", "rest"),
          lifeTabBtn("공부", "study"),
          lifeTabBtn("자기개발", "growth"),
          lifeTabBtn("일", "work"),
        ),
        el("div", { class: "offline-grid" }, ...items),
        // 일 탭: 킬러면 작업하기(청부), 취업 섹션도 이 탭으로 모은다.
        lifeTab === "work" ? killerWorkSection() : null,
        // 공부 탭: 미술·코딩 등은 EBS로 옮겼다 — 힌트로 안내(네이놈에서 검색해 접속).
        lifeTab === "study"
          ? el(
              "p",
              { class: "compose-hint", style: "margin:10px 0 0;line-height:1.6" },
              "📚 EBS(이비에듀)에 좋은 강의가 많다던데 한번 가볼까? 미술·코딩 같은 건 거기서 배울 수 있대. (네이놈에 '이비에듀' 검색)",
            )
          : null,
        // 취업 / 하루 그냥 보내기 — 탭 밖 하단, 가로 한 줄(세로 스크롤 방지)
        el("div", { class: "life-foot-row" }, jobSection(), restDaySection()),
      ),
    );
  }

  /**
   * '하루 그냥 보내기' — 오늘 남은 시간 블록을 전부 휴식으로 넘긴다.
   * spendDayResting이 day를 다음날로 넘기므로(취침·새벽 팝업 발생) 모달은 닫는다.
   * 재직/무직 무관 노출. 남은 블록이 없거나 게임오버면 비활성.
   */
  function restDaySection(): HTMLElement {
    const can = canSpendDay(ctx.store.getState());
    return el(
      "div",
      { class: "job-section" },
      el(
        "button",
        {
          class: "life-btn" + (can ? "" : " job-apply-btn--off"),
          disabled: !can,
          onclick: () => {
            if (!can) return;
            let gain = { action: 0, mental: 0 };
            ctx.update((st) => {
              gain = spendDayResting(st);
            });
            ctx.toast(`남은 하루를 쉬었다 · 행동력 +${gain.action} 정신력 +${gain.mental}`);
            ctx.closeModal();
          },
        },
        icon("bed", { size: 18 }),
        "하루 그냥 보내기",
      ),
    );
  }

  /** 킬러 청부 섹션(일 탭): active면 임무 상태 + 작업하기, 아니면 안내(momo.com 유도). */
  function killerWorkSection(): HTMLElement {
    const s = ctx.store.getState();
    const kj = s.killerJob;
    if (!kj?.active) {
      return el(
        "div",
        { class: "killer-section killer-section--none" },
        el("p", { class: "compose-hint", style: "margin:12px 0 0" },
          "부업이 필요하다면... 남모르는 일자리도 있다더라. (성인모드에서 momo.com)"),
      );
    }
    const asg = kj.assignment;
    return el(
      "div",
      { class: "killer-section" },
      el("div", { class: "killer-section__title" }, `🗡️ 청부 (실패 ${kj.fails}/3 · 완료 ${kj.completed})`),
      asg
        ? el("div", { class: "killer-section__mission" }, "이번 달 타겟이 배정됐다. 쪽지의 힌트를 보고 위치를 알아내라.")
        : el("div", { class: "killer-section__mission" }, "배정된 임무 없음. 매달 1일에 momo가 연락한다."),
      el(
        "button",
        {
          class: "btn",
          style: "width:100%;margin-top:8px",
          disabled: asg ? undefined : "true",
          onclick: () => {
            if (kj.assignment) ctx.openModal(renderKillerWorkModal);
          },
        },
        asg ? "작업하기" : "임무 대기 중",
      ),
    );
  }

  /** 취업 섹션: 재직 중이면 상태 표시, 무직이면 취업(지원) 버튼(평일·하루 1회) */
  function jobSection(): HTMLElement {
    const s = ctx.store.getState();
    const emp = s.employment;

    // 채용공고 열기(취업·이직 공용) — 하루 1회 소진 후 채용공고 모달을 연다.
    const openJobBoard = (): void => {
      const st = ctx.store.getState();
      // 변호사 자격증이 있으면 5칸 중 한 칸이 나루호도 법률사무소로 바뀐다.
      // data는 systems를 import할 수 없으므로 조회는 여기서 해서 넘긴다.
      const postings = makeJobPostings(
        5,
        st.day,
        hasCertification(st, "lawyer"),
        st.skills.it >= DEV_JOB_IT_REQ,
      );
      ctx.update((st) => {
        st.lastJobBoardDay = st.day; // 하루 1회 소진
      });
      ctx.openModal((c) => renderJobBoardModal(c, postings));
    };

    if (emp) {
      const isNigl = emp.company === NIGL_COMPANY;

      // 이직 버튼 상태: 지원/오퍼 대기·평일·하루 1회 게이트(무직 취업과 동일 규칙).
      const jobPending = !!s.pendingJobApp;
      const offerWaiting = s.emails.some((e) => e.jobOffer);
      const appliedToday = s.lastJobBoardDay === s.day;
      const weekday = isWeekday(s.day);
      const canChange = !jobPending && !offerWaiting && weekday && !appliedToday;
      const changeLabel = jobPending
        ? "이직 지원 결과 대기 중"
        : offerWaiting
          ? "합격 메일을 확인하세요"
          : !weekday
            ? "이직 (평일에만 지원)"
            : appliedToday
              ? "이직 (오늘은 이미 지원함)"
              : "이직 — 채용공고 보기";

      const hasWorkBtn = isNigl && canNiglWork(s);
      // 재직 상태 정보(재직 중·회사·성과)는 스테이터스 도크에서 보여주므로 여기선 액션 버튼만 둔다.
      return el(
        "div",
        { class: "job-section" },
        // 니글니글은 자유 출근 — 원할 때 자발적으로 나간다(주말·심야 포함, 강제 팝업 없음).
        hasWorkBtn
          ? el(
              "button",
              {
                class: "btn",
                style: "width:100%",
                onclick: () => ctx.openModal((c) => renderWorkModal(c)),
              },
              `출근하기 (자유출근 · 이번 달 ${s.niglShifts}/${NIGL_SHIFT_GOAL}일)`,
            )
          : null,
        // 재직 중 액션: 이직(다른 회사 지원) / 퇴사.
        el(
          "div",
          { class: "job-actions", style: `display:flex;gap:8px${hasWorkBtn ? ";margin-top:8px" : ""}` },
          el(
            "button",
            {
              class: "btn btn--ghost",
              style: "flex:1",
              disabled: !canChange,
              onclick: () => canChange && openJobBoard(),
            },
            changeLabel,
          ),
          el(
            "button",
            {
              class: "btn btn--ghost",
              style: "flex:none",
              onclick: () =>
                confirmPurchase(ctx, {
                  title: "퇴사",
                  message: `'${emp.company}'을(를) 정말 퇴사할까요? 월급·복지가 끊기고 무직이 됩니다.`,
                  confirmLabel: "퇴사한다",
                  cancelLabel: "취소",
                  onConfirm: () => {
                    ctx.update((st) => quitCurrentJob(st));
                    ctx.toast(`${emp.company}을(를) 퇴사했어요`);
                    showChoices(); // 이 모달은 refresh로 재렌더 안 됨 — 본문을 직접 다시 그린다
                    ctx.refresh();
                  },
                }),
            },
            "퇴사",
          ),
        ),
      );
    }

    // 결과 대기 중인 지원, 도착한 합격 오퍼 상태를 우선 안내
    const pendingApp = s.pendingJobApp;
    const pendingOffer = s.emails.some((e) => e.jobOffer);
    if (pendingOffer) {
      return el(
        "div",
        { class: "job-section" },
        el(
          "div",
          { class: "job-status" },
          el("span", { class: "job-status__icon" }, icon("mail", { size: 18 })),
          el(
            "div",
            {},
            el("div", { class: "job-status__title" }, "합격 메일이 도착했어요!"),
            el("div", { class: "job-status__meta" }, "피메일에서 출근 여부를 결정하세요."),
          ),
        ),
      );
    }
    if (pendingApp) {
      return el(
        "div",
        { class: "job-section" },
        el(
          "div",
          { class: "job-status" },
          el("span", { class: "job-status__icon" }, icon("clock", { size: 18 })),
          el(
            "div",
            {},
            el("div", { class: "job-status__title" }, `${pendingApp.company} 지원 결과 대기 중`),
            el("div", { class: "job-status__meta" }, "결과는 내일 피메일로 통보돼요."),
          ),
        ),
      );
    }

    const weekday = isWeekday(s.day);
    const appliedToday = s.lastJobBoardDay === s.day;
    const canApply = weekday && !appliedToday;
    const label = !weekday
      ? "취업 (평일에만 지원 가능)"
      : appliedToday
        ? "취업 (오늘은 이미 지원함)"
        : "취업 — 채용공고 보기";

    return el(
      "div",
      { class: "job-section" },
      el(
        "button",
        {
          class: "life-btn job-apply-btn" + (canApply ? "" : " job-apply-btn--off"),
          disabled: !canApply,
          onclick: () => canApply && openJobBoard(),
        },
        icon("article", { size: 18 }),
        label,
      ),
    );
  }

  function showResult(act: OfflineActivity, outcome: OfflineOutcome): void {
    // 성인 이벤트(검은 봉고·야외노출·성인 조우)는 스테이터스 안내창과 분리한다(사용자 요청):
    // 먼저 활동 결과(스탯) 안내창을 띄우고, 그 창을 닫으면 그때 성인 이벤트 모달을 연다.
    if (
      outcome.blackVanEncounter ||
      outcome.wallHoleEncounter ||
      outcome.nudeExposure ||
      outcome.adultEncounter
    ) {
      showStatusNotice(act, outcome, () => showAdultEncounter(act, outcome));
      return;
    }
    // 펫·크리처 조우(성인 아님)는 기존처럼 결과+선택을 한 모달에 함께 보여준다.
    if (outcome.petEncounter || outcome.creatureEncounter) {
      showPetCreatureResult(act, outcome);
      return;
    }
    // 그 외 일반 결과는 공용 시스템 알림 카드.
    showNormalResult(act, outcome);
  }

  /**
   * 활동 결과 '스테이터스 안내창'(스탯 델타 카드)만 먼저 띄운다. 확인('계속')하면 onNext로 다음 단계로.
   * 성인 이벤트를 스탯 안내와 섞지 않으려는 분리 흐름 전용 — showNormalResult는 트윗 버튼이 붙어 재사용 못 한다.
   */
  function showStatusNotice(
    act: OfflineActivity,
    outcome: OfflineOutcome,
    onNext: () => void,
  ): void {
    const extraLines: string[] = [];
    if (outcome.randomSkillLabel) extraLines.push(outcome.randomSkillLabel);
    if (outcome.unlockedAttribute) {
      extraLines.push(
        `새 트윗 소재를 얻었다! (${ATTRIBUTES[outcome.unlockedAttribute].label.replace(/계$/, "")})`,
      );
    }
    ctx.openModal((c) =>
      renderSystemNotice(c, {
        message: outcome.message,
        tone: "good", // 활동 자체는 생산적 — showNormalResult와 같은 이유로 good 고정.
        deltas: {
          action: act.action,
          mental: act.mental,
          morality: act.morality,
          money: outcome.earnedMoney ?? act.money,
        },
        // 실제 반영된 최종 델타(등급 배율·감쇠·정신력 배율 반영, 음수=반대급부 포함) — act.skillGains(선언값) 아님.
        skillDeltas: outcome.skillDeltas,
        grade: outcome.grade,
        extraLines,
        confirmLabel: "계속",
        onConfirm: onNext,
      }),
    );
  }

  /**
   * 성인 이벤트 모달(검은 봉고·야외노출·성인 조우) — 스테이터스 안내창을 닫은 뒤 열린다.
   * 스탯 델타·활동 flavor는 앞선 안내창이 이미 보여줬으므로, 여기선 이벤트 서사와 선택만 다룬다.
   */
  function showAdultEncounter(act: OfflineActivity, outcome: OfflineOutcome): void {
    const c2 = el("div", { class: "modal modal--adult" });

    /** 선택 결과 문구 화면으로 전환(세 이벤트 공통). 확인 시 닫고 afterAction. */
    function showEncResult(title: string, msg: string): void {
      c2.replaceChildren(
        el(
          "div",
          { class: "modal__head" },
          el("span", { class: "modal__head-title" }, icon("shield", { size: 18 }), title),
        ),
        el(
          "div",
          { class: "modal__body" },
          el("p", { class: "life-result__flavor" }, msg),
          el(
            "button",
            {
              class: "btn",
              style: "margin-top:14px",
              onclick: () => {
                ctx.closeModal();
                ctx.afterAction("offline");
              },
            },
            "확인",
          ),
        ),
      );
    }

    const bodyChildren: (HTMLElement | null)[] = [];
    if (outcome.blackVanEncounter) {
      // 고음란 산책 — 검정 봉고. 길을 알려주러 다가가면 납치 난교 루트.
      bodyChildren.push(
        el(
          "p",
          { class: "life-result__unlock" },
          "골목 어귀에 검은 봉고 한 대가 시동을 켠 채 서 있다. 조수석 창이 내려가더니 남자가 길을 물으며 손짓한다. …가까이 가볼까?",
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          "그냥 지나치면 아무 일도 없을 것 같다. 다가가면 되돌리기 어려울지도 모른다.",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                ctx.closeModal();
                ctx.afterAction("offline");
              },
            },
            "무시하고 지나간다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let msg = "";
                ctx.update((s) => {
                  msg = blackVanOrgy(s);
                });
                showEncResult("검은 봉고", msg);
              },
            },
            "길을 알려주러 다가간다",
          ),
        ),
      );
    } else if (outcome.wallHoleEncounter) {
      // 고음란 산책 — 담벼락 구멍. 몸을 넣으면 끼여서 비합의 루트(봉고 계열).
      bodyChildren.push(
        el(
          "p",
          { class: "life-result__unlock" },
          "인적 없는 골목, 낡은 담벼락에 사람이 들어갈 만한 커다란 구멍이 뻥 뚫려 있다. 달아오른 몸이 자꾸 그 안을 넘본다. …몸을 넣어볼까?",
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          "그냥 지나치면 아무 일도 없을 것 같다. 넣었다가 끼이면 되돌리기 어려울지도 모른다.",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                ctx.closeModal();
                ctx.afterAction("offline");
              },
            },
            "그냥 지나간다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let msg = "";
                ctx.update((s) => {
                  msg = wallHoleOrgy(s);
                });
                showEncResult("벽고", msg);
              },
            },
            "구멍에 몸을 넣어본다",
          ),
        ),
      );
    } else if (outcome.nudeExposure) {
      // 심야 산책 야외노출 이벤트 — 감행하면 적발 리스크가 걸린 도박.
      bodyChildren.push(
        el(
          "p",
          { class: "life-result__unlock" },
          "인적이 뚝 끊긴 골목, 짙은 어둠뿐이다. 지금이라면 아무도 없는데... 아슬아슬한 야외 노출을 감행해볼까?",
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          "대박이 날 수도, 누군가에게 딱 걸릴 수도 있다.",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                ctx.closeModal();
                ctx.afterAction("offline");
              },
            },
            "위험하니 그만둔다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let msg = "";
                ctx.update((s) => {
                  msg = outdoorShoot(s);
                });
                showEncResult("야외 노출", msg);
              },
            },
            "감행한다",
          ),
        ),
      );
    } else if (outcome.adultEncounter) {
      const enc = getAdultOfflineEncounter(outcome.adultEncounter);
      if (enc) {
        const encId = outcome.adultEncounter;
        bodyChildren.push(
          el("p", { class: "life-result__unlock" }, enc.prompt),
          el("p", { class: "compose-hint", style: "margin-top:14px" }, enc.hint),
          el(
            "div",
            { class: "compose-actions", style: "gap:10px; flex-wrap:wrap" },
            ...enc.choices.map((choice, idx) =>
              el(
                "button",
                {
                  class: idx === 0 ? "btn" : "btn btn--ghost",
                  onclick: () => {
                    let msg = "";
                    ctx.update((s) => {
                      msg = resolveAdultOfflineEncounter(s, encId, idx);
                    });
                    showEncResult(enc.title, msg);
                  },
                },
                choice.label,
              ),
            ),
          ),
        );
      }
    }

    c2.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          icon(ACTIVITY_ICON[act.id] ?? "star", { size: 18 }),
          `${act.label} 완료`,
        ),
      ),
      el("div", { class: "modal__body" }, ...bodyChildren),
    );
    // 함수 identity로 캐시되도록 노드를 그대로 반환(매 렌더 새 화살표 금지 — 여기선 한 번만 넘긴다).
    ctx.openModal(() => c2);
  }

  /**
   * 펫·크리처 조우 결과(성인 아님) — 결과 flavor·델타와 선택을 한 모달에 함께 보여준다(기존 동작).
   */
  function showPetCreatureResult(act: OfflineActivity, outcome: OfflineOutcome): void {
    // 리소스(행동력/정신력/도덕성/돈)와 실제 반영된 스킬 델타(음수=반대급부 포함)를 분리해 보여준다.
    const deltaParts = resultDeltaParts(act, outcome);
    const earnedMsg =
      outcome.earnedMoney != null ? `일당 ${formatNumber(outcome.earnedMoney)}원을 받았다!` : null;
    const unlockMsg = outcome.unlockedAttribute
      ? `새 트윗 소재를 얻었다! (${ATTRIBUTES[outcome.unlockedAttribute].label.replace(/계$/, "")})`
      : null;
    const grade = gradeLabel(outcome.grade);

    const bodyChildren: (HTMLElement | null)[] = [
      grade
        ? el("p", { class: `life-result__grade life-result__grade--${outcome.grade}` }, grade)
        : null,
      el("p", { class: "life-result__flavor" }, outcome.message),
      earnedMsg ? el("p", { class: "life-result__earn" }, earnedMsg) : null,
      deltaParts.length
        ? el("p", { class: "life-result__delta" }, ...renderDeltaParts(deltaParts))
        : null,
      unlockMsg ? el("p", { class: "life-result__unlock" }, unlockMsg) : null,
    ];

    const kind = outcome.petEncounter;
    if (kind) {
      // 산책 중 길동물을 만난 이벤트 — 데려가면 해당 동물 주접 트윗이 열린다.
      const flavor =
        kind === "dog"
          ? "그런데 골목 끝에서 낑낑대던 강아지 한 마리가 쪼르르 다가와 나를 빤히 올려다본다. 목줄도 없이 떨고 있는 게 아무래도 길을 잃은 것 같다."
          : "그런데 담벼락 아래 웅크려 있던 고양이 한 마리가 야옹 하고 울며 다리에 몸을 비빈다. 아무래도 갈 곳 없이 떠도는 아이 같다.";
      bodyChildren.push(
        el("p", { class: "life-result__unlock" }, flavor),
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          `이 ${petLabel(kind)}를 데려갈까? (데려오면 ${petLabel(kind)} 주접 트윗을 올릴 수 있어요)`,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                ctx.closeModal();
                ctx.afterAction("offline");
              },
            },
            "그냥 지나친다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                ctx.update((s) => adoptPet(s, kind));
                ctx.closeModal();
                ctx.toast(
                  `${petLabel(kind)}를 데려왔다! 이제 ${petLabel(kind)} 주접 트윗을 올릴 수 있어요`,
                );
                ctx.afterAction("offline");
              },
            },
            "데려간다",
          ),
        ),
      );
    } else if (outcome.creatureEncounter) {
      // 산책 중 신비한 크리처를 만난 이벤트 — 데려가면 도감에 등록된다.
      const cr = creatureById(outcome.creatureEncounter);
      if (cr) {
        const id = cr.id;
        bodyChildren.push(
          el("p", { class: "life-result__unlock" }, `${cr.emoji} ${cr.encounterText}`),
          el(
            "p",
            { class: "compose-hint", style: "margin-top:14px" },
            "데려가면 크리처 도감에 등록돼요.",
          ),
          el(
            "div",
            { class: "compose-actions", style: "gap:10px" },
            el(
              "button",
              {
                class: "btn btn--ghost",
                onclick: () => {
                  ctx.closeModal();
                  ctx.afterAction("offline");
                },
              },
              "그냥 지나친다",
            ),
            el(
              "button",
              {
                class: "btn",
                onclick: () => {
                  ctx.update((s) => collectCreature(s, id));
                  ctx.closeModal();
                  ctx.toast(`🔍 ${cr.name} · 도감에 등록!`);
                  ctx.afterAction("offline");
                },
              },
              "데려간다",
            ),
          ),
        );
      }
    }

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el(
          "span",
          { class: "modal__head-title" },
          icon(ACTIVITY_ICON[act.id] ?? "star", { size: 18 }),
          `${act.label} 완료`,
        ),
      ),
      el("div", { class: "modal__body" }, ...bodyChildren),
    );
  }

  /**
   * 일반 현생 결과(특수 조우 아님) — 공용 시스템 알림 카드.
   * tone은 항상 "good"(블루)로 고정한다 — 현생 활동은 본질적으로 생산적이고(스킬·소재·돈 획득),
   * 행동력·정신력 소모는 나쁜 결과가 아니라 '비용'이다. 자동 판정에 맡기면 공부처럼 정신력을
   * 쓰는 활동이 부정(레드)으로 오분류된다. 진짜 부정 결과(특수 조우)는 이 분기로 안 온다.
   */
  function showNormalResult(act: OfflineActivity, outcome: OfflineOutcome): void {
    // 고정 skillGains(어휘력·지식 등)는 스탯바로 보여준다(skillDeltas). 랜덤 스킬 라벨·새 소재 해금은
    // 델타로 표현 못 하니(랜덤은 id 미노출, 소재는 스탯 아님) 텍스트 extraLines로 붙인다.
    const extraLines: string[] = [];
    if (outcome.randomSkillLabel) extraLines.push(outcome.randomSkillLabel);
    if (outcome.unlockedAttribute) {
      extraLines.push(
        `새 트윗 소재를 얻었다! (${ATTRIBUTES[outcome.unlockedAttribute].label.replace(/계$/, "")})`,
      );
    }

    const skipBtn = el(
      "button",
      {
        class: "sys-notice__confirm sys-notice__confirm--ghost",
        onclick: () => {
          ctx.closeModal();
          ctx.afterAction("offline");
        },
      },
      "안 올린다",
    );
    const tweetBtn = el(
      "button",
      {
        class: "sys-notice__confirm",
        onclick: () => {
          const text = pick(act.tweetLines);
          let delta = 0;
          ctx.update((s) => {
            delta = postTweet(s, act.tweetAttr, text, false).followerDelta;
          });
          ctx.closeModal();
          ctx.toast(delta >= 0 ? `트윗 게시! +${delta} 팔로워` : `트윗 게시... ${delta} 팔로워`);
        },
      },
      "트윗한다",
    );

    // openModal로 모달 정체성을 바꿔 app이 카드 노드를 새로 그리게 한다.
    ctx.openModal((c) =>
      renderSystemNotice(c, {
        message: outcome.message,
        tone: "good", // 현생 활동은 항상 생산적 — 행동력/정신력 소모로 레드 되지 않게 고정
        deltas: {
          action: act.action,
          mental: act.mental,
          morality: act.morality,
          // 아르바이트 급여(earnedMoney)가 있으면 그 값을, 아니면 활동 고정 보상을.
          money: outcome.earnedMoney ?? act.money,
        },
        // 실제 반영된 최종 델타(등급 배율·감쇠·정신력 배율 반영, 음수=반대급부 포함) — act.skillGains(선언값) 아님.
        skillDeltas: outcome.skillDeltas,
        grade: outcome.grade,
        extraLines,
        extraActions: [skipBtn, tweetBtn],
      }),
    );
  }

  showChoices();
  return container;
}
