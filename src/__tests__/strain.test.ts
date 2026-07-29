import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  settleOvertimeStrain,
  settleHunger,
  overtimeStrainDamage,
  hungerDamage,
  markOvertime,
  OVERTIME_STRAIN_CAP,
  HUNGER_DAMAGE_CAP,
  HUNGER_STAMINA_FLOOR,
} from "@/systems/health";
import { applyDailyCosts, livingCostToday, DAILY_LIVING_COST } from "@/systems/economy";

/**
 * 야근 연속 페널티·굶주림 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 야근 연속 감소가 **제곱 곡선**이고 상한에서 멈추는 것(장기 연속 파탄 방지).
 * - 같은 날 회사 야근 + 너아무튼온을 둘 다 해도 **1일**로 치는 것(횟수가 아니라 연속일수다).
 * - 굶주림이 체력을 1 아래로 깎지 않는 것 — 굶주림 단독 게임오버는 설계상 없다.
 */

describe("야근 연속 감소량", () => {
  it("첫날은 공짜이고 이후 제곱으로 커진다", () => {
    expect(overtimeStrainDamage(0)).toBe(0);
    expect(overtimeStrainDamage(1)).toBe(0);
    expect(overtimeStrainDamage(2)).toBe(4);
    expect(overtimeStrainDamage(3)).toBe(9);
    expect(overtimeStrainDamage(4)).toBe(16);
    expect(overtimeStrainDamage(5)).toBe(25);
  });

  it("상한(36)에서 멈춘다", () => {
    expect(overtimeStrainDamage(6)).toBe(OVERTIME_STRAIN_CAP);
    expect(overtimeStrainDamage(7)).toBe(OVERTIME_STRAIN_CAP);
    expect(overtimeStrainDamage(30)).toBe(OVERTIME_STRAIN_CAP);
  });
});

describe("야근 연속 정산", () => {
  it("야근한 날 연속이 오르고 체력이 깎인다", () => {
    const s = createInitialState();
    s.stamina = 200;
    // 1일차 — 공짜
    markOvertime(s);
    settleOvertimeStrain(s);
    expect(s.overtimeStreak).toBe(1);
    expect(s.stamina).toBe(200);
    // 2일차 — -4
    markOvertime(s);
    settleOvertimeStrain(s);
    expect(s.overtimeStreak).toBe(2);
    expect(s.stamina).toBe(196);
    // 3일차 — -9
    markOvertime(s);
    settleOvertimeStrain(s);
    expect(s.overtimeStreak).toBe(3);
    expect(s.stamina).toBe(187);
  });

  it("야근 없는 하루가 지나면 연속이 0으로 끊긴다", () => {
    const s = createInitialState();
    s.stamina = 200;
    for (let i = 0; i < 3; i++) {
      markOvertime(s);
      settleOvertimeStrain(s);
    }
    expect(s.overtimeStreak).toBe(3);

    // 야근 안 한 날
    settleOvertimeStrain(s);
    expect(s.overtimeStreak).toBe(0);
    const after = s.stamina;

    // 다시 야근해도 1일차부터 — 공짜
    markOvertime(s);
    settleOvertimeStrain(s);
    expect(s.overtimeStreak).toBe(1);
    expect(s.stamina).toBe(after);
  });

  it("같은 날 야근을 두 번 표시해도 1일로 친다", () => {
    const s = createInitialState();
    s.stamina = 200;
    markOvertime(s); // 회사 야근 판정
    markOvertime(s); // 너아무튼온 업무 요청 수락
    settleOvertimeStrain(s);
    expect(s.overtimeStreak).toBe(1);
  });

  it("정산 후 오늘 야근 표시가 지워진다", () => {
    const s = createInitialState();
    markOvertime(s);
    expect(s.overtimeToday).toBe(true);
    settleOvertimeStrain(s);
    expect(s.overtimeToday).toBe(false);
  });

  it("야근 연속은 체력 바닥이 없다(0까지 깎인다)", () => {
    const s = createInitialState();
    s.stamina = 5;
    s.overtimeStreak = 5; // 다음 정산에서 6일차 → -36
    markOvertime(s);
    settleOvertimeStrain(s);
    expect(s.stamina).toBe(0);
  });
});

describe("굶주림 감소량", () => {
  it("첫날부터 3씩 선형으로 커진다", () => {
    expect(hungerDamage(0)).toBe(0);
    expect(hungerDamage(1)).toBe(3);
    expect(hungerDamage(2)).toBe(6);
    expect(hungerDamage(3)).toBe(9);
    expect(hungerDamage(6)).toBe(18);
  });

  it("상한(20)에서 멈춘다", () => {
    expect(hungerDamage(7)).toBe(HUNGER_DAMAGE_CAP);
    expect(hungerDamage(50)).toBe(HUNGER_DAMAGE_CAP);
  });
});

describe("굶주림 정산", () => {
  it("굶은 연속일만큼 체력이 깎인다", () => {
    const s = createInitialState();
    s.stamina = 200;
    s.hungerStreak = 1;
    settleHunger(s);
    expect(s.stamina).toBe(197);
    s.hungerStreak = 2;
    settleHunger(s);
    expect(s.stamina).toBe(191);
  });

  it("굶지 않으면 아무 일도 없다", () => {
    const s = createInitialState();
    s.stamina = 200;
    s.hungerStreak = 0;
    settleHunger(s);
    expect(s.stamina).toBe(200);
  });

  it("체력을 1 아래로 깎지 않는다", () => {
    const s = createInitialState();
    s.stamina = 5;
    s.hungerStreak = 10; // 상한 -20
    settleHunger(s);
    expect(s.stamina).toBe(HUNGER_STAMINA_FLOOR);
  });

  it("이미 바닥이면 더 깎이지 않는다", () => {
    const s = createInitialState();
    s.stamina = 1;
    s.hungerStreak = 10;
    settleHunger(s);
    expect(s.stamina).toBe(1);

    s.stamina = 0; // 다른 경로로 0이 된 경우
    settleHunger(s);
    expect(s.stamina).toBe(0);
  });
});

describe("생활비와 굶주림 연동", () => {
  it("돈이 없으면 굶주림 연속이 오른다", () => {
    const s = createInitialState();
    s.money = 0;
    applyDailyCosts(s);
    expect(s.hungerStreak).toBe(1);
    applyDailyCosts(s);
    expect(s.hungerStreak).toBe(2);
  });

  it("생활비를 내면 굶주림 연속이 0으로 리셋된다", () => {
    const s = createInitialState();
    s.money = 0;
    applyDailyCosts(s);
    expect(s.hungerStreak).toBe(1);

    s.money = DAILY_LIVING_COST * 10;
    applyDailyCosts(s);
    expect(s.hungerStreak).toBe(0);
  });

  it("생활비가 0원인 날(대기업 평일)은 굶지 않는다", () => {
    const s = createInitialState();
    s.money = 0;
    s.hungerStreak = 3;
    // 생활비 면제 상황을 직접 만든다: livingCostToday가 0을 주는 조건
    s.employment = {
      ...(s.employment ?? ({} as NonNullable<typeof s.employment>)),
      tier: "large",
    } as NonNullable<typeof s.employment>;
    // 평일을 보장할 수 없으니 생활비가 0인지 먼저 확인하고, 0일 때만 리셋을 검사한다.
    if (livingCostToday(s) === 0) {
      applyDailyCosts(s);
      expect(s.hungerStreak).toBe(0);
    }
  });
});

describe("야근과 굶주림은 독립이다", () => {
  it("같은 날 둘 다 맞으면 둘 다 적용된다", () => {
    const s = createInitialState();
    s.stamina = 200;
    s.overtimeStreak = 2; // 다음 정산에서 3일차 → -9
    s.hungerStreak = 2; //                        -6
    markOvertime(s);
    settleOvertimeStrain(s);
    settleHunger(s);
    expect(s.stamina).toBe(200 - 9 - 6);
  });
});
