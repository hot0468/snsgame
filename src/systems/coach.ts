import type { GameState, MeetResult } from "@/core/types";
import { MORNING_SLOT } from "@/core/state";
import { dateOf, dateOfMonth, isWeekday, monthKey } from "./calendar";
import { hasAnyJob, quitCurrentJob } from "./employment";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { pushKakao } from "./kakao";
import { clampAction, clampMental, gainSkill, skillTo100 } from "./stats";
import { recordMission } from "./missions";
import { rollActivityGrade, type ActivityGrade } from "./condition";
import { addSchedule } from "./time";

/**
 * 고등학교 배구부 코치직.
 *
 * - **섭외**: 운동을 꾸준히 해 몸이 만들어지면 학교에서 카톡이 온다(`maybeOfferCoach`).
 *   제의는 무직일 때만 보낸다 — 다른 일을 하는 중이면 플래그를 세우지 않고 넘겨, 나중에 다시 온다.
 * - **근무**: 평일 낮 강제 출근(`isCoachWorkNow`). 회사원과 같은 취급이라 app이 훈련 모달을 띄운다.
 * - **월급**: 고정급이다. 성과급이 아니라 **대회 성적이 기본급에 영구히 얹히는** 구조다.
 * - **대회**: 4·6·8·10월 15일에 열린다. 10월이 전국체전이고, 여기서 우승하면
 *   그 인상분은 **다음 해부터** 반영된다(`pendingRaise`).
 *
 * ⚠️ 대회 성적은 굴림이 아니라 **팀 완성도(스탯 + 그 시즌 훈련 횟수)로 결정된다.**
 *    운이 아니라 준비가 성적을 만든다 — 훈련을 안 하면 스탯이 아무리 높아도 우승선에 못 닿는다.
 */

/**
 * 배구부가 있는 학교 이름. 카톡 발신자·일정·화면 제목이 전부 이걸 쓴다 —
 * 이름을 바꿀 땐 여기만 고치면 된다(문장에 직접 박아 넣지 마라).
 */
export const SCHOOL_NAME = "오지고";
/** 발신자 표시명(카톡) */
export const COACH_SENDER = `${SCHOOL_NAME} 체육부장`;

/** 섭외가 들어오는 운동 스탯 문턱(0~999) */
export const COACH_OFFER_FITNESS = 300;

/** 코치 기본급(대회 인상분 제외) */
export const COACH_BASE_SALARY = 900_000;
/** 코치 월급날 — 회사(10일)·강사(15일)·AV(25일)와 안 겹치게 20일 */
export const COACH_PAYDAY_DATE = 20;

/** 대회가 열리는 달(4·6·8월은 지역 대회, 10월은 전국체전) */
export const MEET_MONTHS = [4, 6, 8, 10] as const;
/** 대회일(매 대회 달의 이 날짜) */
export const MEET_DATE = 15;
/** 전국체전이 열리는 달 */
export const NATIONAL_MEET_MONTH = 10;

/** 훈련 1회 행동력 소모 */
export const COACH_TRAIN_ACTION_COST = 14;
/** 이 횟수를 누적할 때마다 코치 레벨 1 */
export const COACH_TRAININGS_PER_LEVEL = 5;

/** 팀 완성도 게이지 상한(대회 성적 판정 기준값과 같은 스케일) */
export const COACH_STAT_TARGET = 100;

/**
 * 훈련 1회 상승폭 산정 가중치(합 1.0 — 스킬과 같은 0~999 스케일 유지).
 * 운동만으로는 부족하다: 애들을 다루는 친화력과 전술을 짜는 지식이 함께 필요하다.
 */
export const COACH_WEIGHTS = { fitness: 0.5, sociability: 0.3, knowledge: 0.2 } as const;

/**
 * 훈련 1회 기본 상승폭(코치 스킬 0일 때)과 스킬 가산.
 *
 * ⚠️ 시즌(대회~대회) 길이는 약 61일이고 훈련은 **평일 낮 1회**뿐이라 시즌당 최대 ~43회다.
 *    예전 값(4·8)으론 우승선(95)에 8~22회면 닿아 시즌의 절반 이상이 남아돌았다 —
 *    "이미 만렙이라 오늘 훈련은 의미 없음"이 시즌마다 반복됐다.
 *    지금 값 + 아래 체감 곡선으로 우승은 시즌의 절반쯤을 써야 닿는다.
 */
export const TRAIN_GAIN_BASE = 3;
/** 코치 스킬 가중합 100점당 추가 상승폭 — 스킬이 좋을수록 한 번에 많이 끌어올린다 */
export const TRAIN_GAIN_PER_SKILL = 4;

/**
 * **완성도가 높을수록 덜 오른다**(체감). 남은 여백 비율에 이 구간을 곱한다:
 * 0%일 때 `TRAIN_TAPER_MIN`, 100%일 때 1.0.
 *
 * 왜: 선형이면 마지막 1점과 첫 1점이 같은 값이라, 문턱을 넘긴 뒤의 훈련이 통째로 무의미해진다.
 * 체감을 주면 초반엔 쭉쭉 오르고 우승선 근처에서 버티는 곡선이 되어 시즌 내내 훈련할 이유가 남는다.
 */
export const TRAIN_TAPER_MIN = 0.25;

/**
 * 판정 등급별 상승 배율. 현생 활동의 컨디션 판정(`rollActivityGrade`)을 그대로 쓴다 —
 * 코치만 별도 굴림을 두면 "정신력이 컨디션을 만든다"는 이 게임의 규칙이 코치에서만 깨진다.
 */
export const TRAIN_GRADE_MULT: Record<ActivityGrade, number> = {
  fail: 0.25,
  normal: 1,
  great: 1.8,
};

/** 대회 성적별 **영구** 월급 인상액 */
export const MEET_RAISE: Record<MeetResult, number> = {
  champion: 150_000,
  runnerup: 80_000,
  semifinal: 30_000,
  eliminated: 0,
};

/** 전국체전 우승 시 **다음 해부터** 붙는 인상액 */
export const NATIONAL_CHAMPION_RAISE = 500_000;

export const MEET_LABEL: Record<MeetResult, string> = {
  champion: "우승",
  runnerup: "준우승",
  semifinal: "4강",
  eliminated: "예선 탈락",
};

/** 지금이 코치 근무 시간인지 — 평일 낮. 회사원의 `isWorkNow`와 같은 자리를 쓴다. */
export function isCoachWorkNow(state: GameState): boolean {
  if (!state.coachJob || state.gameOver) return false;
  if (state.day <= state.coachJob.hiredDay) return false; // 부임 당일은 쉬고 익일부터
  return isWeekday(state.day) && state.slot === MORNING_SLOT;
}

/** 코치 레벨(0부터) — 누적 훈련 횟수에서 파생. */
export function coachLevel(state: GameState): number {
  const job = state.coachJob;
  if (!job) return 0;
  return Math.floor(job.totalTrainings / COACH_TRAININGS_PER_LEVEL);
}

/** 지금 월급(고정급 + 확정된 대회 인상분). 예약된 전국체전 인상분은 해가 바뀌어야 들어온다. */
export function coachSalaryOf(state: GameState): number {
  const job = state.coachJob;
  if (!job) return 0;
  return COACH_BASE_SALARY + job.raise;
}

/**
 * 지금 팀 완성도(=저장된 게이지). 화면 표시와 대회 판정이 **같은 값**을 본다.
 * ⚠️ 스킬로 다시 계산하지 마라 — 게이지는 훈련으로만 오르고 대회마다 리셋되는 상태값이다.
 */
export function teamStrength(state: GameState): number {
  return state.coachJob?.teamStat ?? 0;
}

/**
 * 훈련 1회 상승폭(등급 반영 전). 코치 스킬이 좋을수록 크고, **완성도가 높을수록 작다**.
 *
 * ⚠️ 체감(taper)을 여기 넣는 이유: UI가 "예상 상승폭"을 보여줄 때도 같은 값이어야 한다.
 *    doCoachTraining에만 넣으면 화면 숫자와 실제가 어긋난다.
 */
export function trainGain(state: GameState): number {
  const s = state.skills;
  const weighted = skillTo100(
    s.fitness * COACH_WEIGHTS.fitness +
      s.sociability * COACH_WEIGHTS.sociability +
      s.knowledge * COACH_WEIGHTS.knowledge,
  );
  const raw = TRAIN_GAIN_BASE + (weighted / 100) * TRAIN_GAIN_PER_SKILL;
  const remaining = Math.max(0, COACH_STAT_TARGET - teamStrength(state)) / COACH_STAT_TARGET;
  return raw * (TRAIN_TAPER_MIN + (1 - TRAIN_TAPER_MIN) * remaining);
}

/** 완성도 → 성적. 전국체전은 전국구라 한 단계씩 문턱이 높다. */
export function meetResultFor(strength: number, national: boolean): MeetResult {
  const bar = national ? 10 : 0;
  if (strength >= 85 + bar) return "champion";
  if (strength >= 70 + bar) return "runnerup";
  if (strength >= 50 + bar) return "semifinal";
  return "eliminated";
}

/** 오늘이 대회 날인지(대회 달의 MEET_DATE). */
export function isMeetDay(day: number): boolean {
  const d = dateOf(day);
  return (
    dateOfMonth(day) === MEET_DATE &&
    (MEET_MONTHS as readonly number[]).includes(d.getMonth() + 1)
  );
}

/**
 * 운동을 마쳤을 때 섭외 카톡을 시도한다(현생 살기의 운동 활동이 호출).
 * @returns 제의를 보냈으면 true
 */
export function maybeOfferCoach(state: GameState): boolean {
  if (state.coachOffered || state.coachJob || state.gameOver) return false;
  if (state.skills.fitness < COACH_OFFER_FITNESS) return false;
  // 다른 일을 하는 중이면 플래그를 세우지 않고 그냥 넘긴다 — 무직이 됐을 때 다시 온다.
  if (hasAnyJob(state)) return false;
  state.coachOffered = true;
  const thread = pushKakao(
    state,
    COACH_SENDER,
    [
      `안녕하세요, ${SCHOOL_NAME}등학교 체육부장입니다. 헬스장 관장님 소개로 연락드립니다.`,
      "저희 배구부 코치를 맡아주실 분을 찾고 있습니다. 애들이 스무 명 남짓 되는데 지도해 주실 분이 없어서요.",
      "평일 낮에 나와주시면 되고, 대회는 4월·6월·8월에 있습니다. 10월 전국체전이 제일 큽니다.",
      "월급은 고정입니다만, 대회에서 성적을 내주시면 그만큼 올려드리겠습니다. 어떠십니까?",
    ],
    { hue: 205 },
  );
  thread.coachOffer = { responded: false };
  return true;
}

/** 섭외 수락 — 코치로 부임한다. 다른 직업이 있으면 정리하고 갈아탄다. */
export function acceptCoachJob(state: GameState): void {
  if (state.coachJob) return;
  if (hasAnyJob(state)) quitCurrentJob(state);
  state.coachJob = {
    hiredDay: state.day,
    totalTrainings: 0,
    teamStat: 0,
    raise: 0,
    pendingRaise: 0,
    pendingRaiseYear: -1,
    lastMeetMonth: -1,
    championships: 0,
    lastSalaryMonth: -1,
  };
  markJobExperienced(state, JOB_ID.coach); // 직업 도감 해금(그만둬도 남는다)
  addSchedule(state, `${SCHOOL_NAME} 배구부 코치 부임`, "system");
}

export interface TrainingResult {
  message: string;
  /** 이번 훈련의 컨디션 판정(자율 훈련이면 normal) */
  grade: ActivityGrade;
  /** 이번에 오른 완성도(자율 훈련이면 0) */
  gained: number;
  /** 훈련 후 완성도 */
  strength: number;
  target: number;
}

/** 판정별 훈련 서사 — 오른 폭이 왜 다른지 문장으로 보이게 한다. */
const DRILL_LINES: Record<ActivityGrade, string> = {
  fail: "호루라기를 불어도 애들이 안 따라왔다. 오늘은 거의 못 잡았다.",
  normal: "리시브부터 차근차근 다시 잡았다. 동작이 조금씩 몸에 뱄다.",
  great: "분위기가 제대로 붙었다. 랠리가 끊기지 않고 이어져 진도가 훌쩍 나갔다.",
};

/**
 * 훈련 지도 한 블록. 시간 진행은 호출부(근무 모달)가 한다 — 회사 근무(`doWork`)와 같은 규칙이다.
 * 가르치면서 몸도 쓰고 애들도 상대하므로 운동·친화력이 조금 오른다.
 *
 * ⚠️ 판정은 `rollActivityGrade`(정신력 기반)를 쓴다. 코치가 지쳐 있으면 훈련이 헛돈다 —
 *    독립 난수로 바꾸면 "정신력 관리가 성적을 만든다"는 연결이 끊긴다.
 */
export function doCoachTraining(state: GameState, mode: "drill" | "easy"): TrainingResult | null {
  const job = state.coachJob;
  if (!job) return null;

  if (mode === "easy") {
    // 가볍게 넘긴 날 — 팀은 안 늘지만 코치 정신력이 회복된다(딴짓과 달리 벌점은 없다).
    state.resources.action = clampAction(state, state.resources.action - 4);
    state.resources.mental = clampMental(state, state.resources.mental + 6);
    addSchedule(state, "배구부 자율 훈련", "system");
    return {
      message: "가볍게 몸만 풀리고 자율 훈련으로 돌렸다. 코치도 숨을 좀 돌렸다.",
      grade: "normal",
      gained: 0,
      strength: job.teamStat,
      target: COACH_STAT_TARGET,
    };
  }

  const grade = rollActivityGrade(state);
  const gained = Math.max(1, Math.round(trainGain(state) * TRAIN_GRADE_MULT[grade]));

  state.resources.action = clampAction(state, state.resources.action - COACH_TRAIN_ACTION_COST);
  state.resources.mental = clampMental(state, state.resources.mental - 8);
  job.teamStat = Math.min(COACH_STAT_TARGET, job.teamStat + gained);
  job.totalTrainings += 1;
  recordMission(state, "training");
  gainSkill(state, "fitness", 5);
  gainSkill(state, "sociability", 4);

  addSchedule(state, `배구부 훈련 지도 (완성도 +${gained})`, "system");
  return {
    message: DRILL_LINES[grade],
    grade,
    gained,
    strength: job.teamStat,
    target: COACH_STAT_TARGET,
  };
}

/**
 * 대회 날이면 대회를 치른다(하루 1회, `economy.applyDailyCosts`에서 호출).
 * 성적에 따라 월급 인상분이 영구히 붙고, 전국체전 우승분만 다음 해로 예약된다.
 */
export function maybeHoldMeet(state: GameState): void {
  const job = state.coachJob;
  if (!job || state.gameOver) return;
  if (!isMeetDay(state.day)) return;
  const mk = monthKey(state.day);
  if (job.lastMeetMonth === mk) return;
  job.lastMeetMonth = mk;

  const national = dateOf(state.day).getMonth() + 1 === NATIONAL_MEET_MONTH;
  // 대회를 치른 해를 남긴다 — 이듬해 2월 졸업생 모임의 전제다(systems/coachCamp.isAlumniDay).
  job.lastMeetYear = dateOf(state.day).getFullYear();
  const strength = teamStrength(state);
  const result = meetResultFor(strength, national);
  const label = MEET_LABEL[result];
  const meetName = national ? "전국체전" : "지역 대회";

  const raise = MEET_RAISE[result];
  if (raise > 0) job.raise += raise;

  let extra = "";
  if (national && result === "champion") {
    job.championships += 1;
    job.pendingRaise = NATIONAL_CHAMPION_RAISE;
    job.pendingRaiseYear = dateOf(state.day).getFullYear() + 1;
    extra = ` 내년부터 월급이 ${NATIONAL_CHAMPION_RAISE.toLocaleString("ko-KR")}원 더 오른다!`;
  }

  job.teamStat = 0; // 대회가 끝나면 완성도는 0에서 다시 쌓는다(시즌 리셋)
  addSchedule(
    state,
    `${meetName} ${label} (완성도 ${strength})` +
      (raise > 0 ? ` · 월급 +${raise.toLocaleString("ko-KR")}원` : "") +
      extra,
    "system",
  );
  pushKakao(state, COACH_SENDER, [
    `${meetName} 끝났습니다. 저희 ${label}입니다!`,
    result === "eliminated"
      ? "애들이 많이 아쉬워하네요. 다음 대회까지 훈련 더 붙여주시면 좋겠습니다."
      : `수고 많으셨습니다. 성적만큼 처우도 올려드리겠습니다.${extra}`,
  ], { hue: 205 });
}

/**
 * 코치 월급날(매월 20일). 예약된 전국체전 인상분은 **해가 바뀐 뒤 첫 월급날**에 합류한다.
 * `economy.applyDailyCosts`에서 호출된다.
 */
export function maybeCoachPayday(state: GameState): void {
  const job = state.coachJob;
  if (!job || state.gameOver) return;
  if (dateOfMonth(state.day) !== COACH_PAYDAY_DATE) return;
  const mk = monthKey(state.day);
  if (job.lastSalaryMonth === mk) return;
  job.lastSalaryMonth = mk;

  // 전국체전 우승분 반영 — 지급 '전에' 합류시켜야 그 해 첫 월급부터 오른 값이 나온다.
  if (job.pendingRaise > 0 && dateOf(state.day).getFullYear() >= job.pendingRaiseYear) {
    job.raise += job.pendingRaise;
    addSchedule(
      state,
      `전국체전 우승 인상분 반영 (+${job.pendingRaise.toLocaleString("ko-KR")}원)`,
      "system",
    );
    job.pendingRaise = 0;
    job.pendingRaiseYear = -1;
  }

  const salary = coachSalaryOf(state);
  state.money += salary;
  addSchedule(state, `배구부 코치 월급 +${salary.toLocaleString("ko-KR")}원`, "system");
}
