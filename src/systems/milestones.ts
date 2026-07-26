import type { GameState, SkillStatId } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import {
  MILESTONE_THRESHOLDS,
  SKILL_MILESTONE_IDS,
  milestoneId,
} from "@/data/milestones";

/** 지속 퍼크: 마일스톤 1개당 행동력 상한 증가분. 크게 느껴지면 낮춘다(튜닝). */
export const PERK_ACTION_PER_MILESTONE = 1;

/**
 * 일회성 축하 보상(티어별). followers=활성 계정 팔로워, money=소지금.
 * 경제 규모 기준: 초기 저축 50만·월세 30만~·자격증비 2.5만~5.8만·집값 200만~.
 * tier3(999)은 값싼 집 한 채급 목돈이 되게 잡되 1.2억 엔드하우스는 안 흔든다.
 */
const ONE_TIME_REWARD: { followers: number; money: number }[] = [
  { followers: 0, money: 100_000 }, // tier0 100
  { followers: 2000, money: 100_000 }, // tier1 300
  { followers: 8000, money: 100_000 }, // tier2 600
  { followers: 30000, money: 100_000 }, // tier3 999
];

/** 새로 돌파한 마일스톤에 보상을 지급한다(claimed push는 호출부에서 이미 함). */
function grantMilestoneReward(state: GameState, tier: number): void {
  const r = ONE_TIME_REWARD[tier];
  if (!r) return;
  if (r.followers) getActiveAccount(state).followers += r.followers;
  if (r.money) state.money += r.money;
  state.actionMaxBonus += PERK_ACTION_PER_MILESTONE;
}

/**
 * 스킬이 문턱을 넘겼는지 판정해 claimed 기록·보상 지급·토스트 큐잉.
 * checkAchievements 미러: onNewDay·postTweet 말미에서 호출.
 * 스킬 하락해도 claimed는 남으므로 재지급 없음(멱등).
 * @returns 이번에 새로 달성한 id 배열.
 */
export function checkStatMilestones(state: GameState): string[] {
  const newly: string[] = [];
  for (const skill of SKILL_MILESTONE_IDS) {
    const val = state.skills[skill];
    MILESTONE_THRESHOLDS.forEach((thr, tier) => {
      const id = milestoneId(skill, tier);
      if (state.statMilestones.includes(id)) return;
      if (val >= thr) {
        state.statMilestones.push(id);
        grantMilestoneReward(state, tier);
        state.pendingMilestones.push(id);
        newly.push(id);
      }
    });
  }
  return newly;
}

/**
 * 구세이브 백필: 현재 스킬로 이미 넘긴 문턱을 claimed로만 기록(보상·토스트 없음).
 * save.sanitize에서 statMilestones 키가 없던 세이브에 1회 호출.
 */
export function backfillClaimedMilestones(state: GameState): void {
  for (const skill of SKILL_MILESTONE_IDS) {
    const val = state.skills[skill];
    MILESTONE_THRESHOLDS.forEach((thr, tier) => {
      const id = milestoneId(skill, tier);
      if (val >= thr && !state.statMilestones.includes(id)) {
        state.statMilestones.push(id);
      }
    });
  }
}

/** UI용: 해당 스킬에서 획득한 최고 tier(없으면 -1). */
export function highestMilestoneTier(state: GameState, skill: SkillStatId): number {
  let best = -1;
  MILESTONE_THRESHOLDS.forEach((_thr, tier) => {
    if (state.statMilestones.includes(milestoneId(skill, tier))) best = tier;
  });
  return best;
}
