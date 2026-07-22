import type { GameContext } from "@/ui/context";
import { FEED_PAGE } from "@/ui/context";
import type { AttributeId, Tweet } from "@/core/types";
import { FOLLOWER_GOAL, getActiveAccount, isMentalLow, isSuspended, visibleTimeline } from "@/core/state";
import { canWatchAd } from "@/systems/ads";
import { claimAdReward, ensureAdTweetsSeeded, unlockAppTab } from "@/systems/adTweets";
import { unreadDMCount } from "@/systems/dm";
import { followingFeedTweets } from "@/systems/exploreSystem";
import { totalFollowers } from "@/systems/economy";
import { maxPostSlots } from "@/systems/followers";
import { remainingPostSlots } from "@/systems/eggs";
import { ATTRIBUTES } from "@/data/attributes";
import { getTrendingCategories } from "@/data/trends";
import { el, formatNumber } from "@/utils/dom";
import { tweetCard } from "@/ui/components";
import { icon, avatar, ATTR_ICON, type IconName } from "@/ui/icons";
import { interleaveFeed } from "./feedLayout";
import { openComposeModal } from "@/ui/postLimitModal";
import { renderAccountModal } from "./accountModal";
import { renderMediaModal } from "@/ui/mediaModal";
import { renderAdultWarnModal } from "@/ui/adultWarnModal";
import { renderTchinsoModal } from "@/ui/tchinsoModal";
import { canPostTchinso } from "@/systems/tchin";
import { TCHINSO_COOLDOWN_DAYS } from "@/data/tchinso";
import {
  adPage,
  dmPage,
  enterAd,
  enterDM,
  enterExplore,
  enterPosts,
  enterSearch,
  enterTweetDetail,
  explorePage,
  goHome,
  mePage,
  postsPage,
  reactableCard,
  searchPage,
  tweetDetailPage,
} from "./snsPages";

/** 공식 X 로고(인라인 SVG) */
const X_LOGO =
  `<svg viewBox="0 0 24 24" width="27" height="27" fill="currentColor" aria-hidden="true">` +
  `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68` +
  `l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

interface NavItemOpts {
  active?: boolean;
  badge?: number;
  disabled?: boolean;
  onclick: () => void;
}

/** 좌측 네비게이션 항목(아이콘 + 라벨) */
function navItem(iconName: IconName, label: string, opts: NavItemOpts): HTMLElement {
  return el(
    "button",
    {
      class:
        "nav-item" +
        (opts.active ? " nav-item--active" : "") +
        (opts.disabled ? " nav-item--disabled" : ""),
      title: label,
      onclick: opts.onclick,
    },
    el("span", { class: "nav-item__icon" }, icon(iconName, { size: 20 })),
    el("span", { class: "nav-item__label" }, label),
    opts.badge && opts.badge > 0
      ? el("span", { class: "nav-item__badge" }, String(opts.badge))
      : null,
  );
}

/**
 * SNS(트위터/X 유사) 메인 화면.
 * 좌: X 네비게이션 / 중앙: 타임라인 / 우: 트렌드·팔로우 추천.
 */
export function renderSnsView(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const account = getActiveAccount(s);

  // 쪽지 페이지: 오른쪽 트렌드 대신 대화창이 그 영역까지 넓게 차지한다.
  // 중앙 폭을 850으로 키워(총 폭·네비 위치는 3열과 동일) 우측까지 채운다.
  const isDM = ctx.ui.snsPage === "dm";

  return el(
    "div",
    { class: "sns" + (isDM ? " sns--dm" : "") },
    renderNav(),
    renderFeed(),
    isDM ? null : renderTrends(),
  );

  // ===== 좌측 네비게이션 =====
  function renderNav(): HTMLElement {
    const adAvailable = canWatchAd(s);
    const unread = unreadDMCount(s);
    const page = ctx.ui.snsPage;

    return el(
      "nav",
      { class: "sns__nav" },
      el("div", { class: "sns__brand", html: X_LOGO }),
      navItem("grid", "홈", { active: page === "home", onclick: () => goHome(ctx) }),
      navItem("search", "탐색하기", {
        active: page === "explore",
        onclick: () => enterExplore(ctx),
      }),
      navItem("article", "둘러보기", {
        active: page === "posts",
        onclick: () => enterPosts(ctx),
      }),
      navItem("mail", "쪽지", {
        active: page === "dm",
        badge: unread,
        onclick: () => enterDM(ctx),
      }),
      navItem("megaphone", adAvailable ? "광고 보기" : "광고 (내일)", {
        active: page === "ad",
        onclick: () => enterAd(ctx),
      }),
      el(
        "button",
        { class: "sns__post", onclick: () => openComposeModal(ctx) },
        icon("pen", { size: 18, className: "sns__post-icon" }),
        el("span", { class: "sns__post-label" }, "게시하기"),
      ),
      // 성인물 해제 토글
      el(
        "div",
        { class: "nav-toggle" },
        el(
          "span",
          { class: "nav-toggle__label" },
          icon("shield", { size: 16 }),
          el("span", { class: "nav-toggle__text" }, "성인물 보기"),
        ),
        el("button", {
          class: "toggle__switch" + (s.adultMode ? " toggle__switch--on" : ""),
          "aria-label": "성인물 보기",
          onclick: () => {
            const wasOn = s.adultMode;
            // 끌 때는 확인 없이 바로. 켤 때만 경고 팝업을 거친다.
            if (wasOn) {
              ctx.update((st) => {
                st.adultMode = false;
              });
              ctx.toast("성인물 보기 OFF");
              return;
            }
            ctx.openModal((c) =>
              renderAdultWarnModal(c, () => {
                ctx.update((st) => {
                  st.adultMode = true;
                });
                ctx.toast("성인물 보기 ON");
              }),
            );
          },
        }),
      ),
      // 강압/범죄 필터 — 성인물 보기가 켜졌을 때만 노출되는 하위 설정.
      // 켜면 비합의(납치·결박·강제) 성인 상황이 후보에서 빠진다(도난 등 도덕성 상황은 무관).
      s.adultMode
        ? el(
            "div",
            { class: "nav-toggle", style: "padding-left:20px;opacity:.9" },
            el(
              "span",
              { class: "nav-toggle__label" },
              el("span", { class: "nav-toggle__text", style: "font-size:12px" }, "강압·범죄 안 보기"),
            ),
            el("button", {
              class: "toggle__switch" + (s.adultNoCoercion ? " toggle__switch--on" : ""),
              "aria-label": "강압·범죄 성인물 안 보기",
              onclick: () => {
                const wasFiltering = s.adultNoCoercion;
                ctx.update((st) => {
                  st.adultNoCoercion = !st.adultNoCoercion;
                });
                ctx.toast(wasFiltering ? "강압·범죄 성인물 표시" : "강압·범죄 성인물 숨김");
              },
            }),
          )
        : null,
      // 하단 내 계정 pill (클릭 시 내 프로필, 팔로워 수 상시 표시)
      el(
        "button",
        {
          class: "nav-account" + (page === "me" ? " nav-account--active" : ""),
          title: "내 프로필",
          onclick: () => {
            ctx.ui.snsPage = "me";
            ctx.refresh();
          },
        },
        avatar(account.name, 40),
        el(
          "div",
          { class: "nav-account__info" },
          el("div", { class: "nav-account__name" }, account.name),
          el("div", { class: "nav-account__handle" }, `@${account.handle}`),
          el(
            "div",
            { class: "nav-account__followers" },
            el("b", {}, formatNumber(totalFollowers(s))),
            " 팔로워",
          ),
          account.tchins.length > 0
            ? el(
                "div",
                {
                  class: "nav-account__tchin",
                  title: account.tchins.map((h) => `@${h}`).join(", "),
                },
                `🤝 트친 ${account.tchins.length}`,
              )
            : null,
        ),
        el(
          "span",
          {
            class: "nav-account__chev",
            title: "계정 전환/관리",
            onclick: (e: Event) => {
              e.stopPropagation();
              ctx.openModal(renderAccountModal);
            },
          },
          icon("chevron", { size: 18 }),
        ),
      ),
    );
  }

  // ===== 중앙 피드(페이지별 전환) =====
  function renderFeed(): HTMLElement {
    switch (ctx.ui.snsPage) {
      case "explore":
        return explorePage(ctx);
      case "posts":
        return postsPage(ctx);
      case "search":
        return searchPage(ctx);
      case "tweet":
        return tweetDetailPage(ctx);
      case "dm":
        return dmPage(ctx);
      case "ad":
        return adPage(ctx);
      case "me":
        return mePage(ctx);
      default:
        return renderHomeFeed();
    }
  }

  // ===== 홈 타임라인 =====
  function renderHomeFeed(): HTMLElement {
    const goalReached = account.followers >= FOLLOWER_GOAL;
    const mentalLow = isMentalLow(s.resources.mental);
    const following = ctx.ui.homeTab === "following";

    const tab = (label: string, active: boolean, onclick: () => void) =>
      el(
        "div",
        { class: "feed__tab" + (active ? " feed__tab--active" : ""), onclick },
        el("span", { class: "feed__tab-label" }, label),
      );

    const header = el(
      "header",
      { class: "feed__header" },
      el("div", { class: "feed__title" }, "홈"),
      el(
        "div",
        { class: "feed__tabs" },
        tab("추천", !following, () => {
          ctx.ui.homeTab = "recommend";
          ctx.refresh();
        }),
        tab("팔로잉", following, () => {
          ctx.ui.homeTab = "following";
          ctx.ui.followingFeed = followingFeedTweets(s, 5); // 팔로우한 계정 트윗 5개 랜덤
          ctx.refresh();
        }),
      ),
    );

    const composer = el(
      "div",
      { class: "composer" },
      avatar(account.name, 40),
      el(
        "button",
        { class: "composer__fake", onclick: () => openComposeModal(ctx) },
        mentalLow ? "우울해서 밝은 글이 안 써진다..." : "무슨 일이 일어나고 있나요?",
      ),
      el(
        "div",
        { class: "compose-slots", style: "margin:0" },
        `오늘 게시 ${maxPostSlots(account.followers) - remainingPostSlots(s)}/${maxPostSlots(account.followers)}`,
      ),
      el(
        "button",
        { class: "composer__send", onclick: () => openComposeModal(ctx) },
        "게시하기",
      ),
    );

    // 트친소(트친 소개) 진입 — 주 1회 쿨다운. 판정은 systems/tchin(canPostTchinso)이 한다.
    const tchinsoReady = canPostTchinso(s);
    const tchinsoDaysLeft = Math.max(0, TCHINSO_COOLDOWN_DAYS - (s.day - account.lastTchinsoDay));
    const tchinsoBar = el(
      "div",
      { class: "tchinso-entry" },
      el(
        "button",
        {
          class: "btn btn--ghost",
          disabled: !tchinsoReady,
          onclick: () => tchinsoReady && ctx.openModal(renderTchinsoModal),
        },
        "🤝 트친소 올리기",
      ),
      !tchinsoReady
        ? el("span", { class: "tchinso-entry__hint" }, `${tchinsoDaysLeft}일 후 가능`)
        : null,
    );

    // 팔로잉 탭: 팔로우한 계정 트윗 5개. 추천 탭: 내 타임라인.
    let body: (HTMLElement | null)[];
    if (following) {
      body = ctx.ui.followingFeed.length
        ? ctx.ui.followingFeed.map((t) => reactableCard(ctx, t))
        : [
            el(
              "div",
              { class: "empty" },
              account.followingAccounts.length
                ? "표시할 트윗이 없어요."
                : "아직 팔로우한 계정이 없어요.\n탐색에서 계정을 팔로우해보세요!",
            ),
          ];
    } else {
      // 추천탭: 최초 렌더 시 광고 트윗이 비어 있으면 오늘자 2개 시드(day1 대응).
      // dispatch는 마이크로태스크로 렌더를 예약하므로(동기 재진입 없음),
      // 비어 있을 때만 update하면 무한 렌더 없이 같은 패스에서 바로 노출된다.
      if (s.adTweets.length === 0) {
        ctx.update((st) => ensureAdTweetsSeeded(st));
      }
      const adCards = s.adTweets.map((t) => adTweetCard(ctx, t));
      // 성인물 보기 OFF면 내가 쓴 성인 트윗은 타임라인에서 가린다.
      const myTimeline = visibleTimeline(s);
      if (myTimeline.length === 0) {
        // 타임라인이 비었으면(첫날) 안내 문구를 그대로 맨 위에 두고, 광고는 그 아래에.
        body = [el("div", { class: "empty" }, "아직 트윗이 없어요. 첫 트윗을 등록해보세요!"), ...adCards];
      } else {
        // 윈도잉: 긴 타임라인을 전량 렌더하면 전체 재렌더마다 카드 수백 개를 다시 그려 렉이 낀다.
        // 최신 feedShown개만 그리고, 남으면 '더 보기'로 늘린다(최신이 앞이라 새 트윗은 항상 보인다).
        const shown = myTimeline.slice(0, ctx.ui.feedShown);
        const timelineCards = shown.map((t) =>
          tweetCard(t, {
            showGain: true,
            ctx,
            onMedia: (mt) => ctx.openModal((c) => renderMediaModal(c, mt)),
            onOpen: () => enterTweetDetail(ctx, t.id),
          }),
        );
        // 내 트윗 사이사이에 광고를 규칙적으로 끼운다(첫 카드는 항상 내 최신 트윗).
        // 남는 광고는 피드 끝에. 배치 규칙·간격 근거는 feedLayout.ts 참고.
        body = interleaveFeed<HTMLElement>(timelineCards, adCards);
        if (myTimeline.length > ctx.ui.feedShown) {
          body.push(
            el(
              "button",
              {
                class: "btn btn--ghost feed__more",
                onclick: () => {
                  ctx.ui.feedShown += FEED_PAGE;
                  ctx.refresh();
                },
              },
              `더 보기 (${formatNumber(myTimeline.length - ctx.ui.feedShown)}개 더)`,
            ),
          );
        }
      }
    }

    const suspended = isSuspended(account, s.day);
    const banBanner = suspended
      ? el(
          "div",
          { class: "ban-banner" },
          `계정 정지 중 — 게시·활동이 제한됩니다. (해제까지 ${account.suspendedUntilDay - s.day}일)`,
        )
      : null;

    return el(
      "section",
      { class: "sns__feed" },
      goalReached
        ? el("div", { class: "goal-banner" }, "목표 달성! 팔로워 100만명 돌파!")
        : null,
      banBanner,
      header,
      composer,
      tchinsoBar,
      ...body,
    );
  }

  // ===== 우측 트렌드 / 팔로우 추천 =====
  function renderTrends(): HTMLElement {
    // 오늘의 인기 카테고리 3종(매일 랜덤 갱신). 클릭 시 해당 카테고리로 바로 작성.
    const hotCategories = getTrendingCategories(s.day);

    const trendRows = hotCategories.map((a) =>
      el(
        "div",
        { class: "trend-row trend-row--static" },
        el(
          "div",
          { class: "trend-row__body" },
          el(
            "div",
            { class: "trend-row__tag" },
            icon(ATTR_ICON[a], { size: 14 }),
            ` #${ATTRIBUTES[a].label.replace(/계$/, "")}`,
          ),
        ),
      ),
    );

    // 팔로우 추천: 내 트윗에 멘션을 남긴 다른 계정들에서 뽑는다.
    const seen = new Set<string>([account.handle]);
    const suggestions: {
      name: string;
      handle: string;
      attribute: AttributeId;
      isAdult: boolean;
    }[] = [];
    const addSuggestion = (u: {
      authorName: string;
      authorHandle: string;
      attribute: AttributeId;
    }) => {
      if (seen.has(u.authorHandle) || suggestions.length >= 3) return;
      seen.add(u.authorHandle);
      suggestions.push({
        name: u.authorName,
        handle: u.authorHandle,
        attribute: u.attribute,
        isAdult: false,
      });
    };
    for (const t of account.timeline) {
      if (!seen.has(t.authorHandle)) {
        addSuggestion(t);
      }
      for (const r of t.replies ?? []) addSuggestion(r);
      if (suggestions.length >= 3) break;
    }

    const followRows = suggestions.map((u) =>
      el(
        "button",
        {
          class: "follow-row",
          onclick: () => enterExplore(ctx),
        },
        avatar(u.name, 36),
        el(
          "div",
          { class: "follow-row__info" },
          el("div", { class: "follow-row__name" }, u.name),
          el("div", { class: "follow-row__handle" }, `@${u.handle}`),
        ),
        el("span", { class: "follow-row__btn" }, "팔로우"),
      ),
    );

    // 검색 페이지에선 이미 상단에 검색바가 있으니 오른쪽 검색박스는 숨긴다.
    const searchBox =
      ctx.ui.snsPage === "search"
        ? null
        : el(
            "div",
            { class: "trends-search" },
            el(
              "button",
              {
                class: "trends-search__box",
                onclick: () => enterSearch(ctx),
              },
              icon("search", { size: 16 }),
              "검색",
            ),
          );

    return el(
      "aside",
      { class: "sns__trends" },
      searchBox,
      el(
        "div",
        { class: "trends-card" },
        el("div", { class: "trends-card__title" }, "무슨 일이 일어나고 있나요?"),
        el("div", { class: "trends-card__sub" }, "오늘의 인기 카테고리"),
        ...trendRows,
      ),
      el(
        "div",
        { class: "trends-card" },
        el("div", { class: "trends-card__title" }, "팔로우 추천"),
        ...(followRows.length
          ? followRows
          : [el("div", { class: "trend-row__cat", style: "padding:10px 16px" }, "탐색에서 새 계정을 찾아보세요")]),
      ),
    );
  }
}

/** 앱 id → 사람이 읽는 라벨 */
const APP_LABEL: Record<"youtube" | "medibooks" | "steam", string> = {
  youtube: "너튜브",
  medibooks: "미디북스",
  steam: "증기",
};

/**
 * 추천탭 광고 트윗 카드.
 * - `tweetCard`를 재사용하되 미디어 클릭을 적립(claimAdReward)으로 오버라이드한다.
 * - "광고" 라벨을 헤더에 붙이고, 앱 홍보 광고(adPromo.app)면 "바로가기" 버튼으로 탭을 해금한다.
 */
function adTweetCard(ctx: GameContext, tweet: Tweet): HTMLElement {
  const app = tweet.adPromo?.app;
  const claimed = tweet.adPromo?.claimed ?? false;

  const card = tweetCard(tweet, {
    ctx,
    // 미디어 클릭 = 광고 보상 적립(미디어 모달 대신). 트윗당 1회.
    onMedia: () => {
      let got = 0;
      ctx.update((st) => {
        got = claimAdReward(st, tweet.id);
      });
      ctx.toast(got > 0 ? `광고 보상 +${formatNumber(got)}원` : "이미 받은 광고예요");
      ctx.refresh();
    },
    // 광고 카드는 상세로 열지 않는다.
    onOpen: undefined,
  });
  card.classList.add("ad-tweet");
  if (claimed) card.classList.add("ad-tweet--claimed");

  const body = card.querySelector<HTMLElement>(".tweet__body");

  // "광고"(적립 시 "광고 · 적립완료") 라벨을 헤더 끝에 붙인다.
  const label = el(
    "span",
    { class: "ad-tweet__label" },
    claimed ? "광고 · 적립완료" : "광고",
  );
  body?.querySelector(".tweet__head")?.appendChild(label);

  // 앱 홍보 광고: "바로가기"로 해당 탭 해금 + 이동.
  if (app) {
    const appLabel = APP_LABEL[app];
    const cta = el(
      "button",
      {
        class: "ad-tweet__cta",
        onclick: (e: Event) => {
          e.stopPropagation();
          ctx.update((st) => unlockAppTab(st, app));
          ctx.ui.activeTab = app;
          ctx.toast(`${appLabel}이 브라우저에 추가됐어요`);
          ctx.refresh();
        },
      },
      el("span", {}, `${appLabel} 바로가기`),
      icon("chevron", { size: 16 }),
    );
    body?.appendChild(cta);
  }

  return card;
}
