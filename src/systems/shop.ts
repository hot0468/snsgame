import type { GameState, Tweet } from "@/core/types";
import type { ShopItem } from "@/data/shop";
import { getActiveAccount } from "@/core/state";
import { randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { salePrice } from "./seasonal";
import { clampResource, clampSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 쇼핑 시스템 — 아이템을 사면 소지금이 줄고 세부 스탯이 영구히 오른다(1회 구매).
 * 아이템 '광고하기'로 협찬 트윗을 올려 즉석 수익을 벌 수도 있다(과하면 역풍).
 */

/** 이미 구매한 아이템인지 */
export function isOwned(state: GameState, id: string): boolean {
  return state.ownedItems.includes(id);
}

/** 보유 개수 — 반복 구매(repeatable) 아이템은 살 때마다 중복으로 쌓인다 */
export function ownedCount(state: GameState, id: string): number {
  return state.ownedItems.filter((owned) => owned === id).length;
}

/** 창작 도구(펜&종이/판타블렛/액정타블렛) 아이템 id */
export const DRAWING_TOOL_IDS = ["pen_paper", "pen_tablet", "display_tablet"];

/** 창작 도구를 하나라도 보유했는지 — 애니/만화 트윗에 '창작'이 열린다 */
export function hasDrawingTool(state: GameState): boolean {
  return DRAWING_TOOL_IDS.some((id) => state.ownedItems.includes(id));
}

/** 세일 반영 실구매가 */
export function effectivePrice(state: GameState, item: ShopItem): number {
  return salePrice(state.day, item.price);
}

/** 구매 가능한지(미보유 or 반복 구매 가능 + 잔고 충분) */
export function canBuy(state: GameState, item: ShopItem): boolean {
  const buyable = item.repeatable || !isOwned(state, item.id);
  return buyable && state.money >= effectivePrice(state, item);
}

/**
 * 아이템을 구매한다. 성공하면 소지금 차감(세일가) + 스탯 상승(skill이 있을 때만) + 보유 목록에 추가.
 * 반복 구매 아이템은 보유 목록에 중복으로 쌓여 보유 개수가 곧 효과의 크기가 된다.
 * @returns 실제로 구매했으면 true
 */
export function buyItem(state: GameState, item: ShopItem): boolean {
  if (!canBuy(state, item)) return false;
  state.money -= effectivePrice(state, item);
  if (item.skill && item.boost) {
    state.skills[item.skill] = clampSkill(state.skills[item.skill] + item.boost);
  }
  state.ownedItems.push(item.id);
  return true;
}

/* ─────────────────── 상품 광고(협찬 트윗) ─────────────────── */

/** 광고 트윗 1건에 드는 행동력 */
export const AD_ACTION_COST = 8;
/** 최근 7일 광고가 이 개수 이상이면 역풍 */
export const AD_BACKLASH_THRESHOLD = 3;

export interface AdResult {
  revenue: number;
  /** 광고 도배 역풍이 터졌는지 */
  backlash: boolean;
  followerLoss: number;
}

/**
 * 상품 광고 트윗을 내 타임라인에 올린다.
 * - 즉석 협찬 수익이 팔로워 수에 비례해 들어온다.
 * - 최근 7일간 광고가 3개 이상이면 팔로워가 부정적으로 반응해 대폭 감소한다.
 */
export function advertiseItem(state: GameState, item: ShopItem): AdResult {
  const account = getActiveAccount(state);
  state.resources.action = Math.max(0, state.resources.action - AD_ACTION_COST);

  const tweet: Tweet = {
    id: uid("tweet"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: "daily",
    isAdult: false,
    text: `【광고】 요즘 ${item.name} 쓰고 있는데 진짜 만족해요! 여러분도 강력 추천합니다 💕 #협찬 #광고`,
    createdDay: state.day,
    likes: randInt(0, 300),
    retweets: randInt(0, 60),
    gainedFollowers: 0,
    isAd: true,
  };
  account.timeline.unshift(tweet);
  account.lastTweetDay = state.day;

  // 즉석 협찬 수익 ∝ 팔로워
  const revenue = 20_000 + Math.round(account.followers * 2.5);
  state.money += revenue;

  // 최근 7일 광고 개수 집계
  state.eggs.adDays.push(state.day);
  const recent = state.eggs.adDays.filter((d) => d > state.day - 7).length;

  let backlash = false;
  let followerLoss = 0;
  if (recent >= AD_BACKLASH_THRESHOLD) {
    backlash = true;
    followerLoss = Math.max(50, Math.round(account.followers * 0.2));
    changeFollowers(state, -followerLoss);
    state.resources.reputation = clampResource(state.resources.reputation - 10);
    tweet.replies = [
      {
        id: uid("r"),
        authorName: "지친 팔로워",
        authorHandle: "tired_fan",
        attribute: "daily",
        text: "또 광고야? 요즘 광고만 올리네... 완전 실망이다 언팔합니다",
        likes: randInt(20, 300),
      },
    ];
    addSchedule(state, `광고 도배 역풍 (-${followerLoss})`, "system");
  } else {
    addSchedule(state, `${item.name} 광고 (+${revenue.toLocaleString("ko-KR")}원)`, "sns");
  }

  advanceTime(state, 1);
  return { revenue, backlash, followerLoss };
}
