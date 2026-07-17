import type { GameContext } from "./context";
import type { Book } from "@/data/books";
import { BOOKS, BOOK_CATEGORY_LABEL } from "@/data/books";
import { readBook, BOOK_ACTION_COST, bookTweetAttr, bookTweetLines } from "@/systems/books";
import { postTweet } from "@/systems/tweetSystem";
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
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

const TOP_MENU = ["만화", "웹툰", "웹소설", "도서", "셀렉트"];

function masthead(): HTMLElement {
  return el(
    "header",
    { class: "mb__mast" },
    el("div", { class: "mb__logo" }, "미디북스"),
    el(
      "nav",
      { class: "mb__menu" },
      ...TOP_MENU.map((m, i) =>
        el("span", { class: "mb__menu-item" + (i === 3 ? " mb__menu-item--on" : "") }, m),
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
  ctx.openModal((c) =>
    el(
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
          `감상하시겠습니까? (시간 1칸 · 행동력 ${BOOK_ACTION_COST} 소모)`,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "취소"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let msg = "";
                c.update((s) => {
                  msg = readBook(s, book.category, book.title, book.id).message;
                });
                // 감상 후: 이 책에 대한 트윗을 올릴지 물어본다.
                openReadResultModal(c, book, msg);
              },
            },
            "감상하기",
          ),
        ),
      ),
    ),
  );
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
                  delta = postTweet(s, bookTweetAttr(book.category), text, false, "meetup", 1).followerDelta;
                });
                c.closeModal();
                c.toast(
                  delta >= 0 ? `트윗 등록! +${delta} 팔로워` : `트윗 등록... ${delta} 팔로워`,
                );
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
      ),
    ),
  );
}

/* ===================== 홈 화면 ===================== */

export function renderMediBooks(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "mb" },
    masthead(),
    el(
      "div",
      { class: "mb__body" },
      chips(),
      banners(),
      quick(),
      el("div", { class: "mb__sec-title" }, "지금 많이 읽고 있는 작품"),
      el("div", { class: "mb__books" }, ...BOOKS.map((b, i) => bookRow(ctx, b, i + 1))),
    ),
  );
}
