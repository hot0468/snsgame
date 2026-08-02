import type { CallCenterJob, GameState } from "@/core/types";
import {
  CALL_BASE_PAY,
  CALL_LINES,
  CALL_MAX_STREAK,
  CALL_MENTAL_ACCEL,
  CALL_MENTAL_BASE,
  CALL_MENTAL_FLOOR,
  CALL_STREAK_BONUS,
  type CallLine,
} from "@/data/callCenter";
import { hasAnyJob, inJobGap, quitCurrentJob } from "./employment";
import { JOB_ID, markJobExperienced, pastJobCareer } from "./jobExperience";
import { clampMental, gainSkill } from "./stats";
import { recordMission } from "./missions";
import { maybeQueueJobScene } from "./jobAdult";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 콜센터 상담원직.
 *
 * - **진입**: 자격 조건이 없다. 누구나 오늘 시작할 수 있는 유일한 직업이다.
 * - **근무**: 현생 살기 → 일 → [상담 시작]. 자리에 앉으면 콜을 **연속으로** 받는다.
 * - **수입**: 콜당 수당. 연속으로 받을수록 단가가 오른다(CALL_STREAK_BONUS).
 * - **대가**: 콜마다 정신력이 깎이고, 그 소모가 **가속한다**(CALL_MENTAL_ACCEL).
 *   정신력은 육성 효율의 단일 축이라(`stats.mentalEfficiency` 0.4~1.25배)
 *   "오늘 번 돈"과 "내일 스탯이 오르는 속도"를 맞바꾸는 셈이다.
 *
 * ⚠️ 이 직업의 결정은 **"한 콜 더 받을까"** 하나뿐이다. 택시가 응대를 고르게 한다면
 *    여기선 고를 게 없다 — 상담원은 콜을 고르지 못한다. 그게 두 직업이 갈리는 지점이다.
 */

/** 자격 조건이 없다 — 이미 상담원이거나 경력 공백 중인 경우만 막는다. */
export function canApplyCallCenter(state: GameState): boolean {
  return !state.gameOver && !state.callCenterJob && !inJobGap(state);
}

/**
 * 입사. 겸직은 안 되므로 기존 직업을 정리하고 들어간다
 * (되돌릴 수 없으니 **호출부가 먼저 확인을 받아야 한다**).
 */
export function joinCallCenter(state: GameState): CallCenterJob | null {
  if (!canApplyCallCenter(state)) return null;
  if (hasAnyJob(state)) quitCurrentJob(state);
  // 누적 통화 수가 곧 레벨이라, 재입사해도 경력을 이어받는다(jobExperience.pastJobCareer).
  state.callCenterJob = {
    hiredDay: state.day,
    totalCalls: pastJobCareer(state, JOB_ID.callCenter),
    totalEarned: 0,
    bestStreak: 0,
  };
  markJobExperienced(state, JOB_ID.callCenter);
  addSchedule(state, "한소리고객센터 입사", "system");
  return state.callCenterJob;
}

/** 콜센터 퇴사 — `employment.quitCurrentJob`과 짝(문구를 그쪽과 같게 유지할 것). */
export function quitCallCenter(state: GameState): void {
  if (!state.callCenterJob) return;
  state.callCenterJob = null;
  addSchedule(state, "한소리고객센터 퇴사", "system");
}

/* ─────────────────── 한 콜 ─────────────────── */

/** n번째 콜(1부터)의 정신력 소모량(양수). 받을수록 가속한다. */
export function callMentalCost(streak: number): number {
  const n = Math.max(1, streak);
  return Math.round(CALL_MENTAL_BASE + (n - 1) * CALL_MENTAL_ACCEL);
}

/** n번째 콜(1부터)의 수당(콜 고유 배율 전). 오래 앉을수록 단가가 오른다. */
export function callPay(streak: number): number {
  const n = Math.max(1, streak);
  return Math.round(CALL_BASE_PAY * (1 + (n - 1) * CALL_STREAK_BONUS));
}

/**
 * 지금 콜을 하나 더 받을 수 있는지.
 * 정신력이 다음 콜 소모를 감당하고 **하한(CALL_MENTAL_FLOOR)까지 남아야** 한다 —
 * 0으로 퇴근시키면 우울 모드에 갇혀 다음 날이 통째로 망가진다.
 */
export function canTakeCall(state: GameState, nextStreak: number): boolean {
  if (!state.callCenterJob || state.gameOver) return false;
  if (nextStreak > CALL_MAX_STREAK) return false;
  return state.resources.mental - callMentalCost(nextStreak) >= CALL_MENTAL_FLOOR;
}

/** 다음 콜을 뽑는다. **상태를 바꾸지 않는다** — ui가 보여준 뒤 takeCall을 부른다. */
export function rollCall(): CallLine {
  return pick(CALL_LINES as CallLine[]);
}

export interface CallResult {
  /** 이번 콜 수당(원) */
  pay: number;
  /** 실제로 깎인 정신력(음수) */
  mentalDelta: number;
  /** 이번 콜 포함 연속 콜 수 */
  streak: number;
  /** 이 콜을 끝내고 하나 더 받을 수 있는지 */
  canContinue: boolean;
}

/**
 * 콜 1건을 처리한다. **행동력과 시간(슬롯) 소모는 호출부가 자리에 앉을 때 한 번만** 처리한다 —
 * 여기서는 콜 단위의 수당·정신력만 만진다.
 */
export function takeCall(state: GameState, line: CallLine, streak: number): CallResult | null {
  const job = state.callCenterJob;
  if (!job) return null;

  const pay = Math.round(callPay(streak) * (line.payMul ?? 1));
  const before = state.resources.mental;
  // 누적 가속 소모 + 콜 고유 증감(thanks 같은 콜은 오히려 +다).
  state.resources.mental = clampMental(state, before - callMentalCost(streak) + (line.mental ?? 0));
  const mentalDelta = state.resources.mental - before;

  state.money += pay;
  job.totalCalls += 1;
  job.totalEarned += pay;
  if (streak > job.bestStreak) job.bestStreak = streak;

  gainSkill(state, "sociability", line.sociability ?? 3);
  maybeQueueJobScene(state, "callCenter");
  recordMission(state, "call"); // 도전과제: 콜 카운트

  return { pay, mentalDelta, streak, canContinue: canTakeCall(state, streak + 1) };
}

/** 자리에서 일어날 때 — 그날 번 돈을 일정에 남긴다. */
export function endShift(state: GameState, calls: number, earned: number): void {
  if (calls <= 0) return;
  addSchedule(state, `콜센터 상담 ${calls}건 (+${earned.toLocaleString("ko-KR")}원)`, "offline");
}
