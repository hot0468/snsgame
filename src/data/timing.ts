/**
 * 트윗 게시 타이밍(알고리즘) 배율표.
 * 규칙 적용은 systems/followers.ts의 calcTweetOutcome이, 표시는 ui/sns/composeModal.ts가 한다.
 *
 * ⚠️ 게임의 하루는 **낮·심야 2슬롯**뿐이라 슬롯만으론 선택지가 2개고 금방 최적해가 굳는다.
 *    그래서 **요일**을 곱해 7×2 = 14가지로 벌린다.
 *
 * ⚠️ 배율 폭을 이보다 키우지 마라. 트윗 성과는 이미
 *    skillMul(0.3~2.2) × affinityMul(0.6~1.4) × trendMul × eff.reachMul이 곱해지는 구조라,
 *    여기에 큰 폭을 더하면 분산이 통제 불능이 된다.
 */

/** 슬롯별 도달 배율 — 인덱스가 곧 state.slot (0=낮, 1=심야) */
export const SLOT_TIMING_MULTIPLIERS: number[] = [
  1.0, // 낮 — 기준
  1.25, // 심야 — 사람이 몰리지만, 심야 활동은 이미 체력·질병 위험을 안는다
];

/** 요일별 도달 배율 — 인덱스가 곧 Date.getDay() (0=일 ~ 6=토) */
export const WEEKDAY_TIMING_MULTIPLIERS: number[] = [
  1.1, // 일
  0.85, // 월 — 다들 출근/등교로 정신없다
  0.95, // 화
  1.0, // 수
  1.05, // 목
  1.15, // 금 — 불금
  1.2, // 토 — 가장 한가하다
];

/** 타이밍 등급 — 숫자를 그대로 보여주지 않는다(게임이 계산기가 되지 않게) */
export interface TimingTier {
  /** 이 배율 이상이면 이 등급 */
  min: number;
  label: string;
  /** ui 클래스 접미사 */
  kind: "hot" | "good" | "normal" | "cold";
}

/** 위에서부터 순서대로 검사한다(내림차순 유지 필수) */
export const TIMING_TIERS: TimingTier[] = [
  { min: 1.35, label: "🔥 지금이 황금 시간대", kind: "hot" },
  { min: 1.1, label: "📈 반응이 잘 오는 시간", kind: "good" },
  { min: 0.95, label: "무난한 시간대", kind: "normal" },
  { min: 0, label: "📉 사람이 없는 시간", kind: "cold" },
];
