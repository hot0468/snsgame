import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import type { GameState, Tweet } from "@/core/types";
import { exploreTweets, reactToTweet, retweetTweet } from "@/systems/exploreSystem";
import { ensureTrendBoard, getTrends, hasRiddenTrend } from "@/systems/trends";
import { FIXED_AUTHOR_HANDLES, FIXED_AUTHOR_TWEET_CHANCE } from "@/data/accounts";

/**
 * 에코챔버 피드(feedTaste)와 실검 편승 리트윗 회귀 테스트.
 * - 반응한 카테고리가 이력에 쌓이고 최근 10개로 잘린다.
 * - 그 이력이 신규 게시글 탐색 피드를 실제로 편중시킨다.
 * - 실검에 뜬 카테고리 리트윗은 트렌드를 소진하고, 같은 트렌드는 하루 1회만 먹힌다.
 */

function fakeTweet(state: GameState, attr: Tweet["attribute"], id: string): Tweet {
  return {
    id,
    authorName: "테스트",
    authorHandle: "test_" + id,
    attribute: attr,
    isAdult: false,
    text: "테스트 트윗",
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  };
}

describe("feedTaste 이력", () => {
  it("좋아요·악플·리트윗이 모두 카테고리를 남긴다", () => {
    const s = createInitialState();
    reactToTweet(s, fakeTweet(s, "gaming", "a"), true);
    reactToTweet(s, fakeTweet(s, "food", "b"), false); // 악플도 관심은 관심
    retweetTweet(s, fakeTweet(s, "cat", "c"));
    expect(s.feedTaste).toEqual(["gaming", "food", "cat"]);
  });

  it("최근 10개만 유지한다(무한 증식 방지)", () => {
    const s = createInitialState();
    for (let i = 0; i < 25; i++) reactToTweet(s, fakeTweet(s, "gaming", "t" + i), true);
    expect(s.feedTaste).toHaveLength(10);
  });
});

describe("에코챔버 피드", () => {
  it("취향 이력이 있으면 그 카테고리가 무작위보다 뚜렷하게 자주 뜬다", () => {
    const plain = createInitialState();
    const echo = createInitialState();
    echo.feedTaste = Array.from({ length: 10 }, () => "gaming" as const);

    const count = (s: GameState) => {
      let n = 0;
      for (let i = 0; i < 200; i++) {
        for (const t of exploreTweets(s)) if (t.attribute === "gaming") n++;
      }
      return n;
    };
    // 취향 이력은 exploreTweets가 읽기만 하므로 반복 호출로 오염되지 않는다.
    expect(count(echo)).toBeGreaterThan(count(plain) * 2);
  });
});

describe("전용 문구 고정 계정 노출률", () => {
  const rate = (s: GameState): number => {
    const fixed = new Set(FIXED_AUTHOR_HANDLES);
    let total = 0;
    let hit = 0;
    for (let i = 0; i < 3000; i++) {
      for (const t of exploreTweets(s)) {
        total++;
        if (fixed.has(t.authorHandle)) hit++;
      }
    }
    return hit / total;
  };

  // n=9000이라 표본오차는 ±0.5%p 수준 — ±4%p 여유면 흔들리지 않는다.
  it("선언한 확률(FIXED_AUTHOR_TWEET_CHANCE)만큼 실제로 뜬다", () => {
    const r = rate(createInitialState());
    expect(r).toBeGreaterThan(FIXED_AUTHOR_TWEET_CHANCE - 0.04);
    expect(r).toBeLessThan(FIXED_AUTHOR_TWEET_CHANCE + 0.04);
  });

  it("에코챔버가 켜져도 노출률이 깎이지 않는다", () => {
    // 고정 계정 판정이 취향 편중보다 뒤에 있으면 여기서 확 떨어진다(선언 30% → 체감 16%).
    const s = createInitialState();
    s.feedTaste = Array.from({ length: 10 }, () => "gaming" as const);
    const r = rate(s);
    expect(r).toBeGreaterThan(FIXED_AUTHOR_TWEET_CHANCE - 0.04);
  });
});

describe("실검 편승 리트윗", () => {
  it("실검 카테고리를 리트윗하면 그 트렌드가 소진되고, 두 번째부터는 안 먹힌다", () => {
    const s = createInitialState();
    ensureTrendBoard(s);
    const trend = getTrends(s)[0];
    expect(trend).toBeDefined();

    retweetTweet(s, fakeTweet(s, trend.attr, "ride1"));
    expect(hasRiddenTrend(s, trend.id)).toBe(true);

    // 같은 카테고리로 또 리트윗해도 이 트렌드가 두 번 소진되지는 않는다.
    const riddenBefore = [...(s.trendBoard?.ridden ?? [])];
    retweetTweet(s, fakeTweet(s, trend.attr, "ride2"));
    expect(s.trendBoard?.ridden.filter((id) => id === trend.id)).toEqual([trend.id]);
    expect(s.trendBoard?.ridden.length).toBeGreaterThanOrEqual(riddenBefore.length);
  });

  it("실검에 없는 카테고리는 아무 트렌드도 소진하지 않는다", () => {
    const s = createInitialState();
    ensureTrendBoard(s);
    const onBoard = new Set(getTrends(s).map((t) => t.attr));
    const off = (["plant", "travel", "cooking", "beauty"] as const).find((a) => !onBoard.has(a));
    if (!off) return; // 실검이 이 4종을 다 덮은 날은 판정 불가 — 건너뛴다
    retweetTweet(s, fakeTweet(s, off, "noride"));
    expect(s.trendBoard?.ridden).toEqual([]);
  });
});
