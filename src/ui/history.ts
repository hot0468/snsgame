import type { GameContext } from "./context";
import type { BrowserTabId } from "./context";
import { faviconHtml } from "./browser";
import { unlockYabam } from "@/systems/yabam";
import { el } from "@/utils/dom";

/* ============================================================
 * 방문기록 페이지 — 크롬 방문기록(chrome://history) UI 패러디 오버레이.
 * 브라우저 주소창 ⋮ 메뉴의 '방문기록'으로 진입한다(browser.ts historySiteOpen).
 *
 * 대부분은 클릭해도 다시 열 수 없는 더미 기록이고, 그중 '야밤' 한 줄만 실제로
 * 동작한다 — 클릭하면 야밤에 진입한다(activeTab="yabam"). 야밤은 브라우저 탭에
 * 추가되지 않으므로 **이 방문기록이 유일한 진입로**다(재방문도 여기서). 야밤 항목은
 * 성인물 해제(adultMode) ON일 때만 기록에 노출된다(야밤 렌더 게이트와 정합).
 *
 * ⚠️ 해금 규칙은 systems/yabam(unlockYabam)이 소유한다. 여기서 state.yabamUnlocked를
 *    직접 만지지 마라 — 규칙을 UI에 흘리면 경로가 갈린다.
 * ============================================================ */

interface HistoryEntry {
  /** 파비콘용 사이트 종류 */
  fav: BrowserTabId;
  title: string;
  url: string;
  /** 표시용 방문 시각(정적 플레이버) */
  time: string;
  /** 클릭 시 야밤을 해금하는 항목인지 */
  yabam?: boolean;
}

/** 항상 노출되는 더미 방문 기록(재열람 불가 — 플레이버). */
const DUMMY_ENTRIES: HistoryEntry[] = [
  { fav: "sns", title: "X — 홈 타임라인", url: "x.com/home", time: "오후 3:41" },
  { fav: "blank", title: "네이놈 — 실시간 급상승", url: "naenom.com", time: "오후 2:58" },
  { fav: "mail", title: "피메일 — 받은편지함", url: "pmail.com", time: "오후 1:12" },
  { fav: "youtube", title: "너튜브 — 오늘의 추천", url: "nutube.com/feed", time: "오전 11:33" },
  { fav: "grocery", title: "마켓걸리버 — 오늘 장보기", url: "marketgulliver.com", time: "오전 10:07" },
  { fav: "blank", title: "네이놈 — 날씨", url: "naenom.com/weather", time: "오전 9:20" },
];

/** 야밤 항목(성인물 해제 ON일 때만 기록에 섞인다). */
const YABAM_ENTRY: HistoryEntry = {
  fav: "yabam",
  title: "야밤 — 오늘의 밤",
  url: "yabam.click",
  time: "새벽 1:47",
  yabam: true,
};

function favicon(id: BrowserTabId): HTMLElement {
  return el("span", { class: "hist-row__fav", html: faviconHtml(id) });
}

function historyRow(ctx: GameContext, entry: HistoryEntry): HTMLElement {
  return el(
    "div",
    {
      class: "hist-row",
      onclick: () => {
        if (entry.yabam) {
          // 야밤은 브라우저 탭에 추가되지 않는다 — 방문기록에서만 진입한다.
          // unlockYabam은 렌더 게이트(yabamVisible)를 여는 용도로 유지(탭은 안 생김).
          ctx.update((s) => unlockYabam(s));
          ctx.ui.historySiteOpen = false;
          ctx.ui.activeTab = "yabam";
          ctx.toast("야밤에 접속했어요 🔞 (방문기록에서 다시 들어올 수 있어요)");
          ctx.refresh();
          return;
        }
        ctx.toast("지난 방문 기록이에요. 여기선 다시 열 수 없어요.");
      },
    },
    el("span", { class: "hist-row__time" }, entry.time),
    favicon(entry.fav),
    el(
      "span",
      { class: "hist-row__text" },
      el("span", { class: "hist-row__title" }, entry.title),
      el("span", { class: "hist-row__url" }, entry.url),
    ),
  );
}

export function renderHistory(ctx: GameContext): HTMLElement {
  const adult = ctx.store.getState().adultMode;
  // 야밤은 성인물 해제 ON일 때만 노출. 목록 중간(더미 사이)에 섞어 눈에 덜 띄게 둔다.
  const entries = adult
    ? [...DUMMY_ENTRIES.slice(0, 4), YABAM_ENTRY, ...DUMMY_ENTRIES.slice(4)]
    : DUMMY_ENTRIES;

  return el(
    "div",
    { class: "hist" },
    el(
      "header",
      { class: "hist__head" },
      el("div", { class: "hist__title" }, "방문 기록"),
      el(
        "div",
        { class: "hist__search" },
        el("span", { class: "hist__search-icon" }, "🔍"),
        el("span", { class: "hist__search-ph" }, "방문 기록 검색"),
      ),
    ),
    el(
      "div",
      { class: "hist__body" },
      el("div", { class: "hist__daygroup" }, "오늘 — " + entries.length + "개 사이트"),
      el("div", { class: "hist__list" }, ...entries.map((e) => historyRow(ctx, e))),
    ),
  );
}
