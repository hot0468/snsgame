import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  awardFor,
  isAwardDay,
  maybeHoldAwards,
  resolveAwards,
  snapshotYearStart,
  yearCount,
} from "@/systems/awards";
import {
  AWARDS,
  MEDIA_AWARDS_DATE,
  MEDIA_AWARDS_MONTH,
  WORK_AWARDS_DATE,
  WORK_AWARDS_MONTH,
} from "@/data/awards";
import { trackCount, rankTracks } from "@/systems/jobRanks";
import { dateOf } from "@/systems/calendar";
import type { GameState } from "@/core/types";

/**
 * 연말 시상식 — 12/29 송년회, 12/30 방송미디어대상.
 *
 * 고정하는 불변식:
 *  1) 상은 **그 해 실적**으로 준다(누적으로 주면 매년 같은 상을 받는 자리가 된다).
 *  2) 시상식마다 상은 하나. 여러 분야를 걸치면 초과율이 큰 쪽.
 *  3) 연 1회. 같은 해에 두 번 열리지 않는다.
 *  4) 상금 지급은 멱등하다.
 *  5) `field`는 실재하는 트랙이어야 한다 — 오타면 그 상은 영영 안 뜬다.
 */

/** 그 해 지정한 월/일로 옮긴다. */
function toDate(s: GameState, month: number, date: number): void {
  for (let d = 1; d <= 366 * 3; d++) {
    const dt = dateOf(d);
    if (dt.getMonth() + 1 === month && dt.getDate() === date) {
      s.day = d;
      return;
    }
  }
}

/** 그 해 실적만 있는 상태(스냅샷 0에서 시작). */
function withYear(field: string, count: number): GameState {
  const s = createInitialState();
  s.yearStat = { year: dateOf(s.day).getFullYear(), counts: { [field]: 0 } };
  if (field === "stream") s.streamCount = count;
  else if (field === "savanna") s.savannaCount = count;
  else if (field === "lecturer") {
    s.lecturerJob = { hiredDay: 1, totalLessons: count, lessonsThisMonth: 0 } as GameState["lecturerJob"];
  } else if (field === "av") {
    s.avJob = { hiredDay: 1, totalWorkDays: count } as GameState["avJob"];
  }
  return s;
}

describe("데이터 정합", () => {
  it("모든 상의 field가 실재하는 트랙이다 — 오타면 그 상은 영영 안 뜬다", () => {
    const known = new Set(rankTracks().map((t) => t.id));
    for (const a of AWARDS) {
      expect(known.has(a.field), `${a.id}: '${a.field}'는 없는 트랙이다`).toBe(true);
    }
  });

  it("대상 문턱이 후보 문턱보다 높다", () => {
    for (const a of AWARDS) {
      expect(a.grandCount, a.id).toBeGreaterThan(a.minYearCount);
    }
  });

  it("두 시상식에 상이 모두 배정돼 있다", () => {
    expect(AWARDS.some((a) => a.show === "media")).toBe(true);
    expect(AWARDS.some((a) => a.show === "work")).toBe(true);
  });

  it("본상·대상 서사가 서로 다르고 비어 있지 않다", () => {
    for (const a of AWARDS) {
      expect(a.text.length, a.id).toBeGreaterThan(80);
      expect(a.grandText.length, a.id).toBeGreaterThan(80);
      expect(a.grandText, `${a.id}: 대상 서사가 본상과 같다`).not.toBe(a.text);
    }
  });
});

describe("올해 실적", () => {
  it("스냅샷과의 차이가 올해 실적이다 — 누적이 아니다", () => {
    const s = createInitialState();
    s.streamCount = 100; // 작년까지 100회
    snapshotYearStart(s);
    s.streamCount = 130; // 올해 30회 더
    expect(trackCount(s, "stream")).toBe(130);
    expect(yearCount(s, "stream"), "누적을 올해 실적으로 쓰고 있다").toBe(30);
  });

  it("해가 바뀌면 스냅샷이 갱신된다", () => {
    const s = createInitialState();
    s.streamCount = 40;
    snapshotYearStart(s);
    const firstYear = s.yearStat!.year;
    // 다음 해로 넘긴다.
    for (let d = s.day; d < s.day + 400; d++) {
      if (dateOf(d).getFullYear() > firstYear) {
        s.day = d;
        break;
      }
    }
    s.streamCount = 70;
    snapshotYearStart(s);
    expect(s.yearStat!.counts.stream).toBe(70);
    expect(yearCount(s, "stream"), "새 해가 시작됐는데 작년 실적이 남아 있다").toBe(0);
  });

  it("같은 해에 두 번 찍어도 기준선이 안 밀린다", () => {
    const s = createInitialState();
    s.streamCount = 10;
    snapshotYearStart(s);
    s.streamCount = 50;
    snapshotYearStart(s); // 같은 해 — 무시돼야 한다
    expect(yearCount(s, "stream")).toBe(40);
  });
});

describe("수상 판정", () => {
  it("후보 문턱에 못 미치면 상이 없다", () => {
    const a = AWARDS.find((x) => x.field === "stream")!;
    const s = withYear("stream", a.minYearCount - 1);
    expect(awardFor(s, "media")).toBeNull();
  });

  it("문턱을 넘으면 본상", () => {
    const a = AWARDS.find((x) => x.field === "stream")!;
    const s = withYear("stream", a.minYearCount);
    const r = awardFor(s, "media")!;
    expect(r.award.id).toBe(a.id);
    expect(r.grand).toBe(false);
    expect(r.prize).toBe(a.prize);
  });

  it("대상 문턱을 넘으면 대상이고 상금이 두 배다", () => {
    const a = AWARDS.find((x) => x.field === "stream")!;
    const s = withYear("stream", a.grandCount);
    const r = awardFor(s, "media")!;
    expect(r.grand).toBe(true);
    expect(r.prize).toBe(a.prize * 2);
  });

  it("여러 분야가 자격이면 하나만 준다 — 초과율이 큰 쪽", () => {
    const stream = AWARDS.find((x) => x.field === "stream")!;
    const savanna = AWARDS.find((x) => x.field === "savanna")!;
    const s = createInitialState();
    s.yearStat = { year: dateOf(s.day).getFullYear(), counts: { stream: 0, savanna: 0 } };
    s.streamCount = stream.minYearCount; // 딱 1배
    s.savannaCount = savanna.minYearCount * 3; // 3배
    const r = awardFor(s, "media")!;
    expect(r.award.field, "초과율이 낮은 쪽이 뽑혔다").toBe("savanna");
  });

  it("다른 시상식의 상은 안 준다", () => {
    const a = AWARDS.find((x) => x.field === "stream")!;
    const s = withYear("stream", a.grandCount);
    expect(awardFor(s, "work"), "방송 실적으로 송년회 상을 받았다").toBeNull();
  });
});

describe("개최", () => {
  it("12월 30일에 방송미디어대상이 열린다", () => {
    const s = createInitialState();
    toDate(s, MEDIA_AWARDS_MONTH, MEDIA_AWARDS_DATE);
    expect(isAwardDay(s, "media")).toBe(true);
    expect(isAwardDay(s, "work")).toBe(false);
    expect(maybeHoldAwards(s)).toBe(true);
    expect(s.pendingAwards).toBe("media");
  });

  it("12월 29일에 송년회가 열린다", () => {
    const s = createInitialState();
    toDate(s, WORK_AWARDS_MONTH, WORK_AWARDS_DATE);
    expect(isAwardDay(s, "work")).toBe(true);
    expect(maybeHoldAwards(s)).toBe(true);
    expect(s.pendingAwards).toBe("work");
  });

  it("시상식 날이 아니면 안 열린다", () => {
    const s = createInitialState();
    toDate(s, 6, 15);
    expect(maybeHoldAwards(s)).toBe(false);
    expect(s.pendingAwards).toBeNull();
  });

  it("같은 해에 두 번 열리지 않는다", () => {
    const s = createInitialState();
    toDate(s, MEDIA_AWARDS_MONTH, MEDIA_AWARDS_DATE);
    maybeHoldAwards(s);
    resolveAwards(s);
    expect(maybeHoldAwards(s), "같은 날 또 열렸다").toBe(false);
  });
});

describe("수상 확정", () => {
  function held(field: string, count: number, show: "media" | "work"): GameState {
    const s = withYear(field, count);
    const month = show === "media" ? MEDIA_AWARDS_MONTH : WORK_AWARDS_MONTH;
    const date = show === "media" ? MEDIA_AWARDS_DATE : WORK_AWARDS_DATE;
    const year = s.yearStat!.year;
    toDate(s, month, date);
    s.yearStat = { year, counts: { [field]: 0 } };
    maybeHoldAwards(s);
    return s;
  }

  it("상금·평판·팔로워가 들어오고 이력이 남는다", () => {
    const a = AWARDS.find((x) => x.field === "stream")!;
    const s = held("stream", a.grandCount, "media");
    s.resources.reputation = 50;
    const before = s.money;
    const o = resolveAwards(s)!;
    expect(o.result, "자격을 채웠는데 수상이 없다").toBeTruthy();
    expect(s.money).toBe(before + a.prize * 2);
    expect(s.resources.reputation).toBeGreaterThan(50);
    expect(s.awardsWon!.length).toBe(1);
    expect(s.awardsWon![0].grand).toBe(true);
    expect(s.pendingAwards).toBeNull();
  });

  it("두 번 확정해도 상금은 한 번만 들어온다", () => {
    const a = AWARDS.find((x) => x.field === "stream")!;
    const s = held("stream", a.minYearCount, "media");
    resolveAwards(s);
    const after = s.money;
    expect(resolveAwards(s)).toBeNull();
    expect(s.money).toBe(after);
  });

  it("자격이 없으면 상 없이 지나간다 — 게임을 막지는 않는다", () => {
    const s = held("stream", 0, "media");
    const before = s.money;
    const o = resolveAwards(s)!;
    expect(o.result).toBeNull();
    expect(o.missLine.length).toBeGreaterThan(0);
    expect(s.money).toBe(before);
    expect(s.pendingAwards).toBeNull();
  });
});
