import type { GameState, SkillStatId } from "@/core/types";
import type { HoopPrize } from "@/data/basketball";
import { HOOP_PRIZES } from "@/data/basketball";
import { SKILL_STATS } from "@/data/stats";
import { clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";

/**
 * 오락실 농구 슛 규칙.
 *
 * ⚠️ **득점은 물리가 정한다**(ui/hoopScene.ts). 여기는 비용 지불과 최종 점수 정산만 한다 —
 *    인형뽑기(systems/arcade.ts)와 같은 역할 분담이다.
 *
 * ⚠️ 진행 상태(현재 점수·남은 시간)는 씬 지역 변수다. GameState에 두지 않는다 —
 *    한 판에 끝나는 세션이고 중간 복원이 필요 없다.
 *
 * 순수 로직: DOM/표시 없음.
 */

/** 1판 비용(원) */
export const HOOP_COST = 1_000;

/** 한 판 제한시간(ms) */
export const HOOP_DURATION_MS = 30_000;

/** 1판 값을 낸다. 소지금이 모자라면 아무 일도 하지 않고 false. */
export function payHoop(state: GameState): boolean {
  if (state.money < HOOP_COST) return false;
  state.money -= HOOP_COST;
  return true;
}

/**
 * 점수에 해당하는 상품 구간.
 * ⚠️ HOOP_PRIZES는 내림차순이라 첫 일치가 정답이다. 맨 아래(minScore 0)가 폴백이므로
 *    어떤 점수에도 반드시 하나는 잡힌다.
 */
export function prizeFor(score: number): HoopPrize {
  return (
    HOOP_PRIZES.find((p) => score >= p.minScore) ?? HOOP_PRIZES[HOOP_PRIZES.length - 1]
  );
}

/** 한 판 정산 결과 */
export interface HoopResult {
  /** 이번 판 득점 */
  score: number;
  /** 적용된 상품 구간 */
  prize: HoopPrize;
  /** 실제로 오른 스탯(감쇠·상한 반영) */
  skillGains: { label: string; delta: number }[];
  /** 신기록이었는지 */
  isBest: boolean;
  /** 갱신 후 최고 기록 */
  best: number;
}

/**
 * 제한시간이 끝난 뒤 한 판을 정산한다.
 * 점수 구간에 따라 상금·스탯·정신력을 주고 최고 기록을 갱신한다.
 */
export function finishHoop(state: GameState, score: number): HoopResult {
  const prize = prizeFor(score);

  if (prize.money > 0) state.money += prize.money;
  if (prize.mental > 0) {
    state.resources.mental = clampResource(state.resources.mental + prize.mental);
  }

  // 라벨은 화면에 그대로 뜨므로 한글 표시명을 쓴다(스탯 id를 노출하면 안 된다).
  const skillGains: { label: string; delta: number }[] = [];
  for (const [key, amount] of Object.entries(prize.skillGains)) {
    const id = key as SkillStatId;
    const delta = gainSkill(state, id, amount ?? 0);
    if (delta !== 0) skillGains.push({ label: SKILL_STATS[id].label, delta });
  }

  const prevBest = state.hoopBest ?? 0;
  const isBest = score > prevBest;
  if (isBest) state.hoopBest = score;

  addSchedule(state, `오락실 농구: ${score}골 (${prize.label})`, "system");
  if (isBest) addSchedule(state, `🏀 농구 최고 기록 신기록: ${score}골`, "system");

  return { score, prize, skillGains, isBest, best: state.hoopBest ?? score };
}
