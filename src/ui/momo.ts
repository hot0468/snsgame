import type { GameContext } from "./context";
import { el } from "@/utils/dom";
import { MOMO_BOOKS } from "@/data/momoBooks";
import { requestBook } from "@/systems/killer";

/**
 * momo.com — 겉은 에로서적 사이트(목록+소개文), 진짜 목적은 하단 [서적요청] 버튼이다.
 * 성인모드에서만 열린다(browser의 라우팅이 게이트). 서적요청 → momo 청부 제의 DM.
 */
export function renderMomo(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const isKiller = !!s.killerJob?.active;

  const books = el(
    "div",
    { class: "momo-grid" },
    ...MOMO_BOOKS.map((b) =>
      el(
        "div",
        { class: "momo-book" },
        el("div", { class: "momo-book__cover" }, "📕"),
        el(
          "div",
          { class: "momo-book__body" },
          el("div", { class: "momo-book__title" }, b.title),
          el("div", { class: "momo-book__blurb" }, b.blurb),
        ),
      ),
    ),
  );

  const requestBtn = el(
    "button",
    {
      class: "momo-request",
      onclick: () => {
        ctx.update((st) => requestBook(st));
        ctx.toast(
          isKiller ? "momo에게 연락했다." : "momo에게 서적을 요청했다. 쪽지를 확인해봐.",
        );
      },
    },
    isKiller ? "📩 momo에게 연락" : "📩 서적 요청하기",
  );

  return el(
    "div",
    { class: "momo-site" },
    el(
      "div",
      { class: "momo-head" },
      el("span", { class: "momo-logo" }, "momo"),
      el("span", { class: "momo-tag" }, "은밀한 서재 · 회원 전용"),
    ),
    el("div", { class: "momo-notice" }, "당신만을 위한 이야기. 오늘 밤, 어떤 책을 펼치시겠어요?"),
    books,
    el(
      "div",
      { class: "momo-foot" },
      el("div", { class: "momo-foot__desc" }, "찾는 책이 없으신가요? 원하는 것을 직접 요청하세요."),
      requestBtn,
    ),
  );
}
