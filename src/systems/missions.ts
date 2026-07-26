/**
 * 일일/주간 도전과제 — 리셋·진행 누적·보상 지급.
 * 정의·추첨(순수)은 data/missions.ts, UI는 missionsModal이 호출한다.
 *
 * recordMission은 각 행동이 확정되는 systems 지점(postTweet·onLikeTweet·onRetweet·
 * followAccount·doOffline)에서 불린다 — UI가 아니라 규칙 계층에서 세어 세이브 정합을 지킨다.
 */
import type { GameState, MissionInstance } from "@/core/types";
import {
  rollDaily,
  rollWeekly,
  currentWeek,
  missionDef,
  type MissionMetric,
  type MissionReward,
} from "@/data/missions";
import { clampAction, clampResource, gainSkill } from "./stats";
import { changeFollowers } from "./followers";

/** 날짜/주차가 바뀌었으면 해당 미션 세트를 다시 굴린다(onNewDay·세이브 마이그레이션에서 호출). */
export function ensureMissions(state: GameState): void {
  if (state.missions.day !== state.day) {
    state.missions.daily = rollDaily(state.day);
    state.missions.day = state.day;
  }
  const wk = currentWeek(state.day);
  if (state.missions.week !== wk) {
    state.missions.weekly = rollWeekly(wk);
    state.missions.week = wk;
  }
}

/** 해당 metric의 미완료 미션 진행도를 n만큼 올린다(일일·주간 동시). goal에서 멈춘다. */
export function recordMission(state: GameState, metric: MissionMetric, n = 1): void {
  const bump = (list: MissionInstance[]) => {
    for (const inst of list) {
      const def = missionDef(inst.id);
      if (def && def.metric === metric && inst.progress < def.goal) {
        inst.progress = Math.min(def.goal, inst.progress + n);
      }
    }
  };
  bump(state.missions.daily);
  bump(state.missions.weekly);
}

/** 미션이 달성됐고 아직 안 받았는지 */
export function isMissionDone(inst: MissionInstance): boolean {
  const def = missionDef(inst.id);
  return !!def && inst.progress >= def.goal;
}

/**
 * 완료한 미션의 보상을 지급한다(1회). 아직 미완료거나 이미 받았으면 null.
 * @returns 지급한 보상(토스트용) 또는 null
 */
export function claimMission(state: GameState, id: string): MissionReward | null {
  const inst = [...state.missions.daily, ...state.missions.weekly].find((i) => i.id === id);
  const def = inst && missionDef(id);
  if (!inst || !def || inst.claimed || inst.progress < def.goal) return null;
  inst.claimed = true;
  const r = def.reward;
  if (r.money) state.money += r.money;
  if (r.action) state.resources.action = clampAction(state, state.resources.action + r.action);
  if (r.mental) state.resources.mental = clampResource(state.resources.mental + r.mental);
  if (r.followers) changeFollowers(state, r.followers);
  if (r.skills) {
    for (const [k, v] of Object.entries(r.skills)) gainSkill(state, k as never, v as number);
  }
  return r;
}

/** 받을 수 있는(완료·미수령) 미션 수 — 상태창 뱃지용 */
export function claimableCount(state: GameState): number {
  return [...state.missions.daily, ...state.missions.weekly].filter(
    (i) => !i.claimed && isMissionDone(i),
  ).length;
}
