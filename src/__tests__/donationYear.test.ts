import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { DONATION_TARGETS } from "@/data/donation";
import { donate, donationSteps } from "@/systems/donation";
import { snapshotYearStart } from "@/systems/awards";
import { BAD_ENDINGS, dexIdForReason, endingDexRows } from "@/systems/endingDex";
import { ACHIEVEMENTS } from "@/data/achievements";
import { AFFAIR_GAMEOVER } from "@/data/affair";
import { KILLER_DEAD_REASON } from "@/systems/killer";
import { dateOf } from "@/systems/calendar";
import type { GameState } from "@/core/types";

/**
 * 기부 · 새해 결산 · 나쁜 엔딩 도감 · 신규 업적.
 *
 * 고정하는 불변식:
 *  1) 기부는 **횟수 제한이 없다**(사용자 확정). 남은 방어선은 1회 효과 상한뿐이다.
 *  2) 실패하면 돈이 안 빠진다.
 *  3) 해가 바뀌면 지난해 결산이 남고, 올해 실적 기준선이 새로 찍힌다.
 *  4) 망해서 끝나는 결말도 도감에 남는다 — 사유 문자열로 되짚는다.
 */

beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
});

function rich(): GameState {
  const s = createInitialState();
  s.money = 500_000_000;
  s.resources.reputation = 40;
  s.resources.morality = 40;
  return s;
}

describe("기부", () => {
  const target = DONATION_TARGETS[0];

  it("돈이 빠지고 평판·도덕성이 오른다", () => {
    const s = rich();
    const before = { money: s.money, rep: s.resources.reputation, mor: s.resources.morality };
    const o = donate(s, target.id, target.perStep);
    expect(o.result).toBe("ok");
    expect(s.money).toBe(before.money - target.perStep);
    expect(s.resources.morality).toBeGreaterThan(before.mor);
    // ⚠️ 평판은 안 준다 — 횟수 제한이 없어서 평판까지 주면 현금으로 무한히 살 수 있다.
    expect(s.resources.reputation, "기부가 평판을 올렸다").toBe(before.rep);
    expect(s.donatedTotal).toBe(target.perStep);
  });

  it("같은 달에 같은 단체에 몇 번이든 낼 수 있다 — 횟수 제한이 없다", () => {
    // ⚠️ 예전엔 단체마다 월 1회였다. 제한을 뗐으므로 **남은 방어선은 1회 효과 상한뿐**이다
    //    — 돈이 있으면 평판·도덕성을 계속 살 수 있다(사용자 확정 트레이드오프).
    const s = rich();
    for (let i = 0; i < 5; i++) {
      expect(donate(s, target.id, target.perStep).result, `${i + 1}번째`).toBe("ok");
    }
    expect(s.donatedCount).toBe(5);
    expect(s.donatedTotal).toBe(target.perStep * 5);
  });

  it("다른 단체에도 자유롭게 낼 수 있다", () => {
    const s = rich();
    for (const t of DONATION_TARGETS) {
      expect(donate(s, t.id, t.perStep).result, t.name).toBe("ok");
    }
    expect(s.donatedCount).toBe(DONATION_TARGETS.length);
  });

  it("효과에 상한이 있다 — 억을 넣어도 최대 단계까지만", () => {
    // ⚠️ 이게 없으면 현금으로 평판을 채울 수 있고, 평판은 도달 배율 3.3배가 걸린 축이라
    //    트윗·논란 관리가 통째로 무의미해진다.
    expect(donationSteps(target, target.perStep * target.maxSteps * 100)).toBe(target.maxSteps);
    const s = rich();
    const o = donate(s, target.id, 100_000_000);
    expect(o.steps).toBe(target.maxSteps);
    expect(o.morality).toBeLessThanOrEqual(target.moralityPerStep * target.maxSteps);
  });

  it("최소액 미만이거나 잔고가 모자라면 아무것도 안 바뀐다", () => {
    const small = rich();
    const beforeSmall = small.money;
    expect(donate(small, target.id, target.minAmount - 1).result).toBe("tooSmall");
    expect(small.money).toBe(beforeSmall);

    const poor = createInitialState();
    poor.money = 0;
    expect(donate(poor, target.id, target.minAmount).result).toBe("poor");
    expect(poor.money).toBe(0);
    expect(poor.donatedTotal ?? 0).toBe(0);
  });

  it("도덕성이 상한이면 실제 반영분이 0으로 보고된다 — 선언값을 그대로 말하지 않는다", () => {
    const s = rich();
    s.resources.morality = 100;
    const o = donate(s, target.id, target.perStep);
    expect(o.result).toBe("ok");
    expect(o.morality).toBe(0);
  });

  it("금액이 클수록 도덕성 1점당 값이 싸다 — 큰돈의 출구가 이 축의 목적이다", () => {
    const rate = (t: (typeof DONATION_TARGETS)[number]) => t.perStep / t.moralityPerStep;
    const sorted = [...DONATION_TARGETS].sort((a, b) => a.perStep - b.perStep);
    for (let i = 1; i < sorted.length; i++) {
      expect(rate(sorted[i]), `${sorted[i].name}가 더 비싸다`).toBeLessThan(rate(sorted[i - 1]));
    }
  });
});

describe("새해 결산", () => {
  /** 다음 해로 넘긴다. */
  function toNextYear(s: GameState): void {
    const year = dateOf(s.day).getFullYear();
    for (let d = s.day; d < s.day + 400; d++) {
      if (dateOf(d).getFullYear() > year) {
        s.day = d;
        return;
      }
    }
  }

  it("첫 스냅샷에는 결산이 없다 — 지난해가 없으니까", () => {
    const s = createInitialState();
    snapshotYearStart(s);
    expect(s.yearReview).toBeUndefined();
    expect(s.pendingYearReview).toBe(false);
  });

  it("해가 바뀌면 지난해 결산이 남고 발표가 예약된다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 1_000;
    snapshotYearStart(s);
    const firstYear = s.yearStat!.year;

    getActiveAccount(s).followers = 13_400;
    s.awardsWon = [{ year: firstYear, id: "award_stream", label: "올해의 크리에이터상", grand: true }];
    toNextYear(s);
    snapshotYearStart(s);

    expect(s.pendingYearReview).toBe(true);
    expect(s.yearReview!.year).toBe(firstYear);
    expect(s.yearReview!.followerGain, "올해 증감이 안 잡혔다").toBe(12_400);
    expect(s.yearReview!.awards).toBe(1);
  });

  it("결산 뒤 기준선이 새로 찍힌다 — 다음 해 증감이 이어지지 않는다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 500;
    snapshotYearStart(s);
    toNextYear(s);
    getActiveAccount(s).followers = 5_000;
    snapshotYearStart(s);
    expect(s.yearOpenFollowers).toBe(5_000);
  });
});

describe("나쁜 엔딩 도감", () => {
  it("게임오버 사유를 도감 id로 되짚는다", () => {
    expect(dexIdForReason(AFFAIR_GAMEOVER)).toBe("bad_affair");
    expect(dexIdForReason(KILLER_DEAD_REASON)).toBe("bad_killer");
    expect(dexIdForReason("월세를 세 달 연속 내지 못해 방에서 쫓겨났습니다...")).toBe("bad_evict");
    expect(dexIdForReason(null)).toBeNull();
    expect(dexIdForReason("모르는 사유")).toBeNull();
  });

  it("모든 나쁜 엔딩이 도감 목록에 있다", () => {
    const ids = new Set(endingDexRows(createInitialState()).map((r) => r.id));
    for (const b of BAD_ENDINGS) {
      expect(ids.has(b.id), `${b.id}가 도감에 없다`).toBe(true);
    }
  });

  it("나쁜 엔딩도 못 봤으면 제목이 가려지고 힌트는 보인다", () => {
    const rows = endingDexRows(createInitialState());
    for (const b of BAD_ENDINGS) {
      const row = rows.find((r) => r.id === b.id)!;
      expect(row.title).toBe("???");
      expect(row.hint.length).toBeGreaterThan(5);
    }
  });
});

describe("신규 업적", () => {
  it("이번에 만든 시스템에 업적이 붙어 있다", () => {
    // ⚠️ 업적 목록은 "그런 게 있는 줄도 모르는" 콘텐츠를 알리는 자리다.
    const ids = new Set(ACHIEVEMENTS.map((a) => a.id));
    for (const id of [
      "career_peak",
      "award_first",
      "award_grand",
      "rank_first",
      "sponsor_deal",
      "donation_first",
    ]) {
      expect(ids.has(id), `${id} 업적이 없다`).toBe(true);
    }
  });

  it("업적 id가 중복되지 않는다", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("새 업적 조건이 초기 상태에서 던지지 않고 전부 false다", () => {
    const s = createInitialState();
    for (const a of ACHIEVEMENTS) {
      expect(() => a.condition(s), `${a.id}가 초기 상태에서 던진다`).not.toThrow();
    }
  });

  it("정점·수상·기부 업적이 실제로 켜진다", () => {
    const s = createInitialState();
    s.careerPeaks = ["taxi"];
    s.awardsWon = [{ year: 2026, id: "award_stream", label: "올해의 크리에이터상", grand: true }];
    s.donatedTotal = 100_000;
    const on = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!.condition(s);
    expect(on("career_peak")).toBe(true);
    expect(on("award_first")).toBe(true);
    expect(on("award_grand")).toBe(true);
    expect(on("donation_first")).toBe(true);
  });
});
