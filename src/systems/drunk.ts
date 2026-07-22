import type { GameState, Tweet } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import { DRUNK_CHANCE, DRUNK_TWEETS, DRUNK_VARIANCE } from "@/data/drunk";
import { changeFollowers } from "./followers";
import { applyTchinReach } from "./tchin";
import { rollControversy } from "./controversy";
import { advanceTime } from "./time";
import { clampResource } from "./stats";
import { isDdeoksang } from "./tweetSystem";
import { maybeQueueNews } from "./news";
import { chance, pick, randInt, uid } from "@/utils/random";

/**
 * 심야 취중 트윗 + 이불킥.
 * - 심야 진입 시 확률로 취한다(maybeGetDrunk → drunkPending). ui가 블러+취중팝업을 띄운다.
 * - [등록]만 있는 블라인드 게시(postDrunkTweet) → 초고분산 결과 + 다음날 진행 + 이불킥 예약.
 * - 다음날 아침 이불킥(resolveRegret): 삭제(수습) 또는 방치(박제).
 */

/** 심야 진입 시 확률로 취한다. 이미 취중/이불킥 대기 중이면 스킵. */
export function maybeGetDrunk(state: GameState): void {
  if (state.gameOver) return;
  if (state.drunkPending || state.pendingRegretTweetId) return;
  if (chance(DRUNK_CHANCE)) state.drunkPending = true;
}

/**
 * 취중 트윗을 블라인드로 게시한다(초고분산 팔로워). 다음날로 진행하고 이불킥 대상으로 예약한다.
 * @returns 게시된 취중 트윗 id
 */
export function postDrunkTweet(state: GameState): string {
  const account = getActiveAccount(state);
  const text = pick(DRUNK_TWEETS);
  // 초고분산: 대박(+) 또는 흑역사(−). 흑역사는 손실폭을 0.7배로 완화.
  const magnitude = randInt(DRUNK_VARIANCE.min, DRUNK_VARIANCE.max);
  const win = chance(0.5);
  // 트친 도달 배율은 대박(양수)에만 붙는다(applyTchinReach가 음수는 그대로 둔다).
  const delta = applyTchinReach(state, win ? magnitude : -Math.round(magnitude * 0.7));

  const tweet: Tweet = {
    id: uid("drunk"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text,
    createdDay: state.day,
    likes: randInt(0, 3000),
    retweets: randInt(0, 800),
    gainedFollowers: delta,
  };
  pushTimeline(account, tweet);
  changeFollowers(state, delta);

  // 취중 트윗도 떡상하면 기사화 대상(떡상 아니면 gain 0 → maybeQueueNews 내부 스킵).
  const drunkDdeoksang = delta > 0 && isDdeoksang(delta, account.followers);
  maybeQueueNews(state, tweet.id, tweet.text, drunkDdeoksang ? delta : 0);

  // 흑역사면 평판 하락 + 논란 확률(이미 저지른 밤).
  if (delta < 0) {
    state.resources.reputation = clampResource(state.resources.reputation - 6);
    rollControversy(state, 0.2);
  }

  state.pendingRegretTweetId = tweet.id;
  state.drunkPending = false;
  state.sleepPending = false; // 취중이 밤을 마감했으므로 취침 팝업은 건너뛴다
  advanceTime(state, 1); // 심야 → 다음날(onNewDay가 dawnPending 세팅)
  return tweet.id;
}

/**
 * 이불킥 처리.
 * - "delete"(수습): 취중 트윗 제거 + 얻은 팔로워만 반납(잃은 팔로워는 회복 안 함). 박제/논란은 회피.
 * - "keep"(박제): 그대로 둔다(대박이면 이득 유지, 흑역사면 이미 걸린 논란 리스크 잔존).
 */
export function resolveRegret(state: GameState, action: "delete" | "keep"): void {
  const id = state.pendingRegretTweetId;
  state.pendingRegretTweetId = null;
  if (!id || action === "keep") return;
  const account = getActiveAccount(state);
  const idx = account.timeline.findIndex((t) => t.id === id);
  if (idx < 0) return;
  const t = account.timeline[idx];
  if (t.gainedFollowers > 0) changeFollowers(state, -t.gainedFollowers);
  account.timeline.splice(idx, 1);
}

/** 이불킥 팝업이 대상 트윗을 찾을 수 있게 — 어젯밤 취중 트윗 조회. */
export function getRegretTweet(state: GameState): Tweet | null {
  const id = state.pendingRegretTweetId;
  if (!id) return null;
  return getActiveAccount(state).timeline.find((t) => t.id === id) ?? null;
}
