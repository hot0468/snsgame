import { describe, it, expect, vi, afterEach } from "vitest";
import { createInitialState } from "@/core/state";
import { calcTweetOutcome, TWEET_KIND_EFFECTS } from "@/systems/followers";
import { postTweet } from "@/systems/tweetSystem";
import { kindTemplatesFor } from "@/data/tweets";
import { LONG_TWEETS } from "@/data/longTweets";
import { MEDIA_TWEET_SETS } from "@/data/mediaTweets";
import { makeMedia } from "@/data/media";

/**
 * 트윗 성격 4종(plain/provoke/info/emotional)의 방향성 회귀.
 * Math.random 의존 부분은 상수로 고정(0.5)해 결정론적으로 비교한다.
 */

afterEach(() => vi.restoreAllMocks());

describe("성격별 도달·분산 방향성", () => {
  it("도달: info < plain < emotional < provoke (같은 seed에서)", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.5);
    const s = createInitialState();
    const likes = (k: Parameters<typeof calcTweetOutcome>[2]) =>
      calcTweetOutcome(s, "daily", k).likes;
    expect(likes("info")).toBeLessThan(likes("plain"));
    expect(likes("plain")).toBeLessThan(likes("emotional"));
    expect(likes("emotional")).toBeLessThan(likes("provoke"));
  });

  it("자극은 분산(대박/폭망 폭)이 무난보다 크다", () => {
    expect(TWEET_KIND_EFFECTS.provoke.varRange).toBeGreaterThan(TWEET_KIND_EFFECTS.plain.varRange);
  });
});

describe("성격별 게시 부수효과", () => {
  it("정보는 평판·지식을 올린다", () => {
    const s = createInitialState();
    s.resources.reputation = 50; // 상한 100에 막히지 않게 낮춰둔다
    const rep0 = s.resources.reputation;
    const kn0 = s.skills.knowledge;
    postTweet(s, "daily", "정보성 트윗", false, "meetup", 1, { kind: "info", free: true });
    expect(s.resources.reputation).toBeGreaterThan(rep0);
    expect(s.skills.knowledge).toBeGreaterThan(kn0);
  });

  it("자극은 평판을 소폭 깎는다", () => {
    const s = createInitialState();
    const rep0 = s.resources.reputation;
    postTweet(s, "daily", "자극적 트윗", false, "meetup", 1, { kind: "provoke", free: true });
    expect(s.resources.reputation).toBeLessThan(rep0);
  });

  it("무난은 평판·지식을 건드리지 않는다(특수 모드 = 기존 동작)", () => {
    const s = createInitialState();
    const rep0 = s.resources.reputation;
    const kn0 = s.skills.knowledge;
    // kind 미지정 = plain 폴백(특수 모드 경로와 동일)
    postTweet(s, "daily", "무난 트윗", false, "meetup", 1, { free: true });
    expect(s.resources.reputation).toBe(rep0);
    expect(s.skills.knowledge).toBe(kn0);
  });

  /**
   * ⚠️ **트레이드오프 계약.** 감성은 도달이 무난보다 높은 대신 정신력을 낸다.
   *    이 대가가 사라지면 감성이 무난의 완전 상위호환이 되어(도달 1.2배 · 페널티 0)
   *    4장 중 3장을 누를 이유가 없어진다 — 실제로 그 상태였던 걸 고친 것이다.
   */
  it("감성은 정신력을 소모한다(도달이 높은 대가)", () => {
    const s = createInitialState();
    s.resources.mental = 50; // 0에 막히지 않게
    const m0 = s.resources.mental;
    postTweet(s, "daily", "감성 트윗", false, "meetup", 1, { kind: "emotional", free: true });
    expect(s.resources.mental).toBeLessThan(m0);
  });

  it("자극도 정신력을 소모한다(도달 최고의 대가)", () => {
    const s = createInitialState();
    s.resources.mental = 50;
    const m0 = s.resources.mental;
    postTweet(s, "daily", "자극 트윗", false, "meetup", 1, { kind: "provoke", free: true });
    expect(s.resources.mental).toBeLessThan(m0);
  });

  /** 무난이 존재할 이유 — 유일하게 아무것도 잃지 않는 카드여야 한다. */
  it("무난·정보는 정신력을 깎지 않는다", () => {
    for (const kind of ["plain", "info"] as const) {
      const s = createInitialState();
      s.resources.mental = 50;
      const m0 = s.resources.mental;
      postTweet(s, "daily", `${kind} 트윗`, false, "meetup", 1, { kind, free: true });
      expect(s.resources.mental, kind).toBe(m0);
    }
  });

  it("어떤 성격도 다른 성격의 완전 상위호환이 아니다", () => {
    // 도달이 더 높으면 반드시 어딘가에서 대가를 낸다(정신력·평판·논란 중 하나).
    const kinds = ["plain", "provoke", "info", "emotional"] as const;
    for (const a of kinds) {
      for (const b of kinds) {
        if (a === b) continue;
        const A = TWEET_KIND_EFFECTS[a];
        const B = TWEET_KIND_EFFECTS[b];
        if (A.reachMul <= B.reachMul) continue;
        // A가 B보다 도달이 높다 → A는 B보다 무언가를 더 잃어야 한다.
        const aCost =
          -A.mentalDelta + -A.reputationDelta + A.controversyBonus * 100 - A.knowledgeDelta;
        const bCost =
          -B.mentalDelta + -B.reputationDelta + B.controversyBonus * 100 - B.knowledgeDelta;
        expect(aCost, `${a}가 ${b}의 상위호환이다`).toBeGreaterThan(bCost);
      }
    }
  });

  it("정신력이 0이면 감성을 써도 음수로 안 내려간다", () => {
    const s = createInitialState();
    s.resources.mental = 0;
    postTweet(s, "daily", "감성 트윗", false, "meetup", 1, { kind: "emotional", free: true });
    expect(s.resources.mental).toBeGreaterThanOrEqual(0);
  });

  it("자극은 논란 확률이 붙어, 고정 seed에서 무난은 안 터지고 자극은 터진다", () => {
    // 평판을 높여 기반 논란확률(reputation<45) 0으로 만든 뒤 성격 효과만 남긴다.
    vi.spyOn(Math, "random").mockReturnValue(0.05); // < provoke 0.12, == plain 0

    const plain = createInitialState();
    plain.resources.reputation = 90;
    postTweet(plain, "daily", "무난", false, "meetup", 1, { kind: "plain", free: true });
    expect(plain.pendingControversy).toBeFalsy();

    const prov = createInitialState();
    prov.resources.reputation = 90;
    postTweet(prov, "daily", "자극", false, "meetup", 1, { kind: "provoke", free: true });
    expect(prov.pendingControversy).toBeTruthy();
  });
});

describe("kindTemplatesFor 폴백", () => {
  it("성격 풀이 비면 positive+negative로 폴백해 항상 후보가 나온다", () => {
    // content 미완성(kinds 없음) 상태에서도 4성격 모두 비지 않음
    for (const k of ["plain", "provoke", "info", "emotional"] as const) {
      expect(kindTemplatesFor("daily", k).length).toBeGreaterThan(0);
    }
  });
});

describe("kindTemplatesFor 롱/미디어 머지", () => {
  it("kind 태깅된 롱트윗·미디어세트 text가 그 성격 풀에 섞인다", () => {
    const longMark = "__TEST_LONG_EMOTIONAL__";
    const mediaMark = "__TEST_MEDIA_INFO__";
    LONG_TWEETS.daily.push({ text: longMark, tone: "positive", kind: "emotional" });
    MEDIA_TWEET_SETS.daily.push({
      text: mediaMark,
      tone: "positive",
      media: makeMedia("daily"),
      mentions: [],
      kind: "info",
    });
    try {
      expect(kindTemplatesFor("daily", "emotional")).toContain(longMark);
      expect(kindTemplatesFor("daily", "info")).toContain(mediaMark);
      // 다른 성격 풀엔 안 새어든다
      expect(kindTemplatesFor("daily", "provoke")).not.toContain(longMark);
      expect(kindTemplatesFor("daily", "provoke")).not.toContain(mediaMark);
    } finally {
      LONG_TWEETS.daily.pop();
      MEDIA_TWEET_SETS.daily.pop();
    }
  });
});
