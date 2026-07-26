import { MAX_RESOURCE, MAX_SKILL } from "@/data/stats";
import type { GameState, SkillStatId } from "@/core/types";

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
 * 행동력이 비용 이상이라 그 행동을 할 수 있는지.
 * clampAction이 0에서 바닥을 치므로 비용보다 모자라면 '행동력이 마이너스로 내려가는' 대신 조용히
 * 0으로 깎이며 행동만 수행된다 — 그걸 막으려면 UI/시스템이 실행 전 이 게이트로 걸러야 한다.
 */
export function hasAction(state: GameState, cost: number): boolean {
  return state.resources.action >= cost;
}

/** 체력 한계치(staminaMax)의 하드 실링 — 운동으로도 이 값을 넘지 못한다. */
export const STAMINA_MAX_CAP = 999;

/**
 * 체력 클램프(0 ~ state.staminaMax). 상한이 가변이라 상태를 인자로 받는다(clampAction과 같은 이유).
 * ⚠️ staminaMax가 0이면 항상 0으로 눌린다 — save.sanitize가 200 폴백을 보장한다.
 */
export function clampStamina(state: GameState, v: number): number {
  return Math.max(0, Math.min(state.staminaMax, Math.round(v)));
}

/** 체력을 n만큼 가감한다(음수도 clamp). */
export function gainStamina(state: GameState, n: number): void {
  state.stamina = clampStamina(state, state.stamina + n);
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

/**
 * 반복 grind 소스의 스킬 상승 감쇠 계수. 스킬이 높을수록 획득이 줄어
 * 능동 플레이 만렙 도달을 2달→~5달대로 늦춘다. content-author가 미세조정한다.
 */
export const SKILL_GAIN_DECAY = 0.8;

/**
 * 스킬 획득 공용 헬퍼 — 반복 소스(오프라인 활동·AV 촬영·사바나·정기런·이벤트 등)의
 * 스킬 상승을 여기로 라우팅해 상단 감쇠를 한 지점에서 건다.
 * `eff = amount * (1 - SKILL_GAIN_DECAY * skill/MAX_SKILL)` 후 clampSkill로 저장.
 * ⚠️ 감쇠는 **획득(양수)에만** 건다 — 음수(페널티/드롭)는 그대로 통과시켜
 *    스킬이 높을수록 페널티가 약해지는 역효과를 막는다.
 * @returns 실제 반영된 델타(상한 clamp·감쇠 후).
 */
export function gainSkill(state: GameState, key: SkillStatId, amount: number): number {
  const before = state.skills[key];
  const eff = amount > 0 ? amount * (1 - SKILL_GAIN_DECAY * (before / MAX_SKILL)) : amount;
  state.skills[key] = clampSkill(before + Math.round(eff));
  return state.skills[key] - before;
}
