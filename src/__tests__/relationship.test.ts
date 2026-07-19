import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { MAX_SKILL } from "@/data/stats";
import {
  pendingArc,
  meetSuccessChance,
  gainAffinityFromTweet,
  AFFINITY_PER_TWEET,
  REL_STAGE_THRESHOLDS,
  MEET_BASE_CHANCE,
  MEET_SKILL_BONUS,
} from "@/systems/relationship";
import { sellOwnedItem, GIFT_SELL_REP_PENALTY, GIFT_SELL_MORALITY_PENALTY } from "@/systems/shop";
import { RELATIONSHIP_CHARS, REL_GIFTS } from "@/data/relationships";
import type { RelationshipProgress } from "@/core/types";

/**
 * 관계 시스템 워킹 스켈레톤 회귀.
 * 로스터는 Phase 1에선 비어 있으므로(content-author가 채움) 순수 로직만 고정한다:
 * arc 임계 경계, 성사식, 트윗 훅이 로스터 없이도 안전한지, 선물 판매 페널티.
 */

const rel = (affinity: number, stage: 0 | 1 | 2 | 3): RelationshipProgress => ({
  affinity,
  stage,
  bond: "none",
});

describe("pendingArc — 임계 경계", () => {
  it("stage 0은 Arc1 임계에서 열린다", () => {
    expect(pendingArc(rel(REL_STAGE_THRESHOLDS[0] - 1, 0))).toBeNull();
    expect(pendingArc(rel(REL_STAGE_THRESHOLDS[0], 0))).toBe(0);
  });
  it("stage는 다음 arc 임계를 본다(호감도만 높아도 이전 arc 미완이면 그 arc)", () => {
    // affinity 90인데 아직 stage 0이면 열리는 건 Arc1(0)이지 Arc3가 아니다.
    expect(pendingArc(rel(90, 0))).toBe(0);
    expect(pendingArc(rel(REL_STAGE_THRESHOLDS[2], 2))).toBe(2);
  });
  it("완주(stage 3)면 더 열 arc가 없다", () => {
    expect(pendingArc(rel(999, 3))).toBeNull();
  });
});

describe("meetSuccessChance — 0.4 + 친화력×0.5", () => {
  it("친화력 0 → 40%, 만렙 → 90%", () => {
    const s = createInitialState();
    s.skills.sociability = 0;
    expect(meetSuccessChance(s)).toBeCloseTo(MEET_BASE_CHANCE, 5);
    s.skills.sociability = MAX_SKILL;
    expect(meetSuccessChance(s)).toBeCloseTo(MEET_BASE_CHANCE + MEET_SKILL_BONUS, 5);
  });
});

describe("gainAffinityFromTweet — 빈 로스터에서 안전", () => {
  it("로스터가 비면 아무도 오르지 않고 크래시하지 않는다", () => {
    const s = createInitialState();
    const gains = gainAffinityFromTweet(s, "idol", "plain");
    expect(gains).toEqual([]);
    expect(getActiveAccount(s).relationships).toEqual({});
  });
});

describe("sellOwnedItem — 관계 선물 페널티", () => {
  it("비-선물 아이템 판매는 페널티가 없다", () => {
    const s = createInitialState();
    s.ownedItems.push("pen_paper");
    const rep = s.resources.reputation;
    const mor = s.resources.morality;
    const payout = sellOwnedItem(s, "pen_paper");
    expect(payout).not.toBeNull();
    expect(s.resources.reputation).toBe(rep);
    expect(s.resources.morality).toBe(mor);
  });
  // 선물 실물은 content-author가 REL_GIFTS를 채운 뒤 integration-qa가 end-to-end로 검증한다.
  // 여기선 페널티 상수가 사라지지 않도록만 고정한다.
  it("페널티 상수는 평판/도덕 −30", () => {
    expect(GIFT_SELL_REP_PENALTY).toBe(30);
    expect(GIFT_SELL_MORALITY_PENALTY).toBe(30);
    expect(AFFINITY_PER_TWEET).toBe(8);
  });
});

describe("관계 로스터 정합성(콘텐츠 회귀)", () => {
  // 받침 판정: 마지막 글자가 한글이고 종성이 있으면 true.
  const hasBatchim = (name: string): boolean => {
    const x = name.charCodeAt(name.length - 1);
    return x >= 0xac00 && x <= 0xd7a3 && (x - 0xac00) % 28 !== 0;
  };

  // 이름은 반드시 받침으로 끝나야 한다. 웹소설 본문의 {name} 토큰이 조사를 받침형(을·과·은·이·이에요)으로
  // 고정 서술하므로, 모음 종결 이름을 쓰면 "재하을/유나가에요"처럼 조사가 틀어진다(조사 엔진 부재).
  // 새 캐릭터를 추가할 땐 받침 있는 이름을 골라라.
  it("모든 캐릭터 이름은 받침으로 끝난다", () => {
    const bad = RELATIONSHIP_CHARS.filter((c) => !hasBatchim(c.name)).map((c) => c.name);
    expect(bad).toEqual([]);
  });

  it("id·이름 중복이 없다", () => {
    const ids = RELATIONSHIP_CHARS.map((c) => c.id);
    const names = RELATIONSHIP_CHARS.map((c) => c.name);
    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(names).size).toBe(names.length);
  });

  // giftId가 REL_GIFTS에 없으면 Arc3 완주 선물이 서랍장에서 조용히 소실된다(resolveItem 함정).
  it("모든 giftId가 REL_GIFTS에 등록돼 있다", () => {
    const defined = new Set(REL_GIFTS.map((g) => g.id));
    const missing = RELATIONSHIP_CHARS.filter((c) => !defined.has(c.giftId)).map((c) => c.giftId);
    expect(missing).toEqual([]);
  });

  it("각 캐릭터는 3-arc, 각 arc는 pages≥1·choices 정확히 2", () => {
    const bad = RELATIONSHIP_CHARS.filter(
      (c) => c.events.length !== 3 || c.events.some((e) => e.pages.length < 1 || e.choices.length !== 2),
    ).map((c) => c.id);
    expect(bad).toEqual([]);
  });
});
