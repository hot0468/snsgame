import type { CompanyTier, GameState } from "@/core/types";
import { SLOTS_PER_DAY } from "@/core/state";
import { WORK_MSG_POOL } from "@/data/workMessages";
import { chance, pick, uid } from "@/utils/random";
import { dayOfWeek } from "./calendar";
import { gainPerformance } from "./employment";
import { clampAction, clampResource } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 업무 메신저 "너아무튼온".
 * 회사에 재직(state.employment) 중이면 평일 낮·심야, 주말에 업무 요청 메시지가 온다.
 * 수락하면 타임블록 1개 소모 · 성과↑ · 정신력·행동력 크게↓.
 *
 * 순환 참조: time.ts가 maybeSpawnWorkMsg를, 여기가 time.ts의 advanceTime/addSchedule를 import한다.
 * 기존 employment↔time과 동일 패턴 — 참조가 전부 함수 본문 안이라 모듈 평가 시점엔 안 걸린다.
 */

/** 수락 시 성과 상승(일반 근무 +7보다 큼 — 야근 크런치) */
export const WORK_MSG_PERF = 12;
/** 수락 시 정신력 감소(크게) */
export const WORK_MSG_MENTAL = 18;
/** 수락 시 행동력 감소(크게) */
export const WORK_MSG_ACTION = 22;
/** 평일 자격 슬롯 전환마다 업무 요청이 뜰 확률 */
export const WORK_MSG_CHANCE = 0.4;

/**
 * 주말 업무 요청 확률(슬롯 전환마다) — 규모가 작을수록 워라밸이 없어 주말 호출이 잦다.
 * 대기업 < 중견 < 중소 < 극소 순으로 높아진다(overtimeRate와 같은 방향).
 */
export const WORK_MSG_WEEKEND_CHANCE: Record<CompanyTier, number> = {
  large: 0.2,
  medium: 0.35,
  small: 0.5,
  micro: 0.65,
};

/** 미해결(수락 대기) 업무 요청이 하나라도 있는지 — 배지·중복 스폰 가드용 */
export function hasPendingWorkMsg(state: GameState): boolean {
  return state.workMsgs.some((m) => !m.resolved);
}

/** 미해결 업무 요청 수 */
export function unreadWorkMsgCount(state: GameState): number {
  return state.workMsgs.filter((m) => !m.resolved).length;
}

/** 지금 업무를 수락할 여유(남은 블록)가 있는지 */
export function canAcceptWork(state: GameState): boolean {
  return !state.gameOver && SLOTS_PER_DAY - state.slot > 0;
}

/**
 * 슬롯 전환마다 1회 호출(advanceTime 루프 내). 자격 충족 + 확률 통과 시 업무 요청을 하나 띄운다.
 * - 회사 재직 중이 아니면(부업 avJob/savanna 무관) 아무 일도 없다.
 * - 이미 미해결 요청이 있으면 한 번에 하나만 — 스폰하지 않는다.
 * - 자격: 평일(월~금) 낮·심야  ||  주말(토·일) 아무 슬롯.
 *   (3→2슬롯 축소로 구 '저녁'이 낮에 합쳐져, 평일은 두 슬롯 모두 자격이 됐다.
 *    weekend/weekday 구분은 재직 요일 판정 훅으로 남겨두되, 슬롯 필터는 사라졌다.)
 */
export function maybeSpawnWorkMsg(state: GameState): void {
  if (!state.employment) return;
  if (hasPendingWorkMsg(state)) return;

  const dow = dayOfWeek(state.day);
  const weekend = dow === 0 || dow === 6;
  const weekday = dow >= 1 && dow <= 5;
  if (!weekend && !weekday) return;

  // 주말은 회사 규모별 확률, 평일은 공통 확률.
  const p = weekend ? WORK_MSG_WEEKEND_CHANCE[state.employment.tier] : WORK_MSG_CHANCE;
  if (!chance(p)) return;

  state.workMsgs.push({
    id: uid("wmsg"),
    day: state.day,
    slot: state.slot,
    text: pick(WORK_MSG_POOL),
    toastPending: true,
    resolved: false,
  });
}

/**
 * 업무 요청을 수락한다. 성과가 오르고 정신력·행동력이 크게 깎이며 타임블록 1개를 쓴다.
 * @returns 실제로 처리했으면 true. (없는/이미 처리한 요청, 블록 없음, 퇴사 후엔 false)
 */
export function acceptWorkMsg(state: GameState, id: string): boolean {
  const m = state.workMsgs.find((x) => x.id === id);
  if (!m || m.resolved) return false;
  if (!canAcceptWork(state)) return false;
  // 요청 스폰 후 퇴사했으면 성과 귀속처가 없다 — gainPerformance가 employment! 를 쓰므로 가드.
  if (!state.employment) return false;

  gainPerformance(state, WORK_MSG_PERF);
  state.resources.mental = clampResource(state.resources.mental - WORK_MSG_MENTAL);
  state.resources.action = clampAction(state, state.resources.action - WORK_MSG_ACTION);
  advanceTime(state, 1); // 블록 소모(심야 전환 시 취침 팝업 등 자연 발생)
  m.resolved = true;
  addSchedule(state, "야근: 업무 요청 처리", "system");
  return true;
}
