import type { AuctionItem } from "@/data/auction";
import type { DMThread, Email, GameState, ScheduleEvent, SkillStatId } from "@/core/types";
import { appendSchedule, getActiveAccount, pushEmail } from "@/core/state";
import {
  AUCTION_ITEMS,
  AUCTION_MAIL_BODY,
  AUCTION_MAIL_FROM,
  AUCTION_MAIL_SUBJECT,
  AUCTION_PRICE,
  CONSOLE_REVIEW_TWEET,
  GENTLEMAN_ACCEPT_REPLY,
  GENTLEMAN_OPENER,
  GENTLEMAN_REFUSE_REPLY,
  STEAL_MAIL_BODY,
  STEAL_MAIL_FROM,
  STEAL_MAIL_SUBJECT,
} from "@/data/auction";
import { SKILL_STAT_IDS } from "@/data/stats";
import { pick, uid } from "@/utils/random";
import { dateOf } from "./calendar";
import { hasCertification } from "./certification";
import { changeFollowers } from "./followers";
import { clampResource, gainSkill } from "./stats";
import { GAMING_ATTRIBUTE } from "./steam";
import { postTweet } from "./tweetSystem";

export { AUCTION_ITEMS, AUCTION_PRICE };
export type { AuctionItem };

/**
 * 서던피스 경매 체인.
 *
 * 흐름: 헌터 자격증 취득 → 취득 후 처음 맞는 9월 6일 **심야**에 안내 메일 → 9월 9일까지 경매장 열람
 *      → 물품 3종(각 3억) 구매 → 낡은 게임기는 9월 10일 리뷰 트윗 선택창,
 *        진홍안은 구매 다음날 '금발의 신사' DM 분기.
 *
 * ⚠️ **날짜만으로 게이트를 짜면 안 된다.** 게임 시작일이 2026-06-01이라 첫 9월 6일은 **98일차**로,
 *    헌터 시험(매년 1월 7일 → 첫 회차 221일차)보다 **먼저** 지나간다. 그래서 발송 조건의 1순위는
 *    항상 `hasCertification(state, HUNTER_CERT_ID)`이며, 이게 98일차 오발송을 막는 유일한 방어선이다.
 *    (검증: 98일차엔 시험 자체가 존재한 적이 없어 certifications가 반드시 비어 있다.)
 *
 * 순수 로직: DOM/표시 없음. 결과는 값으로 반환하고 표시는 ui가 맡는다.
 */

/** 헌터 자격증 id — 안내 메일의 게이트. data/certifications.ts의 항목과 일치해야 한다. */
export const HUNTER_CERT_ID = "hunter";

/** 안내 메일이 발송되는 날짜(매년 9월 6일 심야) */
export const AUCTION_MAIL_MONTH = 9;
export const AUCTION_MAIL_DATE = 6;

/**
 * 안내 메일 당일(9/6)부터 경매장이 열려 있는 추가 일수.
 * 3 = 9/6·9/7·9/8·9/9 → 게임기 리뷰가 9월 10일 고정이라 그 전날까지.
 */
export const AUCTION_OPEN_DAYS = 3;

/** 낡은 게임기 리뷰 트윗이 열리는 날짜(9월 10일) */
export const CONSOLE_REVIEW_MONTH = 9;
export const CONSOLE_REVIEW_DATE = 10;

/** 진홍안 제안을 거절한 뒤 도난까지 걸리는 일수 */
export const EYE_STEAL_DELAY = 7;

/** 특수 분기가 걸린 물품 id — data/auction.ts의 id와 반드시 일치해야 한다. */
export const AUCTION_CELADON = "celadon";
export const AUCTION_OLD_CONSOLE = "old_console";
export const AUCTION_CRIMSON_EYE = "crimson_eye";

/** 게임기 리뷰 트윗으로 오르는 '게임' 스킬 */
export const CONSOLE_REVIEW_SKILL_GAIN = 250;
/** 게임기 리뷰 트윗의 추가 팔로워 비율(현재 팔로워 대비) */
export const CONSOLE_REVIEW_FOLLOWER_RATE = 0.3;
/** 게임기 리뷰 트윗의 최소 추가 팔로워(팔로워가 적어도 '대박'이 체감되게) */
export const CONSOLE_REVIEW_FOLLOWER_MIN = 5_000;

/** 진홍안을 넘겼을 때의 사례금(물품 가격과 동일) */
export const EYE_REWARD_MONEY = AUCTION_PRICE;
/** 진홍안을 넘겼을 때 랜덤 스킬 1종이 오르는 양 */
export const EYE_REWARD_SKILL_GAIN = 250;

/** 스케줄 등록(time.ts를 import하면 time → auction 순환이 생기므로 seasonal.ts처럼 직접 push한다) */
function pushSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  appendSchedule(state, { id: uid("sch"), day: state.day, title, kind });
}

/** 오늘이 (1-based month, date)인지 */
function isDate(state: GameState, month: number, date: number): boolean {
  const d = dateOf(state.day);
  return d.getMonth() + 1 === month && d.getDate() === date;
}

/** id → AuctionItem */
export function auctionItemById(id: string): AuctionItem | undefined {
  return AUCTION_ITEMS.find((i) => i.id === id);
}

/** 이미 낙찰받은 물품인지 */
export function isAuctionItemBought(state: GameState, id: string): boolean {
  return state.auction.bought.includes(id);
}

/**
 * 지금 경매장이 열려 있는지.
 * 안내 메일을 받은 날(9/6 심야)부터 AUCTION_OPEN_DAYS일 뒤(9/9)까지.
 * 메일을 아직 못 받았으면 링크 자체가 없으므로 항상 false.
 */
export function auctionOpen(state: GameState): boolean {
  const { mailedDay } = state.auction;
  if (mailedDay === null) return false;
  return state.day >= mailedDay && state.day <= mailedDay + AUCTION_OPEN_DAYS;
}

/** 구매 가능한지 — 열람 기간 + 미낙찰 + 잔고 충분 */
export function canBuyAuctionItem(state: GameState, item: AuctionItem): boolean {
  if (state.gameOver) return false;
  if (!auctionOpen(state)) return false;
  if (isAuctionItemBought(state, item.id)) return false;
  return state.money >= item.price;
}

/**
 * 물품을 낙찰받는다. 소지금을 차감하고 bought에 등록한다.
 * 진홍안이면 구매일을 남겨 **다음날** 금발의 신사 DM이 오게 한다(maybeSpawnCrimsonEyeDM).
 * 청자 도자기는 아무 후속도 없다(가짜 — 의도된 설계).
 * @returns 실제로 낙찰받았으면 true
 */
export function buyAuctionItem(state: GameState, item: AuctionItem): boolean {
  if (!canBuyAuctionItem(state, item)) return false;
  state.money -= item.price;
  state.auction.bought.push(item.id);
  pushSchedule(state, `서던피스 경매 낙찰 — ${item.name}`, "system");
  if (item.id === AUCTION_CRIMSON_EYE) {
    state.auction.eyeBoughtDay = state.day;
  }
  return true;
}

/**
 * 안내 메일 발송을 시도한다. **심야 슬롯 진입 시** advanceTime에서 호출된다.
 *
 * 조건 3개를 모두 만족해야 한다:
 *  1. 헌터 자격증 보유 — ⚠️ 98일차 오발송을 막는 방어선. 절대 빼지 마라.
 *  2. 오늘이 9월 6일
 *  3. 아직 미발송(mailedDay === null) — '취득 후 처음 맞는 9월 6일' 1회성
 */
export function maybeSendAuctionMail(state: GameState): void {
  if (state.gameOver) return;
  if (state.auction.mailedDay !== null) return;
  if (!hasCertification(state, HUNTER_CERT_ID)) return;
  if (!isDate(state, AUCTION_MAIL_MONTH, AUCTION_MAIL_DATE)) return;

  state.auction.mailedDay = state.day;

  // ⚠️ jobOffer/adOffer/spam은 절대 세팅하지 않는다 — auctionLink 전용 메일이다.
  // 발신자·제목·본문은 전부 data/auction.ts의 상수다(연출 문구는 content-author 소유).
  // ⚠️ 여기에 문구를 인라인하지 마라 — data의 정식 문구가 조용히 사장된다.
  const email: Email = {
    id: uid("mail"),
    from: AUCTION_MAIL_FROM,
    subject: AUCTION_MAIL_SUBJECT,
    body: AUCTION_MAIL_BODY,
    day: state.day,
    read: false,
    auctionLink: true,
  };
  pushEmail(state, email);
  pushSchedule(state, "서던피스 경매 초대장 도착", "system");
}

/**
 * 진홍안 구매 **다음날** 금발의 신사 DM을 보낸다(onNewDay에서 호출).
 * ⚠️ 기존 DM 스레드 구조를 그대로 재사용한다 — 별도 화면 없이 기존 DM UI로 렌더된다.
 */
export function maybeSpawnCrimsonEyeDM(state: GameState): void {
  if (state.gameOver) return;
  const a = state.auction;
  if (a.eyeDeal !== "none") return; // 이미 제안했거나 처리됨
  if (a.eyeBoughtDay === null) return; // 진홍안 미구매
  if (state.day !== a.eyeBoughtDay + 1) return; // 구매 다음날만

  const thread: DMThread = {
    id: uid("dm"),
    partnerName: "금발의 신사",
    partnerHandle: "gentleman",
    attribute: "daily",
    isAdult: false,
    messages: [{ id: uid("dmm"), from: "partner", text: GENTLEMAN_OPENER, day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    eyeDeal: true,
  };
  getActiveAccount(state).dms.unshift(thread);
  a.eyeDeal = "offered";
  pushSchedule(state, "금발의 신사에게서 DM이 왔다", "sns");
}

export interface EyeDealResult {
  /** 넘겨줬으면 true */
  accepted: boolean;
  /** 받은 사례금(거절이면 0) */
  money: number;
  /** 대폭 상승한 랜덤 스킬(거절이면 null) */
  skill: SkillStatId | null;
  /** 실제로 오른 스킬 양(클램프 반영, 거절이면 0) */
  skillGain: number;
}

/**
 * 금발의 신사의 제안에 답한다(ui의 넘겨줌/거절 버튼).
 * - 넘겨줌: 사례금 3억 + 도덕성 100(가득) + 랜덤 스킬 1종 +250. bought에서 진홍안 제거.
 * - 거절: EYE_STEAL_DELAY일 뒤 도난 예약(maybeStealCrimsonEye).
 *
 * ⚠️ 도덕성은 리소스(0~100)라 clampResource — ×10 하지 않는다.
 * ⚠️ 랜덤 스킬은 스킬(0~999)이라 clampSkill.
 * @returns 처리했으면 결과, 제안 대기 상태가 아니면 null
 */
export function resolveEyeDeal(state: GameState, accept: boolean): EyeDealResult | null {
  const a = state.auction;
  if (a.eyeDeal !== "offered") return null;

  const thread = getActiveAccount(state).dms.find((t) => t.eyeDeal);

  if (!accept) {
    a.eyeDeal = "refused";
    a.eyeRefusedDay = state.day;
    thread?.messages.push({
      id: uid("dmm"),
      from: "partner",
      text: GENTLEMAN_REFUSE_REPLY,
      day: state.day,
    });
    if (thread) thread.unread = true;
    pushSchedule(state, "금발의 신사의 제안을 거절했다", "sns");
    return { accepted: false, money: 0, skill: null, skillGain: 0 };
  }

  // 넘겨줌 — 물건은 손을 떠난다.
  a.eyeDeal = "given";
  a.bought = a.bought.filter((id) => id !== AUCTION_CRIMSON_EYE);
  state.money += EYE_REWARD_MONEY;
  // 도덕성은 리소스(0~100) — 가득 채운다.
  state.resources.morality = clampResource(100);

  // flat: 진홍안을 넘긴 대가로 약속된 보상(확정 고지·대가 지불). 배율이 걸리면 거래가 손해가 된다.
  const skill = pick(SKILL_STAT_IDS);
  const skillGain = gainSkill(state, skill, EYE_REWARD_SKILL_GAIN, { flat: true });

  thread?.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: GENTLEMAN_ACCEPT_REPLY,
    day: state.day,
  });
  if (thread) thread.unread = true;
  pushSchedule(state, `진홍안을 넘겼다 (+${EYE_REWARD_MONEY.toLocaleString("ko-KR")}원)`, "system");

  return { accepted: true, money: EYE_REWARD_MONEY, skill, skillGain };
}

/**
 * 제안을 거절하고 EYE_STEAL_DELAY일이 지나면 진홍안을 도난당한다(onNewDay에서 호출).
 * 보상 없음. bought에서 제거된다.
 * @returns 이번 호출에서 도난이 발생했으면 true(ui 알림용)
 */
export function maybeStealCrimsonEye(state: GameState): boolean {
  if (state.gameOver) return false;
  const a = state.auction;
  if (a.eyeDeal !== "refused") return false;
  if (a.eyeRefusedDay === null) return false;
  if (state.day < a.eyeRefusedDay + EYE_STEAL_DELAY) return false;

  a.eyeDeal = "stolen";
  a.bought = a.bought.filter((id) => id !== AUCTION_CRIMSON_EYE);

  // 발신자·제목·본문은 전부 data/auction.ts의 상수다(연출 문구는 content-author 소유).
  // ⚠️ 여기에 문구를 인라인하지 마라 — data의 정식 문구가 조용히 사장된다.
  // ⚠️ 발신자는 서던피스가 아닌 제3자(경찰)여야 한다. data 쪽 주석의 의도를 먼저 읽어라.
  // ⚠️ jobOffer/adOffer/spam·auctionLink 모두 미사용 — 정보 전달 전용 메일이다.
  const email: Email = {
    id: uid("mail"),
    from: STEAL_MAIL_FROM,
    subject: STEAL_MAIL_SUBJECT,
    body: STEAL_MAIL_BODY,
    day: state.day,
    read: false,
  };
  pushEmail(state, email);
  pushSchedule(state, "진홍안이 사라졌다", "system");
  return true;
}

/**
 * 낡은 게임기를 보유한 채 9월 10일이 오면 리뷰 트윗 선택창을 예약한다(onNewDay에서 호출).
 * 상태만 세우고 표시는 ui가 맡는다(dawnPending/catPowerPending과 같은 패턴).
 */
export function maybeOpenConsoleReview(state: GameState): void {
  if (state.gameOver) return;
  const a = state.auction;
  if (a.consoleReview !== "none") return; // 이미 처리됨(중복 방지)
  if (!isAuctionItemBought(state, AUCTION_OLD_CONSOLE)) return;
  if (!isDate(state, CONSOLE_REVIEW_MONTH, CONSOLE_REVIEW_DATE)) return;
  a.consoleReview = "pending";
}

export interface ConsoleReviewResult {
  /** 이 리뷰 트윗으로 얻은 총 신규 팔로워(트윗 성과 + 보너스) */
  followerDelta: number;
  /** 실제로 오른 게임 스킬 양(클램프 반영) */
  skillGain: number;
}

/**
 * 9월 10일 리뷰 트윗 선택창의 응답을 처리한다.
 * - post=true: '게임' 스킬 대폭 상승 → 리뷰 트윗 게시 → 팔로워 대폭 추가.
 *   ⚠️ 스킬을 postTweet **이전에** 올린다 — 이 트윗이 그 상승분의 혜택을 받게 하는 의도된 순서다
 *      (게임기를 파고든 결과가 곧 이 리뷰이므로). steam.reviewGame의 '자기 부양 방지'와는 반대 의도.
 * - post=false: 아무 일도 없이 선택창만 닫힌다.
 * @returns 게시했으면 결과, 선택 대기 상태가 아니거나 안 올렸으면 null
 */
export function postConsoleReview(state: GameState, post: boolean): ConsoleReviewResult | null {
  const a = state.auction;
  if (a.consoleReview !== "pending") return null;

  if (!post) {
    a.consoleReview = "declined";
    return null;
  }

  a.consoleReview = "posted";

  // flat: 낙찰받은 게임기를 파고든 결과가 곧 이 리뷰다 — 경매 낙찰금이라는 대가를 이미 치른
  // 1회성 확정 보상이라 컨디션 배율을 태우지 않는다.
  const skillGain = gainSkill(state, "game", CONSOLE_REVIEW_SKILL_GAIN, { flat: true });

  const { followerDelta } = postTweet(state, GAMING_ATTRIBUTE, CONSOLE_REVIEW_TWEET, false);

  // 대박 보정: 트윗 성과와 별개로 현재 팔로워의 일정 비율만큼 추가 유입(최소 보장치 있음).
  const account = getActiveAccount(state);
  const bonus = Math.max(
    CONSOLE_REVIEW_FOLLOWER_MIN,
    Math.round(account.followers * CONSOLE_REVIEW_FOLLOWER_RATE),
  );
  changeFollowers(state, bonus);
  pushSchedule(state, `낡은 게임기 리뷰가 터졌다 (+${bonus.toLocaleString("ko-KR")} 팔로워)`, "sns");

  return { followerDelta: followerDelta + bonus, skillGain };
}
