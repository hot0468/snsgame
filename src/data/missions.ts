/**
 * 일일/주간 도전과제(미션) 정의.
 *
 * 매일·매주 풀에서 몇 개가 **결정론적으로**(그날/그주 시드) 뽑혀 나온다 — 같은 날은 같은 세트라
 * 전체 재렌더에도 흔들리지 않는다. 진행도 누적·보상 지급은 systems/missions.ts가 한다(데이터=선언형).
 *
 * metric은 systems/missions.ts의 recordMission이 각 행동 지점에서 올려 주는 카운터 키다.
 * 새 metric을 추가하려면 그 행동이 일어나는 systems 함수에서 recordMission을 호출해야 한다.
 * 기본 5종은 **직업·상태와 무관하게 늘 달성 가능한** 행동이다(막힌 미션 방지).
 * 직업 전용 미션은 `requires`로 게이트를 걸어, **그 직업일 때만 후보 풀에 들어간다** —
 * 그래야 "택시 3회 운행"이 무직인 날의 죽은 미션이 되지 않는다.
 */
import type { GameState, MissionInstance, SkillStatId } from "@/core/types";
import { hashInt } from "@/utils/random";

export type MissionMetric =
  | "tweet"
  | "like"
  | "retweet"
  | "follow"
  | "offline"
  // ── 직업 전용(반드시 requires와 짝지어 쓸 것) ──
  | "ride"
  | "call"
  | "sale"
  | "cut"
  | "work" // 회사원 성실 근무(딴짓은 안 센다)
  | "lesson" // 강사 수업
  | "shoot" // AV 촬영(하루 1회 — 근무일 카운트와 같은 가드 안에서 센다)
  | "training"; // 배구부 훈련

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
  /**
   * 이 미션이 **후보 풀에 들어갈 조건**(없으면 항상 후보).
   * 순수 판정 — 상태를 읽기만 한다(업적의 `condition`과 같은 규칙).
   *
   * ⚠️ 직업 전용 metric(ride·call·sale·cut)에는 **반드시** 이걸 붙여라.
   *    안 붙이면 그 직업이 없는 날 절대 못 깨는 미션이 떠서 그날 세트 하나가 죽는다.
   */
  requires?: (s: GameState) => boolean;
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
  // ── 직업 전용(requires로 게이트) ──
  { id: "d_ride3", label: "택시 3회 운행", metric: "ride", goal: 3, reward: { money: 40_000 }, requires: (s) => !!s.taxiJob },
  { id: "d_call6", label: "상담 6콜 처리", metric: "call", goal: 6, reward: { mental: 15 }, requires: (s) => !!s.callCenterJob },
  { id: "d_sale1", label: "제품 판매 1건", metric: "sale", goal: 1, reward: { money: 60_000 }, requires: (s) => !!s.mlmJob },
  { id: "d_cut4", label: "시술 4건", metric: "cut", goal: 4, reward: { skills: { beauty: 15 } }, requires: (s) => !!s.stylistJob },
  // 아래 넷은 강제 출근·하루 1회 제한이 걸린 직업이라 goal이 1~2다(신규 4직업처럼 여러 번 못 돈다).
  { id: "d_work1", label: "성실하게 근무하기", metric: "work", goal: 1, reward: { money: 30_000 }, requires: (s) => !!s.employment },
  { id: "d_lesson1", label: "수업 1회 진행", metric: "lesson", goal: 1, reward: { skills: { vocabulary: 12 } }, requires: (s) => !!s.lecturerJob },
  { id: "d_shoot1", label: "촬영 1회", metric: "shoot", goal: 1, reward: { money: 50_000 }, requires: (s) => !!s.avJob },
  { id: "d_training1", label: "훈련 1회 지도", metric: "training", goal: 1, reward: { skills: { fitness: 12 } }, requires: (s) => !!s.coachJob },
];

export const WEEKLY_MISSIONS: MissionDef[] = [
  { id: "w_tweet15", label: "이번 주 트윗 15개", metric: "tweet", goal: 15, reward: { money: 100_000 } },
  { id: "w_rt12", label: "이번 주 리트윗 12번", metric: "retweet", goal: 12, reward: { money: 70_000, mental: 10 } },
  { id: "w_like30", label: "이번 주 좋아요 30번", metric: "like", goal: 30, reward: { money: 80_000, action: 10 } },
  { id: "w_follow8", label: "이번 주 팔로우 8명", metric: "follow", goal: 8, reward: { money: 90_000 } },
  { id: "w_offline5", label: "이번 주 현생 살기 5회", metric: "offline", goal: 5, reward: { skills: { knowledge: 15 } } },
  // ── 직업 전용(requires로 게이트) ──
  { id: "w_ride15", label: "이번 주 택시 15회 운행", metric: "ride", goal: 15, reward: { money: 200_000 }, requires: (s) => !!s.taxiJob },
  { id: "w_call30", label: "이번 주 상담 30콜", metric: "call", goal: 30, reward: { money: 150_000, mental: 15 }, requires: (s) => !!s.callCenterJob },
  { id: "w_sale5", label: "이번 주 제품 판매 5건", metric: "sale", goal: 5, reward: { money: 250_000 }, requires: (s) => !!s.mlmJob },
  { id: "w_cut20", label: "이번 주 시술 20건", metric: "cut", goal: 20, reward: { skills: { beauty: 30 } }, requires: (s) => !!s.stylistJob },
  // 주5일 강제 출근이라 주간 목표는 4회 — 하루 빠져도 닿는다(5로 잡으면 결근 한 번에 실패 확정).
  { id: "w_work4", label: "이번 주 성실 근무 4회", metric: "work", goal: 4, reward: { money: 180_000 }, requires: (s) => !!s.employment },
  { id: "w_lesson4", label: "이번 주 수업 4회", metric: "lesson", goal: 4, reward: { money: 150_000, skills: { knowledge: 15 } }, requires: (s) => !!s.lecturerJob },
  { id: "w_shoot3", label: "이번 주 촬영 3회", metric: "shoot", goal: 3, reward: { money: 220_000 }, requires: (s) => !!s.avJob },
  { id: "w_training4", label: "이번 주 훈련 4회", metric: "training", goal: 4, reward: { money: 140_000, skills: { fitness: 20 } }, requires: (s) => !!s.coachJob },
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

/**
 * 지금 상태에서 후보가 되는 미션만 남긴다(직업 전용은 그 직업일 때만).
 *
 * ⚠️ `state`가 null인 건 **새 게임 초기 상태를 만드는 중**이라 아직 GameState가 없을 때다
 *    (`core/state.createInitialState`). 새 게임엔 직업이 없으므로 기본 풀만 쓰는 게 정답이다.
 */
function eligible(pool: MissionDef[], state: GameState | null): MissionDef[] {
  if (!state) return pool.filter((m) => !m.requires);
  return pool.filter((m) => !m.requires || m.requires(state));
}

export function rollDaily(day: number, state: GameState | null): MissionInstance[] {
  return pickBySeed(eligible(DAILY_MISSIONS, state), DAILY_PICK, `daily:${day}`).map((m) => ({
    id: m.id,
    progress: 0,
    claimed: false,
  }));
}

export function rollWeekly(week: number, state: GameState | null): MissionInstance[] {
  return pickBySeed(eligible(WEEKLY_MISSIONS, state), WEEKLY_PICK, `weekly:${week}`).map((m) => ({
    id: m.id,
    progress: 0,
    claimed: false,
  }));
}
