import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { ADULT_OFFLINE_ENCOUNTERS } from "@/data/adultOffline";
import {
  rollAdultOfflineEncounter,
  resolveAdultOfflineEncounter,
  PERVERT_COERCIVE_MIN,
} from "@/systems/adultOffline";
import { readBook } from "@/systems/books";
import { OFFLINE_ACTIVITIES } from "@/systems/offline";

/**
 * 음란(정도)과 변태력(취향)의 분리 — 음란도만 높다고 강압 계열이 굴러오면 안 된다.
 * 축을 다시 하나로 합치려는 변경은 여기서 걸린다.
 */

/** 강압 조우가 하나라도 있는 활동 id(테스트 대상 활동 선정용). */
const coerciveEnc = ADULT_OFFLINE_ENCOUNTERS.find((e) => e.coercive && !e.lateOnly);
const COERCIVE_IDS = new Set(ADULT_OFFLINE_ENCOUNTERS.filter((e) => e.coercive).map((e) => e.id));

function maxLewdState(pervert: number) {
  const s = createInitialState();
  s.adultMode = true;
  s.skills.lewd = 999;
  s.skills.pervert = pervert;
  return s;
}

describe("음란/변태력 2축 게이트", () => {
  it("음란 만렙이어도 변태력이 낮으면 강압 조우가 안 뜬다", () => {
    expect(coerciveEnc).toBeDefined();
    const activity = coerciveEnc!.activities[0];
    const s = maxLewdState(0);
    for (let i = 0; i < 300; i++) {
      const id = rollAdultOfflineEncounter(s, activity, false);
      if (id) expect(COERCIVE_IDS.has(id)).toBe(false);
    }
  });

  it("변태력을 넘기면 강압 조우가 후보에 들어온다", () => {
    const activity = coerciveEnc!.activities[0];
    const s = maxLewdState(999);
    let sawCoercive = false;
    for (let i = 0; i < 300; i++) {
      const id = rollAdultOfflineEncounter(s, activity, false);
      if (id && COERCIVE_IDS.has(id)) sawCoercive = true;
    }
    expect(sawCoercive).toBe(true);
  });

  it("일반(비강압) 조우는 변태력 0이어도 뜬다", () => {
    const plain = ADULT_OFFLINE_ENCOUNTERS.find(
      (e) => !e.coercive && e.minPervert == null && !e.lateOnly,
    );
    expect(plain).toBeDefined();
    const s = maxLewdState(0);
    let saw = false;
    for (let i = 0; i < 300; i++) {
      if (rollAdultOfflineEncounter(s, plain!.activities[0], false)) saw = true;
    }
    expect(saw).toBe(true);
  });
});

describe("변태력 성장 경로", () => {
  it("강압 조우를 받아들이면 오르고, 거절하면 안 오른다", () => {
    const enc = ADULT_OFFLINE_ENCOUNTERS.find(
      (e) => e.coercive && e.choices.some((c) => (c.effect.skills?.lewd ?? 0) > 0),
    )!;
    const accept = enc.choices.findIndex((c) => (c.effect.skills?.lewd ?? 0) > 0);
    const refuse = enc.choices.findIndex((c) => (c.effect.skills?.lewd ?? 0) <= 0);

    const a = maxLewdState(PERVERT_COERCIVE_MIN);
    resolveAdultOfflineEncounter(a, enc.id, accept);
    expect(a.skills.pervert).toBeGreaterThan(PERVERT_COERCIVE_MIN);

    const r = maxLewdState(PERVERT_COERCIVE_MIN);
    resolveAdultOfflineEncounter(r, enc.id, refuse);
    expect(r.skills.pervert).toBe(PERVERT_COERCIVE_MIN);
  });

  it("게이트 밖 진입로가 존재한다 — 성인 도서와 '취향 탐구'", () => {
    // 이게 없으면 게이트(변태력 250)가 자기 자신을 올릴 콘텐츠를 잠가버려 축이 영영 0에 묶인다.
    const s = createInitialState();
    s.adultMode = true;
    s.money = 100_000;
    readBook(s, "adult", "테스트 성인서");
    expect(s.skills.pervert).toBeGreaterThan(0);

    const kink = OFFLINE_ACTIVITIES.find((a) => a.id === "kinkdig");
    expect(kink?.skillGains?.pervert).toBeGreaterThan(0);
    expect(kink?.adultOnly).toBe(true);
  });
});
