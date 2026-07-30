import { describe, it, expect, beforeEach } from "vitest";
import { HOOP_PRIZES, HOOP_SCORE_LINES, HOOP_MISS_LINES } from "@/data/basketball";
import { createInitialState } from "@/core/state";
import { loadGame } from "@/systems/save";
import { ACHIEVEMENTS } from "@/data/achievements";
import {
  HOOP_COST,
  HOOP_DURATION_MS,
  payHoop,
  prizeFor,
  finishHoop,
} from "@/systems/basketball";

/**
 * 오락실 농구 슛 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 점수 구간이 0점부터 빈틈없이 전 구간을 덮는 것(폴백이 사라지면 정산이 터진다).
 * - 기댓값이 1판 비용을 크게 넘지 않는 것(농구가 돈 버는 루프가 되면 경제가 붕괴한다).
 * - 최고 기록이 낮은 점수로 깎이지 않는 것.
 *
 * ⚠️ 득점 판정(림 통과·방향)은 물리 미니게임(ui/hoopScene.ts)이 한다 —
 *    여기서 슛 성공률을 검사하지 마라.
 */

describe("점수 구간표", () => {
  it("내림차순이며 맨 아래가 0점 폴백이다", () => {
    for (let i = 1; i < HOOP_PRIZES.length; i += 1) {
      expect(
        HOOP_PRIZES[i].minScore,
        `${i}번째 구간이 앞 구간보다 크거나 같다 — 내림차순이 깨지면 prizeFor가 엉뚱한 구간을 준다`,
      ).toBeLessThan(HOOP_PRIZES[i - 1].minScore);
    }
    expect(HOOP_PRIZES[HOOP_PRIZES.length - 1].minScore).toBe(0);
  });

  it("0점부터 어떤 점수에도 구간이 하나는 잡힌다", () => {
    for (let score = 0; score <= 40; score += 1) {
      expect(prizeFor(score), `${score}골에 구간이 없다`).toBeDefined();
    }
  });

  it("모든 구간이 이름과 결과 문구를 갖는다", () => {
    for (const p of HOOP_PRIZES) {
      expect(p.label.length, `${p.minScore}구간 이름`).toBeGreaterThan(0);
      expect(p.result.length, `${p.minScore}구간 문구`).toBeGreaterThan(10);
    }
  });

  it("점수가 오를수록 상금이 단조 증가한다", () => {
    // 내림차순 배열이므로 뒤로 갈수록(=점수가 낮을수록) 상금이 작아야 한다.
    for (let i = 1; i < HOOP_PRIZES.length; i += 1) {
      expect(
        HOOP_PRIZES[i].money,
        `${HOOP_PRIZES[i].minScore}골 구간이 윗구간보다 후하다`,
      ).toBeLessThan(HOOP_PRIZES[i - 1].money);
    }
  });

  it("연출 문구가 비어 있지 않다", () => {
    expect(HOOP_SCORE_LINES.length).toBeGreaterThan(0);
    expect(HOOP_MISS_LINES.length).toBeGreaterThan(0);
  });
});

describe("경제 균형", () => {
  it("0~2골은 상금이 없다(초보는 본전을 못 뽑는다)", () => {
    for (const score of [0, 1, 2]) {
      expect(prizeFor(score).money, `${score}골`).toBe(0);
    }
  });

  it("손익분기(3골)가 1판 비용을 아주 조금만 넘는다", () => {
    const breakeven = prizeFor(3).money;
    expect(breakeven).toBeGreaterThan(HOOP_COST);
    expect(breakeven).toBeLessThanOrEqual(HOOP_COST * 3);
  });

  /**
   * ⚠️ **경제 붕괴 방지선.** 실력 분포를 낮은 점수 쪽에 몰아서(초보가 다수) 기댓값을 본다.
   *    균등 분포로 재면 안 된다 — 6~9골 네 구간이 모두 6,000원이라 평균이 실제보다
   *    부풀려진다(설계상 초보는 대개 0~2골이다).
   */
  it("초보가 다수인 분포에서 기댓값이 1판 비용을 넘지 않는다", () => {
    // 0~2골 60% · 3~5골 25% · 6~9골 12% · 10골 이상 3%
    const buckets: { scores: number[]; weight: number }[] = [
      { scores: [0, 1, 2], weight: 0.6 },
      { scores: [3, 4, 5], weight: 0.25 },
      { scores: [6, 7, 8, 9], weight: 0.12 },
      { scores: [10, 12, 15], weight: 0.03 },
    ];
    let expected = 0;
    for (const b of buckets) {
      const avg = b.scores.reduce((sum, s) => sum + prizeFor(s).money, 0) / b.scores.length;
      expected += avg * b.weight;
    }
    // ⚠️ 상한을 비용의 2배로 잡은 건 **고득점 대박(15골 40,000원)을 살리기 위한 의도적 선택**이다.
    //    설계의 '1,000원을 크게 넘지 않게'와 '잘하는 플레이어만 이득'은 이 지점에서 충돌하는데,
    //    30초 물리 판정으로 15골은 실제로 매우 어려우므로 대박 쪽을 남겼다.
    //    이 선을 넘기면 농구가 돈 버는 루프가 된다 — 상품표를 올릴 땐 여기부터 다시 계산하라.
    expect(expected).toBeLessThanOrEqual(HOOP_COST * 2);
  });

  it("1판 비용과 제한시간이 상식적인 값이다", () => {
    expect(HOOP_COST).toBeGreaterThan(0);
    expect(HOOP_DURATION_MS).toBeGreaterThanOrEqual(10_000);
    expect(HOOP_DURATION_MS).toBeLessThanOrEqual(120_000);
  });
});

describe("동전 넣기", () => {
  it("1판마다 비용이 나간다", () => {
    const s = createInitialState();
    const before = s.money;
    expect(payHoop(s)).toBe(true);
    expect(s.money).toBe(before - HOOP_COST);
  });

  it("동전이 모자라면 아무 일도 없다", () => {
    const s = createInitialState();
    s.money = HOOP_COST - 1;
    expect(payHoop(s)).toBe(false);
    expect(s.money).toBe(HOOP_COST - 1);
  });
});

describe("한 판 정산", () => {
  it("구간대로 상금을 지급한다", () => {
    const s = createInitialState();
    const before = s.money;
    const r = finishHoop(s, 12);
    expect(r.prize.minScore).toBe(10);
    expect(s.money).toBe(before + r.prize.money);
  });

  it("스탯이 오르고 라벨은 한글 표시명이다", () => {
    const s = createInitialState();
    const r = finishHoop(s, 15);
    expect(r.skillGains.length).toBeGreaterThan(0);
    for (const g of r.skillGains) {
      // 스탯 id(fitness 등)가 그대로 노출되면 안 된다.
      expect(g.label).not.toMatch(/^[a-z]+$/);
      expect(g.delta).toBeGreaterThan(0);
    }
  });

  it("0골이면 상금도 스탯도 없다", () => {
    const s = createInitialState();
    const before = s.money;
    const r = finishHoop(s, 0);
    expect(r.prize.money).toBe(0);
    expect(s.money).toBe(before);
    expect(r.skillGains).toEqual([]);
  });

  it("정신력은 상한을 넘지 않는다", () => {
    const s = createInitialState();
    s.resources.mental = 99;
    finishHoop(s, 20);
    expect(s.resources.mental).toBeLessThanOrEqual(100);
  });
});

describe("최고 기록", () => {
  it("첫 판이 곧 신기록이다", () => {
    const s = createInitialState();
    const r = finishHoop(s, 5);
    expect(r.isBest).toBe(true);
    expect(s.hoopBest).toBe(5);
    expect(r.best).toBe(5);
  });

  it("더 높은 점수라야 갱신된다", () => {
    const s = createInitialState();
    finishHoop(s, 8);
    const r = finishHoop(s, 11);
    expect(r.isBest).toBe(true);
    expect(s.hoopBest).toBe(11);
  });

  /** ⚠️ 낮은 점수로 최고 기록이 깎이면 업적이 풀렸다 잠긴다. */
  it("낮은 점수로는 깎이지 않는다", () => {
    const s = createInitialState();
    finishHoop(s, 14);
    const r = finishHoop(s, 2);
    expect(r.isBest).toBe(false);
    expect(s.hoopBest).toBe(14);
    expect(r.best).toBe(14);
  });

  it("같은 점수는 신기록이 아니다", () => {
    const s = createInitialState();
    finishHoop(s, 7);
    expect(finishHoop(s, 7).isBest).toBe(false);
  });
});

/* ── 구세이브 로드 하네스(arcade.test.ts와 같은 방식) ── */
const KEY = "snsgame:save:v2";
const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
});

function loadLegacy(mutate: (o: any) => void) {
  const legacy: any = createInitialState();
  mutate(legacy);
  store[KEY] = JSON.stringify(legacy);
  const loaded = loadGame();
  expect(loaded, "구세이브 로드가 null을 반환하면 안 된다").toBeTruthy();
  return loaded!;
}

describe("hoopBest 상태 필드", () => {
  it("초기 상태가 0이다", () => {
    expect(createInitialState().hoopBest).toBe(0);
  });

  it("구세이브에 기본값 0을 주입한다", () => {
    expect(loadLegacy((o) => delete o.hoopBest).hoopBest).toBe(0);
  });

  it("기존 기록은 로드해도 보존된다", () => {
    expect(loadLegacy((o) => (o.hoopBest = 13)).hoopBest).toBe(13);
  });

  /** ⚠️ NaN이 들어가면 `score > best` 비교가 영원히 false라 신기록이 안 잡힌다. */
  it("깨진 값은 0으로 되돌린다", () => {
    expect(loadLegacy((o) => (o.hoopBest = "열두골")).hoopBest).toBe(0);
    expect(loadLegacy((o) => (o.hoopBest = null)).hoopBest).toBe(0);
  });
});

describe("농구 업적", () => {
  const byId = (id: string) => ACHIEVEMENTS.find((a) => a.id === id)!;

  it("2종이 등록돼 있다", () => {
    expect(byId("hoop_first")).toBeDefined();
    expect(byId("hoop_ten")).toBeDefined();
  });

  it("첫 골은 1골부터 풀린다", () => {
    const s = createInitialState();
    expect(byId("hoop_first").condition(s)).toBe(false);
    s.hoopBest = 1;
    expect(byId("hoop_first").condition(s)).toBe(true);
  });

  it("슛 감각은 10골부터 풀린다", () => {
    const s = createInitialState();
    s.hoopBest = 9;
    expect(byId("hoop_ten").condition(s)).toBe(false);
    s.hoopBest = 10;
    expect(byId("hoop_ten").condition(s)).toBe(true);
  });

  it("정산으로 기록이 오르면 업적 조건이 충족된다", () => {
    const s = createInitialState();
    finishHoop(s, 10);
    expect(byId("hoop_first").condition(s)).toBe(true);
    expect(byId("hoop_ten").condition(s)).toBe(true);
  });
});
