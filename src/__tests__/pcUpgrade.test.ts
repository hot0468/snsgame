import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { tweetActionCost, TWEET_ACTION_COST, TWEET_ACTION_MIN } from "@/systems/tweetSystem";
import { PC_UPGRADE_ID, SHOP_ITEMS } from "@/data/shop";
import { effectivePrice } from "@/systems/shop";

describe("컴퓨터 업그레이드 — 트윗 행동력 감소", () => {
  it("기본은 TWEET_ACTION_COST, 1개당 1씩 줄고 TWEET_ACTION_MIN에서 멈춘다", () => {
    const s = createInitialState();
    expect(tweetActionCost(s)).toBe(TWEET_ACTION_COST);
    s.ownedItems.push(PC_UPGRADE_ID);
    expect(tweetActionCost(s)).toBe(TWEET_ACTION_COST - 1);
    for (let i = 0; i < 20; i++) s.ownedItems.push(PC_UPGRADE_ID);
    expect(tweetActionCost(s)).toBe(TWEET_ACTION_MIN); // 하한
  });

  it("구매할수록 다음 업그레이드 값이 오른다(보유 개수 비례)", () => {
    const s = createInitialState();
    const item = SHOP_ITEMS.find((i) => i.id === PC_UPGRADE_ID)!;
    const p0 = effectivePrice(s, item); // 0개 보유
    s.ownedItems.push(PC_UPGRADE_ID);
    const p1 = effectivePrice(s, item); // 1개 보유 → 2배
    s.ownedItems.push(PC_UPGRADE_ID);
    const p2 = effectivePrice(s, item); // 2개 보유 → 3배
    expect(p1).toBeGreaterThan(p0);
    expect(p2).toBeGreaterThan(p1);
    expect(p1).toBe(p0 * 2);
    expect(p2).toBe(p0 * 3);
  });
});
