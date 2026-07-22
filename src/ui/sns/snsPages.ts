import type { GameContext } from "@/ui/context";
import { FEED_PAGE } from "@/ui/context";
import type { Account, AttributeId, DMThread, GameState, Tweet } from "@/core/types";
import { getActiveAccount, visibleTimeline } from "@/core/state";
import { ALL_ATTRIBUTE_IDS, ATTRIBUTES } from "@/data/attributes";
import type { DMTone } from "@/data/dmContent";
import { DICK_SIZE_LABELS } from "@/data/dmContent";
import { canUseBoldTone, claimDonation, replyDM, sendCustomDM, visibleDms } from "@/systems/dm";
import { canMeet, MEETING_ACTION_COST } from "@/systems/meeting";
import { joinCrew } from "@/systems/crew";
import { joinGroupRoom } from "@/systems/groupRoom";
import { canJoinGroupBuy, joinGroupBuy } from "@/systems/groupBuy";
import { joinSavanna } from "@/systems/savanna";
import { joinStudy } from "@/systems/studyGroup";
import { signLingerie } from "@/systems/lingerie";
import { resolveCosplayGeneral, pickCosplayAdultScenario, resolveCosplayAdult } from "@/systems/cosplay";
import { renderScenarioReaderModal } from "./scenarioReader";
import { acceptAuthorContract } from "@/systems/author";
import { acceptAvJob, declineAvJob, switchToAvJob } from "@/systems/avJob";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { confirmPurchase } from "@/ui/confirmModal";
import { consumeWishLink, isWishTweet, rollWishOptions, spawnWishDM } from "@/systems/wish";
import { isChainLetterTweet, resolveChainLetter } from "@/systems/chainLetter";
import { BOOST_COST, consumeBoostLink, isBoostTweet, resolveBoostDeal, spawnBoostDM } from "@/systems/statBoost";
import { bumpLotteryLuck, isOhaasaTweet } from "@/systems/ohaasa";
import { isPsychoTweet, resolvePsychoTest, spawnPsychoDM } from "@/systems/psychoTest";
import { SKILL_STATS, SKILL_STAT_IDS } from "@/data/stats";
import { isHauntTweet } from "@/systems/haunt";
import { DARTPIN_URL, isDartpinTweet, unlockDartpin } from "@/systems/dartpin";
import { isDstoryTweet } from "@/systems/dstory";
import { DSTORY_URL } from "@/data/dstory";
import { consumePushLink } from "@/systems/pushtime";
import type { EyeDealResult } from "@/systems/auction";
import { resolveEyeDeal } from "@/systems/auction";
import { resolveLabOffer } from "@/systems/lab";
import { renderEyeDealResultModal } from "@/ui/auctionModals";
import { addAppointment } from "@/systems/appointments";
import { dateLabel } from "@/systems/time";
import { SLOT_LABELS, MORNING_SLOT } from "@/core/state";
import {
  exploreAccounts,
  exploreTweets,
  searchTweetsByCategory,
  followAccount,
  reactToTweet,
  retweetTweet,
} from "@/systems/exploreSystem";
import { canWatchAd, watchAd } from "@/systems/ads";
import { el, enableDragScroll, formatNumber } from "@/utils/dom";
import { tweetCard } from "@/ui/components";
import { renderQuoteModal } from "@/ui/quoteModal";
import { icon, avatar, ATTR_ICON } from "@/ui/icons";
import { renderMeetingModal } from "./meetingModal";
import { renderMotelModal } from "./motelModal";
import { renderTicketModal } from "./ticketModal";
import { renderAccountModal } from "./accountModal";
import { renderMediaModal } from "@/ui/mediaModal";

/** 트윗의 사진/영상 자리 클릭 → 설명 팝업 */
function openMedia(ctx: GameContext): (t: Tweet) => void {
  return (t) => ctx.openModal((c) => renderMediaModal(c, t));
}

/* ===================== 페이지 진입(네비게이션) ===================== */

/** 홈으로 */
export function goHome(ctx: GameContext): void {
  ctx.ui.snsPage = "home";
  ctx.refresh();
}

/** 탐색 페이지 진입: 랜덤 계정 생성(무비용, 누를 때마다 갱신) */
export function enterExplore(ctx: GameContext): void {
  ctx.ui.exploreAccounts = exploreAccounts(ctx.store.getState());
  ctx.ui.exploreSelectedId = null;
  ctx.ui.snsPage = "explore";
  ctx.refresh();
}

/** 둘러보기 페이지 진입: 랜덤 트윗 생성(무비용, 누를 때마다 갱신) */
export function enterPosts(ctx: GameContext): void {
  ctx.ui.explorePosts = exploreTweets(ctx.store.getState());
  ctx.ui.snsPage = "posts";
  ctx.refresh();
}

/**
 * 검색 페이지에서 볼 수 있는 카테고리 — 내가 아직 트윗을 못 쓰는(미해금) 성향은 제외한다.
 * 단, **열람은 게시와 별개**라 성인물 해제(adultMode)가 켜져 있으면 "adult"는 해금 여부와
 * 무관하게 항상 포함한다(중복 방지).
 */
function searchCategories(ctx: GameContext): AttributeId[] {
  const s = ctx.store.getState();
  const account = getActiveAccount(s);
  const adult = s.adultMode;
  const cats = ALL_ATTRIBUTE_IDS.filter(
    (a) =>
      account.unlockedAttributes.includes(a) && (adult || !ATTRIBUTES[a].adultOnly),
  );
  if (adult && !cats.includes("adult")) cats.push("adult");
  return cats;
}

/** 특정 카테고리를 선택해 해당 성향 트윗 3개를 랜덤 생성 */
function selectSearchCategory(ctx: GameContext, attr: AttributeId): void {
  ctx.ui.searchCategory = attr;
  ctx.ui.searchPosts = searchTweetsByCategory(ctx.store.getState(), attr);
  ctx.refresh();
}

/** 검색 페이지 진입: 오른쪽 트렌드 영역 없이 검색만. 첫 카테고리를 자동 선택. */
export function enterSearch(ctx: GameContext): void {
  const cats = searchCategories(ctx);
  const prev = ctx.ui.searchCategory;
  const cat = prev && cats.includes(prev) ? prev : cats[0];
  ctx.ui.snsPage = "search";
  selectSearchCategory(ctx, cat);
}

/** 쪽지 페이지 진입 */
export function enterDM(ctx: GameContext): void {
  const dms = visibleDms(ctx.store.getState());
  if (!ctx.ui.dmThreadId || !dms.some((t) => t.id === ctx.ui.dmThreadId)) {
    ctx.ui.dmThreadId = dms[0]?.id ?? null;
  }
  ctx.ui.snsPage = "dm";
  ctx.refresh();
}

/** 광고 페이지 진입 */
export function enterAd(ctx: GameContext): void {
  ctx.ui.snsPage = "ad";
  ctx.refresh();
}

/* ===================== 공용 ===================== */

/** 뒤로가기 화살표가 있는 페이지 헤더 */
function pageHeader(title: string, onBack: () => void): HTMLElement {
  return el(
    "header",
    { class: "feed__header" },
    el(
      "div",
      { class: "page-head" },
      el("button", { class: "page-head__back", title: "뒤로", onclick: onBack }, "←"),
      el("div", { class: "page-head__title" }, title),
    ),
  );
}

/** 이미 이 원본 트윗을 리트윗했는지 */
function alreadyRetweeted(state: GameState, sourceId: string): boolean {
  return getActiveAccount(state).timeline.some(
    (t) => t.isRetweet && t.retweetSourceId === sourceId,
  );
}

/** 남의 트윗을 리트윗해 내 탐라에 등록 */
function doRetweet(ctx: GameContext, tweet: Tweet): void {
  // 행운의 편지: 일반 리트윗 대신 도박을 발동한다(내 탐라에 등록하지 않음).
  if (isChainLetterTweet(tweet)) {
    let msg = "";
    ctx.update((s) => {
      msg = resolveChainLetter(s);
    });
    ctx.toast(msg);
    ctx.afterAction("retweet");
    return;
  }
  // 오하아사: 리트윗해도 로또 운 +1(좋아요와 동일).
  if (isOhaasaTweet(tweet)) {
    ctx.update((s) => bumpLotteryLuck(s));
    ctx.toast("오하아사의 기운을 받았다. 오늘은 왠지 운이 트일 것 같다…");
    ctx.afterAction("retweet");
    return;
  }
  let delta: number | null = 0;
  ctx.update((s) => {
    delta = retweetTweet(s, tweet);
  });
  if (delta === null) {
    ctx.toast("이미 리트윗한 트윗이에요");
    return;
  }
  ctx.toast(delta >= 0 ? `리트윗! 내 탐라에 등록 · 팔로워 +${delta}` : `리트윗... 상충 ${delta}`);
  ctx.afterAction("retweet");
}

/** 남의 트윗에 반응(좋아요/악플)을 남긴다. */
function doReact(ctx: GameContext, tweet: Tweet, positive: boolean): void {
  ctx.ui.reactedTweetIds.add(tweet.id);
  // 까칠한외눈 트윗에 좋아요를 누르면 소원 가게 링크 DM이 온다.
  if (positive && isWishTweet(tweet)) {
    ctx.update((s) => spawnWishDM(s));
    ctx.toast("의문의 계정에게서 쪽지가 도착했다…");
    return;
  }
  // 불법 스탯 부스트상: 좋아요 → 뒷거래 링크 DM.
  if (positive && isBoostTweet(tweet)) {
    ctx.update((s) => spawnBoostDM(s));
    ctx.toast("의문의 계정에게서 쪽지가 도착했다…");
    return;
  }
  // 의문의 심리테스트: 좋아요 → 결과 링크 DM(피싱).
  if (positive && isPsychoTweet(tweet)) {
    ctx.update((s) => spawnPsychoDM(s));
    ctx.toast("'결과 보기' 링크가 쪽지로 도착했다. …이름을 넣으라는데?");
    return;
  }
  // 오하아사(아침 운세): 좋아요 → 로또 운 +1.
  if (positive && isOhaasaTweet(tweet)) {
    ctx.update((s) => bumpLotteryLuck(s));
    ctx.toast("오하아사의 기운을 받았다. 오늘은 왠지 운이 트일 것 같다…");
    return;
  }
  // 괴담 계정: 좋아요 → 그날 심야 방문 예약(hauntPending).
  if (positive && isHauntTweet(tweet)) {
    ctx.update((s) => {
      s.hauntPending = true;
    });
    ctx.toast("…방금, 좋아요를 누르지 말았어야 했다.");
    return;
  }
  let delta = 0;
  ctx.update((s) => {
    delta = reactToTweet(s, tweet, positive);
  });
  if (positive) {
    ctx.toast(delta > 0 ? `응원했다! 팔로워 +${delta}` : "응원했지만 반응은 미지근하다.");
    ctx.afterAction("like");
  } else {
    ctx.toast(`악플을 남겼다... 팔로워 ${delta >= 0 ? "+" : ""}${delta} · 도덕성 하락`, "bad");
  }
}

/** 행사 트윗의 '참여하기' → 행사 일정을 스케줄(약속)에 등록 */
function joinTweetEvent(ctx: GameContext, tweet: Tweet): void {
  const ev = tweet.event;
  if (!ev || ev.joined) return;
  ev.joined = true; // UI 상태(즉시 버튼 반영)
  let when = "";
  let ticketing = false;
  ctx.update((s) => {
    const eventDay = Math.max(ev.day, s.day + 2); // 행사는 항상 미래로
    if (ev.ticketing) {
      // 무대인사·GV·콘서트: 관람 전에 티켓팅부터. 티켓팅은 행사 일주일 전(과거면 내일)에 도래.
      ticketing = true;
      const ticketDay = Math.max(eventDay - 7, s.day + 1);
      const realEventDay = Math.max(eventDay, ticketDay + 1);
      addAppointment(s, {
        day: ticketDay,
        slot: MORNING_SLOT,
        kind: "ticketing",
        title: `${ev.title} 티켓팅`,
        ticketFor: {
          day: realEventDay,
          slot: ev.slot,
          title: ev.title,
          attribute: ev.attribute,
          variant: ev.variant,
        },
      });
      when = `${dateLabel(ticketDay)} ${SLOT_LABELS[MORNING_SLOT] ?? ""}`;
    } else {
      addAppointment(s, {
        day: eventDay,
        slot: ev.slot,
        kind: "event",
        title: ev.title,
        attribute: ev.attribute,
        variant: ev.variant,
      });
      when = `${dateLabel(eventDay)} ${SLOT_LABELS[ev.slot] ?? ""}`;
    }
  });
  ctx.toast(
    ticketing
      ? `티켓팅 일정을 등록했어요! (${when}) 성공해야 관람할 수 있어요`
      : `행사 일정을 등록했어요! (${when})`,
  );
}

/** 굿즈 공구 트윗의 '공구 참여하기' → 지출+덕질, 7일 뒤 배송(pendingGoods) */
function joinTweetGroupBuy(ctx: GameContext, tweet: Tweet): void {
  const gb = tweet.groupBuy;
  if (!gb || gb.joined) return;
  // 규칙은 systems가 판정한다(돈 가드). UI는 결과만 알린다.
  if (!canJoinGroupBuy(ctx.store.getState(), tweet)) {
    ctx.toast("소지금이 부족해요", "bad");
    return;
  }
  // joinGroupBuy가 canJoinGroupBuy(!joined) 가드를 다시 타므로, 여기서 미리 joined=true를
  // 세팅하면 안 된다(가드 걸려 지출·덕질·pending이 통째로 스킵됨). joinGroupBuy가 같은 tweet
  // 객체의 gb.joined를 세팅하고 ctx.update 재렌더가 '참여함'을 반영한다.
  ctx.update((s) => {
    joinGroupBuy(s, tweet);
  });
  ctx.toast("공구 참여! 7일 뒤 배송돼요");
}

/** 굿즈 공동구매 트윗에 붙는 참여 박스(행사 박스와 같은 그릇 재사용) */
function groupBuyBox(ctx: GameContext, tweet: Tweet): HTMLElement | null {
  const gb = tweet.groupBuy;
  if (!gb) return null;
  const btn = gb.joined
    ? el("span", { class: "tweet-event__done" }, "참여함")
    : el(
        "button",
        {
          class: "tweet-event__btn",
          onclick: (e: Event) => {
            e.stopPropagation();
            joinTweetGroupBuy(ctx, tweet);
          },
        },
        `공구 참여하기 (₩${formatNumber(gb.price)})`,
      );
  return el(
    "div",
    { class: "tweet-event" },
    el(
      "div",
      { class: "tweet-event__info" },
      icon("sparkle", { size: 14 }),
      el(
        "div",
        {},
        el("div", { class: "tweet-event__title" }, "굿즈 공동구매"),
        el("div", { class: "tweet-event__when" }, "참여하면 7일 뒤 배송돼요"),
      ),
    ),
    btn,
  );
}

/**
 * 다트 핀 발견 트윗에 붙는 링크 미리보기 카드.
 *
 * ⚠️ **광고가 아니다.** 광고 라벨을 붙이는 `adTweetCard`(추천탭 전용) 경로를 타지 않고,
 *    일반 트윗 카드 본문에 링크 카드만 얹는다 — 일반인이 링크를 달아 공유한 트윗이다.
 *    누르면 탭이 해금되고(unlockDartpin) 그 탭으로 이동한다.
 */
function dartpinLinkCard(ctx: GameContext): HTMLElement {
  return el(
    "button",
    {
      class: "tweet-link",
      onclick: (e: Event) => {
        e.stopPropagation();
        ctx.update((s) => unlockDartpin(s));
        ctx.ui.dartpinPostId = null;
        ctx.ui.activeTab = "dartpin";
        ctx.toast("다트 핀이 브라우저에 추가됐어요");
        ctx.refresh();
      },
    },
    el("span", { class: "tweet-link__thumb" }, "핀"),
    el(
      "span",
      { class: "tweet-link__info" },
      el("span", { class: "tweet-link__host" }, DARTPIN_URL),
      el("span", { class: "tweet-link__title" }, "다트 핀 — 익명 게시판"),
      el("span", { class: "tweet-link__desc" }, "다들 여기서 털어놓는다"),
    ),
  );
}

/**
 * d스토리 링크 트윗에 붙는 링크 미리보기 카드(다트 핀과 같은 자리·같은 클래스).
 *
 * ⚠️ **탭을 바꾸지 않는다.** d스토리는 탭이 아니라 현재 탭 콘텐츠를 덮는 오버레이다 —
 *    해금(unlock*)도 없다. 오버레이는 상태에 남지 않는다(systems/dstory 헤더 참조).
 * ⚠️ 광고가 아니다 — adTweetCard(광고 라벨) 경로를 타지 않고 일반 카드에 얹는다.
 */
function dstoryLinkCard(ctx: GameContext): HTMLElement {
  return el(
    "button",
    {
      class: "tweet-link",
      onclick: (e: Event) => {
        e.stopPropagation();
        ctx.ui.dstorySiteOpen = true;
        ctx.ui.dstoryPostId = null;
        ctx.refresh();
      },
    },
    el("span", { class: "tweet-link__thumb tweet-link__thumb--dstory" }, "d"),
    el(
      "span",
      { class: "tweet-link__info" },
      el("span", { class: "tweet-link__host" }, DSTORY_URL),
      el("span", { class: "tweet-link__title" }, "d스토리 — 웹 개발 공부 기록"),
      el("span", { class: "tweet-link__desc" }, "삽질과 정리"),
    ),
  );
}

/** 리트윗(아이콘) + 좋아요/악플 반응 행을 붙인 트윗 카드 */
export function reactableCard(ctx: GameContext, tweet: Tweet): HTMLElement {
  const state = ctx.store.getState();
  const rtDone = alreadyRetweeted(state, tweet.id);
  const reacted = ctx.ui.reactedTweetIds.has(tweet.id);

  const card = tweetCard(tweet, {
    retweet: { done: rtDone, onClick: () => doRetweet(ctx, tweet) },
    onJoinEvent:
      tweet.event && !tweet.event.joined ? () => joinTweetEvent(ctx, tweet) : undefined,
    onMedia: openMedia(ctx),
    readerVocab: state.skills.knowledge,
  });

  // 링크 트윗이면 본문 아래(액션 바 위)에 링크 카드를 끼운다.
  const linkCard = isDartpinTweet(tweet)
    ? dartpinLinkCard(ctx)
    : isDstoryTweet(tweet)
      ? dstoryLinkCard(ctx)
      : null;
  if (linkCard) {
    const body = card.querySelector<HTMLElement>(".tweet__body");
    const actions = body?.querySelector(".tweet__actions");
    if (actions) body?.insertBefore(linkCard, actions);
    else body?.appendChild(linkCard);
  }

  // 굿즈 공구 트윗이면 본문 아래(액션 바 위)에 공구 참여 박스를 끼운다.
  const gbBox = groupBuyBox(ctx, tweet);
  if (gbBox) {
    const body = card.querySelector<HTMLElement>(".tweet__body");
    const actions = body?.querySelector(".tweet__actions");
    if (actions) body?.insertBefore(gbBox, actions);
    else body?.appendChild(gbBox);
  }

  return el(
    "div",
    { class: "explore-item" },
    card,
    el(
      "div",
      { class: "react-row" },
      el(
        "button",
        {
          class: "react-btn react-btn--pos" + (reacted ? " react-btn--done" : ""),
          disabled: reacted,
          onclick: () => doReact(ctx, tweet, true),
        },
        icon("heart", { size: 14 }),
        "좋아요",
      ),
      el(
        "button",
        {
          class: "react-btn react-btn--neg" + (reacted ? " react-btn--done" : ""),
          disabled: reacted,
          onclick: () => doReact(ctx, tweet, false),
        },
        "악플",
      ),
      // 인용(QRT)은 반응과 독립 — 좋아요/악플을 눌렀어도 인용은 가능하다.
      el(
        "button",
        {
          class: "react-btn react-btn--quote",
          onclick: () => ctx.openModal((c) => renderQuoteModal(c, tweet)),
        },
        icon("retweet", { size: 14 }),
        "인용",
      ),
      reacted ? el("span", { class: "react-hint" }, "반응 완료") : null,
    ),
  );
}

/* ===================== 탐색 페이지 ===================== */

/** 계정별로 안정적인 프로필 플레이버 값 */
function profileMeta(acc: Account): { hue: number; following: number; posts: number } {
  const seed = [...acc.handle].reduce((a, c) => a + c.charCodeAt(0), 0) || 7;
  return {
    hue: seed % 360,
    following: 30 + ((seed * 7) % 940),
    posts: 80 + ((seed * 131) % 39000),
  };
}

function follow(ctx: GameContext, acc: Account): void {
  if (acc.followed) return;
  let delta = 0;
  ctx.update((s) => {
    delta = followAccount(s, acc);
  });
  acc.followed = true;
  ctx.toast(delta >= 0 ? `팔로우! 내 팔로워 +${delta}` : `팔로우... 상충으로 ${delta}`);
}

function followBtn(ctx: GameContext, acc: Account): HTMLElement {
  return el(
    "button",
    {
      class: "btn" + (acc.followed ? " btn--ghost" : ""),
      disabled: acc.followed,
      onclick: (e: Event) => {
        e.stopPropagation();
        follow(ctx, acc);
      },
    },
    acc.followed ? "팔로잉" : "팔로우",
  );
}

function accountRow(ctx: GameContext, acc: Account): HTMLElement {
  return el(
    "div",
    {
      class: "acct-row",
      onclick: () => {
        ctx.ui.exploreSelectedId = acc.id;
        ctx.refresh();
      },
    },
    avatar(acc.name, 44),
    el(
      "div",
      { class: "acct-row__info" },
      el("div", { class: "acct-row__name" }, acc.name),
      el("div", { class: "acct-row__handle" }, `@${acc.handle}`),
      el("div", { class: "acct-row__bio" }, acc.bio),
    ),
    followBtn(ctx, acc),
  );
}

function profileBody(ctx: GameContext, acc: Account): HTMLElement {
  const meta = profileMeta(acc);
  return el(
    "div",
    { class: "profile" },
    el("div", {
      class: "profile__banner",
      style:
        `background:linear-gradient(120deg, hsl(${meta.hue}deg 62% 55%),` +
        ` hsl(${(meta.hue + 45) % 360}deg 62% 45%))`,
    }),
    el(
      "div",
      { class: "profile__topbar" },
      el("div", { class: "profile__avatar" }, avatar(acc.name, 72)),
      followBtn(ctx, acc),
    ),
    el("div", { class: "profile__name" }, acc.name),
    el("div", { class: "profile__handle" }, `@${acc.handle}`),
    acc.bio ? el("p", { class: "profile__bio" }, acc.bio) : null,
    el(
      "div",
      { class: "profile__stats" },
      el("span", {}, el("b", {}, formatNumber(meta.following)), " 팔로우 중"),
      el("span", {}, el("b", {}, formatNumber(acc.followers)), " 팔로워"),
    ),
    el(
      "div",
      { class: "profile__tabs" },
      el("div", { class: "profile__tab profile__tab--active" }, "게시물"),
      el("div", { class: "profile__tab" }, "답글"),
      el("div", { class: "profile__tab" }, "미디어"),
    ),
    acc.timeline.length
      ? el("div", {}, ...acc.timeline.map((t) => reactableCard(ctx, t)))
      : el("div", { class: "empty" }, "아직 게시물이 없어요"),
  );
}

export function explorePage(ctx: GameContext): HTMLElement {
  const ui = ctx.ui;
  const selected = ui.exploreSelectedId
    ? ui.exploreAccounts.find((a) => a.id === ui.exploreSelectedId) ?? null
    : null;

  if (selected) {
    return el(
      "section",
      { class: "sns__feed" },
      pageHeader(selected.name, () => {
        ui.exploreSelectedId = null;
        ctx.refresh();
      }),
      profileBody(ctx, selected),
    );
  }

  return el(
    "section",
    { class: "sns__feed" },
    pageHeader("계정 탐색", () => goHome(ctx)),
    ui.exploreAccounts.length
      ? el("div", {}, ...ui.exploreAccounts.map((acc) => accountRow(ctx, acc)))
      : el("div", { class: "empty" }, "탐색된 계정이 없어요"),
  );
}

/* ===================== 내 프로필 페이지 ===================== */

export function mePage(ctx: GameContext): HTMLElement {
  const account = getActiveAccount(ctx.store.getState());
  const hue = ([...account.handle].reduce((a, c) => a + c.charCodeAt(0), 0) || 7) % 360;

  return el(
    "section",
    { class: "sns__feed" },
    pageHeader(account.name, () => goHome(ctx)),
    el(
      "div",
      { class: "profile" },
      el("div", {
        class: "profile__banner",
        style:
          `background:linear-gradient(120deg, hsl(${hue}deg 62% 55%),` +
          ` hsl(${(hue + 45) % 360}deg 62% 45%))`,
      }),
      el(
        "div",
        { class: "profile__topbar" },
        el("div", { class: "profile__avatar" }, avatar(account.name, 72)),
        el(
          "button",
          { class: "btn btn--ghost", onclick: () => ctx.openModal(renderAccountModal) },
          "계정 관리",
        ),
      ),
      el("div", { class: "profile__name" }, account.name),
      el("div", { class: "profile__handle" }, `@${account.handle}`),
      // 주 성향(account.attribute)은 타임라인에서 자동 산출돼 런타임에 바뀐다.
      // 그래서 캐싱하지 않고 렌더할 때마다 ATTRIBUTES에서 다시 읽어야
      // 성향 변화가 이 힌트에 바로 반영된다.
      el(
        "p",
        { class: "profile__bio profile__bio--hint" },
        ATTRIBUTES[account.attribute].bio,
      ),
      el(
        "div",
        { class: "profile__stats" },
        // 게시물 수는 account.postCount(누적)로 센다 — 타임라인은 TIMELINE_MAX로 잘리므로
        // timeline.length를 쓰면 상한에서 숫자가 멈춘다. postCount는 잘려도 계속 는다.
        el("span", {}, el("b", {}, formatNumber(account.postCount)), " 게시물"),
        el("span", {}, el("b", {}, formatNumber(account.following)), " 팔로우 중"),
        el("span", {}, el("b", {}, formatNumber(account.followers)), " 팔로워"),
      ),
      el(
        "div",
        { class: "profile__tabs" },
        el("div", { class: "profile__tab profile__tab--active" }, "게시물"),
        el("div", { class: "profile__tab" }, "답글"),
        el("div", { class: "profile__tab" }, "미디어"),
      ),
      (() => {
        // 내 계정 상세의 '게시물' 탭에는 내가 직접 올린 트윗만 노출한다(리트윗 제외).
        const myPosts = visibleTimeline(ctx.store.getState()).filter((t) => !t.isRetweet);
        if (!myPosts.length) {
          return el("div", { class: "empty" }, "아직 게시물이 없어요. 첫 트윗을 등록해보세요!");
        }
        // 윈도잉: 최신 feedShown개만 그리고 남으면 '더 보기'(홈 피드와 같은 카운터를 공유).
        const cards: HTMLElement[] = myPosts.slice(0, ctx.ui.feedShown).map((t) =>
          tweetCard(t, {
            showGain: true,
            ctx,
            onMedia: openMedia(ctx),
            onOpen: () => enterTweetDetail(ctx, t.id),
          }),
        );
        if (myPosts.length > ctx.ui.feedShown) {
          cards.push(
            el(
              "button",
              {
                class: "btn btn--ghost feed__more",
                onclick: () => {
                  ctx.ui.feedShown += FEED_PAGE;
                  ctx.refresh();
                },
              },
              `더 보기 (${formatNumber(myPosts.length - ctx.ui.feedShown)}개 더)`,
            ),
          );
        }
        return el("div", {}, ...cards);
      })(),
    ),
  );
}

/* ===================== 둘러보기 페이지 ===================== */

export function postsPage(ctx: GameContext): HTMLElement {
  return el(
    "section",
    { class: "sns__feed" },
    pageHeader("둘러보기", () => goHome(ctx)),
    ctx.ui.explorePosts.length
      ? el("div", {}, ...ctx.ui.explorePosts.map((t) => reactableCard(ctx, t)))
      : el("div", { class: "empty" }, "게시글이 없어요"),
  );
}

/* ===================== 검색 페이지 ===================== */

export function searchPage(ctx: GameContext): HTMLElement {
  const cats = searchCategories(ctx);
  const active = ctx.ui.searchCategory;

  // 상단: 뒤로가기 + 장식용 검색 입력바(실제 입력은 받지 않음)
  const head = el(
    "header",
    { class: "search-head" },
    el("button", { class: "page-head__back", title: "뒤로", onclick: () => goHome(ctx) }, "←"),
    el(
      "div",
      { class: "search-box search-box--fake", title: "카테고리를 선택해 보세요" },
      icon("search", { size: 16 }),
      el("span", { class: "search-box__ph" }, "검색"),
    ),
  );

  // 스와이프(가로 스크롤) 가능한 카테고리 탭
  const tabs = el(
    "div",
    { class: "search-tabs" },
    ...cats.map((attr) =>
      el(
        "button",
        {
          class:
            "search-tab" +
            (attr === active ? " search-tab--active" : "") +
            (attr === "adult" ? " search-tab--adult" : ""),
          onclick: () => selectSearchCategory(ctx, attr),
        },
        attr === "adult" ? "🔞" : icon(ATTR_ICON[attr], { size: 14 }),
        el("span", {}, ATTRIBUTES[attr].label.replace(/(계|덕)$/, "")),
      ),
    ),
  );
  // 마우스 드래그/휠로도 카테고리 탭을 좌우로 스와이프할 수 있게 한다.
  enableDragScroll(tabs);

  const results = ctx.ui.searchPosts.length
    ? ctx.ui.searchPosts.map((t) => reactableCard(ctx, t))
    : [el("div", { class: "empty" }, "검색 결과가 없어요")];

  return el("section", { class: "sns__feed sns__feed--search" }, head, tabs, ...results);
}

/* ===================== 트윗 상세 페이지 ===================== */

/** 내 트윗 하나를 단독 상세로 연다(멘션을 펼친 상태로). */
export function enterTweetDetail(ctx: GameContext, id: string): void {
  ctx.ui.tweetDetailId = id;
  ctx.ui.snsPage = "tweet";
  ctx.refresh();
}

/** 선택한 내 트윗을 단독으로 크게 보여주고, 걸린 멘션을 모두 표시한다. */
export function tweetDetailPage(ctx: GameContext): HTMLElement {
  const account = getActiveAccount(ctx.store.getState());
  const tweet = account.timeline.find((t) => t.id === ctx.ui.tweetDetailId);
  return el(
    "section",
    { class: "sns__feed" },
    pageHeader("게시물", () => goHome(ctx)),
    tweet
      ? el(
          "div",
          { class: "tweet-detail" },
          tweetCard(tweet, { showGain: true, ctx, onMedia: openMedia(ctx), forceMentions: true }),
        )
      : el("div", { class: "empty" }, "트윗을 찾을 수 없어요"),
  );
}

/* ===================== 쪽지(DM) 페이지 ===================== */

const TONE_LABELS: Record<DMTone, string> = {
  friendly: "친절하게",
  cool: "무심하게",
  bold: "대담하게",
};

function markRead(state: GameState, threadId: string): void {
  const t = getActiveAccount(state).dms.find((x) => x.id === threadId);
  if (t) t.unread = false;
}

function dmThreadList(ctx: GameContext, threads: DMThread[], selected: DMThread | null): HTMLElement {
  if (threads.length === 0) {
    return el(
      "div",
      { class: "dm__list" },
      el("div", { class: "empty" }, "아직 받은 DM이 없어요.\n트윗·팔로우로 팬을 늘려보세요!"),
    );
  }
  return el(
    "div",
    { class: "dm__list" },
    ...threads.map((t) => {
      const last = t.messages[t.messages.length - 1];
      return el(
        "button",
        {
          class: "dm__thread" + (selected?.id === t.id ? " dm__thread--active" : ""),
          onclick: () => {
            ctx.ui.dmThreadId = t.id;
            if (t.unread) ctx.update((s) => markRead(s, t.id));
            else ctx.refresh();
          },
        },
        el(
          "div",
          { class: "dm__thread-top" },
          el("span", { class: "dm__thread-name" }, avatar(t.partnerName, 22), t.partnerName),
          t.unread ? el("span", { class: "dm__dot" }) : null,
        ),
        el("div", { class: "dm__thread-preview" }, last ? last.text : ""),
      );
    }),
  );
}

/** 코스프레 촬영 결과 화면 조각(head + body). 확인 시 다음날로 진행. */
function cosplayResultChildren(ctx: GameContext, result: string): HTMLElement[] {
  return [
    el("div", { class: "modal__head" }, "코스프레 촬영"),
    el(
      "div",
      { class: "modal__body" },
      el("p", { style: "font-size:15px;line-height:1.6;margin:0 0 18px;white-space:pre-wrap" }, result),
      el(
        "div",
        { style: "text-align:right" },
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.closeModal();
              ctx.afterAction("day");
            },
          },
          "확인",
        ),
      ),
    ),
  ];
}

/** 코스프레 전연령 촬영 결과(간단 알림 모달). */
function renderCosplayResultModal(ctx: GameContext, result: string): HTMLElement {
  return el("div", { class: "modal" }, ...cosplayResultChildren(ctx, result));
}

/**
 * 성인모드 코스프레 촬영: 의상 선택(일반/노출).
 * 일반 → 전연령 결과, 노출 → 성인 시나리오 리더. (ctx.update는 onclick에서만 호출)
 */
function renderCosplayCostumeModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  const runGeneral = (): void => {
    let result = "";
    ctx.update((s) => {
      result = resolveCosplayGeneral(s);
    });
    container.replaceChildren(...cosplayResultChildren(ctx, result));
  };

  const runAdult = (): void => {
    const scenario = pickCosplayAdultScenario();
    ctx.openModal((c) =>
      renderScenarioReaderModal(c, {
        headTitle: "코스프레 촬영",
        scenario,
        resolve: (s, idx) => resolveCosplayAdult(s, scenario, idx),
      }),
    );
  };

  const costumeChoice = (label: string, sub: string, onPick: () => void) =>
    el(
      "button",
      { class: "event-choice", onclick: onPick },
      el("div", { style: "font-weight:700" }, label),
      el("div", { class: "compose-hint", style: "margin:2px 0 0" }, sub),
    );

  container.replaceChildren(
    el("div", { class: "modal__head" }, "코스프레 촬영"),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.6;margin:0 0 16px" },
        "촬영 스튜디오에 도착했다. 오늘은 어떤 의상으로 찍을까?",
      ),
      costumeChoice("일반 의상으로 찍는다", "무난하게 캐릭터 코스프레 화보를 남긴다", runGeneral),
      costumeChoice("노출 의상으로 찍는다", "과감한 노출 컨셉으로 촬영한다", runAdult),
    ),
  );
  return container;
}

function dmMeetButton(ctx: GameContext, thread: DMThread): HTMLElement | null {
  // 러닝크루 초대 스레드: 가입 버튼(가입 후엔 표시만)
  if (thread.crew) {
    if (ctx.store.getState().crewJoined) {
      return el("span", { class: "chip", style: "opacity:.6" }, "가입함");
    }
    return el(
      "button",
      {
        class: "btn",
        onclick: () => {
          ctx.update((s) => {
            const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
            if (t) joinCrew(s, t);
          });
          ctx.toast("러닝크루에 가입했어요! 매주 목요일 낮 정기런이 생겼어요 🏃");
        },
      },
      "러닝크루 가입",
    );
  }
  // 취업스터디 초대: 가입 시 매주 월요일 낮 정기 모임(전연령, 성인물 보기 무관)
  if (thread.study) {
    if (ctx.store.getState().studyJoined) {
      return el("span", { class: "chip", style: "opacity:.6" }, "가입함");
    }
    return el(
      "button",
      {
        class: "btn",
        onclick: () => {
          ctx.update((s) => {
            const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
            if (t) joinStudy(s, t);
          });
          ctx.toast("취업스터디 가입! 매주 월요일 낮 모임이 생겼어요 📚");
        },
      },
      "가입하기",
    );
  }
  // 성인 그룹방 초대: 가입 시 매주 토 심야 정기 모임
  if (thread.groupRoom) {
    if (ctx.store.getState().groupRoomJoined) {
      return el("span", { class: "chip", style: "opacity:.6" }, "가입함");
    }
    return el(
      "button",
      {
        class: "btn",
        onclick: () => {
          ctx.update((s) => {
            const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
            if (t) joinGroupRoom(s, t);
          });
          ctx.toast("그룹방에 가입했어요! 매주 토요일 심야 정기 모임이 생겼어요 🔞");
        },
      },
      "그룹방 들어가기",
    );
  }
  // 작가 계약 제안 스레드: 계약 버튼(계약 후엔 표시만)
  if (thread.authorOffer) {
    if (ctx.store.getState().authorContract) {
      return el("span", { class: "chip", style: "opacity:.6" }, "계약함");
    }
    const sign = (adult: boolean) => {
      ctx.update((s) => {
        const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
        if (t) acceptAuthorContract(s, t, adult);
      });
      ctx.toast(
        adult
          ? "성인물 작가 계약! 음란도도 작업 성과에 반영돼요 🔞"
          : "작가 계약 체결! 다음 달부터 매월 월급이 들어와요 ✍️",
      );
    };
    // 성인물 보기가 켜졌으면 작품 유형(전연령/성인물)을 고르게 한다.
    if (ctx.store.getState().adultMode) {
      return el(
        "div",
        { style: "display:flex;gap:6px;flex-wrap:wrap" },
        el("button", { class: "btn", onclick: () => sign(false) }, "전연령으로 계약"),
        el("button", { class: "btn", onclick: () => sign(true) }, "성인물로 계약"),
      );
    }
    return el("button", { class: "btn", onclick: () => sign(false) }, "작가 계약하기");
  }
  // 사바나 여캠 제의 스레드: 계약 버튼(계약 후엔 표시만). 성인물 보기 OFF면 노출 안 함.
  if (thread.savanna && ctx.store.getState().adultMode) {
    if (ctx.store.getState().savannaJoined) {
      return el("span", { class: "chip", style: "opacity:.6" }, "계약함");
    }
    return el(
      "button",
      {
        class: "btn",
        onclick: () => {
          ctx.update((s) => {
            const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
            if (t) joinSavanna(s, t);
          });
          ctx.toast("사바나 여캠 계약 완료! 매일 심야에 방송을 켤 수 있어요 🔴");
        },
      },
      "여캠 계약하기",
    );
  }
  // 란제리 모델 전속 제의 스레드: 계약 버튼(계약 후엔 표시만). 성인물 보기 OFF면 노출 안 함.
  if (thread.lingerie && ctx.store.getState().adultMode) {
    if (ctx.store.getState().lingerieContract) {
      return el("span", { class: "chip", style: "opacity:.6" }, "계약함");
    }
    return el(
      "button",
      {
        class: "btn",
        onclick: () => {
          ctx.update((s) => {
            const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
            if (t) signLingerie(s, t);
          });
          ctx.toast("란제리 모델 전속 계약 완료! 매주 심야 정기 촬영이 잡혔어요 🔞");
        },
      },
      "전속 계약하기",
    );
  }
  // 코스프레 촬영 제의 스레드: 전연령이라 성인물 보기와 무관하게 노출. 반복 촬영(계약 아님).
  if (thread.cosplay) {
    return el(
      "button",
      {
        class: "btn",
        onclick: () => {
          const adult = ctx.store.getState().adultMode;
          if (!adult) {
            // 전연령: 바로 촬영 결과.
            let result = "";
            ctx.update((s) => {
              result = resolveCosplayGeneral(s);
            });
            ctx.openModal((c) => renderCosplayResultModal(c, result));
            return;
          }
          // 성인모드: 의상 선택 후 진행.
          ctx.openModal(renderCosplayCostumeModal);
        },
      },
      "촬영하러 간다",
    );
  }
  // AV배우 제의 스레드: 계약/거절 버튼(처리 후엔 표시만)
  if (thread.avOffer) {
    return el(
      "div",
      { class: "compose-actions", style: "gap:8px" },
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            // 이미 다른 직업(회사/AV)이 있으면 전환 여부를 먼저 묻는다(직업 배타).
            const st = ctx.store.getState();
            if (hasAnyJob(st)) {
              confirmPurchase(ctx, {
                title: "직업 변경",
                message: `현재 '${currentJobLabel(st)}' 직업이 있어요. 'AV배우'로 바꿀까요? (기존 직업은 그만둡니다)`,
                confirmLabel: "바꾼다",
                cancelLabel: "유지",
                onConfirm: () => {
                  ctx.update((s) => switchToAvJob(s, thread.id));
                  ctx.toast("AV배우로 직업을 바꿨어요 🔞");
                },
              });
              return;
            }
            ctx.update((s) => acceptAvJob(s, thread.id));
            ctx.toast("AV배우 계약 완료! 다음 날 심야부터 촬영 업무를 볼 수 있어요 🔞");
          },
        },
        "AV 계약한다",
      ),
      el(
        "button",
        {
          class: "btn btn--ghost",
          onclick: () => {
            ctx.update((s) => declineAvJob(s, thread.id));
            ctx.toast("제의를 거절했어요.");
          },
        },
        "거절한다",
      ),
    );
  }
  if (thread.metOffline) {
    return el("span", { class: "chip", style: "opacity:.6" }, "만난 사이");
  }
  // 상대가 먼저 만남을 제안해야만 만나기가 가능
  if (!thread.wantsToMeet) return null;
  const able = canMeet(ctx.store.getState(), thread);
  return el(
    "button",
    {
      class: "btn" + (able ? "" : " btn--ghost"),
      disabled: !able,
      onclick: () => {
        if (!able) {
          ctx.toast(`행동력이 부족해요 (필요 ${MEETING_ACTION_COST})`);
          return;
        }
        ctx.openModal((c) =>
          thread.ticketKind
            ? renderTicketModal(c, thread.id)
            : thread.motel || thread.genitalSize // 성기 사진 상대 → 성인 관계 이벤트
              ? renderMotelModal(c, thread.id)
              : renderMeetingModal(c, thread.id),
        );
      },
    },
    thread.ticketKind ? "양도받기" : thread.motel || thread.genitalSize ? "만나러 가기" : "만나기",
  );
}

/** 팬 후원 배너(후원 제안이 있고 아직 안 받았을 때) */
function donationBanner(ctx: GameContext, thread: DMThread): HTMLElement | null {
  const d = thread.donation;
  if (!d || d.claimed) return null;
  return el(
    "div",
    { class: "dm-donation" },
    el("span", { class: "dm-donation__text" }, `팬이 후원 ${d.amount.toLocaleString("ko-KR")}원을 보냈어요`),
    el(
      "button",
      {
        class: "btn",
        onclick: () => {
          let got = 0;
          ctx.update((s) => {
            got = claimDonation(s, thread.id);
          });
          if (got > 0) ctx.toast(`후원 ${got.toLocaleString("ko-KR")}원을 받았어요! 💸`);
        },
      },
      "후원 받기",
    ),
  );
}

/**
 * 금발의 신사(진홍안 거래) DM의 답장 영역.
 * 별도 화면 없이 기존 DM UI 안에서 넘겨줌/거절을 고른다.
 * ⚠️ 분기 상태는 스레드가 아니라 state.auction.eyeDeal이다 — 처리 후엔 결과만 표시한다.
 */
function eyeDealReplies(ctx: GameContext): HTMLElement {
  const deal = ctx.store.getState().auction.eyeDeal;

  // 이미 답한 뒤(또는 도난 후)에는 스레드가 기록으로만 남는다.
  if (deal !== "offered") {
    const note =
      deal === "given"
        ? "진홍안을 넘겼다."
        : deal === "stolen"
          ? "거절했고, 진홍안은 사라졌다."
          : deal === "refused"
            ? "제안을 거절했다."
            : "";
    return el(
      "div",
      { class: "dm__replies" },
      el("span", { class: "chip", style: "opacity:.6" }, note || "거래가 끝난 대화"),
    );
  }

  const answer = (accept: boolean): void => {
    let r: EyeDealResult | null = null;
    ctx.update((s) => {
      r = resolveEyeDeal(s, accept);
    });
    // ctx.update 콜백 안에서 대입하므로 TS의 흐름 분석이 r을 null로 좁힌다 — 단언으로 되돌린다.
    const result = r as EyeDealResult | null;
    if (!result) return; // 이미 처리된 제안(중복 클릭)
    if (result.accepted) {
      ctx.openModal((c) => renderEyeDealResultModal(c, result));
    } else {
      ctx.toast("제안을 거절했다. 진홍안은 그대로 내 것이다.");
    }
  };

  return el(
    "div",
    { class: "dm__replies" },
    el(
      "div",
      { class: "dm__send", style: "gap:8px" },
      el(
        "button",
        { class: "btn btn--ghost", style: "flex:1", onclick: () => answer(false) },
        "넘겨주지 않는다",
      ),
      el("button", { class: "btn", style: "flex:1", onclick: () => answer(true) }, "넘겨준다"),
    ),
  );
}

/**
 * 터커(연구실 조수 부탁) DM의 답장 영역.
 * eyeDealReplies와 같은 구조 — 별도 화면 없이 기존 DM UI 안에서 수락/거절을 고른다.
 * ⚠️ 분기 상태는 스레드가 아니라 state.lab.offer다 — 응답 후엔 결과 칩만 남긴다.
 */
function labOfferReplies(ctx: GameContext): HTMLElement {
  const offer = ctx.store.getState().lab.offer;

  // 이미 답한 뒤에는 스레드가 기록으로만 남는다.
  if (offer !== "offered") {
    const note =
      offer === "accepted"
        ? "부탁을 수락했다. 평일 낮은 연구실이다."
        : offer === "refused"
          ? "정중히 거절했다."
          : "";
    return el(
      "div",
      { class: "dm__replies" },
      el("span", { class: "chip", style: "opacity:.6" }, note || "끝난 대화"),
    );
  }

  const answer = (accept: boolean): void => {
    let ok = false;
    ctx.update((s) => {
      ok = resolveLabOffer(s, accept);
    });
    if (!ok) return; // 이미 처리된 제안(중복 클릭)
    ctx.toast(accept ? "터커의 부탁을 수락했다." : "터커의 부탁을 거절했다.");
  };

  return el(
    "div",
    { class: "dm__replies" },
    el(
      "div",
      { class: "dm__send", style: "gap:8px" },
      el(
        "button",
        { class: "btn btn--ghost", style: "flex:1", onclick: () => answer(false) },
        "거절한다",
      ),
      el("button", { class: "btn", style: "flex:1", onclick: () => answer(true) }, "돕기로 한다"),
    ),
  );
}

/** 서사 한 줄 + 닫기 버튼짜리 결과 모달(심리테스트 피싱 결과 등에 재사용). */
function simpleResultModal(ctx: GameContext, title: string, message: string): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el("div", { class: "modal__head" }, el("span", { class: "modal__head-title" }, title)),
    el(
      "div",
      { class: "modal__body" },
      el("p", { style: "font-size:15px;line-height:1.8;margin:0 0 16px" }, message),
      el("button", { class: "btn", onclick: () => ctx.closeModal() }, "닫기"),
    ),
  );
}

/** 불법 스탯 부스트상 뒷거래: 스탯 하나를 골라 30만원에 산다(성공↑ or 사기). */
function openBoostDealModal(ctx: GameContext): void {
  ctx.openModal((c) => {
    const container = el("div", { class: "modal" });
    const affordable = c.store.getState().money >= BOOST_COST;

    function showResult(message: string): void {
      container.replaceChildren(
        el("div", { class: "modal__head" }, el("span", { class: "modal__head-title" }, "뒷거래 결과")),
        el(
          "div",
          { class: "modal__body" },
          el("p", { style: "font-size:15px;line-height:1.8;margin:0 0 16px" }, message),
          el("button", { class: "btn", onclick: () => c.closeModal() }, "닫기"),
        ),
      );
    }

    const statButtons = SKILL_STAT_IDS.map((stat) =>
      el(
        "button",
        {
          class: "event-choice",
          disabled: !affordable,
          onclick: () => {
            let message = "";
            c.update((s) => {
              message = resolveBoostDeal(s, stat).message; // 비용 지불·스탯/사기 판정
              consumeBoostLink(s); // 재거래 불가(스레드 제거)
            });
            showResult(message);
          },
        },
        el("b", {}, SKILL_STATS[stat].label),
        el("div", { class: "sleep-choice__desc" }, `${BOOST_COST.toLocaleString("ko-KR")}원`),
      ),
    );

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "뒷거래 — 능력 고르기"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0;font-size:14px" },
          affordable
            ? "어떤 능력을 올릴까? 한 번에 30만원, 환불은 없다."
            : `소지금이 부족하다. 거래엔 ${BOOST_COST.toLocaleString("ko-KR")}원이 필요하다.`,
        ),
        ...statButtons,
      ),
    );
    return container;
  });
}

function dmConversation(ctx: GameContext, thread: DMThread | null): HTMLElement {
  if (!thread) {
    return el("div", { class: "dm__convo" }, el("div", { class: "empty" }, "대화를 선택하세요."));
  }

  const bubbles = thread.messages.map((m) => {
    // 성기 사진: 모자이크 타일 + 크기 라벨(노골적 이미지 없이 자리만)
    if (m.photoSize) {
      return el(
        "div",
        { class: "dm__bubble dm__bubble--them dm__bubble--photo" },
        el(
          "div",
          { class: "dm-photo", title: "성기 사진" },
          el("span", { class: "dm-photo__mosaic" }, "🔞"),
          el("span", { class: "dm-photo__cap" }, `크기: ${DICK_SIZE_LABELS[m.photoSize]}`),
        ),
      );
    }
    return el(
      "div",
      { class: "dm__bubble dm__bubble--" + (m.from === "me" ? "me" : "them") },
      m.text,
    );
  });

  const tones: DMTone[] = ["friendly", "cool"];
  if (canUseBoldTone(ctx.store.getState())) tones.push("bold");

  const toneButtons = tones.map((tone) =>
    el(
      "button",
      {
        class: "chip",
        onclick: () => {
          let delta = 0;
          ctx.update((s) => {
            const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
            if (t) delta = replyDM(s, t, tone).followerDelta;
          });
          if (delta > 0) ctx.toast(`훈훈한 대화! 팔로워 +${delta}`);
        },
      },
      TONE_LABELS[tone],
    ),
  );

  const input = el("input", {
    class: "dm__input",
    type: "text",
    placeholder: "직접 답장 입력...",
  }) as HTMLInputElement;

  const sendCustom = () => {
    const text = input.value.trim();
    if (!text) return;
    ctx.update((s) => {
      const t = getActiveAccount(s).dms.find((x) => x.id === thread.id);
      if (t) sendCustomDM(s, t, text);
    });
    input.value = "";
  };
  input.addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter") sendCustom();
  });

  // 링크 DM(소원 가게·푸시타임)·진홍안 거래·터커 조수 부탁 DM: 답장 대신 전용 버튼만.
  const repliesSection = thread.eyeDeal
    ? eyeDealReplies(ctx)
    : thread.labOffer
    ? labOfferReplies(ctx)
    : thread.wishLink
    ? el(
        "div",
        { class: "dm__replies" },
        el(
          "button",
          {
            class: "btn",
            style: "width:100%",
            onclick: () => {
              ctx.update((s) => consumeWishLink(s));
              ctx.ui.wishOptions = rollWishOptions();
              ctx.ui.wishSiteOpen = true;
              ctx.refresh();
            },
          },
          "🔗 wish-shop.moon 여기로 들어가기",
        ),
      )
    : thread.pushLink
      ? el(
          "div",
          { class: "dm__replies" },
          el(
            "button",
            {
              class: "btn",
              style: "width:100%",
              onclick: () => {
                ctx.update((s) => {
                  s.pushtimeUnlocked = true;
                  consumePushLink(s);
                });
                ctx.ui.activeTab = "pushtime";
                ctx.toast("푸시타임이 브라우저에 추가됐어요 🔞");
                ctx.refresh();
              },
            },
            "🔗 pushtime.xyz 열기",
          ),
        )
      : thread.boostLink
      ? el(
          "div",
          { class: "dm__replies" },
          el(
            "button",
            {
              class: "btn",
              style: "width:100%",
              onclick: () => openBoostDealModal(ctx),
            },
            "🔗 뒷거래 하러 가기",
          ),
        )
      : thread.psychoLink
      ? el(
          "div",
          { class: "dm__replies" },
          el(
            "button",
            {
              class: "btn",
              style: "width:100%",
              onclick: () => {
                let msg = "";
                ctx.update((s) => {
                  msg = resolvePsychoTest(s); // 링크 소비·스팸 유입은 함수가 처리
                });
                ctx.toast("개인정보가 털린 듯…");
                if (msg) ctx.openModal(() => simpleResultModal(ctx, "결과 확인", msg));
              },
            },
            "🔗 결과 보기",
          ),
        )
      : el(
        "div",
        { class: "dm__replies" },
        el("div", { class: "chip-row", style: "margin:0 0 8px" }, ...toneButtons),
        el(
          "div",
          { class: "dm__send" },
          input,
          el("button", { class: "btn", onclick: sendCustom }, "전송"),
        ),
      );

  // 만남/가입/계약 등 액션 버튼은 헤더가 아니라 채팅창 안(메시지 아래)에 배치한다.
  const meetAction = dmMeetButton(ctx, thread);

  return el(
    "div",
    { class: "dm__convo" },
    el(
      "div",
      { class: "dm__convo-head" },
      el(
        "div",
        {},
        `${thread.partnerName} `,
        el("span", { class: "dm__convo-handle" }, `@${thread.partnerHandle}`),
      ),
    ),
    donationBanner(ctx, thread),
    el(
      "div",
      { class: "dm__messages" },
      ...bubbles,
      meetAction ? el("div", { class: "dm__meet-cta" }, meetAction) : null,
    ),
    repliesSection,
  );
}

export function dmPage(ctx: GameContext): HTMLElement {
  // 성인물 보기 OFF면 성인 DM 스레드는 목록·대화에서 제외한다.
  const dms = visibleDms(ctx.store.getState());
  const selected = dms.find((t) => t.id === ctx.ui.dmThreadId) ?? null;
  return el(
    "section",
    { class: "sns__feed sns__feed--dm" },
    pageHeader("쪽지", () => goHome(ctx)),
    el("div", { class: "dm dm--page" }, dmThreadList(ctx, dms, selected), dmConversation(ctx, selected)),
  );
}

/* ===================== 광고 페이지 ===================== */

export function adPage(ctx: GameContext): HTMLElement {
  const avail = canWatchAd(ctx.store.getState());
  const watchBtn = el(
    "button",
    {
      class: "btn",
      disabled: !avail,
      onclick: () => {
        if (!avail) return;
        let reward = 0;
        ctx.update((s) => {
          reward = watchAd(s);
        });
        ctx.toast(`광고 시청 +${reward.toLocaleString("ko-KR")}원`);
        ctx.afterAction("ad");
      },
    },
    avail ? "광고 보고 보상 받기" : "오늘은 이미 시청함",
  );

  return el(
    "section",
    { class: "sns__feed" },
    pageHeader("광고 보기", () => goHome(ctx)),
    el(
      "div",
      { class: "ad-page" },
      el("div", { class: "ad-page__screen" }, icon("megaphone", { size: 48 })),
      el("div", { class: "ad-page__title" }, "스폰서 광고"),
      el(
        "div",
        { class: "ad-page__desc" },
        avail
          ? "짧은 광고를 보면 수익을 얻어요. (하루 1회)"
          : "오늘 광고는 이미 봤어요. 내일 다시 시청할 수 있어요.",
      ),
      watchBtn,
    ),
  );
}
