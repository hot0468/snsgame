import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { CLUB_NAME, CLUB_SCENARIOS } from "@/data/privateClub";
import {
  CLUB_PUNISH_THRESHOLD,
  CLUB_SESSION_ACTION_COST,
  acceptClubInvite,
  declineClubInvite,
  maybeSpawnClubDM,
  pickClubScenario,
  resolveClubSession,
} from "@/systems/privateClub";
import { CREW_SECRET_SCENARIOS } from "@/data/crewSecret";
import { canOfferPrivateCrew, joinPrivateCrew } from "@/systems/crew";
import { scheduleNextCrewRun, scheduleNextPrivateClub } from "@/systems/appointments";
import { loadGame } from "@/systems/save";
import { dayOfWeek } from "@/systems/time";
import type { GameState } from "@/core/types";

/**
 * 비공개 클럽 '더 체임버'(체벌 위주 SM) 테스트.
 *
 * 왜 넣었나: 처음엔 이 모임을 러닝크루의 하위 개념(비공개 엘리트 러닝크루)에 얹었다.
 * 그런데 둘은 다른 모임이다 — 러닝 쪽은 훈련 미달을 빌미로 한 운동 기반 규율이고,
 * 클럽은 운동과 무관한 순수 체벌 세션이다. 갈라내면서 계약을 못 박는다.
 *
 * 고정하는 불변식:
 *  1) 두 모임은 상태·일정·시나리오를 **하나도 공유하지 않는다**.
 *  2) 클럽은 체벌 트윗만으로 도달한다 — 러닝크루 가입이 전제가 아니다.
 *  3) 세션은 화요일 심야, 러닝 정기런(목요일 낮)과 겹치지 않는다.
 *  4) 세션을 치르면 **클럽 일정만** 다시 잡힌다.
 */

function adult(): GameState {
  const s = createInitialState();
  s.adultMode = true;
  return s;
}

/** 체벌 트윗 문턱을 넘긴 상태. */
function punished(): GameState {
  const s = adult();
  s.punishTweetsPosted = CLUB_PUNISH_THRESHOLD;
  return s;
}

const findInvite = (s: GameState) => getActiveAccount(s).dms.find((t) => t.privateClub);

/** DM을 확률 굴림 없이 확보한다. */
function withInvite(): { s: GameState; thread: NonNullable<ReturnType<typeof findInvite>> } {
  const s = punished();
  for (let i = 0; i < 60 && !findInvite(s); i++) maybeSpawnClubDM(s);
  return { s, thread: findInvite(s)! };
}

describe("시나리오 풀", () => {
  it("20편이다", () => {
    expect(CLUB_SCENARIOS.length).toBe(20);
  });

  it("id가 중복되지 않는다 — 겹치면 하나는 영영 안 뜬다", () => {
    const ids = CLUB_SCENARIOS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("제목도 중복되지 않는다", () => {
    const titles = CLUB_SCENARIOS.map((s) => s.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it("모든 편에 본문과 선택지가 있다", () => {
    // ⚠️ 페이지별 하한을 크게 잡지 마라 — 선택 직전 마지막 장은 질문 한 줄로 끊는 게
    //    이 형식의 리듬이다(crewSecret도 같다). 실질은 **편 전체 분량**으로 잰다.
    for (const sc of CLUB_SCENARIOS) {
      expect(sc.pages.length, sc.id).toBeGreaterThanOrEqual(2);
      expect(sc.choices.length, sc.id).toBeGreaterThanOrEqual(2);
      expect(sc.pages.join("").length, `${sc.id}: 본문이 너무 짧다`).toBeGreaterThan(300);
      for (const p of sc.pages) expect(p.length, `${sc.id}: 빈 페이지`).toBeGreaterThan(20);
      for (const c of sc.choices) {
        expect(c.label.length, sc.id).toBeGreaterThan(0);
        expect(c.result.length, sc.id).toBeGreaterThan(30);
      }
    }
  });

  it("모든 선택지가 음란을 올린다 — 변태력 파생이 lewd에 걸려 있다", () => {
    // resolveClubSession이 lewd에서 pervert를 파생시키므로, lewd가 0인 선택지는
    // 체벌 모임인데 아무 축도 안 오르는 죽은 선택이 된다.
    for (const sc of CLUB_SCENARIOS) {
      for (const c of sc.choices) {
        expect(c.effect.skills?.lewd ?? 0, `${sc.id}: ${c.label}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("러닝크루와 별개 모임이다", () => {
  it("시나리오 풀이 다르다", () => {
    const clubIds = new Set(CLUB_SCENARIOS.map((x) => x.id));
    for (const sc of CREW_SECRET_SCENARIOS) {
      expect(clubIds.has(sc.id), `${sc.id}가 양쪽에 있다`).toBe(false);
    }
    expect(CLUB_SCENARIOS.length).toBeGreaterThan(0);
  });

  it("클럽 시나리오는 운동 배경이 아니다 — 훈련 미달 규율은 러닝 쪽 소재다", () => {
    const RUNNING = ["팔굽혀펴기", "줄넘기", "플랭크", "스쿼트", "러닝", "기록 미달"];
    for (const sc of CLUB_SCENARIOS) {
      const body = sc.pages.join("\n");
      for (const w of RUNNING) {
        expect(body.includes(w), `${sc.id}에 러닝 소재 '${w}'가 섞였다`).toBe(false);
      }
    }
  });

  it("클럽 가입이 러닝 SM 가입으로 이어지지 않는다", () => {
    const { s, thread } = withInvite();
    acceptClubInvite(s, thread);
    expect(s.privateClubJoined).toBe(true);
    expect(s.privateCrewJoined, "러닝크루의 SM 규율까지 열리면 안 된다").toBe(false);
    expect(s.crewJoined, "러닝을 한 적 없는 사람이 크루원이 되면 안 된다").toBe(false);
  });

  it("러닝 SM 가입은 클럽 일정을 만들지 않는다", () => {
    const s = adult();
    s.crewJoined = true;
    joinPrivateCrew(s);
    expect(s.privateCrewJoined).toBe(true);
    expect(s.appointments.some((a) => a.kind === "privateClub")).toBe(false);
  });

  it("러닝 정기런 중 권유 경로는 그대로 살아 있다", () => {
    const s = punished();
    s.crewJoined = true;
    expect(canOfferPrivateCrew(s)).toBe(true);
  });
});

describe("초대 DM", () => {
  it("문턱을 넘으면 러닝크루 미가입이어도 온다", () => {
    const { s, thread } = withInvite();
    expect(thread, "이 경로가 막히면 운동 안 하는 플레이어는 영영 도달 못 한다").toBeTruthy();
    expect(s.crewJoined).toBe(false);
    expect(thread.partnerName).toBe(CLUB_NAME);
  });

  it("문턱 미달·성인모드 off·이미 가입이면 안 온다", () => {
    const low = adult();
    low.punishTweetsPosted = CLUB_PUNISH_THRESHOLD - 1;
    for (let i = 0; i < 60; i++) expect(maybeSpawnClubDM(low)).toBe(false);

    const sfw = punished();
    sfw.adultMode = false;
    for (let i = 0; i < 60; i++) expect(maybeSpawnClubDM(sfw)).toBe(false);

    const joined = punished();
    joined.privateClubJoined = true;
    for (let i = 0; i < 60; i++) expect(maybeSpawnClubDM(joined)).toBe(false);
  });

  it("초대 스레드를 중복 생성하지 않는다", () => {
    const s = punished();
    for (let i = 0; i < 60; i++) maybeSpawnClubDM(s);
    expect(getActiveAccount(s).dms.filter((t) => t.privateClub).length).toBe(1);
  });

  it("수락하면 가입되고 세션 일정이 잡힌다", () => {
    const { s, thread } = withInvite();
    acceptClubInvite(s, thread);
    expect(s.appointments.filter((a) => a.kind === "privateClub").length).toBe(1);
    expect(thread.privateClub).toBe(false);
  });

  it("거절하면 가입되지 않는다", () => {
    const { s, thread } = withInvite();
    declineClubInvite(s, thread);
    expect(s.privateClubJoined).toBe(false);
    expect(thread.privateClub).toBe(false);
  });
});

describe("세션 일정", () => {
  it("러닝 정기런과 같은 자리에 겹치지 않는다", () => {
    const { s, thread } = withInvite();
    s.crewJoined = true;
    scheduleNextCrewRun(s);
    acceptClubInvite(s, thread);

    const run = s.appointments.find((a) => a.kind === "crew")!;
    const club = s.appointments.find((a) => a.kind === "privateClub")!;
    expect(run, "러닝 일정이 사라지면 안 된다").toBeTruthy();
    expect(
      dayOfWeek(run.day) === dayOfWeek(club.day) && run.slot === club.slot,
      "두 모임이 같은 요일·슬롯에 겹친다",
    ).toBe(false);
  });

  it("세션을 치르면 클럽 일정만 다시 잡힌다", () => {
    const { s, thread } = withInvite();
    acceptClubInvite(s, thread);
    s.resources.action = 100;
    resolveClubSession(s, pickClubScenario(), 0);

    expect(s.appointments.filter((a) => a.kind === "privateClub").length).toBe(1);
    expect(s.appointments.some((a) => a.kind === "crew"), "러닝은 안 잡혀야 한다").toBe(false);
  });

  it("세션은 행동력을 쓴다", () => {
    const { s, thread } = withInvite();
    acceptClubInvite(s, thread);
    s.resources.action = 100;
    resolveClubSession(s, pickClubScenario(), 0);
    expect(s.resources.action).toBe(100 - CLUB_SESSION_ACTION_COST);
  });

  it("세션은 음란과 변태력을 함께 올린다", () => {
    const { s, thread } = withInvite();
    acceptClubInvite(s, thread);
    s.resources.action = 100;
    const scenario = pickClubScenario();
    const idx = scenario.choices.findIndex((c) => (c.effect.skills?.lewd ?? 0) > 0);
    resolveClubSession(s, scenario, idx);
    expect(s.skills.lewd).toBeGreaterThan(0);
    expect(s.skills.pervert, "체벌 모임인데 변태력이 안 오르면 안 된다").toBeGreaterThan(0);
  });
});

describe("구세이브 이관", () => {
  it("클럽 전용 일정을 가진 옛 세이브는 새 플래그로 옮겨진다", () => {
    // 클럽이 러닝크루 하위 개념이던 시절엔 가입이 privateCrewJoined에 기록됐다.
    const s = adult();
    s.privateCrewJoined = true;
    s.privateClubJoined = true; // 일정을 만들기 위해 잠시 켠다
    scheduleNextPrivateClub(s);
    s.privateClubJoined = false; // 옛 세이브 상태 재현(플래그 없음 + 일정 있음)

    const loaded = loadGame(JSON.stringify(s))!;
    expect(loaded.privateClubJoined).toBe(true);
  });

  it("러닝 정기런에서 가입한 사람은 이관되지 않는다 — 그쪽은 러닝 SM 그대로다", () => {
    const s = adult();
    s.crewJoined = true;
    s.privateCrewJoined = true; // 클럽 전용 일정은 없다
    const loaded = loadGame(JSON.stringify(s))!;
    expect(loaded.privateClubJoined).toBe(false);
    expect(loaded.privateCrewJoined).toBe(true);
  });

  it("가입돼 있는데 일정이 없으면 되살린다", () => {
    const s = adult();
    s.privateClubJoined = true;
    s.appointments = [];
    const loaded = loadGame(JSON.stringify(s))!;
    expect(loaded.appointments.some((a) => a.kind === "privateClub")).toBe(true);
  });
});
