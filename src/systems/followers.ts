import type { AttributeId, GameState, TweetKind } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { NIGL_COMPANY } from "@/data/niglnigl";
import { MAX_SKILL } from "@/data/stats";
import { isTrending, TRENDING_MULTIPLIER } from "@/data/trends";
import {
  SLOT_TIMING_MULTIPLIERS,
  TIMING_TIERS,
  WEEKDAY_TIMING_MULTIPLIERS,
  type TimingTier,
} from "@/data/timing";
import { dayOfWeek } from "./calendar";
import { checkWin } from "./winEnding";

/**
 * RT → 신규 팔로워 전환율. **의도적으로 상수다 — 스킬을 곱하지 마라.**
 *
 * 예전엔 `0.06 + skill01 * 0.44`(스킬 0→6%, 999→50%)였고, 스킬이 skillMul(0.3→2.5)에도
 * 동시에 곱해져 **스킬 하나가 팔로워를 58배** 흔들었다. 다른 레버는 전부 합쳐도 13배
 * (평판 3.3 · 궁합 2.3 · 트렌드 1.7)라 최적 플레이가 "스킬 만렙 찍고 트윗"뿐이었다.
 *
 * 측정(궁합최적·평판100·행동력을 전량 트윗에 투입 = 이상적 상한 속도, 100만 도달일):
 *   전환율에 스킬 곱하던 시절 — 스킬 0: 5985일 / 300: 1193일 / 999: 103일 (격차 58배).
 *   스킬을 skillMul에만 남긴 뒤(격차 8배) + 오목곡선(SKILL_CURVE_EXP=0.6) 적용 현재값:
 *     스킬 0: ~1230일 / 300: ~270일 / 600: ~190일 / 999: ~145일 (기본집).
 *   ⚠️ 위 수치는 **모든 연계 스탯이 같은 값**인 균형형 기준이다. 최고 스탯 가중
 *      (SKILL_MAX_WEIGHT=0.7 · SKILL_MUL_SPAN 2.2→1.9 보정) 도입 후 균형형은 +12~14% 느려지고
 *      특화형은 그대로다 — 프로필별 실측 표는 SKILL_MUL_SPAN 주석에 있다.
 *     좋은 집(행동력 회복 보너스)이면 600 기준 ~130일. 행동력(트윗당 10)이 병목이다.
 *     ⚠️ 위 도달일 추정은 **일 회복 30이던 시절(지속 ~3트윗/일)** 기준이다.
 *        이후 `SLEEP_ACTION_RECOVER`가 45로 올라(슬롯당 평균 22.5) 이론상 ~4.5트윗/일이 되므로
 *        상한 속도는 그만큼 빨라진다 — 회복량을 다시 조정하면 이 표도 함께 재측정하라.
 *     실전은 육성·생활에 행동력을 나눠 써 더 느리되, 스킬 성장·트렌드·
 *     이벤트 보너스가 중반을 당긴다 → 집중 육성 시 체감 4~8개월(150~250 게임일).
 * 스킬은 skillMul에만 남는다. 그래야 집·평판·궁합·트렌드가 의미를 갖는다.
 */
export const TWEET_CONV_RATE = 0.32;

/**
 * skillMul 가중 곡선의 지수. 양 끝점(스킬 0→0.3배, 999→2.5배, 격차 8배)은
 * 지수와 무관하게 고정이고, **중간 구간의 체감만** 바꾼다.
 *   1 = 선형 · 2 = 옛 볼록(초반 바닥, 후반 급등) · <1 = 오목(초반부터 눈에 보임).
 * 0.6 기준 skillWeight: 100→0.25 · 300→0.49 · 500→0.66(옛 0.25).
 * 초반 육성 피드백을 살리려 오목으로 뒀다 — 낮출수록 초반이 더 도드라지고
 * 만렙까지의 체감 시간이 짧아진다. 진행 속도가 빠르다 싶으면 이 값을 1쪽으로.
 */
export const SKILL_CURVE_EXP = 0.6;

/**
 * 연계 스탯 점수에서 **최고 스탯**이 차지하는 비중(나머지는 평균).
 * `skillScore = max * SKILL_MAX_WEIGHT + avg * (1 - SKILL_MAX_WEIGHT)`
 *
 * ⚠️ 예전엔 순수 평균이었다. 그래서 `daily`(친화력+어휘력)에 친화력만 999를 찍으면
 * skillAvg가 499.5로 반토막 나 **특화가 오히려 손해**였다 — 육성게임에서 배분을 고민할
 * 이유를 없애는 구조적 결함이었다. 최고 스탯에 가중을 실어 "한 우물을 파도 보상받는다"로 뒤집는다.
 *   0 = 옛 순수 평균 · 1 = 최고 스탯만(부스탯이 완전히 무의미해짐).
 * 0.7은 부스탯을 30%만 남겨 "주력을 밀되 부스탯도 버리진 않는" 배분을 유도한다.
 *
 * ⚠️ 이 값을 올리면 특화 유저의 skillScore 입력값이 통째로 올라가므로
 *    **SKILL_MUL_SPAN을 함께 낮춰 진행 속도를 상쇄해야 한다**(아래 주석의 실측 표 참조).
 */
export const SKILL_MAX_WEIGHT = 0.7;

/**
 * skillMul의 진폭(스킬 0 → SKILL_MUL_BASE배, 999 → BASE+SPAN배).
 *
 * **SKILL_MAX_WEIGHT 도입에 따른 속도 보정치.** 옛 순수 평균 시절엔 2.2였으나,
 * 최고 스탯 가중이 특화 유저의 skillScore를 크게 밀어올려 게임이 짧아지므로 1.9로 낮췄다.
 *
 * 측정(궁합최적·평판100·지속 3트윗/일 = TWEET_CONV_RATE 주석과 동일 조건, 100만 도달일).
 * `avg/2.2`(구) → `max0.7+avg0.3 / 1.9`(신):
 *   현실 특화형 주력450·부200 — 286 → 280일 (-2%)
 *   현실 특화형 주력800·부350 — 216 → 213일 (-1%)
 *   초반       주력150·부70  — 456 → 457일 (+0%)
 *   균형형     350/350       — 271 → 306일 (+13%)
 *   균형형     600/600       — 210 → 236일 (+12%)
 *   균형 만렙  999/999       — 161 → 183일 (+14%)
 *   극단 특화  999/0         — 233 → 196일 (-16%)
 * 즉 **특화 유저의 총 진행 속도는 그대로 두고**(±2%), 만능형이 상대적으로 느려지는 것으로만
 * 특화의 이점을 표현한다. 부스탯을 완전히 버린 999/0은 자연 플레이에서 나오지 않는 극단값이다.
 * 계수를 1.8까지 낮추면 특화형도 함께 느려져(+2%) '속도 유지'가 깨진다 — 낮추지 마라.
 */
export const SKILL_MUL_SPAN = 1.9;

/** skillMul의 하한(스킬 0일 때의 배율). 최고 스탯 가중과 무관한 고정 바닥. */
export const SKILL_MUL_BASE = 0.3;

/**
 * 트윗 연계 스탯 점수(0~999). 최고 스탯에 SKILL_MAX_WEIGHT만큼 가중을 싣는다.
 * 순수 평균이 아니라 이 함수를 쓰는 이유는 SKILL_MAX_WEIGHT 주석 참조.
 * UI가 "이 트윗에 내 어떤 스탯이 얼마나 먹히는지" 표시할 때도 이 함수를 써야 계산과 일치한다.
 */
export function relatedSkillScore(state: GameState, attr: AttributeId): number {
  const rel = ATTRIBUTES[attr].relatedSkills;
  if (rel.length === 0) return 0;
  let sum = 0;
  let max = 0;
  for (const s of rel) {
    const v = state.skills[s];
    sum += v;
    if (v > max) max = v;
  }
  const avg = sum / rel.length;
  return max * SKILL_MAX_WEIGHT + avg * (1 - SKILL_MAX_WEIGHT);
}

export interface TweetOutcome {
  likes: number;
  retweets: number;
  followers: number; // 증감(음수 가능)
}

/**
 * 트윗 성격별 효과. **밸런스 튜닝 지점** — 시작값(실측 후 조정 전제).
 * calcTweetOutcome이 reachMul·varLow·varRange(도달·분산)를 쓰고,
 * postTweet이 controversyBonus·reputationDelta·knowledgeDelta(게시 후 부수효과)를 적용한다.
 * plain은 전부 중립값(1.0/0)이라 성격 미지정(특수 모드) 경로는 기존 동작과 동일하다.
 */
export interface TweetKindEffect {
  reachMul: number; // 기본 도달·유입 배율
  varLow: number; // 좋아요 랜덤 하한 계수
  varRange: number; // 좋아요 랜덤 폭(클수록 대박/폭망이 갈림)
  controversyBonus: number; // 게시 후 추가 논란 확률
  reputationDelta: number; // 게시 후 평판 증감(0~100 스케일)
  knowledgeDelta: number; // 게시 후 지식 스킬 증감(999 스케일)
  /**
   * 게시 후 정신력 증감(0~100 스케일).
   * ⚠️ **감성의 대가다.** 이게 없으면 감성이 무난의 완전 상위호환이 되어(도달 1.2배에 페널티 0)
   *    4장 중 3장을 누를 이유가 사라진다 — 실제로 그 상태였다.
   */
  mentalDelta: number;
}

/**
 * ⚠️ **4성격은 서로 트레이드오프여야 한다.** 어느 하나가 다른 하나의 완전 상위호환이 되면
 *    카드가 4장 떠도 실질 선택지는 그만큼 줄어들고, 작성이 기계적인 클릭이 된다.
 *    지금 축: 도달(reachMul) ↔ 정신력(mentalDelta) ↔ 평판·논란 ↔ 안정성(varRange).
 *    **무난은 유일하게 아무것도 잃지 않는 선택지**라는 게 그 자리의 값이다.
 */
export const TWEET_KIND_EFFECTS: Record<TweetKind, TweetKindEffect> = {
  // 무난: 도달은 기준점이지만 **잃는 게 하나도 없다**(정신력·평판·논란 전부 0).
  //       정신력이 빠듯할 때 고르는 카드 — 이게 이 성격의 존재 이유다.
  plain: { reachMul: 1.0, varLow: 0.8, varRange: 0.6, controversyBonus: 0, reputationDelta: 0, knowledgeDelta: 0, mentalDelta: 0 },
  // 자극: 도달 최고 + 분산 대폭↑(0.4~1.9배로 대박/폭망 갈림) + 논란 +0.12 + 평판 -3.
  //       정신력도 깎인다 — 싸움을 걸고 반응을 받아내는 일이라 소모가 크다.
  provoke: { reachMul: 1.35, varLow: 0.4, varRange: 1.5, controversyBonus: 0.12, reputationDelta: -3, knowledgeDelta: 0, mentalDelta: -4 },
  // 정보: 유입 ×0.85(꾸준·저분산) 대신 평판 +2, 지식 +2. 정신력은 안 깎인다(차분한 작업).
  info: { reachMul: 0.85, varLow: 0.85, varRange: 0.4, controversyBonus: 0, reputationDelta: 2, knowledgeDelta: 2, mentalDelta: 0 },
  // 감성: 유입 ×1.2(공감·확산)의 **대가로 정신력을 낸다**. 속을 꺼내 파는 글이라 소모된다.
  //       연속으로 쓰면 정신력이 바닥나 우울 모드에 걸리는 게 의도된 제동이다.
  emotional: { reachMul: 1.2, varLow: 0.8, varRange: 0.6, controversyBonus: 0, reputationDelta: 0, knowledgeDelta: 0, mentalDelta: -3 },
};

/**
 * 평판에 따른 팔로워 '증가분' 배율(0.3~1.0).
 * 평판이 높으면 1.0, 낮을수록 신규 유입이 줄어든다. (감소분에는 적용 안 함)
 */
export function reputationFactor(state: GameState): number {
  return Math.max(0.3, state.resources.reputation / 100);
}

/**
 * 내 트윗 성과 계산.
 * - 연계 세부 스탯 평균이 높을수록 좋아요/RT/신규팔로워 증가.
 * - 내 계정 주 성향과 트윗 성향의 궁합이 성과 배율에 반영된다.
 * - 팔로워 규모에 비례한 기본 도달도 존재.
 */
/**
 * 게시 타이밍(슬롯 × 요일) 도달 배율.
 * 최저 월요일 낮 0.85 ~ 최고 토요일 심야 1.5 — 약 1.75배 차이다.
 * ⚠️ 표에 없는 슬롯/요일은 1로 떨어뜨린다(SLOTS_PER_DAY가 늘어도 크래시하지 않게).
 */
export function timingMultiplier(day: number, slot: number): number {
  const slotMul = SLOT_TIMING_MULTIPLIERS[slot] ?? 1;
  const dayMul = WEEKDAY_TIMING_MULTIPLIERS[dayOfWeek(day)] ?? 1;
  return slotMul * dayMul;
}

/** 타이밍 배율에 해당하는 등급(숫자 대신 문구로 보여주기 위함) */
export function timingTier(mul: number): TimingTier {
  return TIMING_TIERS.find((t) => mul >= t.min) ?? TIMING_TIERS[TIMING_TIERS.length - 1];
}

export function calcTweetOutcome(
  state: GameState,
  attr: AttributeId,
  kind: TweetKind = "plain",
): TweetOutcome {
  const eff = TWEET_KIND_EFFECTS[kind];
  // 연계 스탯 점수 — 순수 평균이 아니라 최고 스탯 가중(특화 보상). relatedSkillScore 참조.
  const skillScore = relatedSkillScore(state, attr);

  const account = getActiveAccount(state);
  const affinity = getAffinity(account.attribute, attr); // -1..1
  const affinityMul = 1 + affinity * 0.4; // 0.6 ~ 1.4

  // 연계 스탯 정도(0~1). 초반 육성이 눈에 보이도록 오목 가중(SKILL_CURVE_EXP<1).
  const skill01 = Math.min(1, Math.max(0, skillScore) / MAX_SKILL);
  const skillWeight = Math.pow(skill01, SKILL_CURVE_EXP); // 0 → 0, 500 → 0.66, 999 → 1

  // 기본 도달: 팔로워의 일정 비율 + 최소 노출
  const reach = 20 + account.followers * 0.05;
  // 스킬점수 0 → 0.3배, 500 → 1.55배, 999 → 2.2배 (SPAN은 최고스탯 가중의 속도 보정치)
  const skillMul = SKILL_MUL_BASE + skillWeight * SKILL_MUL_SPAN;

  // 오늘의 인기 카테고리면 도달·성과가 크게 상승
  const trendMul = isTrending(state.day, attr) ? TRENDING_MULTIPLIER : 1;

  // 게시 시간대(슬롯×요일) 배율 — 심야·주말이 유리하다.
  // ⚠️ 반드시 base에 곱한다(likes 계산 앞). 팔로워에만 곱하면 "반응은 그대론데
  //    팔로워만 다른" 이상한 결과가 된다.
  const timingMul = timingMultiplier(state.day, state.slot);

  // 성격별 도달 배율(자극↑·정보↓·감성↑)과 분산(자극은 대박/폭망이 갈림)을 반영한다.
  const base = reach * skillMul * affinityMul * trendMul * timingMul * eff.reachMul;
  const likes = Math.round(base * (eff.varLow + Math.random() * eff.varRange));
  const retweets = Math.round(likes * (0.15 + Math.random() * 0.2));

  // 신규 팔로워: RT 전환율은 스킬과 무관한 상수(TWEET_CONV_RATE), 궁합 보너스만 스탯에 좌우된다.
  const affinityBonus = affinity * (0.5 + skill01 * 3.5); // 저스탯이면 궁합 이득도 작음
  let followers = Math.round(retweets * TWEET_CONV_RATE + affinityBonus);
  if (affinity < 0) {
    // 상충 카테고리는 언팔 위험(스탯이 높을수록 파급도 큼)
    followers = Math.min(followers, Math.round(affinity * (2 + skill01 * 6)));
  }
  // 평판이 낮으면 신규 유입이 줄어든다(증가분에만 적용)
  if (followers > 0) followers = Math.round(followers * reputationFactor(state));

  // 니글니글 재직 중이면 IT계 트윗의 신규 팔로워만 2배(혜택이므로 이득만 — 상충 손실은 안 키운다).
  if (followers > 0 && attr === "it" && state.employment?.company === NIGL_COMPANY) followers *= 2;

  return { likes, retweets, followers };
}

/**
 * 계정 팔로우 / 게시글 조우 시 내 팔로워 증감 계산.
 * 내 성향과 상대 성향의 궁합에 따라 늘거나 준다.
 */
export function calcEncounterFollowerDelta(
  state: GameState,
  otherAttr: AttributeId,
): number {
  const affinity = getAffinity(getActiveAccount(state).attribute, otherAttr); // -1..1
  const magnitude = 3 + Math.floor(Math.random() * 6);
  const raw = affinity === 0 ? Math.floor(magnitude / 3) : Math.round(affinity * magnitude);
  // 평판이 낮으면 유입이 줄어든다(증가분에만 적용)
  return raw > 0 ? Math.round(raw * reputationFactor(state)) : raw;
}

/** 활성 계정의 팔로워 수를 안전하게 변경(0 미만 방지) */
export function changeFollowers(state: GameState, delta: number): void {
  const account = getActiveAccount(state);
  account.followers = Math.max(0, account.followers + delta);
  // 게시 슬롯 상한이 팔로워 티어를 넘어 늘었으면 pending 알림을 세운다. maxPostSlots는 순수 계산이라
  // changeFollowers가 자주 불려도 무해하다. lastMaxPostSlots는 증가·감소 무관하게 항상 동기화한다.
  // 게시 슬롯 상한은 전 계정 공유 → 전 계정 팔로워 합계로 판정한다.
  const nowMax = currentMaxPostSlots(state);
  if (nowMax > state.lastMaxPostSlots) state.postSlotIncreasedTo = nowMax;
  state.lastMaxPostSlots = nowMax;
  // 팔로워 100만 달성 → 스탯에 따른 승리 엔딩(최종 목표). 도달 시 gameOver를 세운다.
  checkWin(state);
}

/* ─────────────────── 게시 슬롯 곡선 ─────────────────── */

/** 게시 슬롯 상한(엔드게임 최상위 구간에서 닿는 천장). */
export const MAX_POST_SLOTS = 10;

/**
 * 팔로워 수 → 하루 최대 게시 슬롯. **밸런스 튜닝 지점** — 값을 여기서 조정한다.
 * 각 [최소팔로워, 슬롯] 구간. 내림차순으로 첫 매치가 그날의 슬롯 상한이다.
 * (시작값 — 실측 후 조정 전제. 0→1, 20→2 … 100만→10.)
 */
export const POST_SLOT_TIERS: readonly (readonly [followers: number, slots: number])[] = [
  [1_000_000, 10],
  [400_000, 9],
  [150_000, 8],
  [50_000, 7],
  [10_000, 6],
  [2_000, 5],
  [500, 4],
  [100, 3],
  [20, 2],
  [0, 1],
];

/** 전 계정 팔로워 합계. */
export function accountsTotalFollowers(state: GameState): number {
  return state.accounts.reduce((sum, a) => sum + a.followers, 0);
}

/**
 * 오늘 하루 최대 게시 슬롯(전 계정 공유 예산의 상한).
 * 게시 슬롯은 계정별이 아니라 전 계정 통합이므로 **팔로워 합계** 티어로 판정한다.
 */
export function currentMaxPostSlots(state: GameState): number {
  return maxPostSlots(accountsTotalFollowers(state));
}

/** 팔로워 수 → 오늘 최대 게시 슬롯 수(1~MAX_POST_SLOTS). */
export function maxPostSlots(followers: number): number {
  const f = Number.isFinite(followers) ? followers : 0;
  for (const [threshold, slots] of POST_SLOT_TIERS) {
    if (f >= threshold) return Math.min(slots, MAX_POST_SLOTS);
  }
  return 1;
}
