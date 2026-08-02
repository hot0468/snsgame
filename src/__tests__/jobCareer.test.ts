import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { quitCurrentJob } from "@/systems/employment";
import { JOB_ID, pastJobCareer } from "@/systems/jobExperience";
import { joinTaxi } from "@/systems/taxi";
import { joinCallCenter } from "@/systems/callCenter";
import { joinStylist } from "@/systems/stylist";
import { jobLevelRows } from "@/systems/jobLevels";
import { TAXI_REQ_CERT } from "@/data/taxi";
import { STYLIST_REQ_CERT } from "@/data/stylist";
import type { GameState } from "@/core/types";

/**
 * 이직해도 남는 경력.
 *
 * 왜 넣었나: 레벨이 전부 재직 중 상태 객체의 카운터에서 나오는데(`taxiJob.totalRides` 등)
 * `quitCurrentJob`이 그 객체를 통째로 null로 만들어서, **그만두면 경력이 0이 되고
 * 재취업하면 신입부터 다시** 시작했다. 회사원은 직급·월급까지 여기 묶여 있다.
 *
 * 고정하는 불변식:
 *  1) 그만두면 경력이 보관된다.
 *  2) 재취업하면 그 경력에서 이어간다.
 *  3) 보관은 **최댓값** — 짧게 다시 다니다 그만둬도 예전 경력이 안 깎인다.
 *  4) quitCurrentJob이 null로 만드는 직업은 **전부** 보관 대상이다(빠지면 그 직업만 샌다).
 */

/** 자격증·경력 공백 게이트를 걷어낸 상태(경력 보관만 보려는 테스트다). */
function hireable(): GameState {
  const s = createInitialState();
  s.money = 10_000_000;
  s.certifications.push(TAXI_REQ_CERT, STYLIST_REQ_CERT);
  return s;
}

/** 퇴사 직후엔 경력 공백(jobGapUntilDay)이 걸려 재취업이 막힌다 — 그걸 지운다. */
function clearGap(s: GameState): void {
  s.jobGapUntilDay = 0;
}

describe("경력 보관", () => {
  it("그만두면 누적치가 남는다", () => {
    const s = hireable();
    joinTaxi(s);
    s.taxiJob!.totalRides = 37;
    quitCurrentJob(s);
    expect(s.taxiJob).toBeNull();
    expect(pastJobCareer(s, JOB_ID.taxi)).toBe(37);
  });

  it("재취업하면 그 경력에서 이어간다 — 신입으로 안 돌아간다", () => {
    const s = hireable();
    joinTaxi(s);
    s.taxiJob!.totalRides = 37;
    quitCurrentJob(s);
    clearGap(s);
    joinTaxi(s);
    expect(s.taxiJob!.totalRides, "재입사했는데 0부터 시작한다").toBe(37);
  });

  it("짧게 다시 다니다 그만둬도 예전 경력이 안 깎인다 — 최댓값만 남는다", () => {
    const s = hireable();
    joinCallCenter(s);
    s.callCenterJob!.totalCalls = 80;
    quitCurrentJob(s);
    clearGap(s);
    joinCallCenter(s);
    // 재입사 직후 카운터를 (버그로) 낮게 덮어써도 보관값은 유지되어야 한다.
    s.callCenterJob!.totalCalls = 3;
    quitCurrentJob(s);
    expect(pastJobCareer(s, JOB_ID.callCenter)).toBe(80);
  });

  it("회사원은 직급·월급이 걸린 성과 레벨이 이어진다", () => {
    const s = hireable();
    s.employment = {
      company: "테스트상사",
      tier: "small",
      role: "사무직",
      hiredDay: s.day,
      perf: 0,
      perfLevel: 4,
      overtimeDay: -1,
      lastWorkDay: -1,
      mistakes: 0,
    } as GameState["employment"];
    quitCurrentJob(s);
    expect(pastJobCareer(s, JOB_ID.office)).toBe(4);
  });

  it("도감 레벨이 재취업 직후에도 유지된다", () => {
    const s = hireable();
    joinStylist(s);
    s.stylistJob!.cuts = 25;
    const before = jobLevelRows(s).find((e) => e.id === JOB_ID.stylist)!.level;
    expect(before, "커트 25회면 레벨이 붙어야 한다").toBeGreaterThan(0);
    quitCurrentJob(s);
    clearGap(s);
    joinStylist(s);
    const after = jobLevelRows(s).find((e) => e.id === JOB_ID.stylist)!.level;
    expect(after, "재입사하니 도감 레벨이 떨어졌다").toBe(before);
  });
});

describe("보관 대상 누락 감시", () => {
  it("quitCurrentJob이 지우는 직업은 전부 경력이 남는다", () => {
    // ⚠️ 새 직업을 추가하고 employment.stashAllCareers에 넣는 걸 잊으면 그 직업만 조용히
    //    경력이 샌다. 상태 객체가 있는 채로 그만뒀을 때 jobCareer에 흔적이 남는지로 잡는다.
    const s = hireable();
    s.taxiJob = { hiredDay: 1, totalRides: 11, totalEarned: 0, bestFare: 0, rating: 5 } as GameState["taxiJob"];
    s.callCenterJob = { hiredDay: 1, totalCalls: 12, totalEarned: 0, bestStreak: 0 };
    s.stylistJob = { hiredDay: 1, cuts: 13, totalEarned: 0, regulars: 0, botched: 0 };
    quitCurrentJob(s);
    for (const [id, expected] of [
      [JOB_ID.taxi, 11],
      [JOB_ID.callCenter, 12],
      [JOB_ID.stylist, 13],
    ] as const) {
      expect(pastJobCareer(s, id), `${id}: 경력이 안 남았다`).toBe(expected);
    }
  });
});
