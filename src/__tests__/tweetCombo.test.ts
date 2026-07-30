import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { postTweet, comboMultiplier, comboControversy } from "@/systems/tweetSystem";
import { COMBO_MAX_STEP } from "@/data/tweetFun";

/**
 * 연속 트윗 콤보 계약.
 *  1. 같은 갈래를 연달아 올리면 연타 수가 오르고, 다른 갈래를 올리면 1로 리셋된다.
 *  2. 배수·논란 가산은 COMBO_MAX_STEP에서 멈춘다(무한 눈덩이 방지).
 */
describe("연속 트윗 콤보", () => {
  it("같은 갈래는 누적, 다른 갈래는 리셋", () => {
    const s = createInitialState();
    s.resources.action = 100;
    expect(postTweet(s, "daily", "1", false, "meetup", 1, { free: true }).streak).toBe(1);
    expect(postTweet(s, "daily", "2", false, "meetup", 1, { free: true }).streak).toBe(2);
    expect(postTweet(s, "daily", "3", false, "meetup", 1, { free: true }).streak).toBe(3);
    // 갈래를 바꾸면 리셋
    expect(postTweet(s, "fitness", "4", false, "meetup", 1, { free: true }).streak).toBe(1);
    expect(s.tweetStreak).toEqual({ attr: "fitness", count: 1 });
  });

  it("배수·논란 가산은 상한에서 멈춘다", () => {
    expect(comboMultiplier(1)).toBe(1);
    expect(comboControversy(1)).toBe(0);
    expect(comboMultiplier(2)).toBeGreaterThan(comboMultiplier(1));
    expect(comboMultiplier(COMBO_MAX_STEP + 10)).toBe(comboMultiplier(COMBO_MAX_STEP));
    expect(comboControversy(COMBO_MAX_STEP + 10)).toBe(comboControversy(COMBO_MAX_STEP));
  });
});
