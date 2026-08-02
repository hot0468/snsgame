import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  followersToNextRank,
  maybeRankMonth,
  popularityRank,
  rankAnnouncement,
  rankThreshold,
  rankTier,
} from "@/systems/popularity";
import { RANK1_FOLLOWERS, RANK_LAST_FOLLOWERS, RANK_SIZE, RANK_TIERS } from "@/data/popularity";
import { INACTIVE_DAYS, INACTIVE_LOSS_RATE, advanceTime } from "@/systems/time";
import { isLastDayOfMonth, monthKey } from "@/systems/calendar";
import { WIN_FOLLOWERS } from "@/systems/winEnding";
import type { GameState } from "@/core/types";

/**
 * 월간 인기 순위 + 무활동 감소 알림.
 *
 * 고정하는 불변식:
 *  1) 95만이면 1위. 1위는 목표(100만) 아래에 있다 — 정상에 서고도 마지막 5만이 남는다.
 *  2) 순위는 1~100. 문턱은 내림차순이고, 팔로워가 많을수록 좋은 순위다.
 *  3) 집계는 말일에 한 번(멱등).
 *  4) 무활동 감소는 조용히 지나가지 않는다 — pendingDecay가 선다.
 */

function withFollowers(n: number): GameState {
  const s = createInitialState();
  getActiveAccount(s).followers = n;
  return s;
}

describe("순위 문턱", () => {
  it("95만이면 1위다", () => {
    expect(rankThreshold(1)).toBe(RANK1_FOLLOWERS);
    expect(popularityRank(RANK1_FOLLOWERS)).toBe(1);
    expect(popularityRank(RANK1_FOLLOWERS + 100_000)).toBe(1);
  });

  it("1위 문턱이 최종 목표보다 낮다 — 1위를 찍고도 갈 곳이 남아야 한다", () => {
    expect(RANK1_FOLLOWERS).toBeLessThan(WIN_FOLLOWERS);
  });

  it("1위부터 100위까지 있고 문턱이 내림차순이다", () => {
    for (let r = 2; r <= RANK_SIZE; r++) {
      expect(rankThreshold(r), `${r}위 문턱이 ${r - 1}위보다 높다`).toBeLessThan(
        rankThreshold(r - 1),
      );
    }
    expect(rankThreshold(RANK_SIZE)).toBe(RANK_LAST_FOLLOWERS);
  });

  it("팔로워가 많을수록 순위가 좋아진다(같거나 앞선다)", () => {
    let prev = RANK_SIZE + 1;
    for (const f of [100, 1_000, 10_000, 100_000, 500_000, 900_000, 950_000]) {
      const r = popularityRank(f)!;
      expect(r, `${f}명에서 순위가 뒤로 갔다`).toBeLessThanOrEqual(prev);
      prev = r;
    }
  });

  it("100위 문턱에 못 미치면 순위권 밖이다", () => {
    expect(popularityRank(RANK_LAST_FOLLOWERS - 1)).toBeNull();
    expect(popularityRank(0)).toBeNull();
    expect(popularityRank(RANK_LAST_FOLLOWERS)).toBe(RANK_SIZE);
  });

  it("각 순위 문턱을 정확히 채우면 그 순위가 나온다", () => {
    for (const r of [1, 2, 10, 50, 99, 100]) {
      expect(popularityRank(rankThreshold(r)), `${r}위 문턱에서 ${r}위가 안 나온다`).toBe(r);
    }
  });

  it("모든 순위에 구간 문구가 붙는다", () => {
    for (let r = 1; r <= RANK_SIZE; r++) {
      expect(rankTier(r), `${r}위에 문구가 없다`).toBeTruthy();
    }
    expect(rankTier(null)).toBeNull();
    expect(RANK_TIERS[RANK_TIERS.length - 1].upTo).toBe(RANK_SIZE);
  });

  it("다음 순위까지 남은 수를 알려준다 — 1위면 없다", () => {
    expect(followersToNextRank(RANK1_FOLLOWERS)).toBeNull();
    const mid = rankThreshold(50);
    expect(followersToNextRank(mid)).toBe(rankThreshold(49) - mid);
  });
});

describe("말일 집계", () => {
  /** 그 해 지정한 월의 말일로 옮긴다. */
  function toMonthEnd(s: GameState, skipMonths = 0): void {
    let seen = 0;
    for (let d = s.day + 1; d < s.day + 400; d++) {
      if (isLastDayOfMonth(d)) {
        if (seen === skipMonths) {
          s.day = d;
          return;
        }
        seen += 1;
      }
    }
  }

  it("말일이 아니면 집계하지 않는다", () => {
    const s = withFollowers(500_000);
    while (isLastDayOfMonth(s.day)) s.day += 1;
    expect(maybeRankMonth(s)).toBe(false);
    expect(s.pendingPopularity).toBe(false);
  });

  it("말일이면 순위가 확정되고 발표가 예약된다", () => {
    const s = withFollowers(RANK1_FOLLOWERS);
    toMonthEnd(s);
    expect(maybeRankMonth(s)).toBe(true);
    expect(s.popularity.rank).toBe(1);
    expect(s.popularity.followers).toBe(RANK1_FOLLOWERS);
    expect(s.popularity.lastMonth).toBe(monthKey(s.day));
    expect(s.pendingPopularity).toBe(true);
  });

  it("같은 달을 두 번 집계하지 않는다 — prevRank가 자기 자신으로 덮인다", () => {
    const s = withFollowers(300_000);
    toMonthEnd(s);
    maybeRankMonth(s);
    const first = { ...s.popularity };
    expect(maybeRankMonth(s)).toBe(false);
    expect(s.popularity.prevRank).toBe(first.prevRank);
  });

  it("지난달 순위를 기억해 오르내림을 말한다", () => {
    const s = withFollowers(rankThreshold(60));
    toMonthEnd(s);
    maybeRankMonth(s);
    expect(rankAnnouncement(s)).toContain("첫 순위 발표");

    getActiveAccount(s).followers = rankThreshold(20);
    toMonthEnd(s);
    maybeRankMonth(s);
    expect(s.popularity.prevRank).toBe(60);
    expect(s.popularity.rank).toBe(20);
    expect(rankAnnouncement(s)).toContain("40계단 올랐다");
  });

  it("역대 최고 순위는 내려가지 않는다", () => {
    const s = withFollowers(rankThreshold(10));
    toMonthEnd(s);
    maybeRankMonth(s);
    expect(s.popularity.best).toBe(10);

    getActiveAccount(s).followers = rankThreshold(80);
    toMonthEnd(s);
    maybeRankMonth(s);
    expect(s.popularity.rank).toBe(80);
    expect(s.popularity.best, "최고 기록이 깎였다").toBe(10);
  });

  it("순위권 밖이어도 최고 기록은 유지된다", () => {
    const s = withFollowers(rankThreshold(30));
    toMonthEnd(s);
    maybeRankMonth(s);
    getActiveAccount(s).followers = 0;
    toMonthEnd(s);
    maybeRankMonth(s);
    expect(s.popularity.rank).toBeNull();
    expect(s.popularity.best).toBe(30);
    expect(rankAnnouncement(s)).toContain("순위표에는 이름이 없다");
  });
});

describe("무활동 감소 알림", () => {
  it("오래 안 쓰면 팔로워가 빠지고 그 사실이 예약된다", () => {
    // ⚠️ 예전엔 숫자만 조용히 줄었다. 왜 안 느는지 알 수가 없었다.
    const s = withFollowers(100_000);
    const acc = getActiveAccount(s);
    acc.lastTweetDay = s.day - INACTIVE_DAYS;
    const before = acc.followers;
    advanceTime(s, 2); // 하루 넘김
    expect(acc.followers, "무활동인데 안 깎였다").toBeLessThan(before);
    expect(s.pendingDecay, "깎였는데 알림이 없다").toBeTruthy();
    expect(s.pendingDecay!.lost).toBe(before - acc.followers);
    expect(s.pendingDecay!.days).toBeGreaterThanOrEqual(INACTIVE_DAYS);
  });

  it("방금 트윗을 썼으면 안 깎이고 알림도 없다", () => {
    const s = withFollowers(100_000);
    const acc = getActiveAccount(s);
    acc.lastTweetDay = s.day;
    const before = acc.followers;
    advanceTime(s, 2);
    expect(acc.followers).toBe(before);
    expect(s.pendingDecay).toBeNull();
  });

  it("감소폭이 선언한 비율과 맞는다", () => {
    const s = withFollowers(100_000);
    const acc = getActiveAccount(s);
    acc.lastTweetDay = s.day - INACTIVE_DAYS;
    advanceTime(s, 2);
    expect(s.pendingDecay!.lost).toBe(Math.round(100_000 * INACTIVE_LOSS_RATE));
  });
});
