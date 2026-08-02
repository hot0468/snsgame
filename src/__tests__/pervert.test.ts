import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { ADULT_OFFLINE_ENCOUNTERS } from "@/data/adultOffline";
import {
  rollAdultOfflineEncounter,
  resolveAdultOfflineEncounter,
  meetsRequirement,
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

describe("조우가 붙은 활동", () => {
  // 야근은 OFFLINE_ACTIVITIES에 없다 — workModal이 doWork 뒤에 따로 굴리는 가상 활동이다.
  const VIRTUAL = new Set(["overtime"]);

  it("모든 조우의 activities가 실재하는 활동 id다", () => {
    // ⚠️ 이 계약이 없으면 오타 하나로 조우 전체가 **영영 안 뜬다**. 타입은 유니온이라
    //    통과하고(유니온에 오타를 같이 넣으면 그만), 후보 필터는 조용히 빈 배열을 준다.
    const real = new Set(OFFLINE_ACTIVITIES.map((a) => a.id));
    for (const e of ADULT_OFFLINE_ENCOUNTERS) {
      expect(e.activities.length, `${e.id}: 붙은 활동이 없다`).toBeGreaterThan(0);
      for (const id of e.activities) {
        expect(real.has(id) || VIRTUAL.has(id), `${e.id}: '${id}'는 없는 활동이다`).toBe(true);
      }
    }
  });

  it("꾸미기에서 조우가 실제로 뜬다", () => {
    // 시술대 계열(왁싱·샴푸실·피부관리·속눈썹)을 붙인 활동. 심야 전용도 있어 wasLate=true로 본다.
    const s = maxLewdState(999);
    let saw = false;
    for (let i = 0; i < 300 && !saw; i++) {
      if (rollAdultOfflineEncounter(s, "grooming", true)) saw = true;
    }
    expect(saw, "꾸미기 조우가 한 번도 안 떴다").toBe(true);
  });
});

describe("처지 게이트(requires)", () => {
  /**
   * 사바나 여캠 조우는 "상대가 나를 이미 알고 찾아온다"가 축이라, 방송을 안 하는 사람에게
   * 뜨면 "어떻게 알고 왔지?"가 설명되지 않는다. requires로 막는다.
   *
   * ⚠️ data의 `requires` 유니온에 값을 추가하고 systems의 `meetsRequirement` 분기를
   *    빠뜨리면 그 조우는 typecheck를 통과한 채 영영 안 뜬다 — 아래 첫 테스트가 그걸 잡는다.
   */
  const gated = ADULT_OFFLINE_ENCOUNTERS.filter((e) => e.requires);

  it("requires가 붙은 조우는 조건을 만족할 때 실제로 통과한다 — 분기 누락 감시", () => {
    expect(gated.length, "requires를 쓰는 조우가 없다").toBeGreaterThan(0);
    const s = maxLewdState(999);
    s.savannaJoined = true;
    for (const e of gated) {
      expect(meetsRequirement(s, e.requires), `${e.id}: 조건을 채웠는데 후보에 못 든다`).toBe(true);
    }
  });

  it("사바나를 안 하면 사바나 조우가 안 뜬다", () => {
    const s = maxLewdState(999);
    s.savannaJoined = false;
    const savannaIds = new Set(gated.filter((e) => e.requires === "savanna").map((e) => e.id));
    for (const act of ["rest", "goout"]) {
      for (let i = 0; i < 400; i++) {
        const id = rollAdultOfflineEncounter(s, act, true);
        if (id) expect(savannaIds.has(id), `사바나를 안 하는데 ${id}가 떴다`).toBe(false);
      }
    }
  });

  it("사바나를 하면 사바나 조우가 후보에 들어온다", () => {
    const s = maxLewdState(999);
    s.savannaJoined = true;
    const savannaIds = new Set(gated.filter((e) => e.requires === "savanna").map((e) => e.id));
    let saw = false;
    for (let i = 0; i < 600 && !saw; i++) {
      const id = rollAdultOfflineEncounter(s, "rest", true);
      if (id && savannaIds.has(id)) saw = true;
    }
    expect(saw, "사바나 조우가 한 번도 안 떴다").toBe(true);
  });
});
