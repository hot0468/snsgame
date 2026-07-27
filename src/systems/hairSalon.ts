import type { GameState } from "@/core/types";
import type { HairGrade } from "@/data/hairSalon";
import { TALK_RESULTS, TIMING_RESULTS } from "@/data/hairSalon";
import { pick } from "@/utils/random";
import { clampAction, clampResource, gainSkill, hasAction } from "./stats";
import { advanceTime, addSchedule } from "./time";

/**
 * 미용실 — 미니게임 2종(타이밍 게이지 / 대화 견디기)의 규칙과 보상.
 * 미니게임 진행 자체는 UI가 하고, 여기서는 **등급을 받아 결과를 확정**한다.
 *
 * ⚠️ 비용·행동력·시간은 **결과를 확정할 때 한 번에** 나간다(입장 시점이 아니라).
 *    중간에 창을 닫으면 아무 일도 없었던 게 되게 하려는 것이다 — 결제 후 창이 닫히면
 *    돈만 날아간 것처럼 보인다.
 */

/** 미용실 1회 비용 */
export const SALON_COST = 35_000;
/** 미용실 1회 행동력 소모 */
export const SALON_ACTION = 12;

/** 등급별 미용 변동(0~999 스케일 · ×5 관례). 망하면 깎인다. */
export const SALON_BEAUTY: Record<HairGrade, number> = {
  perfect: 45,
  good: 14,
  bad: -8,
};
/** 등급별 정신력 변동(0~100 스케일 — ×5 하지 않는다) */
export const SALON_MENTAL: Record<HairGrade, number> = {
  perfect: 8,
  good: 2,
  bad: -10,
};

/** 지금 미용실에 갈 수 있는지(소지금·행동력). UI 버튼 게이트가 쓴다. */
export function canVisitSalon(state: GameState): boolean {
  return state.money >= SALON_COST && hasAction(state, SALON_ACTION);
}

/** 어떤 미니게임이 나올지 — 두 종이 랜덤으로 번갈아 나온다(입장할 때 1회 결정). */
export function pickSalonGame(): "timing" | "talk" {
  return Math.random() < 0.5 ? "timing" : "talk";
}

/** 대화 미니게임의 누적 점수(0~6)를 등급으로 환산한다. */
export function talkGrade(score: number): HairGrade {
  if (score >= 5) return "perfect";
  if (score >= 3) return "good";
  return "bad";
}

export interface SalonOutcome {
  grade: HairGrade;
  message: string;
  /** 실제 반영된 미용 변동(감쇠·상한 반영) */
  beauty: number;
  mental: number;
}

/**
 * 미니게임 결과를 확정한다 — 비용·행동력을 치르고 보상을 반영한 뒤 시간을 1블록 진행한다.
 * @param game 어느 미니게임이었는지(결과 문구가 갈린다)
 */
export function applyHairResult(
  state: GameState,
  game: "timing" | "talk",
  grade: HairGrade,
): SalonOutcome {
  state.money -= SALON_COST;
  // ⚠️ 행동력은 상한이 가변(치트 +20)이라 clampResource가 아니라 clampAction이어야 한다.
  state.resources.action = clampAction(state, state.resources.action - SALON_ACTION);

  const beauty = gainSkill(state, "beauty", SALON_BEAUTY[grade]);
  const mentalBefore = state.resources.mental;
  state.resources.mental = clampResource(state.resources.mental + SALON_MENTAL[grade]);

  const message = pick(game === "timing" ? TIMING_RESULTS[grade] : TALK_RESULTS[grade]);
  addSchedule(state, grade === "bad" ? "미용실 (망함)" : "미용실", "offline");
  advanceTime(state, 1);
  return { grade, message, beauty, mental: state.resources.mental - mentalBefore };
}
