import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  SPONSOR_MAIL_CHANCE,
  acceptSponsor,
  declineSponsor,
  hasPendingSponsor,
  maybeSpawnSponsorOffer,
  sponsorOfferFor,
  topMastery,
} from "@/systems/genreSponsor";
import { SPONSOR_BRANDS, SPONSOR_TIERS } from "@/data/genreSponsor";
import { MASTERY_THRESHOLDS } from "@/data/tweetMastery";
import { ATTRIBUTES } from "@/data/attributes";
import type { AttributeId, GameState } from "@/core/types";

/**
 * 갈래 협찬 — 한 갈래를 깊게 판 사람에게만 오는 제안.
 *
 * 왜 넣었나: 갈래 숙련의 보상이 도달 배율(만렙 ×1.32) 하나뿐이었다. 같은 게임의 다른
 * 레버가 평판 3.3배·궁합 2.3배·스킬 8배인데, 300개를 한 갈래에 몰아넣는 지루함에 비해
 * 이득이 너무 작아 특화는 하면 손해인 선택이었다.
 *
 * 고정하는 불변식:
 *  1) 숙련 tier 2(40개) 미만이면 제안이 안 온다 — 열 개는 지나가다 쓰는 수준이다.
 *  2) **가장 깊게 판 갈래 하나만** 본다(균형형이 메일을 더 받으면 취지가 뒤집힌다).
 *  3) tier가 높을수록 제안이 커진다.
 *  4) 한 번에 하나만 떠 있고, 답하면 다시 못 받는다(계약금 반복 수령 금지).
 */

function spec(attr: AttributeId, count: number): GameState {
  const s = createInitialState();
  s.tweetMastery = { ...(s.tweetMastery ?? {}), [attr]: count };
  return s;
}

/** 확률을 걷어내고 올 때까지 굴린다. */
function spawnUntil(s: GameState): boolean {
  for (let i = 0; i < 800; i++) if (maybeSpawnSponsorOffer(s)) return true;
  return false;
}

describe("자격", () => {
  it("숙련이 없으면 제안이 없다", () => {
    const s = createInitialState();
    expect(topMastery(s)).toBeNull();
    expect(spawnUntil(s)).toBe(false);
  });

  it("tier 1(첫 문턱)에는 안 온다 — 열 개는 특화가 아니다", () => {
    const s = spec("it", MASTERY_THRESHOLDS[0]);
    expect(topMastery(s)!.tier).toBe(1);
    expect(sponsorOfferFor(1)).toBeNull();
    expect(spawnUntil(s)).toBe(false);
  });

  it("tier 2부터 온다", () => {
    const s = spec("it", MASTERY_THRESHOLDS[1]);
    expect(topMastery(s)!.tier).toBe(2);
    expect(spawnUntil(s)).toBe(true);
    expect(s.emails[0].sponsorOffer, "협찬 카드가 안 붙었다").toBeTruthy();
  });

  it("가장 깊게 판 갈래 하나만 본다 — 얕게 여러 개는 얕은 쪽 취급", () => {
    const s = createInitialState();
    s.tweetMastery = { it: MASTERY_THRESHOLDS[1], food: MASTERY_THRESHOLDS[0] } as GameState["tweetMastery"];
    expect(topMastery(s)!.attr).toBe("it");
    expect(topMastery(s)!.tier).toBe(2);
  });

  it("tier가 높을수록 제안이 커진다", () => {
    const t2 = sponsorOfferFor(2)!;
    const t3 = sponsorOfferFor(3)!;
    const t4 = sponsorOfferFor(4)!;
    expect(t3.money).toBeGreaterThan(t2.money);
    expect(t4.money).toBeGreaterThan(t3.money);
    expect(t4.followers).toBeGreaterThan(t3.followers);
  });

  it("표가 minTier 내림차순이다 — 뒤집히면 만렙이 최저 제안을 받는다", () => {
    for (let i = 1; i < SPONSOR_TIERS.length; i++) {
      expect(SPONSOR_TIERS[i].minTier).toBeLessThan(SPONSOR_TIERS[i - 1].minTier);
    }
  });

  it("확률이 하루 몇 %대다 — 매일 오면 특별함이 사라진다", () => {
    expect(SPONSOR_MAIL_CHANCE).toBeGreaterThan(0);
    expect(SPONSOR_MAIL_CHANCE).toBeLessThan(0.2);
  });
});

describe("제안 메일", () => {
  it("답 안 한 제안이 있으면 새로 안 온다", () => {
    const s = spec("it", MASTERY_THRESHOLDS[1]);
    spawnUntil(s);
    const n = s.emails.length;
    expect(hasPendingSponsor(s)).toBe(true);
    for (let i = 0; i < 800; i++) maybeSpawnSponsorOffer(s);
    expect(s.emails.length, "제안이 쌓였다").toBe(n);
  });

  it("제목·발신자에 그 갈래 브랜드가 들어간다", () => {
    const s = spec("cat", MASTERY_THRESHOLDS[2]);
    spawnUntil(s);
    const mail = s.emails[0];
    const brands = SPONSOR_BRANDS.cat;
    expect(brands.some((b) => mail.from.includes(b)), `발신자가 고양이계 브랜드가 아니다: ${mail.from}`).toBe(true);
    expect(mail.subject).toContain(ATTRIBUTES.cat.label);
  });

  it("모든 갈래에 브랜드가 준비돼 있다 — 빠지면 그 갈래만 이름 없는 브랜드가 온다", () => {
    for (const id of Object.keys(ATTRIBUTES) as AttributeId[]) {
      expect(SPONSOR_BRANDS[id]?.length ?? 0, `${id}에 브랜드가 없다`).toBeGreaterThan(0);
    }
  });
});

describe("수락과 거절", () => {
  function offered(): GameState {
    const s = spec("it", MASTERY_THRESHOLDS[3]);
    spawnUntil(s);
    return s;
  }

  it("수락하면 계약금과 팔로워가 들어오고 평판이 조금 깎인다", () => {
    const s = offered();
    const mail = s.emails[0];
    const offer = mail.sponsorOffer!;
    const before = {
      money: s.money,
      followers: getActiveAccount(s).followers,
      rep: s.resources.reputation,
    };
    const line = acceptSponsor(s, mail.id);
    expect(line.length).toBeGreaterThan(0);
    expect(s.money).toBe(before.money + offer.money);
    expect(getActiveAccount(s).followers).toBeGreaterThan(before.followers);
    expect(s.resources.reputation).toBe(before.rep + offer.reputation);
  });

  it("두 번 수락해도 계약금은 한 번만 들어온다", () => {
    const s = offered();
    const mail = s.emails[0];
    acceptSponsor(s, mail.id);
    const after = s.money;
    expect(acceptSponsor(s, mail.id)).toBe("");
    expect(s.money).toBe(after);
  });

  it("거절하면 돈은 안 들어오고 평판이 오른다", () => {
    const s = offered();
    // 평판 초기값이 상한(100)이라 그대로 두면 +1이 클램프돼 "안 올랐다"로 보인다.
    s.resources.reputation = 50;
    const mail = s.emails[0];
    const before = { money: s.money, rep: s.resources.reputation };
    expect(declineSponsor(s, mail.id).length).toBeGreaterThan(0);
    expect(s.money).toBe(before.money);
    expect(s.resources.reputation).toBeGreaterThan(before.rep);
  });

  it("답한 뒤에는 다음 제안을 받을 수 있다", () => {
    const s = offered();
    declineSponsor(s, s.emails[0].id);
    expect(hasPendingSponsor(s)).toBe(false);
    expect(spawnUntil(s)).toBe(true);
  });

  it("수락이 뒷광고 논란으로 이어질 수 있다 — 진행 중인 논란은 안 덮는다", () => {
    let sawControversy = false;
    for (let i = 0; i < 200 && !sawControversy; i++) {
      const s = offered();
      acceptSponsor(s, s.emails[0].id);
      if (s.pendingControversy === "ctrl_paid_promo") sawControversy = true;
    }
    expect(sawControversy, "200번 수락해도 논란이 한 번도 안 붙었다").toBe(true);

    const s2 = offered();
    s2.pendingControversy = "ctrl_paid_promo";
    acceptSponsor(s2, s2.emails[0].id);
    expect(s2.pendingControversy).toBe("ctrl_paid_promo");
  });
});
