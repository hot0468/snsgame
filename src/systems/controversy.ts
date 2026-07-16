import type { GameState } from "@/core/types";
import { CONTROVERSY_EVENTS } from "@/data/controversies";
import { chance, pick } from "@/utils/random";

/**
 * 논란/박제 발생 로직.
 * 사기·성인·저평판 상태의 트윗 직후 확률적으로 논란을 터뜨린다(강제 팝업).
 */

/** 평판이 이 값 미만이면 일반 트윗도 논란 위험이 생긴다 */
export const CONTROVERSY_REP_THRESHOLD = 45;

/**
 * 논란 발생을 시도한다. 성공하면 state.pendingControversy에 시나리오 id를 세운다.
 * 이미 논란이 걸려 있거나 정지 상태면 발생하지 않는다.
 * @returns 발생했으면 true
 */
export function rollControversy(state: GameState, probability: number): boolean {
  if (state.pendingControversy) return false;
  if (probability <= 0 || !chance(probability)) return false;
  // condition을 만족하는 시나리오만 후보(성인 논란은 성인 계정에서만).
  const candidates = CONTROVERSY_EVENTS.filter((e) => e.condition?.(state) ?? true);
  if (candidates.length === 0) return false;
  state.pendingControversy = pick(candidates).id;
  return true;
}
