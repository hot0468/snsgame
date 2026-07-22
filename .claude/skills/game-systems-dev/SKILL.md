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

## 스탯 스케일 — 먼저 외워라 (틀리면 조용히 깨진다)

스탯은 **두 종류이고 상한이 다르다.** `data/stats.ts`가 출처다.

| 종류 | 대상 | 상한 | 클램프 |
|------|------|------|--------|
| **스킬** 9종 | 운동·미용·어휘력·지식·친화력·개그·창작·음란·게임 | **999** (`MAX_SKILL`) | `clampSkill(v)` |
| **리소스** 4종 | 정신력·도덕성·평판 | **100** (`MAX_RESOURCE`) | `clampResource(v)` |
| **행동력** (리소스지만 예외) | 행동력만 | **100 + `actionMaxBonus`** (치트 시 120) | `clampAction(state, v)` |

**밸런스 관례** — 새 수치를 넣을 때 이 스케일을 따르지 않으면 기존 밸런스와 어긋난다:
- **획득량 ×5** — 구 100 스케일의 `+2`는 지금 `+10`이다.
- **임계값 ×10** — 구 스케일의 `60`은 지금 `600`이다.
- 임계값 ×10 / 획득량 ×5라 **목표 도달에 2배 행동**이 든다. 이게 의도된 성장 곡선이다.
- **리소스(정신력·도덕성·평판·행동력) 수치는 100 기준 그대로다.** ×5·×10 하지 마라.

### ⚠️ 클램프 오분류가 이 코드베이스 최대의 함정
세 함수 모두 `number → number`라 **typecheck가 오분류를 절대 못 잡는다.** 현재 138곳에 흩어져 있다.
- 스킬에 `clampResource` → 100에서 조용히 막힌다.
- 리소스에 `clampSkill` → 평판·도덕성이 999까지 올라 임계값 판정이 전부 깨진다.
- 행동력에 `clampResource` → 상한 보너스가 무효가 된다(120에서 15 쓰면 105가 아니라 100).

**일괄 치환 금지. 좌변이 `skills`인지 `resources.action`인지 그 외 리소스인지 한 줄씩 눈으로 확인하라.**

### 0~100 기준 공식과 만날 때
`requirement`·`gap` 같은 **0~100 기준 값과 스킬을 비교**할 땐 `skillTo100(v)`로 환산한다(`SKILL_SCALE = MAX_SKILL/100`). 선례: `employment.ts`의 `competence()`, `certification.ts`의 `examScore()`. 환산을 빼먹으면 **전원 합격 또는 전원 불합격**이 된다.

## 결정론 — 같은 날 두 번 그리면 같아야 한다

날마다 뽑는 목록(O넷 자격증 5종, 다트 핀 게시판 등)에 **`Math.random()`을 쓰면 안 된다.** 화면을 다시 그릴 때마다 목록이 바뀐다. `day`를 시드로 한 해시로 결정론적으로 골라라.

⚠️ **곱셈 해시(`h*31+c`)에 `${day}:${id}` 시드를 쓰면 편중된다** — day가 상수 덧셈으로만 작용해 id 길이가 같은 항목끼리 순서가 보존되고, 특정 항목이 며칠씩 상위에 고정된다. `systems/certification.ts`의 `hashInt`(FNV-1a + murmur3 fmix32)를 재사용하라. 새로 짰다면 **장기 분포를 시뮬레이션해 검증**하라.

## 상태 변경 패턴

상태는 `core/store.ts`의 `Store`가 쥐고 있다. 시스템 함수는 보통 `state: GameState`를 인자로 받아 직접 변형(mutate)하고, 계산 결과(delta 등)를 반환한다. UI는 `ctx.update(draft => systemFn(draft, ...))` 형태로 이를 dispatch 안에서 호출한다.

- 셀렉터는 `core/state.ts`에 있다(`getActiveAccount`, 슬롯 상수 등). 상태를 뒤질 때 재발명하지 말고 기존 셀렉터를 쓴다.
- 상수·마법의 숫자는 `export const`로 이름을 붙인다(`TWEET_ACTION_COST = 10`, `ADULT_FOLLOWER_MULTIPLIER = 1.5` 참고). 밸런스 튜닝 지점이 코드에 흩어지지 않게 한다.

## ⚠️ `ownedItems` — id만 담긴 평면 배열, 뒤의 shape은 2종

`state.ownedItems: string[]`는 **id만** 담는다. 그 id를 밀어넣는 출처가 넷이고, 실제 데이터 shape은 **2종**이다:

| 출처 | 데이터 | 스탯 필드 |
|------|--------|----------|
| `SHOP_ITEMS`(data/shop.ts) · `COSMETICS`(data/cosmetics.ts) · `PEEMANG_ITEMS`(data/peemang.ts) | `ShopItem` | `skill?`+`boost?` (**단수**) |
| `GOBLIN_ITEMS`(data/goblin.ts) | `GoblinItem` | `boosts: Partial<Record<SkillStatId, number>>` (**복수·필드명 다름**) |

**`systems/shop.ts`의 `resolveItem(id)`가 두 shape을 정규형(`boosts`)으로 통일해 4종 출처를 전부 훑는다. 이걸 써라 — 단수/복수 분기를 손으로 다시 짜지 마라.** 같이 있는 것: `ownedInventory(state)`(개수 묶음 포함), `sellPrice`, `sellOwnedItem`.

- **`ITEM_INDEX`는 `Map`이라 id가 충돌하면 뒤 출처가 앞을 조용히 덮는다** — 이름·가격·회수 스탯이 전부 남의 것이 된다. 새 출처를 추가하면 id 프리픽스를 갈라라(`pm_`·`gob_`·`cos_`). `__tests__/inventory.test.ts`가 중복 0건을 강제한다.
- **`repeatable`은 중복 push로 쌓인다** — `ownedCount(id)`가 곧 효과의 크기다(`mouse`·`stream_mic`). 인스턴스를 다룰 땐 **1개분**인지 전량인지 항상 명시적으로 정하라.
- **`data/`에 아이템 풀을 새로 만들기 전에 `ShopItem` 재사용을 먼저 검토하라.** 화장품·피망이 그렇게 갔고, 덕분에 `buyItem`을 그대로 재사용하며 리졸버에 **분기가 안 늘고 출처만 하나 는다**.
- ⚠️ **새 출처를 만들면 `resolveItem`의 인덱스에 추가하는 것을 잊지 마라.** 빠뜨리면 typecheck는 통과하고, 그 아이템만 인벤토리에서 안 보이고 팔리지도 않는다.
- `systems/adMail.ts:85`에 `SHOP_ITEMS.find(...) ?? cosmeticById(...)`라는 **부분** 리졸버가 따로 있다(도깨비를 놓친다). 광고메일이 그 둘만 오퍼하고 `ShopItem` 자체를 반환해야 해서 의도적으로 통합하지 않았다 — **정규형으로 바꾸려 하지 마라.**

## ⚠️ 무한 누적 배열 금지 — 상한 + 누적 카운터

게임은 수백 일 이어지고 상태 전체가 `JSON.stringify` 한 방으로 localStorage(~5MB)에 저장된다. **플레이 시간에 비례해 자라는 배열**(게시 트윗·메일·카톡·DM 등)을 상한 없이 두면 ① 전체 재렌더가 전량을 DOM으로 그려 렉이 끼고 ② 쿼터 초과로 `saveGame`이 조용히 `false`를 리턴해 **유저 모르게 저장이 죽는다**. 규칙:

- **게시 트윗은 반드시 `pushTimeline(account, tweet)`(core/state.ts)을 거쳐라.** `timeline.unshift` 직접 호출 금지 — 헬퍼가 `postCount`(총 게시물 수) 증가와 `TIMELINE_MAX`(300) 컷을 함께 보장한다. 실제로 8곳(tweetSystem×2·drunk·events·quote·shop·spam·리트윗)이 각자 unshift를 불러 전부 캡을 우회한 전적이 있다. `__tests__/timelineCap.test.ts`가 불변식을 고정한다.
- **"총 몇 개" 표시가 배열 길이에 묶여 있으면 분리하라.** 배열을 자르는 순간 그 숫자가 멈춘다 — 누적 카운터(int)를 따로 두라(`postCount` 선례).
- **새 누적형 배열을 설계할 때**(알림 이력·거래 로그 등): 추가 지점을 헬퍼 하나로 묶고, 그 안에서 상한을 걸어라. "나중에 자르지"는 8곳으로 흩어진 뒤에는 못 자른다.
- 구세이브 호환: 잘린 배열에서 파생 못 하는 값(누적 카운터)은 `sanitize()`에서 `??= 현재 배열 길이`로 하한 백필.

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

## 세이브 하위호환 (`GameState`에 필드를 추가했다면)

기존 세이브엔 새 필드가 없다. `undefined`가 산술에 들어가면 **NaN이 상태에 저장돼 세이브까지 오염**되고 복구가 안 된다.
- `save.ts:77`의 `{ ...fresh.skills, ...state.skills }` 병합이 이미 커버하는지 **먼저 확인**하라. 커버하면 추가 폴백은 **절대 발동하지 않는 죽은 코드**다 — `save.ts` 주석이 그걸 경계한다.
- 커버 못 하면 보정하되, 숫자 필드는 `??=`보다 `Number.isFinite` 검사가 안전하다(NaN은 `??`를 통과한다).
- **구세이브를 실제로 만들어 로드해 보고** 판단하라. 읽고 추론하지 마라.

## 달력 — 시작일을 바꿀 땐

`systems/calendar.ts`의 `START_DATE` **한 줄**이 출처고 나머지 23개 파일은 전부 `dateOf()` 파생이다. 하드코딩된 날짜를 찾아 고치지 마라.
- ⚠️ **반드시 월요일이어야 한다.** `weekIndex`가 `floor((day-1)/7)`로 "1일차=월요일"을 전제한다.
- 시즌 세일(`seasonal.ts`)이 실제 달력 월/일 기준이라, 시작일을 옮기면 **초반 경제 밸런스가 통째로 바뀐다**(예: 7월 시작이면 5일차에 여름 빅세일 30%).
- 현재 시작일은 **2026년 6월 1일(월)**.

## 검증

- 작성 후 `npm run typecheck`. 타입 확장으로 다른 파일이 깨지면 그 파일까지 고친다.
- ⚠️ **typecheck 통과는 최소 기준이지 증명이 아니다.** 클램프 오분류·결정론 위반·스케일 환산 누락은 전부 typecheck를 통과한다. 밸런스·확률·상한을 건드렸다면 **반드시 런타임으로 구동해 수치를 확인**하라(`game-integration-qa` 스킬의 헤드리스 구동 참조).
- 상수를 시뮬레이션할 땐 **소스에서 import해서 읽어라.** 스크립트에 값을 하드코딩하면 실제와 다른 걸 재고도 통과한다(실제로 그 실수가 있었다).

## 파일 지도 (비자명한 진입점)

파일 위치의 **공통 규약(`systems/{기능}.ts`, 엔진은 `core/`)은 `CLAUDE.md`의 파일 지도**를 따른다. 여기엔 규약만으론 못 찾는 **여러 파일에 걸친 로직·특수 심볼**만 둔다:

| 영역 | 진입점 |
|------|------|
| 팔로워/성과 계산 | `systems/followers.ts` + `systems/tweetSystem.ts` (두 곳 분산) |
| 이벤트 효과 적용 | `systems/events.ts`의 `CUSTOM_EFFECTS` (customKey 해석 단일 지점) |
| 보유 아이템·인벤토리·판매 | `systems/shop.ts`의 `resolveItem`·`ownedInventory`·`sellOwnedItem` (4종 출처 정규화 — 새 출처는 반드시 `resolveItem`에 등록) |
| 엔딩 | `systems/endings.ts`(`ENDING_OFFERS`) + `core/state.ts`(`*_ENDING_REASON`·`CELEBRATORY_ENDING_TITLES`) |
