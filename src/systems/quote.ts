import type { GameState, Tweet } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import { getAffinity } from "@/data/attributes";
import {
  QRT_HIT_RATE,
  QRT_RATIO_RATE,
  QRT_CONTROVERSY_BASE,
  QRT_TONES,
  type QrtTone,
} from "@/data/quote";
import { changeFollowers } from "./followers";
import { consumePostSlot } from "./eggs";
import { clampAction, clampResource } from "./stats";
import { rollControversy } from "./controversy";
import { ddeoksangBonus, isDdeoksang, TWEET_ACTION_COST } from "./tweetSystem";
import { applyTchinReach, bumpTchinProgress } from "./tchin";
import { addSchedule } from "./time";
import { maybeQueueNews } from "./news";
import { uid } from "@/utils/random";

/**
 * 인용 트윗(QRT) — 하이리스크.
 * 둘러보기의 남 트윗을 인용해 내 코멘트를 얹는다. 대상의 인기(likes+retweets)가 판돈이고,
 * '내 계정 성향 × 대상 계열 궁합'이 성공/역풍을 가른다. 톤(agree/hype/snark)은 배율·리스크만 조절.
 *
 * - 성공(궁합 ≥ 0): 인기에 비례해 팔로워 급증(대박 → 떡상 가능).
 * - 역풍(궁합 < 0): 알티 역풍 — 팔로워 감소 + 평판·정신력 하락 + 논란 발생 확률.
 * 행동력·게시 슬롯은 일반 트윗과 동일하게 소모한다.
 */

export interface QuoteResult {
  followerDelta: number;
  ratioed: boolean;
  ddeoksang: boolean;
  ddeoksangGain: number;
}

export function postQuoteTweet(
  state: GameState,
  target: Tweet,
  tone: QrtTone,
  text: string,
): QuoteResult {
  const account = getActiveAccount(state);
  const toneDef = QRT_TONES.find((t) => t.id === tone) ?? QRT_TONES[0];
  const popularity = target.likes + target.retweets;
  const aff = getAffinity(account.attribute, target.attribute);

  // 비용(일반 트윗과 동일)
  state.resources.action = clampAction(state, state.resources.action - TWEET_ACTION_COST);
  consumePostSlot(state);
  // 인용도 대상 계정과의 상호작용 — 트친 누적에 센다.
  bumpTchinProgress(state, target.authorHandle, target.authorName);

  let followerDelta = 0;
  let ratioed = false;
  if (aff >= 0) {
    // 성공 — 대상 인기에 올라탄다. 궁합 양수면 보정 가산.
    followerDelta = Math.round(
      popularity * QRT_HIT_RATE * (1 + Math.max(0, aff) * 0.15) * toneDef.rewardMult,
    );
  } else {
    // 역풍 — 결이 안 맞는 인용은 알티로 두들겨 맞는다.
    ratioed = true;
    followerDelta = -Math.round(popularity * QRT_RATIO_RATE * toneDef.riskMult);
    state.resources.reputation = clampResource(state.resources.reputation - 8);
    state.resources.mental = clampResource(state.resources.mental - 6);
    rollControversy(state, QRT_CONTROVERSY_BASE * toneDef.riskMult);
  }

  // 트친 도달 배율 — 성공(양수) 증가분에만 붙는다(역풍 감소분은 그대로).
  followerDelta = applyTchinReach(state, followerDelta);
  changeFollowers(state, followerDelta);

  const mag = Math.abs(followerDelta);
  const tweet: Tweet = {
    id: uid("qrt"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: target.attribute,
    isAdult: false,
    text,
    createdDay: state.day,
    likes: Math.max(0, Math.round(mag * 0.7)),
    retweets: Math.max(0, Math.round(mag * 0.25)),
    gainedFollowers: followerDelta,
    quoted: {
      authorName: target.authorName,
      authorHandle: target.authorHandle,
      text: target.text,
      attribute: target.attribute,
    },
  };
  pushTimeline(account, tweet);
  account.lastTweetDay = state.day;

  // 떡상 판정(모듈 A 재사용)
  const ddeoksang = followerDelta > 0 && isDdeoksang(followerDelta, account.followers);
  let ddeoksangGain = 0;
  if (ddeoksang) {
    ddeoksangGain = ddeoksangBonus(followerDelta);
    changeFollowers(state, ddeoksangGain);
  }
  // 떡상한 인용 트윗이면 확률적으로 기사화 예약(떡상 아니면 gain 0 → 내부 스킵).
  maybeQueueNews(state, tweet.id, tweet.text, ddeoksang ? followerDelta : 0);

  addSchedule(
    state,
    ratioed
      ? `인용 트윗 역풍 (${followerDelta} 팔로워)`
      : `인용 트윗 (+${followerDelta} 팔로워)`,
    "sns",
  );
  return { followerDelta, ratioed, ddeoksang, ddeoksangGain };
}
