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
 *
 * ⚠️ 돈은 **낮은 티어일수록 크게** 준다(초반 100만원은 게임을 바꾸지만 후반 100만원은 안 보인다).
 *    후반 티어의 실질 보상은 아래 해금형 퍼크(MILESTONE_PERKS)가 담당한다.
 */
const ONE_TIME_REWARD: { followers: number; money: number }[] = [
  { followers: 0, money: 100_000 }, // tier0 100
  { followers: 2000, money: 150_000 }, // tier1 300
  { followers: 8000, money: 250_000 }, // tier2 600
  { followers: 30000, money: 500_000 }, // tier3 999
];

/* ─────────────────── ④ 해금형 퍼크 ─────────────────── */

/**
 * 마일스톤 **누적 개수**로 해금되는 지속 퍼크.
 *
 * 설계 원칙 — 왜 새 상태 필드를 안 만들었나:
 *   퍼크를 `state`에 따로 기록하면 "지급됐는데 claimed가 없다"/"claimed는 있는데 퍼크가 없다"는
 *   불일치가 세이브에 눌어붙는다. 대신 **claimed 집합(statMilestones)에서 매번 파생**한다.
 *   → 지급 로직이 없으니 중복 지급도 불가능하고, 구세이브 백필도 저절로 맞는다(멱등).
 *   ⚠️ `checkStatMilestones`의 claimed 멱등성이 이 시스템의 유일한 진실 소스다 — 깨지 마라.
 *      "정직한 감소"로 스킬이 내려가도 claimed는 남으므로 퍼크는 유지된다(파밍 구멍 없음).
 *
 * `at` = 필요한 누적 마일스톤 개수. 전체 44개(스킬 11 × 티어 4)가 상한이다.
 * 효과의 **적용 지점은 각 시스템**이고(아래 셀렉터들), 여기는 선언표다.
 * 문구·서사는 content-author가 `data/milestones.ts` 쪽에서 다듬는다.
 */
export interface MilestonePerk {
  id: string;
  /** 해금에 필요한 누적 마일스톤 개수 */
  at: number;
  label: string;
  desc: string;
}

export const MILESTONE_PERKS: readonly MilestonePerk[] = [
  { id: "focus", at: 4, label: "감 잡았다", desc: "컨디션이 나쁜 날에도 완전히 헛손질하지는 않는다. 활동 실패 확률 -20%." },
  { id: "stamina", at: 8, label: "루틴이 몸에 뱄다", desc: "하루가 지나면 정신력이 +5 더 회복된다." },
  { id: "efficient", at: 14, label: "요령이 붙었다", desc: "뭘 하든 예전보다 는다. 모든 스킬 획득량 +10%." },
  { id: "resilient", at: 20, label: "웬만해선 안 흔들린다", desc: "컨디션이 나빠도 크게 개의치 않는다. 활동 실패 확률 -20% 추가." },
  { id: "mastery", at: 28, label: "경지에 올랐다", desc: "손대는 족족 실력으로 남는다. 모든 스킬 획득량 +10%(누적 +20%)." },
] as const;

/** 현재 해금된 퍼크 목록(claimed 개수에서 파생 — 상태 저장 없음). UI 표시용. */
export function unlockedPerks(state: GameState): MilestonePerk[] {
  const n = state.statMilestones.length;
  return MILESTONE_PERKS.filter((p) => n >= p.at);
}

/** 특정 퍼크가 해금됐는지. 각 시스템이 효과를 적용할 때 쓰는 게이트. */
export function hasPerk(state: GameState, id: string): boolean {
  const p = MILESTONE_PERKS.find((x) => x.id === id);
  return !!p && state.statMilestones.length >= p.at;
}

/**
 * 퍼크로 인한 **스킬 획득 배율**(1.0 ~ 1.2). `systems/stats.ts`의 gainSkill이 곱한다.
 * ⚠️ 획득(양수)에만 적용된다 — gainSkill 내부에서 처리하므로 여기서 부호를 신경 쓸 필요는 없다.
 */
export function perkSkillMult(state: GameState): number {
  let m = 1;
  if (hasPerk(state, "efficient")) m += 0.1;
  if (hasPerk(state, "mastery")) m += 0.1;
  return m;
}

/**
 * 퍼크로 인한 **활동 실패 확률 배율**(1.0 ~ 0.64). `systems/offline.ts`의 activityFailChance가 곱한다.
 * 0으로는 절대 안 간다 — 컨디션 관리가 무의미해지면 정신력 축이 죽는다.
 */
export function perkFailMult(state: GameState): number {
  let m = 1;
  if (hasPerk(state, "focus")) m *= 0.8;
  if (hasPerk(state, "resilient")) m *= 0.8;
  return m;
}

/** 퍼크로 인한 **하루 정신력 회복 보너스**. `systems/time.ts`의 아침 회복이 더한다. */
export function perkMentalRecovery(state: GameState): number {
  return hasPerk(state, "stamina") ? 5 : 0;
}

/** 새로 돌파한 마일스톤에 보상을 지급한다(claimed push는 호출부에서 이미 함). */
function grantMilestoneReward(state: GameState, tier: number): void {
  const r = ONE_TIME_REWARD[tier];
  if (!r) return;
  if (r.followers) getActiveAccount(state).followers += r.followers;
  if (r.money) state.money += r.money;
  state.actionMaxBonus += PERK_ACTION_PER_MILESTONE;
  // 해금형 퍼크는 여기서 '지급'하지 않는다 — claimed 개수에서 파생된다(MILESTONE_PERKS 주석 참조).
}

/**
 * 이번 달성으로 **새로 해금된** 퍼크(직전 개수 → 현재 개수 사이). 토스트 표시용.
 * 지급이 아니라 조회다 — 호출해도 상태가 변하지 않는다.
 */
export function perksUnlockedBetween(before: number, after: number): MilestonePerk[] {
  return MILESTONE_PERKS.filter((p) => p.at > before && p.at <= after);
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
