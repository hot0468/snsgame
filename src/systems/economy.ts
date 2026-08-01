import type { Employment, GameState, ScheduleEvent } from "@/core/types";
import { appendSchedule } from "@/core/state";
import { uid } from "@/utils/random";
import { HOUSINGS } from "@/data/housing";
import { TIERS } from "@/data/jobs";
import { MAX_SKILL } from "@/data/stats";
import { dateOfMonth, isLastDayOfMonth, isWeekday, monthKey } from "./calendar";
import { sendSalaryKakao, sendTwitterSettlementKakao } from "./kakao";
import { offerLoan } from "./loan";
import { AV_PAYDAY_DATE, avSalaryOf, firstAvWorkDay } from "./avJob";
import { lecturerQuota, lecturerSalaryOf } from "./lecturer";
import { maybeCoachPayday, maybeHoldMeet } from "./coach";
import { NIGL_COMPANY, NIGL_SHIFT_GOAL } from "@/data/niglnigl";

/** 강사 월급날 — 회사(10일)·AV(25일)와 안 겹치게 매월 15일. */
export const LECTURER_PAYDAY_DATE = 15;

/** 하루 생활비 */
export const DAILY_LIVING_COST = 10_000;
/** 월세(주거 데이터에 rent가 없을 때의 기본 월세) */
export const MONTHLY_RENT = 300_000;
/** 팔로워 1명당 월 수익(원) — 매월 1일 정산 */
export const FOLLOWER_MONTHLY_RATE = 2;
/** 연속 미납이 이 횟수에 도달하면 퇴거(게임오버) */
export const RENT_EVICTION_STREAK = 3;

/** 성과 레벨 1당 월급 인상액 */
export const PERF_LEVEL_RAISE = 30_000;

/**
 * 현재 월급 — 회사 등급별 기본급(`TIERS[tier].baseSalary`)에 성과 레벨을 더한다.
 * 등급이 높을수록 기본급이 많다(극소 60만 ~ 대기업 100만).
 */
export function currentSalary(emp: Employment): number {
  return TIERS[emp.tier].baseSalary + emp.perfLevel * PERF_LEVEL_RAISE;
}

function fmt(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 네이놈 배너 적립액(하루 1회) */
export const BANNER_REWARD = 100;

/** 오늘 네이놈 배너로 아직 적립받지 않았는지 */
export function canClaimBanner(state: GameState): boolean {
  return state.daily.bannerClaimedDay !== state.day;
}

/** 네이놈 배너 적립: 하루 1회 100원. @returns 적립액(불가 시 0) */
export function claimBanner(state: GameState): number {
  if (!canClaimBanner(state)) return 0;
  state.money += BANNER_REWARD;
  state.daily.bannerClaimedDay = state.day;
  return BANNER_REWARD;
}

/** 모든 계정의 팔로워 합계 */
export function totalFollowers(state: GameState): number {
  return state.accounts.reduce((sum, a) => sum + a.followers, 0);
}

/** 트위터 프리미엄 월 구독료(매월 1일, 수익 정산 직후 청구) */
export const PREMIUM_MONTHLY_FEE = 12_500;

/** 프리미엄 가입 시 팔로워 수익 배율 */
export const PREMIUM_FOLLOWER_MULTIPLIER = 2;

/**
 * 프리미엄 손익분기 팔로워 수 — 이 수를 넘겨야 구독료가 회수된다.
 * 팔로워 1명당 월 2원이 4원이 되므로 늘어나는 몫은 명당 2원, 7000/2 = 3500명.
 * UI가 "몇 명부터 이득인지"를 말할 때 이 값을 쓴다(문구와 계산이 어긋나지 않게).
 */
export const PREMIUM_BREAKEVEN_FOLLOWERS = Math.ceil(
  PREMIUM_MONTHLY_FEE / (FOLLOWER_MONTHLY_RATE * (PREMIUM_FOLLOWER_MULTIPLIER - 1)),
);

/** 이번 달 정산될 팔로워 수익(원) — 프리미엄 가입 중이면 2배 */
export function monthlyFollowerIncome(state: GameState): number {
  const rate = FOLLOWER_MONTHLY_RATE * (state.premium ? PREMIUM_FOLLOWER_MULTIPLIER : 1);
  return totalFollowers(state) * rate;
}

/** 유료 구독 채널 수익 배율(팔로워 1명당, 음란도 만렙 기준) */
export const SUBSCRIPTION_RATE = 3;

/**
 * 이번 달 정산될 유료 구독 채널 수익(원).
 * 채널을 개설한 경우에만, 팔로워 규모와 음란도(콘텐츠 수위)에 비례한다.
 */
export function monthlySubscriptionIncome(state: GameState): number {
  if (!state.paidChannelJoined) return 0;
  return Math.round(totalFollowers(state) * SUBSCRIPTION_RATE * (state.skills.lewd / MAX_SKILL));
}

function pushSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  appendSchedule(state, { id: uid("sch"), day: state.day, title, kind });
}

/** 이번 달 월세 납부일(마지막 날)까지 남은 일수(오늘이 마지막날이면 0) */
export function daysUntilRent(state: GameState): number {
  let d = state.day;
  while (monthKey(d) === monthKey(d + 1)) d++; // d = 이번 달 마지막 날
  return d - state.day;
}

/** 현재 빚 상태(잔고가 음수)인지 */
export function inDebt(state: GameState): boolean {
  return state.money < 0;
}

/**
 * 지금 돈 드는 행동을 할 수 있는지 — **잔고가 마이너스면 모든 지출을 막는다.**
 * 대부분의 구매는 이미 `money >= 가격`으로 게이팅돼(음수면 자동 차단), 이 헬퍼는 그런 개별
 * 가격 검사가 없는 지출(에스테틱 정기권·휴가 등)에 같은 규칙을 적용하기 위한 공통 관문이다.
 * (자동 차감인 월세·생활비·정기권 관리비는 빚을 만드는 쪽이라 이 게이트를 쓰지 않는다.)
 */
export function canSpend(state: GameState): boolean {
  return state.money >= 0;
}

/** 오늘의 생활비(중견/대기업 재직 시 평일은 면제) */
export function livingCostToday(state: GameState): number {
  const tier = state.employment?.tier;
  if ((tier === "medium" || tier === "large") && isWeekday(state.day)) return 0;
  return DAILY_LIVING_COST;
}

/** 이번 월세액(주거 단계별 월세 · 대기업 재직 시 반값) */
export function rentAmount(state: GameState): number {
  const base = HOUSINGS[state.housingTier]?.rent ?? MONTHLY_RENT;
  return state.employment?.tier === "large" ? Math.round(base / 2) : base;
}

/** 이번 납부일에 실제로 청구되는 금액(이번 달 월세 + 지난달까지 밀린 미납 누적) */
export function rentDue(state: GameState): number {
  return rentAmount(state) + state.overdueRent;
}

/** 월급날(매월 10일, 입사 익월부터) 처리 */
function maybePayday(state: GameState): void {
  const emp = state.employment;
  if (!emp) return;
  if (dateOfMonth(state.day) !== 10) return;
  const mk = monthKey(state.day);
  if (mk <= monthKey(emp.hiredDay)) return; // 익월부터
  if (emp.lastSalaryMonth === mk) return;
  emp.lastSalaryMonth = mk;
  // 니글니글은 자유 출근이지만 이번 '달' 출근이 20일 미만이면 월급 반감(avJob 만근 규칙과 동일).
  // 단 첫 월급달(입사 말일~다음달 10일)은 20일을 채울 물리적 시간이 없어 유예한다 — 둘째 달부터 적용.
  const short =
    emp.company === NIGL_COMPANY &&
    state.niglShifts < NIGL_SHIFT_GOAL &&
    mk > monthKey(emp.hiredDay) + 1;
  const salary = short ? Math.round(currentSalary(emp) / 2) : currentSalary(emp);
  state.money += salary;
  const note = short ? ` (출근 ${state.niglShifts}/${NIGL_SHIFT_GOAL}일 미달 반감)` : "";
  pushSchedule(state, `월급 +${fmt(salary)}원 (${emp.company})${note}`, "system");
  sendSalaryKakao(state, emp.company, salary);
  // 월급날 기준으로 다음 '달' 출근 카운트를 리셋한다(avJob 26일 앵커와 같은 방식).
  if (emp.company === NIGL_COMPANY) state.niglShifts = 0;
}

/**
 * AV 월급날(매월 25일) 처리. 회사 월급(10일)과 독립. 사이클은 26일에 앵커된다:
 * 25일 지급 → 26일에 근무일·노콘 리셋(maybeAvMonthReset) → 26~25가 한 '달'.
 * 첫 지급은 첫 근무일(계약 후 처음 오는 26일) 이후의 25일부터.
 * ⚠️ 지급만 하고 리셋은 안 한다 — 리셋은 다음날 26일이 담당한다(사용자 확정).
 */
function maybeAvPayday(state: GameState): void {
  const job = state.avJob;
  if (!job) return;
  if (dateOfMonth(state.day) !== AV_PAYDAY_DATE) return;
  if (state.day < firstAvWorkDay(job.joinedDay)) return; // 첫 근무일(첫 26일) 전엔 지급 없음
  const mk = monthKey(state.day);
  if (job.lastSalaryMonth === mk) return;
  job.lastSalaryMonth = mk;
  const salary = avSalaryOf(state);
  state.money += salary;
  pushSchedule(state, `AV 월급 +${fmt(salary)}원`, "system");
}

/**
 * 강사 월급날(매월 15일). **이번 달 수업 횟수 × 회당 강사료**를 주고 그 자리에서 횟수를 리셋한다.
 * AV와 달리 리셋을 다음날로 미루지 않는다 — 강사는 '지급일이 곧 한 달의 끝'이라 경계가 하루면 충분하다.
 * 필수 회차(레벨에 따라 감소)를 못 채워도 지급은 한다. 채운 만큼 받는 게 이 직업의 규칙이다.
 */
function maybeLecturerPayday(state: GameState): void {
  const job = state.lecturerJob;
  if (!job) return;
  if (dateOfMonth(state.day) !== LECTURER_PAYDAY_DATE) return;
  const mk = monthKey(state.day);
  if (job.lastSalaryMonth === mk) return;
  job.lastSalaryMonth = mk;
  const lessons = job.lessonsThisMonth;
  const quota = lecturerQuota(state);
  const salary = lecturerSalaryOf(state);
  job.lessonsThisMonth = 0;
  if (salary > 0) {
    state.money += salary;
    const short = lessons < quota ? ` — 필수 ${quota}회 미달` : "";
    pushSchedule(state, `강사료 +${fmt(salary)}원 (${lessons}회 수업)${short}`, "system");
  } else {
    pushSchedule(state, `이번 달 수업이 없어 강사료가 없다 (필수 ${quota}회)`, "system");
  }
}

/**
 * AV 근무일·노콘 월 리셋 — 월급 다음날인 매월 26일에 새 '달'이 시작된다(사용자 확정).
 * onNewDay가 하루 1회 부르고 26일은 월 1회뿐이라 별도 중복 가드 불필요.
 */
function maybeAvMonthReset(state: GameState): void {
  const job = state.avJob;
  if (!job) return;
  if (dateOfMonth(state.day) !== 26) return;
  job.workDaysThisMonth = 0;
  job.condomlessThisMonth = 0;
}

/**
 * 매월 1일 트위터(X) 수익(팔로워 + 유료 구독)을 정산해 money에 크레딧하고 알림 카톡을 보낸다.
 * 1일 저녁 슬롯 진입 시 time.advanceTime에서 호출된다(내부 가드로 1일에만 실제 동작, 월 1회).
 */
export function settleMonthlyIncome(state: GameState): void {
  if (state.gameOver) return;
  if (dateOfMonth(state.day) !== 1) return;
  const mk = monthKey(state.day);
  if (state.lastIncomeSettleMonth === mk) return; // 이번 달 이미 정산
  state.lastIncomeSettleMonth = mk;
  const income = monthlyFollowerIncome(state);
  const subs = monthlySubscriptionIncome(state);
  if (income > 0) {
    state.money += income;
    pushSchedule(state, `팔로워 수익 +${fmt(income)}원`, "system");
  }
  if (subs > 0) {
    state.money += subs;
    pushSchedule(state, `유료 구독 수익 +${fmt(subs)}원`, "system");
  }
  if (income + subs > 0) sendTwitterSettlementKakao(state, income, subs);
  // 프리미엄 구독료는 수익을 크레딧한 **뒤** 청구한다 — 이번 달 수익으로 이번 달 구독료를 낼 수 있어야
  // "팔로워가 충분하면 알아서 굴러가는 구독"이 성립한다. 못 내면 빚을 지우지 않고 그 자리에서 해지한다.
  if (state.premium) {
    if (state.money >= PREMIUM_MONTHLY_FEE) {
      state.money -= PREMIUM_MONTHLY_FEE;
      pushSchedule(state, `프리미엄 구독료 -${fmt(PREMIUM_MONTHLY_FEE)}원`, "system");
    } else {
      state.premium = false;
      pushSchedule(state, "잔고 부족으로 프리미엄 구독이 해지되었습니다", "system");
    }
  }
}

/** 소지금이 마이너스면 대부 제안 카톡을, 흑자로 돌아오면 제안 플래그를 리셋 */
function updateLoanOffer(state: GameState): void {
  if (state.money < 0 && !state.loan && !state.loanOffered) {
    offerLoan(state);
  } else if (state.money >= 0) {
    state.loanOffered = false;
  }
}

/**
 * 하루가 지날 때 호출: 월급→생활비→(매월 마지막 날)월세를 정산한다.
 * 월세를 못 내면 연속 미납이 쌓이고, 3회 연속이면 퇴거(게임오버).
 * time.onNewDay에서 호출된다.
 */
export function applyDailyCosts(state: GameState): void {
  // 월급(익월부터, 매월 10일)
  maybePayday(state);
  // AV 월급(매월 25일) — 회사 월급과 독립. 다음날 26일에 근무일·노콘 리셋.
  maybeAvPayday(state);
  maybeAvMonthReset(state);
  // 강사 월급(매월 15일) — 지급과 동시에 이번 달 수업 횟수를 리셋한다(지급일=사이클 경계).
  maybeLecturerPayday(state);
  // 배구부: 대회(4·6·8·10월 15일) → 성적이 월급 인상분에 붙고, 코치 월급은 20일.
  // ⚠️ 대회를 월급보다 **먼저** 처리한다 — 같은 달 대회 인상분이 그달 월급부터 반영되게.
  maybeHoldMeet(state);
  maybeCoachPayday(state);

  // 생활비. 소지금이 모자라면 굶은 것으로 친다(차감 자체는 그대로 — 빚을 만드는 자동 차감이다).
  // ⚠️ 굶주림 연속일수만 여기서 갱신하고, 체력 감소는 health.settleHunger가 한다.
  const living = livingCostToday(state);
  if (living > 0) {
    if (state.money < living) {
      state.hungerStreak += 1;
      pushSchedule(state, `생활비를 못 냈다 — 굶주림 ${state.hungerStreak}일차`, "system");
    } else {
      state.hungerStreak = 0;
    }
    state.money -= living;
    pushSchedule(state, `생활비 -${fmt(living)}원`, "system");
  } else {
    // 생활비가 면제된 날(중견·대기업 재직 평일)은 회사가 먹여준다 — 굶지 않는다.
    state.hungerStreak = 0;
  }

  // 월세(매월 마지막 날 청구). 수입 정산은 매월 1일 settleMonthlyIncome에서 별도로 처리한다.
  if (isLastDayOfMonth(state.day)) {
    // 이번 달 월세 + 지난달까지 밀린 미납액을 함께 청구한다
    const hadOverdue = state.overdueRent > 0;
    const due = rentAmount(state) + state.overdueRent;
    if (state.money >= due) {
      state.money -= due;
      state.overdueRent = 0;
      state.unpaidRentStreak = 0;
      pushSchedule(
        state,
        hadOverdue ? `밀린 월세까지 -${fmt(due)}원` : `월세 -${fmt(due)}원`,
        "system",
      );
    } else {
      // 못 내면 이번 달 월세까지 미납액에 누적 → 다음 달에 합산 청구
      state.overdueRent = due;
      state.unpaidRentStreak += 1;
      pushSchedule(
        state,
        `월세 미납! 누적 ${fmt(due)}원 (${state.unpaidRentStreak}/${RENT_EVICTION_STREAK})`,
        "system",
      );
      // 독촉 카톡은 익월 2일에 time.maybeSendRentOverdueNag가 보낸다(즉시 발송 안 함).
      if (!state.gameOver && state.unpaidRentStreak >= RENT_EVICTION_STREAK) {
        state.gameOver = "월세를 세 달 연속 내지 못해 방에서 쫓겨났습니다...";
        pushSchedule(state, "퇴거 — 게임 오버", "system");
      }
    }
  }

  // 적자면 대부업체가 연락한다
  updateLoanOffer(state);
}
