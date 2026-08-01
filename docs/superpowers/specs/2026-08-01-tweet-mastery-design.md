# 갈래 숙련도 — 트윗에 육성 축 세우기

## 문제

트윗은 스탯을 **쓰는** 행동이지 **키우는** 행동이 아니다. 스킬은 거의 전부 오프라인 활동에서 오르고,
트윗이 올려주는 건 덕질 +3(아이돌·애니·배우)과 지식 +2(정보 성격)뿐이다.
100번째 트윗이 1번째와 질적으로 같고, 콤보(`tweetStreak`)조차 직전 1건만 보는 휘발성이다.
피드백도 토스트 한 줄(`ui/sns/composeModal.ts`)이라 숫자가 팔로워 총량에 흡수되어 사라진다.

→ 게임의 주 행동에 성장 곡선이 없다.

## 해결

트윗을 올리는 것 자체가 육성이 되게 한다: **갈래별 숙련도**가 쌓이고, 숙련이 **그 갈래의 도달 배율**을 올린다.
그리고 그 성장을 **게시 직후 결과 화면**에서 게이지로 보여준다.

---

## 1. 갈래 숙련도 (core · data · systems)

### 상태

```ts
// core/types.ts — GameState
/** 갈래별 게시 누적(숙련도). 안 올린 갈래는 키가 없다. */
tweetMastery: Partial<Record<AttributeId, number>>;
```

- `core/state.ts` 초기값 `{}`
- `systems/save.ts` sanitize: `state.tweetMastery ??= {}` (구세이브는 숙련 0에서 시작 — 정답)

### 문턱과 보상 (`data/tweetMastery.ts` 신규)

```ts
export const MASTERY_THRESHOLDS = [10, 40, 120, 300] as const;  // 게시 누적
export const MASTERY_TIER_BONUS = 0.08;                          // tier당 도달 +8%
export const MASTERY_TITLES = ["입문", "단골", "터줏대감", "전설"] as const;
```

tier 0(미달) → ×1.00 · 1 → ×1.08 · 2 → ×1.16 · 3 → ×1.24 · 4 → ×1.32

**문턱 근거.** 전체 플레이는 ~150~250 게임일 × 3~4.5 트윗/일 = 450~1100 트윗.
- `10` = 게임 2~3일차. **첫 성취를 초반에 준다** — 지금 가장 비어 있는 구간이다.
- `40` = 2~3주차.
- `120` = 중반. 균형형(여러 갈래 분산)이 닿는 상한 근처.
- `300` = 한 갈래에 트윗 60%를 몰아야 닿는다. 특화 플레이 종반 보상.

**배율 크기 근거.** `systems/followers.ts`의 기존 레버는 평판 3.3배 · 궁합 2.3배 · 트렌드 1.7배 · 스킬 8배다.
숙련 만렙조차 1.32배라 "한 레버가 판을 흔들면 안 된다"는 그 파일의 원칙을 깨지 않는다.
계단식(tier 단위)인 이유는 **문턱을 넘는 순간**이 있어야 성취가 되기 때문이다 — 연속 배율이면 아무 일도 안 일어난다.

### 등급·칭호

- 배지는 기존 `MILESTONE_GRADES`(B/A/S/SS)를 그대로 재사용한다. 새로 만들지 않는다.
- 칭호는 갈래별 92개(23갈래 × 4단계)를 쓰지 않고 **tier 공용 4개**를 갈래명과 조합한다 → `"IT계 터줏대감"`.
  갈래별 전용 칭호는 공용 문구가 밋밋하게 느껴질 때 추가한다.

### 계산 (`systems/followers.ts`)

```ts
export function masteryTier(state, attr): number   // 0~4
export function masteryMul(state, attr): number    // 1 + MASTERY_TIER_BONUS * tier
```

`calcTweetOutcome`의 곱셈 사슬에 한 항을 추가한다:

```ts
const base = reach * skillMul * affinityMul * trendMul * timingMul * eff.reachMul * masteryMul(state, attr);
```

⚠️ 반드시 `base`에 곱한다(likes 계산 앞). 팔로워에만 곱하면 "반응은 그대론데 팔로워만 다른" 결과가 된다
— `timingMul` 주석이 경고하는 것과 같은 함정이다.

### 적립 (`systems/tweetSystem.ts`)

`postTweet`에서 게시 1건당 `tweetMastery[attr] += 1`.

- **성과 계산(`calcTweetOutcome`) 이후에 적립한다.** 이번 트윗은 적립 전 tier의 배율을 받는다
  (문턱을 넘는 트윗이 넘은 뒤의 배율까지 받으면 결과 화면의 "이번 성과"와 표시 tier가 어긋난다).
- 무료 게시(`opts.free`)도 적립한다 — 게시는 게시다. 행동력만 면제되는 경로다.
- `postScamTweet`은 적립하지 않는다(갈래가 형식상 `daily`로 고정된 별개 행동).

`PostTweetResult`에 결과 화면이 필요로 하는 것을 실어 보낸다:

```ts
/** 이번 트윗 적립 후의 갈래 숙련 누적. */
masteryCount: number;
/** 이번 트윗으로 숙련 tier가 올랐으면 새 tier(1~4), 아니면 0. */
masteryTierUp: number;
```

---

## 2. 게시 결과 화면 (ui)

토스트를 **독립 결과 모달**(`ui/sns/tweetResultModal.ts` 신규)로 승격한다.

⚠️ **왜 composeModal의 3단계가 아닌가.** `showDdeoksang`은 `ctx.openModal`을 써서 **현재 모달을 대체**한다
(`ui/ddeoksang.ts`). 결과 화면이 composeModal 안의 단계라면 떡상 연출과 자리를 다투게 된다.
독립 모달이면 순서가 자연스럽다: 떡상 오버레이 → (닫히면) 결과 모달.
847줄짜리 composeModal을 더 키우지 않는 이점도 같이 온다.

```
        트윗 등록!
   ❤️ 1,240   🔁 310   👤 +99

 일상계 숙련  ███████░░░  118 → 119 / 120
              [A] 단골 · 도달 ×1.16
                          ⚡ 3연타!
        [닫기]  [한 번 더]
```

- **게이지가 눈앞에서 차오르는 것이 성취감의 본체다.** 숫자만 크게 보여주는 것으로는 안 된다.
- 문턱을 넘은 트윗이면 그 자리에서 배지가 승급하며 칭호 줄이 뜬다(`masteryTierUp > 0`).
- 기존 토스트가 싣던 것(스탯 증감·트렌드 편승·연타)은 이 화면으로 옮긴다.
- 떡상이면 **떡상 오버레이가 먼저**, 그게 닫히면 결과 모달이 뜬다.
  `showDdeoksang`에 선택 콜백 `onNext`를 추가해 잇는다(기존 호출처 2곳은 인자를 안 주므로 그대로 동작).
- `[한 번 더]`는 작성 모달을 새로 연다. 클릭 수가 지금과 같아지고, 이미 있는 연타 콤보와 맞물린다.
- `ctx.afterAction("tweet")`은 `[닫기]`로 결과 모달을 닫을 때 부른다(지금은 게시 직후에 부른다).

### 상시 조망

1단계 카테고리 칩에 등급 배지를 단다 (`일상 [A]`). tier 0은 배지 없음.
별도 숙련 도감 화면을 만들지 않는다 — 칩 목록이 곧 숙련 현황이다.

### 결과 화면을 타지 않는 경로

사기 트윗은 숙련이 없으므로 결과 화면 대신 지금의 토스트를 유지한다.
`postTweet`을 부르는 다른 화면(`ui/quoteModal.ts` · `ui/workTweetModal.ts`)은 자기 UI를 그대로 두되,
숙련 적립은 `postTweet` 안에서 일어나므로 자동으로 따라온다.

---

## 건드리는 파일

| 계층 | 파일 | 변경 |
|---|---|---|
| core | `types.ts` | `GameState.tweetMastery` 필드 1개 |
| core | `state.ts` | 초기값 `{}` |
| data | `tweetMastery.ts` **신규** | 문턱·보너스·칭호 ~30줄 |
| systems | `followers.ts` | `masteryTier`·`masteryMul` + `calcTweetOutcome` 1항 |
| systems | `tweetSystem.ts` | 적립 + `PostTweetResult` 2필드 |
| systems | `save.ts` | sanitize 폴백 1줄 |
| ui | `sns/tweetResultModal.ts` **신규** | 결과 화면 ~110줄 |
| ui | `ddeoksang.ts` | `onNext` 선택 콜백 |
| ui | `sns/composeModal.ts` | 게시 후 결과 모달 배선 · 칩 배지 |
| ui | `styles/main.css` | 결과 화면·게이지 스타일 |

## 검증

- `src/__tests__/tweetMastery.test.ts` **신규**
  - `masteryMul`: 누적 0/10/40/120/300/999 → 1.00/1.08/1.16/1.24/1.32/1.32
  - `postTweet` 1건 → 해당 갈래만 +1, 다른 갈래 불변
  - 문턱 직전(예: 9) 트윗 → `masteryTierUp === 1`, 그 트윗의 성과는 tier 0 배율
  - 구세이브(`tweetMastery` 없음) sanitize → `{}`
- typecheck · build
- `game-run`으로 결과 화면 1회 육안 확인(게이지·배지·[한 번 더])

## 잘라낸 것

- **갈래별 칭호 92개** → tier 공용 4개. 공용 문구가 밋밋하면 그때 추가.
- **별도 숙련 도감 화면** → 카테고리 칩 배지.
- **승급 전용 오버레이** → 결과 화면 안에서 처리. 떡상 오버레이의 특별함을 지키기 위해서이기도 하다.

## 알려진 리스크

숙련 배율이 팔로워 100만 도달 시간을 당긴다. 종반에만 붙으므로 전체 10% 미만으로 **추정**하지만
확정값은 아니다 — `followers.ts`의 도달일 추정표는 이 변경 후 재측정 대상이다.
체감이 너무 빨라지면 `MASTERY_TIER_BONUS`를 낮춘다(단일 조정점).
