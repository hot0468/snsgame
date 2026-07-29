import { describe, it, expect, beforeEach } from "vitest";
import { DOLLS, dollById } from "@/data/arcade";
import { createInitialState } from "@/core/state";
import { loadGame } from "@/systems/save";
import {
  laneAt,
  playClaw,
  CLAW_COST,
  RARE_BAND,
  COMMON_BAND,
  DOLL_TOTAL,
  DOLL_FIRST_MENTAL,
  stockedDolls,
  sellDoll,
} from "@/systems/arcade";

/**
 * 오락실 인형뽑기 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 한 방문 = 인형 1개 상한(이 기능의 밸런스 축).
 * - 중복 뽑기가 도감이 아니라 재고로 가는 것(도감 1호기 영구 보존).
 * - 판매가 재고만 차감하고 도감을 비우지 않는 것.
 */

describe("인형 카탈로그", () => {
  it("12종이며 common 8 · rare 4로 나뉜다", () => {
    expect(DOLLS).toHaveLength(12);
    expect(DOLLS.filter((d) => d.rarity === "common")).toHaveLength(8);
    expect(DOLLS.filter((d) => d.rarity === "rare")).toHaveLength(4);
  });

  it("id가 doll_ 프리픽스이고 전부 유일하다", () => {
    for (const d of DOLLS) expect(d.id.startsWith("doll_"), d.id).toBe(true);
    expect(new Set(DOLLS.map((d) => d.id)).size).toBe(DOLLS.length);
  });

  it("모든 인형이 이름·설명·자랑문구를 갖는다", () => {
    for (const d of DOLLS) {
      expect(d.name.length, d.id).toBeGreaterThan(0);
      expect(d.desc.length, d.id).toBeGreaterThan(10);
      expect(d.brag.length, d.id).toBeGreaterThan(5);
    }
  });

  it("시세는 일반 3천~6천 · 레어 2만~4.5만이다", () => {
    for (const d of DOLLS) {
      if (d.rarity === "common") {
        expect(d.resale, d.id).toBeGreaterThanOrEqual(3_000);
        expect(d.resale, d.id).toBeLessThanOrEqual(6_000);
      } else {
        expect(d.resale, d.id).toBeGreaterThanOrEqual(20_000);
        expect(d.resale, d.id).toBeLessThanOrEqual(45_000);
      }
    }
  });

  it("dollById가 id로 인형을 찾는다", () => {
    expect(dollById(DOLLS[0].id)?.name).toBe(DOLLS[0].name);
    expect(dollById("doll_nonexistent")).toBeUndefined();
  });
});

/* ── 구세이브 로드 하네스(save.test.ts와 같은 방식) ── */
const KEY = "snsgame:save:v2";
const store: Record<string, string> = {};

beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  (globalThis as any).localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => void (store[k] = v),
    removeItem: (k: string) => void delete store[k],
  };
});

function loadLegacy(mutate: (o: any) => void) {
  const legacy: any = createInitialState();
  mutate(legacy);
  store[KEY] = JSON.stringify(legacy);
  const loaded = loadGame();
  expect(loaded, "구세이브 로드가 null을 반환하면 안 된다").toBeTruthy();
  return loaded!;
}

describe("인형 상태 필드", () => {
  it("초기 상태에 빈 도감과 빈 재고가 있다", () => {
    const s = createInitialState();
    expect(s.dolls).toEqual([]);
    expect(s.dollStock).toEqual({});
  });

  it("구세이브에 기본값을 주입한다", () => {
    const s = loadLegacy((o) => {
      delete o.dolls;
      delete o.dollStock;
    });
    expect(s.dolls).toEqual([]);
    expect(s.dollStock).toEqual({});
  });

  it("기존 도감·재고는 로드해도 보존된다", () => {
    const id = DOLLS[0].id;
    const s = loadLegacy((o) => {
      o.dolls = [id];
      o.dollStock = { [id]: 2 };
    });
    expect(s.dolls).toEqual([id]);
    expect(s.dollStock[id]).toBe(2);
  });
});

describe("레인 판정", () => {
  it("중앙은 레어, 그 바깥은 일반, 끝은 꽝이다", () => {
    expect(laneAt(0.5)).toBe("rare");
    expect(laneAt(0.5 + RARE_BAND - 0.01)).toBe("rare");
    expect(laneAt(0.5 + RARE_BAND + 0.01)).toBe("common");
    expect(laneAt(0.5 + COMMON_BAND - 0.01)).toBe("common");
    expect(laneAt(0.5 + COMMON_BAND + 0.01)).toBe("miss");
    expect(laneAt(0)).toBe("miss");
    expect(laneAt(1)).toBe("miss");
  });

  it("중앙 기준 좌우가 대칭이다", () => {
    for (const d of [0.03, 0.1, 0.25]) {
      expect(laneAt(0.5 - d)).toBe(laneAt(0.5 + d));
    }
  });
});

describe("뽑기 판정", () => {
  it("판마다 1,000원을 소모한다", () => {
    const s = createInitialState();
    const before = s.money;
    playClaw(s, 0);
    expect(s.money).toBe(before - CLAW_COST);
  });

  it("꽝이면 인형이 없다", () => {
    const s = createInitialState();
    const r = playClaw(s, 0);
    expect(r.outcome).toBe("miss");
    expect(r.doll).toBeNull();
    expect(s.dolls).toEqual([]);
  });

  it("힐이 미끄러지면 당첨 위치여도 인형을 못 얻는다", () => {
    const s = createInitialState();
    const orig = Math.random;
    Math.random = () => 0;
    try {
      const r = playClaw(s, 0.5);
      expect(r.outcome).toBe("slip");
      expect(r.doll).toBeNull();
      expect(s.dolls).toEqual([]);
    } finally {
      Math.random = orig;
    }
  });

  it("성공하면 도감에 등록되고 정신력이 오른다", () => {
    const s = createInitialState();
    s.resources.mental = 50;
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
      const r = playClaw(s, 0.5);
      expect(r.outcome).toBe("win");
      expect(r.doll).not.toBeNull();
      expect(r.duplicate).toBe(false);
      expect(s.dolls).toHaveLength(1);
      expect(s.resources.mental).toBe(50 + DOLL_FIRST_MENTAL);
    } finally {
      Math.random = orig;
    }
  });

  it("중복 인형은 도감이 아니라 재고로 간다", () => {
    const s = createInitialState();
    const orig = Math.random;
    Math.random = () => 0.99;
    try {
      const first = playClaw(s, 0.5);
      const id = first.doll!.id;
      for (const d of DOLLS.filter((x) => x.rarity === "rare" && x.id !== id)) {
        s.dolls.push(d.id);
      }
      const again = playClaw(s, 0.5);
      expect(again.outcome).toBe("win");
      expect(again.duplicate).toBe(true);
      expect(s.dolls.filter((x) => x === again.doll!.id)).toHaveLength(1);
      expect(s.dollStock[again.doll!.id]).toBe(1);
    } finally {
      Math.random = orig;
    }
  });

  it("전종을 채우면 완성 보너스가 1회만 붙는다", () => {
    const s = createInitialState();
    const lastRare = DOLLS.find((d) => d.rarity === "rare")!;
    s.dolls = DOLLS.filter((d) => d.id !== lastRare.id).map((d) => d.id);
    expect(s.dolls).toHaveLength(DOLL_TOTAL - 1);

    const orig = Math.random;
    Math.random = () => 0.99;
    try {
      const r = playClaw(s, 0.5);
      expect(r.completed).toBe(true);
      expect(r.doll!.id).toBe(lastRare.id);
      expect(s.dolls).toHaveLength(DOLL_TOTAL);
      const again = playClaw(s, 0.5);
      expect(again.completed).toBe(false);
      expect(again.duplicate).toBe(true);
    } finally {
      Math.random = orig;
    }
  });
});

describe("인형 판매", () => {
  it("재고가 있는 인형만 목록에 나온다", () => {
    const s = createInitialState();
    expect(stockedDolls(s)).toEqual([]);
    s.dollStock[DOLLS[0].id] = 2;
    const list = stockedDolls(s);
    expect(list).toHaveLength(1);
    expect(list[0].doll.id).toBe(DOLLS[0].id);
    expect(list[0].count).toBe(2);
  });

  it("팔면 소지금이 즉시 늘고 재고가 1 줄어든다", () => {
    const s = createInitialState();
    const d = DOLLS[0];
    s.dollStock[d.id] = 2;
    const before = s.money;
    const paid = sellDoll(s, d.id);
    expect(paid).toBe(d.resale);
    expect(s.money).toBe(before + d.resale);
    expect(s.dollStock[d.id]).toBe(1);
  });

  it("재고가 0이 되면 목록에서 사라진다", () => {
    const s = createInitialState();
    const d = DOLLS[0];
    s.dollStock[d.id] = 1;
    sellDoll(s, d.id);
    expect(stockedDolls(s)).toEqual([]);
  });

  it("재고를 전부 팔아도 도감 1호기는 남는다", () => {
    const s = createInitialState();
    const d = DOLLS[0];
    s.dolls.push(d.id);
    s.dollStock[d.id] = 3;
    sellDoll(s, d.id);
    sellDoll(s, d.id);
    sellDoll(s, d.id);
    expect(stockedDolls(s)).toEqual([]);
    expect(s.dolls).toContain(d.id);
  });

  it("재고 없는 인형을 팔면 아무 일도 없다", () => {
    const s = createInitialState();
    const before = s.money;
    expect(sellDoll(s, DOLLS[0].id)).toBe(0);
    expect(s.money).toBe(before);
  });
});
