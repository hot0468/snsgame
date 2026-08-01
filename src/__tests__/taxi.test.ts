import { describe, it, expect } from "vitest";
import { createInitialState, LATE_SLOT, MORNING_SLOT } from "@/core/state";
import {
  TAXI_BASE_FARE,
  TAXI_DELUXE_CERT,
  TAXI_NIGHT_MULTIPLIER,
  TAXI_PASSENGERS,
  TAXI_RATING_START,
  TAXI_REQ_CERT,
} from "@/data/taxi";
import {
  canApplyTaxi,
  estimateFare,
  isDeluxeTaxi,
  joinTaxi,
  ratingFareMultiplier,
  resolveRide,
  rollPassenger,
} from "@/systems/taxi";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { hasJobExperience, JOB_ID } from "@/systems/jobExperience";
import type { GameState } from "@/core/types";

/**
 * 택시 기사직 회귀 테스트.
 *
 * 고정하는 불변식:
 *  1) 1종 보통 면허가 **입사 게이트**다(면허가 처음으로 값을 하는 지점).
 *  2) **심야 할증**이 실제로 붙는다 — 이 직업의 존재 이유다(심야는 트윗 도달이 가장 좋은
 *     슬롯이라, 할증이 없으면 심야에 운행할 이유가 없다).
 *  3) 요금은 운행 **즉시** 소지금에 들어온다(고정급 없음 — 다른 직업과 갈리는 축).
 *  4) 겸직 배타에 편입돼 있다(hasAnyJob·currentJobLabel·quitCurrentJob 셋 다).
 *  5) 승객 선택지는 **양날**이다 — 평점을 크게 올리는 선택엔 대가가 붙어 있다.
 */

/** 면허를 채운 상태. */
function licensed(): GameState {
  const s = createInitialState();
  s.certifications.push(TAXI_REQ_CERT);
  return s;
}

describe("입사", () => {
  it("면허가 없으면 지원할 수 없다", () => {
    const s = createInitialState();
    expect(canApplyTaxi(s)).toBe(false);
    expect(joinTaxi(s)).toBeNull();
    expect(s.taxiJob).toBeNull();
  });

  it("1종 보통 면허가 있으면 입사된다", () => {
    const s = licensed();
    expect(canApplyTaxi(s)).toBe(true);
    expect(joinTaxi(s)).not.toBeNull();
    expect(s.taxiJob!.rating).toBe(TAXI_RATING_START);
    expect(s.taxiJob!.totalRides).toBe(0);
  });

  it("입사하면 직업 도감에 남는다", () => {
    const s = licensed();
    joinTaxi(s);
    expect(hasJobExperience(s, JOB_ID.taxi)).toBe(true);
  });

  it("겸직 배타에 편입돼 있다", () => {
    const s = licensed();
    joinTaxi(s);
    expect(hasAnyJob(s), "hasAnyJob이 택시를 못 보면 겸직이 뚫린다").toBe(true);
    expect(currentJobLabel(s)).toBe("택시 기사");
  });

  it("입사하면 기존 직업이 정리된다", () => {
    const s = licensed();
    s.lecturerJob = { hiredDay: 1, lessonsThisMonth: 0, totalLessons: 0, lastSalaryMonth: -1 };
    joinTaxi(s);
    expect(s.lecturerJob, "quitCurrentJob이 택시 입사 시 안 돌면 겸직이 된다").toBeNull();
    expect(s.taxiJob).not.toBeNull();
  });
});

describe("요금", () => {
  it("심야 운행에 할증이 붙는다", () => {
    const s = licensed();
    joinTaxi(s);
    s.slot = MORNING_SLOT;
    const day = estimateFare(s);
    s.slot = LATE_SLOT;
    const night = estimateFare(s);
    expect(night).toBeGreaterThan(day);
    expect(night / day).toBeCloseTo(TAXI_NIGHT_MULTIPLIER, 1);
  });

  it("평점이 높을수록 요금이 오른다", () => {
    const s = licensed();
    joinTaxi(s);
    s.slot = MORNING_SLOT;
    s.taxiJob!.rating = 0;
    const low = estimateFare(s);
    s.taxiJob!.rating = 100;
    const high = estimateFare(s);
    expect(high).toBeGreaterThan(low);
  });

  it("평점 배율은 0.8~1.3 범위를 벗어나지 않는다", () => {
    expect(ratingFareMultiplier(0)).toBeCloseTo(0.8, 5);
    expect(ratingFareMultiplier(100)).toBeCloseTo(1.3, 5);
    // NaN·범위 밖이 들어와도 요금이 NaN이 되면 안 된다(소지금 오염).
    expect(Number.isFinite(ratingFareMultiplier(NaN))).toBe(true);
    expect(ratingFareMultiplier(999)).toBeCloseTo(1.3, 5);
  });

  it("1종 대형이 있으면 모범택시로 요금이 더 붙는다", () => {
    const s = licensed();
    joinTaxi(s);
    s.slot = MORNING_SLOT;
    const normal = estimateFare(s);
    s.certifications.push(TAXI_DELUXE_CERT);
    expect(isDeluxeTaxi(s)).toBe(true);
    expect(estimateFare(s)).toBeGreaterThan(normal);
  });
});

describe("운행", () => {
  it("요금이 즉시 소지금에 들어온다 — 고정급이 없는 직업이다", () => {
    const s = licensed();
    joinTaxi(s);
    s.slot = MORNING_SLOT;
    const before = s.money;
    const choice = { label: "x", result: "y", rating: 0 };
    const r = resolveRide(s, choice);
    expect(r).not.toBeNull();
    expect(s.money - before).toBe(r!.fare);
    expect(r!.fare).toBeGreaterThan(0);
  });

  it("운행 누적과 수입 누적이 쌓인다", () => {
    const s = licensed();
    joinTaxi(s);
    const choice = { label: "x", result: "y", rating: 0 };
    resolveRide(s, choice);
    resolveRide(s, choice);
    expect(s.taxiJob!.totalRides).toBe(2);
    expect(s.taxiJob!.totalEarned).toBeGreaterThan(TAXI_BASE_FARE);
  });

  it("평점은 0~100을 벗어나지 않는다", () => {
    const s = licensed();
    joinTaxi(s);
    for (let i = 0; i < 30; i++) resolveRide(s, { label: "x", result: "y", rating: -20 });
    expect(s.taxiJob!.rating).toBe(0);
    for (let i = 0; i < 30; i++) resolveRide(s, { label: "x", result: "y", rating: 20 });
    expect(s.taxiJob!.rating).toBe(100);
  });

  it("이번 요금은 응대 전 평점으로 계산된다 — 미터기는 탈 때 정해진다", () => {
    const s = licensed();
    joinTaxi(s);
    s.slot = MORNING_SLOT;
    const expected = estimateFare(s); // 응대 전 평점 기준
    const r = resolveRide(s, { label: "x", result: "y", rating: 40 });
    expect(r!.fare).toBe(expected);
    // 평점은 올랐고, 그 효과는 다음 운행부터다.
    expect(s.taxiJob!.rating).toBeGreaterThan(TAXI_RATING_START);
    expect(estimateFare(s)).toBeGreaterThan(expected);
  });

  it("기사가 아니면 운행이 안 된다", () => {
    const s = createInitialState();
    expect(resolveRide(s, { label: "x", result: "y", rating: 0 })).toBeNull();
  });
});

describe("승객 콘텐츠", () => {
  it("심야 전용 상황은 낮에 안 나온다", () => {
    const s = licensed();
    joinTaxi(s);
    s.slot = MORNING_SLOT;
    for (let i = 0; i < 200; i++) {
      expect(rollPassenger(s).nightOnly ?? false).toBe(false);
    }
  });

  it("모든 승객 상황에 선택지가 2개 이상 있다", () => {
    for (const p of TAXI_PASSENGERS) {
      expect(p.choices.length, `${p.id}`).toBeGreaterThanOrEqual(2);
    }
  });

  it("평점을 크게 올리는 선택엔 반드시 대가가 붙는다", () => {
    // 한쪽이 공짜로 이득이면 고를 이유가 없어진다 — 선택지가 죽는다.
    for (const p of TAXI_PASSENGERS) {
      for (const c of p.choices) {
        if (c.rating < 6) continue;
        const cost = (c.mental ?? 0) < 0 || (c.morality ?? 0) < 0 || (c.fareMul ?? 1) < 1;
        expect(cost, `${p.id}/"${c.label}" 평점 +${c.rating}인데 대가가 없다`).toBe(true);
      }
    }
  });

  it("id가 중복되지 않는다", () => {
    const ids = TAXI_PASSENGERS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
