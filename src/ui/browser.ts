import type { GameContext } from "./context";
import type { BrowserTabId } from "./context";
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
import { renderPeemang } from "./peemang";
import { renderPushtime } from "./pushtime";
import { renderYabam } from "./yabam";
import { renderStocks } from "./stocks";
import { renderShop } from "./shop";
import { renderWishSite } from "./wishSite";
import { renderGoblinShop } from "./goblinShop";
import { renderOnet } from "./onet";
import { renderEbs } from "./ebs";
import { renderGig } from "./gig";
import { renderJobplanet } from "./jobplanet";
import { renderAuction } from "./auction";
import { renderDartpin } from "./dartpin";
import { DARTPIN_URL } from "@/systems/dartpin";
import { YABAM_LEWD_SHOW } from "@/systems/yabam";
import { PUSH_LEWD_SHOW } from "@/systems/pushtime";
import { renderDstory } from "./dstory";
import { DSTORY_URL } from "@/data/dstory";
import { renderDevtools } from "./devtools";
import { icon } from "./icons";
import {
  NIGL_URL,
  NIGL_COMPANY,
  NIGL_APPLY,
  NIGL_HIRED_LINES,
  NIGL_REJECT_LINES,
  NIGL_SHIFT_GOAL,
} from "@/data/niglnigl";
import { confirmPurchase } from "./confirmModal";
import { canBeHiredByNigl, hireNigl } from "@/systems/employment";
import { renderHistory } from "./history";
import { renderGoedam } from "./goedam";
import { renderMomo } from "./momo";
import { renderHospital } from "./hospital";
import { HOSPITAL_URL } from "@/data/hospital";
import { GOEDAM_URL, hostsHasGoedam } from "@/systems/hosts";
import { pick } from "@/utils/random";

/**
 * 북마크 가능한 사이트. 두 종류가 섞인다:
 * - kind "overlay": `${id}SiteOpen` 플래그로 여는 오버레이(현재 탭 위에 덮임).
 * - kind "tab": `activeTab`을 바꿔 여는 브라우저 탭(id가 BrowserTabId여야 함). 야밤·증권처럼
 *   탭스트립엔 없고 포털/방문기록으로만 진입하던 것을 북마크로 바로 열 수 있게 한다.
 */
export type BookmarkableSiteId =
  | "onet"
  | "ebs"
  | "gig"
  | "jobplanet"
  | "goedam"
  | "yabam"
  | "stocks";

export const BOOKMARKABLE_SITES: {
  id: BookmarkableSiteId;
  label: string;
  url: string;
  kind: "overlay" | "tab";
}[] = [
  { id: "onet", label: "O넷", url: "o-net.go.kr", kind: "overlay" },
  { id: "ebs", label: "EBS", url: "ebs.co.kr", kind: "overlay" },
  { id: "gig", label: "재능마켓", url: "talentmarket.kr", kind: "overlay" },
  { id: "jobplanet", label: "직플래닛", url: "jobplanet.work", kind: "overlay" },
  { id: "goedam", label: "괴담", url: GOEDAM_URL, kind: "overlay" },
  { id: "yabam", label: "야밤", url: "yabam.click", kind: "tab" },
  { id: "stocks", label: "증권", url: "hanaro-invest.com", kind: "tab" },
];

/** 단발 오버레이를 전부 닫는다(주소창/탭전환/북마크 진입 공통). */
export function closeOverlays(ctx: GameContext): void {
  ctx.ui.wishSiteOpen = false;
  ctx.ui.goblinSiteOpen = false;
  ctx.ui.onetSiteOpen = false;
  ctx.ui.ebsSiteOpen = false;
  ctx.ui.gigSiteOpen = false;
  ctx.ui.hospitalSiteOpen = false;
  ctx.ui.jobplanetSiteOpen = false;
  ctx.ui.auctionSiteOpen = false;
  ctx.ui.dstorySiteOpen = false;
  ctx.ui.historySiteOpen = false;
  ctx.ui.niglSiteOpen = false;
  ctx.ui.goedamSiteOpen = false;
  ctx.ui.momoSiteOpen = false;
}

/** 현재 화면이 북마크 대상 사이트인지(없으면 null). 오버레이가 탭보다 우선(위에 덮이므로). */
export function currentBookmarkableId(ctx: GameContext): BookmarkableSiteId | null {
  if (ctx.ui.onetSiteOpen) return "onet";
  if (ctx.ui.ebsSiteOpen) return "ebs";
  if (ctx.ui.gigSiteOpen) return "gig";
  if (ctx.ui.jobplanetSiteOpen) return "jobplanet";
  if (ctx.ui.goedamSiteOpen) return "goedam";
  // 북마크 대상이 아닌 오버레이라도 하나 열려 있으면 그게 화면이다 — 탭 판정을 막는다.
  const otherOverlay =
    ctx.ui.wishSiteOpen ||
    ctx.ui.goblinSiteOpen ||
    ctx.ui.auctionSiteOpen ||
    ctx.ui.dstorySiteOpen ||
    ctx.ui.hospitalSiteOpen ||
    ctx.ui.niglSiteOpen ||
    ctx.ui.historySiteOpen;
  if (!otherOverlay) {
    if (ctx.ui.activeTab === "yabam") return "yabam";
    if (ctx.ui.activeTab === "stocks") return "stocks";
  }
  return null;
}

/** 북마크/주소창에서 사이트를 연다. 오버레이/탭 종류와 진입 가드를 여기서 처리. */
export function openBookmarkSite(ctx: GameContext, id: BookmarkableSiteId): void {
  if (id === "goedam" && !hostsHasGoedam(ctx.store.getState())) {
    ctx.toast("페이지를 찾을 수 없습니다");
    return;
  }
  closeOverlays(ctx);
  if (id === "yabam" || id === "stocks") {
    // 탭형: activeTab만 바꾸면 콘텐츠가 렌더된다(탭스트립엔 없어도 됨).
    ctx.ui.activeTab = id;
  } else if (id === "onet") ctx.ui.onetSiteOpen = true;
  else if (id === "ebs") ctx.ui.ebsSiteOpen = true;
  else if (id === "gig") ctx.ui.gigSiteOpen = true;
  else if (id === "jobplanet") ctx.ui.jobplanetSiteOpen = true;
  else if (id === "goedam") {
    ctx.ui.goedamSiteOpen = true;
    ctx.ui.goedamStoryId = null;
  }
  ctx.refresh();
}

/** 주소창 아래 상시 북마크바. 비어 있으면 안내 문구. */
function bookmarkBar(ctx: GameContext): HTMLElement {
  const bms = ctx.store.getState().bookmarks;
  const items = bms
    .map((id) => BOOKMARKABLE_SITES.find((s) => s.id === id))
    .filter((s): s is (typeof BOOKMARKABLE_SITES)[number] => !!s)
    .map((site) =>
      el(
        "button",
        {
          class: "bookmark",
          title: site.url,
          onclick: () => openBookmarkSite(ctx, site.id),
        },
        site.label,
      ),
    );
  return el(
    "div",
    { class: "browser__bookmarkbar" },
    ...(items.length
      ? items
      : [el("span", { class: "bookmarkbar__hint" }, "⭐로 자주 가는 사이트를 북마크하세요")]),
  );
}

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

/** 증권/쇼핑/남의방/마켓걸리버/피망마켓은 상단 탭이 아니라 네이놈 포털에서 진입한다. url바 표시·activeDef 조회에 사용. */
const SUBPAGES: TabDef[] = [
  { id: "stocks", label: "증권", url: "hanaro-invest.com" },
  { id: "shop", label: "쇼핑", url: "coupang.com" },
  { id: "housing", label: "남의방", url: "namroom.com" },
  { id: "grocery", label: "마켓걸리버", url: "marketgulliver.com" },
  { id: "peemang", label: "피망마켓", url: "peemang.market" },
  // 야밤은 탭에 추가되지 않는다 — 방문기록에서만 진입한다(activeTab="yabam"). 주소창 표시용으로만 둔다.
  { id: "yabam", label: "야밤", url: "yabam.click" },
];

/** 탭/주소창에 쓰는 사이트 파비콘(브랜드 마크) SVG */
// 광고 트윗 미디어(components.ts)도 앱 홍보 파비콘을 이걸로 그린다.
export function faviconHtml(id: BrowserTabId): string {
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
    case "peemang": // 피망마켓(중고 직거래) — 초록 바탕의 피망
      return (
        `<svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">` +
        `<rect width="24" height="24" rx="5" fill="#2fa84f"/>` +
        `<path d="M7.5 12.5c0-2.2 2-3.5 4.5-3.5s4.5 1.3 4.5 3.5c0 3-2 5.5-4.5 5.5s-4.5-2.5-4.5-5.5z" fill="#fff"/>` +
        `<path d="M12 9V6.5" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/></svg>`
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
 * 주소창 오른쪽 끝 ⋮ 버튼 + 팝오버(항목은 '개발자 도구' 하나).
 *
 * ⚠️ **"F12"는 크롬 메뉴 흉내를 낸 라벨일 뿐이다 — 실제 F12 키를 바인딩하지 마라**(사용자 확정).
 *    keydown을 걸면 게임 밖 진짜 브라우저의 개발자 도구가 열려 몰입이 깨지고,
 *    F12는 예약 단축키라 막지도 못한다. 개발자 도구로 가는 길은 이 항목 하나뿐이며,
 *    d스토리 글1의 힌트 "F12"는 "눌러라"가 아니라 "F12라고 적힌 걸 찾아라"는 뜻이다.
 */
function urlbarMenu(ctx: GameContext): HTMLElement {
  const open = ctx.ui.settingsMenuOpen;
  const toggle = (): void => {
    ctx.ui.settingsMenuOpen = !ctx.ui.settingsMenuOpen;
    ctx.refresh();
  };

  return el(
    "div",
    { class: "urlbar__menu-wrap" },
    el("button", { class: "urlbar__menu", title: "설정 및 기타", onclick: toggle }, "⋮"),
    // 바깥 아무 곳이나 누르면 닫히는 투명 백드롭(팝오버보다 아래에 깔린다).
    open ? el("div", { class: "settings-backdrop", onclick: toggle }) : null,
    open
      ? el(
          "div",
          { class: "settings-popover" },
          el(
            "button",
            {
              class: "settings-popover__item",
              onclick: () => {
                ctx.ui.settingsMenuOpen = false;
                // 방문기록 페이지(오버레이)를 연다 — 다른 단발 오버레이는 전부 닫는다.
                closeOverlays(ctx);
                ctx.ui.historySiteOpen = true;
                ctx.refresh();
              },
            },
            el("span", {}, "방문기록"),
          ),
          el(
            "button",
            {
              class: "settings-popover__item",
              onclick: () => {
                ctx.ui.settingsMenuOpen = false;
                ctx.openModal(renderDevtools);
              },
            },
            el("span", {}, "개발자 도구"),
            el("span", { class: "settings-popover__key" }, "F12"),
          ),
        )
      : null,
  );
}

/**
 * 니글니글 취업 지원 화면(오버레이) — 주소창에 NIGL_URL 입력으로만 진입.
 * 텍스트는 전부 data/niglnigl(NIGL_APPLY), 취업 처리는 systems/employment(hireNigl)가 한다.
 * 이 화면은 "언제·어떻게 보여줄지"만 담당한다.
 */
/**
 * 스탯 미달 서류 탈락 여부(세션 휘발). 지원 화면에 진입할 때 리셋하고, 탈락 제출 시 켠다.
 * 모듈 스코프인 이유: 재렌더가 지원 화면을 다시 그려도 불합격 문구가 유지돼야 한다(dstory pendingPw와 동일 패턴).
 */
let niglRejectLine = "";

function renderNiglApply(ctx: GameContext): HTMLElement {
  const employed = ctx.store.getState().employment?.company === NIGL_COMPANY;

  const submit = (): void => {
    // 제출은 누구나 가능하지만, IT·지식 문턱을 넘어야 실제로 합격한다.
    if (!canBeHiredByNigl(ctx.store.getState())) {
      niglRejectLine = pick(NIGL_REJECT_LINES);
      ctx.toast(niglRejectLine, "bad");
      ctx.refresh();
      return;
    }
    // 니글니글은 평일 낮 고정 근무가 아니라 자유 출근 — 팝업 문구도 그에 맞춘다.
    confirmPurchase(ctx, {
      title: "출근 안내",
      message: `니글니글은 출근시간이 고정돼 있지 않아요. 주말·심야 포함 원할 때 자유롭게 출근하면 되고, 한 달에 ${NIGL_SHIFT_GOAL}일만 채우면 만근이에요(미달 시 월급 반감). 지원할까요?`,
      confirmLabel: "지원한다",
      cancelLabel: "취소",
      onConfirm: () => {
        ctx.update((s) => hireNigl(s));
        ctx.ui.niglSiteOpen = false;
        niglRejectLine = "";
        ctx.toast(pick(NIGL_HIRED_LINES));
        ctx.refresh();
      },
    });
  };

  return el(
    "div",
    { class: "nigl-site" },
    el("div", { class: "nigl-glow" }),
    el(
      "div",
      { class: "nigl-hero" },
      el(
        "span",
        { class: "nigl-eyebrow" },
        el("span", { class: "nigl-eyebrow__dot" }),
        "니글니글 · PANGYO HQ",
      ),
      el("h1", { class: "nigl-title" }, NIGL_APPLY.title),
      el("p", { class: "nigl-intro" }, NIGL_APPLY.intro),
      employed
        ? el(
            "div",
            { class: "nigl-done" },
            "이미 니글러로 재직 중입니다. 다음 출근에서 만나요!",
          )
        : el(
            "div",
            { class: "nigl-apply-box" },
            // 탈락해도 다시 제출할 수 있게 버튼은 항상 둔다(제출 자체는 누구나 가능).
            el(
              "button",
              { class: "nigl-cta", onclick: submit },
              NIGL_APPLY.submitLabel,
              el("span", { class: "nigl-cta__arrow" }, "→"),
            ),
            niglRejectLine
              ? el(
                  "div",
                  { class: "nigl-reject" },
                  el("span", { class: "nigl-reject__tag" }, "서류 탈락"),
                  el("span", { class: "nigl-reject__text" }, niglRejectLine),
                )
              : null,
          ),
    ),
  );
}

/**
 * 상단 탭이 있는 인터넷 브라우저.
 * 지금은 SNS 탭이 핵심. 새 탭은 확장 여지로 비워둔다.
 */
export function renderBrowser(ctx: GameContext): HTMLElement {
  const active = ctx.ui.activeTab;
  const state = ctx.store.getState();
  // 탭 표출의 주 기준은 음란도(state.skills.lewd). 기존 DM 해금(unlocked)은 OR로 유지(하위호환).
  // 야밤은 탭에 추가하지 않는다 — 방문기록에서만 진입한다(아래 render 분기). yabamVisible는
  // 성인물 해제(adultMode) ON일 때만 렌더를 허용하는 게이트로만 쓴다.
  const lewd = state.skills.lewd;
  const yabamVisible = state.adultMode && (lewd >= YABAM_LEWD_SHOW || state.yabamUnlocked);
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
  if (lewd >= PUSH_LEWD_SHOW || state.pushtimeUnlocked) visibleTabs.push(PUSHTIME_TAB);
  // 야밤 탭은 추가하지 않는다 — 방문기록(history.ts)에서 activeTab="yabam"으로만 진입한다.
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
            // 탭을 이동하면 단발 사이트(소원 가게·O넷·momo 등)는 전부 닫힌다.
            closeOverlays(ctx);
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

  // 표시 url은 활성 오버레이/탭 기준(기존 삼항). input value로만 노출하고,
  // 편집·엔터는 이스터에그 진입(NIGL_URL)만 처리한다 — 탭 전환 로직은 그대로.
  const currentUrl = ctx.ui.wishSiteOpen
    ? "wish-shop.moon"
    : ctx.ui.goblinSiteOpen
      ? "dokkaebi.shop"
      : ctx.ui.onetSiteOpen
        ? "o-net.go.kr"
        : ctx.ui.ebsSiteOpen
          ? "ebs.co.kr"
          : ctx.ui.gigSiteOpen
            ? "talentmarket.kr"
            : ctx.ui.hospitalSiteOpen
            ? HOSPITAL_URL
            : ctx.ui.jobplanetSiteOpen
          ? "jobplanet.work"
          : ctx.ui.auctionSiteOpen
          ? "southernpeace.auction/private"
          : ctx.ui.dstorySiteOpen
            ? DSTORY_URL
            : ctx.ui.niglSiteOpen
              ? NIGL_URL
              : ctx.ui.historySiteOpen
                ? "browser://history"
                : ctx.ui.goedamSiteOpen
                  ? GOEDAM_URL
                  : ctx.ui.momoSiteOpen
                    ? "momo.com"
                    : activeDef.url;

  const urlbar = el(
    "div",
    { class: "browser__urlbar" },
    icon("lock", { size: 14 }),
    favicon(active, "urlbar__fav"),
    el("input", {
      class: "url",
      value: currentUrl,
      spellcheck: "false",
      autocomplete: "off",
      autocapitalize: "off",
      onkeydown: (e: Event) => {
        if ((e as KeyboardEvent).key !== "Enter") return;
        const v = (e.target as HTMLInputElement).value.trim();
        if (v === NIGL_URL) {
          closeOverlays(ctx);
          ctx.ui.niglSiteOpen = true;
          niglRejectLine = "";
          ctx.refresh();
        } else if (v === GOEDAM_URL) {
          // hosts에 goedam.kr 매핑을 넣어 저장했을 때만 실제로 해석된다(그전엔 '찾을 수 없음').
          if (hostsHasGoedam(ctx.store.getState())) {
            closeOverlays(ctx);
            ctx.ui.goedamSiteOpen = true;
            ctx.ui.goedamStoryId = null;
            ctx.refresh();
          } else {
            ctx.toast("페이지를 찾을 수 없습니다");
          }
        } else if (v === "momo.com" || v === "www.momo.com") {
          // momo.com은 성인 사이트 — 성인모드 ON에서만 내용이 뜬다.
          if (ctx.store.getState().adultMode) {
            closeOverlays(ctx);
            ctx.ui.momoSiteOpen = true;
            ctx.refresh();
          } else {
            ctx.toast("페이지를 찾을 수 없습니다");
          }
        } else {
          ctx.toast("페이지를 찾을 수 없습니다");
        }
      },
    }),
    icon("refresh", { size: 14 }),
    ...(function () {
      const bmId = currentBookmarkableId(ctx);
      if (!bmId) return [];
      const marked = ctx.store.getState().bookmarks.includes(bmId);
      return [
        el(
          "button",
          {
            class: "urlbar__star" + (marked ? " is-on" : ""),
            title: marked ? "북마크 제거" : "북마크 추가",
            onclick: () => {
              ctx.update((d) => {
                const i = d.bookmarks.indexOf(bmId);
                if (i >= 0) d.bookmarks.splice(i, 1);
                else d.bookmarks.push(bmId);
              });
            },
          },
          marked ? "★" : "☆",
        ),
      ];
    })(),
    urlbarMenu(ctx),
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
  } else if (ctx.ui.ebsSiteOpen) {
    // EBS 강의 사이트도 현재 탭 콘텐츠를 덮어쓴다('듄' 검색으로 진입, 재진입 제한 없음).
    content.append(renderEbs(ctx));
  } else if (ctx.ui.gigSiteOpen) {
    // 재능마켓도 현재 탭 콘텐츠를 덮어쓴다('외주' 검색으로 진입, 재진입 제한 없음).
    content.append(renderGig(ctx));
  } else if (ctx.ui.hospitalSiteOpen) {
    // 세이신내과의원도 현재 탭 콘텐츠를 덮어쓴다('내과'/'순환기내과' 검색으로 진입).
    // momo.com과 달리 성인모드 게이트가 없다 — 이쪽이 킬러 일의 전연령 진입로다.
    content.append(renderHospital(ctx));
  } else if (ctx.ui.jobplanetSiteOpen) {
    // 직플래닛(기업정보)도 현재 탭 콘텐츠를 덮어쓴다(채용공고 '직플래닛' 버튼으로 진입).
    content.append(renderJobplanet(ctx));
  } else if (ctx.ui.auctionSiteOpen) {
    // 서던피스 경매장도 현재 탭 콘텐츠를 덮어쓴다(피메일 초대장 링크로만 진입).
    content.append(renderAuction(ctx));
  } else if (ctx.ui.dstorySiteOpen) {
    // d스토리도 현재 탭 콘텐츠를 덮어쓴다(IT계 검색의 링크 트윗으로만 진입).
    content.append(renderDstory(ctx));
  } else if (ctx.ui.niglSiteOpen) {
    // 니글니글 취업 지원 화면(주소창에 NIGL_URL 입력으로만 진입).
    content.append(renderNiglApply(ctx));
  } else if (ctx.ui.historySiteOpen) {
    // 방문기록 페이지(⋮ 메뉴로 진입, 탭 이동 시 닫힘).
    content.append(renderHistory(ctx));
  } else if (ctx.ui.goedamSiteOpen) {
    // 괴담 사이트(hosts에 goedam.kr 매핑 후 주소창 입력으로 진입, 탭 이동 시 닫힘).
    content.append(renderGoedam(ctx));
  } else if (ctx.ui.momoSiteOpen) {
    // momo.com — 에로서적 사이트(성인모드에서만 진입, 하단 서적요청=킬러 진입로).
    content.append(renderMomo(ctx));
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
  } else if (active === "peemang") {
    content.append(renderPeemang(ctx));
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
    el("div", { class: "browser" }, tabs, urlbar, bookmarkBar(ctx), content),
    renderStatusDock(ctx),
  );
}
