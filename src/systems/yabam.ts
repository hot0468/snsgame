import type { AdultKind, GameState, PlayerAccount } from "@/core/types";
import type { YabamVideo, YabamProduct } from "@/data/yabam";
import {
  YABAM_VIDEO_COST,
  YABAM_TOTO_WIN_CHANCE,
  YABAM_DM_OPENERS,
  TOTO_WIN_LINES,
  TOTO_LOSE_LINES,
  YABAM_TWEET_THRESHOLD,
} from "@/data/yabam";
import { ADULT_KINDS, ADULT_REVIEW_TWEETS } from "@/data/categories/adult";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { clampResource, clampSkill } from "./stats";
import { advanceTime } from "./time";
import { postTweet } from "./tweetSystem";

/**
 * 야밤(성인 사이트) 해금 DM / 콘텐츠 소비 로직.
 * - 성인 트윗을 누적으로 일정 수 이상 올리면(계정 성인모드 ON) "뜨거운 밤 도와줄게요" DM이 1회 도착한다.
 * - 링크를 클릭하면 '야밤' 탭이 브라우저에 추가된다.
 * - 야밤 사이트는 ① 성인영상 감상(결제) ② 토토(베팅) ③ 성인용품 구매의 3섹션.
 * (푸시타임 pushtime.ts와 동일한 패턴을 미러링한다.)
 */

/** 야밤 DM이 뜨는 성인 트윗 누적 최소 작성 수 */
export { YABAM_TWEET_THRESHOLD };

/** 이 음란도 이상이면 (adultMode ON 시) 야밤 탭이 노출된다 — DM 해금과 무관한 주 표출 기준 */
export const YABAM_LEWD_SHOW = 40;

/** 이 계정에 이미 야밤 링크 DM이 있는지 */
function hasYabamDM(state: GameState): boolean {
  return getActiveAccount(state).dms.some((t) => t.yabamLink);
}

/**
 * 성인 트윗 직후 호출 — 미해금 + 계정 성인모드 + 성인 트윗 누적 threshold 이상 + 기존 DM 없음이면
 * 야밤 링크 DM을 1회 생성한다. (푸시타임과 달리 확률 없이 조건 충족 즉시 도착)
 */
export function maybeSpawnYabamDM(state: GameState): void {
  if (state.yabamUnlocked) return;
  if (!state.adultMode) return;
  const account = getActiveAccount(state);
  if (state.adultTweetsPosted < YABAM_TWEET_THRESHOLD) return;
  if (hasYabamDM(state)) return;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: "야밤 도우미",
    partnerHandle: "yabam_night",
    attribute: "adult",
    isAdult: true,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(YABAM_DM_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    yabamLink: true,
  });
}

/** 링크를 클릭하면 야밤이 해금되고 그 DM 스레드는 사라진다. */
export function consumeYabamLink(state: GameState): void {
  state.yabamUnlocked = true;
  const account = getActiveAccount(state);
  account.dms = account.dms.filter((t) => !t.yabamLink);
}

export interface YabamVideoResult {
  message: string;
}

/** 성인영상 1편 감상(결제). 음란도·정신력이 오르고 도덕성이 내린다. */
export function viewYabamVideo(state: GameState, video: YabamVideo): YabamVideoResult | null {
  if (state.money < YABAM_VIDEO_COST) return null;
  state.money -= YABAM_VIDEO_COST;
  state.skills.lewd = clampSkill(state.skills.lewd + 10);
  state.resources.mental = clampResource(state.resources.mental + 5);
  state.resources.morality = clampResource(state.resources.morality - 2);
  // 한 편 감상에 시간 블록 1개를 소모한다(오프라인 활동·근무와 같은 결).
  advanceTime(state, 1);
  return {
    message: `『${video.title}』을(를) 결제하고 몰래 감상했다. 야밤의 밤은 짧고 뜨겁다. 어느새 시간이 훌쩍 지났다. (음란 +10 · 정신력 +5 · 도덕성 -2)`,
  };
}

export interface TotoResult {
  won: boolean;
  bet: number;
  /** 소지금 변화량(+승리, -패배) */
  delta: number;
  message: string;
}

/**
 * 야밤 토토 베팅. 적중 시 배당 2배(순이익 = 베팅액), 꽝이면 베팅액을 잃는다.
 * 도박은 도덕성/정신력에 악영향(패배 시 더 크게).
 */
export function playYabamToto(state: GameState, bet: number): TotoResult | null {
  if (state.money < bet) return null;
  const won = chance(YABAM_TOTO_WIN_CHANCE);
  if (won) {
    state.money += bet;
    // 승리해도 도박은 도덕성을 갉아먹지만, 정신력은 잠깐 오른다
    state.resources.morality = clampResource(state.resources.morality - 1);
    state.resources.mental = clampResource(state.resources.mental + 2);
    return {
      won: true,
      bet,
      delta: bet,
      message: `${pick(TOTO_WIN_LINES)} (+${bet.toLocaleString("ko-KR")}원 · 도덕성 -1)`,
    };
  }
  state.money -= bet;
  state.resources.morality = clampResource(state.resources.morality - 2);
  state.resources.mental = clampResource(state.resources.mental - 3);
  return {
    won: false,
    bet,
    delta: -bet,
    message: `${pick(TOTO_LOSE_LINES)} (-${bet.toLocaleString("ko-KR")}원 · 도덕성 -2 · 정신력 -3)`,
  };
}

export interface YabamBuyResult {
  message: string;
}

/**
 * 성인용품 1회 구매. 이미 보유했거나 소지금이 부족하면 null.
 * 구매 시 소량의 음란도 상승(플레이버 효과).
 */
export function buyYabamProduct(state: GameState, product: YabamProduct): YabamBuyResult | null {
  if (state.money < product.price) return null;
  if (state.yabamProductsOwned.includes(product.id)) return null;
  state.money -= product.price;
  state.yabamProductsOwned.push(product.id);
  state.skills.lewd = clampSkill(state.skills.lewd + 5);
  return {
    message: `『${product.name}』을(를) 은밀하게 주문했다. ${product.effect} (음란 +5)`,
  };
}

/** 리뷰 트윗의 팔로워 배율(성인 배율 위에 곱해지는 완화 계수 — 과하지 않게). */
export const REVIEW_TWEET_FOLLOWER_MULT = 0.5;

export interface YabamReviewResult {
  message: string;
  /** 이번 리뷰로 새로 해금된 성인 트윗 종류 */
  unlockedKind?: AdultKind;
}

/**
 * 보유한 성인용품의 '리뷰 트윗'을 올려 그 용품이 대응하는 성인 트윗 종류를 해금한다.
 * - 미보유 / unlocksKind 없음(일반 용품) / 이미 해금된 종류면 null(리뷰 대상 아님).
 * - 리뷰 트윗은 기존 postTweet 경유로 게시하되 { free: true }로 호출한다
 *   (성인 카테고리·isAdult=true, 종류는 해당 kind). 리뷰는 무료 해금이므로
 *   행동력 소모·시간 진행(슬롯 1칸)이 없다.
 *   팔로워 효과는 REVIEW_TWEET_FOLLOWER_MULT로 완화한다(성인 1.5배 × 0.5 = 0.75배).
 * - 게시 후 account.unlockedAdultKinds에 해당 kind를 추가한다.
 * 주의: postTweet를 경유하므로 타임라인 등록·팔로워·성인 DM 스폰 등의 부수효과는 함께 발생한다.
 *       (행동력·시간만 free로 제외. 이미 야밤 해금 상태이므로 adultTweetsPosted 증가는 무해하며,
 *        재리뷰는 위 가드로 막힌다.)
 */
export function reviewYabamProduct(
  state: GameState,
  product: YabamProduct,
): YabamReviewResult | null {
  if (!state.yabamProductsOwned.includes(product.id)) return null;
  const kind = product.unlocksKind;
  if (!kind) return null;
  const account = getActiveAccount(state);
  if (account.unlockedAdultKinds.includes(kind)) return null;

  // 리뷰 트윗 텍스트 pick(데이터가 종류별로 문구 풀을 제공). 풀이 비면 안전 폴백.
  const pool = (ADULT_REVIEW_TWEETS as Record<string, string[]>)[kind];
  const text =
    pool && pool.length > 0
      ? pick(pool)
      : `『${product.name}』 써봤는데 물건 좋네요. 후기 남깁니다`;

  const { followerDelta } = postTweet(state, "adult", text, true, kind, REVIEW_TWEET_FOLLOWER_MULT, {
    free: true,
  });

  account.unlockedAdultKinds.push(kind);

  const label = ADULT_KINDS.find((k) => k.id === kind)?.label ?? "새 성인 트윗 종류";
  return {
    message: `『${product.name}』 리뷰를 올렸다. 「${label}」 트윗이 해금됐다! (+${followerDelta} 팔로워)`,
    unlockedKind: kind,
  };
}

/**
 * 지금 이 계정에서 작성 가능한 성인 트윗 종류 목록.
 * sekt(항상) → unlockedAdultKinds(meetup/punish/dom 중 해금된 것) → group(groupUnlocked면).
 * sekt가 unlockedAdultKinds에 이미 있을 수 있으니 중복은 제거한다.
 */
export function availableAdultKinds(account: PlayerAccount): AdultKind[] {
  const kinds: AdultKind[] = ["sekt"];
  for (const k of account.unlockedAdultKinds ?? []) {
    if (!kinds.includes(k)) kinds.push(k);
  }
  if (account.groupUnlocked && !kinds.includes("group")) kinds.push("group");
  return kinds;
}
