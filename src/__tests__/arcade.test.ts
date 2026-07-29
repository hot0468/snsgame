import { describe, it, expect, beforeEach } from "vitest";
import { DOLLS, dollById } from "@/data/arcade";
import { createInitialState } from "@/core/state";
import { loadGame } from "@/systems/save";
import { OFFLINE_ACTIVITIES, ARCADE_ENCOUNTER_CHANCE } from "@/systems/offline";
import {
  payClaw,
  collectDoll,
  CLAW_COST,
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

/* ⚠️ 성공·실패 판정(레인·슬립 확률)은 물리 미니게임(ui/arcadeScene.ts)으로 옮겨갔다.
   systems는 이제 '동전 넣기'와 '경품 등록'만 한다 — 여기서 확률을 검사하지 마라. */
describe("동전 넣기", () => {
  it("집게를 내릴 때마다 1,000원이 나간다", () => {
    const s = createInitialState();
    const before = s.money;
    expect(payClaw(s)).toBe(true);
    expect(s.money).toBe(before - CLAW_COST);
  });

  it("동전이 모자라면 아무 일도 없다", () => {
    const s = createInitialState();
    s.money = CLAW_COST - 1;
    expect(payClaw(s)).toBe(false);
    expect(s.money).toBe(CLAW_COST - 1);
  });
});

describe("경품 등록", () => {
  it("물리가 떨어뜨린 그 인형이 도감에 들어가고 정신력이 오른다", () => {
    const s = createInitialState();
    s.resources.mental = 50;
    const target = DOLLS.find((d) => d.rarity === "rare")!;
    const r = collectDoll(s, target.id)!;
    // ⚠️ 등급 안에서 다시 뽑지 않는다 — 유리장에서 잡은 그 인형이 그대로 와야 한다.
    expect(r.doll.id).toBe(target.id);
    expect(r.duplicate).toBe(false);
    expect(s.dolls).toEqual([target.id]);
    expect(s.resources.mental).toBe(50 + DOLL_FIRST_MENTAL);
  });

  it("없는 id면 null이고 상태를 안 건드린다", () => {
    const s = createInitialState();
    expect(collectDoll(s, "doll_nope")).toBeNull();
    expect(s.dolls).toEqual([]);
  });

  it("중복 인형은 도감이 아니라 재고로 간다", () => {
    const s = createInitialState();
    const target = DOLLS[0];
    collectDoll(s, target.id);
    const again = collectDoll(s, target.id)!;
    expect(again.duplicate).toBe(true);
    expect(s.dolls.filter((x) => x === target.id)).toHaveLength(1);
    expect(s.dollStock[target.id]).toBe(1);
  });

  it("전종을 채우면 완성 보너스가 1회만 붙는다", () => {
    const s = createInitialState();
    const last = DOLLS[DOLLS.length - 1];
    s.dolls = DOLLS.filter((d) => d.id !== last.id).map((d) => d.id);
    expect(s.dolls).toHaveLength(DOLL_TOTAL - 1);

    const r = collectDoll(s, last.id)!;
    expect(r.completed).toBe(true);
    expect(s.dolls).toHaveLength(DOLL_TOTAL);

    const again = collectDoll(s, last.id)!;
    expect(again.completed).toBe(false);
    expect(again.duplicate).toBe(true);
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

describe("오락실 조우", () => {
  it("확률 상수가 0과 1 사이다", () => {
    expect(ARCADE_ENCOUNTER_CHANCE).toBeGreaterThan(0);
    expect(ARCADE_ENCOUNTER_CHANCE).toBeLessThan(1);
  });

  it("외출 활동이 존재한다(조우가 붙는 자리)", () => {
    expect(OFFLINE_ACTIVITIES.find((a) => a.id === "goout")).toBeDefined();
  });
});
