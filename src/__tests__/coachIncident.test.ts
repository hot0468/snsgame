import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  COACH_FIRE_REPUTATION,
  COACH_INCIDENT_CHANCE_MAX,
  COACH_INCIDENT_MORALITY_MAX,
  coachIncidentChance,
  maybeFireCoach,
  rollCoachIncident,
} from "@/systems/coach";
import { COACH_INCIDENTS } from "@/data/coachIncidents";
import { JOB_ID, pastJobCareer } from "@/systems/jobExperience";
import type { GameState } from "@/core/types";

/**
 * 배구부 코치 도덕성 사건.
 *
 * 왜 넣었나: 코치는 남의 아이들과 남의 돈을 맡는 자리인데 도덕성이 0이어도 아무 일이 없었다.
 *   도덕성 낮음 → 훈련 중 사건 → 위로금·평판↓ → 평판 바닥 → 강제 해직
 *
 * 고정하는 불변식:
 *  1) 도덕성이 문턱 이상이면 **절대** 안 터진다(정직하게 굴린 플레이가 벌받지 않는다).
 *  2) 낮을수록 자주 터진다.
 *  3) 터지면 돈·평판·정신력·팀 완성도가 실제로 깎인다.
 *  4) 평판이 바닥이면 해직되고, 그때도 **경력은 남는다**.
 *  5) 학생은 피해자로만 등장한다(콘텐츠 경계).
 */

function coach(morality: number, reputation = 60): GameState {
  const s = createInitialState();
  s.coachJob = {
    hiredDay: 1,
    totalTrainings: 20,
    teamStat: 60,
    raise: 0,
    pendingRaise: 0,
    pendingRaiseYear: -1,
    lastMeetMonth: -1,
    championships: 0,
    lastSalaryMonth: -1,
  };
  s.resources.morality = morality;
  s.resources.reputation = reputation;
  return s;
}

describe("사건 확률", () => {
  it("도덕성이 문턱 이상이면 0이다 — 정직한 플레이는 벌받지 않는다", () => {
    expect(coachIncidentChance(coach(COACH_INCIDENT_MORALITY_MAX))).toBe(0);
    expect(coachIncidentChance(coach(100))).toBe(0);
  });

  it("도덕성 0이면 최대다", () => {
    expect(coachIncidentChance(coach(0))).toBeCloseTo(COACH_INCIDENT_CHANCE_MAX, 5);
  });

  it("낮을수록 자주 터진다", () => {
    expect(coachIncidentChance(coach(5))).toBeGreaterThan(coachIncidentChance(coach(20)));
  });

  it("코치가 아니면 0이다", () => {
    const s = coach(0);
    s.coachJob = null;
    expect(coachIncidentChance(s)).toBe(0);
  });

  it("도덕성이 문턱 이상이면 200번 굴려도 안 터진다", () => {
    const s = coach(COACH_INCIDENT_MORALITY_MAX + 5);
    for (let i = 0; i < 200; i++) expect(rollCoachIncident(s)).toBeNull();
  });
});

describe("사건 효과", () => {
  /** 확률을 걷어내고 터질 때까지 굴린다. */
  function fireUntil(s: GameState) {
    for (let i = 0; i < 500; i++) {
      const inc = rollCoachIncident(s);
      if (inc) return inc;
    }
    return null;
  }

  it("돈·평판·정신력·팀 완성도가 실제로 깎인다", () => {
    const s = coach(0);
    const before = {
      money: s.money,
      rep: s.resources.reputation,
      mental: s.resources.mental,
      team: s.coachJob!.teamStat,
    };
    const inc = fireUntil(s);
    expect(inc, "500번 굴려도 안 터졌다").toBeTruthy();
    expect(s.money).toBe(before.money - inc!.compensation);
    expect(s.resources.reputation).toBe(before.rep - inc!.reputationLoss);
    expect(s.resources.mental).toBeLessThan(before.mental);
    expect(s.coachJob!.teamStat).toBe(before.team - inc!.teamStatLoss);
  });

  it("체육부장 카톡이 온다 — 일정 한 줄로 흘리지 않는다", () => {
    const s = coach(0);
    fireUntil(s);
    expect(s.kakao.length).toBeGreaterThan(0);
    expect(s.kakao[s.kakao.length - 1].unread).toBe(true);
  });
});

describe("해직", () => {
  it("평판이 문턱 이상이면 안 잘린다", () => {
    const s = coach(0, COACH_FIRE_REPUTATION);
    expect(maybeFireCoach(s)).toBe(false);
    expect(s.coachJob).not.toBeNull();
  });

  it("평판이 바닥이면 잘린다", () => {
    const s = coach(0, COACH_FIRE_REPUTATION - 1);
    expect(maybeFireCoach(s)).toBe(true);
    expect(s.coachJob).toBeNull();
  });

  it("잘려도 경력은 남는다 — 지금까지 지도한 횟수가 사라지진 않는다", () => {
    const s = coach(0, COACH_FIRE_REPUTATION - 1);
    maybeFireCoach(s);
    expect(pastJobCareer(s, JOB_ID.coach)).toBe(20);
  });

  it("코치가 아니면 아무 일도 없다", () => {
    const s = coach(0, 0);
    s.coachJob = null;
    expect(maybeFireCoach(s)).toBe(false);
  });
});

describe("콘텐츠 경계 — 학생은 피해자로만 등장한다", () => {
  it("사건 본문에 성인 소재가 없다", () => {
    // 학교 소재라 가장 조심할 선이다(data/coachCamp와 같은 규칙).
    const BANNED = ["관계를", "알몸", "가슴", "키스", "성관계", "유혹"];
    for (const inc of COACH_INCIDENTS) {
      for (const w of BANNED) {
        expect(inc.text.includes(w), `${inc.id}에 '${w}'가 있다`).toBe(false);
      }
    }
  });

  it("횡령·트러블 두 계열이 모두 있고 본문이 비지 않았다", () => {
    const kinds = new Set(COACH_INCIDENTS.map((i) => i.kind));
    expect([...kinds].sort()).toEqual(["embezzle", "trouble"]);
    for (const inc of COACH_INCIDENTS) {
      expect(inc.text.length, inc.id).toBeGreaterThan(150);
      expect(inc.compensation, inc.id).toBeGreaterThan(0);
      expect(inc.reputationLoss, inc.id).toBeGreaterThan(0);
    }
  });
});
