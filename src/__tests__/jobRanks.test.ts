import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  checkJobPromotions,
  currentRankStep,
  jobCareerCount,
  ladderOf,
  rankStepFor,
  rankTitle,
  resolveJobPromotion,
  toNextRank,
} from "@/systems/jobRanks";
import {
  JOB_RANK_LADDERS,
  PEAK_STEP,
  PROMOTION_BONUS,
  RANK_THRESHOLDS,
} from "@/data/jobRanks";
import { JOB_CATALOG, jobLevelRows } from "@/systems/jobLevels";
import { JOB_ID, markJobExperienced, stashJobCareer } from "@/systems/jobExperience";
import type { GameState } from "@/core/types";

/**
 * 직업 경력 등급.
 *
 * 왜 넣었나: 직업 레벨이 `floor(누적/5)`로 무한히 오르기만 하고 아무것도 안 줬다.
 * 도감에 숫자 하나가 커질 뿐이라 "여기까지 왔다"는 순간이 없었다 — 배구부에는
 * 전국체전 우승이 있는데 나머지 직업엔 그런 자리가 없었다.
 *
 * 고정하는 불변식:
 *  1) 직업 카탈로그의 **모든** 직업에 사다리가 있다(빠지면 그 직업만 영영 승급 안 한다).
 *  2) 계단은 다섯이고 마지막이 정점이다.
 *  3) 승급은 **한 계단씩** 알린다 — 건너뛰면 그 계단의 순간이 사라진다.
 *  4) 축하금은 한 번만 들어간다(멱등).
 *  5) 정점은 그만둬도 남는다.
 */

function taxiAt(rides: number): GameState {
  const s = createInitialState();
  s.taxiJob = {
    hiredDay: 1,
    totalRides: rides,
    totalEarned: 0,
    rating: 5,
  } as GameState["taxiJob"];
  markJobExperienced(s, JOB_ID.taxi);
  return s;
}

describe("사다리", () => {
  it("도감의 모든 직업에 사다리가 있다", () => {
    for (const entry of JOB_CATALOG) {
      expect(ladderOf(entry.id), `${entry.id}(${entry.label})에 사다리가 없다`).toBeTruthy();
    }
  });

  it("모든 사다리가 다섯 계단이고 이름이 중복되지 않는다", () => {
    for (const [id, ladder] of Object.entries(JOB_RANK_LADDERS)) {
      expect(ladder.titles.length, `${id}`).toBe(PEAK_STEP);
      expect(new Set(ladder.titles).size, `${id}: 등급명이 겹친다`).toBe(PEAK_STEP);
      expect(ladder.peak.length, `${id}: 정점 서사가 비었다`).toBeGreaterThan(80);
    }
  });

  it("문턱이 오름차순이고 축하금이 계단만큼 있다", () => {
    for (let i = 1; i < RANK_THRESHOLDS.length; i++) {
      expect(RANK_THRESHOLDS[i]).toBeGreaterThan(RANK_THRESHOLDS[i - 1]);
    }
    expect(PROMOTION_BONUS.length).toBe(PEAK_STEP);
    for (let i = 1; i < PROMOTION_BONUS.length; i++) {
      expect(PROMOTION_BONUS[i], "축하금이 계단을 따라 안 커진다").toBeGreaterThan(
        PROMOTION_BONUS[i - 1],
      );
    }
  });

  it("누적이 계단으로 옳게 번역된다", () => {
    expect(rankStepFor(0)).toBe(0);
    expect(rankStepFor(RANK_THRESHOLDS[0] - 1)).toBe(0);
    expect(rankStepFor(RANK_THRESHOLDS[0])).toBe(1);
    expect(rankStepFor(RANK_THRESHOLDS[PEAK_STEP - 1])).toBe(PEAK_STEP);
    expect(rankStepFor(99_999)).toBe(PEAK_STEP);
  });

  it("정점에서는 '다음 계단'이 없다", () => {
    const s = taxiAt(RANK_THRESHOLDS[PEAK_STEP - 1]);
    expect(currentRankStep(s, JOB_ID.taxi)).toBe(PEAK_STEP);
    expect(toNextRank(s, JOB_ID.taxi)).toBeNull();
  });

  it("그만둬도 등급이 내려가지 않는다 — 보관된 경력을 본다", () => {
    const s = createInitialState();
    stashJobCareer(s, JOB_ID.taxi, RANK_THRESHOLDS[2]);
    expect(jobCareerCount(s, JOB_ID.taxi)).toBe(RANK_THRESHOLDS[2]);
    expect(currentRankStep(s, JOB_ID.taxi)).toBe(3);
  });
});

describe("승급 감지", () => {
  it("문턱을 넘으면 예약된다", () => {
    const s = taxiAt(RANK_THRESHOLDS[0]);
    expect(checkJobPromotions(s)).toBe(true);
    expect(s.pendingJobRank).toEqual({ job: JOB_ID.taxi, step: 1 });
  });

  it("문턱 아래면 예약되지 않는다", () => {
    const s = taxiAt(RANK_THRESHOLDS[0] - 1);
    expect(checkJobPromotions(s)).toBe(false);
    expect(s.pendingJobRank).toBeNull();
  });

  it("한 번에 여러 계단을 뛰어도 한 계단씩 알린다", () => {
    const s = taxiAt(RANK_THRESHOLDS[PEAK_STEP - 1]);
    for (let step = 1; step <= PEAK_STEP; step++) {
      expect(checkJobPromotions(s), `${step}계단 예약 실패`).toBe(true);
      expect(s.pendingJobRank!.step).toBe(step);
      resolveJobPromotion(s);
    }
    expect(checkJobPromotions(s), "정점 뒤에도 승급이 남아 있다").toBe(false);
  });

  it("답 안 한 승급이 있으면 새로 예약하지 않는다", () => {
    const s = taxiAt(RANK_THRESHOLDS[2]);
    checkJobPromotions(s);
    const first = { ...s.pendingJobRank! };
    expect(checkJobPromotions(s)).toBe(false);
    expect(s.pendingJobRank).toEqual(first);
  });

  it("같은 계단을 두 번 알리지 않는다", () => {
    const s = taxiAt(RANK_THRESHOLDS[0]);
    checkJobPromotions(s);
    resolveJobPromotion(s);
    expect(checkJobPromotions(s)).toBe(false);
  });
});

describe("승급 확정", () => {
  it("축하금이 들어오고 등급명이 나온다", () => {
    const s = taxiAt(RANK_THRESHOLDS[0]);
    checkJobPromotions(s);
    const before = s.money;
    const r = resolveJobPromotion(s)!;
    expect(r.title).toBe(rankTitle(JOB_ID.taxi, 1));
    expect(r.peak).toBe(false);
    expect(s.money).toBe(before + PROMOTION_BONUS[0]);
    expect(s.pendingJobRank).toBeNull();
  });

  it("두 번 확정해도 축하금은 한 번만 들어간다", () => {
    const s = taxiAt(RANK_THRESHOLDS[0]);
    checkJobPromotions(s);
    resolveJobPromotion(s);
    const after = s.money;
    expect(resolveJobPromotion(s)).toBeNull();
    expect(s.money).toBe(after);
  });

  it("정점은 커리어에 영구히 남고 평판이 오른다", () => {
    const s = taxiAt(RANK_THRESHOLDS[PEAK_STEP - 1]);
    s.resources.reputation = 50;
    for (let i = 0; i < PEAK_STEP; i++) {
      checkJobPromotions(s);
      resolveJobPromotion(s);
    }
    expect(s.careerPeaks).toContain(JOB_ID.taxi);
    expect(s.resources.reputation).toBeGreaterThan(50);
  });

  it("정점 서사는 승급 서사와 다르다 — 전국체전급 자리라야 한다", () => {
    const s = taxiAt(RANK_THRESHOLDS[PEAK_STEP - 1]);
    let peakText = "";
    let midText = "";
    for (let i = 1; i <= PEAK_STEP; i++) {
      checkJobPromotions(s);
      const r = resolveJobPromotion(s)!;
      if (r.peak) peakText = r.text;
      else midText = r.text;
    }
    expect(peakText).toBe(JOB_RANK_LADDERS[JOB_ID.taxi].peak);
    expect(peakText.length).toBeGreaterThan(midText.length);
  });
});

describe("도감 표시", () => {
  it("해금된 직업 행에 등급명과 다음 계단까지 남은 수가 붙는다", () => {
    const s = taxiAt(RANK_THRESHOLDS[1]);
    const row = jobLevelRows(s).find((r) => r.id === JOB_ID.taxi)!;
    expect(row.rankStep).toBe(2);
    expect(row.rankTitle).toBe(rankTitle(JOB_ID.taxi, 2));
    expect(row.toNextRank).toBe(RANK_THRESHOLDS[2] - RANK_THRESHOLDS[1]);
    expect(row.peaked).toBe(false);
  });

  it("안 해본 직업은 등급이 비어 있다", () => {
    const s = createInitialState();
    const row = jobLevelRows(s).find((r) => !r.unlocked)!;
    expect(row.rankTitle).toBeNull();
    expect(row.rankStep).toBe(0);
  });
});
