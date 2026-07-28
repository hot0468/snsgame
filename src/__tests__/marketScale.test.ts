import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { MARKET_ASSETS, initialMarket } from "@/data/market";
import { assetPrice, buyAsset, portfolioValue, updateMarket } from "@/systems/market";
import { loadGame } from "@/systems/save";

/**
 * 목돈(로또 1등 20억 등)이 갈 곳이 있어야 한다.
 * 억 단위 자산이 사라지면 최고가가 비트콘 380만으로 돌아가 20억이 그냥 잠긴다.
 * 구세이브에 없는 신규 종목이 0원으로 새는 경로(0원 매수 → 시세 반영 후 매도)도 함께 막는다.
 */

const LOTTO_PRIZE = 2_000_000_000;

describe("투자 시장 스케일", () => {
  it("억 단위 자산이 존재하고 20억을 한 자릿수 매수로 소화할 수 있다", () => {
    const big = MARKET_ASSETS.filter((a) => a.basePrice >= 100_000_000);
    expect(big.length).toBeGreaterThanOrEqual(3);

    // 가장 비싼 종목 기준으로 20억이 10주 이내에 들어가야 한다(클릭 지옥 방지).
    const top = Math.max(...MARKET_ASSETS.map((a) => a.basePrice));
    expect(Math.ceil(LOTTO_PRIZE / top)).toBeLessThanOrEqual(10);
  });

  it("id가 중복되지 않고 initialMarket이 전 종목을 담는다", () => {
    const ids = MARKET_ASSETS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);

    const m = initialMarket();
    for (const a of MARKET_ASSETS) {
      expect(m.prices[a.id]).toBe(a.basePrice);
      expect(m.holdings[a.id]).toBe(0);
    }
  });

  it("고가 자산일수록 하루 변동 폭이 작다(억대 자산 도박화 방지)", () => {
    for (const a of MARKET_ASSETS) {
      if (a.basePrice >= 1_000_000_000) expect(a.volatility).toBeLessThanOrEqual(0.06);
    }
  });

  it("신규 종목이 없는 구세이브를 불러와도 0원에 매수되지 않는다", () => {
    // 억 단위 종목이 없던 시절의 저장본을 흉내낸다.
    const raw = createInitialState() as any;
    const legacy = { samsong: 70_000, naenom: 210_000 };
    raw.market = { prices: { ...legacy }, prevPrices: { ...legacy }, holdings: {} };

    const s = loadGame(JSON.stringify(raw));
    expect(s).not.toBeNull();

    for (const a of MARKET_ASSETS) {
      // 0원이면 공짜로 사서 다음 날 시세로 팔 수 있다 — 무한 증식 경로.
      expect(assetPrice(s!, a.id), a.id).toBeGreaterThan(0);
    }
    const target = MARKET_ASSETS.find((a) => a.basePrice >= 1_000_000_000)!;
    s!.money = 0;
    expect(buyAsset(s!, target.id, 1)).toBe(0); // 무일푼으로는 못 산다
  });

  it("보유 자산은 시세 변동에 따라 평가액이 움직인다", () => {
    const s = createInitialState();
    const target = MARKET_ASSETS.find((a) => a.basePrice >= 100_000_000)!;
    s.money = LOTTO_PRIZE;

    expect(buyAsset(s, target.id, 1)).toBe(1);
    expect(s.money).toBe(LOTTO_PRIZE - target.basePrice);
    expect(portfolioValue(s)).toBe(target.basePrice);

    updateMarket(s);
    expect(portfolioValue(s)).toBeGreaterThan(0);
  });
});
