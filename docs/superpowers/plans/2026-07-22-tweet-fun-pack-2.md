# 트윗 재미 팩 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** SNS 트윗 재미를 올리는 3개 모듈(기사화·트친소·트친 생일)을 계층 정합성을 지키며 추가한다.

**Architecture:** `data(상수·문구) → systems(규칙·판정) → ui(화면·팝업)` 단방향. 신규 저장 필드는 `createInitialState` 기본값 + `systems/save.ts` 폴백. 순수 로직은 vitest 회귀 테스트(`__tests__/tweetFunPack2.test.ts`), UI는 typecheck/build로 검증.

**Tech Stack:** TypeScript + Vite, vitest, 프레임워크 없는 el()/mount() DOM 헬퍼.

## Global Constraints

- 스탯 스케일: 스킬 0~999, 리소스 0~100. 팔로워는 `changeFollowers(state, delta)`로만 변경.
- **게시 트윗은 반드시 `pushTimeline(account, tweet)`(core/state)를 거친다.** `timeline.unshift` 직접 호출 금지(`TIMELINE_MAX`·`postCount` 불변식).
- 신규 persist 필드는 반드시 `createInitialState`(src/core/state.ts) 기본값 + `sanitize`(src/systems/save.ts) 폴백 추가.
- **강제팝업 상태 플래그는 팝업의 선택이 반드시 클리어**한다(안 하면 매 렌더 재팝업 — `pendingRegretTweetId` 선례).
- 결정론: 생일 날짜는 `hashInt(handle)`(utils/random) 시드로 산출. `Math.random`으로 뽑지 않는다.
- 밸런스 수치는 전부 `data/`에 대문자 상수로. 실존 인물/상표 패러디 금지, 한국어 창작 톤 유지.
- `AppointmentKind` 유니온을 넓히면 `ui/calendar.ts`의 `KIND_ICON`(exhaustive `Record<AppointmentKind, IconName>`)이 컴파일 에러로 강제한다 — 함께 채운다.
- 검증: 각 모듈 끝에 `npm run typecheck && npm run build && npm test`. 커밋은 각 Task Step에 표시(사용자 승인 후 실행).
- 모듈 A·B·C는 상호 독립 → 병행 가능. B·C는 기구현 모듈 D(트친: `tchins`/`tchinProgress`/`bumpTchinProgress`/`maybeSpawnTchinBoost`)를 재사용한다.

---

## File Structure

**신규 파일**
- `src/data/news.ts` — 언론사명·헤드라인 템플릿·기사화 밸런스 상수.
- `src/data/tchinso.ts` — 트친소 트윗/응답 문구·쿨다운·선채움 상수.
- `src/data/birthday.ts` — 생일 카톡/축하 문구·생일 범위·보너스 상수.
- `src/systems/news.ts` — 기사화 예약(`maybeQueueNews`)·해소(`resolveNews`).
- `src/ui/newsModal.ts` — 기사화 아침 팝업(정상/왜곡+선택지).
- `src/ui/tchinsoModal.ts` — 트친소 확인·결과 모달.
- `src/__tests__/tweetFunPack2.test.ts` — 3모듈 순수 로직 회귀 테스트.

**수정 파일**
- `src/core/types.ts` — `PendingNews` 타입 + `GameState.pendingNews`/`pendingBirthday`; `PlayerAccount.lastTchinsoDay`; `AppointmentKind`에 `"birthday"`.
- `src/core/state.ts` — 신규 필드 초기값.
- `src/systems/save.ts` — 신규 필드 폴백.
- `src/systems/tweetSystem.ts` — 떡상 직후 `maybeQueueNews` 훅.
- `src/systems/quote.ts`·`src/systems/drunk.ts` — 떡상 분기에 `maybeQueueNews` 훅(동일 1줄).
- `src/systems/tchin.ts` — `canPostTchinso`/`postTchinso`(트친소), `scheduleBirthday`/`sendBirthdayTweet`(생일).
- `src/systems/appointments.ts` — `dueAppointments`에서 `birthday` 제외(비차단).
- `src/systems/time.ts` — `onNewDay`에서 생일 도래 감지 → 카톡 + `pendingBirthday` 세팅 + 약속 소멸.
- `src/ui/app.ts` — 아침 강제팝업 체인에 `pendingNews` 편입.
- `src/ui/calendar.ts` — `KIND_ICON`에 `birthday` 아이콘.
- `src/ui/sns/snsView.ts` — 홈 상단 '트친소 올리기' 버튼 + '오늘 트친 생일' 배너.
- `src/styles/main.css` — 기사화 팝업·트친소 결과·생일 배너 스타일.

---

## Phase 1 — 모듈 A · 내 트윗이 기사화

### Task A1: PendingNews 상태 + 기사화 콘텐츠 (core + data)

**Files:**
- Modify: `src/core/types.ts` (`PendingNews` 타입 + `GameState.pendingNews`)
- Modify: `src/core/state.ts` (`pendingNews: null`)
- Modify: `src/systems/save.ts` (폴백 `state.pendingNews ??= null`)
- Create: `src/data/news.ts`

**Interfaces:**
- Produces: `PendingNews = { tweetId: string; tweetText: string; gain: number; distorted: boolean }`. `GameState.pendingNews: PendingNews | null`.
- Produces(data): `NEWS_CHANCE=0.25`, `NEWS_DISTORT_RATE=0.4`, `NEWS_BOOST_RATE=0.5`, `NEWS_CLARIFY_RATE=0.2`, `NEWS_IGNORE_LOSS_RATE=0.15`, `NEWS_BACKFIRE_CHANCE=0.2`, `NEWS_OUTLETS: string[]`, `NEWS_HEADLINES_NORMAL: string[]`, `NEWS_HEADLINES_DISTORTED: string[]`. (헤드라인 조립은 systems/news의 `newsHeadlineFor`.)

- [ ] **Step 1: `PendingNews` 타입 + GameState 필드 추가**

`src/core/types.ts` — `GameState` 인터페이스에 필드 추가(`pendingRegretTweetId` 근처):
```ts
/**
 * 떡상 트윗이 기사화 예약됐으면 그 스냅샷(다음날 아침 강제팝업). 없으면 null.
 * ui(newsModal)가 처리 후 null로 클리어한다.
 */
pendingNews: PendingNews | null;
```
같은 파일 상단부(다른 보조 타입 근처)에:
```ts
export interface PendingNews {
  tweetId: string;
  /** 원 트윗 본문 스냅샷(원 트윗이 타임라인 컷으로 사라져도 헤드라인 생성 가능) */
  tweetText: string;
  /** 떡상 증가분(2차 유입·손실 계산 기준) */
  gain: number;
  /** 왜곡 보도 여부(예약 시점 확정) */
  distorted: boolean;
}
```

- [ ] **Step 2: 초기값 + 세이브 폴백**

`src/core/state.ts` `createInitialState` 반환 객체에 `pendingNews: null,` 추가(`postSlotIncreasedTo` 근처).
`src/systems/save.ts` sanitize의 상태 레벨 폴백부에 `state.pendingNews ??= null;` 추가(`state.postSlotIncreasedTo ??= null;` 근처).

- [ ] **Step 3: `src/data/news.ts` 작성**

```ts
/**
 * 내 트윗이 기사화 — 언론사명·헤드라인 템플릿·밸런스 상수.
 * 판정은 systems/news가 한다. 실존 언론사/인물 패러디 금지.
 */

/** 떡상 시 기사화 예약 확률. */
export const NEWS_CHANCE = 0.25;
/** 예약된 기사가 왜곡 보도일 확률(나머지는 정상). */
export const NEWS_DISTORT_RATE = 0.4;
/** 정상 보도 2차 유입 = gain × 이 값. */
export const NEWS_BOOST_RATE = 0.5;
/** 왜곡 [해명] 성공 시 동정 유입 = gain × 이 값. */
export const NEWS_CLARIFY_RATE = 0.2;
/** 왜곡 [무시] 시 손실 = gain × 이 값. */
export const NEWS_IGNORE_LOSS_RATE = 0.15;
/** 왜곡 [해명]이 역풍날 확률(추가 손실 + 논란). */
export const NEWS_BACKFIRE_CHANCE = 0.2;

/** 언론사 패러디명(실존 금지). */
export const NEWS_OUTLETS: string[] = [
  "데일리트짹", "스포츠서울숲", "짹짹일보", "인터넷연예뉴스", "오늘의짹",
];

/** 정상 헤드라인 템플릿. {snippet}=트윗 발췌. */
export const NEWS_HEADLINES_NORMAL: string[] = [
  "네티즌 A씨의 '{snippet}' 게시물, 온라인서 화제",
  "\"{snippet}\"… SNS 달군 한 줄에 누리꾼 폭발적 공감",
  "화제의 트윗 '{snippet}', 하루 만에 수만 회 공유",
];

/** 왜곡 헤드라인 템플릿(문맥 잘림). */
export const NEWS_HEADLINES_DISTORTED: string[] = [
  "[단독] '{snippet}' 발언 논란… 진의 두고 갑론을박",
  "\"{snippet}\"… 부적절 발언 도마 위, 누리꾼 갑론을박",
  "'{snippet}' 트윗에 시끌… \"실망\" vs \"오해\"",
];
```
(주: 헤드라인 랜덤 pick·조립은 systems/news의 `newsHeadlineFor`가 담당한다 — data는 상수·템플릿만 둔다. `{snippet}` 토큰을 트윗 발췌로 치환.)

- [ ] **Step 4: 체크포인트** — `npm run typecheck` 통과 확인.

- [ ] **Step 5: 커밋**
```bash
git add src/core/types.ts src/core/state.ts src/systems/save.ts src/data/news.ts
git commit -m "feat(news): PendingNews 상태 + 기사화 콘텐츠·상수"
```

### Task A2: 기사화 판정·해소 로직 (systems + 훅 + 테스트)

**Files:**
- Create: `src/systems/news.ts`
- Modify: `src/systems/tweetSystem.ts` (떡상 직후 훅), `src/systems/quote.ts`·`src/systems/drunk.ts` (동일 훅)
- Test: `src/__tests__/tweetFunPack2.test.ts`

**Interfaces:**
- Consumes: `changeFollowers`, `rollControversy`(systems/controversy), `getActiveAccount`, `pushTimeline`, `chance`/`pick`/`randInt`/`uid`, A1 상수.
- Produces:
  - `maybeQueueNews(state, tweetId: string, tweetText: string, gain: number): void` — `chance(NEWS_CHANCE)`면 `state.pendingNews` 세팅(distorted=`chance(NEWS_DISTORT_RATE)`). 이미 예약돼 있으면 스킵.
  - `resolveNews(state, action: "ack" | "clarify" | "ignore"): number` — 팔로워 델타 반환, `pendingNews=null` 클리어. 정상은 "ack"만 유효(예약 시 gain 2차유입 즉시 가산 여부는 아래).

**판정식(설계 모듈 A):**
- 정상 보도 확인("ack"): `+round(gain × NEWS_BOOST_RATE)` 팔로워, 평판 `+3`.
- 왜곡 "clarify": 무료 해명 트윗 `pushTimeline`. `chance(NEWS_BACKFIRE_CHANCE)`면 역풍(`-round(gain × NEWS_IGNORE_LOSS_RATE)` + `rollControversy(state, 0.15)`), 아니면 동정 유입 `+round(gain × NEWS_CLARIFY_RATE)` + 평판 `+2`.
- 왜곡 "ignore": `-round(gain × NEWS_IGNORE_LOSS_RATE)` + `rollControversy(state, 0.2)`.

- [ ] **Step 1: 실패 테스트 작성** (`src/__tests__/tweetFunPack2.test.ts` 신규)

```ts
import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { maybeQueueNews, resolveNews } from "@/systems/news";
import { NEWS_BOOST_RATE, NEWS_IGNORE_LOSS_RATE } from "@/data/news";

describe("기사화 (모듈 A)", () => {
  it("maybeQueueNews: 예약되면 스냅샷이 담기고, 중복 예약은 스킵", () => {
    const s = createInitialState();
    // 강제로 예약: 확률을 우회하기 위해 직접 세팅 경로를 검증 — 예약 상태를 만들고 필드 확인.
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: false };
    const before = s.pendingNews;
    maybeQueueNews(s, "t2", "다른글", 2000); // 이미 예약 → 스킵
    expect(s.pendingNews).toBe(before);
  });

  it("resolveNews('ack'): 정상 2차 유입 + 클리어", () => {
    const s = createInitialState();
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: false };
    const acc = getActiveAccount(s);
    const f0 = acc.followers;
    const delta = resolveNews(s, "ack");
    expect(delta).toBe(Math.round(1000 * NEWS_BOOST_RATE));
    expect(acc.followers).toBe(f0 + delta);
    expect(s.pendingNews).toBeNull();
  });

  it("resolveNews('ignore'): 왜곡 무시 손실 + 클리어", () => {
    const s = createInitialState();
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: true };
    const delta = resolveNews(s, "ignore");
    expect(delta).toBe(-Math.round(1000 * NEWS_IGNORE_LOSS_RATE));
    expect(s.pendingNews).toBeNull();
  });

  it("resolveNews('clarify'): 해명 트윗이 타임라인에 남고 클리어", () => {
    const s = createInitialState();
    s.pendingNews = { tweetId: "t1", tweetText: "원문", gain: 1000, distorted: true };
    const acc = getActiveAccount(s);
    const n0 = acc.timeline.length;
    resolveNews(s, "clarify");
    expect(acc.timeline.length).toBe(n0 + 1);
    expect(s.pendingNews).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인** — `npx vitest run src/__tests__/tweetFunPack2.test.ts` → FAIL(미정의 import).

- [ ] **Step 3: `src/systems/news.ts` 구현**

```ts
import type { GameState } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import {
  NEWS_CHANCE, NEWS_DISTORT_RATE, NEWS_BOOST_RATE, NEWS_CLARIFY_RATE,
  NEWS_IGNORE_LOSS_RATE, NEWS_BACKFIRE_CHANCE, NEWS_OUTLETS,
  NEWS_HEADLINES_NORMAL, NEWS_HEADLINES_DISTORTED,
} from "@/data/news";
import { changeFollowers } from "./followers";
import { rollControversy } from "./controversy";
import { clampResource } from "./stats";
import { chance, pick, uid } from "@/utils/random";
import type { Tweet } from "@/core/types";

/** 떡상 트윗을 확률로 기사화 예약(다음날 아침 팝업). 이미 예약돼 있으면 스킵. */
export function maybeQueueNews(state: GameState, tweetId: string, tweetText: string, gain: number): void {
  if (state.pendingNews) return;
  if (gain <= 0) return;
  if (!chance(NEWS_CHANCE)) return;
  state.pendingNews = { tweetId, tweetText, gain, distorted: chance(NEWS_DISTORT_RATE) };
}

/** 예약된 기사 헤드라인(표시용). ui가 부른다. */
export function newsHeadlineFor(news: NonNullable<GameState["pendingNews"]>): string {
  const outlet = pick(NEWS_OUTLETS);
  const pool = news.distorted ? NEWS_HEADLINES_DISTORTED : NEWS_HEADLINES_NORMAL;
  const snippet = news.tweetText.slice(0, 14);
  return `[${outlet}] ${pick(pool).replace("{snippet}", snippet)}`;
}

/** 기사화 팝업 선택 해소. 팔로워 델타 반환. pendingNews를 반드시 클리어. */
export function resolveNews(state: GameState, action: "ack" | "clarify" | "ignore"): number {
  const news = state.pendingNews;
  state.pendingNews = null;
  if (!news) return 0;
  const account = getActiveAccount(state);

  if (action === "ack") {
    const gainF = Math.round(news.gain * NEWS_BOOST_RATE);
    changeFollowers(state, gainF);
    state.resources.reputation = clampResource(state.resources.reputation + 3);
    return gainF;
  }
  if (action === "ignore") {
    const loss = -Math.round(news.gain * NEWS_IGNORE_LOSS_RATE);
    changeFollowers(state, loss);
    rollControversy(state, 0.2);
    return loss;
  }
  // clarify — 무료 해명 트윗
  const clar: Tweet = {
    id: uid("news"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text: "기사 보고 왔습니다. 그 트윗, 문맥이 좀 잘렸네요. 오해 없으시길 🙏",
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  };
  pushTimeline(account, clar);
  if (chance(NEWS_BACKFIRE_CHANCE)) {
    const loss = -Math.round(news.gain * NEWS_IGNORE_LOSS_RATE);
    changeFollowers(state, loss);
    rollControversy(state, 0.15);
    return loss;
  }
  const gainF = Math.round(news.gain * NEWS_CLARIFY_RATE);
  changeFollowers(state, gainF);
  state.resources.reputation = clampResource(state.resources.reputation + 2);
  clar.gainedFollowers = gainF;
  return gainF;
}
```

- [ ] **Step 4: 떡상 훅 연결** — 세 게시 경로의 떡상 분기에 `maybeQueueNews` 추가.

`src/systems/tweetSystem.ts` (떡상 블록 직후, `account.timeline` 처리 전후 무관하나 tweet.id 확정 후):
```ts
if (ddeoksang) { /* 기존 */ }
maybeQueueNews(state, tweet.id, tweet.text, ddeoksang ? followers : 0);
```
import 추가: `import { maybeQueueNews } from "./news";`
`src/systems/quote.ts`·`src/systems/drunk.ts`도 동일 — 각 파일의 떡상 판정 후 `maybeQueueNews(state, tweet.id, tweet.text, ddeoksang ? <gain> : 0)`. (drunk는 `delta>0 && isDdeoksang(...)`을 별도 계산해 gain 전달; 취중 떡상도 기사화 대상.)
> 주: `maybeQueueNews`는 gain<=0이면 내부에서 스킵하므로 떡상 아닐 때 0을 넘겨도 안전. 단 quote/drunk는 `ddeoksang` 지역변수를 이미 계산하므로 그 값을 그대로 쓴다.

- [ ] **Step 5: 통과 확인** — `npx vitest run src/__tests__/tweetFunPack2.test.ts` → PASS. `npm run typecheck` 통과.

- [ ] **Step 6: 커밋**
```bash
git add src/systems/news.ts src/systems/tweetSystem.ts src/systems/quote.ts src/systems/drunk.ts src/__tests__/tweetFunPack2.test.ts
git commit -m "feat(news): 기사화 판정·해소 로직 + 떡상 훅"
```

### Task A3: 기사화 아침 팝업 (ui)

**Files:**
- Create: `src/ui/newsModal.ts` (`renderNewsModal(ctx)`)
- Modify: `src/ui/app.ts` (아침 강제팝업 체인에 `pendingNews` 편입)
- Modify: `src/styles/main.css` (`.news-*` 스타일)

**Interfaces:**
- Consumes: `state.pendingNews`, `newsHeadlineFor`, `resolveNews`.
- Produces: 강제팝업 1종.

- [ ] **Step 1: `newsModal.ts` 구현** — `el()`로 신문 카드(언론사 헤드라인 `newsHeadlineFor(state.pendingNews)` + 내 트윗 인용). 정상(`distorted=false`)이면 [확인]만 → `ctx.update(s => resolveNews(s,"ack"))` + 토스트. 왜곡이면 [해명 트윗]/[무시] 2버튼 → 각각 `resolveNews(s,"clarify")`/`"ignore"` + 결과 토스트. 모든 버튼이 `pendingNews`를 클리어(resolveNews가 처리). 참고 패턴: `ui/drunkModal.ts`(강제팝업 구조·닫기).
- [ ] **Step 2: app.ts 체인 편입** — `src/ui/app.ts` 아침 팝업 체인(`state.pendingRegretTweetId` 근처)에 분기 추가:
```ts
} else if (state.pendingNews) {
  ui.modal = (c) => renderNewsModal(c);
```
우선순위: `dawnPending` 다음, 이불킥/취침류와 같은 층(아침 이벤트). import 추가.
- [ ] **Step 3: CSS** — `.news-card`(신문 톤 카드), `.news-card__outlet`, `.news-card__headline`, `.news-card__quote`. `main.css`에서 유사 카드 클래스를 grep해 톤·변수 재사용(±30줄만 Read).
- [ ] **Step 4: 검증** — `npm run typecheck && npm run build`.
- [ ] **Step 5: 커밋**
```bash
git add src/ui/newsModal.ts src/ui/app.ts src/styles/main.css
git commit -m "feat(news): 기사화 아침 팝업 UI"
```

---

## Phase 2 — 모듈 B · 트친소 (능동 요청)

### Task B1: 트친소 상태 + 콘텐츠 (core + data)

**Files:**
- Modify: `src/core/types.ts` (`PlayerAccount.lastTchinsoDay: number`)
- Modify: `src/core/state.ts` (`lastTchinsoDay: 0`)
- Modify: `src/systems/save.ts` (폴백 `acc.lastTchinsoDay ??= 0`)
- Create: `src/data/tchinso.ts`

**Interfaces:**
- Produces: `PlayerAccount.lastTchinsoDay`(0=미사용). `TCHINSO_COOLDOWN_DAYS=7`, `TCHINSO_PREFILL_MIN=2`/`TCHINSO_PREFILL_MAX=3`, `TCHINSO_RESP_MIN=2`/`TCHINSO_RESP_MAX=4`, `TCHINSO_TWEET_TEXT: string[]`, `TCHINSO_REPLY_LINES: string[]`.

- [ ] **Step 1: 타입 + 초기값 + 폴백**
`src/core/types.ts` `PlayerAccount`에:
```ts
/** 마지막으로 트친소(트친 소개) 트윗을 올린 날(day). 0이면 미사용. 주 1회 쿨다운 판정. */
lastTchinsoDay: number;
```
`src/core/state.ts` `createAccount` 반환에 `lastTchinsoDay: 0,` 추가.
`src/systems/save.ts` 계정 루프에 `acc.lastTchinsoDay ??= 0;` 추가(`acc.tchinProgress ??= {}` 근처).

- [ ] **Step 2: `src/data/tchinso.ts` 작성**
```ts
/**
 * 트친소(트친 소개) — 트윗/응답 문구·상수.
 * 판정은 systems/tchin이 한다. 사교 목적이라 팔로워 효과는 미미.
 */
export const TCHINSO_COOLDOWN_DAYS = 7;
export const TCHINSO_PREFILL_MIN = 2;
export const TCHINSO_PREFILL_MAX = 3;
export const TCHINSO_RESP_MIN = 2;
export const TCHINSO_RESP_MAX = 4;

export const TCHINSO_TWEET_TEXT: string[] = [
  "트친 구합니다! 맞팔 소통해요 서로 챙겨주는 사이 되고 싶어요 🙌",
  "트친소 올려요~ 취향 비슷한 분들 저요 눌러주세요!",
  "조용히 트친 모집... 같이 타임라인 데워요 ☕",
];

export const TCHINSO_REPLY_LINES: string[] = [
  "저요! 트친해요 앞으로 잘 부탁드려요 :)",
  "오 저랑 결 비슷하신 듯 맞팔 갑니다!",
  "트친 신청이요~ 자주 소통해요!",
  "저도 트친 구하고 있었어요 반가워요 🤝",
];
```

- [ ] **Step 3: 체크포인트** — `npm run typecheck` 통과.
- [ ] **Step 4: 커밋**
```bash
git add src/core/types.ts src/core/state.ts src/systems/save.ts src/data/tchinso.ts
git commit -m "feat(tchinso): 트친소 상태 + 콘텐츠·상수"
```

### Task B2: 트친소 판정 로직 (systems + 테스트)

**Files:**
- Modify: `src/systems/tchin.ts` (`canPostTchinso`, `postTchinso`)
- Test: `src/__tests__/tweetFunPack2.test.ts`

**Interfaces:**
- Consumes: `getActiveAccount`, `makeRandomAccount`(data/accounts), `pushTimeline`, `TWEET_ACTION_COST`, `consumePostSlot`, `clampAction`, `randInt`/`pick`/`uid`, `TCHIN_THRESHOLD`(data/tchin), B1 상수.
- Produces:
  - `canPostTchinso(state): boolean` — `lastTchinsoDay===0 || state.day - lastTchinsoDay >= TCHINSO_COOLDOWN_DAYS`.
  - `postTchinso(state): TchinsoResult` where `TchinsoResult = { responders: { name: string; handle: string; remaining: number }[] }`. 응답 `randInt(RESP_MIN, RESP_MAX + floor(친화력/300))` 상한 RESP_MAX+2. 각 응답 계정의 `tchinProgress[handle] += randInt(PREFILL_MIN, PREFILL_MAX)`(이미 트친이면 스킵), `remaining = max(0, TCHIN_THRESHOLD - progress)`. 트친소 트윗 `pushTimeline`. 비용 소모. `lastTchinsoDay = state.day`.

- [ ] **Step 1: 실패 테스트 작성** (기존 파일에 describe 추가)
```ts
import { canPostTchinso, postTchinso } from "@/systems/tchin";
import { TCHINSO_COOLDOWN_DAYS, TCHINSO_PREFILL_MIN } from "@/data/tchinso";
import { TCHIN_THRESHOLD } from "@/data/tchin";

describe("트친소 (모듈 B)", () => {
  it("쿨다운: 게시 직후엔 재게시 불가, 쿨다운 경과 후 가능", () => {
    const s = createInitialState();
    expect(canPostTchinso(s)).toBe(true);
    postTchinso(s);
    expect(canPostTchinso(s)).toBe(false);
    s.day += TCHINSO_COOLDOWN_DAYS;
    expect(canPostTchinso(s)).toBe(true);
  });

  it("응답 계정의 트친 진행도를 선채움하고, 트친소 트윗이 타임라인에 남는다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    const n0 = acc.timeline.length;
    const r = postTchinso(s);
    expect(r.responders.length).toBeGreaterThanOrEqual(2);
    expect(acc.timeline.length).toBe(n0 + 1);
    for (const resp of r.responders) {
      expect(acc.tchinProgress[resp.handle]).toBeGreaterThanOrEqual(TCHINSO_PREFILL_MIN);
      expect(resp.remaining).toBe(Math.max(0, TCHIN_THRESHOLD - acc.tchinProgress[resp.handle]));
    }
  });
});
```
- [ ] **Step 2: 실패 확인** — vitest FAIL.
- [ ] **Step 3: 구현** — `src/systems/tchin.ts`에 `canPostTchinso`/`postTchinso` 추가(위 Interfaces 그대로). `makeRandomAccount`로 응답 계정 생성(중복 핸들·이미 트친 스킵). 비용은 `clampAction`+`consumePostSlot`(quote.ts 선례). 트친소 트윗 attribute="daily".
- [ ] **Step 4: 통과 확인** — vitest PASS + typecheck.
- [ ] **Step 5: 커밋**
```bash
git add src/systems/tchin.ts src/__tests__/tweetFunPack2.test.ts
git commit -m "feat(tchinso): 트친소 판정 로직(쿨다운·선채움)"
```

### Task B3: 트친소 UI (버튼 + 모달 + 결과)

**Files:**
- Create: `src/ui/tchinsoModal.ts` (`renderTchinsoModal(ctx)`)
- Modify: `src/ui/sns/snsView.ts` (홈 상단 composer 근처 '트친소 올리기' 버튼)
- Modify: `src/styles/main.css` (`.tchinso-*`)

**Interfaces:**
- Consumes: `canPostTchinso`, `postTchinso`(B2).
- Produces: 트친소 진입 버튼 + 확인/결과 모달.

- [ ] **Step 1: 버튼** — `snsView.ts` `renderHomeFeed`의 `composer`(약 289줄) 아래에 '🤝 트친소 올리기' 버튼. `canPostTchinso(s)` false면 비활성 + "N일 후 가능" 표시(`day - lastTchinsoDay`로 남은 일수). 클릭 → `ctx.openModal(c => renderTchinsoModal(c))`.
- [ ] **Step 2: 모달** — 확인 문구 + [올리기] → `ctx.update(s => { result = postTchinso(s); })` → 응답 계정 목록(이름·핸들·"트친까지 N번")을 같은 모달 결과 화면 또는 토스트로 표시. 참고: `ui/quoteModal.ts` 모달 구조.
- [ ] **Step 3: CSS** — `.tchinso-resp`(응답 계정 행). 기존 리스트/칩 클래스 재사용 우선.
- [ ] **Step 4: 검증** — `npm run typecheck && npm run build`.
- [ ] **Step 5: 커밋**
```bash
git add src/ui/tchinsoModal.ts src/ui/sns/snsView.ts src/styles/main.css
git commit -m "feat(tchinso): 트친소 버튼·모달·결과 UI"
```

---

## Phase 3 — 모듈 C · 트친 생일

### Task C1: 생일 상태 + AppointmentKind 확장 + 콘텐츠 (core + data)

**Files:**
- Modify: `src/core/types.ts` (`AppointmentKind`에 `"birthday"`; `GameState.pendingBirthday: string | null`)
- Modify: `src/core/state.ts` (`pendingBirthday: null`)
- Modify: `src/systems/save.ts` (폴백 `state.pendingBirthday ??= null`)
- Modify: `src/ui/calendar.ts` (`KIND_ICON`에 `birthday`)
- Modify: `src/systems/appointments.ts` (`dueAppointments`에서 birthday 제외)
- Create: `src/data/birthday.ts`

**Interfaces:**
- Produces: `AppointmentKind |= "birthday"`. `GameState.pendingBirthday: string | null`(오늘 생일인 트친 핸들·미축하). data: `BIRTHDAY_MIN_DAYS=30`/`BIRTHDAY_MAX_DAYS=120`, `BIRTHDAY_BONUS_MIN=15`/`BIRTHDAY_BONUS_MAX=60`, `BIRTHDAY_KAKAO_LINES: string[]`, `BIRTHDAY_TWEET_LINES: string[]`.

- [ ] **Step 1: AppointmentKind + GameState 필드**
`src/core/types.ts` `AppointmentKind` 유니온에 `| "birthday"` 추가. `GameState`에:
```ts
/** 오늘 생일인 트친 핸들(미축하). onNewDay가 세팅, 축하 or 다음날에 클리어. null이면 없음. */
pendingBirthday: string | null;
```
- [ ] **Step 2: KIND_ICON 채우기(exhaustive 강제)** — `src/ui/calendar.ts` `KIND_ICON`에 `birthday: "sparkle",` 추가(생일 아이콘 — 전용 아이콘 없어 sparkle 재사용, 문구는 🎂 이모지).
- [ ] **Step 3: dueAppointments 제외** — `src/systems/appointments.ts` `dueAppointments`가 반환 전 `.filter(a => a.kind !== "birthday")` 적용(생일은 비차단 — appointmentModal 강제팝업에 안 뜨게). 주석으로 이유 명시.
- [ ] **Step 4: 초기값 + 폴백** — `state.ts` `pendingBirthday: null,`; `save.ts` `state.pendingBirthday ??= null;`.
- [ ] **Step 5: `src/data/birthday.ts` 작성**
```ts
/**
 * 트친 생일 — 카톡/축하 문구·생일 범위·보너스 상수.
 * 생일 날짜는 systems/tchin이 hashInt(handle)로 결정론 산출. 놓쳐도 무해(보너스만).
 */
export const BIRTHDAY_MIN_DAYS = 30;
export const BIRTHDAY_MAX_DAYS = 120;
export const BIRTHDAY_BONUS_MIN = 15;
export const BIRTHDAY_BONUS_MAX = 60;

export const BIRTHDAY_KAKAO_LINES: string[] = [
  "오늘 트친 생일이래요! 축하 한마디 남겨보는 건 어때요? 🎂",
  "달력 보니 오늘 그 트친 생일이네요 🎉",
];

export const BIRTHDAY_TWEET_LINES: string[] = [
  "@{handle} 생일 축하해요!! 오늘 하루 완전 행복하길 🎂🎉",
  "우리 트친 @{handle} 생일이래요 다들 축하해줍시다 🥳",
  "@{handle}님 생신 축하드려요~ 좋은 일만 가득하시길 🎁",
];
```
- [ ] **Step 6: 체크포인트** — `npm run typecheck`(KIND_ICON 미기입 시 여기서 에러). 통과 확인.
- [ ] **Step 7: 커밋**
```bash
git add src/core/types.ts src/core/state.ts src/systems/save.ts src/ui/calendar.ts src/systems/appointments.ts src/data/birthday.ts
git commit -m "feat(birthday): 생일 상태 + AppointmentKind 확장 + 콘텐츠"
```

### Task C2: 생일 등록·도래·축하 로직 (systems + 테스트)

**Files:**
- Modify: `src/systems/tchin.ts` (`scheduleBirthday`, `sendBirthdayTweet`)
- Modify: `src/systems/time.ts` (`onNewDay`에서 생일 도래 감지)
- Test: `src/__tests__/tweetFunPack2.test.ts`

**Interfaces:**
- Consumes: `addAppointment`(appointments), `getActiveAccount`, `pushTimeline`, `changeFollowers`, `pushKakao`, `hashInt`/`pick`/`randInt`/`uid`, `maybeSpawnTchinBoost`(재사용), C1 상수.
- Produces:
  - `scheduleBirthday(state, handle): void` — `bumpTchinProgress`가 "became"일 때 호출. `day = state.day + BIRTHDAY_MIN_DAYS + hashInt(handle) % (BIRTHDAY_MAX_DAYS - BIRTHDAY_MIN_DAYS)`. `addAppointment({ day, slot: 0, kind: "birthday", title: `@${handle} 생일`, partnerName: handle })`. 이미 같은 handle birthday 약속 있으면 스킵.
  - `sendBirthdayTweet(state): void` — `state.pendingBirthday` 핸들로 축하 트윗 무료 게시(`pushTimeline`, 슬롯·행동력 미소모) + 보너스 팔로워 `randInt(BIRTHDAY_BONUS_MIN, MAX)` + `pendingBirthday=null`.

- [ ] **Step 1: 실패 테스트 작성**
```ts
import { scheduleBirthday, sendBirthdayTweet, bumpTchinProgress } from "@/systems/tchin";
import { BIRTHDAY_MIN_DAYS, BIRTHDAY_BONUS_MIN } from "@/data/birthday";

describe("트친 생일 (모듈 C)", () => {
  it("scheduleBirthday: 결정론적 생일 약속 1건 등록(같은 핸들 같은 날)", () => {
    const s1 = createInitialState();
    scheduleBirthday(s1, "friend");
    const bday = s1.appointments.filter((a) => a.kind === "birthday");
    expect(bday.length).toBe(1);
    expect(bday[0].day).toBeGreaterThanOrEqual(s1.day + BIRTHDAY_MIN_DAYS);
    const s2 = createInitialState();
    scheduleBirthday(s2, "friend");
    expect(s2.appointments[0].day).toBe(bday[0].day); // 결정론
  });

  it("sendBirthdayTweet: 무료 게시(슬롯 미소모) + 보너스 팔로워 + 클리어", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    s.pendingBirthday = "friend";
    const slots0 = acc.postSlotsUsed;
    const f0 = acc.followers;
    const n0 = acc.timeline.length;
    sendBirthdayTweet(s);
    expect(acc.timeline.length).toBe(n0 + 1);
    expect(acc.postSlotsUsed).toBe(slots0); // 무료(슬롯 미소모)
    expect(acc.followers).toBeGreaterThanOrEqual(f0 + BIRTHDAY_BONUS_MIN);
    expect(s.pendingBirthday).toBeNull();
  });
});
```
- [ ] **Step 2: 실패 확인** — vitest FAIL.
- [ ] **Step 3: 구현**
  - `scheduleBirthday`/`sendBirthdayTweet`를 `systems/tchin.ts`에 추가(위 Interfaces).
  - `bumpTchinProgress`의 "became" 분기에서 `scheduleBirthday(state, handle)` 호출(성사 즉시 생일 예약). — 기존 `state.pendingTchinToasts.push(handle)` 옆.
  - `systems/time.ts` `onNewDay(state)`에 생일 도래 처리 추가: `state.appointments.filter(a => a.kind === "birthday" && a.day === state.day)`가 있으면 첫 건의 `partnerName`을 `state.pendingBirthday`로 세팅 + `pushKakao(state, "달력", [pick(BIRTHDAY_KAKAO_LINES)], { hue: 330 })` + 그 약속 제거(`state.appointments = state.appointments.filter(a => a.id !== due.id)`). 전날 미축하 `pendingBirthday`는 이 시점에 `null`로 리셋(놓침=무해).
- [ ] **Step 4: 통과 확인** — vitest PASS + typecheck.
- [ ] **Step 5: 커밋**
```bash
git add src/systems/tchin.ts src/systems/time.ts src/__tests__/tweetFunPack2.test.ts
git commit -m "feat(birthday): 생일 등록·도래·축하 로직"
```

### Task C3: 생일 UI (오늘의 생일 배너 + 축하 버튼)

**Files:**
- Modify: `src/ui/sns/snsView.ts` (홈 상단 '오늘 트친 생일' 배너 + [축하 트윗] 버튼)
- Modify: `src/styles/main.css` (`.birthday-banner`)

**Interfaces:**
- Consumes: `state.pendingBirthday`, `sendBirthdayTweet`(C2).

- [ ] **Step 1: 배너** — `snsView.ts` `renderHomeFeed` 상단에 `state.pendingBirthday`가 있으면 `🎂 오늘 @{handle} 생일! [축하 트윗 보내기]` 배너. 버튼 → `ctx.update(s => sendBirthdayTweet(s))` + 토스트("축하를 전했어요! 🎉"). `pendingBirthday` 없으면 배너 미표시.
- [ ] **Step 2: CSS** — `.birthday-banner`(밝은 톤 배너). 기존 `.goal-banner` 톤 참고(±30줄 Read).
- [ ] **Step 3: 검증** — `npm run typecheck && npm run build`.
- [ ] **Step 4: 커밋**
```bash
git add src/ui/sns/snsView.ts src/styles/main.css
git commit -m "feat(birthday): 오늘의 생일 배너·축하 버튼 UI"
```

---

## 최종 통합 검증

- [ ] `npm run typecheck` 클린.
- [ ] `npm run build` 성공.
- [ ] `npm test` — 신규 회귀 테스트(tweetFunPack2) 포함 전부 통과.
- [ ] 경계면 대조(game-integration-qa): 신규 심볼 잔여참조·세이브 폴백 3종(`pendingNews`·`lastTchinsoDay`·`pendingBirthday`)·`AppointmentKind` 파급(`KIND_ICON` 외 다른 `Record<AppointmentKind>` 없나)·계층 역참조 없음.
- [ ] 계획서 체크박스 갱신(CLAUDE.md 계획서 작업 수칙).
- [ ] 사용자 보고(추가/수정 파일·밸런스 값·조작법).

## Self-Review (완료)

- **스펙 커버리지**: 모듈 A→A1/A2/A3, B→B1/B2/B3, C→C1/C2/C3. 저장 폴백·테스트 각 Task 포함. 갭 없음.
- **플레이스홀더**: systems/data/core Task는 실제 코드·테스트 케이스 명시. UI Task는 이 프로젝트 관례(el() 트리는 실행 시 작성, 구조·연결점·참고 패턴만 서술)에 맞춤 — 밸런스 상수·연결 지점은 전부 확정.
- **타입 일관성**: `PendingNews`(A1)→`maybeQueueNews`/`resolveNews`(A2)→`renderNewsModal`(A3); `lastTchinsoDay`(B1)→`canPostTchinso`/`postTchinso`(B2)→UI(B3); `AppointmentKind:"birthday"`·`pendingBirthday`(C1)→`scheduleBirthday`/`sendBirthdayTweet`(C2)→배너(C3). 명칭 일관.
- **결정론**: 생일은 `hashInt(handle)`(C2 테스트가 같은 핸들 같은 날 고정). 뉴스 헤드라인 pick은 표시용이라 결정론 불필요.
- **주의**: `AppointmentKind` 확장은 `KIND_ICON` exhaustive Record가 typecheck로 강제(C1 Step 6). dueAppointments 제외(C1 Step 3)를 빠뜨리면 생일이 강제팝업으로 떠 "무해" 원칙이 깨진다.
