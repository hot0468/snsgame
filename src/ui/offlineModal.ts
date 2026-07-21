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
  spendDayResting,
  creatureById,
  collectCreature,
} from "@/systems/offline";
import { postTweet } from "@/systems/tweetSystem";
import { outdoorShoot, blackVanOrgy } from "@/systems/events";
import { getAdultOfflineEncounter } from "@/data/adultOffline";
import { resolveAdultOfflineEncounter } from "@/systems/adultOffline";
import { AUTHOR_WORKLOAD_TARGET, AUTHOR_MAX_MISS, isAuthorPrepMonth } from "@/systems/author";
import { salaryOf, canNiglWork } from "@/systems/employment";
import { NIGL_COMPANY, NIGL_SHIFT_GOAL } from "@/data/niglnigl";
import { renderWorkModal } from "./workModal";
import { hasCertification } from "@/systems/certification";
import { isWeekday } from "@/systems/time";
import { makeJobPostings, TIERS, DEV_JOB_COMPANY, DEV_JOB_IT_REQ } from "@/data/jobs";
import { SKILL_STATS } from "@/data/stats";
import { ATTRIBUTES } from "@/data/attributes";
import { pick } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";
import { icon, ACTIVITY_ICON } from "./icons";
import { renderCommitGrass } from "./components";
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
    return el(
      "button",
      {
        class: "life-item",
        onclick: () => {
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
        el("span", { class: "life-item__delta" }, activityDeltas(act, partTimeCount)),
      ),
    );
  }

  function showChoices(): void {
    const partTimeCount = ctx.store.getState().partTimeCount;
    // 작가 원고 작업은 계약 중일 때만 노출
    const underContract = ctx.store.getState().authorContract != null;
    const growth = lifeTab === "growth";

    const adultMode = ctx.store.getState().adultMode;
    const items = OFFLINE_ACTIVITIES.filter(
      (act) =>
        act.group === lifeTab &&
        (!act.authorWork || underContract) &&
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
          lifeTabBtn("자기개발", "growth"),
        ),
        el("div", { class: "offline-grid" }, ...items),
        // 작가 계약 게이지는 자기개발(작업) 탭에서만
        growth ? authorSection() : null,
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

  /** 작가 계약 섹션: 계약 중이면 이번 달 작업량 게이지와 미달 횟수를 표시 */
  function authorSection(): HTMLElement | null {
    const state = ctx.store.getState();
    const c = state.authorContract;
    if (!c) return null;
    // 계약한 달은 준비 기간 — 다음 달(익월)부터 작업이 시작되고, 첫 월급은 그다음 달 1일.
    const prep = isAuthorPrepMonth(state);
    const pct = Math.min(100, Math.round((c.workload / AUTHOR_WORKLOAD_TARGET) * 100));
    const met = c.workload >= AUTHOR_WORKLOAD_TARGET;
    return el(
      "div",
      { class: "job-section" },
      el(
        "div",
        { class: "job-status" },
        el("span", { class: "job-status__icon" }, icon("pen", { size: 18 })),
        el(
          "div",
          { style: "flex:1" },
          el(
            "div",
            { class: "job-status__title" },
            prep
              ? "작가 계약 · 준비 기간"
              : `작가 계약 · ${c.monthsWorked + 1}개월차` + (met ? " · 이번 달 목표 달성 ✓" : ""),
          ),
          el(
            "div",
            { class: "job-status__meta" },
            prep
              ? "이번 달은 준비 기간 · 다음 달부터 작업 시작 (첫 월급은 그다음 달 1일)"
              : `이번 달 작업량 ${c.workload}/${AUTHOR_WORKLOAD_TARGET} · 미달 ${c.missCount}/${AUTHOR_MAX_MISS}`,
          ),
          el(
            "div",
            {
              style:
                "margin-top:6px;height:8px;border-radius:4px;background:var(--border);overflow:hidden",
            },
            el("div", {
              style: `height:100%;width:${pct}%;background:${met ? "var(--accent)" : "var(--accent)"};transition:width .2s`,
            }),
          ),
        ),
      ),
    );
  }

  /** 취업 섹션: 재직 중이면 상태 표시, 무직이면 취업(지원) 버튼(평일·하루 1회) */
  function jobSection(): HTMLElement {
    const s = ctx.store.getState();
    const emp = s.employment;

    if (emp) {
      const tier = TIERS[emp.tier];
      const isNigl = emp.company === NIGL_COMPANY;
      const meta =
        emp.company === DEV_JOB_COMPANY
          ? el(
              "div",
              { class: "job-status__meta" },
              el(
                "div",
                { style: "margin-bottom:5px" },
                `커밋 성과 Lv.${emp.perfLevel} · 월급 ${formatNumber(salaryOf(s))}원`,
              ),
              renderCommitGrass(emp.performance, emp.perfLevel),
            )
          : isNigl
            ? el(
                "div",
                { class: "job-status__meta" },
                `이번 달 출근 ${s.niglShifts}/${NIGL_SHIFT_GOAL}일 · 월급 ${formatNumber(salaryOf(s))}원 (20일 미달 시 반감)`,
              )
            : el(
                "div",
                { class: "job-status__meta" },
                `성과 Lv.${emp.perfLevel} (${Math.round(emp.performance)}/100) · 월급 ${formatNumber(salaryOf(s))}원`,
              );
      return el(
        "div",
        { class: "job-section" },
        el(
          "div",
          { class: "job-status" },
          el("span", { class: "job-status__icon" }, icon("article", { size: 18 })),
          el("div", {}, el("div", { class: "job-status__title" }, `재직 중 · ${emp.company} (${tier.label})`), meta),
        ),
        // 니글니글은 자유 출근 — 원할 때 자발적으로 나간다(주말·심야 포함, 강제 팝업 없음).
        isNigl && canNiglWork(s)
          ? el(
              "button",
              {
                class: "btn",
                style: "margin-top:10px;width:100%",
                onclick: () => ctx.openModal((c) => renderWorkModal(c)),
              },
              `출근하기 (자유출근 · 이번 달 ${s.niglShifts}/${NIGL_SHIFT_GOAL}일)`,
            )
          : null,
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
          onclick: () => {
            if (!canApply) return;
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
          },
        },
        icon("article", { size: 18 }),
        label,
      ),
    );
  }

  function showResult(act: OfflineActivity, outcome: OfflineOutcome): void {
    const isSpecial = !!(
      outcome.blackVanEncounter ||
      outcome.nudeExposure ||
      outcome.adultEncounter ||
      outcome.petEncounter ||
      outcome.creatureEncounter
    );

    // 일반(특수 조우 아님) 현생 결과는 공용 시스템 알림 카드로 통일한다.
    // 특수 조우 4종(봉고·노출·성인·펫)은 각자 서사 서브플로우+분홍 테마라 아래 기존 코드 그대로.
    if (!isSpecial) {
      showNormalResult(act, outcome);
      return;
    }

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
                container.replaceChildren(
                  el(
                    "div",
                    { class: "modal__head" },
                    el("span", { class: "modal__head-title" }, icon("shield", { size: 18 }), "검은 봉고"),
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
                container.replaceChildren(
                  el(
                    "div",
                    { class: "modal__head" },
                    el("span", { class: "modal__head-title" }, icon("shield", { size: 18 }), "야외 노출"),
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
                    container.replaceChildren(
                      el(
                        "div",
                        { class: "modal__head" },
                        el(
                          "span",
                          { class: "modal__head-title" },
                          icon("shield", { size: 18 }),
                          enc.title,
                        ),
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
                  },
                },
                choice.label,
              ),
            ),
          ),
        );
      }
    } else if (kind) {
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
      // 산책 중 신비한 크리처를 만난 이벤트 — 데려가면 도감에 등록된다. (펫 다음, 일반 결과 앞)
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

    // 노골 성인 조우(검은 봉고·야외노출·성인 조우)만 분홍 테마.
    container.classList.toggle(
      "modal--adult",
      !!(outcome.blackVanEncounter || outcome.nudeExposure || outcome.adultEncounter),
    );

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
    // 스킬 획득(고정 skillGains + 랜덤)·새 소재 해금은 델타로 표현 못 하니 extraLines로 붙인다.
    const skillParts: string[] = [];
    for (const [skill, amount] of Object.entries(act.skillGains ?? {})) {
      skillParts.push(`${SKILL_STATS[skill as keyof typeof SKILL_STATS].label} +${amount}`);
    }
    if (outcome.randomSkillLabel) skillParts.push(outcome.randomSkillLabel);
    const extraLines: string[] = [];
    if (skillParts.length) extraLines.push(skillParts.join(" · "));
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
        extraLines,
        extraActions: [skipBtn, tweetBtn],
      }),
    );
  }

  showChoices();
  return container;
}
