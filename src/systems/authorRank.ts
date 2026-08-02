import type { GameState } from "@/core/types";
import {
  AUTHOR_RANK1_SCORE,
  AUTHOR_RANK_LAST_SCORE,
  AUTHOR_RANK_SIZE,
  AUTHOR_RANK_TIERS,
  AUTHOR_RANK_UNRANKED,
  DILIGENCE_TIERS,
  RIVAL_TITLES,
  type AuthorRankTier,
} from "@/data/authorRank";
import { AUTHOR_WORKLOAD_TARGET, authorMonthlySalary } from "./author";
import { hashInt } from "@/utils/random";

/**
 * 웹툰 플랫폼 월간 연재 순위.
 *
 * 작가는 매달 원고를 그리는데 결과가 통장 숫자와 편집자 코멘트 한 줄로만 돌아왔다.
 * 순위표가 걸리면 한 달치 작업이 등수 하나로 요약된다.
 *
 * ⚠️ **순위표는 계산식이다.** 경쟁작 50편을 실제로 굴리지 않는다 — 굴리면 순위가 내 작업과
 *    무관하게 흔들려 "이번 달 열심히 그렸는데 왜 내려갔지"가 된다(popularity.ts와 같은 이유).
 *    위에 걸리는 경쟁작 이름은 **표시용 장식**이고, 순위 자체는 내 점수만으로 정해진다.
 */

/** 이번 달 연재 성실도 배율과 그 라벨. 작업량 게이지가 목표의 몇 %인지로 갈린다. */
export function diligenceOf(workload: number): { mul: number; label: string; ratio: number } {
  const ratio = AUTHOR_WORKLOAD_TARGET > 0 ? workload / AUTHOR_WORKLOAD_TARGET : 0;
  const tier =
    DILIGENCE_TIERS.find((t) => ratio >= t.minRatio) ?? DILIGENCE_TIERS[DILIGENCE_TIERS.length - 1];
  return { mul: tier.mul, label: tier.label, ratio };
}

/**
 * 순위 점수 = 인기 지표 × 연재 성실도.
 *
 * ⚠️ 인기 지표(`authorMonthlySalary`)는 연차·팔로워만 본다. 그 달 작업을 반영하는 건
 *    **여기 곱해지는 성실도**뿐이다 — 두 축을 섞지 마라(그쪽 주석과 짝).
 */
export function authorRankScore(state: GameState): number {
  const c = state.authorContract;
  if (!c) return 0;
  const popularity = authorMonthlySalary(state, c.monthsWorked);
  return Math.round(popularity * diligenceOf(c.workload).mul);
}

/** 그 순위가 되려면 필요한 점수. 1위 = 최고, 50위 = 진입선. 사이는 등비. */
export function authorRankThreshold(rank: number): number {
  const r = Math.min(Math.max(Math.round(rank), 1), AUTHOR_RANK_SIZE);
  if (r === 1) return AUTHOR_RANK1_SCORE;
  if (r === AUTHOR_RANK_SIZE) return AUTHOR_RANK_LAST_SCORE;
  const ratio = AUTHOR_RANK_LAST_SCORE / AUTHOR_RANK1_SCORE;
  return Math.round(
    AUTHOR_RANK1_SCORE * Math.pow(ratio, (r - 1) / (AUTHOR_RANK_SIZE - 1)),
  );
}

/** 점수 → 순위(1~50). 진입선에 못 미치면 null. */
export function authorRankOf(score: number): number | null {
  if (score < AUTHOR_RANK_LAST_SCORE) return null;
  for (let r = 1; r <= AUTHOR_RANK_SIZE; r++) {
    if (score >= authorRankThreshold(r)) return r;
  }
  return null;
}

/** 그 순위의 편집자 코멘트. 순위권 밖이면 null. */
export function authorRankTier(rank: number | null): AuthorRankTier | null {
  if (rank == null) return null;
  return AUTHOR_RANK_TIERS.find((t) => rank <= t.upTo) ?? null;
}

/**
 * 내 바로 위에 걸린 경쟁작 이름(1위면 null).
 *
 * ⚠️ 달·순위로 **결정론적**으로 고른다. 무작위로 뽑으면 재렌더마다 이름이 갈려
 *    "방금 뭐였지"가 된다(dmReplyOptions·todayPeemangItems와 같은 규칙).
 */
export function rivalAbove(month: number, rank: number | null): string | null {
  if (rank == null || rank <= 1) return null;
  return RIVAL_TITLES[hashInt(`rival:${month}:${rank}`) % RIVAL_TITLES.length];
}

/**
 * 이번 달 순위를 확정한다. **월 정산이 끝난 자리에서** 부른다(systems/author.settleAuthorMonthly).
 *
 * ⚠️ 정산 **뒤에** 불러야 monthsWorked가 이번 달치까지 반영된 값이 된다. 앞에서 부르면
 *    연차가 한 달 모자란 점수로 순위가 매겨진다.
 * ⚠️ 게이지 리셋 **전에** 불러야 이번 달 작업량이 성실도에 잡힌다.
 */
export function recordAuthorRank(state: GameState, month: number): void {
  const c = state.authorContract;
  if (!c) return;
  const score = authorRankScore(state);
  const rank = authorRankOf(score);
  const prev = state.authorRank;
  state.authorRank = {
    lastMonth: month,
    rank,
    prevRank: prev?.rank ?? null,
    score,
    diligence: diligenceOf(c.workload).label,
    best: rank == null ? (prev?.best ?? null) : Math.min(prev?.best ?? rank, rank),
  };
  state.pendingAuthorRank = true;
}

/** 발표 본문(구간 코멘트 + 지난달 대비). ui가 그대로 쓴다. */
export function authorRankAnnouncement(state: GameState): string {
  const r = state.authorRank;
  if (!r) return "";
  const tier = authorRankTier(r.rank);
  const head = tier ? tier.line : AUTHOR_RANK_UNRANKED;
  if (r.rank == null) return head;
  if (r.prevRank == null) return `${head}\n\n첫 순위 발표예요.`;
  if (r.prevRank === r.rank) return `${head}\n\n지난달과 같은 자리예요.`;
  return r.prevRank > r.rank
    ? `${head}\n\n지난달보다 ${r.prevRank - r.rank}계단 올랐어요.`
    : `${head}\n\n지난달보다 ${r.rank - r.prevRank}계단 내려갔어요.`;
}
