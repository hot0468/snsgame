import type { GameContext } from "./context";
import { CREATURES } from "@/data/creatures";
import { el } from "@/utils/dom";

/**
 * 크리처 도감 화면.
 * 수집 판정은 systems가 끝냈고(state.creatures), 여기선 수집 현황만 보여준다.
 * 미수집 크리처는 실루엣(emoji ❓ · 이름/설명 ???)으로 가린다. (업적 모달과 같은 그릇)
 */
export function renderCreaturesModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const collected = new Set(s.creatures);
  const n = CREATURES.filter((c) => collected.has(c.id)).length;
  const total = CREATURES.length;
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🔍 크리처 도감"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "ach-progress" },
        el("span", { class: "ach-progress__count" }, `${n} / ${total}`),
        el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
      ),
      el(
        "div",
        { class: "ach-list" },
        ...CREATURES.map((c) => {
          const got = collected.has(c.id);
          return el(
            "div",
            { class: "ach-row" + (got ? "" : " ach-row--locked") },
            el("span", { class: "ach-row__emoji" }, got ? c.emoji : "❓"),
            el(
              "div",
              { class: "ach-row__copy" },
              el("div", { class: "ach-row__name" }, got ? c.name : "???"),
              el("div", { class: "ach-row__desc" }, got ? c.desc : "???"),
            ),
          );
        }),
      ),
    ),
  );
}
