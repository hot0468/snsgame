# 갈래 숙련도 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 트윗을 올리는 것 자체가 육성이 되게 한다 — 갈래별 숙련이 쌓여 그 갈래의 도달 배율을 올리고, 게시 직후 결과 화면이 게이지로 그 성장을 보여준다.

**Architecture:** `data/tweetMastery.ts`가 문턱·배율·칭호를 순수 상수/함수로 소유한다. `systems/followers.ts`가 state를 받아 배율을 내고 `calcTweetOutcome`의 곱셈 사슬에 한 항으로 들어간다. `systems/tweetSystem.ts`의 `postTweet`이 게시 1건당 적립하고 문턱 돌파를 결과에 실어 보낸다. `ui/sns/tweetResultModal.ts`(신규)가 그 결과를 게이지로 그린다. `data → systems → ui` 단방향 의존을 그대로 지킨다.

**Tech Stack:** TypeScript + Vite, vitest, 프레임워크 없는 자체 스토어(`core/store.ts`)와 `el`/`mount` DOM 헬퍼(`utils/dom.ts`).

**설계 원문:** [docs/superpowers/specs/2026-08-01-tweet-mastery-design.md](../specs/2026-08-01-tweet-mastery-design.md)

## Global Constraints

- **계층 경계:** `data`는 `systems`/`ui`를 import하지 않는다. `systems`는 `ui`를 import하지 않는다. `ui`는 `systems`를 호출만 한다.
- **vitest는 반드시 `npx vitest run --pool=forks`로 실행한다.** 기본 pool은 간헐적으로 `Cannot read ... 'config'` 오탐을 낸다 — 그 에러가 나면 테스트가 깨진 게 아니다.
- **작업 중엔 파일을 지정해 돌린다**(`npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`). 전체 스위트는 Task 4 마무리에서 1회만.
- **한국어 소스에 PowerShell 일괄 치환을 쓰지 마라.** `Get-Content`가 ANSI 코드페이지로 읽어 한글이 깨진다. 치환은 Edit 도구로.
- **대용량 파일 통째 Read 금지.** `styles/main.css`(약 1.2만 줄)·`ui/sns/composeModal.ts`(847줄)·`core/types.ts`(1338줄)는 Grep으로 위치를 좁힌 뒤 `offset`/`limit`로 그 구간만 읽는다.
- **커밋은 사용자가 지시할 때만 한다.** 각 Task의 커밋 스텝은 지시가 있을 때 쓸 명령을 적어둔 것이다. 지시 없이 커밋하지 마라.
- 밸런스 상수의 **단일 조정점은 `MASTERY_TIER_BONUS` 하나**다. 배율을 다른 곳에서 다시 계산하지 마라.

---

## File Structure

| 파일 | 책임 |
|---|---|
| `src/data/tweetMastery.ts` **신규** | 문턱·tier당 보너스·칭호·등급 오프셋. 순수 상수/함수만. state를 모른다. |
| `src/core/types.ts` (수정) | `GameState.tweetMastery` 필드 선언 |
| `src/core/state.ts` (수정) | 초기값 `{}` |
| `src/systems/save.ts` (수정) | 구세이브 sanitize 폴백 |
| `src/systems/followers.ts` (수정) | state→배율 변환 + `calcTweetOutcome` 곱셈 사슬 1항 |
| `src/systems/tweetSystem.ts` (수정) | 게시당 적립 + `PostTweetResult` 2필드 |
| `src/ui/sns/tweetResultModal.ts` **신규** | 게시 결과 화면(성과·숙련 게이지·승급). 표시 전용, 상태를 바꾸지 않는다. |
| `src/ui/ddeoksang.ts` (수정) | 닫힌 뒤 이어갈 `onNext` 선택 콜백 |
| `src/ui/sns/composeModal.ts` (수정) | 게시 후 결과 모달로 배선 + 카테고리 칩 등급 배지 |
| `src/styles/main.css` (수정) | 결과 화면·게이지 스타일 |
| `src/__tests__/tweetMastery.test.ts` **신규** | Task 1~3 회귀 테스트 |

---

## Task 1: 숙련 데이터와 상태 필드

**Files:**
- Create: `src/data/tweetMastery.ts`
- Modify: `src/core/types.ts` (`animeTweetsPosted: number;` 선언 바로 아래)
- Modify: `src/core/state.ts` (`animeTweetsPosted: 0,` 바로 아래)
- Modify: `src/systems/save.ts` (`state.animeTweetsPosted ??= 0;` 바로 아래)
- Test: `src/__tests__/tweetMastery.test.ts` (신규)

**Interfaces:**
- Consumes: `milestoneGrade(tier: number): string | null` — 기존 `src/data/milestones.ts`
- Produces:
  - `MASTERY_THRESHOLDS: readonly [10, 40, 120, 300]`
  - `MASTERY_TIER_BONUS: number` (0.08)
  - `MASTERY_TITLES: readonly ["입문", "단골", "터줏대감", "전설"]`
  - `masteryTierFor(count: number): number` — 0~4
  - `masteryMulFor(tier: number): number` — 1.0~1.32
  - `masteryNextThreshold(tier: number): number | null`
  - `masteryTitle(tier: number): string | null`
  - `masteryGrade(tier: number): string | null`
  - `GameState.tweetMastery: Partial<Record<AttributeId, number>>`

---

- [x] **Step 1: 실패하는 테스트를 쓴다**

`src/__tests__/tweetMastery.test.ts`를 새로 만든다.

```ts
import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "@/core/state";
import { loadGame } from "@/systems/save";
import {
  MASTERY_THRESHOLDS,
  MASTERY_TIER_BONUS,
  masteryTierFor,
  masteryMulFor,
  masteryNextThreshold,
  masteryTitle,
  masteryGrade,
} from "@/data/tweetMastery";

/**
 * 갈래 숙련도 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 *   ① 문턱 → tier → 배율 변환이 한 공식만 쓴다(배율을 UI가 재계산하면 여기서 어긋난다).
 *   ② 등급 배지의 오프셋(숙련 tier 0=미달 ↔ 마일스톤 등급 0=B)이 한 곳에만 있다.
 *   ③ 구세이브에 tweetMastery가 없어도 {}로 복원된다(undefined가 산술에 들어가면 NaN이
 *      되고 그 NaN이 세이브까지 오염시킨다).
 *   ④ 게시 1건이 그 갈래만 적립하고, 문턱을 넘는 트윗만 승급을 보고한다.
 *
 * ⚠️ 밸런스 값(10/40/120/300 · +8%)을 바꾸면 이 파일의 기대값도 함께 고쳐라.
 *    숫자가 여기 박혀 있는 건 의도다 — 조용한 밸런스 드리프트를 막는 장치다.
 */

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

describe("문턱 → tier", () => {
  it("문턱을 넘을 때마다 tier가 하나씩 오른다", () => {
    expect(masteryTierFor(0)).toBe(0);
    expect(masteryTierFor(9)).toBe(0);
    expect(masteryTierFor(10)).toBe(1);
    expect(masteryTierFor(39)).toBe(1);
    expect(masteryTierFor(40)).toBe(2);
    expect(masteryTierFor(119)).toBe(2);
    expect(masteryTierFor(120)).toBe(3);
    expect(masteryTierFor(299)).toBe(3);
    expect(masteryTierFor(300)).toBe(4);
    expect(masteryTierFor(99999)).toBe(4);
  });

  it("문턱 개수와 칭호 개수가 어긋나지 않는다", () => {
    expect(MASTERY_THRESHOLDS.length).toBe(4);
    expect(masteryTitle(0)).toBeNull();
    expect(masteryTitle(1)).toBe("입문");
    expect(masteryTitle(4)).toBe("전설");
    expect(masteryTitle(5)).toBeNull();
  });

  it("NaN·음수가 들어와도 tier 0으로 떨어진다", () => {
    expect(masteryTierFor(NaN)).toBe(0);
    expect(masteryTierFor(-5)).toBe(0);
  });
});

describe("tier → 배율", () => {
  it("tier당 MASTERY_TIER_BONUS만큼 오르고 만렙은 1.32배다", () => {
    expect(masteryMulFor(0)).toBeCloseTo(1.0, 5);
    expect(masteryMulFor(1)).toBeCloseTo(1 + MASTERY_TIER_BONUS, 5);
    expect(masteryMulFor(4)).toBeCloseTo(1 + MASTERY_TIER_BONUS * 4, 5);
    expect(masteryMulFor(4)).toBeCloseTo(1.32, 5);
  });

  it("음수 tier도 1.0 밑으로 내려가지 않는다", () => {
    expect(masteryMulFor(-1)).toBeCloseTo(1.0, 5);
  });
});

describe("등급 배지 · 다음 문턱", () => {
  it("tier 0은 배지가 없고 1부터 B/A/S/SS다", () => {
    expect(masteryGrade(0)).toBeNull();
    expect(masteryGrade(1)).toBe("B");
    expect(masteryGrade(2)).toBe("A");
    expect(masteryGrade(3)).toBe("S");
    expect(masteryGrade(4)).toBe("SS");
  });

  it("다음 문턱은 tier로 찾고 만렙이면 null이다", () => {
    expect(masteryNextThreshold(0)).toBe(10);
    expect(masteryNextThreshold(3)).toBe(300);
    expect(masteryNextThreshold(4)).toBeNull();
  });
});

describe("구세이브 하위호환", () => {
  it("tweetMastery가 없는 세이브도 {}로 복원된다", () => {
    const legacy: any = createInitialState();
    delete legacy.tweetMastery;
    store[KEY] = JSON.stringify(legacy);
    const loaded = loadGame();
    expect(loaded, "구세이브 로드가 null이면 안 된다").toBeTruthy();
    expect(loaded!.tweetMastery).toEqual({});
    expect(masteryTierFor(loaded!.tweetMastery.daily ?? 0)).toBe(0);
  });

  it("새 게임의 초기 숙련은 빈 객체다", () => {
    expect(createInitialState().tweetMastery).toEqual({});
  });
});
```

- [x] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`
Expected: FAIL — `Failed to resolve import "@/data/tweetMastery"`

- [x] **Step 3: `src/data/tweetMastery.ts`를 만든다**

```ts
import { milestoneGrade } from "./milestones";

/**
 * 갈래 숙련 문턱(그 갈래 게시 누적, 오름차순). 넘긴 개수 = tier.
 *
 * 전체 플레이는 ~150~250 게임일 × 3~4.5 트윗/일 = 450~1100 트윗이다. 그 예산 위에서:
 *   10  — 게임 2~3일차. **첫 성취를 초반에** 준다(육성 피드백이 가장 비어 있던 구간).
 *   40  — 2~3주차.
 *   120 — 중반. 여러 갈래로 분산하는 균형형이 닿는 상한 근처.
 *   300 — 한 갈래에 트윗 60%를 몰아야 닿는다. 특화 플레이 종반 보상.
 *
 * ⚠️ 이 배열을 늘리면 MASTERY_TITLES도 같은 길이로 늘려야 한다
 *    (masteryTitle이 tier-1로 색인하므로 길이가 어긋나면 조용히 null이 된다).
 *    등급 배지(MILESTONE_GRADES)도 길이 4 고정이라 함께 봐야 한다.
 */
export const MASTERY_THRESHOLDS = [10, 40, 120, 300] as const;

/**
 * tier 1당 그 갈래의 도달 배율 증가분. 만렙(tier 4) = ×1.32.
 *
 * ⚠️ **밸런스 단일 조정점.** systems/followers.ts의 기존 레버는
 *    평판 3.3배 · 궁합 2.3배 · 트렌드 1.7배 · 스킬 8배다. 숙련은 만렙조차 1.32라
 *    "한 레버가 판을 흔들면 안 된다"는 그 파일의 원칙 안에 들어간다.
 *    100만 도달이 너무 빨라지면 **다른 곳 말고 이 값만** 낮춰라.
 *
 * 계단식(tier 단위)인 이유: 연속 배율이면 문턱을 넘는 **순간**이 없어져 성취가 되지 않는다.
 * 이 기능의 목적 자체가 그 순간을 만드는 것이다.
 */
export const MASTERY_TIER_BONUS = 0.08;

/**
 * tier 1~4의 칭호. 갈래명과 조합해 쓴다 → "IT계 터줏대감".
 *
 * 갈래별 전용 칭호(23갈래 × 4단계 = 92개)를 쓰지 않는 이유: 공용 4개로도 한국어가
 * 자연스럽게 붙고, 92개를 쓰는 값이 지금은 없다. 밋밋하게 느껴지면 그때 갈래별로 쪼개라.
 */
export const MASTERY_TITLES = ["입문", "단골", "터줏대감", "전설"] as const;

/** 게시 누적 → tier(0~4). 0은 첫 문턱 미달. NaN·음수는 0으로 떨어진다. */
export function masteryTierFor(count: number): number {
  const c = Number.isFinite(count) ? count : 0;
  let tier = 0;
  for (const t of MASTERY_THRESHOLDS) if (c >= t) tier++;
  return tier;
}

/** tier → 도달 배율(1.0 ~ 1.32). 배율을 다른 곳에서 재계산하지 마라. */
export function masteryMulFor(tier: number): number {
  return 1 + MASTERY_TIER_BONUS * Math.max(0, tier);
}

/** tier → 다음 문턱 게시 수(만렙이면 null). 진행 게이지의 분모다. */
export function masteryNextThreshold(tier: number): number | null {
  return MASTERY_THRESHOLDS[tier] ?? null;
}

/** tier → 칭호(0이면 null). */
export function masteryTitle(tier: number): string | null {
  return tier <= 0 ? null : MASTERY_TITLES[tier - 1] ?? null;
}

/**
 * tier → 등급 배지(B/A/S/SS). 스킬 마일스톤의 등급을 그대로 재사용한다.
 *
 * ⚠️ 숙련 tier는 **0이 미달**이라 마일스톤 tier(0=B)보다 1 밀려 있다.
 *    오프셋을 여기 한 곳에서만 처리하라 — UI가 각자 -1을 하면 반드시 한 곳이 어긋난다.
 */
export function masteryGrade(tier: number): string | null {
  return tier <= 0 ? null : milestoneGrade(tier - 1);
}
```

- [x] **Step 4: `core/types.ts`에 필드를 더한다**

Grep으로 `animeTweetsPosted: number;` 선언을 찾아(약 956행) 그 **바로 아래**에 넣는다.

```ts
  /**
   * 갈래별 게시 누적(숙련도). 안 올린 갈래는 키가 없다.
   * 문턱·배율은 data/tweetMastery.ts가, state→배율 변환은 systems/followers.ts가 소유한다.
   */
  tweetMastery: Partial<Record<AttributeId, number>>;
```

- [x] **Step 5: `core/state.ts`에 초기값을 넣는다**

`animeTweetsPosted: 0,` (약 204행) **바로 아래**:

```ts
    tweetMastery: {},
```

- [x] **Step 6: `systems/save.ts`에 폴백을 넣는다**

`state.animeTweetsPosted ??= 0;` (약 229행) **바로 아래**:

```ts
  // 갈래 숙련은 신규 기능 — 구세이브엔 키가 없다(전 갈래 0에서 시작이 정답).
  state.tweetMastery ??= {};
```

- [x] **Step 7: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`
Expected: PASS — 9 tests passed

- [x] **Step 8: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음 (종료 코드 0)

- [x] **Step 9: 커밋 (사용자 지시가 있을 때만)**

```bash
git add src/data/tweetMastery.ts src/core/types.ts src/core/state.ts src/systems/save.ts src/__tests__/tweetMastery.test.ts
git commit -m "feat: 갈래 숙련도 문턱·상태 필드"
```

---

## Task 2: 숙련이 도달 배율에 들어간다

**Files:**
- Modify: `src/systems/followers.ts` (`calcTweetOutcome` 정의 위에 함수 추가 + 216행 `const base = ...` 수정)
- Test: `src/__tests__/tweetMastery.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: `masteryTierFor`, `masteryMulFor` (Task 1) · 기존 `calcTweetOutcome(state, attr, kind)`
- Produces:
  - `masteryCountOf(state: GameState, attr: AttributeId): number`
  - `masteryTier(state: GameState, attr: AttributeId): number`
  - `masteryMul(state: GameState, attr: AttributeId): number`

> **이름 주의:** `masteryCountOf`다(`masteryCount`가 아니다). Task 3의 `PostTweetResult.masteryCount` 필드명과 부딪히지 않게 `Of`를 붙였다.

---

- [x] **Step 1: 실패하는 테스트를 쓴다**

`src/__tests__/tweetMastery.test.ts` 맨 끝에 붙인다. 파일 상단 import에 두 줄을 더한다:

```ts
import { getActiveAccount } from "@/core/state";
import { calcTweetOutcome, masteryMul, masteryTier, masteryCountOf } from "@/systems/followers";
```

```ts
describe("숙련 → 도달 배율", () => {
  it("안 올린 갈래는 배율 1.0이다", () => {
    const s = createInitialState();
    expect(masteryCountOf(s, "daily")).toBe(0);
    expect(masteryTier(s, "daily")).toBe(0);
    expect(masteryMul(s, "daily")).toBeCloseTo(1.0, 5);
  });

  it("숙련이 오른 갈래만 배율이 오른다", () => {
    const s = createInitialState();
    s.tweetMastery.daily = 300;
    expect(masteryMul(s, "daily")).toBeCloseTo(1.32, 5);
    // 옆 갈래는 그대로 — 갈래별로 따로 파야 한다는 게 이 기능의 핵심이다.
    expect(masteryMul(s, "it")).toBeCloseTo(1.0, 5);
  });

  it("숙련 만렙 갈래는 평균 좋아요가 눈에 띄게 높다", () => {
    // calcTweetOutcome은 난수를 쓰므로 200회 평균으로 본다.
    // 팔로워를 키워 reach를 올리는 건 반올림 잡음을 없애기 위해서다(초기 reach는 20뿐).
    const avgLikes = (mastery: number): number => {
      const s = createInitialState();
      getActiveAccount(s).followers = 10_000;
      s.tweetMastery.daily = mastery;
      let sum = 0;
      for (let i = 0; i < 200; i++) sum += calcTweetOutcome(s, "daily", "plain").likes;
      return sum / 200;
    };
    // 이론 격차 1.32배. 표본 200의 오차를 감안해 1.2배로 느슨하게 건다.
    expect(avgLikes(300)).toBeGreaterThan(avgLikes(0) * 1.2);
  });
});
```

- [x] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`
Expected: FAIL — `masteryMul is not a function` (또는 import 해석 실패)

- [x] **Step 3: `systems/followers.ts`에 변환 함수를 넣는다**

파일 상단 import 블록에 더한다:

```ts
import { masteryMulFor, masteryTierFor } from "@/data/tweetMastery";
```

`export function timingMultiplier(...)` 정의 **바로 위**에 넣는다:

```ts
/* ─────────────────── 갈래 숙련 ─────────────────── */

/** 그 갈래의 게시 누적(숙련도). 안 올린 갈래는 0. */
export function masteryCountOf(state: GameState, attr: AttributeId): number {
  return state.tweetMastery?.[attr] ?? 0;
}

/** 그 갈래의 숙련 tier(0~4). */
export function masteryTier(state: GameState, attr: AttributeId): number {
  return masteryTierFor(masteryCountOf(state, attr));
}

/**
 * 갈래 숙련에 따른 도달 배율(1.0 ~ 1.32).
 *
 * ⚠️ calcTweetOutcome에서 **base에** 곱한다(likes 계산 앞). 팔로워에만 곱하면
 *    "반응은 그대론데 팔로워만 다른" 결과가 된다 — timingMul 주석이 경고하는 것과 같은 함정이다.
 * ⚠️ 배율 공식은 data/tweetMastery.ts의 masteryMulFor 하나뿐이다. UI가 표시용으로 재계산하지 말고
 *    이 함수를 불러라.
 */
export function masteryMul(state: GameState, attr: AttributeId): number {
  return masteryMulFor(masteryTier(state, attr));
}
```

- [x] **Step 4: 곱셈 사슬에 한 항을 더한다**

`calcTweetOutcome` 안의 `const base = ...` 한 줄(약 216행)을 고친다.

찾을 것:
```ts
  const base = reach * skillMul * affinityMul * trendMul * timingMul * eff.reachMul;
```

바꿀 것:
```ts
  // 갈래 숙련 배율(1.0~1.32) — 그 갈래를 파온 만큼 도달이 오른다. base에 곱해야
  // 좋아요·RT·팔로워가 함께 움직인다(팔로워에만 곱하면 어긋난다).
  const base =
    reach * skillMul * affinityMul * trendMul * timingMul * eff.reachMul * masteryMul(state, attr);
```

- [x] **Step 5: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`
Expected: PASS — 12 tests passed

- [x] **Step 6: 기존 트윗 밸런스 테스트가 안 깨졌는지 본다**

Run: `npx vitest run --pool=forks src/__tests__/tweetBalance.test.ts src/__tests__/tweetKinds.test.ts src/__tests__/tweetCombo.test.ts src/__tests__/postSlots.test.ts src/__tests__/balance.test.ts`
Expected: PASS 전부.

숙련 0에서는 배율이 정확히 1.0이라 기존 기대값이 바뀌지 않아야 한다.
**만약 깨지면** 그 테스트가 숙련을 미리 올려두고 있는지 확인하고, 아니라면 Step 4의 곱셈 위치를 다시 봐라 — 실패 내용을 보고할 것. 기대값을 먼저 고치지 마라.

- [x] **Step 7: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [x] **Step 8: 커밋 (사용자 지시가 있을 때만)**

```bash
git add src/systems/followers.ts src/__tests__/tweetMastery.test.ts
git commit -m "feat: 갈래 숙련이 트윗 도달 배율에 반영"
```

---

## Task 3: 게시할 때 숙련이 쌓인다

**Files:**
- Modify: `src/systems/tweetSystem.ts` (`PostTweetResult` 인터페이스 + `postTweet` 본문 + return)
- Test: `src/__tests__/tweetMastery.test.ts` (describe 블록 추가)

**Interfaces:**
- Consumes: `masteryTierFor` (Task 1)
- Produces: `PostTweetResult`에 두 필드
  - `masteryCount: number` — 이번 트윗 적립 **후**의 그 갈래 누적
  - `masteryTierUp: number` — 이번 트윗으로 오른 새 tier(1~4), 안 올랐으면 0

---

- [x] **Step 1: 실패하는 테스트를 쓴다**

`src/__tests__/tweetMastery.test.ts` 맨 끝에 붙인다. 파일 상단 import에 더한다:

```ts
import { postTweet, postScamTweet } from "@/systems/tweetSystem";
```

```ts
describe("게시 적립", () => {
  // free:true로 게시해 행동력·게시 슬롯 고갈 없이 여러 건을 연달아 올린다.
  // 무료 게시도 숙련을 적립하는 게 계약이다 — 게시는 게시고, 면제되는 건 행동력뿐이다.
  const post = (s: ReturnType<typeof createInitialState>, attr: any) =>
    postTweet(s, attr, "테스트 트윗", false, "meetup", 1, { free: true });

  it("트윗 1건이 그 갈래 숙련만 1 올린다", () => {
    const s = createInitialState();
    const r = post(s, "daily");
    expect(r.masteryCount).toBe(1);
    expect(s.tweetMastery.daily).toBe(1);
    expect(s.tweetMastery.it ?? 0).toBe(0);
  });

  it("무료 게시도 적립한다", () => {
    const s = createInitialState();
    post(s, "daily");
    post(s, "daily");
    expect(s.tweetMastery.daily).toBe(2);
  });

  it("문턱을 넘는 트윗만 masteryTierUp을 세운다", () => {
    const s = createInitialState();
    s.tweetMastery.daily = 8;
    expect(post(s, "daily").masteryTierUp, "9번째는 아직 미달").toBe(0);
    expect(post(s, "daily").masteryTierUp, "10번째가 첫 문턱").toBe(1);
    expect(post(s, "daily").masteryTierUp, "11번째는 이미 넘은 뒤").toBe(0);
  });

  it("두 번째 문턱도 tier 2를 보고한다", () => {
    const s = createInitialState();
    s.tweetMastery.daily = 39;
    expect(post(s, "daily").masteryTierUp).toBe(2);
  });

  it("사기 트윗은 숙련을 적립하지 않는다", () => {
    const s = createInitialState();
    postScamTweet(s, "사기 트윗");
    expect(s.tweetMastery.daily ?? 0).toBe(0);
  });
});
```

- [x] **Step 2: 테스트가 실패하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`
Expected: FAIL — `expected undefined to be 1` (`masteryCount`가 아직 없다)

- [x] **Step 3: `PostTweetResult`에 두 필드를 더한다**

`src/systems/tweetSystem.ts`의 `PostTweetResult` 인터페이스에서 `streak` 선언 **바로 아래**에 넣는다:

```ts
  /** 이번 트윗 적립 후 그 갈래의 숙련 누적(결과 화면 게이지의 분자). */
  masteryCount: number;
  /**
   * 이번 트윗으로 숙련 tier가 올랐으면 새 tier(1~4), 아니면 0.
   * ui가 이 값으로 승급 연출을 띄운다.
   */
  masteryTierUp: number;
```

- [x] **Step 4: 적립 로직을 넣는다**

같은 파일 상단 import에 더한다:

```ts
import { masteryTierFor } from "@/data/tweetMastery";
```

`postTweet` 본문에서 이 두 줄을 찾는다(약 158~160행):

```ts
  const outcome = calcTweetOutcome(state, attr, kind);
  // 같은 갈래 연타 콤보 — 도달이 오르는 대신 아래에서 논란 확률도 같이 오른다.
  const streak = bumpTweetStreak(state, attr);
```

`const streak = ...` **바로 아래**에 넣는다:

```ts
  // 갈래 숙련 적립. ⚠️ **반드시 calcTweetOutcome 뒤다.** 문턱을 넘는 트윗이 넘은 뒤의
  // 배율까지 받으면 결과 화면이 보여주는 "이번 성과"와 표시 tier가 어긋난다.
  // 무료 게시(opts.free)도 적립한다 — 면제되는 건 행동력·게시 슬롯뿐이다.
  const masteryBefore = state.tweetMastery[attr] ?? 0;
  const masteryCount = masteryBefore + 1;
  state.tweetMastery[attr] = masteryCount;
  const tierAfter = masteryTierFor(masteryCount);
  const masteryTierUp = tierAfter > masteryTierFor(masteryBefore) ? tierAfter : 0;
```

- [x] **Step 5: return에 두 필드를 싣는다**

`postTweet` 끝의 return 객체에서 `streak,` **바로 아래**에 넣는다:

```ts
    masteryCount,
    masteryTierUp,
```

- [x] **Step 6: 테스트가 통과하는지 확인한다**

Run: `npx vitest run --pool=forks src/__tests__/tweetMastery.test.ts`
Expected: PASS — 17 tests passed

- [x] **Step 7: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음.

`PostTweetResult`를 구조분해로 받는 곳이 있으면 여기서 드러난다. 에러가 나면 그 호출처(`ui/quoteModal.ts` · `ui/workTweetModal.ts` 등)는 **새 필드를 무시하면 된다** — 필드 추가는 하위호환이다.

- [x] **Step 8: 커밋 (사용자 지시가 있을 때만)**

```bash
git add src/systems/tweetSystem.ts src/__tests__/tweetMastery.test.ts
git commit -m "feat: 게시할 때 갈래 숙련 적립 · 문턱 돌파 보고"
```

---

## Task 4: 게시 결과 화면

**Files:**
- Create: `src/ui/sns/tweetResultModal.ts`
- Modify: `src/ui/ddeoksang.ts` (`onNext` 선택 콜백)
- Modify: `src/ui/sns/composeModal.ts` (게시 후 배선 + 카테고리 칩 배지)
- Modify: `src/styles/main.css` (결과 화면·게이지 스타일)

**Interfaces:**
- Consumes: `masteryTierFor`·`masteryNextThreshold`·`masteryTitle`·`masteryGrade` (Task 1) · `PostTweetResult.masteryCount`·`masteryTierUp` (Task 3)
- Produces:
  ```ts
  export interface TweetResultPayload {
    attr: AttributeId;
    likes: number;
    retweets: number;
    followerDelta: number;
    masteryCount: number;
    masteryTierUp: number;
    streak: number;
    statChanges: { label: string; delta: number }[];
    rodeTrend: boolean;
  }
  export function showTweetResult(
    ctx: GameContext,
    payload: TweetResultPayload,
    onAgain: () => void,
  ): void;
  ```

**배경 사실(이미 확인됨 — 다시 조사하지 마라):**
- `ui/app.ts:342-344`가 `ui.modal` **함수 참조가 그대로면 노드를 캐시**한다. 그래서 모달 안의 지역 상태는 `ctx.update()`에도 살아남는다. 반대로 `openModal`에 **새 함수**를 넘기면 새로 렌더된다.
- `showDdeoksang`은 `ctx.openModal`을 써서 현재 모달을 **대체**한다. 그래서 결과 화면은 composeModal의 단계가 아니라 별도 모달이어야 순서가 맞는다.
- `el(...)`은 children에 `null`을 허용한다(기존 코드가 그렇게 쓴다).

---

- [x] **Step 1: `ddeoksang.ts`에 `onNext`를 더한다**

`src/ui/ddeoksang.ts`의 시그니처를 고친다.

찾을 것:
```ts
export function showDdeoksang(
  ctx: GameContext,
  opts: { likes: number; retweets: number; gain: number },
): void {
```

바꿀 것:
```ts
export function showDdeoksang(
  ctx: GameContext,
  opts: {
    likes: number;
    retweets: number;
    gain: number;
    /**
     * 오버레이가 닫힌 뒤 이어서 할 일(예: 게시 결과 모달 열기).
     * 주면 closeModal 대신 이걸 부른다 — 콜백이 openModal로 다음 화면을 띄우기 때문이다.
     * 생략하면 기존대로 모달을 닫는다(quoteModal·workTweetModal이 그 경로다).
     */
    onNext?: () => void;
  },
): void {
```

같은 파일에서 닫기 경로 두 곳을 하나로 모은다. `const cleanup = ...` 정의 **바로 아래**에 넣는다:

```ts
    /** 정리 후 다음 화면으로 넘어간다(없으면 그냥 닫는다). */
    const finish = (): void => {
      cleanup();
      if (opts.onNext) opts.onNext();
      else c.closeModal();
    };
```

그리고 두 호출부를 `finish()`로 바꾼다.

찾을 것:
```ts
    const timer = window.setTimeout(() => {
      cleanup();
      c.closeModal();
    }, 2600);
```
바꿀 것:
```ts
    const timer = window.setTimeout(finish, 2600);
```

찾을 것:
```ts
        onclick: () => {
          cleanup();
          c.closeModal();
        },
```
바꿀 것:
```ts
        onclick: finish,
```

- [x] **Step 2: `src/ui/sns/tweetResultModal.ts`를 만든다**

```ts
import type { AttributeId } from "@/core/types";
import type { GameContext } from "@/ui/context";
import { el, formatNumber } from "@/utils/dom";
import { ATTRIBUTES } from "@/data/attributes";
import {
  masteryGrade,
  masteryNextThreshold,
  masteryTierFor,
  masteryTitle,
} from "@/data/tweetMastery";
import { icon, ATTR_ICON } from "@/ui/icons";

/**
 * 게시 결과 화면 — 트윗을 올린 직후의 성취를 보여준다.
 *
 * 왜 토스트가 아니라 화면인가: 토스트 한 줄로는 숫자가 팔로워 총량에 흡수되어 사라진다.
 * **게이지가 눈앞에서 차오르는 것**이 성취감의 본체다 — 숫자를 크게 쓰는 걸로는 안 된다.
 *
 * ⚠️ 순수 표시다 — 게임 상태를 바꾸지 않는다(적립·보상은 postTweet이 이미 끝냈다).
 * ⚠️ 떡상이면 호출자가 떡상 오버레이를 **먼저** 띄우고, 그게 닫힐 때 이 화면을 연다
 *    (showDdeoksang의 onNext). 두 연출이 자리를 다투지 않게 하는 순서다.
 */
export interface TweetResultPayload {
  attr: AttributeId;
  likes: number;
  retweets: number;
  followerDelta: number;
  /** 이번 트윗 적립 **후**의 갈래 숙련 누적. 적립 전 값은 -1로 구한다. */
  masteryCount: number;
  /** 이번 트윗으로 오른 새 tier(1~4). 안 올랐으면 0. */
  masteryTierUp: number;
  streak: number;
  statChanges: { label: string; delta: number }[];
  rodeTrend: boolean;
}

/** 숙련 진행 게이지 한 덩이(라벨 + 바 + 등급·배율 줄). */
function masteryGauge(payload: TweetResultPayload): HTMLElement {
  const label = ATTRIBUTES[payload.attr].label;
  const tier = masteryTierFor(payload.masteryCount);
  const next = masteryNextThreshold(tier);
  const grade = masteryGrade(tier);
  const title = masteryTitle(tier);

  // 게이지는 **현재 tier 구간 안에서의 진행**이다(0부터가 아니라 이전 문턱부터).
  // 그래야 문턱을 넘은 직후 바가 거의 빈 상태로 돌아가며 다음 목표가 생긴다.
  const floor = tier === 0 ? 0 : (masteryNextThreshold(tier - 1) ?? 0);
  const ceil = next ?? payload.masteryCount;
  const span = Math.max(1, ceil - floor);
  const pct = next === null ? 100 : Math.min(100, ((payload.masteryCount - floor) / span) * 100);

  return el(
    "div",
    { class: "tweet-result__mastery" },
    el(
      "div",
      { class: "tweet-result__mastery-head" },
      icon(ATTR_ICON[payload.attr], { size: 14 }),
      el("span", {}, `${label} 숙련`),
      el(
        "span",
        { class: "tweet-result__mastery-count" },
        next === null ? `${payload.masteryCount} · 만렙` : `${payload.masteryCount} / ${next}`,
      ),
    ),
    el(
      "div",
      { class: "mastery-bar" },
      // 폭을 인라인으로 준 뒤 CSS transition이 채우는 애니를 맡는다.
      el("div", { class: "mastery-bar__fill", style: `width:${pct}%` }),
    ),
    grade
      ? el(
          "div",
          { class: "tweet-result__mastery-tier" },
          el("span", { class: "mastery-grade" }, grade),
          el("span", {}, `${label} ${title ?? ""}`),
        )
      : el("div", { class: "tweet-result__mastery-tier tweet-result__mastery-tier--none" },
          `첫 등급까지 ${Math.max(0, (next ?? 0) - payload.masteryCount)}개`),
  );
}

/** 게시 결과 모달을 띄운다. */
export function showTweetResult(
  ctx: GameContext,
  payload: TweetResultPayload,
  onAgain: () => void,
): void {
  ctx.openModal((c) => {
    const statText = payload.statChanges
      .map((s) => `${s.label} ${s.delta > 0 ? "+" : ""}${s.delta}`)
      .join(" · ");

    const badges: (HTMLElement | null)[] = [
      payload.rodeTrend ? el("span", { class: "tweet-result__badge" }, "🔥 트렌드 편승") : null,
      payload.streak >= 2
        ? el("span", { class: "tweet-result__badge" }, `⚡ ${payload.streak}연타`)
        : null,
      statText ? el("span", { class: "tweet-result__badge" }, statText) : null,
    ];

    return el(
      "div",
      { class: "modal tweet-result" },
      el("div", { class: "modal__head" }, "트윗 등록!"),
      el(
        "div",
        { class: "modal__body" },
        // 승급했으면 맨 위에 축하 줄 — 4번밖에 없는 순간이라 가장 눈에 띄는 자리에 둔다.
        payload.masteryTierUp > 0
          ? el(
              "div",
              { class: "tweet-result__levelup" },
              `🏅 ${ATTRIBUTES[payload.attr].label} ${masteryTitle(payload.masteryTierUp) ?? ""} 달성!`,
            )
          : null,
        el(
          "div",
          { class: "tweet-result__nums" },
          el("div", { class: "tweet-result__num" }, "❤️ ", formatNumber(payload.likes)),
          el("div", { class: "tweet-result__num" }, "🔁 ", formatNumber(payload.retweets)),
          el(
            "div",
            {
              class:
                "tweet-result__num tweet-result__num--follow" +
                (payload.followerDelta < 0 ? " tweet-result__num--bad" : ""),
            },
            "👤 ",
            `${payload.followerDelta >= 0 ? "+" : ""}${formatNumber(payload.followerDelta)}`,
          ),
        ),
        badges.some(Boolean) ? el("div", { class: "tweet-result__badges" }, ...badges) : null,
        masteryGauge(payload),
        el(
          "div",
          { class: "compose-actions" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                c.closeModal();
                // 결과를 닫는 시점이 '행동이 끝난 시점'이다 — 이벤트 판정을 여기로 미룬다.
                c.afterAction("tweet");
              },
            },
            "닫기",
          ),
          // 등록 버튼과 같은 클래스(`btn`)를 쓴다 — `btn--primary`는 이 프로젝트에 없다.
          el("button", { class: "btn", onclick: onAgain }, "한 번 더"),
        ),
      ),
    );
  });
}
```

- [x] **Step 3: `composeModal.ts`의 게시 후 처리를 결과 모달로 바꾼다**

`src/ui/sns/composeModal.ts` 상단 import에 더한다:

```ts
import { showTweetResult } from "@/ui/sns/tweetResultModal";
import { masteryGrade, masteryTierFor } from "@/data/tweetMastery";
```

게시 핸들러(약 725~765행)를 고친다. 찾을 것 — `let delta = 0;`부터 `ctx.afterAction("tweet");`까지:

```ts
            let delta = 0;
            let unlockedMeeting = false;
            let statChanges: { label: string; delta: number }[] = [];
            let streak = 1;
            ctx.update((st) => {
```

`streak = res.streak;` 아래 두 줄을 잡아 두도록 지역 변수를 늘린다. 최종 형태는 이렇다:

```ts
            let delta = 0;
            let unlockedMeeting = false;
            let statChanges: { label: string; delta: number }[] = [];
            let streak = 1;
            let masteryCount = 0;
            let masteryTierUp = 0;
            let likes = 0;
            let retweets = 0;
            ctx.update((st) => {
              const res = postTweet(st, finalAttr, finalText, finalAdult, adultKind, mult, opts);
              delta = res.followerDelta;
              unlockedMeeting = res.unlockedMeeting;
              statChanges = res.statChanges;
              streak = res.streak;
              masteryCount = res.masteryCount;
              masteryTierUp = res.masteryTierUp;
              likes = res.tweet.likes;
              retweets = res.tweet.retweets;
              if (res.ddeoksang) {
                ddPayload = {
                  likes: res.tweet.likes,
                  retweets: res.tweet.retweets,
                  gain: res.followerDelta + res.ddeoksangGain,
                };
              }
              // 창작 트윗 누적 → 20개 이상이면 작가 계약 제안 DM이 올 수 있다
              if (creating) {
                st.creationTweetCount += 1;
                maybeSpawnAuthorDM(st);
              }
              // 편승 성사 시 트렌드를 '오늘 편승함'으로 기록(부스트 1회/일 보장 — rideTrend가 중복 push 방지).
              if (rode) rideTrend(st, trend!.id);
            });
            if (unlockedMeeting) ctx.toast("🔓 성인 콘텐츠가 풀렸다 — 새로운 만남의 문이 열렸다.");
            // 게시 결과 화면 — 토스트 대신 숙련 게이지까지 보여준다.
            // ⚠️ afterAction은 여기서 부르지 않는다. 결과 모달의 [닫기]가 부른다.
            const openResult = (): void =>
              showTweetResult(
                ctx,
                {
                  attr: finalAttr,
                  likes,
                  retweets,
                  followerDelta: delta,
                  masteryCount,
                  masteryTierUp,
                  streak,
                  statChanges,
                  rodeTrend: rode,
                },
                // [한 번 더] — 작성 모달을 새로 연다(1단계부터). 연타 콤보와 맞물린다.
                () => ctx.openModal((c) => renderComposeModal(c)),
              );
            // 떡상이면 오버레이가 먼저, 그게 닫히면 결과 화면으로 잇는다.
            if (ddPayload) showDdeoksang(ctx, { ...ddPayload, onNext: openResult });
            else openResult();
            return;
```

그리고 이 핸들러 **맨 끝**에 남아 있던 세 줄을 지운다(위 `return;`이 대신한다):

```ts
          // 트윗은 슬롯을 넘기지 않는다 — 닫고 이벤트 판정만.
          ctx.closeModal();
          // 떡상이면 닫은 직후 연출 오버레이를 띄운다(afterAction 이벤트보다 우선 — 이벤트는 다음 행동으로).
          if (ddPayload) showDdeoksang(ctx, ddPayload);
          ctx.afterAction("tweet");
```

⚠️ **사기 트윗 경로(`if (scamMode) { ... }`)는 건드리지 마라.** 숙련이 없으므로 지금의 토스트 + `ctx.closeModal()` + `ctx.afterAction("tweet")`을 그대로 유지해야 한다. 위 세 줄을 지우면 사기 경로가 안 닫히므로, 사기 분기 끝에 같은 세 줄을 넣어 준다:

```ts
          if (scamMode) {
            let earned = 0;
            ctx.update((st) => {
              earned = postScamTweet(st, finalText).earned;
            });
            ctx.toast(`사기 트윗 등록... +${earned.toLocaleString("ko-KR")}원`);
            ctx.closeModal();
            ctx.afterAction("tweet");
            return;
          }
```
(기존 `} else {`를 없애고 일반 트윗 블록을 바깥으로 꺼내는 형태다.)

- [x] **Step 4: 카테고리 칩에 등급 배지를 단다**

같은 파일 `renderStep1()`의 `attrChips`(약 393~413행)에서 칩 children을 고친다.

찾을 것:
```ts
          icon(ATTR_ICON[id], { size: 14 }),
          categoryLabel(id),
        ),
      ),
```

바꿀 것:
```ts
          icon(ATTR_ICON[id], { size: 14 }),
          categoryLabel(id),
          // 숙련 등급 배지 — 칩 목록이 곧 숙련 현황이 된다(별도 도감 화면을 만들지 않는 이유).
          // tier 0(첫 문턱 미달)은 배지 없음.
          masteryGrade(masteryTierFor(s.tweetMastery[id] ?? 0))
            ? el(
                "span",
                { class: "chip__grade" },
                masteryGrade(masteryTierFor(s.tweetMastery[id] ?? 0))!,
              )
            : null,
        ),
      ),
```

- [x] **Step 5: 타입 검사**

Run: `npx tsc --noEmit`
Expected: 에러 없음

- [x] **Step 6: CSS를 넣는다**

`src/styles/main.css`에서 `.ddeoksang {` 정의를 Grep으로 찾고, 그 블록이 끝나는 지점 **뒤**에 아래를 통째로 붙인다(주변 ±30줄만 읽어 들여쓰기·변수명 관례를 맞출 것 — 색은 기존 CSS 변수를 쓰고, 없으면 아래 값을 그대로 둔다).

```css
/* ── 게시 결과 화면 ─────────────────────────────── */
.tweet-result__levelup {
  text-align: center;
  font-weight: 700;
  padding: 10px 12px;
  margin-bottom: 12px;
  border-radius: 10px;
  background: linear-gradient(90deg, #ffd76e33, #ff9f4333);
  border: 1px solid #ffb85c66;
}

.tweet-result__nums {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin: 6px 0 14px;
}

.tweet-result__num {
  font-size: 1.15rem;
  font-weight: 700;
  white-space: nowrap;
}

.tweet-result__num--follow {
  color: #3ec46d;
}

.tweet-result__num--bad {
  color: #e0574f;
}

.tweet-result__badges {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 14px;
}

.tweet-result__badge {
  font-size: 0.78rem;
  padding: 3px 8px;
  border-radius: 999px;
  background: #ffffff14;
  border: 1px solid #ffffff22;
}

.tweet-result__mastery {
  padding: 12px;
  border-radius: 10px;
  background: #ffffff0d;
  border: 1px solid #ffffff1a;
}

.tweet-result__mastery-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 0.85rem;
  margin-bottom: 8px;
}

.tweet-result__mastery-count {
  margin-left: auto;
  opacity: 0.75;
  font-variant-numeric: tabular-nums;
}

.mastery-bar {
  height: 10px;
  border-radius: 999px;
  background: #ffffff1a;
  overflow: hidden;
}

/* 폭은 인라인 style로 오고, 채워지는 애니는 여기가 맡는다. */
.mastery-bar__fill {
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #56b6f5, #7ee7c7);
  transition: width 600ms cubic-bezier(0.22, 1, 0.36, 1);
}

.tweet-result__mastery-tier {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 8px;
  font-size: 0.82rem;
}

.tweet-result__mastery-tier--none {
  opacity: 0.6;
}

.mastery-grade,
.chip__grade {
  font-size: 0.7rem;
  font-weight: 700;
  line-height: 1;
  padding: 2px 5px;
  border-radius: 5px;
  background: #ffd76e2e;
  border: 1px solid #ffd76e5c;
  color: #ffd76e;
}

.chip__grade {
  margin-left: 4px;
}
```

- [x] **Step 7: 전체 테스트 스위트를 1회 돌린다**

Run: `npx vitest run --pool=forks`
Expected: 전부 PASS.

깨진 게 있으면 **기대값을 고치기 전에** 원인을 보고할 것.

- [x] **Step 8: 빌드**

Run: `npm run build`
Expected: 성공(종료 코드 0)

- [x] **Step 9: 브라우저로 눈으로 확인한다**

`game-run` 스킬을 쓴다. **이미 켜져 있는 dev 서버(보통 5173)를 재활용하고 새로 띄우지 마라.**

확인할 것 — 스크린샷은 **결과 화면 1장**이면 충분하다(이미지는 비싸다):
1. 트윗을 한 건 올린다 → 결과 화면이 뜨는가. 숫자 3개(❤️/🔁/👤)와 숙련 게이지가 보이는가.
2. 게이지 바가 0이 아닌 폭으로 차 있고, 라벨이 `1 / 10` 형태인가.
3. `[한 번 더]`를 눌러 작성 모달이 다시 열리는가.
4. 10건을 올려 승급 줄(`🏅 일상계 입문 달성!`)과 칩 배지(`일상 B`)가 뜨는가.
   - 빠르게 보려면 콘솔에서 세이브를 주무르지 말고, 작성 모달을 반복해 열되 행동력이 마르면
     잠을 자서 회복한다. 또는 개발자도구 콘솔에서 상태를 직접 만지는 대신 **9건 상태의 세이브를 만들어 두는 편이 빠르다**.
5. `[닫기]` 후 이벤트 팝업이 정상적으로 뜨는지(afterAction이 살아 있는지) 한 번은 본다.

- [x] **Step 10: 커밋 (사용자 지시가 있을 때만)**

```bash
git add src/ui/sns/tweetResultModal.ts src/ui/ddeoksang.ts src/ui/sns/composeModal.ts src/styles/main.css
git commit -m "feat: 트윗 게시 결과 화면 — 숙련 게이지·승급 연출"
```

---

## 완료 후 남는 것

- `systems/followers.ts`의 `TWEET_CONV_RATE` 주석에 있는 **100만 도달일 추정표는 이제 낡았다.** 숙련 배율(최대 ×1.32)이 종반에 붙는다. 재측정할 여유가 없으면 그 주석에 "숙련 배율 도입 후 미재측정" 한 줄을 남겨라 — 다음 사람이 낡은 표를 믿는 것보다 낫다.
- 체감이 너무 빨라지면 `MASTERY_TIER_BONUS`(`data/tweetMastery.ts`) **하나만** 낮춘다.
- 갈래별 전용 칭호 92개는 의도적으로 안 썼다. 공용 4개가 밋밋하면 그때 `MASTERY_TITLES`를 `Record<AttributeId, [string,string,string,string]>`으로 바꾸고 `masteryTitle`이 attr을 받게 하면 된다.
