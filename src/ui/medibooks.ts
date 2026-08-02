import type { GameContext } from "./context";
import type { Book } from "@/data/books";
import { BOOKS, BOOK_CATEGORY_LABEL } from "@/data/books";
import {
  readBook,
  BOOK_ACTION_COST,
  bookPrice,
  canReadBook,
  bookTweetAttr,
  bookTweetLines,
  visibleAdultBooks,
} from "@/systems/books";
import { hasAction } from "@/systems/stats";
import { postTweet } from "@/systems/tweetSystem";
import { pick } from "@/utils/random";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 미디북스 — 전자책 스토어(리디 스타일 클론).
 * 마스트헤드/카테고리/배너/퀵메뉴는 전부 장식(클릭 불가),
 * 실제로 클릭되는 건 '지금 많이 읽고 있는 작품'의 책뿐이다.
 * ============================================================ */

function coverStyle(hue: number): string {
  return (
    `background:linear-gradient(150deg, hsl(${hue}deg 55% 42%),` +
    ` hsl(${(hue + 30) % 360}deg 60% 28%))`
  );
}

/* ===================== 마스트헤드(장식) ===================== */

// 상단 메뉴 중 만화·도서는 실제 필터로 동작한다(도서=만화 제외 일반도서). 나머지는 장식.
const TOP_MENU: { label: string; filter?: BookFilter }[] = [
  { label: "만화", filter: "comic" },
  { label: "웹툰" },
  { label: "웹소설" },
  { label: "도서", filter: "book" },
  { label: "셀렉트" },
];

function masthead(ctx: GameContext): HTMLElement {
  const cur = ctx.ui.medibooksFilter;
  return el(
    "header",
    { class: "mb__mast" },
    el("div", { class: "mb__logo" }, "미디북스"),
    el(
      "nav",
      { class: "mb__menu" },
      ...TOP_MENU.map((m) =>
        el(
          "span",
          {
            class: "mb__menu-item" + (m.filter && cur === m.filter ? " mb__menu-item--on" : ""),
            style: m.filter ? "cursor:pointer" : undefined,
            onclick: m.filter
              ? () => {
                  ctx.ui.medibooksFilter = m.filter!;
                  ctx.ui.medibooksTab = "home"; // 성인 탭에 있었어도 홈(필터된 도서)으로 돌아온다
                  ctx.refresh();
                }
              : undefined,
          },
          m.label,
        ),
      ),
    ),
    el(
      "div",
      { class: "mb__search" },
      icon("search", { size: 15 }),
      el("span", { class: "mb__search-ph" }, "검색"),
    ),
    el(
      "div",
      { class: "mb__mast-right" },
      el("span", {}, "로그인"),
      el("span", { class: "mb__cash" }, "캐시충전"),
    ),
  );
}

/* ===================== 카테고리 칩(장식) ===================== */

const CHIPS = ["추천", "기획전", "소설", "인문/사회/역사", "경영/경제", "자기계발", "에세이/시"];

function chips(): HTMLElement {
  return el(
    "div",
    { class: "mb__chips" },
    ...CHIPS.map((c, i) =>
      el("span", { class: "mb__chip" + (i === 0 ? " mb__chip--on" : "") }, c),
    ),
  );
}

/* ===================== 히어로 배너(장식) ===================== */

const BANNERS = [
  { tag: "세트 ↓30%", title: "《심야 퇴령록》 출간 기념", sub: "전권 세트 1년 대여", hue: 275 },
  { tag: "NEW 세트", title: "《안개 탐정 로사》 시리즈", sub: "전 9권 대여로 정주행!", hue: 210 },
  { tag: "세트 ↓50%", title: "《웃는 편의점의 밤》 세트", sub: "50년 대여 OPEN", hue: 350 },
];

function banners(): HTMLElement {
  return el(
    "div",
    { class: "mb__banners" },
    ...BANNERS.map((b) =>
      el(
        "div",
        { class: "mb__banner", style: coverStyle(b.hue) },
        el("span", { class: "mb__banner-tag" }, b.tag),
        el("div", { class: "mb__banner-title" }, b.title),
        el("div", { class: "mb__banner-sub" }, b.sub),
      ),
    ),
  );
}

/* ===================== 퀵 메뉴(장식) ===================== */

const QUICK = ["신간", "북스 베스트", "이벤트", "미디온리", "이달의 쿠폰", "대여", "혜택 모아봄"];

function quick(): HTMLElement {
  return el(
    "div",
    { class: "mb__quick" },
    ...QUICK.map((q) =>
      el(
        "div",
        { class: "mb__quick-item" },
        el("span", { class: "mb__quick-ic" }, icon("book", { size: 18 })),
        el("span", { class: "mb__quick-label" }, q),
      ),
    ),
  );
}

/* ===================== 책 목록(클릭 가능) ===================== */

/** 책 클릭 → 감상 확인 모달 */
function openBookModal(ctx: GameContext, book: Book): void {
  ctx.openModal((c) => {
    const price = bookPrice(book);
    const enoughMoney = canReadBook(c.store.getState(), book);
    // 행동력이 감상 비용보다 적으면 막는다(마이너스 방지) — 소지금과 별개 사유.
    const enoughAction = hasAction(c.store.getState(), BOOK_ACTION_COST);
    const afford = enoughMoney && enoughAction;
    return el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("book", { size: 18 }), "미디북스"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.7;margin:0 0 6px" },
          `『${book.title}』`,
        ),
        el(
          "p",
          { style: "font-size:13px;color:var(--text-muted);margin:0 0 14px" },
          `${BOOK_CATEGORY_LABEL[book.category]} · ${book.author}`,
        ),
        el(
          "p",
          { style: "font-size:14px;margin:0 0 16px" },
          `감상하시겠습니까? (${formatNumber(price)}원 · 시간 1칸 · 행동력 ${BOOK_ACTION_COST} 소모)`,
        ),
        afford
          ? null
          : el(
              "p",
              { class: "compose-hint", style: "margin:-8px 0 14px" },
              !enoughMoney
                ? `소지금이 부족해요 (감상료 ${formatNumber(price)}원)`
                : `행동력이 부족해요 (감상에 ${BOOK_ACTION_COST} 필요)`,
            ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "취소"),
          el(
            "button",
            {
              class: "btn" + (afford ? "" : " btn--ghost"),
              disabled: !afford,
              onclick: () => {
                if (!afford) return;
                let msg = "";
                c.update((s) => {
                  msg = readBook(s, book.category, book.title, book.id).message;
                });
                // 감상 후: 이 책에 대한 트윗을 올릴지 물어본다.
                openReadResultModal(c, book, msg);
              },
            },
            `감상하기 (${formatNumber(price)}원)`,
          ),
        ),
      ),
    );
  });
}

/** 감상 완료 화면 — 방금 읽은 책에 대한 트윗을 올릴지 선택 */
function openReadResultModal(ctx: GameContext, book: Book, msg: string): void {
  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("book", { size: 18 }), "독서 완료"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "life-result__flavor" }, msg),
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          `방금 읽은 『${book.title}』 감상을 트윗할까?`,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                c.closeModal();
                c.afterAction("offline");
              },
            },
            "안 올린다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                const text = pick(bookTweetLines(book));
                let delta = 0;
                c.update((s) => {
                  // 성인 도서 감상 트윗은 성인 트윗으로 게시된다(18+ 라벨·성과 가중).
                  const isAdult = book.category === "adult";
                  delta = postTweet(s, bookTweetAttr(book.category), text, isAdult, "meetup", 1).followerDelta;
                });
                c.closeModal();
                c.toast(delta >= 0 ? `트윗 게시! +${delta} 팔로워` : `트윗 게시... ${delta} 팔로워`);
              },
            },
            "트윗한다",
          ),
        ),
      ),
    ),
  );
}

function bookRow(ctx: GameContext, book: Book, rank: number): HTMLElement {
  return el(
    "button",
    { class: "mb-book", onclick: () => openBookModal(ctx, book) },
    el("span", { class: "mb-book__rank" }, String(rank)),
    el("span", { class: "mb-book__cover", style: coverStyle(book.hue) }),
    el(
      "span",
      { class: "mb-book__info" },
      el("span", { class: "mb-book__title" }, book.title),
      el("span", { class: "mb-book__author" }, book.author),
      el(
        "span",
        { class: "mb-book__rating" },
        el("span", { class: "mb-book__star" }, "★"),
        `${book.rating.toFixed(1)}(${book.reviews.toLocaleString("ko-KR")})`,
        el("span", { class: "mb-book__price" }, `${formatNumber(bookPrice(book))}원`),
      ),
    ),
  );
}

/* ===================== 도서 필터(일반도서/만화) ===================== */

type BookFilter = "book" | "comic";

/** 필터에 맞는 도서 목록(도서=만화 제외 일반도서, 만화=comic만). 상단 메뉴가 필터를 바꾼다. */
function filteredBooks(filter: BookFilter): typeof BOOKS {
  return filter === "comic"
    ? BOOKS.filter((b) => b.category === "comic")
    : BOOKS.filter((b) => b.category !== "comic");
}

function filterSecTitle(filter: BookFilter): string {
  return filter === "comic" ? "지금 많이 보는 만화" : "지금 많이 읽고 있는 도서";
}

/* ===================== 홈 화면 ===================== */

export function renderMediBooks(ctx: GameContext): HTMLElement {
  // 성인물 보기가 꺼져 있으면 성인 탭은 없다 → 홈으로 강제(꺼진 뒤 남은 상태 방어).
  const adultOn = ctx.store.getState().adultMode;
  const tab = adultOn ? ctx.ui.medibooksTab : "home";

  const tabBtn = (id: "home" | "adult", label: string) =>
    el(
      "div",
      {
        class: "feed__tab" + (tab === id ? " feed__tab--active" : ""),
        onclick: () => {
          ctx.ui.medibooksTab = id;
          ctx.refresh();
        },
      },
      el("span", { class: "feed__tab-label" }, label),
    );
  const tabs = adultOn
    ? el("div", { class: "feed__tabs mb__tabs" }, tabBtn("home", "홈"), tabBtn("adult", "🔞 성인"))
    : null;

  const body =
    tab === "adult"
      ? [
          el("div", { class: "mb__sec-title" }, "🔞 성인 · 지금 인기 있는 작품"),
          // 취향서(minPervert)는 변태력이 열려야 서가에 뜬다 — 야밤·푸시타임과 같은 규칙.
          el(
            "div",
            { class: "mb__books" },
            ...visibleAdultBooks(ctx.store.getState()).map((b, i) => bookRow(ctx, b, i + 1)),
          ),
        ]
      : [
          chips(),
          banners(),
          quick(),
          el("div", { class: "mb__sec-title" }, filterSecTitle(ctx.ui.medibooksFilter)),
          el(
            "div",
            { class: "mb__books" },
            ...filteredBooks(ctx.ui.medibooksFilter).map((b, i) => bookRow(ctx, b, i + 1)),
          ),
        ];

  return el("div", { class: "mb" }, masthead(ctx), el("div", { class: "mb__body" }, tabs, ...body));
}
