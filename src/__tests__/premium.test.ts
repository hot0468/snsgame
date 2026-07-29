import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { dateOfMonth } from "@/systems/calendar";
import {
  FOLLOWER_MONTHLY_RATE,
  PREMIUM_BREAKEVEN_FOLLOWERS,
  PREMIUM_FOLLOWER_MULTIPLIER,
  PREMIUM_MONTHLY_FEE,
  monthlyFollowerIncome,
  settleMonthlyIncome,
} from "@/systems/economy";

/**
 * 트위터 프리미엄: 팔로워 수익 2배 + 매월 1일 구독료.
 * 청구가 settleMonthlyIncome 한 곳에만 있어야 하고(이중 청구 금지),
 * 잔고가 모자라면 빚을 지우는 대신 해지되어야 한다.
 */

/** dateOfMonth가 1인 첫 day를 찾는다(달력 시작일이 바뀌어도 테스트가 안 깨지게). */
function firstDayOfMonth(): number {
  for (let d = 1; d <= 400; d++) if (dateOfMonth(d) === 1) return d;
  throw new Error("1일을 못 찾았다");
}

function stateWith(followers: number, money: number, premium: boolean) {
  const s = createInitialState();
  s.accounts[0].followers = followers;
  s.money = money;
  s.premium = premium;
  s.day = firstDayOfMonth();
  s.lastIncomeSettleMonth = -1; // 이번 달 미정산 상태로
  return s;
}

describe("트위터 프리미엄", () => {
  it("구독 중이면 팔로워 수익이 2배다", () => {
    const plain = stateWith(1000, 0, false);
    const prem = stateWith(1000, 0, true);
    expect(monthlyFollowerIncome(plain)).toBe(1000 * FOLLOWER_MONTHLY_RATE);
    expect(monthlyFollowerIncome(prem)).toBe(
      monthlyFollowerIncome(plain) * PREMIUM_FOLLOWER_MULTIPLIER,
    );
  });

  it("손익분기 팔로워 수를 넘기면 정산 후 잔고가 미가입보다 많다", () => {
    const n = PREMIUM_BREAKEVEN_FOLLOWERS + 1;
    const prem = stateWith(n, 0, true);
    const plain = stateWith(n, 0, false);
    settleMonthlyIncome(prem);
    settleMonthlyIncome(plain);
    expect(prem.money).toBeGreaterThan(plain.money);
    expect(prem.premium).toBe(true);
  });

  it("손익분기 미만이면 구독이 손해다 (문구가 거짓말이 되지 않게)", () => {
    const n = PREMIUM_BREAKEVEN_FOLLOWERS - 1;
    const prem = stateWith(n, PREMIUM_MONTHLY_FEE, true);
    const plain = stateWith(n, PREMIUM_MONTHLY_FEE, false);
    settleMonthlyIncome(prem);
    settleMonthlyIncome(plain);
    expect(prem.money).toBeLessThan(plain.money);
  });

  it("정산일에 구독료가 딱 한 번 빠진다 (같은 달 재호출은 무시)", () => {
    const s = stateWith(0, 100_000, true);
    settleMonthlyIncome(s);
    expect(s.money).toBe(100_000 - PREMIUM_MONTHLY_FEE);
    settleMonthlyIncome(s);
    expect(s.money).toBe(100_000 - PREMIUM_MONTHLY_FEE);
  });

  it("잔고가 모자라면 빚을 지지 않고 자동 해지된다", () => {
    const s = stateWith(0, PREMIUM_MONTHLY_FEE - 1, true);
    settleMonthlyIncome(s);
    expect(s.premium).toBe(false);
    expect(s.money).toBe(PREMIUM_MONTHLY_FEE - 1);
  });

  it("미가입 상태에서는 구독료가 빠지지 않는다", () => {
    const s = stateWith(0, 100_000, false);
    settleMonthlyIncome(s);
    expect(s.money).toBe(100_000);
  });
});
