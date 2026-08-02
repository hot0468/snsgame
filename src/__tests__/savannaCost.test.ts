import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  SAVANNA_ACTION_COST,
  canRunSavannaStream,
  runSavannaStream,
} from "@/systems/savanna";
import { STREAM_ACTION_COST } from "@/systems/livestream";
import { TAXI_ACTION_COST } from "@/data/taxi";
import type { GameState } from "@/core/types";

/**
 * 사바나 방송 행동력 회귀 테스트.
 *
 * 왜 넣었나: 방송이 행동력을 **전혀 안 썼다**. 같은 시간 1칸을 쓰면서 수익은 가장 큰데
 * (만렙 기준 회당 18~38만, 택시 4.9만의 4~8배) 행동력만 안 내서, 행동력이 바닥난
 * 날에도 돌릴 수 있었다 — 행동력 관리라는 축을 통째로 우회하는 구멍이었다.
 *
 * 고정하는 불변식:
 *  1) 방송은 행동력을 쓴다.
 *  2) 값은 너튜브 라이브와 같다 — 둘 다 '방송을 켜는 일'이다.
 *  3) **어느 갈래로 빠지든** 쓴다(난입·성인 시나리오는 효과를 나중에 적용하므로 놓치기 쉽다).
 *  4) 행동력이 모자라면 못 켠다.
 */

function streamer(action = 100): GameState {
  const s = createInitialState();
  s.savannaJoined = true;
  s.adultMode = true;
  s.resources.action = action;
  return s;
}

describe("행동력 비용", () => {
  it("너튜브 라이브와 같은 값이다", () => {
    expect(SAVANNA_ACTION_COST).toBe(STREAM_ACTION_COST);
  });

  it("공짜가 아니다 — 택시보다 싸지 않다", () => {
    // 수익이 가장 큰 활동이 비용도 가장 커야 일관된다.
    expect(SAVANNA_ACTION_COST).toBeGreaterThanOrEqual(TAXI_ACTION_COST);
  });

  it("방송하면 행동력이 실제로 깎인다", () => {
    const s = streamer();
    runSavannaStream(s);
    expect(s.resources.action).toBe(100 - SAVANNA_ACTION_COST);
  });

  it("어느 갈래로 빠지든 깎인다 — 시나리오 분기에서 놓치면 안 된다", () => {
    // 난입·성인 시나리오는 확률이라 여러 번 돌려 갈래를 골고루 밟는다.
    for (let i = 0; i < 120; i++) {
      const s = streamer();
      // 난입 시나리오 조건까지 열어 모든 갈래가 나오게 한다.
      s.skills.lewd = 999;
      s.skills.pervert = 999;
      runSavannaStream(s);
      expect(s.resources.action).toBe(100 - SAVANNA_ACTION_COST);
    }
  });
});

describe("행동력 부족", () => {
  it("모자라면 못 켠다", () => {
    expect(canRunSavannaStream(streamer(SAVANNA_ACTION_COST - 1))).toBe(false);
    expect(canRunSavannaStream(streamer(SAVANNA_ACTION_COST))).toBe(true);
  });

  it("행동력이 음수로 내려가지 않는다", () => {
    const s = streamer(5);
    runSavannaStream(s);
    expect(s.resources.action).toBe(0);
  });
});
