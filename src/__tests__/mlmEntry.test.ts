import { describe, it, expect } from "vitest";
import { makeEggTweet } from "@/data/accounts";
import { createInitialState, getActiveAccount } from "@/core/state";
import { onLikeTweet } from "@/systems/eggs";
import { ACHIEVEMENTS } from "@/data/achievements";
import type { Tweet } from "@/core/types";

/**
 * 다단계 진입로 회귀 테스트.
 *
 * 왜 넣었나: 이 트윗에 좋아요를 누르는 것이 다단계 사업자직의 **유일한 입구**인데
 * (eggs.onLikeTweet → 이사님 DM → mlm.acceptMlmOffer), 예전 문구는 "관심 있으면 DM 주세요"라
 * 방향이 반대였다. 플레이어는 트윗을 봐도 좋아요가 트리거인 줄 알 수 없었고,
 * 직업 하나가 통째로 숨어 있었다.
 *
 * 고정하는 불변식:
 *  1) **어느 문구가 뽑혀도** 좋아요/하트가 입구임을 말해준다(하나만 고치면 뽑기 운이 된다).
 *  2) 좋아요를 누르면 실제로 제의 DM이 오고, 그 스레드에 mlmOffer 플래그가 서 있다.
 */

/** 여러 day로 돌려 pyramid 문구 풀을 전부 긁어온다(문구 상수를 export하지 않으므로 실사용 경로로). */
function pyramidLines(): string[] {
  const seen = new Set<string>();
  for (let day = 1; day <= 80; day++) seen.add(makeEggTweet("pyramid", day).text);
  return [...seen];
}

describe("트윗이 입구를 알려준다", () => {
  it("문구 풀이 여러 개다", () => {
    expect(pyramidLines().length).toBeGreaterThan(1);
  });

  it("모든 문구가 좋아요/하트가 트리거임을 말한다", () => {
    for (const line of pyramidLines()) {
      expect(
        /좋아요|하트/.test(line),
        `입구를 안 알려주는 문구가 있다: ${line}`,
      ).toBe(true);
    }
  });

  it("상대가 먼저 연락한다는 방향이 드러난다 — 'DM 주세요'는 반대 방향이었다", () => {
    for (const line of pyramidLines()) {
      expect(
        /드립니다|드릴게요|남겨주세요|눌러주세요|연락/.test(line),
        `방향이 모호한 문구: ${line}`,
      ).toBe(true);
    }
  });
});

describe("좋아요 → 이사님 제의 DM", () => {
  it("제의 스레드가 생기고 mlmOffer가 서 있다", () => {
    const s = createInitialState();
    const tweet: Tweet = { ...makeEggTweet("pyramid", 1), egg: "pyramid" };
    onLikeTweet(s, tweet);

    const dms = getActiveAccount(s).dms;
    const offer = dms.find((t) => t.mlmOffer);
    expect(offer, "제의 플래그가 없으면 수락 버튼이 안 그려진다").toBeTruthy();
    expect(offer!.partnerHandle).toBe("freedom_king");
    expect(offer!.scam, "사기 접선이라 만남 제안 흐름을 타면 안 된다").toBe(true);
  });

  it("두 번 눌러도 스레드가 하나만 생긴다", () => {
    const s = createInitialState();
    const tweet: Tweet = { ...makeEggTweet("pyramid", 1), egg: "pyramid" };
    onLikeTweet(s, tweet);
    onLikeTweet(s, tweet);
    expect(getActiveAccount(s).dms.filter((t) => t.mlmOffer).length).toBe(1);
  });
});

describe("콜센터 업적", () => {
  it("연속 기록과 누적 통수, 두 축이 다 있다", () => {
    const ids = ACHIEVEMENTS.filter((a) => a.id.startsWith("call_")).map((a) => a.id);
    expect(ids).toContain("call_streak");
    expect(ids).toContain("call_200");
  });

  it("누적 업적은 통수로만 판정한다 — 연속 기록과 겹치지 않는다", () => {
    const a = ACHIEVEMENTS.find((x) => x.id === "call_200")!;
    const s = createInitialState();
    s.callCenterJob = { hiredDay: 1, totalCalls: 200, totalEarned: 0, bestStreak: 1 };
    expect(a.condition(s)).toBe(true);
    s.callCenterJob.totalCalls = 199;
    expect(a.condition(s)).toBe(false);
  });
});
