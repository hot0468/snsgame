import type { GameState } from "@/core/types";
import { STEAM_GAMES, GAME_REVIEW_TWEETS, type SteamGame } from "@/data/steam";
import { getActiveAccount } from "@/core/state";
import { pick } from "@/utils/random";
import { unlockAttribute } from "./attributeUnlock";
import { gainSkill } from "./stats";
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

/**
 * 게임 구매 시 오르는 '게임' 스킬(게임을 사서 해봤으니 는다).
 * 획득량 ×5 규칙 준수(원래 스케일 +7). 게임당 1회 — 재구매가 없으므로 반복 불가.
 */
export const GAME_BUY_SKILL_GAIN = 35;

/**
 * 리뷰 트윗을 올릴 때 오르는 '게임' 스킬(파고들어 리뷰까지 썼으니 더 는다).
 * 획득량 ×5 규칙 준수(원래 스케일 +8). 게임당 1회.
 *
 * 밸런스: gaming.relatedSkills에 game이 끼며 skillAvg가 (comedy+sociability)/2에서
 * (comedy+sociability+game)/3으로 바뀌어 게임계 트윗이 약해진다. 이를 상쇄하는 주 획득
 * 경로가 여기다(그 외엔 attributeUnlock의 기준선 35와 경매 게임기 리뷰 +250뿐).
 *
 * ⚠️ 상한 계산은 **STEAM_GAMES.length(현재 12종)** 기준이다. 게임당
 *    GAME_BUY_SKILL_GAIN + GAME_REVIEW_SKILL_GAIN = 75이므로 전종 구매·리뷰 시 900.
 *    데이터에 게임을 추가·삭제하면 이 상한이 함께 움직인다 — 상수만 보고 판단하지 말고
 *    STEAM_GAMES.length를 확인하라(예전에 종수를 잘못 세어 밸런스 표가 틀린 적이 있다).
 */
export const GAME_REVIEW_SKILL_GAIN = 40;

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
 * 구매하면 '게임' 스킬이 GAME_BUY_SKILL_GAIN만큼 오른다.
 *
 * ⚠️ 여기가 gaming의 유일한 해금 경로가 **아니다**(조우 25%·오프라인 35%·너튜브·이벤트·
 *    콘셉트 계정 개설도 연다). "게임계 트윗이 가능하면 game > 0"이라는 불변식은 이 함수가
 *    아니라 systems/attributeUnlock.ts의 기준선이 보장한다 — 그 경위는 해당 파일 주석 참조.
 * @returns 실제로 구매했으면 true
 */
export function buyGame(state: GameState, game: SteamGame): boolean {
  if (isGameOwned(state, game.id)) return false;
  const price = effectiveGamePrice(game);
  if (state.money < price) return false;

  // 첫 구매인지는 반드시 ownedGames.push 이전의 length===0으로 판정한다.
  const isFirstGame = state.ownedGames.length === 0;

  state.money -= price;
  state.ownedGames.push(game.id);
  // 게임을 사서 해봤으니 '게임' 스킬이 오른다(게임당 1회 — 재구매 불가라 반복 파밍 없음).
  // ⚠️ 아래 unlockAttribute(해금 기준선)보다 **먼저** 올린다. 순서를 뒤집으면 기준선 35가
  //    먼저 깔린 뒤 구매분 35가 더해져 첫 구매가 70이 된다(과지급).
  // 게임을 파고드는 성장이므로 gainSkill 관문(정신력 배율·감쇠)을 거친다. 그 결과 컨디션이
  // 나쁘면 구매분이 GAME_UNLOCK_FLOOR에 못 미칠 수 있지만, 기준선은 floor(덮어쓰기)라
  // 그때 35까지 채워질 뿐 합산되지 않는다 — 과지급은 여전히 불가능하다.
  gainSkill(state, "game", GAME_BUY_SKILL_GAIN);

  // 첫 구매면 게임 카테고리 해금.
  if (isFirstGame) {
    unlockAttribute(state, getActiveAccount(state), GAMING_ATTRIBUTE);
  }
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
  // 리뷰를 쓸 만큼 파고들었으니 '게임' 스킬이 오른다(게임당 1회).
  // ⚠️ postTweet 이후에 올린다 — 먼저 올리면 이 리뷰 트윗이 제 성과를 스스로 끌어올린다.
  gainSkill(state, "game", GAME_REVIEW_SKILL_GAIN);

  return {
    message: `『${game.title}』 리뷰 트윗을 올렸다! (+${followerDelta} 팔로워)`,
    followerDelta,
  };
}
