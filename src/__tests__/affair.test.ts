import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  AFFAIR_INTERVAL_DAYS,
  affairSceneFor,
  endAffair,
  goAffairMeet,
  hasAffair,
  startAffair,
} from "@/systems/affair";
import { AFFAIR_CAUGHT_AT, AFFAIR_SCENARIO_ID, AFFAIR_SCENES } from "@/data/affair";
import { MEETING_SCENARIOS } from "@/data/meetings";
import { pickMeetingScenario } from "@/systems/meeting";
import type { DMThread, GameState } from "@/core/types";

/**
 * 유부남 외도 루트.
 *
 * 흐름: DM 만남에서 유부남임을 알게 됨 → 따라가면 매주 같은 요일 약속 →
 *       매주 만날지 물음 → 안 만나면 거기서 끝 → 계속 만나면 4회차에 발각 → 게임 오버
 *
 * 고정하는 불변식:
 *  1) 입구는 **음란 높음 + 도덕성 낮음** 둘 다 넘어야 열린다.
 *  2) 수락하면 일주일 뒤 약속이 잡히고, 만날 때마다 다음 주가 다시 잡힌다.
 *  3) **매주 빠져나올 문이 있다** — 안 나가면 관계가 끝나고 약속도 사라진다(게임은 계속).
 *  4) 4번째 만남에서 게임 오버. 그 뒤로는 약속이 안 잡힌다.
 *  5) 한 번만 굴러간다 — 진행 중이면 입구가 다시 안 열린다.
 */

function affairReady(): GameState {
  const s = createInitialState();
  s.adultMode = true;
  s.skills.lewd = 999;
  s.resources.morality = 5;
  return s;
}

const scenario = MEETING_SCENARIOS.find((sc) => sc.id === AFFAIR_SCENARIO_ID)!;

describe("입구 게이트", () => {
  it("시나리오가 존재하고 선택지가 셋이다 — 따라가기·조용히 나오기·말하고 나오기", () => {
    expect(scenario, "외도 입구 시나리오가 없다").toBeTruthy();
    expect(scenario.choices.length).toBe(3);
    expect(scenario.choices[0].effect.customKey).toBe("startAffair");
  });

  it("두 게이트가 모두 걸려 있다", () => {
    expect(scenario.minLewd, "음란 게이트가 없다").toBeGreaterThan(0);
    expect(scenario.maxMorality, "도덕성 게이트가 없다").toBeGreaterThan(0);
  });

  function thread(): DMThread {
    const s = affairReady();
    const t = getActiveAccount(s).dms;
    return {
      id: "t1",
      partnerName: "테스트",
      partnerHandle: "test",
      attribute: "daily",
      messages: [],
      unread: false,
      wantsToMeet: true,
      metOffline: false,
      isAdult: true,
      fan: false,
    } as unknown as DMThread;
  }

  it("도덕성이 높으면 후보에 안 든다 — 음란이 만렙이어도", () => {
    const s = affairReady();
    s.resources.morality = 90;
    for (let i = 0; i < 300; i++) {
      expect(pickMeetingScenario(s, thread()).id).not.toBe(AFFAIR_SCENARIO_ID);
    }
  });

  it("음란이 낮으면 후보에 안 든다 — 도덕성이 바닥이어도", () => {
    const s = affairReady();
    s.skills.lewd = 0;
    for (let i = 0; i < 300; i++) {
      expect(pickMeetingScenario(s, thread()).id).not.toBe(AFFAIR_SCENARIO_ID);
    }
  });

  it("이미 진행 중이면 입구가 다시 안 열린다", () => {
    const s = affairReady();
    startAffair(s);
    for (let i = 0; i < 300; i++) {
      expect(pickMeetingScenario(s, thread()).id).not.toBe(AFFAIR_SCENARIO_ID);
    }
  });
});

describe("주간 약속", () => {
  it("시작하면 일주일 뒤 약속이 잡힌다", () => {
    const s = affairReady();
    expect(startAffair(s)).toBe(true);
    expect(hasAffair(s)).toBe(true);
    const appt = s.appointments.find((a) => a.kind === "affair");
    expect(appt, "약속이 안 잡혔다").toBeTruthy();
    expect(appt!.day).toBe(s.day + AFFAIR_INTERVAL_DAYS);
  });

  it("두 번 시작되지 않는다", () => {
    const s = affairReady();
    startAffair(s);
    expect(startAffair(s)).toBe(false);
    expect(s.appointments.filter((a) => a.kind === "affair").length).toBe(1);
  });

  it("만나면 다음 주가 다시 잡힌다 — 약속이 하나만 남는다", () => {
    const s = affairReady();
    startAffair(s);
    s.day += AFFAIR_INTERVAL_DAYS;
    const r = goAffairMeet(s);
    expect(r!.count).toBe(1);
    expect(r!.caught).toBe(false);
    const appts = s.appointments.filter((a) => a.kind === "affair");
    expect(appts.length, "약속이 쌓였다").toBe(1);
    expect(appts[0].day).toBe(s.day + AFFAIR_INTERVAL_DAYS);
  });

  it("회차마다 다른 씬을 쓴다", () => {
    const titles = new Set(
      Array.from({ length: AFFAIR_CAUGHT_AT }, (_, i) => affairSceneFor(i + 1).title),
    );
    expect(titles.size).toBe(AFFAIR_CAUGHT_AT);
    expect(AFFAIR_SCENES.length).toBe(AFFAIR_CAUGHT_AT);
  });
});

describe("빠져나올 문", () => {
  it("안 나가면 관계가 끝나고 약속도 사라진다 — 게임은 계속된다", () => {
    const s = affairReady();
    startAffair(s);
    const line = endAffair(s);
    expect(line.length).toBeGreaterThan(0);
    expect(hasAffair(s)).toBe(false);
    expect(s.appointments.filter((a) => a.kind === "affair").length).toBe(0);
    expect(s.gameOver, "끊었는데 게임이 끝났다").toBeNull();
  });

  it("끊은 뒤에는 만남이 성립하지 않는다", () => {
    const s = affairReady();
    startAffair(s);
    endAffair(s);
    expect(goAffairMeet(s)).toBeNull();
  });

  it("몇 번을 만났든 중간에 끊을 수 있다", () => {
    const s = affairReady();
    startAffair(s);
    for (let i = 0; i < AFFAIR_CAUGHT_AT - 1; i++) {
      s.day += AFFAIR_INTERVAL_DAYS;
      goAffairMeet(s);
    }
    endAffair(s);
    expect(s.gameOver).toBeNull();
    expect(hasAffair(s)).toBe(false);
  });
});

describe("발각 — 게임 오버", () => {
  function playUntilCaught(): GameState {
    const s = affairReady();
    getActiveAccount(s).followers = 50_000;
    startAffair(s);
    for (let i = 0; i < AFFAIR_CAUGHT_AT; i++) {
      s.day += AFFAIR_INTERVAL_DAYS;
      goAffairMeet(s);
    }
    return s;
  }

  it("4번째 만남에서 끝난다", () => {
    const s = playUntilCaught();
    expect(s.gameOver, "4회차인데 게임이 안 끝났다").toBeTruthy();
    expect(String(s.gameOver).length).toBeGreaterThan(50);
  });

  it("3번째까지는 안 끝난다 — 미리 끝나면 빠져나올 문이 없어진다", () => {
    const s = affairReady();
    startAffair(s);
    for (let i = 0; i < AFFAIR_CAUGHT_AT - 1; i++) {
      s.day += AFFAIR_INTERVAL_DAYS;
      const r = goAffairMeet(s);
      expect(r!.caught, `${r!.count}회차에 벌써 들켰다`).toBe(false);
    }
    expect(s.gameOver).toBeNull();
  });

  it("팔로워와 평판이 날아간다", () => {
    const s = playUntilCaught();
    expect(getActiveAccount(s).followers).toBe(0);
    expect(s.resources.reputation).toBe(0);
  });

  it("끝난 뒤엔 약속이 남지 않는다", () => {
    const s = playUntilCaught();
    expect(s.appointments.filter((a) => a.kind === "affair").length).toBe(0);
    expect(hasAffair(s)).toBe(false);
  });
});
