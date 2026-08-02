import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { TWEET_KINDS, kindTemplatesFor, SOUL_TWEETS } from "@/data/tweets";
import {
  SOUL_MENTAL_COST,
  TWEET_KIND_EFFECTS,
  calcTweetOutcome,
  canWriteSoul,
} from "@/systems/followers";
import { postTweet } from "@/systems/tweetSystem";
import { mentalMax } from "@/systems/stats";
import type { GameState } from "@/core/types";

/**
 * '진심' 트윗 성격 회귀 테스트.
 *
 * 왜 넣었나: 정신력 상한을 145까지 열어놨는데 크게 쓰는 곳이 콜센터뿐이라
 * 그릇만 크고 안 쓰는 자원이 되어 있었다. 자원을 걸고 한 방을 노리는 선택지를 만든다.
 *
 * 고정하는 불변식:
 *  1) **도달이 가장 크다** — 대가를 내는 카드가 제일 세지 않으면 아무도 안 고른다.
 *  2) **정신력을 실제로 낸다** — 공짜면 무난의 상위호환이 되어 5장 중 4장이 죽는다.
 *  3) **정신력이 모자라면 못 쓴다** — 0까지 깎여 우울 모드에 갇히는 걸 막는다.
 *  4) 문구 풀이 항상 비어 있지 않다(갈래별 kinds.soul을 안 채워도).
 */

function withMental(m: number): GameState {
  const s = createInitialState();
  s.resources.mental = m;
  return s;
}

describe("성격 목록", () => {
  it("진심이 성격 목록에 있다", () => {
    expect(TWEET_KINDS).toContain("soul");
  });

  it("모든 성격에 효과가 정의돼 있다", () => {
    for (const k of TWEET_KINDS) {
      expect(TWEET_KIND_EFFECTS[k], k).toBeTruthy();
    }
  });
});

describe("트레이드오프", () => {
  it("도달이 다른 어떤 성격보다 크다", () => {
    const soul = TWEET_KIND_EFFECTS.soul.reachMul;
    for (const k of TWEET_KINDS) {
      if (k === "soul") continue;
      expect(soul, `${k}보다 커야 한다`).toBeGreaterThan(TWEET_KIND_EFFECTS[k].reachMul);
    }
  });

  it("정신력을 다른 어떤 성격보다 많이 낸다", () => {
    const soul = TWEET_KIND_EFFECTS.soul.mentalDelta;
    expect(soul).toBeLessThan(0);
    for (const k of TWEET_KINDS) {
      if (k === "soul") continue;
      expect(soul, `${k}보다 많이 내야 한다`).toBeLessThan(TWEET_KIND_EFFECTS[k].mentalDelta);
    }
  });

  it("무난은 여전히 아무것도 안 잃는다 — 정신력이 빠듯할 때의 자리", () => {
    const p = TWEET_KIND_EFFECTS.plain;
    expect(p.mentalDelta).toBe(0);
    expect(p.reputationDelta).toBe(0);
    expect(p.controversyBonus).toBe(0);
  });

  it("실제 성과가 무난보다 크게 나온다", () => {
    const avg = (kind: "plain" | "soul") => {
      const s = createInitialState();
      getActiveAccount(s).followers = 10_000;
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += calcTweetOutcome(s, "daily", kind).likes;
      return sum / 200;
    };
    expect(avg("soul")).toBeGreaterThan(avg("plain") * 1.5);
  });
});

describe("정신력 게이트", () => {
  it("정신력이 대가보다 적으면 못 쓴다", () => {
    expect(canWriteSoul(withMental(SOUL_MENTAL_COST - 1))).toBe(false);
    expect(canWriteSoul(withMental(SOUL_MENTAL_COST))).toBe(true);
  });

  it("게시하면 정신력이 실제로 깎인다", () => {
    const s = withMental(100);
    postTweet(s, "daily", "진심", false, "meetup", 1, { free: true, kind: "soul" });
    expect(s.resources.mental).toBe(100 - SOUL_MENTAL_COST);
  });

  it("정신력을 늘려둔 만큼 연속으로 더 쓸 수 있다 — 상한을 연 목적", () => {
    const count = (bonus: number) => {
      const s = createInitialState();
      s.mentalMaxBonus = bonus;
      s.resources.mental = mentalMax(s);
      let n = 0;
      while (canWriteSoul(s)) {
        postTweet(s, "daily", "진심", false, "meetup", 1, { free: true, kind: "soul" });
        n += 1;
      }
      return n;
    };
    expect(count(45)).toBeGreaterThan(count(0));
  });
});

describe("문구", () => {
  it("공용 풀이 비어 있지 않다", () => {
    expect(SOUL_TWEETS.length).toBeGreaterThan(0);
  });

  it("어떤 갈래로 고르든 진심 문구가 나온다", () => {
    // 갈래별 kinds.soul을 안 채워도 공용 풀 덕에 항상 후보가 있어야 한다.
    for (const attr of ["daily", "it", "beauty", "gaming"] as const) {
      const pool = kindTemplatesFor(attr, "soul");
      expect(pool.length, attr).toBeGreaterThan(0);
      expect(
        pool.some((t) => SOUL_TWEETS.includes(t)),
        `${attr}: 공용 진심 문구가 섞여 있어야 한다`,
      ).toBe(true);
    }
  });

  it("진심 문구는 길다 — 혼을 갈아넣는 글이라는 톤", () => {
    for (const t of SOUL_TWEETS) {
      expect(t.length, t.slice(0, 20)).toBeGreaterThan(60);
    }
  });
});
