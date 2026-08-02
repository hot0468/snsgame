import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  BLACKMAIL_FIRST_DELAY,
  BLACKMAIL_NEXT_DELAY,
  LEAK_FOLLOWER_LOSS,
  acceptBlackmailMeet,
  blackmailAmount,
  maybeSpawnBlackmailDM,
  payBlackmail,
  refuseBlackmail,
  seedBlackmail,
} from "@/systems/blackmail";
import { BLACKMAIL_AMOUNTS, BLACKMAIL_LINES, BLACKMAIL_MAX_STAGE } from "@/data/blackmail";
import { JOB_ADULT_SCENES } from "@/data/jobAdult";
import { ADULT_OFFLINE_ENCOUNTERS } from "@/data/adultOffline";
import type { GameState } from "@/core/types";

/**
 * 협박·유출 축.
 *
 * 기존 강압 조우 22종은 전부 그 자리에서 끝난다. 이 축만 시간을 두고 다시 온다:
 *   강압 씬(촬영 언급) → 씨 심김 → 며칠 뒤 카톡 → 돈/만남/거절 → (거절이면) 유출
 *
 * 고정하는 불변식:
 *  1) 성인 모드 + '강압 보기'일 때만 씨가 심긴다.
 *  2) 한 번에 하나만 굴러간다.
 *  3) 도착일 전에는 안 온다. 답 안 한 카톡이 떠 있으면 또 안 온다.
 *  4) 응하면 요구가 커지고, 마지막 단계를 넘기면 끝난다 — 무한 반복이 아니다.
 *  5) 거절하면 유출되고 **그 자리에서 끝난다** — 끝나는 게 거절의 대가이자 보상이다.
 */

function seeded(): GameState {
  const s = createInitialState();
  s.adultMode = true;
  s.money = 100_000_000;
  getActiveAccount(s).followers = 100_000;
  seedBlackmail(s, "taxi");
  return s;
}

/** 도착일까지 날짜를 밀고 카톡을 받는다. */
function deliver(s: GameState): string {
  s.day = s.blackmail!.nextDay;
  maybeSpawnBlackmailDM(s);
  return s.kakao[s.kakao.length - 1].id;
}

describe("씨 심기", () => {
  it("성인 모드가 꺼져 있으면 안 심긴다", () => {
    const s = createInitialState();
    expect(seedBlackmail(s, "taxi")).toBe(false);
    expect(s.blackmail).toBeNull();
  });

  it("'강압/범죄 안 보기'를 켜면 안 심긴다 — 맥락 없는 협박이 된다", () => {
    const s = createInitialState();
    s.adultMode = true;
    s.adultNoCoercion = true;
    expect(seedBlackmail(s, "taxi")).toBe(false);
  });

  it("한 번에 하나만 굴러간다", () => {
    const s = seeded();
    expect(seedBlackmail(s, "office")).toBe(false);
    expect(s.blackmail!.source, "두 번째 씨가 첫 건을 덮었다").toBe("taxi");
  });

  it("촬영이 언급된 씬에만 붙어 있다 — 출처가 실제 문구와 맞아야 한다", () => {
    // ⚠️ filmed를 아무 씬에나 붙이면 "언제 찍혔지?"가 된다. 붙은 씬의 본문에
    //    촬영 장치가 실제로 나오는지 여기서 감시한다.
    const DEVICE = ["블랙박스", "카메라", "장비", "휴대폰", "찍", "파일", "화면"];
    const filmedJob = JOB_ADULT_SCENES.filter((sc) => sc.filmed);
    expect(filmedJob.length, "촬영 씨를 심는 직업 씬이 없다").toBeGreaterThan(0);
    for (const sc of filmedJob) {
      expect(DEVICE.some((w) => sc.text.includes(w)), `${sc.id}: 본문에 촬영 장치가 없다`).toBe(true);
    }
    const filmedChoices = ADULT_OFFLINE_ENCOUNTERS.flatMap((e) =>
      e.choices.filter((c) => c.filmed).map((c) => ({ id: e.id, c })),
    );
    expect(filmedChoices.length, "촬영 씨를 심는 조우 선택지가 없다").toBeGreaterThan(0);
    for (const { id, c } of filmedChoices) {
      expect(DEVICE.some((w) => c.result.includes(w)), `${id}: 결과문에 촬영 장치가 없다`).toBe(true);
    }
  });

  it("네 출처 모두 문구가 준비돼 있다", () => {
    for (const src of ["taxi", "office", "savanna", "street"] as const) {
      expect(BLACKMAIL_LINES[src].intro.length, src).toBeGreaterThan(0);
    }
  });
});

describe("도착", () => {
  it("도착일 전에는 안 온다", () => {
    const s = seeded();
    s.day += BLACKMAIL_FIRST_DELAY - 1;
    expect(maybeSpawnBlackmailDM(s)).toBe(false);
    expect(s.kakao.length).toBe(0);
  });

  it("도착일이 되면 카톡이 온다 — 첫 연락은 무엇을 찍었는지 밝힌다", () => {
    const s = seeded();
    deliver(s);
    const t = s.kakao[s.kakao.length - 1];
    expect(t.blackmail, "협박 카드가 안 붙었다").toBeTruthy();
    expect(t.unread).toBe(true);
    expect(t.messages.length).toBeGreaterThan(BLACKMAIL_LINES.taxi.intro.length);
  });

  it("답 안 한 카톡이 떠 있으면 또 보내지 않는다 — 독촉이 쌓이면 추적이 안 된다", () => {
    const s = seeded();
    deliver(s);
    const n = s.kakao.length;
    s.day += 30;
    expect(maybeSpawnBlackmailDM(s)).toBe(false);
    expect(s.kakao.length).toBe(n);
  });
});

describe("돈을 보낸다", () => {
  it("액수만큼 빠지고 다음 요구가 예약된다", () => {
    const s = seeded();
    s.blackmail!.demand = "money";
    const id = deliver(s);
    const before = s.money;
    expect(payBlackmail(s, id)).toBe(true);
    expect(before - s.money).toBe(BLACKMAIL_AMOUNTS[0]);
    expect(s.blackmail!.stage, "단계가 안 올랐다").toBe(1);
    expect(s.blackmail!.nextDay).toBe(s.day + BLACKMAIL_NEXT_DELAY);
  });

  it("잔고가 모자라면 아무것도 바꾸지 않는다", () => {
    const s = seeded();
    s.blackmail!.demand = "money";
    const id = deliver(s);
    s.money = blackmailAmount(0) - 1;
    expect(payBlackmail(s, id)).toBe(false);
    expect(s.blackmail!.stage).toBe(0);
    expect(s.kakao.find((t) => t.id === id)!.blackmail!.resolved).toBe(false);
  });

  it("요구는 갈수록 커진다 — 한 번 주면 끝나지 않는다", () => {
    for (let i = 1; i < BLACKMAIL_AMOUNTS.length; i++) {
      expect(blackmailAmount(i)).toBeGreaterThan(blackmailAmount(i - 1));
    }
  });

  it("마지막 단계까지 응하면 협박이 끝난다 — 무한 반복은 벌이지 축이 아니다", () => {
    const s = seeded();
    for (let guard = 0; guard < 10 && s.blackmail; guard++) {
      s.blackmail.demand = "money";
      const id = deliver(s);
      payBlackmail(s, id);
    }
    expect(s.blackmail, `${BLACKMAIL_MAX_STAGE + 1}단계를 다 치렀는데 안 끝난다`).toBeNull();
  });
});

describe("만나러 간다", () => {
  it("씬을 겪고 음란·변태력이 오른다", () => {
    const s = seeded();
    s.blackmail!.demand = "meet";
    const id = deliver(s);
    const before = { lewd: s.skills.lewd, pervert: s.skills.pervert };
    const scene = acceptBlackmailMeet(s, id);
    expect(scene, "만남 요구인데 씬이 없다").toBeTruthy();
    expect(s.skills.lewd).toBeGreaterThan(before.lewd);
    expect(s.skills.pervert).toBeGreaterThan(before.pervert);
  });

  it("요구가 돈인 카드에는 만남이 성립하지 않는다", () => {
    const s = seeded();
    s.blackmail!.demand = "money";
    const id = deliver(s);
    expect(acceptBlackmailMeet(s, id)).toBeNull();
  });

  it("두 번 눌러도 효과가 두 번 붙지 않는다", () => {
    const s = seeded();
    s.blackmail!.demand = "meet";
    const id = deliver(s);
    acceptBlackmailMeet(s, id);
    const after = s.skills.lewd;
    acceptBlackmailMeet(s, id);
    expect(s.skills.lewd).toBe(after);
  });
});

describe("거절 — 유출", () => {
  it("팔로워·평판·정신력을 잃는다", () => {
    const s = seeded();
    const id = deliver(s);
    const before = {
      followers: getActiveAccount(s).followers,
      rep: s.resources.reputation,
      mental: s.resources.mental,
    };
    const line = refuseBlackmail(s, id);
    expect(line.length).toBeGreaterThan(0);
    expect(getActiveAccount(s).followers).toBe(
      before.followers - Math.floor(before.followers * LEAK_FOLLOWER_LOSS),
    );
    expect(s.resources.reputation).toBeLessThan(before.rep);
    expect(s.resources.mental).toBeLessThan(before.mental);
  });

  it("그 자리에서 끝난다 — 끝나는 게 거절의 값이다", () => {
    const s = seeded();
    const id = deliver(s);
    refuseBlackmail(s, id);
    expect(s.blackmail).toBeNull();
    s.day += 100;
    expect(maybeSpawnBlackmailDM(s)).toBe(false);
  });

  it("돈도 안 나가고 만남도 없다", () => {
    const s = seeded();
    s.blackmail!.demand = "money";
    const id = deliver(s);
    const money = s.money;
    const lewd = s.skills.lewd;
    refuseBlackmail(s, id);
    expect(s.money).toBe(money);
    expect(s.skills.lewd).toBe(lewd);
  });
});
