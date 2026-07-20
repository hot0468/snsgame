import type { GameState, ScheduleEvent, Tweet } from "@/core/types";
import { GOODS_ITEMS, GOODS_GROUP_BUY_LINES, GOODS_GROUP_BUY_AUTHORS } from "@/data/goods";
import { pick, randInt, uid } from "@/utils/random";
import { gainSkill } from "./stats";
import { resolveItem } from "./shop";

/**
 * 굿즈 공동구매 — 피드에 뜬 오타쿠 공구 트윗의 '참여하기'를 누르면
 * 덕질(otaku)↑ + 돈 지출, 7일 뒤 상품이 배송돼 인벤토리(ownedItems)에 들어간다.
 *
 * ⚠️ 배송 아이템 id는 GOODS_ITEMS이고, 이 풀은 shop.ts의 ITEM_INDEX에 등록돼 있어야
 *    resolveItem이 해석한다(등록 누락 시 인벤토리에서 조용히 사라짐). shop.ts 참조.
 * ⚠️ time.ts가 이 파일의 deliverPendingGoods를 onNewDay에서 부른다 — 여기서 time을
 *    import하면 순환. addSchedule은 eggs.ts처럼 인라인으로 둔다.
 */

/** 공구 참여 후 상품이 배송되기까지 걸리는 일수 */
export const GOODS_DELIVERY_DAYS = 7;
/** 공구 참여로 오르는 덕질(otaku) 수치 */
export const GROUP_BUY_OTAKU_GAIN = 8;

/** 스케줄 로그 기록(time.ts와의 순환 참조를 피해 인라인). */
function addSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  state.schedule.push({ id: uid("sch"), day: state.day, title, kind });
}

/** 이 트윗의 공구에 지금 참여할 수 있는지(공구 트윗 · 미참여 · 잔고 충분) */
export function canJoinGroupBuy(state: GameState, tweet: Tweet): boolean {
  const gb = tweet.groupBuy;
  return !!gb && !gb.joined && state.money >= gb.price;
}

/**
 * 굿즈 공구에 참여한다. 성공 시: 소지금 차감 + 덕질↑ + 배송 대기 등록 + 트윗을 참여 완료로 표시.
 * 잔고가 부족하면 아무것도 바꾸지 않고 false.
 */
export function joinGroupBuy(state: GameState, tweet: Tweet): boolean {
  if (!canJoinGroupBuy(state, tweet)) return false;
  const gb = tweet.groupBuy!;
  state.money -= gb.price;
  gainSkill(state, "otaku", GROUP_BUY_OTAKU_GAIN);
  gb.joined = true;
  state.pendingGoods.push({ itemId: gb.itemId, arriveDay: state.day + GOODS_DELIVERY_DAYS });
  addSchedule(state, "굿즈 공구 참여", "sns");
  return true;
}

/**
 * 도착일이 된 배송분을 인벤토리로 옮긴다(onNewDay에서 호출).
 * arriveDay <= day 항목만 ownedItems에 push하고 pending에서 제거한다(중복 배송 방지).
 * @returns 오늘 도착한 아이템명 목록(알림용).
 */
export function deliverPendingGoods(state: GameState): string[] {
  const arrived: string[] = [];
  const remaining: GameState["pendingGoods"] = [];
  for (const p of state.pendingGoods) {
    if (p.arriveDay <= state.day) {
      state.ownedItems.push(p.itemId);
      arrived.push(resolveItem(p.itemId)?.name ?? p.itemId);
    } else {
      remaining.push(p);
    }
  }
  if (arrived.length > 0) {
    state.pendingGoods = remaining;
    addSchedule(state, "굿즈 배송 도착", "system");
  }
  return arrived;
}

/** 굿즈 공구 모집 트윗을 만든다(랜덤 굿즈 + 정가 + 오타쿠 공구 톤 NPC). 피드에 낮은 확률로 섞인다. */
export function makeGoodsGroupBuyTweet(day: number): Tweet {
  const item = pick(GOODS_ITEMS);
  const author = pick(GOODS_GROUP_BUY_AUTHORS);
  return {
    id: uid("gb"),
    authorName: author.name,
    authorHandle: author.handle,
    attribute: "anime",
    isAdult: false,
    text: pick(GOODS_GROUP_BUY_LINES).replace("{item}", item.name).replace("{price}", item.price.toLocaleString("ko-KR")),
    createdDay: day,
    likes: randInt(0, 500),
    retweets: randInt(0, 150),
    gainedFollowers: 0,
    groupBuy: { itemId: item.id, price: item.price },
  };
}
