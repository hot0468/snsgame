import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { MARKET_ASSETS } from "@/data/market";
import {
  assetProfit,
  avgCostOf,
  buyAsset,
  costOf,
  holdingOf,
  sellAsset,
  totalProfit,
} from "@/systems/market";
import { loadGame } from "@/systems/save";

/**
 * 종목별 평가손익. 매수 원가(market.cost)를 이동평균법으로 관리한다.
 * 원가가 어긋나면 화면의 손익이 통째로 거짓말이 되므로, 매수/추가매수/부분매도/전량매도를
 * 순서대로 밟아 원가가 정확히 따라오는지 고정한다.
 */

const ID = "samsong";

function stateWithCash(money: number) {
  const s = createInitialState();
  s.money = money;
  return s;
}

describe("종목별 평가손익", () => {
  it("매수하면 지불액이 그대로 원가가 되고 손익은 0에서 시작한다", () => {
    const s = stateWithCash(10_000_000);
    const price = s.market.prices[ID];

    buyAsset(s, ID, 10);
    expect(costOf(s, ID)).toBe(price * 10);
    expect(avgCostOf(s, ID)).toBe(price);
    expect(assetProfit(s, ID).profit).toBe(0);
    expect(assetProfit(s, ID).pct).toBe(0);
  });

  it("추가 매수하면 평단가가 두 가격의 가중평균이 된다", () => {
    const s = stateWithCash(100_000_000);
    s.market.prices[ID] = 100_000;
    buyAsset(s, ID, 10); // 원가 100만
    s.market.prices[ID] = 200_000;
    buyAsset(s, ID, 10); // 원가 200만

    expect(holdingOf(s, ID)).toBe(20);
    expect(costOf(s, ID)).toBe(3_000_000);
    expect(avgCostOf(s, ID)).toBe(150_000); // (100k+200k)/2
    // 현재가 20만 × 20주 = 400만, 원가 300만 → +100만 (+33.3%)
    const p = assetProfit(s, ID);
    expect(p.value).toBe(4_000_000);
    expect(p.profit).toBe(1_000_000);
    expect(p.pct).toBeCloseTo(33.33, 1);
  });

  it("부분 매도는 평단가를 유지한 채 원가만 비율로 덜어낸다", () => {
    const s = stateWithCash(100_000_000);
    s.market.prices[ID] = 100_000;
    buyAsset(s, ID, 10); // 원가 100만, 평단 10만

    s.market.prices[ID] = 300_000;
    sellAsset(s, ID, 4); // 6주 남음

    expect(holdingOf(s, ID)).toBe(6);
    expect(avgCostOf(s, ID)).toBeCloseTo(100_000, 6); // 평단은 그대로
    expect(costOf(s, ID)).toBeCloseTo(600_000, 6);
    expect(assetProfit(s, ID).profit).toBeCloseTo(1_200_000, 6); // 6×30만 - 60만
  });

  it("전량 매도하면 원가가 정확히 0이 된다(부동소수 잔여 금지)", () => {
    const s = stateWithCash(100_000_000);
    s.market.prices[ID] = 33_333; // 나누어떨어지지 않는 값
    buyAsset(s, ID, 7);
    sellAsset(s, ID, 3);
    sellAsset(s, ID, 4);

    expect(holdingOf(s, ID)).toBe(0);
    expect(costOf(s, ID)).toBe(0); // toBeCloseTo가 아니라 정확히 0이어야 한다
    expect(assetProfit(s, ID)).toEqual({ value: 0, profit: 0, pct: 0 });
  });

  it("미보유 종목은 평단가·손익이 모두 0이다(0으로 나누기 금지)", () => {
    const s = createInitialState();
    for (const a of MARKET_ASSETS) {
      expect(avgCostOf(s, a.id)).toBe(0);
      expect(assetProfit(s, a.id).pct).toBe(0);
      expect(Number.isFinite(assetProfit(s, a.id).pct)).toBe(true);
    }
    expect(totalProfit(s).profit).toBe(0);
  });

  it("총 평가손익은 종목별 손익의 합이다", () => {
    const s = stateWithCash(5_000_000_000);
    const a = MARKET_ASSETS[0];
    const b = MARKET_ASSETS[1];
    buyAsset(s, a.id, 5);
    buyAsset(s, b.id, 3);
    s.market.prices[a.id] *= 2;
    s.market.prices[b.id] = Math.round(s.market.prices[b.id] / 2);

    const sum = assetProfit(s, a.id).profit + assetProfit(s, b.id).profit;
    expect(totalProfit(s).profit).toBeCloseTo(sum, 6);
  });

  it("원가가 없던 구세이브는 '지금 산 셈'(손익 0)으로 복구된다", () => {
    const raw = createInitialState() as any;
    raw.market.holdings[ID] = 4;
    delete raw.market.cost; // 구세이브엔 cost 자체가 없다

    const s = loadGame(JSON.stringify(raw))!;
    expect(s.market.cost[ID]).toBe(4 * s.market.prices[ID]);
    expect(assetProfit(s, ID).profit).toBe(0); // 없는 과거를 지어내지 않는다
  });
});
