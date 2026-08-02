import type { Email, GameState } from "@/core/types";
import {
  CONTESTS,
  CONTEST_WIN_LINES,
  CONTEST_LOSE_LINES,
  CONTEST_TWEET_WIN,
  CONTEST_TWEET_LOSE,
  type Contest,
} from "@/data/contests";
import { MAX_SKILL } from "@/data/stats";
import { chance, hashInt, pick, uid } from "@/utils/random";
import { postTweet, type PostTweetResult } from "./tweetSystem";
import { clampResource } from "./stats";
import { addSchedule } from "./time";
import { pushEmail } from "@/core/state";

/**
 * 네이놈 대회(신청 → 1주 뒤 결과 메일).
 * - 배너는 2주(fortnight)마다 결정론적으로 대회 1종을 뽑는다(currentContest — Math.random 금지, 재렌더 불변).
 * - 신청(applyContest)은 동시 1건(pendingContest). 참가비를 내고 appliedDay를 박는다.
 * - 결과(resolveContest)는 onNewDay가 appliedDay+7에 1회 판정 → 연관 스킬 확률로 입상/탈락 메일.
 *
 * data→systems 단방향(contest → data/contests). time↔contest 상호 import는 호출 시점 참조라 안전
 * (employment↔time·esthetic↔time 선례).
 */

/** 배너 회전 주기(2주) */
export const CONTEST_ROTATION_DAYS = 14;
/** 신청 후 결과가 오기까지(1주) */
export const CONTEST_RESULT_DELAY = 7;
/** 입상 시 평판 상승분 */
const CONTEST_WIN_REP = 4;

/**
 * 오늘 배너에 뜨는 대회 — 2주 단위 fortnight를 해시해 결정론적으로 1종 선택한다.
 * 같은 fortnight 동안은 항상 같은 대회(재렌더에 안 바뀜), 2주가 지나면 교체된다.
 */
export function currentContest(day: number): Contest {
  const fortnight = Math.floor((day - 1) / CONTEST_ROTATION_DAYS);
  let idx = hashInt("contest:" + fortnight) % CONTESTS.length;
  // 직전 2주와 같은 대회면 한 칸 밀어 '2주마다 교체'가 눈에 보이게 한다(결정론 유지).
  if (fortnight > 0 && idx === hashInt("contest:" + (fortnight - 1)) % CONTESTS.length) {
    idx = (idx + 1) % CONTESTS.length;
  }
  return CONTESTS[idx];
}

/**
 * 같은 대회 재신청 쿨다운(일).
 *
 * ⚠️ 배너 회전(2주)보다 **길어야 한다.** 결과가 1주면 나오므로, 쿨다운이 없으면 같은
 *    배너 주기 안에 같은 대회를 두 번 신청할 수 있었다. 한 달을 두면 배너가 최소 한 번은
 *    다른 대회로 바뀐 뒤에야 돌아온다.
 */
export const CONTEST_COOLDOWN_DAYS = 30;

/** 그 대회를 다시 신청하기까지 남은 일수(0이면 지금 신청 가능). */
export function contestCooldownLeft(state: GameState, contestId: string): number {
  const last = state.contestAppliedDays?.[contestId];
  if (last == null || !Number.isFinite(last)) return 0;
  return Math.max(0, last + CONTEST_COOLDOWN_DAYS - state.day);
}

/** 지금 배너 대회를 신청할 수 있는지(결과 대기 중이 아니고, 쿨다운도 끝났어야 한다). */
export function canApplyContest(state: GameState): boolean {
  if (state.pendingContest !== null) return false;
  return contestCooldownLeft(state, currentContest(state.day).id) === 0;
}

/**
 * 현재 배너 대회에 신청한다.
 * @returns "ok"(신청됨) | "busy"(이미 결과 대기 중) | "cooldown"(같은 대회 재신청 대기) | "poor"(참가비 부족 — 차감 없음)
 */
export function applyContest(state: GameState): "ok" | "busy" | "cooldown" | "poor" {
  if (state.pendingContest !== null) return "busy";
  const contest = currentContest(state.day);
  if (contestCooldownLeft(state, contest.id) > 0) return "cooldown";
  if (contest.fee > state.money) return "poor";
  state.money -= contest.fee;
  state.pendingContest = { id: contest.id, appliedDay: state.day };
  // ⚠️ 신청 시점을 박는다(결과 시점이 아니라). 결과를 안 기다리고 취소해도 쿨다운은 돈다.
  if (!state.contestAppliedDays) state.contestAppliedDays = {};
  state.contestAppliedDays[contest.id] = state.day;
  addSchedule(state, `${contest.name} 신청`, "system");
  return "ok";
}

/** 대회 입상 확률 — 연관 스킬에 비례(스킬 0 → 0.08, 만렙 → 0.93). */
export function contestWinChance(state: GameState, contest: Contest): number {
  const skill = state.skills[contest.skill];
  const p = 0.08 + (skill / MAX_SKILL) * 0.85;
  return Math.max(0, Math.min(1, p));
}

/**
 * 결과 발표를 점검한다(time.onNewDay에서 호출).
 * 신청 후 CONTEST_RESULT_DELAY(7일) 경과 시 1회 판정 → 입상/탈락 메일 + (입상 시)상금·평판.
 * pendingContest를 판정 전 먼저 비워 중복 발동을 차단한다.
 */
export function resolveContest(state: GameState): void {
  const pending = state.pendingContest;
  if (!pending) return;
  if (state.day < pending.appliedDay + CONTEST_RESULT_DELAY) return;
  const contest = CONTESTS.find((c) => c.id === pending.id);
  state.pendingContest = null; // 판정 전 먼저 비워 중복 발동 차단
  if (!contest) return;

  const won = chance(contestWinChance(state, contest));
  if (won) {
    state.money += contest.prize;
    state.resources.reputation = clampResource(state.resources.reputation + CONTEST_WIN_REP);
  }
  pushEmail(state, {
    id: uid("mail"),
    from: contest.name,
    subject: `[${won ? "입상" : "결과"}] ${contest.name} 결과 안내`,
    body: pick(won ? CONTEST_WIN_LINES : CONTEST_LOSE_LINES),
    day: state.day,
    read: false,
    contestResult: { name: contest.name, won },
  });
  addSchedule(
    state,
    won
      ? `${contest.name} 입상! (+${contest.prize.toLocaleString("ko-KR")}원)`
      : `${contest.name} 아쉽게 탈락`,
    "system",
  );
}

/**
 * 대회 결과 메일을 트윗한다(메일당 1회 — contestResult.tweeted).
 * @returns 게시 결과(PostTweetResult). 이미 트윗했거나 대회 결과 메일이 아니면 null.
 */
export function tweetContestResult(state: GameState, email: Email): PostTweetResult | null {
  const cr = email.contestResult;
  if (!cr || cr.tweeted) return null;
  const text = pick(cr.won ? CONTEST_TWEET_WIN : CONTEST_TWEET_LOSE);
  const result = postTweet(state, "daily", text, false);
  cr.tweeted = true;
  return result;
}
