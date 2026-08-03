import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  OFFLINE_ACTIVITIES,
  buyGymPass,
  canUseGym,
  gymTodayFee,
  hasGymPass,
  workoutIntensity,
  GYM_DAY_FEE,
  GYM_PASS_FEE,
  GYM_PASS_BREAKEVEN_DAYS,
} from "@/systems/offline";
import { monthKey } from "@/systems/calendar";

/**
 * 홈트/헬스장 분리 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - **둘 다 '운동'으로 쳐야 한다.** 한쪽만 workout 표식을 잃으면 바디프로필 게이지·
 *   무운동 일수 리셋·마라톤 제안이 그 활동에서 조용히 죽는다(표식 판정으로 바꾼 이유).
 * - **홈트가 지배 전략이 되면 안 된다.** 요금을 내고 헬스장에 갈 이유가 남으려면
 *   행동력당 효율에서도 헬스장이 이겨야 한다 — 강도 배율(0.6)이 행동력 비(18/25=0.72)보다
 *   낮아야 성립한다. 이 부등식이 이 기능의 축이다.
 * - 월 정기권이 **달이 바뀌면 만료**되는 것(별도 훅 없이 monthKey 비교로만 동작한다).
 */

const activity = (id: string) => {
  const a = OFFLINE_ACTIVITIES.find((x) => x.id === id);
  if (!a) throw new Error(`활동 ${id}가 없다`);
  return a;
};

describe("홈트·헬스장 공통 계약", () => {
  it("둘 다 운동(workout) 표식을 갖는다", () => {
    expect(activity("homeWorkout").workout).toBe(true);
    expect(activity("workout").workout).toBe(true);
  });

  it("헬스장만 요금 대상(gym)이다", () => {
    expect(activity("workout").gym).toBe(true);
    expect(activity("homeWorkout").gym).toBeFalsy();
  });

  it("홈트는 공짜다(money 선언이 없어야 한다)", () => {
    expect(activity("homeWorkout").money ?? 0).toBe(0);
  });

  /**
   * ⚠️ 요금은 activity.money가 아니라 payGymFee가 하루 단위로 받는다.
   *    여기에 money를 선언하면 슬롯마다 이중으로 빠져나간다.
   */
  it("헬스장 요금을 activity.money로 선언하지 않는다(하루 단위라 이중청구가 된다)", () => {
    expect(activity("workout").money ?? 0).toBe(0);
  });
});

describe("홈트가 헬스장의 상위호환이 아니다", () => {
  it("행동력당 효율에서 헬스장이 이긴다(요금을 낼 이유가 남아야 한다)", () => {
    const home = activity("homeWorkout");
    const gym = activity("workout");
    // `action`은 음수 선언(-18/-25)이라 절대값으로 비교한다.
    const cost = (a: typeof home) => Math.abs(a.action ?? 0);

    // 강도 배율(체력·게이지) — 행동력 비보다 낮아야 홈트 연타가 이득이 되지 않는다.
    const actionRatio = cost(home) / cost(gym);
    expect(workoutIntensity(home) / workoutIntensity(gym)).toBeLessThan(actionRatio);

    // 스킬도 같은 방향이어야 한다.
    const perAction = (a: typeof home) => (a.skillGains?.fitness ?? 0) / cost(a);
    expect(perAction(home)).toBeLessThan(perAction(gym));
  });

  it("홈트는 행동력이 더 싸다(그게 홈트의 존재 이유다)", () => {
    expect(Math.abs(activity("homeWorkout").action ?? 0)).toBeLessThan(
      Math.abs(activity("workout").action ?? 0),
    );
  });
});

describe("헬스장 요금", () => {
  it("손익분기가 정기권÷일일권과 일치한다", () => {
    expect(GYM_PASS_BREAKEVEN_DAYS).toBe(GYM_PASS_FEE / GYM_DAY_FEE);
  });

  it("돈이 없으면 못 간다", () => {
    const s = createInitialState();
    s.money = 0;
    expect(canUseGym(s)).toBe(false);
    expect(buyGymPass(s)).toBe("poor");
  });

  it("정기권을 사면 그 달 요금이 0이 된다", () => {
    const s = createInitialState();
    s.money = GYM_PASS_FEE;
    expect(buyGymPass(s)).toBe("ok");
    expect(s.money).toBe(0);
    expect(hasGymPass(s)).toBe(true);
    expect(gymTodayFee(s)).toBe(0);
  });

  it("같은 달에 두 번 사지 못한다", () => {
    const s = createInitialState();
    s.money = GYM_PASS_FEE * 3;
    expect(buyGymPass(s)).toBe("ok");
    const after = s.money;
    expect(buyGymPass(s)).toBe("already");
    expect(s.money, "실패했는데 돈이 빠졌다").toBe(after);
  });

  it("달이 바뀌면 정기권이 만료된다", () => {
    const s = createInitialState();
    s.money = GYM_PASS_FEE;
    buyGymPass(s);

    const bought = monthKey(s.day);
    s.day += 32;
    expect(monthKey(s.day), "달이 안 넘어갔다").not.toBe(bought);

    expect(hasGymPass(s)).toBe(false);
    expect(gymTodayFee(s)).toBe(GYM_DAY_FEE);
  });

  /** NaN은 JSON에서 null로 직렬화돼 키가 존재한 채 merge를 통과한다 — ??로는 못 잡는다. */
  it("정기권 달이 손상돼도 크래시하지 않는다", () => {
    const s = createInitialState();
    s.gymPassMonth = Number.NaN;
    expect(() => hasGymPass(s)).not.toThrow();
    expect(hasGymPass(s)).toBe(false);
  });
});
