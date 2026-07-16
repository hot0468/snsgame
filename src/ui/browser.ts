import type { GameContext } from "./context";
import type { BrowserTabId } from "./context";
import { getActiveAccount } from "@/core/state";
import { el } from "@/utils/dom";
import { renderSnsView } from "./sns/snsView";
import { renderStatusDock } from "./statusPopup";
import { renderPortal } from "./portal";
import { renderYoutube } from "./youtube";
import { renderMediBooks } from "./medibooks";
import { renderSteam } from "./steam";
import { renderHousing } from "./housing";
import { renderMail } from "./mail";
import { renderGrocery } from "./grocery";
import { renderPushtime } from "./pushtime";
import { renderYabam } from "./yabam";
import { renderStocks } from "./stocks";
import { renderShop } from "./shop";
import { renderWishSite } from "./wishSite";
import { renderGoblinShop } from "./goblinShop";
import { renderOnet } from "./onet";
import { renderAuction } from "./auction";
import { renderDartpin } from "./dartpin";
import { DARTPIN_URL } from "@/systems/dartpin";
import { icon } from "./icons";

interface TabDef {
  id: BrowserTabId;
  label: string;
  url: string;
}

const TABS: TabDef[] = [
  { id: "sns", label: "검색 - 검색 / X", url: "x.com/search" },
  { id: "blank", label: "네이놈", url: "naenom.com" },
  { id: "mail", label: "피메일", url: "pmail.com" },
];

/** 해금 시에만 노출되는 탭 */
// 너튜브·미디북스는 게임 시작 시 없고, 추천탭 광고의 '바로가기'로 해금된다(네이놈 뒤에 삽입).
const YOUTUBE_TAB: TabDef = { id: "youtube", label: "너튜브", url: "nutube.com" };
const MEDIBOOKS_TAB: TabDef = { id: "medibooks", label: "미디북스", url: "medibooks.com" };
const STEAM_TAB: TabDef = { id: "steam", label: "증기", url: "jeunggi.store" };
// 다트 핀은 둘러보기 피드의 '링크 달린 트윗'(광고 아님)을 눌러 해금된다.
// 게시판이 매일 갱신되고 힌트가 드물게 섞이므로 단발 사이트가 아니라 상시 탭이다.
const DARTPIN_TAB: TabDef = { id: "dartpin", label: "다트 핀", url: DARTPIN_URL };
const PUSHTIME_TAB: TabDef = { id: "pushtime", label: "푸시타임", url: "pushtime.xyz" };
const YABAM_TAB: TabDef = { id: "yabam", label: "야밤", url: "yabam.click" };

/** 증권/쇼핑/남의방/마켓걸리버는 상단 탭이 아니라 네이놈 포털에서 진입한다. url바 표시·activeDef 조회에 사용. */
const SUBPAGES: TabDef[] = [
  { id: "stocks", label: "증권", url: "hanaro-invest.com" },
  { id: "shop", label: "쇼핑", url: "coupang.com" },
  { id: "housing", label: "남의방", url: "namroom.com" },
  { id: "grocery", label: "마켓걸리버", url: "marketgulliver.com" },
];

/** 탭/주소창에 쓰는 사이트 파비콘(브랜드 마크) SVG */
function faviconHtml(id: BrowserTabId): string {
  switch (id) {
    case "sns": // X(트위터)
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" fill="#000" aria-hidden="true">` +
        `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68` +
        `l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`
      );
    case "youtube": // 너튜브
      return (
        `<svg viewBox="0 0 24 24" width="17" height="17" aria-hidden="true">` +
        `<rect x="2" y="5" width="20" height="14" rx="4" fill="#ff0033"/>` +
        `<path d="M10 8.5 16.5 12 10 15.5z" fill="#fff"/></svg>`
      );
    case "blank": // 네이놈(NAVER 풍)
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#03c75a"/>` +
        `<path d="M8 7h3.1l2.9 4.3V7H17v10h-3.1l-2.9-4.3V17H8z" fill="#fff"/></svg>`
      );
    case "medibooks": // 미디북스(전자책)
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#1f8ce6"/>` +
        `<path d="M6 6h5.5v12H6z" fill="#fff" opacity="0.9"/>` +
        `<path d="M12.5 6H18v12h-5.5z" fill="#fff"/></svg>`
      );
    case "steam": // 증기(스팀 패러디) — 다크블루 톤 마크
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#1b2838"/>` +
        `<circle cx="10" cy="10" r="4.2" fill="none" stroke="#66c0f4" stroke-width="1.6"/>` +
        `<circle cx="16" cy="15" r="2.6" fill="#66c0f4"/>` +
        `<path d="M6 13.5 12 16" stroke="#66c0f4" stroke-width="1.4"/></svg>`
      );
    case "housing": // 남의방(부동산)
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#ff6f3c"/>` +
        `<path d="M12 5 5 11h2v7h10v-7h2z" fill="#fff"/></svg>`
      );
    case "mail": // 피메일
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#ea4335"/>` +
        `<path d="M5 8v9h14V8l-7 5z" fill="#fff"/><path d="M5 7l7 5 7-5z" fill="#fbbc04"/></svg>`
      );
    case "grocery": // 마켓걸리버
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#5f0080"/>` +
        `<path d="M6 8h12l-1.2 8H7.2z" fill="#fff"/><path d="M9 8a3 3 0 0 1 6 0" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`
      );
    case "pushtime": // 푸시타임(성인)
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#c026a3"/>` +
        `<path d="M12 6.5c-2 0-3.5 1.4-3.5 3.2 0 2.5 3.5 5.3 3.5 5.3s3.5-2.8 3.5-5.3c0-1.8-1.5-3.2-3.5-3.2z" fill="#fff"/></svg>`
      );
    case "yabam": // 야밤(성인) — 다크 톤 초승달 마크
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#1a0a14"/>` +
        `<path d="M15.5 6.5a6 6 0 1 0 2 8.7 5 5 0 0 1-2-8.7z" fill="#ff2d78"/></svg>`
      );
    case "dartpin": // 다트 핀(익명 게시판) — 붉은 바탕에 꽂힌 핀
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#e8283c"/>` +
        `<circle cx="12" cy="9" r="3.4" fill="none" stroke="#fff" stroke-width="1.7"/>` +
        `<path d="M12 12.4V19" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/></svg>`
      );
    default: // 증권/쇼핑 등: 일반 지구본
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="#5f6b7a" ` +
        `stroke-width="1.8" aria-hidden="true"><circle cx="12" cy="12" r="9"/>` +
        `<path d="M3 12h18M12 3c2.6 2.4 2.6 15.6 0 18M12 3c-2.6 2.4-2.6 15.6 0 18"/></svg>`
      );
  }
}

function favicon(id: BrowserTabId, cls = "tab__fav"): HTMLElement {
  return el("span", { class: cls, html: faviconHtml(id) });
}

/**
 * 상단 탭이 있는 인터넷 브라우저.
 * 지금은 SNS 탭이 핵심. 새 탭은 확장 여지로 비워둔다.
 */
export function renderBrowser(ctx: GameContext): HTMLElement {
  const active = ctx.ui.activeTab;
  const state = ctx.store.getState();
  // 푸시타임은 해금 시, 야밤은 해금 + 성인물 해제(adultMode) ON일 때만 탭으로 노출
  const yabamVisible = state.yabamUnlocked && getActiveAccount(state).adultMode;
  // 너튜브·미디북스는 해금 시에만, 네이놈(blank) 뒤에 자연스럽게 삽입한다.
  const visibleTabs: TabDef[] = [];
  for (const t of TABS) {
    visibleTabs.push(t);
    if (t.id === "blank") {
      if (state.youtubeUnlocked) visibleTabs.push(YOUTUBE_TAB);
      if (state.medibooksUnlocked) visibleTabs.push(MEDIBOOKS_TAB);
      if (state.steamUnlocked) visibleTabs.push(STEAM_TAB);
      if (state.dartpinUnlocked) visibleTabs.push(DARTPIN_TAB);
    }
  }
  if (state.pushtimeUnlocked) visibleTabs.push(PUSHTIME_TAB);
  if (yabamVisible) visibleTabs.push(YABAM_TAB);
  const activeDef =
    visibleTabs.find((t) => t.id === active) ??
    SUBPAGES.find((t) => t.id === active) ??
    TABS[0];

  const tabs = el(
    "div",
    { class: "browser__tabs" },
    ...visibleTabs.map((t) =>
      el(
        "div",
        {
          class: "tab" + (t.id === active ? " tab--active" : ""),
          title: t.label,
          onclick: () => {
            // 탭을 이동하면 단발 사이트(소원 가게·도깨비 상점·O넷·서던피스)는 닫힌다.
            ctx.ui.wishSiteOpen = false;
            ctx.ui.goblinSiteOpen = false;
            ctx.ui.onetSiteOpen = false;
            ctx.ui.auctionSiteOpen = false;
            ctx.ui.activeTab = t.id;
            ctx.refresh();
          },
        },
        favicon(t.id),
        el("span", { class: "tab__label" }, t.label),
        // 피메일: 안 읽은 메일이 있으면 빨간 점 표시
        t.id === "mail" && ctx.store.getState().emails.some((e) => !e.read)
          ? el(
              "span",
              {
                style:
                  "width:7px;height:7px;border-radius:50%;background:#ea4335;flex-shrink:0;margin-left:2px",
              },
            )
          : null,
        // 닫기 버튼은 크롬 느낌만 내는 장식(실제로 닫히지 않음)
        el(
          "span",
          {
            class: "tab__close",
            title: "닫기",
            onclick: (e: Event) => e.stopPropagation(),
          },
          icon("x", { size: 12 }),
        ),
      ),
    ),
    // 새 탭(+) 버튼 — 장식
    el(
      "span",
      { class: "tab__new", title: "새 탭", onclick: () => ctx.toast("새 탭은 준비 중이에요") },
      icon("x", { size: 14, className: "tab__new-icon" }),
    ),
  );

  const urlbar = el(
    "div",
    { class: "browser__urlbar" },
    icon("lock", { size: 14 }),
    favicon(active, "urlbar__fav"),
    el(
      "div",
      { class: "url" },
      ctx.ui.wishSiteOpen
        ? "wish-shop.moon"
        : ctx.ui.goblinSiteOpen
          ? "dokkaebi.shop"
          : ctx.ui.onetSiteOpen
            ? "o-net.go.kr"
            : ctx.ui.auctionSiteOpen
              ? "southernpeace.auction/private"
              : activeDef.url,
    ),
    icon("refresh", { size: 14 }),
  );

  const content = el("div", { class: "browser__content" });
  if (ctx.ui.wishSiteOpen) {
    // 소원 가게 사이트는 현재 탭 콘텐츠를 덮어쓴다(링크로만 진입).
    content.append(renderWishSite(ctx));
  } else if (ctx.ui.goblinSiteOpen) {
    // 도깨비 상점도 현재 탭 콘텐츠를 덮어쓴다('열려라 참깨'로만 진입).
    content.append(renderGoblinShop(ctx));
  } else if (ctx.ui.onetSiteOpen) {
    // O넷도 현재 탭 콘텐츠를 덮어쓴다('자격증' 검색으로 진입, 재진입 제한 없음).
    content.append(renderOnet(ctx));
  } else if (ctx.ui.auctionSiteOpen) {
    // 서던피스 경매장도 현재 탭 콘텐츠를 덮어쓴다(피메일 초대장 링크로만 진입).
    content.append(renderAuction(ctx));
  } else if (active === "sns") {
    content.append(renderSnsView(ctx));
  } else if (active === "youtube") {
    content.append(renderYoutube(ctx));
  } else if (active === "medibooks") {
    content.append(renderMediBooks(ctx));
  } else if (active === "steam") {
    content.append(renderSteam(ctx));
  } else if (active === "housing") {
    content.append(renderHousing(ctx));
  } else if (active === "mail") {
    content.append(renderMail(ctx));
  } else if (active === "grocery") {
    content.append(renderGrocery(ctx));
  } else if (active === "pushtime") {
    content.append(renderPushtime(ctx));
  } else if (active === "yabam" && yabamVisible) {
    content.append(renderYabam(ctx));
  } else if (active === "dartpin") {
    content.append(renderDartpin(ctx));
  } else if (active === "stocks") {
    content.append(renderStocks(ctx));
  } else if (active === "shop") {
    content.append(renderShop(ctx));
  } else {
    content.append(renderPortal(ctx));
  }

  return el(
    "div",
    { class: "desktop" },
    el("div", { class: "browser" }, tabs, urlbar, content),
    renderStatusDock(ctx),
  );
}
