/**
 * 일일/주간 도전과제(미션) 정의.
 *
 * 매일·매주 풀에서 몇 개가 **결정론적으로**(그날/그주 시드) 뽑혀 나온다 — 같은 날은 같은 세트라
 * 전체 재렌더에도 흔들리지 않는다. 진행도 누적·보상 지급은 systems/missions.ts가 한다(데이터=선언형).
 *
 * metric은 systems/missions.ts의 recordMission이 각 행동 지점에서 올려 주는 카운터 키다.
 * 새 metric을 추가하려면 그 행동이 일어나는 systems 함수에서 recordMission을 호출해야 한다.
 * 지금 5종은 모두 **직업·상태와 무관하게 늘 달성 가능한** 행동만 골랐다(막힌 미션 방지).
 */
import type { MissionInstance, SkillStatId } from "@/core/types";
import { hashInt } from "@/utils/random";

export type MissionMetric = "tweet" | "like" | "retweet" | "follow" | "offline";

export interface MissionReward {
  money?: number;
  action?: number;
  mental?: number;
  followers?: number;
  skills?: Partial<Record<SkillStatId, number>>;
}

export interface MissionDef {
  id: string;
  label: string;
  metric: MissionMetric;
  goal: number;
  reward: MissionReward;
}

/** 하루/한 주에 노출되는 미션 개수 */
export const DAILY_PICK = 3;
export const WEEKLY_PICK = 2;

export const DAILY_MISSIONS: MissionDef[] = [
  { id: "d_tweet3", label: "트윗 3개 올리기", metric: "tweet", goal: 3, reward: { money: 20_000 } },
  { id: "d_tweet5", label: "트윗 5개 올리기", metric: "tweet", goal: 5, reward: { money: 35_000 } },
  { id: "d_like5", label: "남의 글에 좋아요 5번", metric: "like", goal: 5, reward: { action: 8 } },
  { id: "d_rt3", label: "리트윗 3번", metric: "retweet", goal: 3, reward: { mental: 12 } },
  { id: "d_follow2", label: "새 계정 2개 팔로우", metric: "follow", goal: 2, reward: { money: 15_000 } },
  { id: "d_offline1", label: "현생 살기 1회", metric: "offline", goal: 1, reward: { mental: 10 } },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: "w_tweet15", label: "이번 주 트윗 15개", metric: "tweet", goal: 15, reward: { money: 100_000 } },
  { id: "w_rt12", label: "이번 주 리트윗 12번", metric: "retweet", goal: 12, reward: { money: 70_000, mental: 10 } },
  { id: "w_like30", label: "이번 주 좋아요 30번", metric: "like", goal: 30, reward: { money: 80_000, action: 10 } },
  { id: "w_follow8", label: "이번 주 팔로우 8명", metric: "follow", goal: 8, reward: { money: 90_000 } },
  { id: "w_offline5", label: "이번 주 현생 살기 5회", metric: "offline", goal: 5, reward: { skills: { knowledge: 15 } } },
];

const MISSION_BY_ID = new Map<string, MissionDef>();
for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) MISSION_BY_ID.set(m.id, m);

export function missionDef(id: string): MissionDef | undefined {
  return MISSION_BY_ID.get(id);
}

/** 일 기준 주차(1~7일=0주차, 8~14일=1주차 …). 주간 미션 시드·리셋 판정에 쓴다. */
export function currentWeek(day: number): number {
  return Math.floor((day - 1) / 7);
}

/** 시드로 pool에서 서로 다른 k개를 결정론적으로 고른다(같은 시드=같은 세트 → 재렌더 안전). */
function pickBySeed(pool: MissionDef[], k: number, seed: string): MissionDef[] {
  const order = pool.map((_, i) => i).sort((a, b) => hashInt(`${seed}:${a}`) - hashInt(`${seed}:${b}`));
  return order.slice(0, Math.min(k, pool.length)).map((i) => pool[i]);
}

export function rollDaily(day: number): MissionInstance[] {
  return pickBySeed(DAILY_MISSIONS, DAILY_PICK, `daily:${day}`).map((m) => ({
    id: m.id,
    progress: 0,
    claimed: false,
  }));
}

export function rollWeekly(week: number): MissionInstance[] {
  return pickBySeed(WEEKLY_MISSIONS, WEEKLY_PICK, `weekly:${week}`).map((m) => ({
    id: m.id,
    progress: 0,
    claimed: false,
  }));
}
