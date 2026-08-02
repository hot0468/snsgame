import type { GameState } from "@/core/types";
import {
  JOB_RANK_LADDERS,
  PEAK_STEP,
  PROMOTION_BONUS,
  PROMOTION_LINES,
  RANK_THRESHOLDS,
  type JobRankLadder,
} from "@/data/jobRanks";
import { JOB_ID, pastJobCareer } from "./jobExperience";
import { JOB_CATALOG } from "./jobLevels";
import { clampResource } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 직업 경력 등급 — 승급 감지와 보상.
 *
 * 직업 레벨이 무한히 오르기만 하고 아무것도 안 줘서 "여기까지 왔다"는 순간이 없었다.
 * 다섯 계단을 두고 계단마다 화면을 멈춰 세우며, 마지막 계단은 커리어에 영구히 남긴다.
 *
 * ⚠️ **승급 감지는 onNewDay 한 곳에서만 한다.** 직업 8종의 카운터가 제각각 다른 시스템에
 *    흩어져 있어서, 올리는 자리마다 감지를 붙이면 여덟 곳을 똑같이 고쳐야 하고 하나만
 *    빠져도 그 직업만 조용히 승급을 안 한다. 대신 `jobRankSeen` 스냅샷과 비교한다 —
 *    승급 팝업이 다음 날 아침에 뜨는 건 그 대가이고, 코치 우승 팝업과 같은 타이밍이다.
 */

/**
 * 그 직업의 **누적 경력 횟수**(레벨을 정하는 그 수).
 *
 * ⚠️ 재직 중이면 살아 있는 카운터를, 그만뒀으면 보관된 경력을 본다. 둘 중 큰 값이라
 *    잘리거나 이직해도 등급이 내려가지 않는다(jobExperience.stashJobCareer와 짝).
 *
 * ⚠️ **새 직업을 추가하면 여기와 `data/jobRanks.JOB_RANK_LADDERS` 둘 다 손봐라.**
 *    한쪽만 하면 그 직업은 영영 승급하지 않는다.
 */
export function jobCareerCount(state: GameState, id: string): number {
  const live =
    id === JOB_ID.office
      ? (state.employment?.perfLevel ?? 0) * 5 // 회사원만 성과 레벨이라 다른 직업과 스케일을 맞춘다
      : id === JOB_ID.lecturer
        ? (state.lecturerJob?.totalLessons ?? 0)
        : id === JOB_ID.author
          ? (state.authorContract?.monthsWorked ?? 0) * 5 // 월 단위라 같은 이유로 환산
          : id === JOB_ID.av
            ? (state.avJob?.totalWorkDays ?? 0)
            : id === JOB_ID.killer
              ? (state.killerJob?.completed ?? 0) * 5 // 건수가 귀해 같은 이유로 환산
              : id === JOB_ID.coach
                ? (state.coachJob?.totalTrainings ?? 0)
                : id === JOB_ID.taxi
                  ? (state.taxiJob?.totalRides ?? 0)
                  : id === JOB_ID.callCenter
                    ? (state.callCenterJob?.totalCalls ?? 0)
                    : id === JOB_ID.mlm
                      ? (state.mlmJob?.contracts ?? 0) * 5
                      : id === JOB_ID.stylist
                        ? (state.stylistJob?.cuts ?? 0)
                        : 0;
  return Math.max(live, pastJobCareer(state, id));
}

/**
 * 방송 채널 트랙 — 직업이 아니지만 사다리는 같다.
 *
 * ⚠️ `state.streamCount`는 **올라가기만 하고 읽는 곳이 하나도 없었다.** 인방을 백 번 켜도
 *    게임 어디에도 안 남았다 — 직업 레벨과 똑같은 병이라 같은 약을 쓴다.
 */
export const CHANNEL_TRACKS: readonly { id: string; label: string }[] = [
  { id: "stream", label: "너튜브 채널" },
  { id: "savanna", label: "사바나 방송" },
];

/** 승급을 감시하는 전체 트랙(직업 + 채널). 라벨은 팝업·도감이 그대로 쓴다. */
export function rankTracks(): { id: string; label: string }[] {
  return [
    ...JOB_CATALOG.map((e) => ({ id: e.id, label: e.label })),
    ...CHANNEL_TRACKS.map((c) => ({ ...c })),
  ];
}

/** 채널 트랙의 누적 횟수. */
function channelCount(state: GameState, id: string): number {
  if (id === "stream") return state.streamCount ?? 0;
  if (id === "savanna") return state.savannaCount ?? 0;
  return 0;
}

/** 트랙(직업이든 채널이든) 누적 횟수. */
export function trackCount(state: GameState, id: string): number {
  return CHANNEL_TRACKS.some((c) => c.id === id)
    ? channelCount(state, id)
    : jobCareerCount(state, id);
}

/** 누적 → 등급 계단(0~5). 0은 첫 문턱 미달. */
export function rankStepFor(count: number): number {
  const c = Number.isFinite(count) ? count : 0;
  let step = 0;
  for (const t of RANK_THRESHOLDS) if (c >= t) step++;
  return step;
}

/** 그 직업의 사다리(없으면 null). */
export function ladderOf(id: string): JobRankLadder | null {
  return JOB_RANK_LADDERS[id] ?? null;
}

/** 계단 → 등급명(0이면 null). */
export function rankTitle(id: string, step: number): string | null {
  const ladder = ladderOf(id);
  if (!ladder || step <= 0) return null;
  return ladder.titles[Math.min(step, PEAK_STEP) - 1] ?? null;
}

/** 지금 그 직업의 등급 계단. */
export function currentRankStep(state: GameState, id: string): number {
  return rankStepFor(trackCount(state, id));
}

/** 다음 계단까지 남은 횟수(정점이면 null). 도감 진행 게이지의 분모다. */
export function toNextRank(state: GameState, id: string): number | null {
  const count = trackCount(state, id);
  const step = rankStepFor(count);
  if (step >= PEAK_STEP) return null;
  return RANK_THRESHOLDS[step] - count;
}

/**
 * 승급을 감지해 예약한다(`time.onNewDay`).
 *
 * ⚠️ **한 번에 하나만 예약한다.** 여러 직업이 같은 날 승급해도(경력 보관 때문에 가능하다)
 *    팝업을 겹쳐 띄우면 하나가 조용히 사라진다 — 스냅샷은 예약된 것만 갱신하고,
 *    나머지는 다음 날 아침에 차례로 뜬다.
 * @returns 예약했으면 true
 */
export function checkJobPromotions(state: GameState): boolean {
  if (state.gameOver) return false;
  if (state.pendingJobRank) return false;
  if (!state.jobRankSeen) state.jobRankSeen = {};

  for (const entry of rankTracks()) {
    if (!ladderOf(entry.id)) continue;
    const step = currentRankStep(state, entry.id);
    const seen = state.jobRankSeen[entry.id] ?? 0;
    if (step <= seen) continue;
    // 한 번에 여러 계단이 뛰어도 **한 계단씩** 알린다 — 건너뛰면 그 계단의 순간이 사라진다.
    const next = seen + 1;
    state.jobRankSeen[entry.id] = next;
    state.pendingJobRank = { job: entry.id, step: next };
    return true;
  }
  return false;
}

export interface PromotionResult {
  jobLabel: string;
  title: string;
  step: number;
  peak: boolean;
  bonus: number;
  text: string;
}

/**
 * 예약된 승급을 확정한다(ui가 '확인'에서 부른다) — 축하금을 주고 플래그를 비운다.
 *
 * ⚠️ **멱등해야 한다.** 두 번 눌려도 축하금이 두 번 들어가면 안 된다.
 */
export function resolveJobPromotion(state: GameState): PromotionResult | null {
  const pending = state.pendingJobRank;
  if (!pending) return null;
  state.pendingJobRank = null;

  const entry = rankTracks().find((e) => e.id === pending.job);
  const title = rankTitle(pending.job, pending.step);
  const ladder = ladderOf(pending.job);
  if (!entry || !title || !ladder) return null;

  const peak = pending.step >= PEAK_STEP;
  const bonus = PROMOTION_BONUS[pending.step - 1] ?? 0;
  state.money += bonus;

  const text = peak
    ? ladder.peak
    : pick([...PROMOTION_LINES]).replaceAll("{job}", entry.label).replaceAll("{title}", title);

  if (peak) {
    // 정점은 커리어에 영구히 남는다 — 그만둬도, 이직해도 지워지지 않는다.
    if (!state.careerPeaks) state.careerPeaks = [];
    if (!state.careerPeaks.includes(pending.job)) state.careerPeaks.push(pending.job);
    state.resources.reputation = clampResource(state.resources.reputation + 5);
  }
  addSchedule(state, `${entry.label} — ${title}${peak ? " (정점)" : ""}`, "system");
  return { jobLabel: entry.label, title, step: pending.step, peak, bonus, text };
}
