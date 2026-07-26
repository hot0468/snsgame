import type { GameContext } from "./context";
import {
  OFFLINE_ACTIVITIES,
  type OfflineActivity,
  type OfflineOutcome,
  adoptPet,
  doOfflineActivity,
  partTimePay,
  petLabel,
  canSpendDay,
  canAffordVacation,
  spendDayResting,
  creatureById,
  collectCreature,
} from "@/systems/offline";
import { postTweet } from "@/systems/tweetSystem";
import { outdoorShoot, blackVanOrgy } from "@/systems/events";
import { getAdultOfflineEncounter } from "@/data/adultOffline";
import { resolveAdultOfflineEncounter } from "@/systems/adultOffline";
import { canNiglWork, quitCurrentJob } from "@/systems/employment";
import { confirmPurchase } from "./confirmModal";
import { NIGL_COMPANY, NIGL_SHIFT_GOAL } from "@/data/niglnigl";
import { renderWorkModal } from "./workModal";
import { hasCertification } from "@/systems/certification";
import { isWeekday } from "@/systems/time";
import { isAuthorPrepMonth } from "@/systems/author";
import { LATE_SLOT } from "@/core/state";
import { makeJobPostings, DEV_JOB_IT_REQ } from "@/data/jobs";
import { SKILL_STATS } from "@/data/stats";
import { hasAction } from "@/systems/stats";
import { ATTRIBUTES } from "@/data/attributes";
import { pick } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";
import { icon, ACTIVITY_ICON } from "./icons";
import { renderJobBoardModal } from "./jobBoardModal";
import { renderSystemNotice } from "./systemNotice";

/** +/- 부호를 붙인 수치 문자열 */
function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

/** 활동의 스탯 변화 요약 한 줄. 아르바이트면 현재 일당도 함께 표시. */
function activityDeltas(act: OfflineActivity, partTimeCount: number): string {
  const parts: string[] = [];
  if (act.action) parts.push(`행동력 ${signed(act.action)}`);
  if (act.mental) parts.push(`정신력 ${signed(act.mental)}`);
  if (act.morality) parts.push(`도덕성 ${signed(act.morality)}`);
  if (act.money) parts.push(`${signed(act.money)}원`);
  for (const [skill, amount] of Object.entries(act.skillGains ?? {})) {
    parts.push(`${SKILL_STATS[skill as keyof typeof SKILL_STATS].label} +${amount}`);
  }
  if (act.partTime) parts.push(`일당 ${formatNumber(partTimePay(partTimeCount))}원`);
  return parts.join(" · ");
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

  function activityItem(act: OfflineActivity, partTimeCount: number): HTMLElement {
    // 휴가는 10만원이 있어야 갈 수 있다 — 소지금 부족이면 비활성.
    const cantAfford = !!act.vacation && !canAffordVacation(ctx.store.getState());
    // 행동력을 쓰는 활동(act.action<0)은 잔여 행동력이 비용보다 적으면 막는다(마이너스 방지).
    const notEnoughAction = act.action < 0 && !hasAction(ctx.store.getState(), -act.action);
    const blocked = cantAfford || notEnoughAction;
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
          cantAfford
            ? "소지금이 부족해요 (10만원 필요)"
            : notEnoughAction
              ? `행동력이 부족해요 (${-act.action} 필요)`
              : activityDeltas(act, partTimeCount),
        ),
      ),
    );
  }

  function showChoices(): void {
    const state = ctx.store.getState();
    const partTimeCount = state.partTimeCount;
    // 작가 원고 작업은 계약 중일 때 노출. 단 준비 기간의 심야엔 숨긴다(아직 작업 시작 전).
    const underContract = state.authorContract != null;
    const showAuthorWork =
      underContract && !(isAuthorPrepMonth(state) && state.slot === LATE_SLOT);

    const adultMode = state.adultMode;
    const items = OFFLINE_ACTIVITIES.filter(
      (act) =>
        act.group === lifeTab &&
        (!act.authorWork || showAuthorWork) &&
        (!act.adultOnly || adultMode), // 해피타임 등 성인 활동은 성인물 보기 ON일 때만
    ).map((act) => activityItem(act, partTimeCount));

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
        el(
          "div",
          { class: "feed__tabs life-tabs" },
          lifeTabBtn("휴식", "rest"),
          lifeTabBtn("공부", "study"),
          lifeTabBtn("자기개발", "growth"),
        ),
        el("div", { class: "offline-grid" }, ...items),
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
    if (outcome.blackVanEncounter || outcome.nudeExposure || outcome.adultEncounter) {
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
        skillDeltas: act.skillGains,
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
    // 아르바이트 급여는 별도 줄로 표시하므로 델타 요약에선 뺀다.
    const deltaParts = [activityDeltas({ ...act, partTime: false }, 0), outcome.randomSkillLabel]
      .filter(Boolean)
      .join(" · ");
    const earnedMsg =
      outcome.earnedMoney != null ? `일당 ${formatNumber(outcome.earnedMoney)}원을 받았다!` : null;
    const unlockMsg = outcome.unlockedAttribute
      ? `새 트윗 소재를 얻었다! (${ATTRIBUTES[outcome.unlockedAttribute].label.replace(/계$/, "")})`
      : null;

    const bodyChildren: (HTMLElement | null)[] = [
      el("p", { class: "life-result__flavor" }, outcome.message),
      earnedMsg ? el("p", { class: "life-result__earn" }, earnedMsg) : null,
      deltaParts ? el("p", { class: "life-result__delta" }, deltaParts) : null,
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
        skillDeltas: act.skillGains,
        extraLines,
        extraActions: [skipBtn, tweetBtn],
      }),
    );
  }

  showChoices();
  return container;
}
