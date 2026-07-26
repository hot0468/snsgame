import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  checkStatMilestones,
  backfillClaimedMilestones,
  highestMilestoneTier,
  PERK_ACTION_PER_MILESTONE,
} from "@/systems/milestones";

describe("stat milestones", () => {
  it("문턱을 넘으면 claimed·퍼크·토스트가 생기고 멱등하다", () => {
    const s = createInitialState();
    const baseBonus = s.actionMaxBonus;
    s.skills.fitness = 100; // tier0만 돌파
    const newly = checkStatMilestones(s);
    expect(newly).toEqual(["fitness:0"]);
    expect(s.statMilestones).toContain("fitness:0");
    expect(s.pendingMilestones).toContain("fitness:0");
    expect(s.actionMaxBonus).toBe(baseBonus + PERK_ACTION_PER_MILESTONE);
    // 다시 호출해도 재지급 없음(멱등)
    const again = checkStatMilestones(s);
    expect(again).toEqual([]);
    expect(s.actionMaxBonus).toBe(baseBonus + PERK_ACTION_PER_MILESTONE);
  });

  it("한 번에 여러 문턱을 넘으면 전부 claimed된다", () => {
    const s = createInitialState();
    s.skills.knowledge = 999; // tier0~3 전부
    checkStatMilestones(s);
    expect(highestMilestoneTier(s, "knowledge")).toBe(3);
    expect(s.statMilestones.filter((id) => id.startsWith("knowledge:")).length).toBe(4);
  });

  it("백필은 칭호만 소급하고 보상·토스트는 안 준다", () => {
    const s = createInitialState();
    const baseBonus = s.actionMaxBonus;
    s.skills.beauty = 300;
    backfillClaimedMilestones(s);
    expect(s.statMilestones).toContain("beauty:0");
    expect(s.statMilestones).toContain("beauty:1");
    expect(s.pendingMilestones).toEqual([]); // 토스트 없음
    expect(s.actionMaxBonus).toBe(baseBonus); // 퍼크 없음
  });
});
