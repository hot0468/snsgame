import type { GameState } from "@/core/types";
import type { EbsLecture } from "@/data/ebs";
import { EBS_LECTURES } from "@/data/ebs";
import { SKILL_STATS } from "@/data/stats";
import { gainSkill, clampAction } from "@/systems/stats";
import { gainPerformance } from "@/systems/employment";
import { addSchedule } from "@/systems/time";
import { hashInt } from "@/utils/random";

/** 강의 1편 시청 비용(원). */
export const LECTURE_COST = 3000;
/** 강의 1편 시청에 드는 행동력. */
export const LECTURE_ACTION_COST = 8;

/** 무료 강의 후보 — 업무 성과(재직 전용)는 제외해 무직이어도 항상 수강 가능하게 한다. */
const FREE_POOL = EBS_LECTURES.filter((l) => l.stat !== "performance");

/**
 * 오늘의 무료 강의 id — day 시드로 결정론적으로 하나 고른다(매일 바뀜, 렌더마다 안 튐).
 * 매일 이 강의 한 편은 소지금 없이(행동력만) 수강할 수 있다(하루 1회).
 */
export function freeLectureIdToday(state: GameState): string {
  if (FREE_POOL.length === 0) return "";
  return FREE_POOL[hashInt(`ebsFree:${state.day}`) % FREE_POOL.length].id;
}

/** 이 강의가 '오늘의 무료 강의'이고 아직 오늘 무료 수강을 안 썼는지. */
export function isFreeLectureToday(state: GameState, lec: EbsLecture): boolean {
  return lec.id === freeLectureIdToday(state) && state.ebsFreeWatchedDay !== state.day;
}

export type WatchGate = "ok" | "poor" | "noaction" | "nojob";

export function canWatchLecture(state: GameState, lec: EbsLecture): WatchGate {
  // 오늘의 무료 강의(미사용)면 소지금 검사를 건너뛴다 — 행동력·재직 조건은 그대로.
  if (!isFreeLectureToday(state, lec) && state.money < LECTURE_COST) return "poor";
  if (state.resources.action < LECTURE_ACTION_COST) return "noaction";
  if (lec.stat === "performance" && !state.employment) return "nojob";
  return "ok";
}

/**
 * 강의를 시청한다. 게이트를 통과하면 비용(3,000원 + 행동력 8)을 차감하고
 * 스탯을 올린다. 사이트 브라우징이므로 시간(슬롯)은 소모하지 않는다.
 * 단, '오늘의 무료 강의'는 소지금을 받지 않고 하루 1회 무료 수강으로 처리한다.
 */
export function watchLecture(
  state: GameState,
  lec: EbsLecture,
): { ok: boolean; label: string } {
  if (canWatchLecture(state, lec) !== "ok") return { ok: false, label: "" };

  if (isFreeLectureToday(state, lec)) {
    state.ebsFreeWatchedDay = state.day; // 오늘 무료 수강 소진
  } else {
    state.money -= LECTURE_COST;
  }
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
