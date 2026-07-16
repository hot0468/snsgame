---
name: game-systems-dev
description: snsgame의 src/systems/ 게임 규칙과 src/core/ 엔진(types·state·store)을 구현·수정할 때 사용. 팔로워/성과 계산, 트윗·오프라인·이벤트 로직, 저장/불러오기, 새 게임 시스템, 상태 변경 규칙, 도메인 타입/상수 추가·변경 시 반드시 이 스킬을 사용하라. "시스템 만들어", "규칙 추가", "계산 로직", "새 스탯/속성", "타입 추가", "저장 로직", "밸런스 공식" 같은 요청에 트리거.
---

# 게임 시스템 개발 (systems/ · core/)

snsgame의 규칙은 `src/systems/`(순수 로직)과 `src/core/`(엔진)에 산다. 철칙은 **순수성**과 **단방향 의존**이다.

## 두 가지 철칙

### 1. 단방향 의존: `data → systems → ui`
- `systems/`는 `data/`와 `core/`를 import할 수 있다.
- `systems/`는 **절대 `ui/`를 import하지 않는다.** 화면은 systems를 호출할 뿐이다.
- `data/`는 아무것도(systems/ui) import하지 않는 순수 선언이어야 한다.

### 2. 순수성: systems는 DOM을 모른다
- `document`·`window`·`el()`·`alert` 사용 금지. systems는 상태를 받아 상태를 바꾸는 로직만 담는다.
- 화면 표시가 필요한 결과는 값(문구·delta)으로 **반환**하고, 표시는 ui에 맡긴다.

## 상태 변경 패턴

상태는 `core/store.ts`의 `Store`가 쥐고 있다. 시스템 함수는 보통 `state: GameState`를 인자로 받아 직접 변형(mutate)하고, 계산 결과(delta 등)를 반환한다. UI는 `ctx.update(draft => systemFn(draft, ...))` 형태로 이를 dispatch 안에서 호출한다.

- 셀렉터는 `core/state.ts`에 있다(`getActiveAccount`, 슬롯 상수 등). 상태를 뒤질 때 재발명하지 말고 기존 셀렉터를 쓴다.
- 상수·마법의 숫자는 `export const`로 이름을 붙인다(`TWEET_ACTION_COST = 10`, `ADULT_FOLLOWER_MULTIPLIER = 1.5` 참고). 밸런스 튜닝 지점이 코드에 흩어지지 않게 한다.

## 선언형 효과 처리 (data와의 계약)

`data/`의 이벤트·만남은 `EventEffect`를 선언만 한다. **적용 로직은 `systems/events.ts`가 단일 지점에서 해석**한다:
- 수치 필드(action/mental/followers/skills 등)는 공통 적용 함수가 처리한다.
- 특수 효과는 `EventEffect.customKey` → `CUSTOM_EFFECTS` 매핑에서 처리하고, 필요하면 표시 문구를 반환한다.
- 새 특수효과 요청이 오면: ① `customKey` 유니온에 키 추가(events.ts) → ② `CUSTOM_EFFECTS`에 로직 추가(systems). data-author가 그 키를 콘텐츠에서 쓸 수 있게 된다.

효과 로직을 개별 콘텐츠마다 흩뿌리지 말고 이 단일 해석부에 통합해야, 콘텐츠가 규칙에 비의존인 선언형을 유지한다.

## 타입 확장의 파급 (가장 중요)

`core/types.ts`에 유니온 멤버를 추가하는 것은 **연쇄 변경**을 부른다. 예: 새 `AttributeId "sports"`를 추가하면 —
- `data/attributes.ts`의 라벨/궁합표 `Record<AttributeId, ...>`
- 초기 스탯·매핑을 담은 모든 `Record<AttributeId, ...>` (state.ts, data 여러 곳)
- 해당 속성 트윗 문구(tweets.ts)
- UI의 카테고리 목록·아이콘

`Record<AttributeId, X>`는 새 키가 없으면 컴파일 에러(exhaustive)거나 런타임 `undefined`가 된다. **유니온을 넓히면 그 타입을 키로 쓰는 모든 곳을 함께 채운다.** typecheck가 상당수를 잡아주지만, 인덱스 접근(`map[key]`)은 못 잡으니 직접 확인한다. 확장 후 반드시 content-author·ui-builder에게 파급을 알린다.

## 검증

- 작성 후 `npm run typecheck`. 타입 확장으로 다른 파일이 깨지면 그 파일까지 고친다.
- 저장/불러오기(`systems/save.ts`)를 건드렸다면, 상태 구조 변경이 기존 세이브(localStorage)와 호환되는지 고려한다 — 새 필드는 로드 시 기본값 폴백이 필요할 수 있다.

## 파일 지도

| 영역 | 파일 |
|------|------|
| 팔로워/성과 계산 | `systems/followers.ts`, `systems/tweetSystem.ts` |
| 이벤트 효과 적용 | `systems/events.ts` (EventEffect·customKey 해석) |
| 오프라인/활동 | `systems/offline.ts`, `systems/appointments.ts`, `systems/employment.ts` |
| 시간/스케줄 | `systems/time.ts`, `systems/calendar.ts` |
| 경제/상점/가챠 | `systems/economy.ts`, `systems/shop.ts`, `systems/gacha.ts`, `systems/loan.ts` |
| DM/만남/크루 | `systems/dm.ts`, `systems/meeting.ts`, `systems/crew.ts` |
| 저장/불러오기 | `systems/save.ts` |
| 엔진(타입·상태·스토어) | `core/types.ts`, `core/state.ts`, `core/store.ts` |
