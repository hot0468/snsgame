import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  authorRankAnnouncement,
  authorRankOf,
  authorRankScore,
  authorRankThreshold,
  authorRankTier,
  diligenceOf,
  recordAuthorRank,
  rivalAbove,
} from "@/systems/authorRank";
import {
  AUTHOR_RANK1_SCORE,
  AUTHOR_RANK_LAST_SCORE,
  AUTHOR_RANK_SIZE,
  AUTHOR_RANK_TIERS,
  DILIGENCE_TIERS,
  RIVAL_TITLES,
} from "@/data/authorRank";
import { AUTHOR_WORKLOAD_TARGET, settleAuthorMonthly } from "@/systems/author";
import { dateOf, monthKey } from "@/systems/calendar";
import type { GameState } from "@/core/types";

/**
 * 웹툰 플랫폼 월간 연재 순위.
 *
 * 왜 넣었나: 작가는 매달 원고를 그리는데 결과가 통장 숫자와 편집자 코멘트 한 줄로만
 * 돌아왔다. 한 달치 작업이 눈에 보이는 자리로 바뀌지 않았다.
 *
 * 고정하는 불변식:
 *  1) 순위는 **인기 지표 × 그 달 연재 성실도**다 — 휴재하면 떨어진다.
 *  2) 1~50위. 문턱은 내림차순.
 *  3) 정산 뒤·게이지 리셋 앞에 집계한다(순서가 바뀌면 연차나 작업량이 어긋난다).
 *  4) 경쟁작 이름은 결정론적이다 — 재렌더마다 갈리면 안 된다.
 */

function contracted(months: number, workload: number, followers = 0): GameState {
  const s = createInitialState();
  getActiveAccount(s).followers = followers;
  s.authorContract = {
    signedDay: 1,
    monthsWorked: months,
    workload,
    worksThisMonth: 4,
    missCount: 0,
    lastSettledMonth: -1,
    adult: false,
    penName: "테스트필명",
  };
  return s;
}

describe("연재 성실도", () => {
  it("게이지가 목표를 채우면 배율이 가장 높다", () => {
    expect(diligenceOf(AUTHOR_WORKLOAD_TARGET).mul).toBe(DILIGENCE_TIERS[0].mul);
    expect(diligenceOf(AUTHOR_WORKLOAD_TARGET).label).toBe("완주");
  });

  it("휴재(0)여도 0이 되지는 않는다 — 복귀할 자리는 남긴다", () => {
    const d = diligenceOf(0);
    expect(d.mul).toBeGreaterThan(0);
    expect(d.label).toBe("휴재");
  });

  it("적게 그릴수록 배율이 낮다", () => {
    const full = diligenceOf(AUTHOR_WORKLOAD_TARGET).mul;
    const half = diligenceOf(AUTHOR_WORKLOAD_TARGET * 0.5).mul;
    const none = diligenceOf(0).mul;
    expect(full).toBeGreaterThan(half);
    expect(half).toBeGreaterThan(none);
  });

  it("배율 표가 minRatio 내림차순이다 — 뒤집히면 휴재가 완주 취급된다", () => {
    for (let i = 1; i < DILIGENCE_TIERS.length; i++) {
      expect(DILIGENCE_TIERS[i].minRatio).toBeLessThan(DILIGENCE_TIERS[i - 1].minRatio);
    }
  });
});

describe("순위 문턱", () => {
  it("1위부터 50위까지 있고 문턱이 내림차순이다", () => {
    expect(authorRankThreshold(1)).toBe(AUTHOR_RANK1_SCORE);
    expect(authorRankThreshold(AUTHOR_RANK_SIZE)).toBe(AUTHOR_RANK_LAST_SCORE);
    for (let r = 2; r <= AUTHOR_RANK_SIZE; r++) {
      expect(authorRankThreshold(r), `${r}위`).toBeLessThan(authorRankThreshold(r - 1));
    }
  });

  it("진입선에 못 미치면 순위권 밖이다", () => {
    expect(authorRankOf(AUTHOR_RANK_LAST_SCORE - 1)).toBeNull();
    expect(authorRankOf(AUTHOR_RANK_LAST_SCORE)).toBe(AUTHOR_RANK_SIZE);
    expect(authorRankOf(AUTHOR_RANK1_SCORE)).toBe(1);
  });

  it("각 순위 문턱을 정확히 채우면 그 순위가 나온다", () => {
    for (const r of [1, 2, 10, 25, 49, 50]) {
      expect(authorRankOf(authorRankThreshold(r)), `${r}위 문턱`).toBe(r);
    }
  });

  it("모든 순위에 편집자 코멘트가 붙는다", () => {
    for (let r = 1; r <= AUTHOR_RANK_SIZE; r++) {
      expect(authorRankTier(r), `${r}위에 코멘트가 없다`).toBeTruthy();
    }
    expect(AUTHOR_RANK_TIERS[AUTHOR_RANK_TIERS.length - 1].upTo).toBe(AUTHOR_RANK_SIZE);
  });
});

describe("점수", () => {
  it("계약이 없으면 0이다", () => {
    expect(authorRankScore(createInitialState())).toBe(0);
  });

  it("같은 인기여도 많이 그린 달이 점수가 높다 — 이번 달 작업이 순위로 돌아온다", () => {
    const busy = authorRankScore(contracted(6, AUTHOR_WORKLOAD_TARGET, 100_000));
    const idle = authorRankScore(contracted(6, 0, 100_000));
    expect(busy, "휴재한 달과 완주한 달의 점수가 같다").toBeGreaterThan(idle);
  });

  it("팔로워가 많을수록 점수가 높다", () => {
    const many = authorRankScore(contracted(6, AUTHOR_WORKLOAD_TARGET, 500_000));
    const few = authorRankScore(contracted(6, AUTHOR_WORKLOAD_TARGET, 10_000));
    expect(many).toBeGreaterThan(few);
  });
});

describe("집계", () => {
  it("순위가 확정되고 발표가 예약된다", () => {
    const s = contracted(6, AUTHOR_WORKLOAD_TARGET, 400_000);
    recordAuthorRank(s, 100);
    expect(s.authorRank, "집계가 안 됐다").toBeTruthy();
    expect(s.authorRank!.lastMonth).toBe(100);
    expect(s.pendingAuthorRank).toBe(true);
    expect(s.authorRank!.diligence).toBe("완주");
  });

  it("지난달 순위를 기억해 오르내림을 말한다", () => {
    const s = contracted(2, AUTHOR_WORKLOAD_TARGET, 100_000);
    recordAuthorRank(s, 100);
    expect(authorRankAnnouncement(s)).toContain("첫 순위 발표");
    const first = s.authorRank!.rank!;

    getActiveAccount(s).followers = 700_000;
    recordAuthorRank(s, 101);
    expect(s.authorRank!.prevRank).toBe(first);
    expect(s.authorRank!.rank!).toBeLessThan(first);
    expect(authorRankAnnouncement(s)).toContain("계단 올랐어요");
  });

  it("역대 최고는 내려가지 않는다", () => {
    const s = contracted(6, AUTHOR_WORKLOAD_TARGET, 800_000);
    recordAuthorRank(s, 100);
    const best = s.authorRank!.best!;
    getActiveAccount(s).followers = 0;
    s.authorContract!.workload = 0;
    recordAuthorRank(s, 101);
    expect(s.authorRank!.best, "최고 기록이 깎였다").toBe(best);
  });

  it("정산이 순위를 남긴다 — 게이지가 리셋되기 전에 잡힌다", () => {
    // ⚠️ 순서가 뒤집히면 매달 '휴재'로 집계된다.
    const s = contracted(3, AUTHOR_WORKLOAD_TARGET, 300_000);
    // 계약한 달의 두 달 뒤 1일로 옮긴다(정산이 실제로 도는 날).
    for (let d = 2; d < 400; d++) {
      const dt = dateOf(d);
      if (dt.getDate() === 1 && monthKey(d) >= monthKey(s.authorContract!.signedDay) + 2) {
        s.day = d;
        break;
      }
    }
    settleAuthorMonthly(s);
    expect(s.authorRank, "정산했는데 순위가 없다").toBeTruthy();
    expect(s.authorRank!.diligence, "게이지 리셋 뒤에 집계됐다").toBe("완주");
    expect(s.authorContract!.workload, "정산 후 게이지는 리셋돼야 한다").toBe(0);
  });

  it("계약이 없으면 집계하지 않는다", () => {
    const s = createInitialState();
    recordAuthorRank(s, 100);
    expect(s.authorRank).toBeNull();
    expect(s.pendingAuthorRank).toBe(false);
  });
});

describe("경쟁작", () => {
  it("같은 달·순위면 항상 같은 작품이 위에 걸린다", () => {
    expect(rivalAbove(100, 7)).toBe(rivalAbove(100, 7));
    expect(RIVAL_TITLES).toContain(rivalAbove(100, 7)!);
  });

  it("1위면 위에 아무도 없다", () => {
    expect(rivalAbove(100, 1)).toBeNull();
    expect(rivalAbove(100, null)).toBeNull();
  });
});
