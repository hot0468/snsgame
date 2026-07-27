import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { maxPostSlots, currentMaxPostSlots, MAX_POST_SLOTS } from "@/systems/followers";
import {
  canPostBySlot,
  consumePostSlot,
  ensurePostSlotDay,
  remainingPostSlots,
} from "@/systems/eggs";
import { postTweet, postScamTweet } from "@/systems/tweetSystem";

/**
 * 게시 슬롯(트윗 전용 일일 예산) 회귀 테스트.
 * 슬롯은 행동력과 무관한 별도 카운터이고, free 게시는 슬롯을 갉지 않으며, 하루가 바뀌면 리셋된다.
 */

describe("maxPostSlots 곡선 경계값", () => {
  it("팔로워 구간마다 슬롯이 계단식으로 오른다", () => {
    expect(maxPostSlots(0)).toBe(1);
    expect(maxPostSlots(19)).toBe(1);
    expect(maxPostSlots(20)).toBe(2);
    expect(maxPostSlots(100)).toBe(3);
    expect(maxPostSlots(500)).toBe(4);
    expect(maxPostSlots(2_000)).toBe(5);
    expect(maxPostSlots(10_000)).toBe(6);
  });
  it("매우 큰 값이면 상한 10에 닿고 넘지 않는다", () => {
    expect(maxPostSlots(1_000_000)).toBe(10);
    expect(maxPostSlots(9_999_999_999)).toBe(MAX_POST_SLOTS);
    expect(maxPostSlots(1e18)).toBeLessThanOrEqual(MAX_POST_SLOTS);
  });
  it("음수·NaN은 최소 슬롯 1로 폴백한다", () => {
    expect(maxPostSlots(-5)).toBe(1);
    expect(maxPostSlots(NaN)).toBe(1);
  });
});

describe("remainingPostSlots / consume", () => {
  it("소비한 만큼 줄고 음수로 내려가지 않는다", () => {
    const s = createInitialState(); // 팔로워 0 → 슬롯 1
    expect(maxPostSlots(getActiveAccount(s).followers)).toBe(1);
    expect(remainingPostSlots(s)).toBe(1);
    expect(canPostBySlot(s)).toBe(true);

    consumePostSlot(s);
    expect(remainingPostSlots(s)).toBe(0);
    expect(canPostBySlot(s)).toBe(false);

    // 초과 소비해도 remaining은 0 밑으로 안 간다
    consumePostSlot(s);
    expect(remainingPostSlots(s)).toBe(0);
  });

  it("하루가 바뀌면 리셋된다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 100; // 슬롯 3
    consumePostSlot(s);
    consumePostSlot(s);
    expect(remainingPostSlots(s)).toBe(1);

    s.day += 1; // 다음 날
    // 순수 읽기만으로도 지난 소비량은 0으로 간주 → 만충
    expect(remainingPostSlots(s)).toBe(3);
    // 리셋 후 첫 소비는 1개분
    consumePostSlot(s);
    expect(remainingPostSlots(s)).toBe(2);
    // 게시 슬롯 예산은 전 계정 공유(전역 필드).
    expect(s.postSlotsDay).toBe(s.day);
  });

  it("'오늘 게시 X/Y' 인디케이터는 계정이 여러 개여도 음수가 안 된다", () => {
    const s = createInitialState();
    const me = getActiveAccount(s);
    me.followers = 20; // 활성 계정만 보면 슬롯 2
    s.accounts.push({ ...me, id: "acc2", handle: "sub", followers: 5_000 }); // 합계 5,020 → 슬롯 5

    // ⚠️ 상한을 활성 계정 팔로워로 잡으면 잔여(합계 기준)보다 작아져 분자가 음수가 된다("-3/2" 버그).
    expect(maxPostSlots(me.followers)).toBeLessThan(remainingPostSlots(s));
    // 합계 기준 상한을 쓰면 사용량은 항상 0 이상.
    expect(currentMaxPostSlots(s) - remainingPostSlots(s)).toBe(0);
    consumePostSlot(s);
    expect(currentMaxPostSlots(s) - remainingPostSlots(s)).toBe(1);
  });

  it("ensurePostSlotDay는 날짜가 같으면 소비량을 보존한다", () => {
    const s = createInitialState();
    consumePostSlot(s);
    ensurePostSlotDay(s);
    expect(s.postSlotsUsed).toBe(1);
  });
});

describe("게시 경로 슬롯 소비", () => {
  it("일반 트윗은 슬롯 1 소비, 사기 트윗도 소비", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 2_000; // 슬롯 5
    const before = remainingPostSlots(s);
    postTweet(s, "daily", "테스트 트윗", false);
    expect(remainingPostSlots(s)).toBe(before - 1);

    postScamTweet(s, "사기 트윗");
    expect(remainingPostSlots(s)).toBe(before - 2);
  });

  it("free 게시(opts.free)는 슬롯을 소비하지 않는다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 2_000;
    const before = remainingPostSlots(s);
    postTweet(s, "daily", "무료 트윗", false, "meetup", 1, { free: true });
    expect(remainingPostSlots(s)).toBe(before);
    expect(s.postSlotsUsed).toBe(0);
  });
});
