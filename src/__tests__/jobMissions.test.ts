import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { DAILY_MISSIONS, WEEKLY_MISSIONS, type MissionMetric } from "@/data/missions";
import { JOB_CATALOG } from "@/systems/jobLevels";
import { doWork } from "@/systems/employment";
import { doLecture } from "@/systems/lecturer";
import { doCoachTraining } from "@/systems/coach";
import { resolveAvWork } from "@/systems/avJob";
import type { GameState } from "@/core/types";

/**
 * 직업 전용 도전과제 커버리지 테스트.
 *
 * 왜 넣었나: 직업 전용 metric이 ride·call·sale·cut 넷뿐이라, 신규 4직업으로 일할 땐
 * 그날 할 도전과제가 있는데 회사원·강사·AV·코치로 일하면 SNS 활동뿐이었다.
 * 엔딩과 같은 뿌리의 비대칭이다.
 *
 * 고정하는 불변식:
 *  1) **도감의 모든 직업에 일일·주간 미션이 하나씩 있다**(재발 방지선).
 *  2) 직업 전용 미션은 **반드시 requires와 짝**이다 — 게이트가 없으면 무직에게도
 *     "택시 3회 운행"이 뜨고 영영 못 깬다.
 *  3) 그 requires는 실제로 그 직업이 없을 때 false다.
 */

/**
 * 직업 id → 그 직업이 있을 때 true가 되도록 상태를 세팅.
 *
 * ⚠️ **`as`로 캐스팅하지 마라.** 처음에 그렇게 썼다가 `tier: 0`(실제로는 CompanyTier 문자열)이
 *    typecheck를 통과해 버렸고, `TIERS[emp.tier]`가 undefined라 런타임에서야 터졌다.
 *    전 필드를 실제 shape대로 채우면 타입이 오타를 잡아준다.
 */
const SETUP: Record<string, (s: GameState) => void> = {
  office: (s) => {
    s.employment = {
      company: "테스트상사",
      tier: "small",
      hiredDay: 1,
      performance: 0,
      perfLevel: 0,
      overtimeDay: -1,
      lastSalaryMonth: -1,
    };
  },
  lecturer: (s) => {
    s.lecturerJob = { hiredDay: 1, lessonsThisMonth: 0, totalLessons: 0, lastSalaryMonth: -1 };
  },
  av: (s) => {
    s.avJob = { joinedDay: 1, workDaysThisMonth: 0, totalWorkDays: 0, lastWorkDay: -1, condomlessThisMonth: 0, lastSalaryMonth: -1, stdUntilDay: -1 };
  },
  coach: (s) => {
    s.coachJob = { hiredDay: 1, totalTrainings: 0, teamStat: 0, raise: 0, pendingRaise: 0, pendingRaiseYear: -1, lastMeetMonth: -1, championships: 0 };
  },
  taxi: (s) => {
    s.taxiJob = { hiredDay: 1, totalRides: 0, totalEarned: 0, rating: 50 };
  },
  callCenter: (s) => {
    s.callCenterJob = { hiredDay: 1, totalCalls: 0, totalEarned: 0, bestStreak: 0 };
  },
  mlm: (s) => {
    s.mlmJob = { hiredDay: 1, contracts: 0, totalCommission: 0, burnedContacts: [], lastSalaryMonth: -1 };
  },
  stylist: (s) => {
    s.stylistJob = { hiredDay: 1, cuts: 0, totalEarned: 0, regulars: 0, botched: 0 };
  },
};

/** SNS 활동 metric — 직업과 무관하게 항상 후보다. */
const GENERIC: MissionMetric[] = ["tweet", "like", "retweet", "follow", "offline"];

describe("직업 전용 미션은 반드시 게이트와 짝이다", () => {
  it("범용이 아닌 metric에는 전부 requires가 있다", () => {
    for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) {
      if (GENERIC.includes(m.metric)) continue;
      expect(m.requires, `${m.id}(${m.metric})에 게이트가 없다 — 무직에게도 뜬다`).toBeTruthy();
    }
  });

  it("게이트는 그 직업이 없으면 false다", () => {
    const empty = createInitialState();
    for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) {
      if (!m.requires) continue;
      expect(m.requires(empty), `${m.id}가 무직에게도 열린다`).toBe(false);
    }
  });

  it("범용 미션에는 게이트가 없다 — 있으면 새 게임에서 후보가 말라붙는다", () => {
    for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) {
      if (!GENERIC.includes(m.metric)) continue;
      expect(m.requires, `${m.id}에 불필요한 게이트`).toBeUndefined();
    }
  });
});

describe("커버리지 — 여덟 직업 전부에 미션이 있다", () => {
  // 청부업은 임무 자체가 마감 있는 단발 계약이라 일일/주간 도전과제와 축이 겹친다.
  // 웹툰작가는 정산이 월 단위라 주간 목표로 쪼갤 수 없다. 둘은 의도적 제외다.
  const EXEMPT = new Set(["killer", "author"]);

  for (const entry of JOB_CATALOG) {
    if (EXEMPT.has(entry.id)) continue;
    const setup = SETUP[entry.id];

    it(`${entry.label}: 일일·주간 미션이 하나씩 열린다`, () => {
      expect(setup, `${entry.id} 세팅이 없다`).toBeTruthy();
      const s = createInitialState();
      setup(s);
      const daily = DAILY_MISSIONS.filter((m) => m.requires?.(s));
      const weekly = WEEKLY_MISSIONS.filter((m) => m.requires?.(s));
      expect(daily.length, `${entry.label} 일일 미션이 없다`).toBeGreaterThan(0);
      expect(weekly.length, `${entry.label} 주간 미션이 없다`).toBeGreaterThan(0);
    });
  }
});

describe("행동이 실제로 카운트된다 — 정의만 있고 recordMission이 없으면 못 깬다", () => {
  /** 그 metric의 미션 하나를 강제로 물려두고 진행도를 본다. */
  function armed(metric: MissionMetric, setup: (s: GameState) => void): GameState {
    const s = createInitialState();
    setup(s);
    const def = DAILY_MISSIONS.find((m) => m.metric === metric)!;
    s.missions.daily = [{ id: def.id, progress: 0, claimed: false }];
    s.missions.weekly = [];
    return s;
  }
  const progress = (s: GameState) => s.missions.daily[0].progress;

  it("회사원: 성실 근무가 카운트된다", () => {
    const s = armed("work", SETUP.office);
    s.resources.action = 100;
    doWork(s, "work");
    expect(progress(s)).toBe(1);
  });

  it("회사원: 딴짓은 카운트되지 않는다 — 실적이 아니다", () => {
    const s = armed("work", SETUP.office);
    s.resources.action = 100;
    doWork(s, "slack");
    expect(progress(s)).toBe(0);
  });

  it("강사: 수업이 카운트된다", () => {
    const s = armed("lesson", SETUP.lecturer);
    s.resources.action = 100;
    doLecture(s);
    expect(progress(s)).toBe(1);
  });

  it("코치: 훈련이 카운트된다", () => {
    const s = armed("training", SETUP.coach);
    s.resources.action = 100;
    doCoachTraining(s, "drill");
    expect(progress(s)).toBe(1);
  });

  it("AV: 촬영이 카운트된다", () => {
    // ⚠️ 여기서 '같은 날 두 번'을 검증하지 않는다 — resolveAvWork가 시간을 진행시켜
    //    날이 넘어가면 미션 세트가 재추첨되어 progress가 0으로 돌아간다(테스트가 아니라
    //    테스트 설계의 함정이었다). 하루 1회 가드는 avJob 쪽 관심사다.
    const s = armed("shoot", SETUP.av);
    s.resources.action = 100;
    s.adultMode = true;
    resolveAvWork(s, false);
    expect(progress(s)).toBe(1);
  });
});

describe("목표치가 실제로 닿는 범위다", () => {
  it("강제 출근 직업의 주간 목표는 5일 근무보다 작다 — 하루 빠져도 닿아야 한다", () => {
    for (const id of ["w_work4", "w_lesson4", "w_training4"]) {
      const m = WEEKLY_MISSIONS.find((x) => x.id === id)!;
      expect(m.goal, `${id}가 주5일을 꽉 채워야 달성된다`).toBeLessThan(5);
    }
  });

  it("하루 1회만 가능한 직업의 일일 목표는 1이다", () => {
    for (const id of ["d_work1", "d_lesson1", "d_shoot1", "d_training1"]) {
      const m = DAILY_MISSIONS.find((x) => x.id === id)!;
      expect(m.goal, `${id}는 하루에 못 채운다`).toBe(1);
    }
  });
});
