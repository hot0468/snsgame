import type { GameState, Tweet } from "@/core/types";
import { pick, randInt, uid } from "@/utils/random";

/**
 * '오하아사(아침 운세)' — 좋아요/리트윗하면 로또 당첨 운(lotteryLuck)이 소폭 오른다.
 * lottery()가 lotteryLuck으로 꽝 경계를 낮추고, 추첨 직후 0으로 리셋한다.
 *
 * ⚠️ content-author: *_ACCOUNT / *_TWEET_LINES가 placeholder(아침 운세·행운의 아이템류).
 */

// 오하아사 — 아침 운세 방송 패러디 계정(로또 은근한 유도)
export const OHAASA_ACCOUNT = { name: "오하아사 운세", handle: "ohaasa_uranai" };

// 아침 운세·행운의 아이템/색/별자리 + 로또 각인 은근 유도
export const OHAASA_TWEET_LINES = [
  "🌅 오하아사~! 오늘의 운세 1위는 바로 당신! 뜻밖의 재물운이 들어오는 날입니다. 행운의 아이템은 '숫자가 적힌 종이'… 로또, 아시죠? 좋아요로 운을 챙기세요.",
  "☀️ 오늘의 별자리 운세: 미뤄둔 도전에 큰 행운이 깃듭니다. 행운의 색은 초록, 행운의 장소는 복권 판매점. 리트윗하면 오늘의 운이 두 배!",
  "오늘의 행운의 숫자는 7, 14, 21, 28, 35, 42! …어디다 쓰면 좋을지는 당신의 선택 😉 아침을 이 트윗과 함께 열어보세요. 좋아요 꾹.",
];

/** lotteryLuck 누적 상한(좋아요/RT 1회당 +1). */
export const LOTTERY_LUCK_CAP = 5;

/** 오하아사 트윗 하나를 만든다(자주 뜨는 편). */
export function makeOhaasaTweet(state: GameState): Tweet {
  return {
    id: uid("ohaasatw"),
    authorName: OHAASA_ACCOUNT.name,
    authorHandle: OHAASA_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(OHAASA_TWEET_LINES),
    createdDay: state.day,
    likes: randInt(10, 300),
    retweets: randInt(2, 60),
    gainedFollowers: 0,
  };
}

/** 이 트윗이 오하아사 트윗인지 */
export function isOhaasaTweet(tweet: Tweet): boolean {
  return tweet.authorHandle === OHAASA_ACCOUNT.handle;
}

/**
 * 로또 운을 +1 올린다(cap까지). 이미 cap이면 false(더 안 오름).
 * @returns 실제로 올랐으면 true
 */
export function bumpLotteryLuck(state: GameState): boolean {
  if (state.lotteryLuck >= LOTTERY_LUCK_CAP) return false;
  state.lotteryLuck += 1;
  return true;
}
