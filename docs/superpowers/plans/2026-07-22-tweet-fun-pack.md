# 트윗 재미 팩 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SNS 트윗의 재미를 올리는 4개 모듈(떡상 연출·인용 트윗·심야 취중 트윗·트친)을 계층 정합성을 지키며 추가한다.

**Architecture:** `data(상수·문구) → systems(규칙·판정) → ui(화면·연출)` 단방향. 신규 저장 필드는 `createInitialState` 기본값 + `systems/save.ts` 폴백. 순수 로직은 vitest 회귀 테스트, UI는 typecheck/build로 검증.

**Tech Stack:** TypeScript + Vite, vitest, 프레임워크 없는 el()/mount() DOM 헬퍼.

## Global Constraints

- 스탯 스케일: 스킬 0~999, 리소스 0~100. 팔로워는 `changeFollowers(state, delta)`로만 변경.
- 상태 변경은 `store.dispatch`(UI에선 `ctx.update`)로만. 연출/블러는 순수 표시(상태 변경 금지).
- 신규 persist 필드는 반드시 `createInitialState`(src/core/state.ts) 기본값 + `sanitize`(src/systems/save.ts) 폴백 추가.
- 밸런스 수치는 전부 `data/`에 대문자 상수로. 실존 인물/상표 패러디 금지, 한국어 창작 톤 유지.
- 검증: 각 모듈 끝에 `npm run typecheck && npm run build && npm test`. 커밋은 **사용자가 요청할 때만**(체크포인트는 논리 단위 표시용).
- 의존 순서: **모듈 A 먼저**(B/C가 떡상 판정을 재사용). B·C·D는 상호 독립 → 병행 가능.

---

## File Structure

**신규 파일**
- `src/data/quote.ts` — QRT 톤 정의·코멘트 문구 풀·QRT 밸런스 상수.
- `src/data/drunk.ts` — 취중 트윗 문구 풀·DRUNK_CHANCE 등 상수.
- `src/data/tchin.ts` — 트친 상수·응원/성사 문구.
- `src/systems/quote.ts` — QRT 판정(성공/역풍·논란 연결·quoted 트윗 생성).
- `src/systems/drunk.ts` — 취중 발동·블라인드 게시·이불킥 삭제/방치.
- `src/systems/tchin.ts` — 트친 상호작용 누적·성사·도달 배율·트친 리트윗 스폰.
- `src/ui/ddeoksang.ts` — 떡상 오버레이(카운트업·폭죽·배너).
- `src/ui/quoteModal.ts` — QRT 작성 모달.
- `src/ui/drunkModal.ts` — 취중 트윗 팝업 + 이불킥 팝업.
- `src/__tests__/tweetFunPack.test.ts` — 4모듈 순수 로직 회귀 테스트.

**수정 파일**
- `src/core/types.ts` — `Tweet.quoted?`, `GameState.drunkPending/pendingRegretTweetId`, 활성계정 `tchins/tchinProgress`; PostResult에 `ddeoksang`.
- `src/core/state.ts` — 신규 필드 초기값.
- `src/systems/save.ts` — 신규 필드 폴백.
- `src/systems/followers.ts` 또는 `src/systems/tweetSystem.ts` — 떡상 판정·보너스·트친 도달 배율 적용점.
- `src/data/tweetFun.ts`(신규 소상수) 또는 기존 followers 상수에 떡상 상수.
- `src/ui/sns/composeModal.ts` — 게시 결과 `ddeoksang`이면 떡상 오버레이 호출.
- `src/ui/sns/snsPages.ts` — 둘러보기 트윗 카드에 '인용' 버튼; 트친 표시.
- `src/ui/app.ts` — 강제팝업 체인에 취중/이불킥 팝업 편입; 루트 블러 클래스.
- `src/styles/main.css` — 떡상 오버레이·QRT 인용 카드·블러·트친 배지 스타일.
- `src/data/achievements.ts` — '첫 떡상' 히든 도전과제.

---

## Phase 1 — 모듈 A · 떡상 연출

### Task A1: 떡상 판정 + 보너스 (systems 순수 로직)

**Files:**
- Modify: `src/core/types.ts` (PostResult류 반환 타입에 `ddeoksang?: boolean; ddeoksangGain?: number`)
- Create: `src/data/tweetFun.ts` (`DDEOKSANG_MIN=300`, `DDEOKSANG_RATE=0.05`, `DDEOKSANG_BONUS_RATE=0.3`)
- Modify: `src/systems/tweetSystem.ts` (게시 직후 델타로 떡상 판정, 보너스 팔로워 1회 가산, 결과에 표시)
- Test: `src/__tests__/tweetFunPack.test.ts`

**Interfaces:**
- Consumes: `changeFollowers(state, delta)`, `getActiveAccount(state).followers`, `postTweet(...)` 반환 객체.
- Produces: `isDdeoksang(delta, followers): boolean`, `ddeoksangBonus(delta): number` (data 상수 사용). postTweet 반환에 `ddeoksang`/`ddeoksangGain` 포함.

- [x] **Step 1: 실패 테스트 작성** — `isDdeoksang`: delta 300↑(팔 0)이면 true, 299면 false; 팔 10000이면 500 미만은 false, 500↑ true. `ddeoksangBonus(1000)===300`.
- [x] **Step 2: 테스트 실패 확인** — `npx vitest run src/__tests__/tweetFunPack.test.ts` → FAIL(미정의).
- [x] **Step 3: 구현** — `src/data/tweetFun.ts` 상수 + `systems/tweetSystem.ts`에 `isDdeoksang`/`ddeoksangBonus` 추가, postTweet 말미에서 판정→보너스 `changeFollowers` 1회(재귀 판정 금지)→반환에 표시.
- [x] **Step 4: 통과 확인** — vitest PASS.
- [x] **Step 5: 체크포인트** — typecheck 통과 확인.

### Task A2: 떡상 오버레이 (ui)

**Files:**
- Create: `src/ui/ddeoksang.ts` (`showDdeoksang(ctx, {likes, retweets, gain})`)
- Modify: `src/ui/sns/composeModal.ts` (게시 onclick에서 `res.ddeoksang`이면 토스트 뒤 `showDdeoksang` 호출)
- Modify: `src/styles/main.css` (`.ddeoksang-*` 카운트업·폭죽·배너)
- Modify: `src/data/achievements.ts` ('첫 떡상' 히든 도전과제 + 트리거는 systems에서 pendingAchievements 큐)

**Interfaces:**
- Consumes: A1의 `res.ddeoksang`, `res.ddeoksangGain`.
- Produces: `showDdeoksang(ctx, opts)` — ctx.openModal 기반 오버레이(2.5초/탭 닫힘). 상태 변경 없음.

- [x] **Step 1: 오버레이 구현** — el()로 배너 '떡상 중 🔥' + 숫자 카운트업(setInterval, 닫힐 때 clear) + 폭죽. `.modal` 레이어 재사용.
- [x] **Step 2: 게시 연결** — composeModal 게시 성공 분기에서 `ddeoksang`이면 호출. QRT/취중 경로도 동일 결과 필드를 쓰므로 재사용.
- [x] **Step 3: 도전과제** — '첫 떡상' 달성 시 `pendingAchievements` 큐(기존 패턴).
- [x] **Step 4: 검증** — typecheck+build. (게임 화면 확인은 서버 승인 시 game-run.)

---

## Phase 2 — 모듈 B · 인용 트윗(QRT)

### Task B1: Tweet.quoted 필드 + 세이브 (core)

**Files:**
- Modify: `src/core/types.ts` (`Tweet.quoted?: { authorName; authorHandle; text; attribute }`)
- Modify: `src/systems/save.ts` (기존 트윗은 quoted 부재 = 정상; shape 손상 방어만)

**Interfaces:**
- Produces: `Tweet.quoted` 옵셔널 스냅샷(원문 id 아님).

- [x] **Step 1: 타입 추가** — `Tweet`에 `quoted?` 필드.
- [x] **Step 2: 세이브** — quoted는 옵셔널이라 폴백 불필요(주석만). typecheck 통과.

### Task B2: QRT 판정 로직 (systems + data)

**Files:**
- Create: `src/data/quote.ts` (`QRT_TONES`(agree/hype/snark 라벨·배율), `QRT_HIT_RATE=0.15`, `QRT_RATIO_RATE=0.08`, 코멘트 문구 풀 by tone)
- Create: `src/systems/quote.ts` (`postQuoteTweet(state, target: Tweet, tone, text): QuoteResult`)
- Test: `src/__tests__/tweetFunPack.test.ts`

**Interfaces:**
- Consumes: `getAffinity(내 성향, target.attribute)`, `changeFollowers`, `controversy` 트리거(기존 systems/controversy), `getActiveAccount`, `isDdeoksang`(A1), `TWEET_ACTION_COST`.
- Produces: `postQuoteTweet(state, target, tone, text): { followerDelta; ratioed: boolean; ddeoksang: boolean }` — 내 타임라인에 quoted 박힌 트윗 생성, 궁합 음수면 역풍(-팔로워+논란확률).

- [x] **Step 1: 실패 테스트** — 궁합 양수+인기 높은 target → followerDelta>0, ratioed=false; 궁합 음수 target → followerDelta<0, ratioed=true. quoted 스냅샷이 타임라인 트윗에 실림.
- [x] **Step 2: 실패 확인** — vitest FAIL.
- [x] **Step 3: 구현** — 판정식(설계문서 모듈B), 성공 시 `대상인기×QRT_HIT_RATE×(1+aff보정)×톤배율`, 역풍 시 `-대상인기×QRT_RATIO_RATE` + 논란 확률. 트윗 생성 시 `quoted` 채움. 떡상 판정 재사용.
- [x] **Step 4: 통과 확인** — vitest PASS.
- [x] **Step 5: 체크포인트** — typecheck.

### Task B3: QRT UI (인용 버튼 + 모달 + 인용 카드)

**Files:**
- Create: `src/ui/quoteModal.ts` (`renderQuoteModal(ctx, target)` — 톤 칩 선택 + 코멘트 미리보기 + 등록)
- Modify: `src/ui/sns/snsPages.ts` (둘러보기/검색/홈 남 트윗 카드 반응행에 '인용' 버튼 → openModal(renderQuoteModal))
- Modify: `src/ui/components.ts` 또는 트윗 카드 렌더 (내 타임라인 트윗이 `quoted`면 인용 카드 렌더)
- Modify: `src/styles/main.css` (`.quote-card` 인용 카드)

**Interfaces:**
- Consumes: `postQuoteTweet`(B2). 게시 결과의 `ddeoksang`이면 `showDdeoksang`(A2).
- Produces: 인용 카드 렌더 헬퍼(트윗 카드에서 quoted 표시).

- [x] **Step 1: 인용 버튼** — 남 트윗 카드 반응행에 버튼 추가(좋아요/악플 옆). 행동력/슬롯 게이트는 일반 트윗과 동일.
- [x] **Step 2: QRT 모달** — 톤 칩(agree/hype/snark) + 선택 톤의 코멘트 문구 미리보기 + 등록 → `ctx.update(postQuoteTweet)` → 토스트/떡상.
- [x] **Step 3: 인용 카드** — 트윗 카드가 `quoted`면 원문(작성자·핸들·본문) 축약 카드로 렌더.
- [x] **Step 4: 검증** — typecheck+build.

---

## Phase 3 — 모듈 C · 심야 취중 트윗 + 이불킥

### Task C1: 취중 상태 + 발동/게시/이불킥 로직 (core + systems + data)

**Files:**
- Modify: `src/core/types.ts` (`GameState.drunkPending: boolean`, `pendingRegretTweetId: string | null`)
- Modify: `src/core/state.ts` (초기값 false/null)
- Modify: `src/systems/save.ts` (폴백 `??= false` / `??= null`)
- Create: `src/data/drunk.ts` (`DRUNK_CHANCE=0.15`, `DRUNK_TWEETS: string[]` 취중 문구 풀, 초고분산 계수)
- Create: `src/systems/drunk.ts` (`maybeGetDrunk(state)`, `postDrunkTweet(state): tweetId`, `resolveRegret(state, action:"delete"|"keep")`)
- Modify: `src/systems/time.ts` (심야 훅에서 `maybeGetDrunk`)
- Test: `src/__tests__/tweetFunPack.test.ts`

**Interfaces:**
- Consumes: `changeFollowers`, `controversy` 트리거, `advanceTime`/다음날 진행, `getActiveAccount`, `isDdeoksang`.
- Produces: `maybeGetDrunk(state): void`(확률로 drunkPending=true), `postDrunkTweet(state): string`(랜덤 취중 트윗 게시·초고분산 팔로워·pendingRegretTweetId 세팅·다음날 진행·drunkPending=false), `resolveRegret(state, action): void`(delete=트윗 제거+팔로워 반납, keep=유지+논란 확률).

- [x] **Step 1: 실패 테스트** — `postDrunkTweet` 후 타임라인에 취중 트윗 1개+`pendingRegretTweetId` 세팅+`drunkPending=false`; `resolveRegret(s,"delete")`는 그 트윗 제거+`pendingRegretTweetId=null`; `"keep")`은 유지.
- [x] **Step 2: 실패 확인** — vitest FAIL.
- [x] **Step 3: 구현** — 상태 필드 + 3함수 + 심야 훅 연결 + 세이브 폴백. 취중 문구는 DRUNK_TWEETS에서 pick.
- [x] **Step 4: 통과 확인** — vitest PASS.
- [x] **Step 5: 체크포인트** — typecheck.

### Task C2: 취중/이불킥 UI + 블러 (ui)

**Files:**
- Create: `src/ui/drunkModal.ts` (`renderDrunkTweetModal(ctx)`, `renderMorningRegretModal(ctx)`)
- Modify: `src/ui/app.ts` (강제팝업 체인: `drunkPending`→취중팝업, `pendingRegretTweetId`→이불킥팝업; 루트에 `drunk-blur` 클래스 토글)
- Modify: `src/styles/main.css` (`.drunk-blur { filter: blur } `, 취중 문구 블러, 이불킥 카드)

**Interfaces:**
- Consumes: C1의 `postDrunkTweet`/`resolveRegret`, drunkPending/pendingRegretTweetId.
- Produces: 강제팝업 2종.

- [x] **Step 1: 취중 팝업** — "술을 마셨다 🍶" + 블러된 취중 문구 + [등록]만 → `ctx.update(postDrunkTweet)` → 블러 해제. 앱 루트 블러는 drunkPending true 동안 적용.
- [x] **Step 2: 이불킥 팝업** — 다음날 아침, 어젯밤 글 또렷이 표시 + [삭제(수습)]/[방치(박제)] → `resolveRegret`.
- [x] **Step 3: app 체인 편입** — 강제팝업 우선순위에 편입(괴담/취침 근처). 블러 클래스 토글.
- [x] **Step 4: 검증** — typecheck+build.

---

## Phase 4 — 모듈 D · 트친(단짝)

### Task D1: 트친 성사 + 도달 배율 (core + systems + data)

**Files:**
- Modify: `src/core/types.ts` (활성계정 `tchins: string[]`, `tchinProgress: Record<string, number>`)
- Modify: `src/core/state.ts` (초기 [] / {}); Modify: `src/systems/save.ts` (폴백)
- Create: `src/data/tchin.ts` (`TCHIN_THRESHOLD=5`, `TCHIN_REACH=0.03`, `TCHIN_CAP=8`, 성사/응원 문구)
- Create: `src/systems/tchin.ts` (`bumpTchinProgress(state, handle): "became"|"progress"|"already"`, `tchinReachMult(state): number`, `maybeSpawnTchinBoost(state)`)
- Modify: 상호작용 지점(좋아요/악플/인용/DM) — `bumpTchinProgress` 호출
- Modify: `src/systems/tweetSystem.ts`/`followers.ts` — 팔로워 증가분에 `tchinReachMult` 곱
- Test: `src/__tests__/tweetFunPack.test.ts`

**Interfaces:**
- Consumes: `getActiveAccount`, `changeFollowers`.
- Produces: `bumpTchinProgress(state, handle)`(임계 넘으면 tchins에 추가), `tchinReachMult(state): number`(1 + min(len,CAP)×REACH), `maybeSpawnTchinBoost(state)`(낮은 확률로 트친 리트윗/응원 DM).

- [x] **Step 1: 실패 테스트** — 같은 handle 5회 `bump`→"became", tchins 포함; `tchinReachMult` 트친 2명이면 1.06; CAP 초과해도 상한.
- [x] **Step 2: 실패 확인** — vitest FAIL.
- [x] **Step 3: 구현** — 상태 필드 + 3함수 + 상호작용 지점 연결 + 도달 배율 적용 + 세이브 폴백.
- [x] **Step 4: 통과 확인** — vitest PASS.
- [x] **Step 5: 체크포인트** — typecheck.

### Task D2: 트친 UI (성사 알림 + 표시)

**Files:**
- Modify: `src/ui/sns/snsPages.ts` 또는 프로필 (트친 목록/수 소박하게 표시)
- Modify: 상호작용 호출부 — `bumpTchinProgress` 결과 "became"면 토스트("○○님과 트친이 됐어요!")
- Modify: `src/styles/main.css` (트친 배지)

**Interfaces:**
- Consumes: D1 함수·tchins.

- [x] **Step 1: 성사 알림** — 상호작용에서 "became" 시 토스트.
- [x] **Step 2: 표시** — 트친 수/목록을 과하지 않게 노출.
- [x] **Step 3: 검증** — typecheck+build.

---

## 최종 통합 검증

- [x] `npm run typecheck` 클린.
- [x] `npm run build` 성공.
- [x] `npm test` — 신규 회귀 테스트 포함 전부 통과.
- [x] 경계면 대조(game-integration-qa): 신규 심볼 잔여참조·세이브 폴백 누락·계층 역참조 없음.
- [x] 사용자 보고(추가/수정 파일·밸런스 값·조작법).

## Self-Review (완료)

- **스펙 커버리지**: 모듈 A→Task A1/A2, B→B1/B2/B3, C→C1/C2, D→D1/D2. 공통 저장/폴백·테스트 각 Task에 포함. 갭 없음.
- **플레이스홀더**: systems 로직 Task는 테스트 케이스 명시. UI Task는 이 프로젝트 관례(수동/typecheck 검증)에 맞춰 컴포넌트 구조를 서술(전체 el() 트리는 실행 시 작성). 밸런스 상수 전부 기본값 지정.
- **타입 일관성**: `isDdeoksang`/`ddeoksangBonus`(A1) → B2/C1에서 재사용, `postQuoteTweet`/`quoted`(B), `postDrunkTweet`/`resolveRegret`(C), `bumpTchinProgress`/`tchinReachMult`(D) 명칭 일관.
