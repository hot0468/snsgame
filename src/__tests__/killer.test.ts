import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  normalizeLocation,
  attemptHit,
  killerFee,
  killerDailyTick,
  KILLER_MAX_FAILS,
  KILLER_DEAD_REASON,
  KILLER_LEGEND_REASON,
} from "@/systems/killer";
import { checkWin } from "@/systems/winEnding";
import { getActiveAccount } from "@/core/state";
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
      assignment: { targetId: target.id, assignedDay: s.day, deadlineDay: s.day + 7, tweets: [] },
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
      assignment: { targetId: target.id, assignedDay: s.day, deadlineDay: s.day + 7, tweets: [] },
    };
    const res = attemptHit(s, "강남");
    expect(res.ok).toBe(false);
    expect(s.killerJob!.assignment).not.toBeNull();
    expect(s.killerJob!.completed).toBe(0);
  });

  it("마감(일주일) 초과 임무 3회 실패 → 게임오버", () => {
    const s = createInitialState();
    s.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
    for (let i = 0; i < KILLER_MAX_FAILS; i++) {
      s.killerJob!.assignment = { targetId: KILLER_TARGETS[0].id, assignedDay: 1, deadlineDay: 8, tweets: [] };
      s.day = 9; // 마감(8) 초과
      killerDailyTick(s);
    }
    expect(s.killerJob!.fails).toBe(KILLER_MAX_FAILS);
    expect(s.gameOver).toBe(KILLER_DEAD_REASON);
  });

  it("매달 1일에 임무 없으면 새 타겟 배정(마감 = 배정일+7)", () => {
    const s = createInitialState();
    s.day = 1; // 그달 1일
    s.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
    killerDailyTick(s);
    expect(s.killerJob!.assignment).not.toBeNull();
    expect(s.killerJob!.assignment!.deadlineDay).toBe(1 + 7);
  });

  it("킬러 신분으로 팔로워 100만 달성 → 전설의 청부업자 엔딩", () => {
    const s = createInitialState();
    s.killerJob = { active: true, fails: 0, completed: 3, assignment: null };
    getActiveAccount(s).followers = 1_000_000;
    checkWin(s);
    expect(s.gameOver).toBe(KILLER_LEGEND_REASON);
  });

  it("역습 타겟 + 저역량 → 체력·정신 피해", () => {
    const s = createInitialState();
    s.stamina = 200;
    s.resources.mental = 100;
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: "bad_landlord", assignedDay: s.day, deadlineDay: s.day + 7, tweets: [] },
    };
    const res = attemptHit(s, "가평"); // bad_landlord 정답
    expect(res.ok).toBe(true);
    expect(s.stamina).toBeLessThan(200); // 반격 피해
    expect(s.resources.mental).toBeLessThan(100);
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
