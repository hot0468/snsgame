# 알고리즘 타이밍 · 인방 기록/업적 설계

- 작성일: 2026-07-29
- 범위: ① 트윗 게시 시간대(슬롯×요일)가 도달률을 바꾼다 ② 인방 최고 시청자 기록과 방송 업적

두 기능은 서로 독립이며 같은 작업 단위로 묶었을 뿐이다.

---

# A. 알고리즘 타이밍

## A1. 목표

지금 트윗은 **아무 때나 올려도 결과가 같다**. 여기에 시간대 도달률을 넣어
"지금 올릴까, 심야까지 참을까"라는 결정을 만든다.

⚠️ 게임의 하루는 **낮·심야 2슬롯**뿐이라 시간축이 짧다. 그래서 슬롯만으로는
선택지가 2개뿐이고 금방 최적해가 굳는다 → **요일**을 곱해 7×2=14가지로 벌린다.

## A2. 파일 구성

| 계층 | 파일 | 역할 |
|---|---|---|
| data | `src/data/timing.ts` (신규) | 슬롯·요일 배율표와 설명 문구 |
| systems | `src/systems/followers.ts` (수정) | `calcTweetOutcome`에 타이밍 배율 합류 |
| ui | `src/ui/sns/composeModal.ts` (수정) | 작성 화면에 현재 타이밍 안내 |

## A3. 배율표

최종 배율 = `슬롯배율 × 요일배율`.

**슬롯**

| 슬롯 | 배율 | 근거 |
|---|---|---|
| 낮 | 1.0 | 기준 |
| 심야 | 1.25 | 사람이 몰리는 시간대 — 다만 심야 활동은 이미 체력·질병 위험을 안는다 |

**요일**

| 요일 | 배율 |
|---|---|
| 월 | 0.85 |
| 화 | 0.95 |
| 수 | 1.0 |
| 목 | 1.05 |
| 금 | 1.15 |
| 토 | 1.2 |
| 일 | 1.1 |

최저 조합(월요일 낮) 0.85 ↔ 최고 조합(토요일 심야) 1.5 — **약 1.75배** 차이다.
기존 `TRENDING_MULTIPLIER`(인기 카테고리)와 곱해지므로 겹치면 더 벌어진다.

⚠️ 배율 폭을 이보다 키우지 마라. 트윗 성과는 이미
`skillMul(0.3~2.2) × affinityMul(0.6~1.4) × trendMul × eff.reachMul`이 곱해지는 구조라,
여기에 큰 폭을 더하면 분산이 통제 불능이 된다.

## A4. 합류 지점

`calcTweetOutcome`의 `base` 계산에 `timingMul`을 곱한다 — `trendMul` 바로 옆이다.

```ts
const timingMul = timingMultiplier(state.day, state.slot);
const base = reach * skillMul * affinityMul * trendMul * timingMul * eff.reachMul;
```

⚠️ **`likes` 계산 앞이어야 한다.** `base`에 곱해야 좋아요·RT·팔로워가 전부 따라 움직인다.
팔로워에만 곱하면 "반응은 그대론데 팔로워만 다른" 이상한 결과가 된다.

## A5. 표시

작성 화면(`composeModal`)에 현재 타이밍을 한 줄로 알린다. 숫자를 그대로 보여주지 않고
**등급 문구**로 표현한다(게임이 계산기가 되지 않게):

| 최종 배율 | 문구 |
|---|---|
| ≥ 1.35 | 🔥 지금이 황금 시간대 |
| ≥ 1.1 | 📈 반응이 잘 오는 시간 |
| ≥ 0.95 | 무난한 시간대 |
| < 0.95 | 📉 사람이 없는 시간 |

---

# B. 인방 기록·업적

## B1. 목표

지금 `state.streamCount`는 저장만 되고 **아무데도 안 쓰인다**. 여기에
최고 시청자 기록과 업적을 붙여 방송을 반복할 이유를 만든다.

## B2. 파일 구성

| 계층 | 파일 | 역할 |
|---|---|---|
| core | `src/core/types.ts` (수정) | `streamBests: Record<string, number>` |
| core | `src/core/state.ts` (수정) | 초기값 `{}` |
| systems | `src/systems/save.ts` (수정) | 구세이브 기본값 |
| systems | `src/systems/livestream.ts` (수정) | `finishStream`이 기록 갱신 |
| data | `src/data/achievements.ts` (수정) | 방송 업적 4종 |
| ui | `src/ui/livestreamModal.ts` (수정) | 정산 화면에 신기록 표시 |

## B3. 기록

`raceBests`(마라톤)와 **같은 패턴**이다: 타입 id를 키로 최고 시청자 수를 저장한다.

```ts
/** 방송 타입별 최고 시청자 기록(data/livestream.ts의 STREAM_TYPES id가 키) */
streamBests: Record<string, number>;
```

`finishStream`이 정산하며 갱신하고, 신기록이면 결과에 `isBest: true`를 실어 보낸다.
UI는 정산 화면에 "🏆 신기록!"을 덧붙인다.

⚠️ 기록은 **최고 시청자(peak)가 아니라 최종 시청자**로 잡는다 —
peak는 모달 지역 변수라 systems가 모르고, 최종값이 방송을 잘 마쳤는지를 더 잘 반영한다.

## B4. 업적 4종

`data/achievements.ts`에 추가한다. 기존 업적과 같은 계약:
**순수 판정 함수**이며 상태를 변형하지 않고, 실존 필드만 읽는다.

| id | 이름 | 조건 |
|---|---|---|
| `stream_first` | 첫 방송 | `streamCount >= 1` |
| `stream_10` | 고정 시청자 | `streamCount >= 10` |
| `stream_1k` | 동접 네 자리 | 어느 타입이든 `streamBests` 최고가 1,000 이상 |
| `stream_all_types` | 만능 스트리머 | 세 타입 전부 `streamBests`에 기록이 있음 |

⚠️ `achievements.ts`는 `data/livestream.ts`를 import해야 `stream_all_types`에서
타입 목록을 참조할 수 있다. data→data 참조라 계층 규칙에 어긋나지 않는다.

## B5. 검증

- 회귀 테스트 `src/__tests__/timing.test.ts` 신규:
  1. 슬롯 배율: 심야 > 낮
  2. 요일 배율이 표와 일치하고 전부 [0.8, 1.3] 범위
  3. 최종 배율이 슬롯×요일이며 최저/최고 조합이 예상 범위
  4. 등급 문구가 경계값에서 올바르게 갈림
  5. `calcTweetOutcome`이 같은 조건에서 심야가 낮보다 평균 성과가 높음
- 회귀 테스트 `src/__tests__/livestream.test.ts` (추가):
  6. `finishStream`이 첫 방송에서 기록을 세우고 `isBest`를 true로 준다
  7. 더 낮은 시청자로 끝내면 기록이 안 깎이고 `isBest`가 false
  8. 타입별로 기록이 독립적이다
  9. 업적 4종이 조건대로 판정된다
- 구세이브 마이그레이션: `streamBests` 기본값 `{}`
- `npm run typecheck` → `npm run build` → `npx vitest run --pool=forks`

## B6. 명시적 비목표 (YAGNI)

- 합방(관계 캐릭터와 동시 방송) — 이번 범위 밖(사용자 확정)
- 방송 사고 이벤트
- 트윗 예약 발행 시스템 — 2슬롯 게임엔 과잉(사용자 확정)
- 시간대별 전용 트윗 문구 — 배율만으로 충분하다
- 업적 보상 — 기존 업적과 같이 수집·표시 전용이다
