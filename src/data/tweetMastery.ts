import { milestoneGrade } from "./milestones";

/**
 * 갈래 숙련 문턱(그 갈래 게시 누적, 오름차순). 넘긴 개수 = tier.
 *
 * 전체 플레이는 ~150~250 게임일 × 3~4.5 트윗/일 = 450~1100 트윗이다. 그 예산 위에서:
 *   10  — 게임 2~3일차. **첫 성취를 초반에** 준다(육성 피드백이 가장 비어 있던 구간).
 *   40  — 2~3주차.
 *   120 — 중반. 여러 갈래로 분산하는 균형형이 닿는 상한 근처.
 *   300 — 한 갈래에 트윗 60%를 몰아야 닿는다. 특화 플레이 종반 보상.
 *
 * ⚠️ 이 배열을 늘리면 MASTERY_TITLES도 같은 길이로 늘려야 한다
 *    (masteryTitle이 tier-1로 색인하므로 길이가 어긋나면 조용히 null이 된다).
 *    등급 배지(MILESTONE_GRADES)도 길이 4 고정이라 함께 봐야 한다.
 */
export const MASTERY_THRESHOLDS = [10, 40, 120, 300] as const;

/**
 * tier 1당 그 갈래의 도달 배율 증가분. 만렙(tier 4) = ×1.32.
 *
 * ⚠️ **밸런스 단일 조정점.** systems/followers.ts의 기존 레버는
 *    평판 3.3배 · 궁합 2.3배 · 트렌드 1.7배 · 스킬 8배다. 숙련은 만렙조차 1.32라
 *    "한 레버가 판을 흔들면 안 된다"는 그 파일의 원칙 안에 들어간다.
 *    100만 도달이 너무 빨라지면 **다른 곳 말고 이 값만** 낮춰라.
 *
 * 계단식(tier 단위)인 이유: 연속 배율이면 문턱을 넘는 **순간**이 없어져 성취가 되지 않는다.
 * 이 기능의 목적 자체가 그 순간을 만드는 것이다.
 */
export const MASTERY_TIER_BONUS = 0.08;

/**
 * tier 1~4의 칭호. 갈래명과 조합해 쓴다 → "IT계 터줏대감".
 *
 * 갈래별 전용 칭호(23갈래 × 4단계 = 92개)를 쓰지 않는 이유: 공용 4개로도 한국어가
 * 자연스럽게 붙고, 92개를 쓰는 값이 지금은 없다. 밋밋하게 느껴지면 그때 갈래별로 쪼개라.
 */
export const MASTERY_TITLES = ["입문", "단골", "터줏대감", "전설"] as const;

/** 게시 누적 → tier(0~4). 0은 첫 문턱 미달. NaN·음수는 0으로 떨어진다. */
export function masteryTierFor(count: number): number {
  const c = Number.isFinite(count) ? count : 0;
  let tier = 0;
  for (const t of MASTERY_THRESHOLDS) if (c >= t) tier++;
  return tier;
}

/** tier → 도달 배율(1.0 ~ 1.32). 배율을 다른 곳에서 재계산하지 마라. */
export function masteryMulFor(tier: number): number {
  return 1 + MASTERY_TIER_BONUS * Math.max(0, tier);
}

/** tier → 다음 문턱 게시 수(만렙이면 null). 진행 게이지의 분모다. */
export function masteryNextThreshold(tier: number): number | null {
  return MASTERY_THRESHOLDS[tier] ?? null;
}

/** tier → 칭호(0이면 null). */
export function masteryTitle(tier: number): string | null {
  return tier <= 0 ? null : MASTERY_TITLES[tier - 1] ?? null;
}

/**
 * tier → 등급 배지(B/A/S/SS). 스킬 마일스톤의 등급을 그대로 재사용한다.
 *
 * ⚠️ 숙련 tier는 **0이 미달**이라 마일스톤 tier(0=B)보다 1 밀려 있다.
 *    오프셋을 여기 한 곳에서만 처리하라 — UI가 각자 -1을 하면 반드시 한 곳이 어긋난다.
 */
export function masteryGrade(tier: number): string | null {
  return tier <= 0 ? null : milestoneGrade(tier - 1);
}
