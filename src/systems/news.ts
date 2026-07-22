import type { GameState, Tweet } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import {
  NEWS_CHANCE,
  NEWS_DISTORT_RATE,
  NEWS_BOOST_RATE,
  NEWS_CLARIFY_RATE,
  NEWS_IGNORE_LOSS_RATE,
  NEWS_BACKFIRE_CHANCE,
  NEWS_OUTLETS,
  NEWS_HEADLINES_NORMAL,
  NEWS_HEADLINES_DISTORTED,
} from "@/data/news";
import { changeFollowers } from "./followers";
import { rollControversy } from "./controversy";
import { clampResource } from "./stats";
import { chance, pick, uid } from "@/utils/random";

/**
 * 내 트윗이 기사화 — 예약(maybeQueueNews)·헤드라인 조립(newsHeadlineFor)·해소(resolveNews).
 * 순수 로직. DOM을 모른다. 표시는 ui(newsModal)가 값을 받아 그린다.
 */

/** 떡상 트윗을 확률로 기사화 예약(다음날 아침 팝업). 이미 예약돼 있으면 스킵. */
export function maybeQueueNews(
  state: GameState,
  tweetId: string,
  tweetText: string,
  gain: number,
): void {
  if (state.pendingNews) return;
  if (gain <= 0) return;
  if (!chance(NEWS_CHANCE)) return;
  state.pendingNews = { tweetId, tweetText, gain, distorted: chance(NEWS_DISTORT_RATE) };
}

/** 예약된 기사 헤드라인(표시용). ui가 부른다. */
export function newsHeadlineFor(news: NonNullable<GameState["pendingNews"]>): string {
  const outlet = pick(NEWS_OUTLETS);
  const pool = news.distorted ? NEWS_HEADLINES_DISTORTED : NEWS_HEADLINES_NORMAL;
  const snippet = news.tweetText.slice(0, 14);
  return `[${outlet}] ${pick(pool).replace("{snippet}", snippet)}`;
}

/** 기사화 팝업 선택 해소. 팔로워 델타 반환. pendingNews를 반드시 클리어. */
export function resolveNews(
  state: GameState,
  action: "ack" | "clarify" | "ignore",
): number {
  const news = state.pendingNews;
  state.pendingNews = null;
  if (!news) return 0;
  const account = getActiveAccount(state);

  if (action === "ack") {
    const gainF = Math.round(news.gain * NEWS_BOOST_RATE);
    changeFollowers(state, gainF);
    state.resources.reputation = clampResource(state.resources.reputation + 3);
    return gainF;
  }
  if (action === "ignore") {
    const loss = -Math.round(news.gain * NEWS_IGNORE_LOSS_RATE);
    changeFollowers(state, loss);
    rollControversy(state, 0.2);
    return loss;
  }
  // clarify — 무료 해명 트윗
  const clar: Tweet = {
    id: uid("news"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text: "기사 보고 왔습니다. 그 트윗, 문맥이 좀 잘렸네요. 오해 없으시길 🙏",
    createdDay: state.day,
    likes: 0,
    retweets: 0,
    gainedFollowers: 0,
  };
  pushTimeline(account, clar);
  if (chance(NEWS_BACKFIRE_CHANCE)) {
    const loss = -Math.round(news.gain * NEWS_IGNORE_LOSS_RATE);
    changeFollowers(state, loss);
    rollControversy(state, 0.15);
    return loss;
  }
  const gainF = Math.round(news.gain * NEWS_CLARIFY_RATE);
  changeFollowers(state, gainF);
  state.resources.reputation = clampResource(state.resources.reputation + 2);
  clar.gainedFollowers = gainF;
  return gainF;
}
