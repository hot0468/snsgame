import type { GameState } from "@/core/types";
import { STEAM_GAMES, GAME_REVIEW_TWEETS, type SteamGame } from "@/data/steam";
import { getActiveAccount } from "@/core/state";
import { pick } from "@/utils/random";
import { postTweet } from "./tweetSystem";

export { STEAM_GAMES };

/**
 * '증기'(스팀 패러디 게임 스토어) 시스템.
 * - 게임을 사면 소지금이 줄고 ownedGames에 등록된다(게임당 1회 구매).
 * - 첫 구매 시 트윗 작성 카테고리에 '게임'(gaming 속성)이 해금된다.
 * - 보유 게임마다 '리뷰 트윗'을 1회 올릴 수 있다(일반 트윗 — 행동력·시간 소모, 팔로워 획득).
 *
 * 순수 로직: DOM/표시 없음. 결과 문구·팔로워 delta를 값으로 반환하고 표시는 ui가 맡는다.
 */

/** 첫 구매 시 해금되는 트윗 카테고리(게임계) */
export const GAMING_ATTRIBUTE = "gaming" as const;

/**
 * 게임 리뷰 트윗의 팔로워 배율(일반 트윗 성과에 곱해짐).
 * 리뷰는 팔로워를 얻는 정상 콘텐츠이므로 완화 없이 1배(= 일반 게임 트윗과 동일).
 */
export const GAME_REVIEW_FOLLOWER_MULT = 1;

/** 할인 적용 실구매가. discount(%)가 있으면 반올림 적용가, 없으면 정가. */
export function effectiveGamePrice(game: SteamGame): number {
  if (game.discount && game.discount > 0) {
    return Math.round(game.price * (1 - game.discount / 100));
  }
  return game.price;
}

/** 이미 보유한 게임인지 */
export function isGameOwned(state: GameState, id: string): boolean {
  return state.ownedGames.includes(id);
}

/** 구매 가능한지(미보유 + 잔고 충분) */
export function canBuyGame(state: GameState, game: SteamGame): boolean {
  return !isGameOwned(state, game.id) && state.money >= effectiveGamePrice(game);
}

/**
 * 게임을 구매한다. 이미 보유했거나 소지금이 할인적용가보다 적으면 false.
 * 첫 구매(구매 전 ownedGames가 비어 있음)면 활성 계정의 unlockedAttributes에 'gaming'을 추가한다
 * (게임 카테고리 트윗 해금). 판정은 반드시 ownedGames.push 이전의 length===0 기준.
 * @returns 실제로 구매했으면 true
 */
export function buyGame(state: GameState, game: SteamGame): boolean {
  if (isGameOwned(state, game.id)) return false;
  const price = effectiveGamePrice(game);
  if (state.money < price) return false;

  // 첫 구매면 게임 카테고리 해금(push 이전 length===0 기준으로 판정).
  if (state.ownedGames.length === 0) {
    const account = getActiveAccount(state);
    if (!account.unlockedAttributes.includes(GAMING_ATTRIBUTE)) {
      account.unlockedAttributes.push(GAMING_ATTRIBUTE);
    }
  }

  state.money -= price;
  state.ownedGames.push(game.id);
  return true;
}

export interface GameReviewResult {
  message: string;
  /** 이번 리뷰 트윗으로 얻은 신규 팔로워 */
  followerDelta: number;
}

/** 리뷰 텍스트를 만든다. {title} placeholder가 있으면 치환, 없으면 게임 제목을 접합한다. */
function buildReviewText(game: SteamGame): string {
  const raw =
    GAME_REVIEW_TWEETS.length > 0
      ? pick(GAME_REVIEW_TWEETS)
      : `{title} 클리어했다. 이거 진짜 갓겜이네요 다들 하세요`;
  if (raw.includes("{title}")) {
    return raw.replace(/\{title\}/g, game.title);
  }
  // placeholder가 없는 범용 문구면 제목을 앞에 붙여 어떤 게임인지 드러낸다.
  return `『${game.title}』 ${raw}`;
}

/**
 * 보유 게임의 '리뷰 트윗'을 올린다(게임당 1회).
 * - 미보유이거나 이미 리뷰한 게임이면 null(리뷰 대상 아님).
 * - 야밤 성인용품 리뷰(무료 해금)와 달리, 게임 리뷰는 **일반 트윗**이다:
 *   postTweet를 free 없이 호출하므로 행동력(TWEET_ACTION_COST)·시간(슬롯 1칸)을 소모하고
 *   팔로워를 얻는다(gaming 카테고리, followerMultiplier = GAME_REVIEW_FOLLOWER_MULT).
 * - 게시 후 reviewedGames에 등록해 재리뷰를 막는다.
 * 주의: postTweet 경유이므로 타임라인 등록·리액션·논란 판정 등 부수효과가 함께 발생한다.
 */
export function reviewGame(state: GameState, game: SteamGame): GameReviewResult | null {
  if (!state.ownedGames.includes(game.id)) return null;
  if (state.reviewedGames.includes(game.id)) return null;

  const text = buildReviewText(game);
  const { followerDelta } = postTweet(
    state,
    GAMING_ATTRIBUTE,
    text,
    false,
    undefined,
    GAME_REVIEW_FOLLOWER_MULT,
  );

  state.reviewedGames.push(game.id);

  return {
    message: `『${game.title}』 리뷰 트윗을 올렸다! (+${followerDelta} 팔로워)`,
    followerDelta,
  };
}
