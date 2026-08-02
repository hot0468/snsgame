import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  SAVANNA_ACTION_COST,
  SAVANNA_SHOCK_LEWD_GAIN,
  SAVANNA_STREAM_LEWD_GAIN,
  canRunSavannaStream,
  runSavannaStream,
} from "@/systems/savanna";
import { YABAM_VIDEO_LEWD_GAIN } from "@/systems/yabam";
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

describe("음란 상승", () => {
  it("일반 방송을 마치면 음란이 오른다", () => {
    // ⚠️ 확률로 시나리오 갈래(난입·성인 방송)로 빠지면 효과를 resolve로 미루므로
    //    그 자리에서는 안 오른다. 반환값으로 갈래를 판정해 **일반 방송인 경우만** 잰다.
    //    (이걸 무시하고 한 번만 돌렸다가 26% 확률로 깨지는 테스트를 만들었다.)
    let checked = 0;
    for (let i = 0; i < 60 && checked < 5; i++) {
      const s = streamer();
      const before = s.skills.lewd;
      const r = runSavannaStream(s);
      if (r.scenario || r.showScenario) continue; // 효과가 아직 적용 전인 갈래
      expect(s.skills.lewd, "컨셉이 곧 도네이션인 직업이다").toBeGreaterThan(before);
      checked += 1;
    }
    expect(checked, "일반 방송 갈래를 한 번도 못 밟았다").toBeGreaterThan(0);
  });

  it("보는 것(야밤 감상)보다 적지 않다 — 직접 하는 쪽이 덜 오르면 앞뒤가 안 맞는다", () => {
    expect(SAVANNA_STREAM_LEWD_GAIN).toBeGreaterThanOrEqual(YABAM_VIDEO_LEWD_GAIN * 0.8);
  });

  it("매일 켤 수 있는 자리라 한 번에 크게 주지는 않는다", () => {
    // 오프라인 성인 조우(1회 40~50)나 클럽 세션급으로 주면 방송만 돌려도 축이 끝난다.
    expect(SAVANNA_STREAM_LEWD_GAIN).toBeLessThan(20);
  });

  it("놀라서 급히 끈 방송도 조금은 오른다 — 켜긴 켰다", () => {
    expect(SAVANNA_SHOCK_LEWD_GAIN).toBeGreaterThan(0);
    expect(SAVANNA_SHOCK_LEWD_GAIN).toBeLessThan(SAVANNA_STREAM_LEWD_GAIN);
  });

  it("결과 문구가 실제 반영분을 알려준다", () => {
    // 예전엔 오르는데 문구에 없어서 '안 오른다'로 읽혔다.
    const s = streamer();
    let msg = "";
    for (let i = 0; i < 60 && !msg.includes("음란"); i++) {
      const fresh = streamer();
      const r = runSavannaStream(fresh);
      if (r.message) msg = r.message;
    }
    expect(msg, "일반 방송 문구에 음란 증가가 보여야 한다").toContain("음란 +");
    expect(s).toBeTruthy();
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
