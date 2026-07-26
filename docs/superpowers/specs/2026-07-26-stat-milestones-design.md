# 스탯 마일스톤 — 설계

**날짜:** 2026-07-26
**목적:** 스탯을 올려도 "재미"가 없는 문제(스탯 = 트윗 성과 보정계수일 뿐, 넘어도 새로운 게 안 열림)를 마일스톤 성취감으로 보완한다. 스킬이 정해진 문턱을 넘는 순간 **칭호·일회성 보상·소형 지속 퍼크**를 준다.

**선행 변경(이미 반영됨):** `systems/followers.ts`의 skillMul 가중 곡선을 볼록(`skill01²`)→오목(`skill01^0.6`, `SKILL_CURVE_EXP`)으로 바꿔 초반 육성이 성과에 바로 보이게 함. 마일스톤은 그 위에 얹는 별도 축이다.

---

## 결정 사항 (브레인스토밍 확정)

| 항목 | 결정 |
|---|---|
| 목적 | 마일스톤 성취감 (빌드 다양성 아님) |
| 보상 | 칭호(배지) + 일회성 축하 보상 + 지속 퍼크(균일·소형) |
| 범위 | 11 성장 스킬 × 4단계 = **44 마일스톤** (SkillStatId 실측 11종) |
| 문턱 | 100 / 300 / 600 / 999 (공통) |
| 퍼크 | 균일·소형 — 팔로워 공식과 분리 |
| 표시 | 스탯 팝업 각 스탯 옆 배지. **다음 수치·진행도 표시 안 함** |

---

## 1. 데이터 — `src/data/milestones.ts` (신규)

```ts
export const MILESTONE_THRESHOLDS = [100, 300, 600, 999] as const; // tier 0~3

// 스킬별 4개 칭호(오름차순). 48개 한국어 창작 — content-author.
export const MILESTONE_TITLES: Record<SkillStatId, [string, string, string, string]> = {
  fitness: ["동네 헬스 입문", "주 5일 헬창", "바디프로필 각", "인간 병기"],
  // ... 나머지 11 스킬
};

// 마일스톤 id = `${skill}:${tier}` 예) "fitness:2"
export function milestoneId(skill: SkillStatId, tier: number): string {
  return `${skill}:${tier}`;
}
```

- 칭호 톤: 게임의 기존 유머러스 한국어 톤 유지. 각 스킬 4단계가 **한 스킬 안에서 서사적으로 상승**하도록.
- 12 스킬: fitness, beauty, vocabulary, knowledge, (나머지는 `SkillStatId` 유니온 전체 — 구현 시 `core/types.ts`에서 확인).

## 2. 일회성 보상 — 티어 공통 템플릿 (48개 개별설계 아님)

`systems/milestones.ts`에 티어별 4템플릿:

| tier | 문턱 | 일회성 보상 |
|---|---|---|
| 0 | 100 | 10만원 |
| 1 | 300 | 10만원 + 팔로워 2천 |
| 2 | 600 | 10만원 + 팔로워 8천 |
| 3 | 999 | 10만원 + 팔로워 3만 |

- 정확한 수치는 계획서에서 기존 밸런스(트윗 1회 팔로워/소지금 규모)에 맞춰 잡는다.
- 팔로워 지급은 활성 계정에 반영. 소지금은 `state.money`.

## 3. 지속 퍼크 — 균일·소형

- **마일스톤 1개당 `state.actionMaxBonus += PERK_ACTION_PER_MILESTONE` (기본 1).**
- 기존 `actionMax(state) = MAX_RESOURCE + state.actionMaxBonus`([systems/stats.ts](../../../src/systems/stats.ts))·`actionMaxBonus` 필드를 그대로 재활용 → 신규 플러밍 0, **팔로워 공식과 완전 분리**.
- 스택 상한(알려진 천장): 전 스킬 만렙 시 최대 +48. 그 시점은 사실상 클리어 구간이라 무해하나, 크게 느껴지면 `PERK_ACTION_PER_MILESTONE`를 낮추거나 캡을 둔다(튜닝 상수).
- ⚠️ `actionMaxBonus`는 지금 작업관리자 Cheat.exe(+20, 게임당 1회)가 쓰는 필드다 — 마일스톤이 **누적(+=)** 으로만 더하므로 치트와 충돌 없음. 단 세이브 로드 시 재지급 금지(§5의 claimed 집합으로 보장).

## 4. 시스템 — `src/systems/milestones.ts` (신규, achievements 패턴 미러)

```ts
// achievements.checkAchievements 미러. 새로 돌파한 마일스톤에 보상 지급 + 토스트 큐.
export function checkStatMilestones(state: GameState): string[] {
  const newly: string[] = [];
  for (const skill of SKILL_IDS) {
    const val = state.skills[skill];
    MILESTONE_THRESHOLDS.forEach((thr, tier) => {
      const id = milestoneId(skill, tier);
      if (state.statMilestones.includes(id)) return;
      if (val >= thr) {
        state.statMilestones.push(id);
        grantMilestoneReward(state, skill, tier); // 일회성 + actionMaxBonus += perk
        state.pendingMilestones.push(id);
        newly.push(id);
      }
    });
  }
  return newly;
}
```

- **판정 훅 신설 안 함.** `checkAchievements`가 이미 걸린 두 지점(`onNewDay` 말미 · `postTweet` 말미)에 나란히 호출. 스킬은 하루 중 여러 경로로 오르므로 day/트윗 시점 일괄 판정(achievements와 동일한 지연을 허용).
  - 확인 필요: `checkAchievements` 호출부 정확 위치(systems/time·systems/tweetSystem 추정) — 계획서에서 grep으로 확정.
- **영구성:** 스킬이 페널티로 하락해도 claimed id는 남으므로 칭호 유지·재지급 없음(멱등). achievement와 동일.
- data(milestones)·core만 의존(ui/systems 순환 금지). `grantMilestoneReward`는 순수 state 변경.

## 5. 상태 — `core/types.ts` + `core/state.ts` + `systems/save.ts`

`pendingAchievements` 선례를 그대로 미러링:

- `core/types.ts`: `statMilestones: string[]`(획득 id) · `pendingMilestones: string[]`(토스트 큐) 2필드 추가.
- `core/state.ts` `createInitialState`: 둘 다 `[]`.
- `systems/save.ts` `sanitize`: 구세이브 폴백 — `if (!Array.isArray(state.statMilestones)) state.statMilestones = []` (pendingMilestones 동일). 구세이브는 이미 스킬 100+ 일 수 있으므로 **로드 직후 소급 판정을 하지 않고**, 다음 day/tweet의 `checkStatMilestones`가 claimed 없이 돌파분을 한꺼번에 인정한다 → 이때 일회성 보상이 소급 지급되는 문제. **해결:** sanitize에서 신규 세이브에 한해 현재 스킬 기준 마일스톤을 **보상 없이 claimed로 백필**(칭호만 소급, 일회성·퍼크는 미지급). 계획서에서 백필 헬퍼 명시.

## 6. UI

### 6a. 토스트 — `ui/app.ts`
`pendingAchievements` 드레인 블록([app.ts:215~](../../../src/ui/app.ts))을 미러링해 `pendingMilestones`도 마이크로태스크로 드레인 → `"🏅 {스킬} 마일스톤: {칭호} 달성!"` 토스트 후 배열 비움. 재진입 가드(`milestoneToastScheduled`) 동일 패턴.

### 6b. 배지 — `ui/statusPopup.ts` `detailStatRow`
- 각 스탯 행에 **현재 획득한 최고 티어 칭호** 배지 1개 삽입(`state.statMilestones`에서 해당 스킬 최고 tier 조회 → `MILESTONE_TITLES[skill][tier]`).
- 미획득 스킬은 배지 없음(빈칸). **다음 문턱 수치·진행 바 표시 안 함**(요청).
- 신규 CSS 클래스 1개(`.stat-badge` 류) — 기존 유사 배지 클래스 grep 후 스타일 재활용.

---

## 계층 파급 & 진행 방식

data(칭호+보상 템플릿) → core(상태 2필드) → systems(판정+지급+훅) → ui(토스트+배지+CSS). **3계층+타입 확장이지만 각 계층 변경이 소형(파일 1~2개·100줄 안팎)** → 팀 부팅 없이 **솔로 순차**(data→core→systems→ui→통합 QA 1회)로 진행. 브레인스토밍이 이미 조사를 마친 이어하기이므로 솔로가 기본.

## 검증

- 각 계층 구현 후 typecheck.
- 통합 QA 1회(game-integration-qa): build + `npx vitest run --pool=forks` + 경계면 교차검증.
  - `MILESTONE_TITLES` 키가 `SkillStatId` 유니온과 정확히 일치(누락 스킬 = 컴파일 에러여야 함, `Record<SkillStatId, ...>`로 강제).
  - `checkStatMilestones` 호출부가 `checkAchievements`와 같은 두 지점에 모두 걸렸는지.
  - 세이브 라운드트립: 구세이브 로드 → 칭호 소급·일회성 미지급 확인.
- 회귀 테스트 1개 추가: 스킬을 100/300/600/999로 올렸을 때 claimed 개수·actionMaxBonus 증가·pending 토스트가 정확한지(멱등: 두 번 호출해도 재지급 없음).

## 명시적 비목표 (YAGNI)

- 빌드 다양성(스킬별 상이한 해금) — 이번 범위 아님.
- 칭호 도감 전용 화면 — 스탯 팝업 인라인으로 충분.
- 다음 문턱 진행도 표시 — 요청에서 제외.
- 스킬별 테마 퍼크 — 균일 퍼크로 결정.
