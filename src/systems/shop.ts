import type { GameState, SkillStatId, Tweet } from "@/core/types";
import type { ShopItem } from "@/data/shop";
import { SHOP_ITEMS, PC_UPGRADE_ID } from "@/data/shop";
import { COSMETICS } from "@/data/cosmetics";
import { GOBLIN_ITEMS } from "@/data/goblin";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { REL_GIFTS } from "@/data/relationships";
import { GOODS_ITEMS } from "@/data/goods";
import { GACHA_ALL_ITEMS } from "@/data/gacha";
import { getActiveAccount, pushTimeline } from "@/core/state";
import { randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { salePrice } from "./seasonal";
import { clampAction, clampResource, clampSkill } from "./stats";
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

/** 세일 반영 실구매가. 컴퓨터 업그레이드는 보유 개수에 비례해 기본가가 오른다(300k→600k→900k…). */
export function effectivePrice(state: GameState, item: ShopItem): number {
  const base =
    item.id === PC_UPGRADE_ID ? item.price * (ownedCount(state, item.id) + 1) : item.price;
  return salePrice(state.day, base);
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

/* ─────────────────── 보유 아이템 리졸버 · 판매 ─────────────────── */

/**
 * ownedItems의 id 하나를 해석한 정규형. 출처가 상점/화장품/피망(ShopItem: skill+boost 단수)이든
 * 도깨비(GoblinItem: boosts 복수)든 여기서 boosts 하나로 통일된다.
 * 서랍장 표시와 판매(스탯 회수)가 모두 이 하나를 쓴다 — 출처별 분기를 다시 만들지 마라.
 */
export interface OwnedItemInfo {
  id: string;
  name: string;
  desc?: string;
  /** 정가(세일가 아님) */
  price: number;
  boosts: Partial<Record<SkillStatId, number>>;
  repeatable: boolean;
}

function normalize(item: ShopItem): OwnedItemInfo {
  return {
    id: item.id,
    name: item.name,
    desc: item.desc,
    price: item.price,
    boosts: item.skill && item.boost ? { [item.skill]: item.boost } : {},
    repeatable: item.repeatable ?? false,
  };
}

/** id → 정규형. 4종 출처(상점·화장품·피망·도깨비)를 전부 덮는다. */
const ITEM_INDEX = new Map<string, OwnedItemInfo>([
  ...[...SHOP_ITEMS, ...COSMETICS, ...PEEMANG_ITEMS, ...GOODS_ITEMS].map(
    (i) => [i.id, normalize(i)] as const,
  ),
  ...GOBLIN_ITEMS.map(
    (g) =>
      [
        g.id,
        { id: g.id, name: g.name, desc: g.desc, price: g.price, boosts: g.boosts, repeatable: false },
      ] as const,
  ),
  // 관계 완주 선물 — 스탯 부스트 없음. 판매 시 rep/도덕 페널티는 sellOwnedItem이 붙인다.
  ...REL_GIFTS.map(
    (g) =>
      [g.id, { id: g.id, name: g.name, desc: g.desc, price: g.price, boosts: {}, repeatable: false }] as const,
  ),
  // 가챠 포토카드/굿즈 — 스탯 부스트 없는 실물. 뽑기로 중복 획득 가능(repeatable).
  ...GACHA_ALL_ITEMS.map(
    (g) =>
      [g.id, { id: g.id, name: g.name, desc: g.desc, price: g.price, boosts: {}, repeatable: true }] as const,
  ),
]);

/** 관계 선물 id 집합 — 판매 시 추가 페널티(평판/도덕) 판정용 */
const REL_GIFT_IDS = new Set(REL_GIFTS.map((g) => g.id));

/** 이 아이템이 관계 완주 선물인지(ui가 판매 경고 문구를 띄울 때 사용) */
export function isRelGift(id: string): boolean {
  return REL_GIFT_IDS.has(id);
}

/** 보유 id를 아이템으로 해석한다. 어느 출처에도 없는 id(구세이브 유실)면 null. */
export function resolveItem(id: string): OwnedItemInfo | null {
  return ITEM_INDEX.get(id) ?? null;
}

/** 서랍장 목록 — 보유 아이템을 개수로 묶어 해석한다. 해석 불가한 id는 조용히 버린다. */
export function ownedInventory(state: GameState): { item: OwnedItemInfo; count: number }[] {
  const out: { item: OwnedItemInfo; count: number }[] = [];
  for (const id of new Set(state.ownedItems)) {
    const item = resolveItem(id);
    if (item) out.push({ item, count: ownedCount(state, id) });
  }
  return out;
}

/** 중고 판매가 배율 — 무조건 정가의 50%(세일가 기준이 아니다) */
export const SELL_RATE = 0.5;

/** 팔면 받는 돈 */
export function sellPrice(item: OwnedItemInfo): number {
  return Math.round(item.price * SELL_RATE);
}

/**
 * 보유 아이템 1개를 판다. 인스턴스 하나만 빠지고(repeatable 중복은 나머지가 남는다),
 * 정가의 50%를 받고, 구매 때 올랐던 스탯을 회수한다(되팔이로 스탯을 반값에 챙기는 것 차단).
 * 시간·행동력을 쓰지 않는다(상점 구매도 안 쓴다).
 *
 * ponytail: 회수는 구매 시 boost를 그대로 뺀다 — 실제 상승분 원장이 없다. 999에서 잘린 만큼은
 * 되돌아오지 않아 되팔이가 스탯 순손실일 수 있다(판매 페널티로 수용). 정확히 되돌리려면
 * 아이템별 실상승분을 state에 기록해야 하는데, 세이브 마이그레이션 비용이 이득보다 크다.
 *
 * @returns 받은 금액. 보유하지 않았거나 해석 불가한 id면 null(아무것도 바뀌지 않는다).
 */
export function sellOwnedItem(state: GameState, id: string): number | null {
  const idx = state.ownedItems.indexOf(id);
  if (idx < 0) return null;
  const item = resolveItem(id);
  if (!item) return null;

  state.ownedItems.splice(idx, 1);
  const payout = sellPrice(item);
  state.money += payout;
  for (const [skill, boost] of Object.entries(item.boosts) as [SkillStatId, number][]) {
    state.skills[skill] = clampSkill(state.skills[skill] - boost);
  }
  // 관계 선물을 팔면 정을 판 대가로 평판·도덕이 크게 깎인다(소지금은 위에서 이미 지급).
  if (REL_GIFT_IDS.has(id)) {
    state.resources.reputation = clampResource(state.resources.reputation - GIFT_SELL_REP_PENALTY);
    state.resources.morality = clampResource(state.resources.morality - GIFT_SELL_MORALITY_PENALTY);
  }
  return payout;
}

/** 관계 선물 판매 시 평판 페널티 */
export const GIFT_SELL_REP_PENALTY = 30;
/** 관계 선물 판매 시 도덕 페널티 */
export const GIFT_SELL_MORALITY_PENALTY = 30;

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
  state.resources.action = clampAction(state, state.resources.action - AD_ACTION_COST);

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
  pushTimeline(account, tweet);
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
