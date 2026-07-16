import { MAX_RESOURCE, MAX_SKILL } from "@/data/stats";

/**
 * 스탯 클램프 단일 출처.
 *
 * 스킬(0~999)과 리소스(0~100)는 상한이 다르므로 반드시 함수를 구분해 쓴다.
 * - `state.skills.*`    → clampSkill
 * - `state.resources.*` → clampResource
 *
 * ⚠️ 둘 다 `number → number`라 오분류를 타입 검사가 잡지 못한다.
 *    스킬에 clampResource를 쓰면 100에서 조용히 막히고,
 *    리소스에 clampSkill을 쓰면 평판·도덕성이 999까지 올라 임계값 판정이 깨진다.
 */

/** 스킬 값 클램프(0~999) */
export function clampSkill(v: number): number {
  return Math.max(0, Math.min(MAX_SKILL, v));
}

/** 리소스 값 클램프(0~100) */
export function clampResource(v: number): number {
  return Math.max(0, Math.min(MAX_RESOURCE, v));
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
