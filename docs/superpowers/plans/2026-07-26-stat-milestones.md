# 스탯 마일스톤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 11개 성장 스킬이 100/300/600/999를 넘을 때 칭호·일회성 보상·소형 지속 퍼크를 주는 마일스톤 시스템을 추가한다(총 44 마일스톤).

**Architecture:** 기존 achievements 시스템 패턴을 미러링한다 — `checkStatMilestones(state)`가 이미 걸린 두 훅(`onNewDay`·`postTweet`)에서 돌며 claimed 집합(`state.statMilestones`)과 토스트 큐(`state.pendingMilestones`)를 관리하고, 새로 돌파한 마일스톤에 보상을 지급한다. 지속 퍼크는 기존 `actionMaxBonus` 필드에 누적한다(팔로워 공식 불변). UI는 스탯 팝업 각 행에 배지만 추가한다.

**Tech Stack:** TypeScript + Vite. `data → systems → ui` 단방향. 테스트 vitest(`npx vitest run --pool=forks`).

## Global Constraints

- 스킬 값은 0~999(`MAX_SKILL`). 스킬 유니온 `SkillStatId`는 **11종**: fitness, beauty, vocabulary, knowledge, sociability, comedy, creativity, lewd, game, it, otaku.
- `MILESTONE_TITLES`는 `Record<SkillStatId, [string,string,string,string]>` — 11개 키 누락 시 컴파일 에러여야 함(개수 보증 장치).
- 계층 경계: data는 systems/ui를 import하지 않는다. systems는 ui를 import하지 않는다.
- 스킬 획득량 관례: 기존 데이터는 "원래 스케일 ×5"를 따른다(참고, 마일스톤 문턱 자체는 절대값).
- 커밋 메시지 말미: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`
- 검증은 각 태스크 typecheck까지. build·vitest·game-run은 마지막 통합 QA 1회.

---

### Task 1: 데이터 — 칭호·문턱 (`data/milestones.ts`)

**Files:**
- Create: `src/data/milestones.ts`

**Interfaces:**
- Produces:
  - `MILESTONE_THRESHOLDS: readonly [100, 300, 600, 999]`
  - `MILESTONE_TITLES: Record<SkillStatId, [string, string, string, string]>`
  - `milestoneId(skill: SkillStatId, tier: number): string` → `` `${skill}:${tier}` ``
  - `SKILL_MILESTONE_IDS: SkillStatId[]` (Object.keys(MILESTONE_TITLES) 캐스팅)

- [ ] **Step 1: 파일 작성**

```ts
import type { SkillStatId } from "@/core/types";

/** 마일스톤 문턱 4구간(오름차순). 인덱스 = tier. */
export const MILESTONE_THRESHOLDS = [100, 300, 600, 999] as const;

/**
 * 스킬별 4개 칭호(tier 0~3 오름차순). 한 스킬 안에서 서사적으로 상승한다.
 * ⚠️ Record<SkillStatId, ...>라 11개 스킬 전부 있어야 컴파일된다(개수 보증).
 */
export const MILESTONE_TITLES: Record<SkillStatId, [string, string, string, string]> = {
  fitness: ["동네 헬스 입문", "주 5일 헬창", "바디프로필 각", "인간 병기"],
  beauty: ["거울 좀 봄", "셀카 장인", "화보 각", "걸어다니는 뷰티템"],
  vocabulary: ["맞춤법 졸업", "드립 사전", "글빨 좀 침", "문장의 연금술사"],
  knowledge: ["상식 채움", "잡학다식", "걸어다니는 위키", "인간 백과사전"],
  sociability: ["인싸 지망생", "친구 부자", "인맥 왕", "모두의 최애"],
  comedy: ["아재개그 입문", "드립력 상승", "타임라인 광대", "밈 제조기"],
  creativity: ["끄적이는 사람", "떡밥 장인", "콘텐츠 공장", "창작의 신"],
  lewd: ["야한 상상", "수위 조절 실패", "선넘는 트친", "금지된 지식"],
  game: ["뉴비 탈출", "겜창 인증", "랭커의 향기", "프로게이머 각"],
  it: ["복붙 코더", "스택오버플로 순례자", "풀스택 각", "코드의 마법사"],
  otaku: ["입덕 부정기", "성지순례러", "굿즈 파산", "찐텐 덕후"],
};

/** 마일스톤 고유 id: `${skill}:${tier}` */
export function milestoneId(skill: SkillStatId, tier: number): string {
  return `${skill}:${tier}`;
}

/** 마일스톤 대상 스킬 목록(= MILESTONE_TITLES의 키). */
export const SKILL_MILESTONE_IDS = Object.keys(MILESTONE_TITLES) as SkillStatId[];
```

- [ ] **Step 2: typecheck**

Run: `npx tsc --noEmit`
Expected: PASS (SkillStatId 11키 모두 채워졌으므로 에러 없음)

- [ ] **Step 3: Commit**

```bash
git add src/data/milestones.ts
git commit -m "feat(milestones): 스탯 마일스톤 칭호·문턱 데이터"
```

---

### Task 2: 상태 필드 (`core/types.ts` · `core/state.ts` · `systems/save.ts`)

**Files:**
- Modify: `src/core/types.ts` (achievements 필드 옆, ~1109)
- Modify: `src/core/state.ts` (`createInitialState`, ~293)
- Modify: `src/systems/save.ts` (`sanitize`, ~338)

**Interfaces:**
- Produces: `GameState.statMilestones: string[]`, `GameState.pendingMilestones: string[]`

- [ ] **Step 1: 타입 필드 추가** — `core/types.ts`의 `pendingAchievements: string[];` 바로 아래에:

```ts
  /** 획득한 스탯 마일스톤 id(`skill:tier`) — 영구, 재지급 방지용 claimed 집합 */
  statMilestones: string[];
  /** 마일스톤 달성 알림 대기 id 목록 — app이 토스트 후 비운다(pendingAchievements와 동일 패턴) */
  pendingMilestones: string[];
```

- [ ] **Step 2: 초기 상태** — `core/state.ts`의 `pendingAchievements: [],` 아래에:

```ts
    statMilestones: [],
    pendingMilestones: [],
```

- [ ] **Step 3: 세이브 폴백 + 구세이브 백필** — `systems/save.ts`의 `if (!Array.isArray(state.pendingAchievements)) state.pendingAchievements = [];` 아래에:

```ts
  // 마일스톤은 신규 필드. statMilestones 키가 없으면 구세이브 → 현재 스킬 기준으로
  // 칭호만 소급(claimed 백필)하고 일회성·퍼크는 지급하지 않는다(소급 보상 방지).
  if (!Array.isArray(state.statMilestones)) {
    state.statMilestones = [];
    backfillClaimedMilestones(state);
  }
  if (!Array.isArray(state.pendingMilestones)) state.pendingMilestones = [];
```

그리고 `save.ts` 상단 import에 추가:

```ts
import { backfillClaimedMilestones } from "./milestones";
```

> 주: `backfillClaimedMilestones`는 Task 3에서 정의한다. import가 먼저 걸려 이 태스크만 typecheck하면 "없는 모듈" 에러가 날 수 있으니, **Task 2·3을 한 커밋으로 묶어** Task 3 끝에서 typecheck한다.

- [ ] **Step 4: (Task 3 완료 후 함께) typecheck + commit** — Task 3 Step 6 참조.

---

### Task 3: 판정·보상 시스템 (`systems/milestones.ts` + 훅 2곳)

**Files:**
- Create: `src/systems/milestones.ts`
- Modify: `src/systems/time.ts:218` (onNewDay, checkAchievements 옆)
- Modify: `src/systems/tweetSystem.ts:239` (postTweet, checkAchievements 옆)

**Interfaces:**
- Consumes: `MILESTONE_THRESHOLDS`, `MILESTONE_TITLES`, `milestoneId`, `SKILL_MILESTONE_IDS` (Task 1); `getActiveAccount` (`core/state`); `clampAction` 불필요.
- Produces:
  - `checkStatMilestones(state: GameState): string[]`
  - `backfillClaimedMilestones(state: GameState): void`
  - `highestMilestoneTier(state: GameState, skill: SkillStatId): number` (없으면 -1) — UI용

- [ ] **Step 1: 파일 작성** — `src/systems/milestones.ts`

```ts
import type { GameState, SkillStatId } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import {
  MILESTONE_THRESHOLDS,
  SKILL_MILESTONE_IDS,
  milestoneId,
} from "@/data/milestones";

/** 지속 퍼크: 마일스톤 1개당 행동력 상한 증가분. 크게 느껴지면 낮춘다(튜닝). */
export const PERK_ACTION_PER_MILESTONE = 1;

/** 일회성 축하 보상(티어별). followers=활성 계정 팔로워, money=소지금. */
const ONE_TIME_REWARD: { followers: number; money: number }[] = [
  { followers: 0, money: 100_000 }, // tier0 100
  { followers: 2000, money: 100_000 }, // tier1 300
  { followers: 8000, money: 100_000 }, // tier2 600
  { followers: 30000, money: 100_000 }, // tier3 999
];

/** 새로 돌파한 마일스톤에 보상을 지급한다(claimed push는 호출부에서 이미 함). */
function grantMilestoneReward(state: GameState, tier: number): void {
  const r = ONE_TIME_REWARD[tier];
  if (!r) return;
  if (r.followers) getActiveAccount(state).followers += r.followers;
  if (r.money) state.money += r.money;
  state.actionMaxBonus += PERK_ACTION_PER_MILESTONE;
}

/**
 * 스킬이 문턱을 넘겼는지 판정해 claimed 기록·보상 지급·토스트 큐잉.
 * checkAchievements 미러: onNewDay·postTweet 말미에서 호출.
 * 스킬 하락해도 claimed는 남으므로 재지급 없음(멱등).
 * @returns 이번에 새로 달성한 id 배열.
 */
export function checkStatMilestones(state: GameState): string[] {
  const newly: string[] = [];
  for (const skill of SKILL_MILESTONE_IDS) {
    const val = state.skills[skill];
    MILESTONE_THRESHOLDS.forEach((thr, tier) => {
      const id = milestoneId(skill, tier);
      if (state.statMilestones.includes(id)) return;
      if (val >= thr) {
        state.statMilestones.push(id);
        grantMilestoneReward(state, tier);
        state.pendingMilestones.push(id);
        newly.push(id);
      }
    });
  }
  return newly;
}

/**
 * 구세이브 백필: 현재 스킬로 이미 넘긴 문턱을 claimed로만 기록(보상·토스트 없음).
 * save.sanitize에서 statMilestones 키가 없던 세이브에 1회 호출.
 */
export function backfillClaimedMilestones(state: GameState): void {
  for (const skill of SKILL_MILESTONE_IDS) {
    const val = state.skills[skill];
    MILESTONE_THRESHOLDS.forEach((thr, tier) => {
      const id = milestoneId(skill, tier);
      if (val >= thr && !state.statMilestones.includes(id)) {
        state.statMilestones.push(id);
      }
    });
  }
}

/** UI용: 해당 스킬에서 획득한 최고 tier(없으면 -1). */
export function highestMilestoneTier(state: GameState, skill: SkillStatId): number {
  let best = -1;
  MILESTONE_THRESHOLDS.forEach((_thr, tier) => {
    if (state.statMilestones.includes(milestoneId(skill, tier))) best = tier;
  });
  return best;
}
```

> 백필과 checkStatMilestones 순서 주의: 세이브 로드 시 sanitize(백필) → 이후 첫 onNewDay/postTweet의 checkStatMilestones는 이미 claimed라 재지급 안 함. 신규 게임은 skills=0이라 백필이 아무것도 안 함.

- [ ] **Step 2: onNewDay 훅** — `systems/time.ts`의 `checkAchievements(state);`(라인 218) 바로 아래:

```ts
  checkStatMilestones(state);
```

그리고 `time.ts` import에 추가:

```ts
import { checkStatMilestones } from "./milestones";
```

- [ ] **Step 3: postTweet 훅** — `systems/tweetSystem.ts`의 `checkAchievements(state);`(라인 239) 바로 아래:

```ts
  checkStatMilestones(state);
```

그리고 `tweetSystem.ts` import에 추가:

```ts
import { checkStatMilestones } from "./milestones";
```

- [ ] **Step 4: 회귀 테스트 작성** — `src/__tests__/statMilestones.test.ts`

```ts
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  checkStatMilestones,
  backfillClaimedMilestones,
  highestMilestoneTier,
  PERK_ACTION_PER_MILESTONE,
} from "@/systems/milestones";

describe("stat milestones", () => {
  it("문턱을 넘으면 claimed·퍼크·토스트가 생기고 멱등하다", () => {
    const s = createInitialState();
    const baseBonus = s.actionMaxBonus;
    s.skills.fitness = 100; // tier0만 돌파
    const newly = checkStatMilestones(s);
    expect(newly).toEqual(["fitness:0"]);
    expect(s.statMilestones).toContain("fitness:0");
    expect(s.pendingMilestones).toContain("fitness:0");
    expect(s.actionMaxBonus).toBe(baseBonus + PERK_ACTION_PER_MILESTONE);
    // 다시 호출해도 재지급 없음(멱등)
    const again = checkStatMilestones(s);
    expect(again).toEqual([]);
    expect(s.actionMaxBonus).toBe(baseBonus + PERK_ACTION_PER_MILESTONE);
  });

  it("한 번에 여러 문턱을 넘으면 전부 claimed된다", () => {
    const s = createInitialState();
    s.skills.knowledge = 999; // tier0~3 전부
    checkStatMilestones(s);
    expect(highestMilestoneTier(s, "knowledge")).toBe(3);
    expect(s.statMilestones.filter((id) => id.startsWith("knowledge:")).length).toBe(4);
  });

  it("백필은 칭호만 소급하고 보상·토스트는 안 준다", () => {
    const s = createInitialState();
    const baseBonus = s.actionMaxBonus;
    s.skills.beauty = 300;
    backfillClaimedMilestones(s);
    expect(s.statMilestones).toContain("beauty:0");
    expect(s.statMilestones).toContain("beauty:1");
    expect(s.pendingMilestones).toEqual([]); // 토스트 없음
    expect(s.actionMaxBonus).toBe(baseBonus); // 퍼크 없음
  });
});
```

- [ ] **Step 5: 테스트 실행**

Run: `npx vitest run --pool=forks src/__tests__/statMilestones.test.ts`
Expected: 3 passed

- [ ] **Step 6: typecheck + commit(Task 2+3 묶음)**

Run: `npx tsc --noEmit`
Expected: PASS

```bash
git add src/core/types.ts src/core/state.ts src/systems/save.ts src/systems/milestones.ts src/systems/time.ts src/systems/tweetSystem.ts src/__tests__/statMilestones.test.ts
git commit -m "feat(milestones): 판정·보상 시스템 + 상태 필드 + 회귀 테스트"
```

---

### Task 4: UI — 토스트 + 배지 + CSS

**Files:**
- Modify: `src/ui/app.ts` (~215, pendingAchievements 드레인 블록 아래)
- Modify: `src/ui/statusPopup.ts` (`detailStatRow`, ~226)
- Modify: `src/styles/main.css` (detail-row 관련 규칙 근처)

**Interfaces:**
- Consumes: `highestMilestoneTier` (Task 3), `MILESTONE_TITLES` (Task 1).

- [ ] **Step 1: 토스트 드레인** — `ui/app.ts`의 `pendingAchievements` 마이크로태스크 블록(~215~232)을 미러링해 바로 아래에 추가. 모듈 스코프에 `let mileToastScheduled = false;`(achToastScheduled 옆)를 두고:

```ts
    // 마일스톤 달성 토스트(pendingAchievements와 동일 패턴).
    if (!gameOver && state.pendingMilestones?.length && !mileToastScheduled) {
      mileToastScheduled = true;
      queueMicrotask(() => {
        mileToastScheduled = false;
        const ids = store.getState().pendingMilestones;
        if (!ids?.length) return;
        const labels = ids
          .map((id) => {
            const [skill, tierStr] = id.split(":");
            const titles = MILESTONE_TITLES[skill as keyof typeof MILESTONE_TITLES];
            return titles ? titles[Number(tierStr)] : null;
          })
          .filter((n): n is string => !!n);
        ctx.update((d) => {
          d.pendingMilestones = [];
        });
        if (labels.length === 0) return;
        ctx.toast(`🏅 마일스톤 달성: ${labels.join(", ")}`);
      });
    }
```

`app.ts` import에 추가:

```ts
import { MILESTONE_TITLES } from "@/data/milestones";
```

> ⚠️ `ctx.toast` 정확한 시그니처는 기존 pendingAchievements 블록(app.ts:230 부근)에서 확인해 그대로 맞춘다(문구 인자 형태가 다르면 그 형태로).

- [ ] **Step 2: 배지 삽입** — `ui/statusPopup.ts` `detailStatRow`의 반환 `el(...)` 마지막 자식(`detail-row__val`) 뒤에 배지 추가:

```ts
    el("span", { class: "detail-row__val" }, String(val)),
    ...(function () {
      const tier = highestMilestoneTier(s, id);
      return tier >= 0
        ? [el("span", { class: "detail-row__badge" }, MILESTONE_TITLES[id][tier])]
        : [];
    })(),
```

`statusPopup.ts` import에 추가:

```ts
import { highestMilestoneTier } from "@/systems/milestones";
import { MILESTONE_TITLES } from "@/data/milestones";
```

- [ ] **Step 3: CSS** — 먼저 유사 배지/pill 클래스 확인:

Run: `grep -n "badge\|pill\|chip" src/styles/main.css | head`

기존 재활용 가능한 pill 규칙이 있으면 그 클래스를 `detail-row__badge` 대신 쓰고 Step 2를 수정한다. 없으면 `.detail-row__label` 규칙 근처에 추가:

```css
.detail-row__badge {
  margin-left: auto;
  padding: 1px 6px;
  font-size: 10px;
  border-radius: 8px;
  background: var(--accent-soft, #2b3a55);
  color: var(--accent, #8ec5ff);
  white-space: nowrap;
}
```

> `margin-left:auto`가 기존 detail-row flex 레이아웃에서 배지를 오른쪽 끝으로 민다. detail-row가 flex가 아니면 `grep -n "\.detail-row\b" src/styles/main.css`로 확인 후 정렬 방식만 맞춘다.

- [ ] **Step 4: typecheck + commit**

Run: `npx tsc --noEmit`
Expected: PASS

```bash
git add src/ui/app.ts src/ui/statusPopup.ts src/styles/main.css
git commit -m "feat(milestones): 스탯 팝업 칭호 배지 + 달성 토스트"
```

---

### Task 5: 통합 QA (game-integration-qa)

**Files:** 없음(검증 전용).

- [ ] **Step 1: 통합 검증 1회** — game-integration-qa 스킬로:
  - `npx tsc --noEmit` PASS
  - `npm run build` PASS
  - `npx vitest run --pool=forks` — 전체 그린(기존 192 + 신규 3)
  - 경계면 교차검증:
    - `MILESTONE_TITLES` 키 == `SkillStatId` 11종(누락/오타 시 컴파일 에러 확인).
    - `checkStatMilestones`가 `time.ts`·`tweetSystem.ts` 두 곳 모두에 걸렸는지.
    - `pendingMilestones` 토스트 후 비워지는지(재토스트 없음).
    - `statMilestones`/`pendingMilestones`가 세이브 라운드트립·sanitize 폴백에 포함되는지.

- [ ] **Step 2: 브라우저 확인(game-run, 최소 스크린샷)** — 스탯 팝업에서 배지 노출·정렬 1장, 마일스톤 달성 토스트 1장. (data/systems 로직은 이미 vitest로 검증됨 — 스크린샷은 배지/토스트 시각 확인만.)

- [ ] **Step 3: 최종 커밋(수정 발생 시)**

```bash
git add -A
git commit -m "fix(milestones): QA 반영"
```

---

## Self-Review

- **Spec coverage:** §1 데이터→Task1, §2 일회성 보상→Task3(ONE_TIME_REWARD), §3 퍼크→Task3(PERK), §4 시스템+훅→Task3, §5 상태+백필→Task2+3, §6a 토스트→Task4-1, §6b 배지→Task4-2, 검증→Task5. 전부 매핑됨.
- **개수 정정:** 스펙의 "48"은 SkillStatId 실측 11종 기준 **44**로 정정(11×4). 설계 의도 불변.
- **Type consistency:** `checkStatMilestones`·`backfillClaimedMilestones`·`highestMilestoneTier`·`milestoneId`·`MILESTONE_TITLES`·`MILESTONE_THRESHOLDS`·`SKILL_MILESTONE_IDS`·`PERK_ACTION_PER_MILESTONE` 명칭이 태스크 간 일치.
- **미확정(구현 중 grep 1회로 확정):** `ctx.toast` 시그니처(app.ts 기존 블록), detail-row flex 여부·재활용 pill 클래스(main.css). 각 태스크에 확인 지시 명시됨 — 플레이스홀더 아님.
