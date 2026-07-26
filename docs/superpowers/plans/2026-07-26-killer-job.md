# 킬러 직업(momo.com) Implementation Plan

> 솔로 순차 실행. 태스크 완료 시마다 체크박스 즉시 갱신(재개 지점 보존).

> **진행 상태(2026-07-26):** Task 1~5 구현 완료·타입클린(killer.test 5/5 통과). Task 6(발견 힌트)은 exploreSystem 동시편집 충돌 회피로 보류. **Task 7 통합검증(build/vitest/game-run)은 워킹트리의 finance·sports·fashion·travel 카테고리 미완성이 런타임 import까지 깨뜨려 차단됨 — 그 WIP 해소 후 실행.** 코어 루프(momo.com→DM 수락→일요일 배정→작업하기 입력→성공/실패→3회 게임오버)는 killer.test로 검증됨.

**Goal:** momo.com 에로서적 사이트에서 서적요청 → momo DM → 킬러 취직. 매주 일요일 타겟 배정, 타겟 트윗에서 위치 단어를 찾아 토요일까지 [작업하기]로 입력해 암살. 실패 3회 누적 시 본인이 처리(게임오버).

**Architecture:** 기존 직업(employment/AV/author)과 **독립 트랙**. `data→systems→ui` 단방향. 타겟은 예언 계정(`data/omenAccount.ts`)과 같은 고정 NPC 방식(전용 트윗). 주간 사이클은 `onNewDay`의 요일 판정(`dayOfWeek`, 0=일·6=토)으로 돌린다.

## Global Constraints
- momo.com은 **성인모드 ON**에서만 내용이 보인다. 주소창 입력으로 바로 접속(발견 힌트는 트윗/다트핀에 있지만 게이트는 아님).
- 의뢰비 = base × (1 + 역량). 역량 = (지식+운동+어휘력+IT)/(4×999) + 평판/100, 정규화(0~2 → 0~1 스케일). 고스탯=고액.
- 킬러는 **자발적 사퇴 없음**. active=true 되면 유지.
- 위치 검증: 입력을 정규화(공백·조사 제거, 소문자화 불필요-한글) 후 타겟 `answers[]`와 대조. 오타 불통과.
- 초기 타겟 5명(순환). 실패 3회 → `state.gameOver` 설정.
- 커밋 메시지 말미 Co-Authored-By 라인.

---

### Task 1: core 타입·상태·세이브
**Files:** `src/core/types.ts`, `src/core/state.ts`, `src/systems/save.ts`

- [ ] `types.ts`: 추가
```ts
export interface KillerAssignment {
  targetId: string;   // data/killerTargets.ts의 타겟 id
  assignedDay: number; // 배정된 일요일 day
  deadlineDay: number; // 이 day(다음 일요일)에 미완이면 실패
}
export interface KillerJob {
  active: boolean;
  fails: number;      // 3이면 게임오버
  completed: number;  // 누적 성공(통계·의뢰비 로그)
  assignment: KillerAssignment | null;
}
```
그리고 `GameState`에 `killerJob: KillerJob | null;` + `momoOfferedDay: number;`(서적요청 DM 중복 방지) 추가.
- [ ] `state.ts` createInitialState: `killerJob: null,` `momoOfferedDay: -1,`
- [ ] `save.ts` sanitize: `state.killerJob ??= null; state.momoOfferedDay ??= -1;`
- [ ] typecheck

### Task 2: data — 타겟·에로서적·힌트
**Files:** `src/data/killerTargets.ts`(신규), `src/data/momoBooks.ts`(신규)

- [ ] `momoBooks.ts`: `MOMO_BOOKS: { title: string; blurb: string }[]` — 에로서적 목록+소개文(가벼운 수준, 8~12권). 성인 톤.
- [ ] `killerTargets.ts`:
```ts
export interface KillerTarget {
  id: string;
  name: string;
  handle: string;   // @없이
  bio: string;
  hint: string;     // momo DM에 들어갈 힌트("주말에 자주 간다더라")
  answers: string[];// 정답 위치(정규화 비교용, 동의어 포함)
  tweets: string[]; // 주간 트윗 5~8개 — 정답 위치 단어 포함 + 미끼 장소들
}
export const KILLER_TARGETS: KillerTarget[] = [ /* 5명 */ ];
export function targetById(id: string): KillerTarget | undefined { ... }
```
각 타겟 트윗은 정답 장소를 한 곳에 명확히 심고(예: 토요일 갈 곳), 미끼 장소 2~3개를 섞는다. `answers`는 정규화(공백제거)한 정답 + 동의어.
- [ ] typecheck

### Task 3: systems — killer 로직
**Files:** `src/systems/killer.ts`(신규), `src/systems/time.ts`(onNewDay 훅), `src/data/accounts.ts` 또는 explore(타겟 프로필 조회)

- [ ] `killer.ts`:
```ts
export const KILLER_MAX_FAILS = 3;
export function normalizeLocation(s: string): string; // 공백·조사(을/를/에/에서/로 등 어미) 제거
export function killerFee(state: GameState): number;   // 역량 스케일
export function acceptKillerJob(state: GameState): void; // active=true, 첫 배정은 다음 일요일 훅에서
export function killerWeeklyTick(state: GameState): void; // onNewDay 말미: 일요일이면 실패판정+새배정+DM
export function attemptHit(state: GameState, input: string): { ok: boolean; fee?: number; msg: string };
export function makeTargetAccount(targetId: string, day: number): Account | null; // 고정 NPC 프로필(전용 트윗)
```
- 주간 훅: `dayOfWeek(state.day)===0`(일)일 때 — assignment 있고 미완 → fails++, 실패 DM. fails≥3 → `state.gameOver = KILLER_DEAD_REASON`. 그 후 active면 새 타겟 배정(assignment 세팅 + momo 배정 DM: 핸들+힌트).
- `attemptHit`: 마감(deadlineDay) 전 + assignment 존재 시, normalize(input)이 target.answers.map(normalize) 안에 있으면 성공 → 의뢰비 지급(`state.money += fee`), completed++, assignment=null.
- [ ] `time.ts` onNewDay 말미에 `killerWeeklyTick(state)` 호출(checkAchievements 인근).
- [ ] 타겟 프로필 접근: 핸들로 `KILLER_TARGETS` 매칭되면 `makeTargetAccount`로 고정 프로필 반환(exploreSystem.accountForTweet 또는 검색 경로에 훅). **읽는 경로 하나는 보장**(momo DM에서 프로필 열기 버튼이 가장 확실 — Task 5에서 연결).
- [ ] 회귀 테스트 `src/__tests__/killer.test.ts`: normalizeLocation, attemptHit 정답/오답, 주간 실패 누적 3→gameOver, 의뢰비 스탯 스케일.
- [ ] typecheck + 테스트

### Task 4: ui — momo.com 사이트 + 라우팅
**Files:** `src/ui/momo.ts`(신규), `src/ui/browser.ts`, `src/ui/context.ts`(UIState 플래그), `src/styles/main.css`

- [ ] `context.ts` UIState: `momoSiteOpen: boolean;` + init false.
- [ ] `browser.ts`: `momo.com` URL 라우팅 추가(onkeydown — 성인모드면 열고, 아니면 "페이지를 찾을 수 없습니다"). `closeOverlays`에 `momoSiteOpen=false` 추가. content 분기에 `renderMomo`. currentUrl에 momo.com.
- [ ] `momo.ts` `renderMomo(ctx)`: 에로서적 목록(MOMO_BOOKS, 소개文) + 하단 [서적요청] 버튼 → `requestBookAndOfferDM`(momo DM 스폰 "…할 수 있겠어?"). 이미 killer active/제안이력이면 버튼 문구 변경.
- [ ] CSS: momo 사이트 스타일(다크 톤).
- [ ] typecheck

### Task 5: ui — 현생살기 '일' 탭 + 작업하기 + DM 연동
**Files:** `src/ui/offlineModal.ts`, momo DM 처리(`src/systems/dm.ts` 또는 killer.ts helper)

- [ ] momo DM: 서적요청 → DM 스레드 생성("momo"). 수락/거절 버튼 → 수락 시 `acceptKillerJob`. 주간 배정·실패·게임오버 DM은 killerWeeklyTick가 스레드에 push.
- [ ] `offlineModal.ts`: **일 탭 신설**(자기개발 옆). 아르바이트 UI를 이 탭으로 이관. 킬러 active면 [작업하기] 버튼 → 위치 입력 모달(input + 확인) → `attemptHit` → 결과 토스트/알림. 현재 임무 정보(타겟 핸들·마감 요일·남은 일수) 표시.
- [ ] typecheck

### Task 6: 발견 힌트 (선택, 가벼움)
**Files:** `src/data/`(피드 트윗), `src/data/dartpin.ts`
- [ ] momo.com을 넌지시 홍보하는 트윗 1~2개(exploreTweets 특수 트윗 풀) + 다트핀 게시글 1개. 접속 게이트는 아님(발견 유도만).

### Task 7: 통합 QA
- [ ] game-integration-qa: typecheck·build·vitest 전체 그린. 경계면(killerJob 세이브 왕복, gameOver 연동, 타겟 answers 정규화 일치, 일 탭 아르바이트 이관 후 기존 아르바이트 진입 경로 정상).
- [ ] game-run: momo.com 접속→서적요청→DM 수락, 일요일 배정 DM, 타겟 프로필 트윗 읽기, 작업하기 입력 성공/실패 스크린샷.

---

## 진행 방식
솔로 순차(Task 1→7). 각 태스크 typecheck까지; build·vitest·game-run은 Task 7에서 통합 1회. data(타겟 트윗·에로서적)는 한국어 창작 품질 유지.
