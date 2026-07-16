import type { AdOffer, Email, GameState } from "@/core/types";
import type { ShopItem } from "@/data/shop";
import { getActiveAccount } from "@/core/state";
import { AD_MAIL_TEMPLATES } from "@/data/adMail";
import { cosmeticById, monthlyNewCosmetics } from "@/data/cosmetics";
import { SHOP_ITEMS } from "@/data/shop";
import { chance, pick, uid } from "@/utils/random";
import { clampSkill } from "./stats";
import { salePrice } from "./seasonal";
// monthKey는 calendar.ts에서 직접 가져온다(time.ts가 이 파일을 import하므로 순환 참조 방지).
import { monthKey } from "./calendar";

/**
 * 광고 메일(50% 특가).
 * - 피메일 수신함에 낮은 확률로 쇼핑몰 프로모션 메일이 온다(하루 확률).
 * - 메일 본문의 오퍼로 쇼핑 상품을 반값에 살 수 있다. 단 도착 당일까지만 유효.
 * 스팸(spam.ts)과 달리 진짜 혜택이므로 Email.spam은 절대 세팅하지 않는다.
 */

/** 하루에 광고 메일이 올 확률 */
export const AD_EMAIL_CHANCE = 0.08;
/** 광고 메일 오퍼 할인율(0.5 = 반값) */
export const AD_OFFER_RATE = 0.5;
/** 안 읽은 광고 메일이 이 개수 이상이면 더 안 온다(수신함 폭주 방지) */
const AD_MAX_UNREAD = 2;

function won(n: number): string {
  return n.toLocaleString("ko-KR");
}

/** 오퍼 대상이 될 수 있는 상품 풀 — 쇼핑 아이템 + 이달의 신상 화장품 */
function offerPool(state: GameState): ShopItem[] {
  return [...SHOP_ITEMS, ...monthlyNewCosmetics(monthKey(state.day))];
}

/**
 * 오퍼 후보 — 미보유 상품(반복 구매 상품은 보유 중이어도 계속 후보). 성인 전용 상품은 성인물 해제 계정에서만.
 * 단 미보유 상품이 하나도 없으면(= 남은 게 보유 중인 반복 구매 상품뿐이면) 후보를 비운다.
 * 전 품목을 산 후반에 마우스/마이크 광고만 무한히 도착하는 걸 막는다.
 */
function offerCandidates(state: GameState): ShopItem[] {
  const adult = getActiveAccount(state).adultMode;
  const pool = offerPool(state).filter((item) => !item.adultOnly || adult);
  const unowned = pool.filter((item) => !state.ownedItems.includes(item.id));
  if (unowned.length === 0) return [];
  return pool.filter((item) => item.repeatable || !state.ownedItems.includes(item.id));
}

/** 템플릿 치환 — {item}=상품명, {price}=특가, {origin}=정가 */
function fillTokens(text: string, item: ShopItem, price: number): string {
  return text
    .replaceAll("{item}", item.name)
    .replaceAll("{price}", won(price))
    .replaceAll("{origin}", won(item.price));
}

/** 하루가 지날 때 확률적으로 광고 메일을 수신함에 넣는다(time.onNewDay에서 호출). */
export function maybeSpawnAdEmail(state: GameState): void {
  const unreadAds = state.emails.filter((e) => e.adOffer && !e.read).length;
  if (unreadAds >= AD_MAX_UNREAD) return;
  if (!chance(AD_EMAIL_CHANCE)) return;

  const candidates = offerCandidates(state);
  if (candidates.length === 0) return;

  const item = pick(candidates);
  // 도착 당일 한정이므로 만료일 = 오늘
  const offer: AdOffer = { itemId: item.id, rate: AD_OFFER_RATE, expiresDay: state.day };
  const t = pick(AD_MAIL_TEMPLATES);
  const price = adOfferPrice(state, offer, item);

  const email: Email = {
    id: uid("mail"),
    from: t.from,
    subject: fillTokens(t.subject, item, price),
    body: fillTokens(t.body, item, price),
    day: state.day,
    read: false,
    adOffer: offer,
  };
  state.emails.unshift(email);
}

/** 오퍼 대상 상품 (id 유실 시 null) */
export function adOfferItem(offer: AdOffer): ShopItem | null {
  return SHOP_ITEMS.find((i) => i.id === offer.itemId) ?? cosmeticById(offer.itemId) ?? null;
}

/**
 * 실구매가 — 쿠폰가와 시즌 세일가 중 더 싼 쪽 하나만 적용한다(중복 할인 불가).
 */
export function adOfferPrice(state: GameState, offer: AdOffer, item: ShopItem): number {
  const coupon = Math.round(item.price * (1 - offer.rate));
  return Math.min(coupon, salePrice(state.day, item.price));
}

export type AdOfferStatus = "ok" | "used" | "expired" | "owned" | "poor";

/** 버튼 활성/문구 판정용. 오퍼가 없거나 상품 id가 유실됐으면 만료 취급. */
export function adOfferStatus(state: GameState, email: Email): AdOfferStatus {
  const offer = email.adOffer;
  if (!offer) return "expired";
  if (offer.used) return "used";
  if (state.day > offer.expiresDay) return "expired";
  const item = adOfferItem(offer);
  if (!item) return "expired";
  // 반복 구매 상품은 보유 중이어도 계속 살 수 있다(쇼핑 탭의 canBuy와 같은 판정)
  if (!item.repeatable && state.ownedItems.includes(item.id)) return "owned";
  if (state.money < adOfferPrice(state, offer, item)) return "poor";
  return "ok";
}

/**
 * 오퍼로 구매한다. 성공하면 소지금 차감(특가) + 스탯 상승 + 보유 목록 추가 + 오퍼 사용 표시.
 * 스탯 상승은 shop.ts의 buyItem과 같은 결과다(가격 산정만 다르다).
 * 반복 구매 상품은 보유 목록에 중복으로 쌓인다. 단 쿠폰 자체는 1회용이라 메일당 한 번만 쓸 수 있다.
 * 메일 자체는 수신함에 남는다(used 표시로 버튼만 비활성).
 * @returns 실제로 구매했으면 true
 */
export function buyFromAdOffer(state: GameState, emailId: string): boolean {
  const email = state.emails.find((e) => e.id === emailId);
  if (!email?.adOffer) return false;
  if (adOfferStatus(state, email) !== "ok") return false;
  const offer = email.adOffer;
  const item = adOfferItem(offer);
  if (!item) return false;

  state.money -= adOfferPrice(state, offer, item);
  if (item.skill && item.boost) {
    state.skills[item.skill] = clampSkill(state.skills[item.skill] + item.boost);
  }
  state.ownedItems.push(item.id);
  offer.used = true;
  return true;
}
