import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { YABAM_VIDEOS } from "@/data/yabam";
import { PUSH_WORKS } from "@/data/pushtime";
import { viewYabamVideo, visibleYabamVideos } from "@/systems/yabam";
import { viewPushWork, visiblePushWorks } from "@/systems/pushtime";
import {
  PRIVATE_CREW_PUNISH_THRESHOLD,
  acceptPrivateClub,
  canOfferPrivateCrew,
  declinePrivateClub,
  maybeSpawnPrivateClubDM,
  pickCrewSecretScenario,
  resolveCrewSecret,
} from "@/systems/crew";
import { CREW_SECRET_SCENARIOS } from "@/data/crewSecret";
import { ADULT_BOOKS } from "@/data/books";
import { ADULT_BOOK_PERVERT, readBook, visibleAdultBooks } from "@/systems/books";
import { scheduleNextCrewRun, scheduleNextPrivateClub } from "@/systems/appointments";
import { loadGame } from "@/systems/save";
import { dayOfWeek } from "@/systems/time";
import type { GameState } from "@/core/types";

/**
 * 변태력 육성 경로 테스트.
 *
 * 왜 넣었나: 변태력을 올릴 곳이 사실상 없었다. 야밤·푸시타임은 음란만 줬고,
 * SM 규율 세션(시나리오 80개)조차 전부 lewd만 올렸다. 그래서 변태력 게이트가 걸린
 * 콘텐츠(그룹 플레이·코치 다인 씬 등)에 도달할 방법이 없었다.
 *
 * 고정하는 불변식:
 *  1) 야밤·푸시타임에 **변태력을 주는 물건이 실제로 있다**.
 *  2) 일반 물건은 변태력을 안 준다 — 방향이 뚜렷한 것만 준다.
 *  3) SM 규율 세션은 음란이 오르는 선택에서 변태력도 함께 오른다.
 *  4) 체벌 트윗 문턱을 넘으면 **러닝크루를 안 거쳐도** 클럽 DM으로 도달할 수 있다.
 */

function adult(): GameState {
  const s = createInitialState();
  s.adultMode = true;
  s.money = 10_000_000;
  return s;
}

describe("야밤·푸시타임에 변태력 물건이 있다", () => {
  it("변태력을 주는 영상/작품이 존재한다", () => {
    expect(YABAM_VIDEOS.filter((v) => (v.pervert ?? 0) > 0).length).toBeGreaterThan(0);
    expect(PUSH_WORKS.filter((w) => (w.pervert ?? 0) > 0).length).toBeGreaterThan(0);
  });

  it("일반 물건은 변태력을 안 준다 — 방향이 뚜렷한 것만 준다", () => {
    const plain = YABAM_VIDEOS.find((v) => !v.pervert)!;
    const s = adult();
    const before = s.skills.pervert;
    viewYabamVideo(s, plain);
    expect(s.skills.pervert).toBe(before);
    expect(s.skills.lewd, "음란은 올라야 한다").toBeGreaterThan(0);
  });

  it("취향 영상은 변태력을 올린다", () => {
    const kinky = YABAM_VIDEOS.find((v) => (v.pervert ?? 0) > 0 && !v.minPervert)!;
    const s = adult();
    viewYabamVideo(s, kinky);
    expect(s.skills.pervert).toBeGreaterThan(0);
  });

  it("취향 작품(푸시타임)도 변태력을 올린다", () => {
    const kinky = PUSH_WORKS.find((w) => (w.pervert ?? 0) > 0 && !w.minPervert)!;
    const s = adult();
    viewPushWork(s, kinky);
    expect(s.skills.pervert).toBeGreaterThan(0);
  });
});

describe("미디북스 취향서", () => {
  it("변태력을 더 주는 성인 도서가 있다", () => {
    expect(ADULT_BOOKS.filter((b) => (b.pervertBonus ?? 0) > 0).length).toBeGreaterThan(0);
  });

  /**
   * 한 권 읽고 오른 변태력.
   * ⚠️ 절대값으로 재지 마라 — gainSkill이 정신력 배율·감쇠를 태우므로 선언값과 다르게 들어온다
   *    (기본 상태에서 8을 선언해도 10이 들어와 테스트가 깨졌다). 두 책의 **관계**로 잰다.
   */
  function pervertFrom(book: (typeof ADULT_BOOKS)[number]): number {
    const s = adult();
    s.resources.action = 100;
    readBook(s, "adult", book.title, book.id);
    return s.skills.pervert;
  }

  it("로맨스 결 성인서도 변태력을 준다 — 이게 축의 진입로다", () => {
    const plain = ADULT_BOOKS.find((b) => !b.pervertBonus)!;
    expect(pervertFrom(plain)).toBeGreaterThan(0);
  });

  it("취향서는 로맨스서보다 많이 준다", () => {
    const plain = ADULT_BOOKS.find((b) => !b.pervertBonus)!;
    const kinky = ADULT_BOOKS.find((b) => (b.pervertBonus ?? 0) > 0 && !b.minPervert)!;
    expect(pervertFrom(kinky)).toBeGreaterThan(pervertFrom(plain));
  });

  it("변태력이 오르면 서가가 늘어난다", () => {
    const low = adult();
    const high = adult();
    high.skills.pervert = 999;
    expect(visibleAdultBooks(high).length).toBeGreaterThan(visibleAdultBooks(low).length);
    expect(visibleAdultBooks(low).length, "처음부터 볼 책은 있어야 한다").toBeGreaterThan(0);
  });

  it("책은 같은 방향의 실제 경험보다 덜 준다 — 활자는 탐색이지 실행이 아니다", () => {
    const maxBook = Math.max(...ADULT_BOOKS.map((b) => ADULT_BOOK_PERVERT + (b.pervertBonus ?? 0)));
    const maxVideo = Math.max(...YABAM_VIDEOS.map((v) => v.pervert ?? 0));
    expect(maxBook).toBeLessThanOrEqual(maxVideo + ADULT_BOOK_PERVERT);
  });
});

describe("목록은 변태력이 오를수록 늘어난다", () => {
  it("변태력 0에서도 볼 수 있는 물건이 있다 — 시작조차 못 하면 안 된다", () => {
    const s = adult();
    expect(visibleYabamVideos(s).length).toBeGreaterThan(0);
    expect(visiblePushWorks(s).length).toBeGreaterThan(0);
  });

  it("변태력이 0에서 볼 수 있는 것 중 최소 하나는 변태력을 준다 — 첫 계단이 있어야 한다", () => {
    const s = adult();
    expect(visibleYabamVideos(s).some((v) => (v.pervert ?? 0) > 0)).toBe(true);
    expect(visiblePushWorks(s).some((w) => (w.pervert ?? 0) > 0)).toBe(true);
  });

  it("변태력이 높아지면 목록이 늘어난다", () => {
    const low = adult();
    const high = adult();
    high.skills.pervert = 999;
    expect(visibleYabamVideos(high).length).toBeGreaterThan(visibleYabamVideos(low).length);
    expect(visiblePushWorks(high).length).toBeGreaterThan(visiblePushWorks(low).length);
  });
});

describe("SM 규율 세션이 변태력을 준다", () => {
  it("음란이 오르는 선택은 변태력도 올린다", () => {
    const s = adult();
    s.crewJoined = true;
    s.privateCrewJoined = true;
    const scenario = pickCrewSecretScenario();
    const idx = scenario.choices.findIndex((c) => (c.effect.skills?.lewd ?? 0) > 0);
    expect(idx, "음란이 오르는 선택이 하나는 있어야 한다").toBeGreaterThanOrEqual(0);

    s.resources.action = 100;
    resolveCrewSecret(s, scenario, idx);
    expect(s.skills.pervert).toBeGreaterThan(0);
  });

  it("시나리오 데이터를 안 고치고도 전부에 적용된다", () => {
    // 데이터에 pervert가 하나도 없어야 한다(있으면 이중 지급이다).
    const declared = CREW_SECRET_SCENARIOS.flatMap((sc) =>
      sc.choices.map((c) => c.effect.skills?.pervert ?? 0),
    );
    expect(declared.every((v) => v === 0)).toBe(true);
  });
});

describe("비공개 클럽 DM — 러닝크루를 안 거치는 우회로", () => {
  /** 체벌 트윗 문턱을 넘긴 상태. */
  function punished(): GameState {
    const s = adult();
    s.punishTweetsPosted = PRIVATE_CREW_PUNISH_THRESHOLD;
    return s;
  }

  it("문턱을 넘으면 러닝크루 미가입이어도 DM이 온다", () => {
    const s = punished();
    expect(s.crewJoined, "러닝크루에 가입한 적 없다").toBe(false);
    // 확률을 걷어내기 위해 여러 번 시도한다.
    let spawned = false;
    for (let i = 0; i < 60 && !spawned; i++) spawned = maybeSpawnPrivateClubDM(s);
    expect(spawned, "이 경로가 막히면 운동 안 하는 플레이어는 영영 도달 못 한다").toBe(true);
    expect(getActiveAccount(s).dms.some((t) => t.privateClub)).toBe(true);
  });

  it("문턱 미달이면 안 온다", () => {
    const s = adult();
    s.punishTweetsPosted = PRIVATE_CREW_PUNISH_THRESHOLD - 1;
    for (let i = 0; i < 60; i++) expect(maybeSpawnPrivateClubDM(s)).toBe(false);
  });

  it("성인 모드가 꺼져 있으면 안 온다", () => {
    const s = punished();
    s.adultMode = false;
    for (let i = 0; i < 60; i++) expect(maybeSpawnPrivateClubDM(s)).toBe(false);
  });

  it("이미 가입했으면 안 온다", () => {
    const s = punished();
    s.privateCrewJoined = true;
    for (let i = 0; i < 60; i++) expect(maybeSpawnPrivateClubDM(s)).toBe(false);
  });

  it("초대 스레드가 이미 있으면 중복 생성하지 않는다", () => {
    const s = punished();
    for (let i = 0; i < 60; i++) maybeSpawnPrivateClubDM(s);
    expect(getActiveAccount(s).dms.filter((t) => t.privateClub).length).toBe(1);
  });

  /** DM을 확률 굴림 없이 확보한다. */
  function withInvite(): { s: GameState; thread: NonNullable<ReturnType<typeof findInvite>> } {
    const s = punished();
    for (let i = 0; i < 60 && !findInvite(s); i++) maybeSpawnPrivateClubDM(s);
    return { s, thread: findInvite(s)! };
  }
  function findInvite(s: GameState) {
    return getActiveAccount(s).dms.find((t) => t.privateClub);
  }

  it("수락하면 가입되고 클럽 세션 일정이 잡힌다", () => {
    const { s, thread } = withInvite();
    acceptPrivateClub(s, thread);

    expect(s.privateCrewJoined).toBe(true);
    const club = s.appointments.filter((a) => a.kind === "privateClub");
    expect(club.length, "일정이 안 잡히면 가입만 되고 모임이 영영 안 열린다").toBe(1);
    expect(thread.privateClub).toBe(false);
  });

  it("클럽에 들어가도 러닝크루원이 되지는 않는다", () => {
    const { s, thread } = withInvite();
    acceptPrivateClub(s, thread);
    expect(s.crewJoined, "러닝을 한 적 없는 사람이 크루원이 되면 안 된다").toBe(false);
    expect(s.appointments.some((a) => a.kind === "crew")).toBe(false);
  });

  it("클럽 세션과 러닝 정기런은 같은 자리에 겹치지 않는다", () => {
    // ⚠️ 처음엔 세션을 정기런 자리에 얹었다 — 러닝을 나가면 세션이 되고 세션을 하면
    //    러닝이 사라졌다. 둘은 다른 모임이므로 (요일, 슬롯)이 달라야 한다.
    const { s, thread } = withInvite();
    s.crewJoined = true;
    scheduleNextCrewRun(s);
    acceptPrivateClub(s, thread);

    const run = s.appointments.find((a) => a.kind === "crew")!;
    const club = s.appointments.find((a) => a.kind === "privateClub")!;
    expect(run, "러닝 일정이 사라지면 안 된다").toBeTruthy();
    expect(club).toBeTruthy();
    expect(
      dayOfWeek(run.day) === dayOfWeek(club.day) && run.slot === club.slot,
      "두 모임이 같은 요일·슬롯에 겹친다",
    ).toBe(false);
  });

  it("세션을 치르면 클럽 일정만 다시 잡힌다 — 러닝을 재예약하지 않는다", () => {
    const { s, thread } = withInvite();
    acceptPrivateClub(s, thread);
    s.resources.action = 100;
    const scenario = pickCrewSecretScenario();
    resolveCrewSecret(s, scenario, 0);

    expect(s.appointments.filter((a) => a.kind === "privateClub").length).toBe(1);
    expect(s.appointments.some((a) => a.kind === "crew"), "러닝은 안 잡혀야 한다").toBe(false);
  });

  it("거절하면 가입되지 않고 제의만 닫힌다", () => {
    const s = punished();
    for (let i = 0; i < 60 && !getActiveAccount(s).dms.some((t) => t.privateClub); i++) {
      maybeSpawnPrivateClubDM(s);
    }
    const thread = getActiveAccount(s).dms.find((t) => t.privateClub)!;
    declinePrivateClub(s, thread);
    expect(s.privateCrewJoined).toBe(false);
    expect(thread.privateClub).toBe(false);
  });

  it("러닝크루 경로도 그대로 살아 있다", () => {
    const s = punished();
    s.crewJoined = true;
    expect(canOfferPrivateCrew(s)).toBe(true);
  });

  it("구세이브 백필 — 가입돼 있는데 일정이 없으면 불러올 때 되살린다", () => {
    // 클럽 세션이 러닝 정기런 자리에서 돌던 시절에 가입한 세이브는 전용 일정이 없다.
    // 일정은 가입 시점에만 잡히므로, 백필이 없으면 그 세이브는 모임이 영영 안 열린다.
    const s = adult();
    s.privateCrewJoined = true;
    s.appointments = [];
    const loaded = loadGame(JSON.stringify(s))!;
    expect(loaded.appointments.some((a) => a.kind === "privateClub")).toBe(true);
  });

  it("백필이 이미 있는 일정을 중복으로 만들지 않는다", () => {
    const s = adult();
    s.privateCrewJoined = true;
    scheduleNextPrivateClub(s);
    const loaded = loadGame(JSON.stringify(s))!;
    expect(loaded.appointments.filter((a) => a.kind === "privateClub").length).toBe(1);
  });

  it("가입 안 한 사람에겐 백필이 일정을 만들지 않는다", () => {
    const s = adult();
    const loaded = loadGame(JSON.stringify(s))!;
    expect(loaded.appointments.some((a) => a.kind === "privateClub")).toBe(false);
  });
});
