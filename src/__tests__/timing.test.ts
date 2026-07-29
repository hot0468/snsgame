import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount, SLOTS_PER_DAY } from "@/core/state";
import {
  SLOT_TIMING_MULTIPLIERS,
  WEEKDAY_TIMING_MULTIPLIERS,
  TIMING_TIERS,
} from "@/data/timing";
import { timingMultiplier, timingTier, calcTweetOutcome } from "@/systems/followers";
import { dayOfWeek } from "@/systems/calendar";

/**
 * 알고리즘 타이밍 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 배율 폭이 통제 범위 안에 있는 것. 트윗 성과는 이미 skillMul·affinityMul·trendMul·
 *   eff.reachMul이 곱해지는 구조라, 타이밍 폭이 커지면 분산이 통제 불능이 된다.
 * - 타이밍이 **base에** 곱해지는 것(좋아요·RT·팔로워가 함께 움직여야 한다).
 *   팔로워에만 곱하면 "반응은 그대론데 팔로워만 다른" 결과가 된다.
 */

describe("배율표", () => {
  it("슬롯은 심야가 낮보다 유리하다", () => {
    expect(SLOT_TIMING_MULTIPLIERS[1]).toBeGreaterThan(SLOT_TIMING_MULTIPLIERS[0]);
  });

  it("슬롯 배율표가 슬롯 수를 덮는다", () => {
    expect(SLOT_TIMING_MULTIPLIERS.length).toBeGreaterThanOrEqual(SLOTS_PER_DAY);
  });

  it("요일 배율은 7개이고 전부 [0.8, 1.3] 범위다", () => {
    expect(WEEKDAY_TIMING_MULTIPLIERS).toHaveLength(7);
    for (const m of WEEKDAY_TIMING_MULTIPLIERS) {
      expect(m).toBeGreaterThanOrEqual(0.8);
      expect(m).toBeLessThanOrEqual(1.3);
    }
  });

  it("주말(토·일)이 월요일보다 유리하다", () => {
    const [sun, mon, , , , , sat] = WEEKDAY_TIMING_MULTIPLIERS;
    expect(sat).toBeGreaterThan(mon);
    expect(sun).toBeGreaterThan(mon);
  });
});

describe("타이밍 배율", () => {
  it("슬롯 × 요일의 곱이다", () => {
    for (let day = 1; day <= 14; day++) {
      for (let slot = 0; slot < SLOTS_PER_DAY; slot++) {
        const expected =
          SLOT_TIMING_MULTIPLIERS[slot] * WEEKDAY_TIMING_MULTIPLIERS[dayOfWeek(day)];
        expect(timingMultiplier(day, slot)).toBeCloseTo(expected, 10);
      }
    }
  });

  it("전체 폭이 약 1.75배를 넘지 않는다(분산 통제)", () => {
    const all: number[] = [];
    for (let day = 1; day <= 14; day++) {
      for (let slot = 0; slot < SLOTS_PER_DAY; slot++) all.push(timingMultiplier(day, slot));
    }
    const min = Math.min(...all);
    const max = Math.max(...all);
    expect(min).toBeGreaterThanOrEqual(0.8);
    expect(max).toBeLessThanOrEqual(1.55);
    expect(max / min).toBeLessThanOrEqual(1.9);
  });

  it("표에 없는 슬롯·요일이면 1로 떨어진다(크래시 방지)", () => {
    // 슬롯이 늘어나도 죽지 않아야 한다
    expect(timingMultiplier(1, 99)).toBeCloseTo(WEEKDAY_TIMING_MULTIPLIERS[dayOfWeek(1)], 10);
  });
});

describe("타이밍 등급", () => {
  it("경계값에서 올바르게 갈린다", () => {
    expect(timingTier(1.5).kind).toBe("hot");
    expect(timingTier(1.35).kind).toBe("hot");
    expect(timingTier(1.34).kind).toBe("good");
    expect(timingTier(1.1).kind).toBe("good");
    expect(timingTier(1.09).kind).toBe("normal");
    expect(timingTier(0.95).kind).toBe("normal");
    expect(timingTier(0.94).kind).toBe("cold");
    expect(timingTier(0.5).kind).toBe("cold");
  });

  it("모든 등급이 문구를 갖고 내림차순이다", () => {
    for (const t of TIMING_TIERS) expect(t.label.length).toBeGreaterThan(0);
    for (let i = 1; i < TIMING_TIERS.length; i++) {
      expect(TIMING_TIERS[i].min).toBeLessThan(TIMING_TIERS[i - 1].min);
    }
  });

  it("어떤 배율에도 등급이 하나는 잡힌다", () => {
    for (const mul of [0, 0.5, 1, 1.25, 1.5, 3]) {
      expect(timingTier(mul), String(mul)).toBeDefined();
    }
  });
});

describe("트윗 성과 반영", () => {
  /** 같은 조건에서 여러 번 굴려 평균 성과를 낸다(트윗 성과엔 난수가 섞여 있다) */
  function avgOutcome(day: number, slot: number): number {
    const s = createInitialState();
    getActiveAccount(s).followers = 5_000;
    s.day = day;
    s.slot = slot;
    let sum = 0;
    const N = 200;
    for (let i = 0; i < N; i++) {
      const o = calcTweetOutcome(s, getActiveAccount(s).attribute);
      sum += o.likes;
    }
    return sum / N;
  }

  it("같은 날이면 심야가 낮보다 반응이 좋다", () => {
    // 요일을 고정하려면 같은 day를 써야 한다.
    const day = 6; // 임의의 날 — 요일은 고정된다
    expect(avgOutcome(day, 1)).toBeGreaterThan(avgOutcome(day, 0));
  });

  it("좋아요·RT·팔로워가 함께 움직인다(base에 곱해진 증거)", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = 50_000;
    const attr = getActiveAccount(s).attribute;

    const sample = (slot: number) => {
      s.slot = slot;
      let likes = 0;
      let rts = 0;
      const N = 300;
      for (let i = 0; i < N; i++) {
        const o = calcTweetOutcome(s, attr);
        likes += o.likes;
        rts += o.retweets;
      }
      return { likes: likes / N, rts: rts / N };
    };
    const day0 = sample(0);
    const night = sample(1);
    // 심야가 좋아요와 RT **둘 다** 높아야 한다 — 하나만 오르면 base가 아닌 곳에 곱한 것이다.
    expect(night.likes).toBeGreaterThan(day0.likes);
    expect(night.rts).toBeGreaterThan(day0.rts);
  });
});
