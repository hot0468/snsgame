import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  COACH_STAT_TARGET,
  TRAIN_TAPER_MIN,
  doCoachTraining,
  meetResultFor,
  trainGain,
} from "@/systems/coach";
import type { GameState } from "@/core/types";

/**
 * 배구부 팀 완성도 밸런스 테스트.
 *
 * 왜 넣었나: 완성도가 너무 쉽게 올라 시즌의 절반 이상이 남아돌았다("이미 만렙이라
 * 오늘 훈련은 의미 없음"이 시즌마다 반복). 예전 값(base 4·perSkill 8, 체감 없음)으론
 * 우승선 95에 8~22회면 닿았는데, **시즌당 훈련 가능 횟수는 약 43회**다
 * (대회는 4·6·8·10월 15일 → 사이 약 61일, 훈련은 평일 낮 1회).
 *
 * 고정하는 불변식:
 *  1) 우승은 **시즌의 상당 부분**을 써야 닿는다(43회 안에는 들되 절반은 넘게).
 *  2) 완성도가 높을수록 덜 오른다 — 문턱을 넘긴 뒤에도 훈련할 이유가 남는다.
 *  3) 코치 스킬이 실제로 차이를 만든다(안 그러면 스킬 투자가 무의미).
 *  4) 스킬 0으로는 우승이 안 된다 — 대신 하위 성적은 닿는다.
 */

/** 시즌 하나(대회~대회) 동안 실제로 가능한 훈련 횟수. 평일 낮 1회 기준. */
const SEASON_TRAININGS = 43;

function coach(skill: number): GameState {
  const s = createInitialState();
  s.coachJob = {
    hiredDay: 1,
    totalTrainings: 0,
    teamStat: 0,
    raise: 0,
    pendingRaise: 0,
    pendingRaiseYear: -1,
    lastMeetMonth: -1,
    championships: 0,
  };
  s.skills.fitness = skill;
  s.skills.sociability = skill;
  s.skills.knowledge = skill;
  return s;
}

/**
 * 완성도가 목표에 닿기까지 걸리는 훈련 횟수(등급 굴림 없이 평균값으로).
 * 실제 doCoachTraining은 컨디션 등급이 섞여 흔들리므로, 곡선 자체는 trainGain으로 잰다.
 */
function trainingsToReach(skill: number, target: number): number {
  const s = coach(skill);
  let n = 0;
  while (s.coachJob!.teamStat < target && n < 500) {
    s.coachJob!.teamStat = Math.min(COACH_STAT_TARGET, s.coachJob!.teamStat + trainGain(s));
    n += 1;
  }
  return n;
}

describe("우승은 시즌을 거의 다 써야 한다", () => {
  it("스킬을 키운 코치도 우승선까지 시즌의 절반을 넘게 쓴다", () => {
    const n = trainingsToReach(999, 95);
    expect(n, `${n}회면 너무 쉽다`).toBeGreaterThan(SEASON_TRAININGS / 2);
    expect(n, `${n}회면 시즌 안에 못 닿는다`).toBeLessThanOrEqual(SEASON_TRAININGS);
  });

  it("스킬 0인 코치는 시즌 안에 우승선에 못 닿는다 — 스킬 투자에 이유를 준다", () => {
    expect(trainingsToReach(0, 95)).toBeGreaterThan(SEASON_TRAININGS);
  });

  it("스킬 0이어도 하위 성적은 닿는다 — 시작하자마자 막히면 안 된다", () => {
    expect(trainingsToReach(0, 50)).toBeLessThanOrEqual(SEASON_TRAININGS);
  });

  it("스킬이 높을수록 빨리 오른다", () => {
    expect(trainingsToReach(999, 70)).toBeLessThan(trainingsToReach(300, 70));
  });
});

describe("체감 곡선", () => {
  it("완성도가 높을수록 한 번에 덜 오른다", () => {
    const s = coach(600);
    s.coachJob!.teamStat = 0;
    const early = trainGain(s);
    s.coachJob!.teamStat = 90;
    const late = trainGain(s);
    expect(late).toBeLessThan(early);
  });

  it("만렙에서도 0이 되진 않는다 — 바닥은 TAPER_MIN 비율만큼 남는다", () => {
    // ⚠️ 두 값을 각각 **다른 상태**에서 재야 한다. 같은 객체를 변형해 두 번 읽으면
    //    먼저 읽은 값이 이미 변형 후 값이 된다(그 실수로 이 테스트가 한 번 깨졌다).
    const atZero = coach(600);
    const atFull = coach(600);
    atFull.coachJob!.teamStat = COACH_STAT_TARGET;

    expect(trainGain(atFull)).toBeGreaterThan(0);
    expect(trainGain(atFull)).toBeCloseTo(trainGain(atZero) * TRAIN_TAPER_MIN, 5);
  });
});

describe("실제 훈련도 같은 곡선을 탄다", () => {
  it("doCoachTraining이 한 번에 상한을 넘기지 않는다", () => {
    const s = coach(999);
    s.resources.action = 100;
    s.coachJob!.teamStat = COACH_STAT_TARGET - 1;
    doCoachTraining(s, "drill");
    expect(s.coachJob!.teamStat).toBeLessThanOrEqual(COACH_STAT_TARGET);
  });

  it("가벼운 훈련(easy)은 완성도를 올리지 않는다", () => {
    const s = coach(999);
    s.resources.action = 100;
    const before = s.coachJob!.teamStat;
    doCoachTraining(s, "easy");
    expect(s.coachJob!.teamStat).toBe(before);
  });
});

describe("성적 문턱은 그대로다", () => {
  it("전국체전이 한 단계씩 높다", () => {
    expect(meetResultFor(95, true)).toBe("champion");
    expect(meetResultFor(95, false)).toBe("champion");
    expect(meetResultFor(90, true), "전국체전 우승선은 95다").not.toBe("champion");
    expect(meetResultFor(90, false)).toBe("champion");
  });
});
