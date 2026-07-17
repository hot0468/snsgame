import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { EVENING_SLOT, LATE_SLOT, MORNING_SLOT, getActiveAccount } from "@/core/state";
import { calcTweetOutcome, TWEET_CONV_RATE } from "@/systems/followers";
import { postTweet, postScamTweet } from "@/systems/tweetSystem";
import { advanceTime } from "@/systems/time";
import { ALL_ATTRIBUTE_IDS, getAffinity } from "@/data/attributes";
import { SKILL_STAT_IDS } from "@/data/stats";

/**
 * 트윗 밸런스 핵심 계약 회귀 테스트.
 *
 * 이 파일이 지키는 것 — 전부 typecheck를 통과하며 조용히 뒤집힌다:
 *  1. convRate가 스킬과 무관하다(예전엔 스킬이 skillMul·convRate 두 군데에 곱해져 58배였다).
 *  2. 스킬 999 대 0의 팔로워 격차가 10배 이내(이번 수정의 핵심 — 8배로 측정됐다).
 *  3. 트윗(일반·사기)이 슬롯을 진행시키지 않는다(행동력만 쓴다).
 *  4. advanceTime 저녁→심야 진입 시 sleepPending이 서고, 아침→저녁엔 안 선다.
 */

function withSkills(v: number) {
  const s = createInitialState();
  s.resources.reputation = 100; // reputationFactor=1로 고정
  for (const k of SKILL_STAT_IDS) s.skills[k] = v;
  return s;
}

// 궁합이 0인 (계정성향, 트윗성향) 쌍을 하나 찾는다 — affinityBonus를 0으로 만들어 convRate만 남긴다.
function neutralPair(): [string, string] {
  for (const a of ALL_ATTRIBUTE_IDS) {
    for (const b of ALL_ATTRIBUTE_IDS) {
      if (getAffinity(a as any, b as any) === 0) return [a, b];
    }
  }
  throw new Error("궁합 0 쌍을 못 찾음");
}

describe("convRate — 스킬과 무관한 상수", () => {
  it("TWEET_CONV_RATE는 0.32 상수다", () => {
    expect(TWEET_CONV_RATE).toBe(0.32);
  });

  it("궁합 0에서 팔로워/RT 비율이 스킬 0·999에서 같다(≈0.32)", () => {
    const [a, b] = neutralPair();
    const ratio = (skill: number) => {
      const s = withSkills(skill);
      getActiveAccount(s).attribute = a as any;
      let f = 0;
      let r = 0;
      for (let i = 0; i < 4000; i++) {
        const o = calcTweetOutcome(s, b as any);
        f += o.followers;
        r += o.retweets;
      }
      return f / r;
    };
    // affinityBonus=0이므로 followers ≈ round(retweets*0.32). 양쪽 다 0.32 근처여야 한다.
    expect(ratio(0)).toBeCloseTo(0.32, 1);
    expect(ratio(999)).toBeCloseTo(0.32, 1);
  });
});

describe("스킬 격차 — 999 대 0 팔로워 10배 이내(58배였다)", () => {
  it("최적 궁합에서 평균 팔로워 격차가 10배 이내", () => {
    const attr = "daily";
    const avg = (skill: number) => {
      const s = withSkills(skill);
      getActiveAccount(s).attribute = attr; // 동일 성향 → 궁합 최대(1)
      let sum = 0;
      const N = 12000;
      for (let i = 0; i < N; i++) sum += calcTweetOutcome(s, attr).followers;
      return sum / N;
    };
    const gap = avg(999) / avg(0);
    expect(gap, `격차 ${gap.toFixed(1)}배`).toBeLessThanOrEqual(10);
  });
});

describe("트윗은 슬롯을 진행시키지 않는다", () => {
  it("postTweet이 state.slot을 바꾸지 않는다", () => {
    for (const slot of [MORNING_SLOT, EVENING_SLOT, LATE_SLOT]) {
      const s = createInitialState();
      s.slot = slot;
      postTweet(s, "daily", "테스트 트윗", false);
      expect(s.slot, `슬롯 ${slot}`).toBe(slot);
    }
  });

  it("postScamTweet도 state.slot을 바꾸지 않는다", () => {
    for (const slot of [MORNING_SLOT, EVENING_SLOT, LATE_SLOT]) {
      const s = createInitialState();
      s.slot = slot;
      postScamTweet(s, "사기 트윗");
      expect(s.slot, `슬롯 ${slot}`).toBe(slot);
    }
  });
});

describe("sleepPending — 저녁→심야 전환에만 선다", () => {
  it("저녁→심야 진입 시 sleepPending이 true", () => {
    const s = createInitialState();
    s.slot = EVENING_SLOT;
    s.sleepPending = false;
    advanceTime(s, 1);
    expect(s.slot).toBe(LATE_SLOT);
    expect(s.sleepPending).toBe(true);
  });

  it("아침→저녁 전환엔 sleepPending이 서지 않는다", () => {
    const s = createInitialState();
    s.slot = MORNING_SLOT;
    s.sleepPending = false;
    advanceTime(s, 1);
    expect(s.slot).toBe(EVENING_SLOT);
    expect(s.sleepPending).toBe(false);
  });
});
