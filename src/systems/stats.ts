import { MAX_RESOURCE, MAX_SKILL } from "@/data/stats";
import type { GameState } from "@/core/types";

/**
 * 스탯 클램프 단일 출처.
 *
 * 상한이 셋으로 갈리므로 반드시 함수를 구분해 쓴다.
 * - `state.skills.*`               → clampSkill      (0~999, 고정)
 * - `state.resources.action`       → clampAction     (0~100+actionMaxBonus, **가변**)
 * - 그 외 `state.resources.*`      → clampResource   (0~100, 고정)
 *   (= mental · morality · reputation)
 *
 * ⚠️ 셋 다 사실상 `number → number`라 오분류를 타입 검사가 잡지 못한다:
 *    - 스킬에 clampResource를 쓰면 100에서 조용히 막힌다.
 *    - 리소스에 clampSkill을 쓰면 평판·도덕성이 999까지 올라 임계값 판정이 깨진다.
 *    - **행동력에 clampResource를 쓰면 상한 보너스가 조용히 무효가 된다**:
 *      행동력 120에서 근무(15 소모) → clampResource(105) → 100. 플레이어는 이유를 알 수 없다.
 *      행동력을 건드리는 곳에서 clampResource가 보이면 그건 버그다.
 */

/** 스킬 값 클램프(0~999) */
export function clampSkill(v: number): number {
  return Math.max(0, Math.min(MAX_SKILL, v));
}

/**
 * 상한이 고정 100인 리소스(정신력·도덕성·평판) 클램프.
 * ⚠️ **행동력에는 쓰지 마라** — 상한이 가변이다. clampAction을 쓸 것.
 */
export function clampResource(v: number): number {
  return Math.max(0, Math.min(MAX_RESOURCE, v));
}

/**
 * 행동력의 현재 상한. 기본 100이며 작업관리자 Cheat.exe로 +20 된다(게임당 1회).
 * UI의 행동력 바 상한도 RESOURCE_STATS.action.max가 아니라 이 값을 써야 한다.
 */
export function actionMax(state: GameState): number {
  return MAX_RESOURCE + state.actionMaxBonus;
}

/**
 * 행동력 전용 클램프(0 ~ actionMax(state)).
 * 리소스 4종 중 행동력만 상한이 가변이라 상태를 인자로 받는다.
 */
export function clampAction(state: GameState, v: number): number {
  return Math.max(0, Math.min(actionMax(state), v));
}

/**
 * 스킬 0~999 값을 구 0~100 스케일로 환산하는 제수(9.99).
 * 스킬 상한이 100이던 시절의 계수·공식을 그대로 쓰되 밸런스를 보존할 때 나눈다.
 */
export const SKILL_SCALE = MAX_SKILL / 100;

/**
 * 스킬 값(0~999)을 0~100 지수로 환산한다.
 * 스킬 만렙(999) → 100. 0~100 기준으로 설계된 파생 지표
 * (취업 역량·매력 등)와 데이터 임계값을 그대로 유지하기 위한 다리.
 */
export function skillTo100(v: number): number {
  return v / SKILL_SCALE;
}
