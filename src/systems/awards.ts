import type { GameState } from "@/core/types";
import {
  AWARDS,
  AWARDS_NO_WIN_LINES,
  MEDIA_AWARDS_DATE,
  MEDIA_AWARDS_MONTH,
  MEDIA_AWARDS_NAME,
  WORK_AWARDS_DATE,
  WORK_AWARDS_MONTH,
  WORK_AWARDS_NAME,
  type AwardDef,
} from "@/data/awards";
import { getActiveAccount } from "@/core/state";
import { dateOf, dateOfMonth } from "./calendar";
import { changeFollowers } from "./followers";
import { trackCount } from "./jobRanks";
import { clampResource } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 연말 시상식 — 12월 29일 송년회, 12월 30일 방송미디어대상.
 *
 * ⚠️ **상은 '올해 실적'으로 준다.** 누적으로 주면 한 번 쌓아놓고 매년 같은 상을 받는
 *    자리가 된다. 그런데 분야별 카운터는 전부 **누적**이라 연도별 값이 없다 —
 *    그래서 **해가 바뀔 때 누적치를 스냅샷**(`yearStart`)해두고 지금과의 차이를 올해 실적으로 쓴다.
 *    카운터 올리는 자리 여덟 곳을 건드리지 않고 한 곳(onNewDay)에서 끝나는 게 이 방식의 값이다.
 *
 * ⚠️ 실적 단위는 `jobRanks.trackCount`와 같다 — 작가·다단계·회사원은 그쪽에서 ×5로
 *    환산되므로 문턱도 그 단위로 적혀 있다(data/awards.ts의 주석 참조).
 */

/** 오늘이 그 시상식 날인지. */
export function isAwardDay(state: GameState, show: "media" | "work"): boolean {
  const d = dateOf(state.day);
  const month = show === "media" ? MEDIA_AWARDS_MONTH : WORK_AWARDS_MONTH;
  const date = show === "media" ? MEDIA_AWARDS_DATE : WORK_AWARDS_DATE;
  return d.getMonth() + 1 === month && dateOfMonth(state.day) === date;
}

/**
 * 해가 바뀌면 분야별 누적치를 찍어둔다(`time.onNewDay`).
 * 이 스냅샷과 지금의 차이가 곧 '올해 실적'이다.
 */
export function snapshotYearStart(state: GameState): void {
  const year = dateOf(state.day).getFullYear();
  if (state.yearStat?.year === year) return;

  // 해가 실제로 바뀌었으면(첫 스냅샷이 아니면) 지난해 결산을 남긴다 —
  // 연말 시상식으로 12월은 채워졌는데 새해 첫날은 비어 있었다. 데이터는 이미 다 있다.
  const prev = state.yearStat;
  if (prev) {
    const account = getActiveAccount(state);
    state.yearReview = {
      year: prev.year,
      followers: account.followers,
      followerGain: account.followers - (state.yearOpenFollowers ?? account.followers),
      money: state.money,
      awards: (state.awardsWon ?? []).filter((w) => w.year === prev.year).length,
      peaks: (state.careerPeaks ?? []).length,
      bestRank: state.popularity?.best ?? null,
      donated: state.donatedTotal ?? 0,
    };
    state.pendingYearReview = true;
  }

  const counts: Record<string, number> = {};
  for (const a of AWARDS) counts[a.field] = trackCount(state, a.field);
  state.yearStat = { year, counts };
  // 다음 결산에서 '올해 늘어난 팔로워'를 재려면 새해 첫날 값을 찍어둬야 한다.
  state.yearOpenFollowers = getActiveAccount(state).followers;
}

/** 그 분야의 올해 실적(스냅샷이 없으면 누적 전체를 올해치로 본다 — 첫 해다). */
export function yearCount(state: GameState, field: string): number {
  const base = state.yearStat?.counts[field] ?? 0;
  return Math.max(0, trackCount(state, field) - base);
}

export interface AwardResult {
  award: AwardDef;
  /** 대상이면 true(본상이면 false) */
  grand: boolean;
  prize: number;
}

/**
 * 그 시상식에서 받을 상. 후보 자격 미달이면 null.
 *
 * ⚠️ **한 시상식에서 상은 하나만** 준다. 여러 분야를 걸치면 그 해 실적이 가장 큰 쪽으로
 *    간다 — 상을 줄줄이 안기면 시상식이 정산 화면이 된다.
 */
export function awardFor(state: GameState, show: "media" | "work"): AwardResult | null {
  let best: AwardResult | null = null;
  let bestRatio = 0;
  for (const a of AWARDS) {
    if (a.show !== show) continue;
    const count = yearCount(state, a.field);
    if (count < a.minYearCount) continue;
    const grand = count >= a.grandCount;
    // 여러 분야가 자격을 채우면 **문턱 대비 초과율**이 큰 쪽을 준다(절대 횟수는 분야마다 단위가 달라 못 쓴다).
    const ratio = count / a.minYearCount;
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = { award: a, grand, prize: a.prize * (grand ? 2 : 1) };
    }
  }
  return best;
}

/** 오늘 시상식이 열리고 아직 안 봤으면 예약한다(`time.onNewDay`). */
export function maybeHoldAwards(state: GameState): boolean {
  if (state.gameOver || state.pendingAwards) return false;
  const year = dateOf(state.day).getFullYear();
  for (const show of ["work", "media"] as const) {
    if (!isAwardDay(state, show)) continue;
    const stamp = state.awardsHeld?.[show];
    if (stamp === year) continue; // 올해 이미 열었다
    if (!state.awardsHeld) state.awardsHeld = {};
    state.awardsHeld[show] = year;
    state.pendingAwards = show;
    return true;
  }
  return false;
}

export interface AwardsOutcome {
  show: "media" | "work";
  showName: string;
  result: AwardResult | null;
  /** 상을 못 받았을 때의 한 줄 */
  missLine: string;
}

/**
 * 예약된 시상식을 치른다(ui가 '확인'에서 부른다) — 상금·평판·팔로워를 지급하고 플래그를 비운다.
 *
 * ⚠️ **멱등해야 한다.** 두 번 눌려도 상금이 두 번 들어가면 안 된다.
 */
export function resolveAwards(state: GameState): AwardsOutcome | null {
  const show = state.pendingAwards;
  if (!show) return null;
  state.pendingAwards = null;

  const showName = show === "media" ? MEDIA_AWARDS_NAME : WORK_AWARDS_NAME;
  const result = awardFor(state, show);
  if (!result) {
    addSchedule(state, `${showName} — 수상 없음`, "sns");
    return { show, showName, result: null, missLine: pick([...AWARDS_NO_WIN_LINES]) };
  }

  const { award, grand, prize } = result;
  state.money += prize;
  state.resources.reputation = clampResource(state.resources.reputation + award.reputation);
  changeFollowers(state, award.followers);
  // 수상 이력은 커리어처럼 남긴다 — 연말에 뭘 받았는지가 그 해의 요약이다.
  if (!state.awardsWon) state.awardsWon = [];
  state.awardsWon.push({
    year: dateOf(state.day).getFullYear(),
    id: award.id,
    label: award.label,
    grand,
  });
  addSchedule(
    state,
    `${showName} ${award.label}${grand ? " 대상" : ""} 수상 (+${prize.toLocaleString("ko-KR")}원)`,
    "sns",
  );
  return { show, showName, result, missLine: "" };
}
