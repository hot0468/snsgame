import { describe, it, expect } from "vitest";
import type { AttributeId, Tweet } from "@/core/types";
import { createInitialState, getActiveAccount, LATE_SLOT } from "@/core/state";
import { getAffinity, ATTRIBUTES } from "@/data/attributes";
import { isDdeoksang, ddeoksangBonus } from "@/systems/tweetSystem";
import { postQuoteTweet } from "@/systems/quote";
import { postDrunkTweet, resolveRegret } from "@/systems/drunk";
import { bumpTchinProgress, tchinReachMult } from "@/systems/tchin";
import { TCHIN_THRESHOLD, TCHIN_REACH, TCHIN_CAP } from "@/data/tchin";
import { DDEOKSANG_MIN, DDEOKSANG_BONUS_RATE } from "@/data/tweetFun";

function targetTweet(attribute: AttributeId, likes: number, retweets: number): Tweet {
  return {
    id: "tgt",
    authorName: "남의계정",
    authorHandle: "someone",
    attribute,
    isAdult: false,
    text: "이거 봐라 대박임",
    createdDay: 1,
    likes,
    retweets,
    gainedFollowers: 0,
  };
}

/**
 * 트윗 재미 팩 — 순수 로직 회귀 테스트.
 * (연출·블러·팝업 등 UI는 typecheck/build로 검증.)
 */

describe("떡상 판정 (모듈 A)", () => {
  it("작은 계정: 증가분이 최소치(DDEOKSANG_MIN) 이상이면 떡상", () => {
    expect(isDdeoksang(DDEOKSANG_MIN, 0)).toBe(true);
    expect(isDdeoksang(DDEOKSANG_MIN - 1, 0)).toBe(false);
  });

  it("큰 계정: 최소치를 넘어도 계정 규모의 5% 미만이면 떡상 아님", () => {
    // 팔로워 10000 → 5% = 500. 400은 최소치(300)는 넘지만 5% 미만.
    expect(isDdeoksang(400, 10_000)).toBe(false);
    expect(isDdeoksang(500, 10_000)).toBe(true);
  });

  it("눈덩이 보너스 = 증가분 × DDEOKSANG_BONUS_RATE (반올림)", () => {
    expect(ddeoksangBonus(1000)).toBe(Math.round(1000 * DDEOKSANG_BONUS_RATE));
    expect(ddeoksangBonus(1000)).toBe(300);
  });
});

describe("인용 트윗 QRT (모듈 B)", () => {
  const attrs = Object.keys(ATTRIBUTES) as AttributeId[];

  it("궁합 ≥ 0: 성공 — 팔로워 급증 + 역풍 아님 + 원문 스냅샷", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    const posAttr = attrs.find((a) => getAffinity(acc.attribute, a) >= 0)!;
    const before = acc.followers;
    const r = postQuoteTweet(s, targetTweet(posAttr, 5000, 2000), "hype", "떡상각");
    expect(r.ratioed).toBe(false);
    expect(r.followerDelta).toBeGreaterThan(0);
    expect(getActiveAccount(s).followers).toBeGreaterThan(before);
    // 내 타임라인 최상단에 quoted 스냅샷이 박힌 QRT 트윗
    expect(getActiveAccount(s).timeline[0].quoted?.authorHandle).toBe("someone");
  });

  it("궁합 < 0: 역풍 — 팔로워 감소 + ratioed true (음수 궁합 쌍이 있을 때만)", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    const negAttr = attrs.find((a) => getAffinity(acc.attribute, a) < 0);
    if (!negAttr) return; // 음수 궁합 쌍이 없으면 스킵
    const before = acc.followers;
    const r = postQuoteTweet(s, targetTweet(negAttr, 5000, 2000), "snark", "이건 좀");
    expect(r.ratioed).toBe(true);
    expect(r.followerDelta).toBeLessThan(0);
    expect(getActiveAccount(s).followers).toBeLessThanOrEqual(before);
  });
});

describe("취중 트윗 + 이불킥 (모듈 C)", () => {
  it("postDrunkTweet: 타임라인 게시 + 이불킥 예약 + drunkPending 해제 + 다음날 진행", () => {
    const s = createInitialState();
    s.slot = LATE_SLOT; // 심야 → advanceTime이 다음날로 넘긴다
    s.drunkPending = true;
    const day0 = s.day;
    const id = postDrunkTweet(s);
    expect(getActiveAccount(s).timeline[0].id).toBe(id);
    expect(s.pendingRegretTweetId).toBe(id);
    expect(s.drunkPending).toBe(false);
    expect(s.day).toBe(day0 + 1);
  });

  it("resolveRegret('delete'): 트윗 제거 + 예약 해제", () => {
    const s = createInitialState();
    s.slot = LATE_SLOT;
    const id = postDrunkTweet(s);
    resolveRegret(s, "delete");
    expect(s.pendingRegretTweetId).toBeNull();
    expect(getActiveAccount(s).timeline.find((t) => t.id === id)).toBeUndefined();
  });

  it("resolveRegret('keep'): 트윗 유지 + 예약 해제", () => {
    const s = createInitialState();
    s.slot = LATE_SLOT;
    const id = postDrunkTweet(s);
    resolveRegret(s, "keep");
    expect(s.pendingRegretTweetId).toBeNull();
    expect(getActiveAccount(s).timeline.find((t) => t.id === id)).toBeDefined();
  });
});

describe("트친 (모듈 D)", () => {
  it("같은 핸들과 임계치만큼 상호작용하면 트친이 된다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    // 임계치 직전까지는 진행만.
    for (let i = 0; i < TCHIN_THRESHOLD - 1; i++) {
      expect(bumpTchinProgress(s, "friend")).toBe("progress");
    }
    expect(acc.tchins).not.toContain("friend");
    // 임계치를 넘기는 순간 성사.
    expect(bumpTchinProgress(s, "friend")).toBe("became");
    expect(acc.tchins).toContain("friend");
  });

  it("이미 트친인 핸들은 'already'를 반환하고 중복 추가하지 않는다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    for (let i = 0; i < TCHIN_THRESHOLD; i++) bumpTchinProgress(s, "friend");
    expect(bumpTchinProgress(s, "friend")).toBe("already");
    expect(acc.tchins.filter((h) => h === "friend").length).toBe(1);
  });

  it("도달 배율 = 1 + min(트친수, CAP) × TCHIN_REACH", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    expect(tchinReachMult(s)).toBe(1);
    acc.tchins = ["a", "b"];
    expect(tchinReachMult(s)).toBeCloseTo(1 + 2 * TCHIN_REACH, 10);
    // CAP 초과분은 배율에 반영되지 않는다.
    acc.tchins = Array.from({ length: TCHIN_CAP + 5 }, (_, i) => `t${i}`);
    expect(tchinReachMult(s)).toBeCloseTo(1 + TCHIN_CAP * TCHIN_REACH, 10);
  });

  it("도달 배율이 실제 게시(인용 트윗) 팔로워 증가분에 반영된다", () => {
    // 성공 분기(궁합 ≥ 0)는 RNG가 없어 결정론적 → 트친 유무만 다르면 delta 차이는 배율뿐.
    // 자기 계열(daily×daily)은 궁합이 음수가 아니므로 성공 분기를 탄다.
    const good: AttributeId = "daily";
    expect(getAffinity("daily", good)).toBeGreaterThanOrEqual(0);
    const mk = () => {
      const s = createInitialState();
      getActiveAccount(s).attribute = "daily";
      return s;
    };
    const base = postQuoteTweet(mk(), targetTweet(good, 2000, 500), "hype", "글").followerDelta;

    const withTchin = mk();
    getActiveAccount(withTchin).tchins = ["a", "b"];
    const boosted = postQuoteTweet(
      withTchin,
      targetTweet(good, 2000, 500),
      "hype",
      "글",
    ).followerDelta;

    expect(base).toBeGreaterThan(0);
    expect(boosted).toBe(Math.round(base * (1 + 2 * TCHIN_REACH)));
  });
});
