import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { ACHIEVEMENTS } from "@/data/achievements";
import { DAILY_MISSIONS, WEEKLY_MISSIONS, rollDaily, rollWeekly, missionDef } from "@/data/missions";
import { checkAchievements } from "@/systems/achievements";
import { ensureMissions, recordMission } from "@/systems/missions";
import type { GameState } from "@/core/types";

/**
 * 직업이 목표로 승격됐는지 검사한다(업적 + 일일/주간 미션).
 *
 * 고정하는 불변식:
 *  1) **직업 전용 미션은 그 직업일 때만 후보 풀에 든다.** 안 그러면 무직인 날 절대 못 깨는
 *     미션이 떠서 그날 세트 하나가 죽는다(data/missions.ts 상단이 경고하는 바로 그것).
 *  2) 직업 전용 metric에는 **반드시** requires가 붙어 있다 — 하나라도 빠지면 1)이 깨진다.
 *  3) 직업 업적은 **누적 상태**로만 판정한다. 그만둬도 남는 값이라야 영영 못 따는 업적이 안 된다.
 */

const JOB_METRICS = ["ride", "call", "sale", "cut"] as const;

function withTaxi(): GameState {
  const s = createInitialState();
  s.taxiJob = { hiredDay: 1, totalRides: 0, totalEarned: 0, rating: 50 };
  return s;
}

describe("직업 전용 미션은 게이트가 걸려 있다", () => {
  it("직업 metric을 쓰는 미션엔 전부 requires가 있다", () => {
    for (const m of [...DAILY_MISSIONS, ...WEEKLY_MISSIONS]) {
      if ((JOB_METRICS as readonly string[]).includes(m.metric)) {
        expect(m.requires, `${m.id}에 requires가 없다 — 무직인 날 죽은 미션이 된다`).toBeTruthy();
      }
    }
  });

  it("무직이면 직업 미션이 절대 안 뜬다", () => {
    const s = createInitialState();
    // 여러 날·주를 돌려도 한 번도 안 나와야 한다.
    for (let d = 1; d <= 60; d++) {
      for (const inst of [...rollDaily(d, s), ...rollWeekly(d, s)]) {
        const def = missionDef(inst.id)!;
        expect(
          (JOB_METRICS as readonly string[]).includes(def.metric),
          `${d}일차에 ${def.id}가 떴다`,
        ).toBe(false);
      }
    }
  });

  it("state가 null이어도(새 게임 생성 중) 직업 미션이 안 뜬다", () => {
    for (const inst of [...rollDaily(1, null), ...rollWeekly(0, null)]) {
      const def = missionDef(inst.id)!;
      expect((JOB_METRICS as readonly string[]).includes(def.metric)).toBe(false);
    }
  });

  it("택시 기사가 되면 택시 미션이 후보에 든다", () => {
    const s = withTaxi();
    let seen = false;
    for (let d = 1; d <= 60 && !seen; d++) {
      seen = rollDaily(d, s).some((i) => missionDef(i.id)!.metric === "ride");
    }
    expect(seen, "60일을 돌려도 택시 미션이 한 번도 안 떴다").toBe(true);
  });

  it("택시 기사여도 다른 직업 미션은 안 뜬다", () => {
    const s = withTaxi();
    for (let d = 1; d <= 60; d++) {
      for (const inst of rollDaily(d, s)) {
        const m = missionDef(inst.id)!.metric;
        expect(["call", "sale", "cut"].includes(m), `${inst.id}`).toBe(false);
      }
    }
  });
});

describe("직업 행동이 미션 진행도를 올린다", () => {
  it("운행하면 택시 미션 진행도가 오른다", () => {
    const s = withTaxi();
    // 택시 미션이 뜨는 날을 찾아 그 날짜로 맞춘다.
    let day = 0;
    for (let d = 1; d <= 60; d++) {
      if (rollDaily(d, s).some((i) => missionDef(i.id)!.metric === "ride")) {
        day = d;
        break;
      }
    }
    expect(day).toBeGreaterThan(0);
    s.day = day;
    // 초기 세트는 무직 기준(null)으로 굴려져 있다 — 강제로 다시 굴리게 한다.
    s.missions.day = -1;
    ensureMissions(s);
    const inst = s.missions.daily.find((i) => missionDef(i.id)!.metric === "ride")!;
    expect(inst.progress).toBe(0);
    recordMission(s, "ride");
    expect(s.missions.daily.find((i) => i.id === inst.id)!.progress).toBe(1);
  });
});

describe("직업 업적", () => {
  it("직업을 경험하면 업적이 붙는다", () => {
    const s = createInitialState();
    s.jobsExperienced = ["taxi"];
    checkAchievements(s);
    expect(s.achievements).toContain("job_any_first");
  });

  it("그만둬도 업적은 남는다 — 누적 상태로만 판정한다", () => {
    const s = createInitialState();
    s.taxiJob = { hiredDay: 1, totalRides: 120, totalEarned: 0, rating: 95 };
    checkAchievements(s);
    expect(s.achievements).toContain("taxi_100");
    const before = s.achievements.length;
    // 퇴사해도 이미 딴 업적이 사라지지 않는다.
    s.taxiJob = null;
    checkAchievements(s);
    expect(s.achievements.length).toBe(before);
    expect(s.achievements).toContain("taxi_100");
  });

  it("직업 업적 id가 기존 업적과 충돌하지 않는다", () => {
    const ids = ACHIEVEMENTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 업적 condition이 빈 상태에서 터지지 않는다", () => {
    // 직업이 하나도 없는 상태에서 s.taxiJob?.rating 같은 접근이 안전해야 한다.
    const s = createInitialState();
    for (const a of ACHIEVEMENTS) {
      expect(() => a.condition(s), `${a.id}`).not.toThrow();
    }
  });
});
