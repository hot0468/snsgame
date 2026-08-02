import type { GameState } from "@/core/types";
import {
  RANK1_FOLLOWERS,
  RANK_LAST_FOLLOWERS,
  RANK_SIZE,
  RANK_TIERS,
  RANK_UNRANKED_LINE,
  type RankTier,
} from "@/data/popularity";
import { isLastDayOfMonth, monthKey } from "./calendar";
import { totalFollowers } from "./economy";
import { addSchedule } from "./time";

/**
 * 인기 순위 — 매월 말일에 계정 합계 팔로워로 1~100위를 매긴다.
 *
 * ⚠️ **순위표는 계산식이다. 다른 계정 100개를 시뮬레이션하지 않는다.**
 *    실제로 경쟁 계정을 굴리면 순위가 내 행동과 무관하게 흔들려, "이번 달 열심히 썼는데
 *    왜 내려갔지"가 된다. 성취감이 목적인 장치라 **내 팔로워만으로 결정**되어야 한다.
 *
 * ⚠️ 문턱은 등비수열이다 — 실제 SNS 팔로워 분포처럼 위로 갈수록 급격히 좁아진다.
 *    선형이면 1위(95만)와 2위가 9,500명 차이라 상위권이 종잇장처럼 얇아진다.
 */

/**
 * 그 순위가 되려면 필요한 팔로워 수. 1위 = RANK1_FOLLOWERS, 100위 = RANK_LAST_FOLLOWERS.
 * 사이는 등비로 잇는다(한 계단당 약 9%).
 */
export function rankThreshold(rank: number): number {
  const r = Math.min(Math.max(Math.round(rank), 1), RANK_SIZE);
  if (r === 1) return RANK1_FOLLOWERS;
  if (r === RANK_SIZE) return RANK_LAST_FOLLOWERS;
  const ratio = RANK_LAST_FOLLOWERS / RANK1_FOLLOWERS;
  return Math.round(RANK1_FOLLOWERS * Math.pow(ratio, (r - 1) / (RANK_SIZE - 1)));
}

/**
 * 이 팔로워 수의 순위(1~100). 100위 문턱에도 못 미치면 null(순위권 밖).
 *
 * ⚠️ 문턱이 내림차순이라 **위에서부터 첫 매치**가 곧 가장 좋은 순위다.
 */
export function popularityRank(followers: number): number | null {
  if (followers < RANK_LAST_FOLLOWERS) return null;
  for (let r = 1; r <= RANK_SIZE; r++) {
    if (followers >= rankThreshold(r)) return r;
  }
  return null;
}

/** 그 순위에 붙는 구간 문구. 순위권 밖이면 null. */
export function rankTier(rank: number | null): RankTier | null {
  if (rank == null) return null;
  return RANK_TIERS.find((t) => rank <= t.upTo) ?? null;
}

/** 다음 순위까지 남은 팔로워(1위거나 순위권 밖이면 null). */
export function followersToNextRank(followers: number): number | null {
  const rank = popularityRank(followers);
  if (rank == null || rank === 1) return null;
  return Math.max(0, rankThreshold(rank - 1) - followers);
}

/** 순위권 밖일 때, 100위에 들려면 남은 팔로워. 이미 순위권이면 0. */
export function followersToRankIn(followers: number): number {
  return Math.max(0, RANK_LAST_FOLLOWERS - followers);
}

/**
 * 말일이면 이번 달 순위를 확정한다(`time.onNewDay`가 부른다).
 *
 * ⚠️ **멱등해야 한다.** 같은 달을 두 번 집계하면 prevRank가 자기 자신으로 덮여
 *    "지난달과 같은 자리다"가 항상 뜬다. 달 키(`lastMonth`)로 막는다.
 * @returns 새로 집계했으면 true
 */
export function maybeRankMonth(state: GameState): boolean {
  if (state.gameOver) return false;
  if (!isLastDayOfMonth(state.day)) return false;
  const mk = monthKey(state.day);
  if (state.popularity.lastMonth === mk) return false;

  const followers = totalFollowers(state);
  const rank = popularityRank(followers);
  state.popularity = {
    lastMonth: mk,
    rank,
    prevRank: state.popularity.rank,
    followers,
    // 역대 최고는 **숫자가 작을수록** 좋다. 순위권 밖(null)은 갱신 대상이 아니다.
    best:
      rank == null
        ? state.popularity.best
        : state.popularity.best == null
          ? rank
          : Math.min(state.popularity.best, rank),
  };
  state.pendingPopularity = true;
  addSchedule(
    state,
    rank == null ? "월간 인기 순위 — 순위권 밖" : `월간 인기 순위 ${rank}위`,
    "sns",
  );
  return true;
}

/** 발표 화면 본문(구간 문구 + 지난달 대비). ui가 그대로 쓴다. */
export function rankAnnouncement(state: GameState): string {
  const { rank, prevRank } = state.popularity;
  const tier = rankTier(rank);
  const head = tier ? tier.line : RANK_UNRANKED_LINE;
  if (rank == null) return head;
  if (prevRank == null) return `${head}\n\n첫 순위 발표다.`;
  if (prevRank === rank) return `${head}\n\n지난달과 같은 자리다.`;
  return prevRank > rank
    ? `${head}\n\n지난달보다 ${prevRank - rank}계단 올랐다.`
    : `${head}\n\n지난달보다 ${rank - prevRank}계단 내려갔다.`;
}
