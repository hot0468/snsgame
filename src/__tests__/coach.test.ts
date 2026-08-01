/**
 * 회귀: 고등학교 배구부 코치직.
 *
 * 고정하는 불변식:
 *  1) 섭외는 **운동 문턱 + 무직**일 때만 온다(겸직 중이면 플래그를 안 세워 나중에 다시 온다).
 *  2) 근무는 **평일 낮**뿐이다(주말·심야엔 안 잡힌다).
 *  3) 월급은 고정급이고, **대회 성적이 기본급에 영구히 얹힌다**.
 *  4) 전국체전 우승분은 **그 해가 아니라 다음 해부터** 반영된다.
 *  5) 대회는 한 달에 두 번 열리지 않는다.
 */
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { dateOf, dateOfMonth, isWeekday } from "@/systems/calendar";
import { applyDailyCosts } from "@/systems/economy";
import {
  COACH_BASE_SALARY,
  COACH_OFFER_FITNESS,
  COACH_STAT_TARGET,
  MEET_RAISE,
  NATIONAL_CHAMPION_RAISE,
  TRAIN_GRADE_MULT,
  acceptCoachJob,
  coachSalaryOf,
  doCoachTraining,
  isCoachWorkNow,
  isMeetDay,
  maybeHoldMeet,
  maybeOfferCoach,
  meetResultFor,
  teamStrength,
} from "@/systems/coach";
import { jobLevelRows } from "@/systems/jobLevels";
import type { GameState } from "@/core/types";

function fitState(fitness = COACH_OFFER_FITNESS): GameState {
  const s = createInitialState();
  s.skills.fitness = fitness;
  return s;
}

/**
 * 부임 + 완성도 만땅. 대회 성적은 **스킬이 아니라 완성도 게이지**가 정하므로,
 * 성적 테스트는 스킬이 아니라 이 값을 세워야 한다(훈련 난수에 의존하지 않는다).
 */
function ready(): GameState {
  const s = fitState(999);
  acceptCoachJob(s);
  s.coachJob!.teamStat = COACH_STAT_TARGET;
  return s;
}

/** state.day를 조건에 맞는 날로 옮긴다. */
function moveTo(s: GameState, pred: (day: number) => boolean): void {
  for (let i = 0; i < 800; i++) {
    if (pred(s.day)) return;
    s.day += 1;
  }
  throw new Error("조건에 맞는 날을 못 찾았다");
}

describe("배구부 섭외", () => {
  it("운동 스탯이 문턱 미만이면 안 온다", () => {
    const s = fitState(COACH_OFFER_FITNESS - 1);
    expect(maybeOfferCoach(s)).toBe(false);
    expect(s.coachOffered).toBe(false);
  });

  it("문턱을 넘고 무직이면 카톡이 온다(한 번만)", () => {
    const s = fitState();
    expect(maybeOfferCoach(s)).toBe(true);
    expect(s.kakao.some((t) => t.coachOffer)).toBe(true);
    expect(maybeOfferCoach(s)).toBe(false); // 중복 제의 없음
  });

  it("다른 직업이 있으면 제의를 미룬다(플래그를 안 세운다)", () => {
    const s = fitState();
    s.employment = {
      company: "테스트상사",
      tier: "micro",
      hiredDay: s.day,
      performance: 0,
      perfLevel: 0,
      overtimeDay: -1,
      lastSalaryMonth: -1,
    };
    expect(maybeOfferCoach(s)).toBe(false);
    expect(s.coachOffered).toBe(false); // 무직이 되면 다시 올 수 있어야 한다
    s.employment = null;
    expect(maybeOfferCoach(s)).toBe(true);
  });

  it("수락하면 부임하고 도감이 해금된다", () => {
    const s = fitState();
    acceptCoachJob(s);
    expect(s.coachJob).not.toBeNull();
    const row = jobLevelRows(s).find((r) => r.id === "coach");
    expect(row!.unlocked).toBe(true);
    expect(row!.active).toBe(true);
  });
});

describe("근무 시간", () => {
  it("평일 낮에만 출근이 잡힌다", () => {
    const s = fitState();
    acceptCoachJob(s);
    s.day += 1; // 부임 당일은 쉰다
    let weekdayNoon = 0;
    let others = 0;
    for (let i = 0; i < 28; i++) {
      for (const slot of [0, 1]) {
        s.slot = slot;
        const on = isCoachWorkNow(s);
        if (isWeekday(s.day) && slot === 0) {
          if (on) weekdayNoon++;
        } else if (on) {
          others++;
        }
      }
      s.day += 1;
    }
    expect(weekdayNoon).toBeGreaterThan(15); // 4주치 평일 낮
    expect(others).toBe(0); // 주말·심야엔 절대 안 잡힌다
  });
});

describe("대회와 월급", () => {
  it("훈련할수록 팀 완성도가 오른다", () => {
    const s = fitState(500);
    acceptCoachJob(s);
    const before = teamStrength(s);
    const r = doCoachTraining(s, "drill")!;
    expect(r.gained).toBeGreaterThan(0);
    expect(teamStrength(s)).toBe(before + r.gained);
    // 자율 훈련은 팀을 안 올린다(대신 정신력을 회복한다)
    const after = teamStrength(s);
    doCoachTraining(s, "easy");
    expect(teamStrength(s)).toBe(after);
  });

  it("완성도 상승폭은 실패 < 성공 < 대성공 순이다", () => {
    expect(TRAIN_GRADE_MULT.fail).toBeLessThan(TRAIN_GRADE_MULT.normal);
    expect(TRAIN_GRADE_MULT.normal).toBeLessThan(TRAIN_GRADE_MULT.great);
  });

  it("완성도가 성적을 가른다", () => {
    expect(meetResultFor(0, false)).toBe("eliminated");
    expect(meetResultFor(55, false)).toBe("semifinal");
    expect(meetResultFor(75, false)).toBe("runnerup");
    expect(meetResultFor(90, false)).toBe("champion");
  });

  it("전국체전은 지역 대회보다 우승 문턱이 높다", () => {
    expect(meetResultFor(88, false)).toBe("champion");
    expect(meetResultFor(88, true)).not.toBe("champion");
  });

  it("대회를 치르면 완성도가 0으로 리셋된다", () => {
    const s = ready();
    moveTo(s, (d) => isMeetDay(d));
    maybeHoldMeet(s);
    expect(teamStrength(s)).toBe(0);
  });

  it("대회 성적이 월급에 영구히 얹힌다", () => {
    const s = ready();
    moveTo(s, (d) => isMeetDay(d) && dateOf(d).getMonth() + 1 !== 10);
    maybeHoldMeet(s);
    expect(coachSalaryOf(s)).toBe(COACH_BASE_SALARY + MEET_RAISE.champion);
  });

  it("같은 달에 대회가 두 번 열리지 않는다", () => {
    const s = ready();
    moveTo(s, (d) => isMeetDay(d));
    maybeHoldMeet(s);
    const once = coachSalaryOf(s);
    maybeHoldMeet(s);
    expect(coachSalaryOf(s)).toBe(once);
  });

  it("전국체전 우승분은 다음 해부터 반영된다", () => {
    const s = ready();
    moveTo(s, (d) => isMeetDay(d) && dateOf(d).getMonth() + 1 === 10);
    maybeHoldMeet(s);
    const job = s.coachJob!;
    expect(job.championships).toBe(1);
    expect(job.pendingRaise).toBe(NATIONAL_CHAMPION_RAISE);
    // 우승한 해 월급엔 아직 안 붙는다(그해 인상분은 대회 성적분뿐)
    const thisYear = coachSalaryOf(s);
    expect(thisYear).toBeLessThan(COACH_BASE_SALARY + NATIONAL_CHAMPION_RAISE);

    // 해가 바뀐 뒤 첫 월급날에 합류한다
    const year = dateOf(s.day).getFullYear();
    moveTo(s, (d) => dateOf(d).getFullYear() > year && dateOfMonth(d) === 20);
    applyDailyCosts(s);
    expect(s.coachJob!.pendingRaise).toBe(0);
    expect(coachSalaryOf(s)).toBeGreaterThanOrEqual(thisYear + NATIONAL_CHAMPION_RAISE);
  });
});
