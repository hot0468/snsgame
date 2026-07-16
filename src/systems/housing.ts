import type { GameState, SkillStatId } from "@/core/types";
import { HOUSINGS, type Housing } from "@/data/housing";
import { clampSkill } from "./stats";
import { addSchedule } from "./time";

/** 현재 주거 */
export function currentHousing(state: GameState): Housing {
  return HOUSINGS[state.housingTier] ?? HOUSINGS[0];
}

/** 다음 단계 주거(최고 단계면 null) */
export function nextHousing(state: GameState): Housing | null {
  return HOUSINGS[state.housingTier + 1] ?? null;
}

/** 다음 단계로 계약(구매) 가능한지 — 잔고 충분 + 최고 단계 아님 */
export function canUpgradeHousing(state: GameState): boolean {
  const next = nextHousing(state);
  return next != null && state.money >= next.price;
}

/**
 * 다음 단계 집으로 이사(계약)한다.
 * - 계약 비용을 지불하고 주거 단계를 올린다.
 * - 아파트 이상이면 세부 스탯이 영구히 오른다.
 * @returns 이사했으면 이사한 집, 아니면 null
 */
export function upgradeHousing(state: GameState): Housing | null {
  const next = nextHousing(state);
  if (!next || state.money < next.price) return null;
  state.money -= next.price;
  state.housingTier += 1;
  if (next.permaSkills) {
    for (const [skill, amount] of Object.entries(next.permaSkills)) {
      const key = skill as SkillStatId;
      state.skills[key] = clampSkill(state.skills[key] + (amount ?? 0));
    }
  }
  addSchedule(state, `${next.name} 계약 — 이사 완료`, "system");
  return next;
}
