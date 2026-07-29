import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { FIXED_AUTHOR_HANDLES } from "@/data/accounts";
import {
  HOME_FEED_COUNT,
  HOME_FEED_FIXED,
  homeFeedTweets,
} from "@/systems/exploreSystem";

/**
 * 홈(추천) 타임라인 하루치 조합 회귀 테스트.
 *
 * 이 파일이 지키는 것: 홈 피드가 매일 '랜덤 5 + 전용 문구 고정 계정 2 + 이스터에그 1'로 채워지는 것.
 * 전용 계정 칸이 확률 판정으로 되돌아가면 어떤 날은 고정 계정이 하나도 안 뜨고,
 * 문구 중복을 안 막으면 같은 문장이 한 화면에 두 번 뜬다.
 */

describe("홈 피드 하루치 조합", () => {
  it("항상 HOME_FEED_COUNT개를 오늘 날짜로 만든다", () => {
    const s = createInitialState();
    s.day = 12;
    for (let i = 0; i < 30; i++) {
      const feed = homeFeedTweets(s);
      expect(feed.length).toBe(HOME_FEED_COUNT);
      expect(feed.every((t) => t.createdDay === 12)).toBe(true);
    }
  });

  it("전용 문구 고정 계정이 매번 최소 HOME_FEED_FIXED칸 들어간다", () => {
    const s = createInitialState();
    for (let i = 0; i < 30; i++) {
      const fixed = homeFeedTweets(s).filter((t) => FIXED_AUTHOR_HANDLES.includes(t.authorHandle));
      expect(fixed.length).toBeGreaterThanOrEqual(HOME_FEED_FIXED);
    }
  });

  it("같은 문구가 한 피드에 두 번 뜨지 않는다", () => {
    const s = createInitialState();
    for (let i = 0; i < 30; i++) {
      const feed = homeFeedTweets(s);
      expect(new Set(feed.map((t) => t.text)).size).toBe(feed.length);
    }
  });
});
