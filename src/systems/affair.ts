import type { GameState } from "@/core/types";
import { LATE_SLOT, getActiveAccount } from "@/core/state";
import {
  AFFAIR_CAUGHT_AT,
  AFFAIR_ENDED_LINES,
  AFFAIR_GAMEOVER,
  AFFAIR_SCENES,
  type AffairMeetScene,
} from "@/data/affair";
import { addAppointment } from "./appointments";
import { changeFollowers } from "./followers";
import { clampMental, clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 유부남 외도 루트 — DM 만남에서 시작해 **게임 오버로 끝나는 단일 서사**.
 *
 * 입구는 만남 시나리오(`data/meetings.ts`의 `affair_married_man`)의 '따라간다' 선택이다.
 * 그 선택의 `customKey: "startAffair"`가 여기 `startAffair`를 부른다.
 *
 * ⚠️ **매주 빠져나올 문을 연다.** 약속이 도래할 때마다 만날지 묻고, 안 만난다고 하면
 *    그 자리에서 관계가 끝난다(게임은 계속). 빠져나올 수 있는데도 안 나가는 선택이
 *    결말을 만드는 게 이 서사의 축이다 — 확인을 없애면 그냥 함정이 된다.
 *
 * ⚠️ **한 번만 굴러간다.** 이미 진행 중이거나 이미 끝낸 적 있으면 다시 시작되지 않는다.
 */

/** 다음 만남까지 걸리는 날(매주 같은 요일). */
export const AFFAIR_INTERVAL_DAYS = 7;
/** 만남 1회 행동력 소모 — 다른 심야 정기 일정과 같은 급으로 맞춘다. */
export const AFFAIR_ACTION_COST = 12;

/** 지금 외도가 굴러가는 중인지. */
export function hasAffair(state: GameState): boolean {
  return state.affair !== null;
}

/**
 * 외도를 시작한다(만남 시나리오의 '따라간다'가 부른다).
 *
 * 첫 만남은 **일주일 뒤** 같은 요일이다 — 그가 "매주 이 요일"이라고 못 박은 그대로다.
 * @returns 실제로 시작했으면 true
 */
export function startAffair(state: GameState): boolean {
  if (state.gameOver || state.affair) return false;
  const day = state.day + AFFAIR_INTERVAL_DAYS;
  state.affair = { meetCount: 0, nextDay: day };
  addAppointment(state, {
    day,
    slot: LATE_SLOT,
    kind: "affair",
    title: "그 사람과의 약속",
  });
  addSchedule(state, "매주 같은 요일 약속이 생겼다", "system");
  return true;
}

/** 이번 회차(1부터)에 해당하는 씬. 회차가 넘치면 마지막(발각) 씬. */
export function affairSceneFor(count: number): AffairMeetScene {
  const i = Math.min(Math.max(count, 1), AFFAIR_SCENES.length) - 1;
  return AFFAIR_SCENES[i];
}

/** 다음 주 같은 요일 약속을 다시 잡는다. */
function scheduleNextAffair(state: GameState): void {
  const affair = state.affair;
  if (!affair) return;
  affair.nextDay = state.day + AFFAIR_INTERVAL_DAYS;
  addAppointment(state, {
    day: affair.nextDay,
    slot: LATE_SLOT,
    kind: "affair",
    title: "그 사람과의 약속",
  });
}

/** 관계를 끊는다 — 남은 약속을 지우고 상태를 비운다. */
export function endAffair(state: GameState): string {
  state.appointments = state.appointments.filter((a) => a.kind !== "affair");
  state.affair = null;
  addSchedule(state, "그 사람과의 관계를 끊었다", "system");
  return pick(AFFAIR_ENDED_LINES as string[]);
}

export interface AffairMeetResult {
  scene: AffairMeetScene;
  /** 이번이 몇 번째 만남인지(1부터) */
  count: number;
  /** 아내에게 들켜 게임이 끝났는지 */
  caught: boolean;
}

/**
 * 약속에 나간다 — 회차를 올리고 그 회차의 씬을 겪는다.
 *
 * ⚠️ **AFFAIR_CAUGHT_AT번째면 게임 오버다.** 그때는 다음 약속을 잡지 않는다.
 * ⚠️ 멱등하지 않다(회차가 오른다) — ui가 '간다'를 한 번만 누르게 해야 한다.
 */
export function goAffairMeet(state: GameState): AffairMeetResult | null {
  const affair = state.affair;
  if (!affair || state.gameOver) return null;

  // 이번 회차의 약속은 소비한다(안 지우면 같은 날 다시 뜬다).
  state.appointments = state.appointments.filter((a) => a.kind !== "affair");
  affair.meetCount += 1;
  const count = affair.meetCount;
  const scene = affairSceneFor(count);

  gainSkill(state, "lewd", scene.lewdGain);
  state.resources.morality = clampResource(state.resources.morality + scene.moralityDelta);
  state.resources.mental = clampMental(state, state.resources.mental + scene.mentalDelta);
  if (scene.money) state.money += scene.money;
  addSchedule(state, `${scene.title.replace("🔞 ", "")}`, "offline");

  if (count >= AFFAIR_CAUGHT_AT) {
    // 발각 — 팔로워가 통째로 날아가고 게임이 끝난다.
    changeFollowers(state, -getActiveAccount(state).followers);
    state.resources.reputation = 0;
    state.affair = null;
    state.gameOver = AFFAIR_GAMEOVER;
    addSchedule(state, "외도 발각 — 모든 것이 끝났다", "sns");
    return { scene, count, caught: true };
  }

  scheduleNextAffair(state);
  return { scene, count, caught: false };
}
