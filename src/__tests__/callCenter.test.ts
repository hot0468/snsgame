import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  CALL_LINES,
  CALL_MAX_STREAK,
  CALL_MENTAL_FLOOR,
} from "@/data/callCenter";
import {
  callMentalCost,
  callPay,
  canApplyCallCenter,
  canTakeCall,
  joinCallCenter,
  takeCall,
} from "@/systems/callCenter";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { hasJobExperience, JOB_ID } from "@/systems/jobExperience";
import type { GameState } from "@/core/types";

/**
 * 콜센터 상담원직 회귀 테스트.
 *
 * 고정하는 불변식:
 *  1) **정신력 소모가 가속한다** — 이게 유일한 제동장치다. 가속이 없으면 정신력이 남는 한
 *     무한히 받는 게 지배 전략이 되고 "한 콜 더?"라는 결정 자체가 사라진다.
 *  2) 수당 가산보다 소모 가속이 커야 한다(안 그러면 끝까지 받는 게 항상 정답).
 *  3) **정신력 하한 아래로는 못 받는다** — 0까지 긁으면 우울 모드(20 미만)에 갇혀
 *     다음 날이 통째로 망가진다. 벌 받는 것과 갇히는 건 다르다.
 *  4) 겸직 배타에 편입돼 있다.
 */

function hired(): GameState {
  const s = createInitialState();
  joinCallCenter(s);
  return s;
}

describe("입사", () => {
  it("자격 조건 없이 누구나 지원할 수 있다", () => {
    const s = createInitialState();
    expect(canApplyCallCenter(s)).toBe(true);
    expect(joinCallCenter(s)).not.toBeNull();
  });

  it("겸직 배타·도감에 편입돼 있다", () => {
    const s = hired();
    expect(hasAnyJob(s)).toBe(true);
    expect(currentJobLabel(s)).toBe("콜센터 상담원");
    expect(hasJobExperience(s, JOB_ID.callCenter)).toBe(true);
  });

  it("입사하면 기존 직업이 정리된다", () => {
    const s = createInitialState();
    s.lecturerJob = { hiredDay: 1, lessonsThisMonth: 0, totalLessons: 0, lastSalaryMonth: -1 };
    joinCallCenter(s);
    expect(s.lecturerJob).toBeNull();
    expect(s.callCenterJob).not.toBeNull();
  });
});

describe("가속 — 이 직업의 제동장치", () => {
  it("콜을 받을수록 정신력 소모가 커진다", () => {
    const costs = [1, 2, 3, 5, 8].map(callMentalCost);
    for (let i = 1; i < costs.length; i++) {
      expect(costs[i], `${i}번째가 이전보다 커야 한다`).toBeGreaterThan(costs[i - 1]);
    }
  });

  it("콜을 받을수록 단가도 오른다 — 그래야 '한 콜 더'가 유혹이 된다", () => {
    expect(callPay(5)).toBeGreaterThan(callPay(1));
  });

  it("소모 가속이 수당 가산보다 가팔라야 한다", () => {
    // 둘 다 1번째 대비 몇 배가 됐는지로 비교한다.
    // 수당이 더 가파르면 끝까지 받는 게 항상 정답이 되어 결정이 사라진다.
    const n = CALL_MAX_STREAK;
    const payRatio = callPay(n) / callPay(1);
    const costRatio = callMentalCost(n) / callMentalCost(1);
    expect(costRatio, `수당 ${payRatio.toFixed(2)}배 vs 소모 ${costRatio.toFixed(2)}배`).toBeGreaterThan(
      payRatio,
    );
  });
});

describe("정신력 하한", () => {
  it("하한 아래로 떨어질 콜은 받을 수 없다", () => {
    const s = hired();
    s.resources.mental = CALL_MENTAL_FLOOR + 1; // 1번째 콜 소모(4)를 감당 못 한다
    expect(canTakeCall(s, 1)).toBe(false);
  });

  it("콜을 계속 받아도 정신력이 하한 밑으로 안 내려간다", () => {
    const s = hired();
    s.resources.mental = 100;
    const plain = CALL_LINES.find((l) => !l.mental)!;
    let streak = 0;
    while (canTakeCall(s, streak + 1)) {
      streak += 1;
      takeCall(s, plain, streak);
    }
    expect(s.resources.mental).toBeGreaterThanOrEqual(CALL_MENTAL_FLOOR);
    expect(streak).toBeGreaterThan(0);
  });

  it("상한을 넘겨 받을 수 없다", () => {
    const s = hired();
    s.resources.mental = 100;
    expect(canTakeCall(s, CALL_MAX_STREAK + 1)).toBe(false);
  });
});

describe("콜 처리", () => {
  it("수당이 즉시 소지금에 들어오고 누적이 쌓인다", () => {
    const s = hired();
    const before = s.money;
    const line = CALL_LINES[0];
    const r = takeCall(s, line, 1);
    expect(r).not.toBeNull();
    expect(s.money - before).toBe(r!.pay);
    expect(s.callCenterJob!.totalCalls).toBe(1);
    expect(s.callCenterJob!.totalEarned).toBe(r!.pay);
  });

  it("최다 연속 기록이 갱신된다", () => {
    const s = hired();
    s.resources.mental = 100;
    const plain = CALL_LINES.find((l) => !l.mental)!;
    takeCall(s, plain, 1);
    takeCall(s, plain, 2);
    takeCall(s, plain, 3);
    expect(s.callCenterJob!.bestStreak).toBe(3);
  });

  it("상담원이 아니면 콜을 못 받는다", () => {
    const s = createInitialState();
    expect(takeCall(s, CALL_LINES[0], 1)).toBeNull();
  });
});

describe("콜 콘텐츠", () => {
  it("id가 중복되지 않는다", () => {
    const ids = CALL_LINES.map((l) => l.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("힘든 콜(정신력을 더 깎는)일수록 수당 배율이 높다", () => {
    // 고생이 돈이 안 되면 힘든 콜은 그냥 벌점일 뿐이다.
    for (const l of CALL_LINES) {
      if ((l.mental ?? 0) >= -3) continue;
      expect((l.payMul ?? 1), `${l.id}`).toBeGreaterThan(1);
    }
  });
});
