# 오락실 인형뽑기 · 인형 도감 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 외출 중 확률로 만나는 오락실에서 타이밍 미니게임으로 인형을 뽑고, 도감 수집·자랑 트윗·피망마켓 판매로 잇는다.

**Architecture:** `data/arcade.ts`가 인형 12종을 선언하고, `systems/arcade.ts`가 레인 판정·힐 슬립·도감 등록·판매를 순수 함수로 처리한다. `ui/arcadeModal.ts`가 `requestAnimationFrame` 마커를 그리고 클릭 시점을 systems에 넘긴다. 기존 크리처 도감(`state.creatures`)·요리 도감(`state.cookedDishes`) 패턴을 그대로 미러링해 새 개념을 만들지 않는다.

**Tech Stack:** TypeScript + Vite, vitest, `el()`/`mount()` DOM 헬퍼, `store.dispatch` 상태 변경

설계서: [docs/superpowers/specs/2026-07-29-arcade-claw-design.md](../specs/2026-07-29-arcade-claw-design.md)

## Global Constraints

- 의존은 `data → systems → ui` 단방향. systems는 DOM을 모른다.
- 새 트윗 속성(`AttributeId`)을 만들지 않는다. 자랑 트윗은 기존 `daily`를 쓴다.
- 새 CSS 클래스를 최소화한다. 도감은 기존 `ach-progress`/`ach-list`/`ach-row`를 재사용한다.
- 인형 id는 전부 `doll_` 프리픽스.
- 한 방문에 인형은 최대 1개. 뽑는 순간 판이 끝난다.
- 인형 판매는 **즉시 정산**한다(기존 피망마켓 판매 규칙과 동일).
- 도감 1호기(`state.dolls`)는 판매로 사라지지 않는다. 판매는 `state.dollStock`만 차감한다.
- 뽑기는 시간(`advanceTime`)을 소모하지 않는다.
- 테스트는 `npx vitest run --pool=forks`로 돌린다(기본 pool은 간헐 오탐).
- 대용량 파일(`styles/main.css`, `ui/sns/snsPages.ts`, `core/types.ts`)은 통째로 읽지 말고 Grep으로 좁혀 offset/limit로 읽는다.

---

### Task 1: 인형 카탈로그 (`data/arcade.ts`)

**Files:**
- Create: `src/data/arcade.ts`
- Test: `src/__tests__/arcade.test.ts`

**Interfaces:**
- Consumes: 없음(순수 데이터)
- Produces:
  - `export interface Doll { id: string; name: string; emoji: string; rarity: "common" | "rare"; desc: string; brag: string; resale: number }`
  - `export const DOLLS: Doll[]` — 12종(common 8 · rare 4)
  - `export const ARCADE_INTRO: string` — 오락실 진입 문구
  - `export const CLAW_MISS_LINES: string[]` — 레인 자체를 놓쳤을 때 문구
  - `export const CLAW_SLIP_LINES: string[]` — 집게 힐이 미끄러졌을 때 문구
  - `export function dollById(id: string): Doll | undefined`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`src/__tests__/arcade.test.ts` 새 파일:

```ts
import { describe, it, expect } from "vitest";
import { DOLLS, dollById } from "@/data/arcade";

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
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: FAIL — `Cannot find module '@/data/arcade'`

- [ ] **Step 3: 카탈로그를 만든다**

`src/data/arcade.ts` 새 파일. 인형 12종은 아래 골격을 그대로 쓰되, `desc`/`brag`는 **한국어 창작**으로 채운다(오락실 인형 특유의 촌스럽고 정겨운 톤 — 크리처 도감처럼 과하게 판타지로 가지 말 것):

```ts
/**
 * 오락실 인형뽑기 경품 카탈로그.
 * 뽑으면 도감(state.dolls)에 등록되고, 중복분은 재고(state.dollStock)로 쌓여 피망마켓에서 팔린다.
 * 도감 수집형이라 트윗 속성(AttributeId) 확장 없음 — 자랑 트윗은 기존 daily를 쓴다.
 *
 * ⚠️ resale은 뽑기 기대비용(약 3,600원/개)보다 낮게 잡는다.
 *    시세를 올리면 인형뽑기가 돈 버는 루프가 되어 경제가 깨진다.
 */
export interface Doll {
  id: string;
  name: string;
  emoji: string;
  rarity: "common" | "rare";
  /** 도감 설명(2~3문장) */
  desc: string;
  /** 뽑은 직후 올리는 자랑 트윗 본문 */
  brag: string;
  /** 피망마켓 중고 시세(원) */
  resale: number;
}

export const DOLLS: Doll[] = [
  // ── 일반 8종 (시세 3,000~6,000)
  { id: "doll_bear", name: "촌스러운 곰인형", emoji: "🧸", rarity: "common", desc: "...", brag: "...", resale: 4_000 },
  // ... 나머지 7종
  // ── 레어 4종 (시세 20,000~45,000)
  // ... 4종
];

export const ARCADE_INTRO = "...";
export const CLAW_MISS_LINES: string[] = [ /* 4개 이상 */ ];
export const CLAW_SLIP_LINES: string[] = [ /* 4개 이상 */ ];

export function dollById(id: string): Doll | undefined {
  return DOLLS.find((d) => d.id === id);
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: PASS (5 tests)

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/data/arcade.ts src/__tests__/arcade.test.ts
git commit -m "feat(data): 오락실 인형 카탈로그 12종"
```

---

### Task 2: 상태 필드 (`core/types.ts` · `core/state.ts` · `systems/save.ts`)

**Files:**
- Modify: `src/core/types.ts` (`cookedDishes` 선언 바로 아래)
- Modify: `src/core/state.ts` (`cookedDishes: []` 바로 아래)
- Modify: `src/systems/save.ts` (`state.pets ??=` 근처)
- Test: `src/__tests__/arcade.test.ts` (추가)

**Interfaces:**
- Consumes: 없음
- Produces: `GameState.dolls: string[]`, `GameState.dollStock: Record<string, number>`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

`src/__tests__/arcade.test.ts` 상단 import에 추가:

```ts
import { createInitialState } from "@/core/state";
import { migrateSave } from "@/systems/save";
```

⚠️ `migrateSave`의 실제 export 이름을 먼저 확인하라: `grep -n "^export function" src/systems/save.ts`.
이름이 다르면 그 이름을 쓴다.

파일 끝에 추가:

```ts
describe("인형 상태 필드", () => {
  it("초기 상태에 빈 도감과 빈 재고가 있다", () => {
    const s = createInitialState();
    expect(s.dolls).toEqual([]);
    expect(s.dollStock).toEqual({});
  });

  it("구버전 세이브에 기본값을 주입한다", () => {
    const s = createInitialState();
    delete (s as Partial<typeof s>).dolls;
    delete (s as Partial<typeof s>).dollStock;
    migrateSave(s);
    expect(s.dolls).toEqual([]);
    expect(s.dollStock).toEqual({});
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: FAIL — `dolls`가 타입에 없거나 `undefined`

- [ ] **Step 3: 세 파일을 고친다**

`src/core/types.ts` — `cookedDishes: string[];` 선언 **바로 아래**:

```ts
  /** 오락실 인형뽑기로 도감에 등록한 인형 id 목록(data/arcade.ts의 DOLLS 참조) */
  dolls: string[];
  /**
   * 도감 1호기를 제외한 여분 재고(중복 뽑기분). 피망마켓 판매 대상.
   * ⚠️ 판매는 이 재고만 차감한다 — dolls(도감)는 절대 비우지 않는다.
   */
  dollStock: Record<string, number>;
```

`src/core/state.ts` — `cookedDishes: [],` **바로 아래**:

```ts
    dolls: [],
    dollStock: {},
```

`src/systems/save.ts` — `state.pets ??= { dog: false, cat: false };` 근처:

```ts
  state.dolls ??= [];
  state.dollStock ??= {};
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: PASS (7 tests)

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/core/types.ts src/core/state.ts src/systems/save.ts src/__tests__/arcade.test.ts
git commit -m "feat(core): 인형 도감·재고 상태 필드"
```

---

### Task 3: 뽑기 판정과 도감 등록 (`systems/arcade.ts`)

**Files:**
- Create: `src/systems/arcade.ts`
- Test: `src/__tests__/arcade.test.ts` (추가)

**Interfaces:**
- Consumes: `DOLLS`, `dollById`, `CLAW_MISS_LINES`, `CLAW_SLIP_LINES` (Task 1) · `GameState.dolls`, `GameState.dollStock` (Task 2)
- Produces:
  - `export const CLAW_COST = 1_000`
  - `export const RARE_BAND = 0.06` · `export const COMMON_BAND = 0.18`
  - `export const HOOK_SLIP_RARE = 0.55` · `export const HOOK_SLIP_COMMON = 0.3`
  - `export const DOLL_FIRST_MENTAL = 3` · `export const DEX_COMPLETE_MENTAL = 15` · `export const DEX_COMPLETE_CREATIVITY = 60`
  - `export function laneAt(pos: number): "rare" | "common" | "miss"`
  - `export interface ClawResult { outcome: "win" | "slip" | "miss"; line: string; doll: Doll | null; duplicate: boolean; mental: number; completed: boolean }`
  - `export function playClaw(state: GameState, pos: number): ClawResult`
  - `export function dollCount(state: GameState): number` · `export const DOLL_TOTAL: number`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

import에 추가:

```ts
import {
  laneAt, playClaw, CLAW_COST, RARE_BAND, COMMON_BAND, DOLL_TOTAL, DOLL_FIRST_MENTAL,
} from "@/systems/arcade";
```

(`DOLLS`는 Task 1에서 이미 import했다.)

파일 끝에 추가:

```ts
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
    playClaw(s, 0);  // 꽝 위치
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
    Math.random = () => 0;  // 슬립 판정 통과(0 < HOOK_SLIP_*)
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
    Math.random = () => 0.99;  // 슬립 회피
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
      // 레어 풀이 하나 남을 때까지 다른 레어를 전부 도감에 채운다
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
    // 레어 하나만 남기고 전부 도감에 채운다(레어 레인을 노려 그 하나를 마저 뽑는다).
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
      // 이미 전종을 채웠으니 다음 판은 중복이고 완성 보너스가 다시 붙지 않는다.
      const again = playClaw(s, 0.5);
      expect(again.completed).toBe(false);
      expect(again.duplicate).toBe(true);
    } finally {
      Math.random = orig;
    }
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: FAIL — `Cannot find module '@/systems/arcade'`

- [ ] **Step 3: systems를 만든다**

`src/systems/arcade.ts` 새 파일:

```ts
import type { GameState } from "@/core/types";
import type { Doll } from "@/data/arcade";
import { CLAW_MISS_LINES, CLAW_SLIP_LINES, DOLLS, dollById } from "@/data/arcade";
import { clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 오락실 인형뽑기 — 외출 중 확률 조우로 진입한다.
 *
 * ⚠️ **한 방문 = 인형 1개**가 이 기능의 밸런스 축이다.
 *    판이 끝나는 판정은 ui가 한다(win이면 세션 종료) — systems는 판 하나만 계산한다.
 *    상한을 풀면 12종 수집이 소지금 문제로 바뀌어 도감이 하루만에 끝난다.
 *
 * ⚠️ 뽑기는 시간(advanceTime)을 소모하지 않는다. 외출 1블록 안에서 벌어지는 일이다.
 *
 * 순수 로직: DOM/표시 없음. 결과는 값으로 반환하고 표시는 ui가 맡는다.
 */

/** 1판 비용(원) */
export const CLAW_COST = 1_000;

/** 중앙에서 이 폭 안이면 레어 레인 */
export const RARE_BAND = 0.06;
/** 중앙에서 이 폭 안이면 일반 레인(레어 밴드 바깥부터) */
export const COMMON_BAND = 0.18;

/** 집게 힐이 미끄러질 확률 — 레어일수록 높다 */
export const HOOK_SLIP_RARE = 0.55;
export const HOOK_SLIP_COMMON = 0.3;

/** 처음 뽑은 인형 1종당 회복하는 정신력 */
export const DOLL_FIRST_MENTAL = 3;
/** 도감을 전부 채웠을 때 1회 보너스(요리 도감과 같은 값) */
export const DEX_COMPLETE_MENTAL = 15;
export const DEX_COMPLETE_CREATIVITY = 60;

/** 도감 전체 종수 */
export const DOLL_TOTAL = DOLLS.length;

/** 도감에 등록된 종수 */
export function dollCount(state: GameState): number {
  return state.dolls.length;
}

/** 마커 위치(0~1)가 어느 레인에 걸리는지 */
export function laneAt(pos: number): "rare" | "common" | "miss" {
  const d = Math.abs(pos - 0.5);
  if (d <= RARE_BAND) return "rare";
  if (d <= COMMON_BAND) return "common";
  return "miss";
}

/** 한 판의 결과 */
export interface ClawResult {
  /** win=인형 획득(판 종료) / slip=집게가 놓침 / miss=레인 자체를 놓침 */
  outcome: "win" | "slip" | "miss";
  /** 결과 문구 */
  line: string;
  /** 획득한 인형. win이 아니면 null */
  doll: Doll | null;
  /** 이미 도감에 있어 재고로 갔는지 */
  duplicate: boolean;
  /** 이번 판으로 회복한 정신력(완성 보너스 포함) */
  mental: number;
  /** 이 등록으로 전종을 채웠는지 */
  completed: boolean;
}

/**
 * 한 판을 굴린다. 비용은 언제나 먼저 빠진다(꽝이어도 돈은 나간다 — 오락실이다).
 * ⚠️ 호출 전에 소지금이 CLAW_COST 이상인지 ui가 확인해야 한다.
 */
export function playClaw(state: GameState, pos: number): ClawResult {
  state.money -= CLAW_COST;

  const lane = laneAt(pos);
  if (lane === "miss") {
    return { outcome: "miss", line: pick(CLAW_MISS_LINES), doll: null, duplicate: false, mental: 0, completed: false };
  }

  const slipChance = lane === "rare" ? HOOK_SLIP_RARE : HOOK_SLIP_COMMON;
  if (Math.random() < slipChance) {
    return { outcome: "slip", line: pick(CLAW_SLIP_LINES), doll: null, duplicate: false, mental: 0, completed: false };
  }

  // 같은 등급 안에서 미수집 우선으로 고른다. 전부 모았으면 등급 전체에서 뽑아 재고로 쌓는다.
  const pool = DOLLS.filter((d) => d.rarity === lane);
  const fresh = pool.filter((d) => !state.dolls.includes(d.id));
  const doll = pick(fresh.length > 0 ? fresh : pool);

  const duplicate = state.dolls.includes(doll.id);
  let mental = 0;
  let completed = false;

  if (duplicate) {
    state.dollStock[doll.id] = (state.dollStock[doll.id] ?? 0) + 1;
    addSchedule(state, `인형뽑기: ${doll.name} (중복 — 서랍행)`, "system");
  } else {
    state.dolls.push(doll.id);
    state.resources.mental = clampResource(state.resources.mental + DOLL_FIRST_MENTAL);
    mental = DOLL_FIRST_MENTAL;
    addSchedule(state, `인형 도감 등록: ${doll.name}`, "system");

    if (state.dolls.length >= DOLL_TOTAL) {
      completed = true;
      state.resources.mental = clampResource(state.resources.mental + DEX_COMPLETE_MENTAL);
      mental += DEX_COMPLETE_MENTAL;
      gainSkill(state, "creativity", DEX_COMPLETE_CREATIVITY);
      addSchedule(state, `인형 도감 완성! (${DOLL_TOTAL}종)`, "system");
    }
  }

  return { outcome: "win", line: `${doll.emoji} ${doll.name}을(를) 뽑았다!`, doll, duplicate, mental, completed };
}
```

⚠️ `pick`의 실제 경로를 확인하라: `grep -n "import { pick" src/systems/offline.ts`.
⚠️ `addSchedule`의 두 번째 인자로 `"system"`이 유효한지 확인하라: `grep -n "export function addSchedule" -A 5 src/systems/time.ts`.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: PASS (15 tests)

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/systems/arcade.ts src/__tests__/arcade.test.ts
git commit -m "feat(systems): 인형뽑기 레인 판정·힐 슬립·도감 등록"
```

---

### Task 4: 인형 판매 (`systems/arcade.ts` 추가)

**Files:**
- Modify: `src/systems/arcade.ts` (파일 끝에 추가)
- Test: `src/__tests__/arcade.test.ts` (추가)

**Interfaces:**
- Consumes: `state.dollStock` (Task 2), `dollById` (Task 1)
- Produces:
  - `export interface StockedDoll { doll: Doll; count: number }`
  - `export function stockedDolls(state: GameState): StockedDoll[]`
  - `export function sellDoll(state: GameState, dollId: string): number` — 입금액 반환, 재고 없으면 0

- [ ] **Step 1: 실패하는 테스트를 추가한다**

import에 `stockedDolls, sellDoll` 추가. 파일 끝에:

```ts
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
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: FAIL — `stockedDolls is not a function`

- [ ] **Step 3: 판매 함수를 추가한다**

`src/systems/arcade.ts` 끝에:

```ts
/** 피망마켓 판매 목록에 뜨는 재고 한 줄 */
export interface StockedDoll {
  doll: Doll;
  count: number;
}

/** 재고가 1개 이상인 인형만 카탈로그 순서로 반환한다 */
export function stockedDolls(state: GameState): StockedDoll[] {
  const out: StockedDoll[] = [];
  for (const doll of DOLLS) {
    const count = state.dollStock[doll.id] ?? 0;
    if (count > 0) out.push({ doll, count });
  }
  return out;
}

/**
 * 인형 재고 1개를 피망마켓에 판다(즉시 정산 — 기존 서랍장 판매와 같은 규칙).
 * ⚠️ dolls(도감 1호기)는 절대 건드리지 않는다. 재고만 차감한다.
 * 재고가 없으면 아무 일도 하지 않고 0을 반환한다.
 */
export function sellDoll(state: GameState, dollId: string): number {
  const count = state.dollStock[dollId] ?? 0;
  if (count <= 0) return 0;
  const doll = dollById(dollId);
  if (!doll) return 0;

  if (count === 1) delete state.dollStock[dollId];
  else state.dollStock[dollId] = count - 1;

  state.money += doll.resale;
  addSchedule(state, `피망마켓: ${doll.name} 판매 (+${doll.resale.toLocaleString()}원)`, "system");
  return doll.resale;
}
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: PASS (20 tests)

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 5: 커밋**

```bash
git add src/systems/arcade.ts src/__tests__/arcade.test.ts
git commit -m "feat(systems): 인형 재고 피망마켓 즉시 판매"
```

---

### Task 5: 외출 중 오락실 조우 (`systems/offline.ts`)

**Files:**
- Modify: `src/systems/offline.ts` (`OfflineOutcome` 인터페이스 · 조우 체인 · return 블록)
- Test: `src/__tests__/arcade.test.ts` (추가)

**Interfaces:**
- Consumes: 없음
- Produces: `OfflineOutcome.arcadeEncounter: boolean` · `export const ARCADE_ENCOUNTER_CHANCE = 0.25`

- [ ] **Step 1: 실패하는 테스트를 추가한다**

```ts
import { OFFLINE_ACTIVITIES, ARCADE_ENCOUNTER_CHANCE } from "@/systems/offline";

describe("오락실 조우", () => {
  it("확률 상수가 0과 1 사이다", () => {
    expect(ARCADE_ENCOUNTER_CHANCE).toBeGreaterThan(0);
    expect(ARCADE_ENCOUNTER_CHANCE).toBeLessThan(1);
  });

  it("외출 활동이 존재한다(조우가 붙는 자리)", () => {
    expect(OFFLINE_ACTIVITIES.find((a) => a.id === "goout")).toBeDefined();
  });
});
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: FAIL — `ARCADE_ENCOUNTER_CHANCE` export 없음

- [ ] **Step 3: offline.ts를 고친다**

(1) 상수 — `CREATURE_ENCOUNTER_CHANCE` 선언 근처에 추가:

```ts
/**
 * 외출 중 오락실을 만날 확률.
 * ⚠️ 한 방문에 인형 1개 상한이 있어 이 확률이 곧 인형 수집 속도다.
 *    올리면 12종 도감이 순식간에 끝난다.
 */
export const ARCADE_ENCOUNTER_CHANCE = 0.25;
```

(2) `OfflineOutcome` 인터페이스 — `creatureEncounter: string | null;` 아래:

```ts
  /**
   * 외출 중 오락실을 만났는지. 펫·크리처·성인 조우와 배타(한 턴에 이벤트는 하나).
   * ui가 결과 팝업을 닫은 뒤 인형뽑기 모달을 띄운다.
   */
  arcadeEncounter: boolean;
```

(3) 조우 체인 — 크리처 조우 블록(`let creatureEncounter` 블록) **바로 아래**:

```ts
  // 오락실: 외출(goout) 전용. 다른 조우가 하나도 안 떴을 때만 낮은 확률로 만난다.
  // (산책은 펫·크리처 담당이라 activity.id로 갈라 서로 겹치지 않게 한다.)
  let arcadeEncounter = false;
  if (
    activity.id === "goout" &&
    !petEncounter &&
    !creatureEncounter &&
    !blackVanEncounter &&
    !wallHoleEncounter &&
    !nudeExposure &&
    !adultEncounter &&
    Math.random() < ARCADE_ENCOUNTER_CHANCE
  ) {
    arcadeEncounter = true;
  }
```

(4) return 블록 — `creatureEncounter,` 아래에 `arcadeEncounter,` 추가.

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/arcade.test.ts`
Expected: PASS (22 tests)

Run: `npm run typecheck`
Expected: 에러 없음 — `OfflineOutcome`을 만드는 다른 자리가 있으면 여기서 드러난다. 있으면 `arcadeEncounter: false`를 채운다.

- [ ] **Step 5: 커밋**

```bash
git add src/systems/offline.ts src/__tests__/arcade.test.ts
git commit -m "feat(systems): 외출 중 오락실 조우"
```

---

### Task 6: 인형 도감 화면 (`ui/dollDexModal.ts`)

**Files:**
- Create: `src/ui/dollDexModal.ts`
- Modify: `src/ui/statusPopup.ts` (크리처 도감 버튼 근처)

**Interfaces:**
- Consumes: `DOLLS` (Task 1), `state.dolls`/`state.dollStock` (Task 2)
- Produces: `export function renderDollDexModal(ctx: GameContext): HTMLElement`

- [ ] **Step 1: 도감 화면을 만든다**

`src/ui/dollDexModal.ts` 새 파일 — 크리처 도감(`ui/creaturesModal.ts`)과 **같은 그릇**을 쓴다. 새 CSS 클래스를 만들지 않는다:

```ts
import type { GameContext } from "./context";
import { DOLLS } from "@/data/arcade";
import { el } from "@/utils/dom";

/**
 * 인형 도감 화면(크리처·요리 도감과 같은 그릇 — ach-* 클래스 재사용).
 * 수집 판정은 systems/arcade.ts가 끝냈고(state.dolls), 여기선 현황만 보여준다.
 * 미수집 인형은 이름·설명을 가리되 **등급은 보여준다** — 어느 레인을 노려야 하는지가 힌트다.
 */
export function renderDollDexModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const got = new Set(s.dolls);
  const n = DOLLS.filter((d) => got.has(d.id)).length;
  const total = DOLLS.length;
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🧸 인형 도감"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "ach-progress" },
        el("span", { class: "ach-progress__count" }, `${n} / ${total}`),
        el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
      ),
      el(
        "div",
        { class: "ach-list" },
        ...DOLLS.map((d) => {
          const has = got.has(d.id);
          const stock = s.dollStock[d.id] ?? 0;
          const grade = d.rarity === "rare" ? "레어" : "일반";
          return el(
            "div",
            { class: "ach-row" + (has ? "" : " ach-row--locked") },
            el("span", { class: "ach-row__emoji" }, has ? d.emoji : "❓"),
            el(
              "div",
              { class: "ach-row__copy" },
              el(
                "div",
                { class: "ach-row__name" },
                has ? d.name : "???",
                stock > 0 ? el("span", { class: "inv-row__count" }, `여분 ×${stock}`) : null,
              ),
              el("div", { class: "ach-row__desc" }, has ? d.desc : `${grade} 인형`),
            ),
          );
        }),
      ),
    ),
  );
}
```

- [ ] **Step 2: 스테이터스 팝업에 진입 버튼을 단다**

`src/ui/statusPopup.ts`에서 크리처 도감 버튼을 찾는다:

Run: `grep -n "renderCreaturesModal" src/ui/statusPopup.ts`

그 버튼 **바로 아래**에 같은 모양의 버튼을 추가한다(주변 코드의 클래스·구조를 그대로 따를 것):

```ts
import { renderDollDexModal } from "./dollDexModal";
```

버튼(주변 버튼과 같은 class를 쓴다):

```ts
el("button", { class: /* 크리처 버튼과 동일 */, onclick: () => ctx.openModal(renderDollDexModal) }, "🧸 인형 도감"),
```

- [ ] **Step 3: 타입 체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/ui/dollDexModal.ts src/ui/statusPopup.ts
git commit -m "feat(ui): 인형 도감 화면"
```

---

### Task 7: 인형뽑기 미니게임 모달 (`ui/arcadeModal.ts`)

**Files:**
- Create: `src/ui/arcadeModal.ts`
- Modify: `src/styles/main.css` (파일 끝에 `.claw-*` 블록 추가)

**Interfaces:**
- Consumes: `playClaw`, `CLAW_COST`, `ClawResult` (Task 3) · `ARCADE_INTRO` (Task 1) · `renderDollDexModal` (Task 6)
- Produces: `export function renderArcadeModal(ctx: GameContext): HTMLElement`

- [ ] **Step 1: 미니게임 모달을 만든다**

`src/ui/arcadeModal.ts` 새 파일:

```ts
import type { GameContext } from "./context";
import { ARCADE_INTRO } from "@/data/arcade";
import { CLAW_COST, playClaw, type ClawResult } from "@/systems/arcade";
import { postTweet } from "@/systems/tweetSystem";
import { renderDollDexModal } from "./dollDexModal";
import { el, formatNumber } from "@/utils/dom";

/**
 * 오락실 인형뽑기 — 외출 조우로만 진입한다.
 *
 * ⚠️ **인형을 뽑으면 그 판이 끝난다.** 꽝·슬립일 때만 계속 시도할 수 있다.
 *    이 상한이 밸런스 축이라 "한 번 더" 버튼을 win 뒤에 다시 띄우면 안 된다.
 *
 * 마커는 requestAnimationFrame으로 좌우 왕복하고, 클릭 시점의 위치(0~1)를 systems에 넘긴다.
 * 판정은 전부 systems/arcade.ts가 한다 — 여기선 위치만 만든다.
 */

/** 마커가 한쪽 끝에서 반대쪽 끝까지 가는 데 걸리는 시간(ms) */
const SWEEP_MS = 1_400;

export function renderArcadeModal(ctx: GameContext): HTMLElement {
  const marker = el("div", { class: "claw__marker" });
  const status = el("p", { class: "claw__status" }, ARCADE_INTRO);
  const actions = el("div", { class: "claw__actions" });

  let raf = 0;
  let running = false;
  let pos = 0;

  /** 애니메이션을 멈춘다(판 종료·모달 닫힘 공통) */
  const stopSweep = (): void => {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  };

  const startSweep = (): void => {
    running = true;
    const t0 = performance.now();
    const step = (now: number): void => {
      if (!running) return;
      // 삼각파: 0→1→0 왕복
      const phase = ((now - t0) % (SWEEP_MS * 2)) / SWEEP_MS;
      pos = phase <= 1 ? phase : 2 - phase;
      marker.style.left = `${pos * 100}%`;
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
  };

  /** 버튼 줄을 통째로 다시 그린다 */
  const setActions = (...children: (HTMLElement | null)[]): void => {
    actions.replaceChildren(...children.filter((c): c is HTMLElement => c !== null));
  };

  const leave = (): void => {
    stopSweep();
    ctx.closeModal();
    ctx.afterAction("offline");
  };

  /** 뽑기 성공 — 판을 끝내고 자랑 트윗 기회를 준다 */
  const showWin = (r: ClawResult): void => {
    stopSweep();
    const doll = r.doll!;
    const parts = [r.line];
    if (r.duplicate) parts.push("이미 있는 인형이라 서랍에 넣었다. 피망마켓에 팔 수 있다.");
    if (r.mental > 0) parts.push(`정신력 +${r.mental}`);
    if (r.completed) parts.push("인형 도감 완성! 창작이 크게 올랐다.");
    parts.push("오늘은 여기까지. 인형을 안고 오락실을 나왔다.");
    status.textContent = parts.join(" ");

    setActions(
      el(
        "button",
        {
          class: "btn btn--primary",
          onclick: () => {
            ctx.update((s) => {
              postTweet(s, "daily", doll.brag, false);
            });
            ctx.toast("자랑 트윗을 올렸어요");
            leave();
          },
        },
        "자랑 트윗 올리기",
      ),
      el("button", { class: "btn", onclick: () => ctx.openModal(renderDollDexModal) }, "도감 보기"),
      el("button", { class: "btn", onclick: leave }, "나가기"),
    );
  };

  /** 한 판 굴리기 */
  const tryOnce = (): void => {
    const s = ctx.store.getState();
    if (s.money < CLAW_COST) {
      status.textContent = `돈이 없다. 한 판에 ${formatNumber(CLAW_COST)}원은 있어야 한다.`;
      return;
    }
    const at = pos;
    stopSweep();

    let result: ClawResult | null = null;
    ctx.update((st) => {
      result = playClaw(st, at);
    });
    const r = result as ClawResult | null;
    if (!r) return;

    if (r.outcome === "win") {
      showWin(r);
      return;
    }
    // 꽝·슬립 — 계속 시도할 수 있다
    status.textContent = r.line;
    renderIdle();
  };

  /** 다음 판을 기다리는 상태 */
  const renderIdle = (): void => {
    startSweep();
    setActions(
      el("button", { class: "btn btn--primary", onclick: tryOnce }, `멈춰! (${formatNumber(CLAW_COST)}원)`),
      el("button", { class: "btn", onclick: () => ctx.openModal(renderDollDexModal) }, "도감"),
      el("button", { class: "btn", onclick: leave }, "그만하기"),
    );
  };

  renderIdle();

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🕹️ 오락실 인형뽑기"),
      el("button", { class: "popup__close", onclick: leave }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "claw__rail" },
        el("div", { class: "claw__zone claw__zone--common" }),
        el("div", { class: "claw__zone claw__zone--rare" }),
        marker,
      ),
      el("p", { class: "compose-hint" }, "가운데로 갈수록 좋은 인형이에요. 집게가 약하니 놓칠 수도 있어요."),
      status,
      actions,
    ),
  );
}
```

⚠️ 확인할 것:
- `ctx.afterAction("offline")`의 실제 시그니처: `grep -n "afterAction" src/ui/context.ts`
- `postTweet`의 인자 순서(`state, attr, text, isAdult`)가 맞는지: `grep -n "export function postTweet" -A 10 src/systems/tweetSystem.ts`
- `formatNumber`가 `@/utils/dom`에서 나오는지: `grep -n "formatNumber" src/ui/peemang.ts | head -2`
- 버튼 클래스 `btn btn--primary`가 이 코드베이스의 관례인지: `grep -n "btn--primary" src/ui/offlineModal.ts | head -3`. 다르면 주변 관례를 따른다.

- [ ] **Step 2: CSS를 추가한다**

먼저 유사 클래스를 찾는다: `grep -n "bar__fill\|\.bar {" src/styles/main.css | head -5`

`src/styles/main.css` 끝에 추가:

```css
/* ── 오락실 인형뽑기 레일 (ui/arcadeModal.ts) ── */
.claw__rail {
  position: relative;
  height: 34px;
  margin: 14px 0 10px;
  border-radius: 8px;
  background: #1b1b2a;
  overflow: hidden;
}
.claw__zone {
  position: absolute;
  top: 0;
  bottom: 0;
  transform: translateX(-50%);
}
/* COMMON_BAND=0.18 → 폭 36%, RARE_BAND=0.06 → 폭 12% (systems/arcade.ts와 값을 맞출 것) */
.claw__zone--common {
  left: 50%;
  width: 36%;
  background: rgba(120, 180, 255, 0.22);
}
.claw__zone--rare {
  left: 50%;
  width: 12%;
  background: rgba(255, 205, 90, 0.4);
}
.claw__marker {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 3px;
  margin-left: -1.5px;
  background: #fff;
  box-shadow: 0 0 6px rgba(255, 255, 255, 0.8);
}
.claw__status {
  margin: 10px 0 14px;
  min-height: 3em;
  line-height: 1.6;
}
.claw__actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}
```

- [ ] **Step 3: 타입 체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 4: 커밋**

```bash
git add src/ui/arcadeModal.ts src/styles/main.css
git commit -m "feat(ui): 인형뽑기 타이밍 미니게임 모달"
```

---

### Task 8: 외출 결과에서 오락실 진입 (`ui/offlineModal.ts`)

**Files:**
- Modify: `src/ui/offlineModal.ts` (결과 분기 — 약 820~845행)

**Interfaces:**
- Consumes: `outcome.arcadeEncounter` (Task 5) · `renderArcadeModal` (Task 7)
- Produces: 없음

- [ ] **Step 1: 분기를 추가한다**

`src/ui/offlineModal.ts` 상단 import에 추가:

```ts
import { renderArcadeModal } from "./arcadeModal";
```

결과 분기에서 **`outcome.offer` 분기 바로 위**에 넣는다(성인 이벤트 분기 아래):

```ts
    // 오락실 조우 — 성인 이벤트·offer와 같은 흐름. 스탯 안내를 먼저 보이고,
    // 확인하면 인형뽑기 모달로 넘긴다(결과 문구와 미니게임을 한 창에 섞지 않는다).
    if (outcome.arcadeEncounter) {
      showStatusNotice(act, outcome, () => ctx.openModal(renderArcadeModal));
      return;
    }
```

⚠️ `showStatusNotice`의 두 번째 인자가 콜백인지 확인하라:
`grep -n "showStatusNotice" -A 6 src/ui/offlineModal.ts | head -20`

- [ ] **Step 2: 타입 체크와 전체 테스트**

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npx vitest run --pool=forks`
Expected: 전부 통과(기존 테스트 포함)

- [ ] **Step 3: 커밋**

```bash
git add src/ui/offlineModal.ts
git commit -m "feat(ui): 외출 결과에서 오락실 진입"
```

---

### Task 9: 피망마켓 인형 판매 구역 (`ui/peemang.ts`)

**Files:**
- Modify: `src/ui/peemang.ts` (판매 pane — 약 180~190행)

**Interfaces:**
- Consumes: `stockedDolls`, `sellDoll` (Task 4)
- Produces: 없음

- [ ] **Step 1: 판매 pane에 인형 구역을 붙인다**

`src/ui/peemang.ts` import에 추가:

```ts
import { sellDoll, stockedDolls } from "@/systems/arcade";
```

판매 pane(`inventoryList(ctx, true)`가 있는 블록)에서 그 아래에 인형 구역을 덧붙인다.
현재 구조는 `el("div", { class: "pm__pane" }, el("p", ...), inventoryList(ctx, true))`이므로
세 번째 자식 뒤에 하나를 더 넣는다:

```ts
          inventoryList(ctx, true),
          dollSellSection(ctx),
```

파일에 헬퍼를 추가한다(`renderPeemang` **위**에):

```ts
/**
 * 인형 재고 판매 구역 — 오락실에서 중복으로 뽑은 인형을 판다.
 * 도감 1호기는 여기 안 나온다(systems/arcade.ts가 재고만 노출한다).
 * 서랍장과 같은 즉시 정산이라 별도 대기 개념이 없다.
 */
function dollSellSection(ctx: GameContext): HTMLElement | null {
  const stock = stockedDolls(ctx.store.getState());
  if (stock.length === 0) return null;

  return el(
    "div",
    { class: "pm__dolls" },
    el("p", { class: "compose-hint", style: "margin:18px 0 10px" }, "오락실에서 중복으로 뽑은 인형이에요. 도감에 등록된 첫 개는 그대로 남습니다."),
    el(
      "div",
      { class: "inv-list" },
      ...stock.map(({ doll, count }) =>
        el(
          "div",
          { class: "inv-row" },
          el(
            "div",
            { class: "inv-row__copy" },
            el(
              "div",
              { class: "inv-row__name" },
              `${doll.emoji} ${doll.name}`,
              count > 1 ? el("span", { class: "inv-row__count" }, `×${count}`) : null,
            ),
            el("div", { class: "inv-row__desc" }, doll.desc),
          ),
          el(
            "button",
            {
              class: "inv-row__sell",
              onclick: () => {
                let paid = 0;
                ctx.update((s) => {
                  paid = sellDoll(s, doll.id);
                });
                if (paid > 0) ctx.toast(`${doll.name}을(를) ${formatNumber(paid)}원에 팔았어요`);
              },
            },
            el("span", {}, `${formatNumber(doll.resale)}원에 팔기`),
          ),
        ),
      ),
    ),
  );
}
```

⚠️ `el()`이 `null` 자식을 허용하는지 확인하라(`inventoryList`가 이미 `: null`을 쓰고 있으니 허용된다).
⚠️ `ctx.update` 후 화면이 다시 그려지는지 확인하라 — 안 그려지면 주변 코드가 쓰는 갱신 방식(`ctx.refresh()` 등)을 따른다: `grep -n "ctx.update\|ctx.refresh" src/ui/peemang.ts`

- [ ] **Step 2: 타입 체크**

Run: `npm run typecheck`
Expected: 에러 없음

- [ ] **Step 3: 커밋**

```bash
git add src/ui/peemang.ts
git commit -m "feat(ui): 피망마켓에서 인형 재고 판매"
```

---

### Task 10: 통합 검증

**Files:**
- 없음(검증만)

- [ ] **Step 1: 전체 테스트**

Run: `npx vitest run --pool=forks`
Expected: 전부 통과

- [ ] **Step 2: 타입 체크와 빌드**

Run: `npm run typecheck`
Expected: 에러 없음

Run: `npm run build`
Expected: 빌드 성공

- [ ] **Step 3: 경계면 교차 확인**

아래를 눈으로 확인한다:
- `OfflineOutcome`을 만드는 **모든** 자리가 `arcadeEncounter`를 채우는가:
  `grep -rn "creatureEncounter:" src/ | grep -v "arcade"` — 나온 자리마다 `arcadeEncounter`가 있어야 한다.
- CSS 존 폭이 systems 상수와 맞는가: `COMMON_BAND=0.18`→`width:36%`, `RARE_BAND=0.06`→`width:12%`
- `DOLLS`의 id가 전부 `doll_` 프리픽스이고 12종인가(Task 1 테스트가 이미 지킨다)

- [ ] **Step 4: 브라우저 실행 확인**

game-run 스킬로 게임을 띄운다. 확인할 것:
1. 현생 → 외출을 여러 번 눌러 오락실 조우가 뜨는가(확률 0.25라 몇 번 걸릴 수 있다)
2. 인형뽑기 모달에서 마커가 좌우로 움직이는가
3. "멈춰!"를 누르면 소지금이 1,000원 줄고 결과 문구가 바뀌는가
4. **인형을 뽑으면 "멈춰!" 버튼이 사라지고 판이 끝나는가** (핵심 규칙)
5. "자랑 트윗 올리기"를 누르면 트윗이 올라가는가
6. 스테이터스 → 인형 도감에 뽑은 인형이 등록됐는가
7. 레일 존(노랑/파랑)과 마커가 화면에서 어긋나 보이지 않는가

스크린샷은 **인형뽑기 모달과 도감 2장만** 찍는다(이미지는 비싸다).

- [ ] **Step 5: 계획서 체크박스를 전부 갱신하고 커밋**

```bash
git add docs/superpowers/plans/2026-07-29-arcade-claw.md
git commit -m "docs: 인형뽑기 구현 계획 완료 표시"
```
