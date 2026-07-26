import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { MARKET_ASSETS } from "@/data/market";
import { buyAsset, sellAsset, assetPrice } from "@/systems/market";

describe("증권 첫 매매 → 재테크계 해금", () => {
  it("매수하면 재테크계가 즉시 해금된다", () => {
    const s = createInitialState();
    const id = MARKET_ASSETS[0].id;
    s.money = assetPrice(s, id) * 5 + 1_000_000; // 충분한 잔고
    expect(getActiveAccount(s).unlockedAttributes).not.toContain("finance");
    const bought = buyAsset(s, id, 1);
    expect(bought).toBe(1);
    expect(getActiveAccount(s).unlockedAttributes).toContain("finance");
  });

  it("매도로도 해금되고, 이미 열렸으면 중복 추가되지 않는다", () => {
    const s = createInitialState();
    const id = MARKET_ASSETS[0].id;
    s.market.holdings[id] = 3;
    sellAsset(s, id, 1);
    const acc = getActiveAccount(s);
    expect(acc.unlockedAttributes.filter((a) => a === "finance").length).toBe(1);
    sellAsset(s, id, 1); // 두 번째 거래 — 중복 없음
    expect(acc.unlockedAttributes.filter((a) => a === "finance").length).toBe(1);
  });
});
