import type { GameState, Tweet } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { chance, pick, randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampResource } from "./stats";

/**
 * '행운의 편지' — 리트윗하면 행운/저주가 갈리는 도박 트윗(까칠한외눈 몰드).
 * "무시하면 불행"은 감지 불가라 트윗 문구의 겁주기 플레이버로만 존재한다 —
 * 실제 발동은 리트윗해야만 일어난다(resolveChainLetter).
 *
 * ⚠️ content-author: *_ACCOUNT / *_TWEET_LINES / resolveChainLetter의 결과 문구가 placeholder다.
 *    계정명·핸들은 CHAIN_ACCOUNT 한 곳만 고치면 isChainLetterTweet까지 함께 따라온다.
 */

// 행운의 편지 — 오래된 인터넷 행운편지(체인메일) 패러디 계정
export const CHAIN_ACCOUNT = { name: "행운의 편지", handle: "lucky_letter_2001" };

// 겁주기 협박성 행운편지 톤 — "무시하면 불행" 플레이버(실제 감지는 불가)
export const CHAIN_TWEET_LINES = [
  "이 편지는 1985년 영국에서 처음 시작되었습니다. 리트윗한 사람은 7일 안에 행운이, 지운 사람은… 굳이 말하지 않겠습니다. 선택은 당신의 몫.",
  "절대 무시하지 마세요. 이 편지를 리트윗한 12명은 모두 대박이 났고, 그냥 넘긴 4명은 그 뒤로 연락이 끊겼습니다. 지금 바로 리트윗.",
  "믿거나 말거나. 하지만 굳이 위험을 감수하실 건가요? 리트윗 한 번이면 오늘 밤부터 운이 바뀝니다. 무시하면… 글쎄요.",
];

/** 리트윗이 '행운'으로 갈릴 확률(나머지는 저주). */
export const CHAIN_LUCK_CHANCE = 0.6;

/** 행운의 편지 트윗 하나를 만든다(둘러보기 피드에 낮은 확률로 섞인다). */
export function makeChainLetterTweet(state: GameState): Tweet {
  return {
    id: uid("chaintw"),
    authorName: CHAIN_ACCOUNT.name,
    authorHandle: CHAIN_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(CHAIN_TWEET_LINES),
    createdDay: state.day,
    likes: randInt(0, 30),
    retweets: randInt(5, 40),
    gainedFollowers: 0,
  };
}

/** 이 트윗이 행운의 편지 트윗인지 */
export function isChainLetterTweet(tweet: Tweet): boolean {
  return tweet.authorHandle === CHAIN_ACCOUNT.handle;
}

/**
 * 행운의 편지를 리트윗해 도박을 발동한다.
 * 60% 행운(돈·팔로워·정신력 상승) / 40% 저주(돈·팔로워·정신력 하락).
 * @returns 표시용 결과 문구(placeholder — content-author 교체)
 */
export function resolveChainLetter(state: GameState): string {
  if (chance(CHAIN_LUCK_CHANCE)) {
    const money = randInt(50_000, 200_000);
    const fol = randInt(30, 200);
    const mental = randInt(5, 10);
    state.money += money;
    changeFollowers(state, fol);
    state.resources.mental = clampResource(state.resources.mental + mental);
    // 행운 서사
    return `정말 행운의 편지였다! 통장에 ${money.toLocaleString("ko-KR")}원이 꽂히고, 어디선가 팔로워 ${fol}명이 몰려왔다. 리트윗하길 잘했다.`;
  }
  const money = randInt(30_000, 120_000);
  const loss = Math.round(getActiveAccount(state).followers * 0.1);
  const mental = randInt(8, 15);
  state.money -= money;
  changeFollowers(state, -loss);
  state.resources.mental = clampResource(state.resources.mental - mental);
  // 저주 서사
  return `역시 이런 건 믿는 게 아니었다… 이유 없이 ${money.toLocaleString("ko-KR")}원이 빠져나가고, 팔로워 ${loss}명이 조용히 떠나버렸다. 등골이 서늘하다.`;
}
