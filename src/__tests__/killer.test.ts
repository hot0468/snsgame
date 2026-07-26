import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  normalizeLocation,
  attemptHit,
  killerFee,
  killerWeeklyTick,
  KILLER_MAX_FAILS,
  KILLER_DEAD_REASON,
} from "@/systems/killer";
import { KILLER_TARGETS } from "@/data/killerTargets";

describe("killer job", () => {
  it("위치 정규화: 공백·조사 제거", () => {
    expect(normalizeLocation(" 협재 해변 ")).toBe("협재해변");
    expect(normalizeLocation("협재에서")).toBe("협재");
    expect(normalizeLocation("코엑스로")).toBe("코엑스");
  });

  it("정답 위치 입력 시 처리 성공 + 의뢰비 입금", () => {
    const s = createInitialState();
    const target = KILLER_TARGETS[0]; // coin_king → 협재
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: target.id, assignedDay: s.day, deadlineDay: s.day + 7 },
    };
    const before = s.money;
    const res = attemptHit(s, "협재");
    expect(res.ok).toBe(true);
    expect(s.money).toBe(before + (res.fee ?? 0));
    expect(s.killerJob!.completed).toBe(1);
    expect(s.killerJob!.assignment).toBeNull();
  });

  it("틀린 위치는 실패(임무 유지)", () => {
    const s = createInitialState();
    const target = KILLER_TARGETS[0];
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: target.id, assignedDay: s.day, deadlineDay: s.day + 7 },
    };
    const res = attemptHit(s, "강남");
    expect(res.ok).toBe(false);
    expect(s.killerJob!.assignment).not.toBeNull();
    expect(s.killerJob!.completed).toBe(0);
  });

  it("일요일 미완 임무 3회 실패 → 게임오버", () => {
    const s = createInitialState();
    s.day = 7; // 2026-06-07 = 일요일
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: KILLER_TARGETS[0].id, assignedDay: 0, deadlineDay: 7 },
    };
    for (let i = 0; i < KILLER_MAX_FAILS; i++) killerWeeklyTick(s);
    expect(s.killerJob!.fails).toBe(KILLER_MAX_FAILS);
    expect(s.gameOver).toBe(KILLER_DEAD_REASON);
  });

  it("의뢰비는 역량(지식·운동·어휘력·IT·평판)에 비례", () => {
    const low = createInitialState();
    const high = createInitialState();
    high.skills.knowledge = 999;
    high.skills.fitness = 999;
    high.skills.vocabulary = 999;
    high.skills.it = 999;
    high.resources.reputation = 100;
    expect(killerFee(high)).toBeGreaterThan(killerFee(low));
  });
});
