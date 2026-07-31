import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { ACHIEVEMENTS } from "@/data/achievements";
import { CHARACTER_GROUP_DEFS, CHARACTER_GROUPS } from "@/data/accounts";
import { DOLLS } from "@/data/arcade";
import { WALK_PLACES } from "@/data/walkPlaces";
import { RECIPES } from "@/data/grocery";
import { STREAM_TYPES } from "@/data/livestream";

/**
 * 업적 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - **condition이 순수 판정인 것**(상태를 읽기만 하고 절대 변형하지 않는다).
 *   여기가 깨지면 업적 목록을 여는 것만으로 게임 상태가 바뀐다.
 * - 신규 상태 필드가 없는 구세이브에서도 크래시하지 않는 것(?? 폴백).
 * - 완성형 업적이 실제로 '전부 모았을 때만' 달성되는 것.
 */

const byId = (id: string) => {
  const a = ACHIEVEMENTS.find((x) => x.id === id);
  if (!a) throw new Error(`업적 ${id}가 없다`);
  return a;
};

describe("업적 공통 계약", () => {
  it("id가 전부 유일하다", () => {
    expect(new Set(ACHIEVEMENTS.map((a) => a.id)).size).toBe(ACHIEVEMENTS.length);
  });

  it("모든 업적이 이름·설명·이모지를 갖는다", () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.name.length, a.id).toBeGreaterThan(0);
      expect(a.desc.length, a.id).toBeGreaterThan(5);
      expect(a.emoji.length, a.id).toBeGreaterThan(0);
    }
  });

  it("condition은 상태를 변형하지 않는다(순수 판정)", () => {
    const s = createInitialState();
    const before = JSON.stringify(s);
    for (const a of ACHIEVEMENTS) a.condition(s);
    expect(JSON.stringify(s)).toBe(before);
  });

  it("신규 필드가 없는 구세이브에서도 크래시하지 않는다", () => {
    const s = createInitialState();
    // 이번 세션에 추가된 필드를 전부 지운 '구세이브'를 흉내낸다
    for (const key of [
      "dolls",
      "dollStock",
      "walkPlaces",
      "cookedDishes",
      "streamBests",
      "streamCount",
      "overtimeStreak",
      "hungerStreak",
    ]) {
      delete (s as unknown as Record<string, unknown>)[key];
    }
    for (const a of ACHIEVEMENTS) {
      expect(() => a.condition(s), a.id).not.toThrow();
    }
  });

  it("초기 상태에서 달성되는 업적이 없다(도덕성 등 시작값 함정 방지)", () => {
    const s = createInitialState();
    const unlocked = ACHIEVEMENTS.filter((a) => a.condition(s)).map((a) => a.id);
    expect(unlocked).toEqual([]);
  });
});

describe("인형뽑기 업적", () => {
  it("첫 인형은 1개부터 달성된다", () => {
    const s = createInitialState();
    expect(byId("doll_first").condition(s)).toBe(false);
    s.dolls.push(DOLLS[0].id);
    expect(byId("doll_first").condition(s)).toBe(true);
  });

  it("레어 업적은 레어 인형에만 반응한다", () => {
    const common = DOLLS.find((d) => d.rarity === "common")!;
    const rare = DOLLS.find((d) => d.rarity === "rare")!;

    const s = createInitialState();
    s.dolls = [common.id];
    expect(byId("doll_rare").condition(s)).toBe(false);
    s.dolls.push(rare.id);
    expect(byId("doll_rare").condition(s)).toBe(true);
  });

  it("도감 완성은 12종 전부여야 달성된다", () => {
    const s = createInitialState();
    s.dolls = DOLLS.slice(0, DOLLS.length - 1).map((d) => d.id);
    expect(byId("doll_dex_complete").condition(s)).toBe(false);
    s.dolls.push(DOLLS[DOLLS.length - 1].id);
    expect(byId("doll_dex_complete").condition(s)).toBe(true);
  });
});

describe("산책 장소 업적", () => {
  it("첫 발견은 1곳부터 달성된다", () => {
    const s = createInitialState();
    expect(byId("walk_place_first").condition(s)).toBe(false);
    s.walkPlaces.push(WALK_PLACES[0].id);
    expect(byId("walk_place_first").condition(s)).toBe(true);
  });

  it("지도 완성은 8곳 전부여야 달성된다", () => {
    const s = createInitialState();
    s.walkPlaces = WALK_PLACES.slice(0, WALK_PLACES.length - 1).map((p) => p.id);
    expect(byId("walk_place_all").condition(s)).toBe(false);
    s.walkPlaces.push(WALK_PLACES[WALK_PLACES.length - 1].id);
    expect(byId("walk_place_all").condition(s)).toBe(true);
  });
});

describe("요리 도감 업적", () => {
  it("레시피 전부를 만들어야 달성된다", () => {
    const s = createInitialState();
    s.cookedDishes = RECIPES.slice(0, RECIPES.length - 1).map((r) => r.id);
    expect(byId("cooking_dex_complete").condition(s)).toBe(false);
    s.cookedDishes.push(RECIPES[RECIPES.length - 1].id);
    expect(byId("cooking_dex_complete").condition(s)).toBe(true);
  });
});

describe("고생 훈장(숨김 업적)", () => {
  it("야근 5일 연속에서 달성된다", () => {
    const s = createInitialState();
    s.overtimeStreak = 4;
    expect(byId("overtime_streak").condition(s)).toBe(false);
    s.overtimeStreak = 5;
    expect(byId("overtime_streak").condition(s)).toBe(true);
  });

  it("굶주림 3일에서 달성된다", () => {
    const s = createInitialState();
    s.hungerStreak = 2;
    expect(byId("hunger_survivor").condition(s)).toBe(false);
    s.hungerStreak = 3;
    expect(byId("hunger_survivor").condition(s)).toBe(true);
  });

  it("고생 훈장은 숨김 처리된다(목표로 삼을 일이 아니다)", () => {
    expect(byId("overtime_streak").hidden).toBe(true);
    expect(byId("hunger_survivor").hidden).toBe(true);
  });
});

describe("이번 세션 기능이 전부 업적으로 덮인다", () => {
  it("인형·산책장소·요리·인방 완성 업적이 모두 존재한다", () => {
    for (const id of [
      "doll_dex_complete",
      "walk_place_all",
      "cooking_dex_complete",
      "stream_all_types",
    ]) {
      expect(byId(id)).toBeDefined();
    }
  });

  it("완성 업적의 설명이 실제 종수와 일치한다", () => {
    expect(byId("doll_dex_complete").desc).toContain(String(DOLLS.length));
    expect(byId("walk_place_all").desc).toContain(String(WALK_PLACES.length));
    expect(byId("cooking_dex_complete").desc).toContain(String(RECIPES.length));
  });

  it("인방 타입 3종이 만능 스트리머 조건에 그대로 쓰인다", () => {
    const s = createInitialState();
    for (const t of STREAM_TYPES) s.streamBests[t.id] = 1;
    expect(byId("stream_all_types").condition(s)).toBe(true);
  });
});

describe("고정 계정 도감(원작 갈래별 전원 팔로우)", () => {
  /** 활성 계정이 이 핸들들을 팔로우한 상태를 만든다 */
  const followAll = (s: ReturnType<typeof createInitialState>, handles: string[]): void => {
    const account = getActiveAccount(s);
    for (const handle of handles) {
      account.followingAccounts.push({
        id: `acc_${handle}`,
        name: handle,
        handle,
        attribute: "daily",
        isAdult: false,
        bio: "",
        followers: 100,
        timeline: [],
        followed: true,
      });
    }
  };

  it("갈래마다 업적이 하나씩 있고, 전체 완성 업적도 있다", () => {
    for (const g of CHARACTER_GROUP_DEFS) {
      expect(byId(`fixed_dex_${g.id}`), g.id).toBeDefined();
    }
    expect(byId("fixed_dex_all")).toBeDefined();
  });

  it("한 명이라도 빠지면 그 갈래 업적이 안 열린다", () => {
    const g = CHARACTER_GROUP_DEFS[0];
    const s = createInitialState();
    // 마지막 한 명만 빼고 전부 팔로우
    followAll(s, g.handles.slice(0, -1));
    expect(byId(`fixed_dex_${g.id}`).condition(s)).toBe(false);
  });

  it("갈래를 전부 팔로우하면 그 업적만 열린다", () => {
    const [first, second] = CHARACTER_GROUP_DEFS;
    const s = createInitialState();
    followAll(s, first.handles);
    expect(byId(`fixed_dex_${first.id}`).condition(s)).toBe(true);
    // 다른 갈래는 그대로 잠겨 있어야 한다(갈래가 서로 새지 않는다)
    expect(byId(`fixed_dex_${second.id}`).condition(s)).toBe(false);
    expect(byId("fixed_dex_all").condition(s)).toBe(false);
  });

  it("모든 갈래를 다 모아야 완성 업적이 열린다", () => {
    const s = createInitialState();
    for (const g of CHARACTER_GROUP_DEFS) followAll(s, g.handles);
    expect(byId("fixed_dex_all").condition(s)).toBe(true);
    for (const g of CHARACTER_GROUP_DEFS) {
      expect(byId(`fixed_dex_${g.id}`).condition(s), g.id).toBe(true);
    }
  });

  /** ⚠️ 갈래에 계정을 추가했는데 업적이 자동으로 안 늘면 조건이 조용히 헐거워진다. */
  it("업적 설명의 계정 수가 실제 갈래 크기와 일치한다", () => {
    for (const g of CHARACTER_GROUP_DEFS) {
      expect(byId(`fixed_dex_${g.id}`).desc, g.id).toContain(String(g.handles.length));
    }
    expect(byId("fixed_dex_all").desc).toContain(String(CHARACTER_GROUP_DEFS.length));
  });

  it("갈래 id가 전부 유일하다(업적 id 충돌 방지)", () => {
    const ids = CHARACTER_GROUP_DEFS.map((g) => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  /** 답글 로직이 쓰는 CHARACTER_GROUPS가 갈래 정의에서 파생되는지(둘이 갈라지면 안 된다). */
  it("답글용 그룹 배열이 갈래 정의와 같다", () => {
    expect(CHARACTER_GROUPS).toEqual(CHARACTER_GROUP_DEFS.map((g) => g.handles));
  });
});
