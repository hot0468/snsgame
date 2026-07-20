import type { GameContext } from "./context";
import { ACHIEVEMENTS } from "@/data/achievements";
import { achievementProgress } from "@/systems/achievements";
import { el } from "@/utils/dom";

/**
 * 업적(도전과제) 화면.
 * 판정은 systems가 끝냈고(state.achievements) 여기선 수집 현황만 보여준다.
 * hidden 업적은 달성 전엔 이름/설명/emoji를 ???/❓로 가린다.
 */
export function renderAchievementsModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const done = new Set(s.achievements);
  const { done: n, total } = achievementProgress(s);
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🏆 업적"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "ach-progress" },
        el("span", { class: "ach-progress__count" }, `${n} / ${total}`),
        el(
          "div",
          { class: "bar" },
          el("div", { class: "bar__fill", style: `width:${pct}%` }),
        ),
      ),
      el(
        "div",
        { class: "ach-list" },
        ...ACHIEVEMENTS.filter((a) => s.adultMode || !a.adult).map((a) => {
          const unlocked = done.has(a.id);
          const veil = a.hidden && !unlocked; // 히든 미달성 → 가림
          return el(
            "div",
            { class: "ach-row" + (unlocked ? "" : " ach-row--locked") },
            el("span", { class: "ach-row__emoji" }, veil ? "❓" : a.emoji),
            el(
              "div",
              { class: "ach-row__copy" },
              el("div", { class: "ach-row__name" }, veil ? "???" : a.name),
              el("div", { class: "ach-row__desc" }, veil ? "???" : a.desc),
            ),
          );
        }),
      ),
    ),
  );
}
