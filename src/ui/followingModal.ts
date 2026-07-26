import type { GameContext } from "./context";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { el, formatNumber } from "@/utils/dom";
import { avatar } from "./icons";

/**
 * '팔로우 목록' 모달 — 현재 활성 계정이 팔로우한 계정들을 보여준다.
 * 목록은 활성 계정의 followingAccounts라, 계정을 바꾸면 자동으로 그 계정의 목록이 뜬다(계정별 분리).
 */
export function renderFollowingModal(ctx: GameContext): HTMLElement {
  const me = getActiveAccount(ctx.store.getState());
  const list = me.followingAccounts;

  return el(
    "div",
    { class: "modal following-modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, `@${me.handle} · 팔로우 목록 (${list.length})`),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      list.length === 0
        ? el("div", { class: "empty" }, "아직 팔로우한 계정이 없어요.\n둘러보기에서 마음에 드는 계정을 팔로우해보세요!")
        : el(
            "div",
            { class: "following-list" },
            ...list.map((a) =>
              el(
                "div",
                { class: "following-row" },
                el("div", { class: "following-row__avatar" }, avatar(a.name, 40)),
                el(
                  "div",
                  { class: "following-row__meta" },
                  el("div", { class: "following-row__name" }, a.name),
                  el("div", { class: "following-row__handle" }, `@${a.handle}`),
                ),
                el(
                  "div",
                  { class: "following-row__side" },
                  el("span", { class: "following-row__attr" }, ATTRIBUTES[a.attribute].label),
                  el("span", { class: "following-row__followers" }, `${formatNumber(a.followers)} 팔로워`),
                ),
              ),
            ),
          ),
    ),
  );
}
