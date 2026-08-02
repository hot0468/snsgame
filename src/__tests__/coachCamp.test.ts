import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  ALUMNI_MONTH,
  CAMP_SLOTS,
  campAfterpartyScene,
  goToCamp,
  holdAlumniMeet,
  holdNationalParty,
  isAlumniDay,
  isCampOfferDay,
  isNationalAfterDay,
  nationalAfterpartyScene,
  skipCamp,
} from "@/systems/coachCamp";
import {
  ALUMNI_SCENE,
  CAMP_AFTERPARTY,
  CAMP_DAYS,
  CAMP_MONTH,
  CAMP_TEAM_GAIN,
  NATIONAL_AFTERPARTY,
  SCENE_LEWD_MIN,
  SCENE_PERVERT_MIN,
} from "@/data/coachCamp";
import { COACH_STAT_TARGET, MEET_DATE, NATIONAL_MEET_MONTH } from "@/systems/coach";
import { SLOTS_PER_DAY } from "@/core/state";
import { dateOf } from "@/systems/calendar";
import type { GameState } from "@/core/types";

/**
 * 배구부 합숙훈련·뒤풀이 이벤트 테스트.
 *
 * 고정하는 불변식:
 *  1) 합숙은 8월 대회 **다음 날**, 코치일 때, **연 1회**만 제안된다.
 *  2) 가면 행동력·정신력이 0이 되고 체력이 깎이며 팀 완성도가 크게 오른다.
 *  3) 성인 씬은 **강도 높은 쪽을 먼저** 고른다 — 순서가 뒤집히면 변태력이 아무리 높아도
 *     1:1만 나오고 다인 씬에 영영 도달하지 못한다.
 *  4) 성인 모드가 꺼져 있으면 어떤 씬도 안 나온다.
 *  5) 졸업생 모임은 **대회를 치른 다음 해** 2월에만, 연 1회.
 *  6) 씬에 미성년자가 등장하지 않는다(콘텐츠 경계).
 */

/** 코치 상태 + 그 해 아무것도 안 겪은 상태. */
function coach(): GameState {
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
    campYear: -1,
    lastMeetYear: -1,
    alumniYear: -1,
  };
  return s;
}

/** 그 해의 지정한 월/일로 day를 옮긴다(달력 역산). */
function toDate(s: GameState, month: number, date: number): void {
  for (let d = 1; d <= 366 * 3; d++) {
    const dt = dateOf(d);
    if (dt.getMonth() + 1 === month && dt.getDate() === date) {
      s.day = d;
      return;
    }
  }
  throw new Error(`${month}/${date}를 못 찾았다`);
}

/** 음란/변태력을 세팅한다. */
function lust(s: GameState, lewd: number, pervert: number): void {
  s.adultMode = true;
  s.skills.lewd = lewd;
  s.skills.pervert = pervert;
}

describe("합숙 제안 시점", () => {
  it("8월 대회 다음 날에만 뜬다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    expect(isCampOfferDay(s)).toBe(true);

    toDate(s, CAMP_MONTH, MEET_DATE);
    expect(isCampOfferDay(s), "대회 당일은 대회가 차지한다").toBe(false);
  });

  it("코치가 아니면 안 뜬다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    s.coachJob = null;
    expect(isCampOfferDay(s)).toBe(false);
  });

  it("그 해 이미 다녀왔으면 다시 안 뜬다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    goToCamp(s);
    expect(isCampOfferDay(s)).toBe(false);
  });

  it("안 가겠다고 해도 그 해엔 다시 안 묻는다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    skipCamp(s);
    expect(isCampOfferDay(s)).toBe(false);
  });
});

describe("합숙의 대가와 보상", () => {
  it("행동력·정신력이 0이 되고 체력이 깎이며 완성도가 크게 오른다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    s.resources.action = 100;
    s.resources.mental = 100;
    s.stamina = 200;

    goToCamp(s);

    expect(s.resources.action).toBe(0);
    expect(s.resources.mental).toBe(0);
    expect(s.stamina).toBeLessThan(200);
    expect(s.coachJob!.teamStat).toBe(CAMP_TEAM_GAIN);
  });

  it("완성도가 상한을 넘지 않는다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    s.coachJob!.teamStat = COACH_STAT_TARGET - 1;
    goToCamp(s);
    expect(s.coachJob!.teamStat).toBe(COACH_STAT_TARGET);
  });

  it("합숙은 일주일이다", () => {
    expect(CAMP_SLOTS).toBe(CAMP_DAYS * SLOTS_PER_DAY);
    expect(CAMP_DAYS).toBe(7);
  });
});

describe("성인 씬 게이트", () => {
  it("성인 모드가 꺼져 있으면 어떤 씬도 안 나온다", () => {
    const s = coach();
    s.skills.lewd = 999;
    s.skills.pervert = 999;
    s.adultMode = false;
    expect(campAfterpartyScene(s)).toBeNull();
    expect(nationalAfterpartyScene(s)).toBeNull();
  });

  it("성인 모드만 켜면 스탯이 0이어도 뒤풀이는 뜬다 — 스탯은 '뜨냐'가 아니라 '어디까지'다", () => {
    // ⚠️ 이게 이 기능에서 실제로 낸 버그다. 문턱 300을 '이벤트가 뜨는 조건'으로 만들어서
    //    배구부 코치를 하는 플레이어에게는 아무것도 안 떴다.
    const s = coach();
    lust(s, 0, 0);
    expect(campAfterpartyScene(s)?.id).toBe("camp_mild");
    expect(nationalAfterpartyScene(s)?.id).toBe("national_mild");
  });

  it("음란만 높으면 1:1(감독)이 나온다", () => {
    const s = coach();
    lust(s, SCENE_LEWD_MIN, SCENE_PERVERT_MIN - 1);
    expect(campAfterpartyScene(s)?.id).toBe("camp_solo");
    expect(nationalAfterpartyScene(s)?.id).toBe("national_solo");
  });

  it("변태력까지 높으면 다인 씬이 나온다 — 강도 높은 쪽을 먼저 고른다", () => {
    const s = coach();
    lust(s, SCENE_LEWD_MIN, SCENE_PERVERT_MIN);
    expect(campAfterpartyScene(s)?.id).toBe("camp_group");
    expect(nationalAfterpartyScene(s)?.id).toBe("national_group");
  });

  it("가벼운 씬도 음란을 올린다 — 다음 해엔 다음 단계로 갈 수 있어야 한다", () => {
    const s = coach();
    lust(s, 0, 0);
    const scene = campAfterpartyScene(s)!;
    expect(scene.lewdGain).toBeGreaterThan(0);
  });

  it("후보 배열이 강도 내림차순이다 — 순서가 뒤집히면 가벼운 씬이 전부 가로챈다", () => {
    for (const pool of [CAMP_AFTERPARTY, NATIONAL_AFTERPARTY]) {
      const key = (x: { minLewd: number; minPervert?: number }) => x.minLewd + (x.minPervert ?? 0);
      const keys = pool.map(key);
      expect(keys).toEqual([...keys].sort((a, b) => b - a));
    }
  });

  it("각 풀에 문턱 0짜리 바닥 씬이 정확히 하나 있다", () => {
    for (const pool of [CAMP_AFTERPARTY, NATIONAL_AFTERPARTY]) {
      const base = pool.filter((x) => x.minLewd === 0 && !x.minPervert);
      expect(base.length, "바닥이 없으면 저스탯 플레이어에게 아무것도 안 뜬다").toBe(1);
    }
  });
});

describe("문턱이 코치 맥락에 맞는다", () => {
  it("성인 그룹방(300)보다 낮다 — 코치는 음란이 오를 일이 없다", () => {
    expect(SCENE_LEWD_MIN).toBeLessThan(300);
    expect(SCENE_PERVERT_MIN).toBeLessThan(300);
  });
});

describe("전국체전 뒤풀이", () => {
  it("전국체전 다음 날에만 뜬다", () => {
    const s = coach();
    toDate(s, NATIONAL_MEET_MONTH, MEET_DATE + 1);
    expect(isNationalAfterDay(s)).toBe(true);
    toDate(s, NATIONAL_MEET_MONTH, MEET_DATE);
    expect(isNationalAfterDay(s)).toBe(false);
  });

  it("지역 대회 뒤에는 안 뜬다", () => {
    const s = coach();
    toDate(s, CAMP_MONTH, MEET_DATE + 1);
    expect(isNationalAfterDay(s)).toBe(false);
  });

  it("한 해에 한 번만 열린다 — 도장이 없으면 재렌더마다 효과가 다시 붙는다", () => {
    const s = coach();
    toDate(s, NATIONAL_MEET_MONTH, MEET_DATE + 1);
    lust(s, 999, 999);
    expect(isNationalAfterDay(s)).toBe(true);
    holdNationalParty(s);
    expect(isNationalAfterDay(s)).toBe(false);
  });

  it("겪으면 음란·변태력이 오르고, 두 번째 호출은 더 올리지 않는다", () => {
    const s = coach();
    toDate(s, NATIONAL_MEET_MONTH, MEET_DATE + 1);
    lust(s, 500, 500);
    holdNationalParty(s);
    const after = { lewd: s.skills.lewd, pervert: s.skills.pervert };
    expect(after.lewd).toBeGreaterThan(500);

    // app이 조건(isNationalAfterDay)으로 막지만, 실수로 또 불러도 도장 덕에 무해해야 한다.
    holdNationalParty(s);
    expect(s.skills.lewd).toBe(after.lewd);
    expect(s.skills.pervert).toBe(after.pervert);
  });
});

describe("졸업생 모임", () => {
  it("대회를 치른 다음 해 2월에 뜬다", () => {
    const s = coach();
    toDate(s, ALUMNI_MONTH, 10);
    lust(s, 999, 999);
    s.coachJob!.lastMeetYear = dateOf(s.day).getFullYear() - 1;
    expect(isAlumniDay(s)).toBe(true);
  });

  it("대회를 한 번도 안 치렀으면 안 뜬다 — 아는 졸업생이 없다", () => {
    const s = coach();
    toDate(s, ALUMNI_MONTH, 10);
    lust(s, 999, 999);
    expect(isAlumniDay(s)).toBe(false);
  });

  it("같은 해에 대회를 치렀으면 아직 안 뜬다 — '다음 해'여야 한다", () => {
    const s = coach();
    toDate(s, ALUMNI_MONTH, 10);
    lust(s, 999, 999);
    s.coachJob!.lastMeetYear = dateOf(s.day).getFullYear();
    expect(isAlumniDay(s)).toBe(false);
  });

  it("변태력이 모자라면 안 뜬다", () => {
    const s = coach();
    toDate(s, ALUMNI_MONTH, 10);
    lust(s, 999, SCENE_PERVERT_MIN - 1);
    s.coachJob!.lastMeetYear = dateOf(s.day).getFullYear() - 1;
    expect(isAlumniDay(s)).toBe(false);
  });

  it("한 해에 한 번만 열린다", () => {
    const s = coach();
    toDate(s, ALUMNI_MONTH, 10);
    lust(s, 999, 999);
    s.coachJob!.lastMeetYear = dateOf(s.day).getFullYear() - 1;
    holdAlumniMeet(s);
    expect(isAlumniDay(s)).toBe(false);
  });

  it("겪으면 음란·변태력이 오르고, 두 번째 호출은 더 올리지 않는다", () => {
    const s = coach();
    toDate(s, ALUMNI_MONTH, 10);
    lust(s, 500, 500);
    holdAlumniMeet(s);
    const after = { lewd: s.skills.lewd, pervert: s.skills.pervert };
    expect(after.lewd).toBeGreaterThan(500);
    expect(after.pervert).toBeGreaterThan(500);

    holdAlumniMeet(s);
    expect(s.skills.lewd).toBe(after.lewd);
    expect(s.skills.pervert).toBe(after.pervert);
  });
});

describe("콘텐츠 경계 — 미성년자는 등장하지 않는다", () => {
  /**
   * 이 게임의 배경이 학교라 씬을 쓸 때 가장 조심해야 하는 선이다.
   * 등장인물은 감독·코치진·학부모·졸업생(성인)뿐이고, 선수는 지도 대상으로만 존재한다.
   */
  const BANNED = ["학생", "선수와", "여고", "남고", "미성년", "재학생", "1학년", "2학년", "3학년"];

  it("모든 씬 본문에 미성년자를 가리키는 말이 없다", () => {
    const scenes = [...CAMP_AFTERPARTY, ...NATIONAL_AFTERPARTY, ALUMNI_SCENE];
    for (const sc of scenes) {
      for (const word of BANNED) {
        expect(sc.text.includes(word), `${sc.id}에 '${word}'가 있다`).toBe(false);
      }
    }
  });

  it("씬이 비어 있지 않다", () => {
    for (const sc of [...CAMP_AFTERPARTY, ...NATIONAL_AFTERPARTY, ALUMNI_SCENE]) {
      expect(sc.text.length, sc.id).toBeGreaterThan(100);
      expect(sc.title.length, sc.id).toBeGreaterThan(0);
    }
  });
});
