import type { GameState } from "@/core/types";
import type { EbsLecture } from "@/data/ebs";
import { SKILL_STATS } from "@/data/stats";
import { gainSkill, clampAction } from "@/systems/stats";
import { gainPerformance } from "@/systems/employment";
import { addSchedule } from "@/systems/time";

/** 강의 1편 시청 비용(원). */
export const LECTURE_COST = 3000;
/** 강의 1편 시청에 드는 행동력. */
export const LECTURE_ACTION_COST = 8;

export type WatchGate = "ok" | "poor" | "noaction" | "nojob";

export function canWatchLecture(state: GameState, lec: EbsLecture): WatchGate {
  if (state.money < LECTURE_COST) return "poor";
  if (state.resources.action < LECTURE_ACTION_COST) return "noaction";
  if (lec.stat === "performance" && !state.employment) return "nojob";
  return "ok";
}

/**
 * 강의를 시청한다. 게이트를 통과하면 비용(3,000원 + 행동력 8)을 차감하고
 * 스탯을 올린다. 사이트 브라우징이므로 시간(슬롯)은 소모하지 않는다.
 */
export function watchLecture(
  state: GameState,
  lec: EbsLecture,
): { ok: boolean; label: string } {
  if (canWatchLecture(state, lec) !== "ok") return { ok: false, label: "" };

  state.money -= LECTURE_COST;
  state.resources.action = clampAction(
    state,
    state.resources.action - LECTURE_ACTION_COST,
  );

  let statLabel: string;
  if (lec.stat === "performance") {
    gainPerformance(state, lec.amount);
    statLabel = "업무 성과";
  } else {
    gainSkill(state, lec.stat, lec.amount);
    statLabel = SKILL_STATS[lec.stat].label;
  }

  addSchedule(state, `EBS 강의 수강: ${lec.title}`, "offline");
  return { ok: true, label: `${statLabel} +${lec.amount}` };
}
