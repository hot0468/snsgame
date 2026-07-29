import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { WALK_PLACES, walkPlaceById } from "@/data/walkPlaces";
import { CREATURES } from "@/data/creatures";
import {
  OFFLINE_ACTIVITIES,
  PLACE_DISCOVERY_CHANCE,
  doOfflineActivity,
} from "@/systems/offline";

/**
 * 산책 장소 발견·재방문 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - **장소를 지정한 산책에선 발견·조우가 안 뜨는 것.** "돌아다니면 만나고, 장소를 가면
 *   확실한 스탯을 얻는다"는 트레이드오프가 이 기능의 전부다. 여기가 깨지면
 *   '돌아다니기'를 고를 이유가 사라져 선택지가 죽는다.
 * - 발견이 중복되지 않는 것(다 모으면 더 안 뜬다).
 * - 장소 방문이 행동력·시간을 산책과 똑같이 쓰는 것(장소별 코스트 차등 금지).
 */

const WALK = OFFLINE_ACTIVITIES.find((a) => a.id === "walk")!;

/** 난수를 고정해 돌린다(조우·발견 판정이 전부 Math.random에 걸려 있다) */
function withRandom<T>(value: number, fn: () => T): T {
  const orig = Math.random;
  Math.random = () => value;
  try {
    return fn();
  } finally {
    Math.random = orig;
  }
}

describe("장소 카탈로그", () => {
  it("8종이며 id가 wp_ 프리픽스이고 유일하다", () => {
    expect(WALK_PLACES).toHaveLength(8);
    for (const p of WALK_PLACES) expect(p.id.startsWith("wp_"), p.id).toBe(true);
    expect(new Set(WALK_PLACES.map((p) => p.id)).size).toBe(WALK_PLACES.length);
  });

  it("모든 장소가 소개·발견문구·방문문구를 갖는다", () => {
    for (const p of WALK_PLACES) {
      expect(p.name.length, p.id).toBeGreaterThan(0);
      expect(p.desc.length, p.id).toBeGreaterThan(5);
      expect(p.discoverText.length, p.id).toBeGreaterThan(20);
      expect(p.visitResults.length, p.id).toBeGreaterThanOrEqual(2);
      for (const r of p.visitResults) expect(r.length, p.id).toBeGreaterThan(10);
    }
  });

  it("장소 스탯 합계가 기본 산책보다 크다(아는 것 자체가 보상)", () => {
    const walkSum = Object.values(WALK.skillGains ?? {}).reduce((a, b) => a + b, 0);
    for (const p of WALK_PLACES) {
      const sum = Object.values(p.skillGains).reduce((a, b) => a + b, 0);
      expect(sum, p.id).toBeGreaterThan(walkSum);
    }
  });

  it("walkPlaceById가 id로 장소를 찾는다", () => {
    expect(walkPlaceById(WALK_PLACES[0].id)?.name).toBe(WALK_PLACES[0].name);
    expect(walkPlaceById("wp_nope")).toBeUndefined();
  });
});

describe("장소 발견", () => {
  it("돌아다니기에서 새 장소를 발견해 등록한다", () => {
    const s = createInitialState();
    // random=0이면 성인 조우 문턱은 스탯이 낮아 안 열리고, 펫(0.4)·크리처(0.1)가 먼저 뜬다.
    // 펫·크리처를 미리 채워 발견 차례까지 오게 한다.
    s.pets = { dog: true, cat: true };
    s.creatures = [];
    const r = withRandom(0.05, () => doOfflineActivity(s, WALK));
    // 크리처가 먼저 잡히면 발견은 안 뜬다 — 둘 중 하나는 반드시 일어난다.
    expect(r.creatureEncounter != null || r.discoveredPlace != null).toBe(true);
  });

  it("크리처를 다 모으면 발견 차례가 온다", () => {
    const s = createInitialState();
    s.pets = { dog: true, cat: true };
    // 크리처를 전부 수집시켜 그 단계를 건너뛰게 한다
    s.creatures = CREATURES.map((c) => c.id);

    const r = withRandom(0.05, () => doOfflineActivity(s, WALK));
    expect(r.discoveredPlace).not.toBeNull();
    expect(s.walkPlaces).toContain(r.discoveredPlace!);
  });

  it("이미 다 모았으면 발견이 안 뜬다", () => {
    const s = createInitialState();
    s.pets = { dog: true, cat: true };
    s.creatures = CREATURES.map((c) => c.id);
    s.walkPlaces = WALK_PLACES.map((p) => p.id);

    const r = withRandom(0.05, () => doOfflineActivity(s, WALK));
    expect(r.discoveredPlace).toBeNull();
    expect(s.walkPlaces).toHaveLength(WALK_PLACES.length);
  });

  it("같은 장소가 두 번 등록되지 않는다", () => {
    const s = createInitialState();
    s.pets = { dog: true, cat: true };
    s.creatures = CREATURES.map((c) => c.id);

    for (let i = 0; i < 30; i++) {
      s.resources.action = 100;
      withRandom(0.05, () => doOfflineActivity(s, WALK));
    }
    expect(new Set(s.walkPlaces).size).toBe(s.walkPlaces.length);
  });

  it("발견 확률 상수가 0과 1 사이다", () => {
    expect(PLACE_DISCOVERY_CHANCE).toBeGreaterThan(0);
    expect(PLACE_DISCOVERY_CHANCE).toBeLessThan(1);
  });
});

describe("장소 방문 — 트레이드오프", () => {
  it("장소를 지정하면 발견도 조우도 일어나지 않는다", () => {
    const place = WALK_PLACES[0];
    for (let i = 0; i < 20; i++) {
      const s = createInitialState();
      s.pets = { dog: false, cat: false }; // 조우 가능한 상태로 둔다
      s.creatures = [];
      s.walkPlaces = [place.id];
      s.resources.action = 100;

      const r = withRandom(0.05, () => doOfflineActivity(s, WALK, undefined, place.id));
      expect(r.discoveredPlace, "장소 방문 중 발견").toBeNull();
      expect(r.petEncounter, "장소 방문 중 펫 조우").toBeNull();
      expect(r.creatureEncounter, "장소 방문 중 크리처 조우").toBeNull();
      // 장소를 갔는데 새 장소가 늘면 안 된다
      expect(s.walkPlaces).toEqual([place.id]);
    }
  });

  it("장소 방문이 그 장소의 스탯을 올린다", () => {
    const trail = walkPlaceById("wp_trail")!; // 운동 +12
    const s = createInitialState();
    s.walkPlaces = [trail.id];
    s.resources.mental = 100; // 컨디션 등급 편차를 줄인다
    const before = s.skills.fitness;

    doOfflineActivity(s, WALK, undefined, trail.id);
    expect(s.skills.fitness).toBeGreaterThan(before);
  });

  it("장소마다 오르는 스탯이 다르다", () => {
    const bookshop = walkPlaceById("wp_bookshop")!; // 지식·어휘력
    const trail = walkPlaceById("wp_trail")!; // 운동

    const a = createInitialState();
    a.resources.mental = 100;
    a.walkPlaces = [bookshop.id];
    doOfflineActivity(a, WALK, undefined, bookshop.id);

    const b = createInitialState();
    b.resources.mental = 100;
    b.walkPlaces = [trail.id];
    doOfflineActivity(b, WALK, undefined, trail.id);

    expect(a.skills.knowledge).toBeGreaterThan(b.skills.knowledge);
    expect(b.skills.fitness).toBeGreaterThan(a.skills.fitness);
  });

  it("장소 방문도 행동력·시간을 산책과 같이 쓴다", () => {
    const place = WALK_PLACES[0];

    const roam = createInitialState();
    roam.resources.mental = 100;
    const roamAction = roam.resources.action;
    const roamSlot = roam.slot;
    const roamDay = roam.day;
    doOfflineActivity(roam, WALK);

    const visit = createInitialState();
    visit.resources.mental = 100;
    visit.walkPlaces = [place.id];
    doOfflineActivity(visit, WALK, undefined, place.id);

    // 행동력 소모가 정확히 같다(장소별 코스트 차등 금지 — 가성비 좋은 한 곳으로 굳는다)
    const roamCost = roamAction - roam.resources.action;
    const visitCost = roamAction - visit.resources.action;
    expect(visitCost).toBe(roamCost);
    expect(roamCost).toBe(-WALK.action);
    // 시간도 똑같이 1칸 흐른다
    expect(roam.slot !== roamSlot || roam.day !== roamDay).toBe(true);
    expect(visit.slot !== roamSlot || visit.day !== roamDay).toBe(true);
  });

  it("없는 장소 id를 넘기면 그냥 돌아다니기가 된다(크래시 없음)", () => {
    const s = createInitialState();
    expect(() => doOfflineActivity(s, WALK, undefined, "wp_nonexistent")).not.toThrow();
  });
});

describe("상태 필드", () => {
  it("초기 상태엔 발견한 장소가 없다", () => {
    expect(createInitialState().walkPlaces).toEqual([]);
  });
});
