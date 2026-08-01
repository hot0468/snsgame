import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { loadGame } from "@/systems/save";
import { calcTweetOutcome, masteryMul, masteryTier, masteryCountOf } from "@/systems/followers";
import { postTweet, postScamTweet } from "@/systems/tweetSystem";
import {
  MASTERY_THRESHOLDS,
  MASTERY_TIER_BONUS,
  masteryTierFor,
  masteryMulFor,
  masteryNextThreshold,
  masteryTitle,
  masteryGrade,
} from "@/data/tweetMastery";

/**
 * 갈래 숙련도 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 *   ① 문턱 → tier → 배율 변환이 한 공식만 쓴다(배율을 UI가 재계산하면 여기서 어긋난다).
 *   ② 등급 배지의 오프셋(숙련 tier 0=미달 ↔ 마일스톤 등급 0=B)이 한 곳에만 있다.
 *   ③ 구세이브에 tweetMastery가 없어도 {}로 복원된다(undefined가 산술에 들어가면 NaN이
 *      되고 그 NaN이 세이브까지 오염시킨다).
 *   ④ 게시 1건이 그 갈래만 적립하고, 문턱을 넘는 트윗만 승급을 보고한다.
 *
 * ⚠️ 밸런스 값(10/40/120/300 · +8%)을 바꾸면 이 파일의 기대값도 함께 고쳐라.
 *    숫자가 여기 박혀 있는 건 의도다 — 조용한 밸런스 드리프트를 막는 장치다.
 */

const KEY = "snsgame:save:v2";
const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
});

describe("문턱 → tier", () => {
  it("문턱을 넘을 때마다 tier가 하나씩 오른다", () => {
    expect(masteryTierFor(0)).toBe(0);
    expect(masteryTierFor(9)).toBe(0);
    expect(masteryTierFor(10)).toBe(1);
    expect(masteryTierFor(39)).toBe(1);
    expect(masteryTierFor(40)).toBe(2);
    expect(masteryTierFor(119)).toBe(2);
    expect(masteryTierFor(120)).toBe(3);
    expect(masteryTierFor(299)).toBe(3);
    expect(masteryTierFor(300)).toBe(4);
    expect(masteryTierFor(99999)).toBe(4);
  });

  it("문턱 개수와 칭호 개수가 어긋나지 않는다", () => {
    expect(MASTERY_THRESHOLDS.length).toBe(4);
    expect(masteryTitle(0)).toBeNull();
    expect(masteryTitle(1)).toBe("입문");
    expect(masteryTitle(4)).toBe("전설");
    expect(masteryTitle(5)).toBeNull();
  });

  it("NaN·음수가 들어와도 tier 0으로 떨어진다", () => {
    expect(masteryTierFor(NaN)).toBe(0);
    expect(masteryTierFor(-5)).toBe(0);
  });
});

describe("tier → 배율", () => {
  it("tier당 MASTERY_TIER_BONUS만큼 오르고 만렙은 1.32배다", () => {
    expect(masteryMulFor(0)).toBeCloseTo(1.0, 5);
    expect(masteryMulFor(1)).toBeCloseTo(1 + MASTERY_TIER_BONUS, 5);
    expect(masteryMulFor(4)).toBeCloseTo(1 + MASTERY_TIER_BONUS * 4, 5);
    expect(masteryMulFor(4)).toBeCloseTo(1.32, 5);
  });

  it("음수 tier도 1.0 밑으로 내려가지 않는다", () => {
    expect(masteryMulFor(-1)).toBeCloseTo(1.0, 5);
  });
});

describe("등급 배지 · 다음 문턱", () => {
  it("tier 0은 배지가 없고 1부터 B/A/S/SS다", () => {
    expect(masteryGrade(0)).toBeNull();
    expect(masteryGrade(1)).toBe("B");
    expect(masteryGrade(2)).toBe("A");
    expect(masteryGrade(3)).toBe("S");
    expect(masteryGrade(4)).toBe("SS");
  });

  it("다음 문턱은 tier로 찾고 만렙이면 null이다", () => {
    expect(masteryNextThreshold(0)).toBe(10);
    expect(masteryNextThreshold(3)).toBe(300);
    expect(masteryNextThreshold(4)).toBeNull();
  });
});

describe("구세이브 하위호환", () => {
  it("tweetMastery가 없는 세이브도 {}로 복원된다", () => {
    const legacy: any = createInitialState();
    delete legacy.tweetMastery;
    store[KEY] = JSON.stringify(legacy);
    const loaded = loadGame();
    expect(loaded, "구세이브 로드가 null이면 안 된다").toBeTruthy();
    expect(loaded!.tweetMastery).toEqual({});
    expect(masteryTierFor(loaded!.tweetMastery.daily ?? 0)).toBe(0);
  });

  it("새 게임의 초기 숙련은 빈 객체다", () => {
    expect(createInitialState().tweetMastery).toEqual({});
  });
});

describe("숙련 → 도달 배율", () => {
  it("안 올린 갈래는 배율 1.0이다", () => {
    const s = createInitialState();
    expect(masteryCountOf(s, "daily")).toBe(0);
    expect(masteryTier(s, "daily")).toBe(0);
    expect(masteryMul(s, "daily")).toBeCloseTo(1.0, 5);
  });

  it("숙련이 오른 갈래만 배율이 오른다", () => {
    const s = createInitialState();
    s.tweetMastery.daily = 300;
    expect(masteryMul(s, "daily")).toBeCloseTo(1.32, 5);
    // 옆 갈래는 그대로 — 갈래별로 따로 파야 한다는 게 이 기능의 핵심이다.
    expect(masteryMul(s, "it")).toBeCloseTo(1.0, 5);
  });

  it("숙련 만렙 갈래는 평균 좋아요가 눈에 띄게 높다", () => {
    // calcTweetOutcome은 난수를 쓰므로 200회 평균으로 본다.
    // 팔로워를 키워 reach를 올리는 건 반올림 잡음을 없애기 위해서다(초기 reach는 20뿐).
    const avgLikes = (mastery: number): number => {
      const s = createInitialState();
      getActiveAccount(s).followers = 10_000;
      s.tweetMastery.daily = mastery;
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += calcTweetOutcome(s, "daily", "plain").likes;
      return sum / 200;
    };
    // 이론 격차 1.32배. 표본 200의 오차를 감안해 1.2배로 느슨하게 건다.
    expect(avgLikes(300)).toBeGreaterThan(avgLikes(0) * 1.2);
  });
});

describe("게시 적립", () => {
  // free:true로 게시해 행동력·게시 슬롯 고갈 없이 여러 건을 연달아 올린다.
  // 무료 게시도 숙련을 적립하는 게 계약이다 — 게시는 게시고, 면제되는 건 행동력뿐이다.
  const post = (s: ReturnType<typeof createInitialState>, attr: any) =>
    postTweet(s, attr, "테스트 트윗", false, "meetup", 1, { free: true });

  it("트윗 1건이 그 갈래 숙련만 1 올린다", () => {
    const s = createInitialState();
    const r = post(s, "daily");
    expect(r.masteryCount).toBe(1);
    expect(s.tweetMastery.daily).toBe(1);
    expect(s.tweetMastery.it ?? 0).toBe(0);
  });

  it("무료 게시도 적립한다", () => {
    const s = createInitialState();
    post(s, "daily");
    post(s, "daily");
    expect(s.tweetMastery.daily).toBe(2);
  });

  it("문턱을 넘는 트윗만 masteryTierUp을 세운다", () => {
    const s = createInitialState();
    s.tweetMastery.daily = 8;
    expect(post(s, "daily").masteryTierUp, "9번째는 아직 미달").toBe(0);
    expect(post(s, "daily").masteryTierUp, "10번째가 첫 문턱").toBe(1);
    expect(post(s, "daily").masteryTierUp, "11번째는 이미 넘은 뒤").toBe(0);
  });

  it("두 번째 문턱도 tier 2를 보고한다", () => {
    const s = createInitialState();
    s.tweetMastery.daily = 39;
    expect(post(s, "daily").masteryTierUp).toBe(2);
  });

  it("사기 트윗은 숙련을 적립하지 않는다", () => {
    const s = createInitialState();
    postScamTweet(s, "사기 트윗");
    expect(s.tweetMastery.daily ?? 0).toBe(0);
  });
});
