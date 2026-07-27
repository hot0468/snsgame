import type { GameContext } from "./context";
import { RECIPES, ingredientById } from "@/data/grocery";
import { el } from "@/utils/dom";

/**
 * 요리 도감 화면(크리처 도감과 같은 그릇 — ach-* 클래스 재사용).
 * 등록 판정은 systems/cooking.ts가 끝냈고(state.cookedDishes), 여기선 현황만 보여준다.
 * 미완성 요리는 이름을 가리되 **재료 조합은 보여준다** — 그게 곧 레시피 힌트다.
 */
export function renderCookingDexModal(ctx: GameContext): HTMLElement {
  const cooked = new Set(ctx.store.getState().cookedDishes);
  const n = RECIPES.filter((r) => cooked.has(r.id)).length;
  const total = RECIPES.length;
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🍳 요리 도감"),
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
        ...RECIPES.map((r) => {
          const got = cooked.has(r.id);
          const ings = r.ingredients
            .map((id) => {
              const ing = ingredientById(id);
              return ing ? `${ing.emoji} ${ing.name}` : id;
            })
            .join(" + ");
          return el(
            "div",
            { class: "ach-row" + (got ? "" : " ach-row--locked") },
            el("span", { class: "ach-row__emoji" }, got ? r.emoji : "❓"),
            el(
              "div",
              { class: "ach-row__copy" },
              el("div", { class: "ach-row__name" }, got ? r.name : "???"),
              el("div", { class: "ach-row__desc" }, ings),
            ),
          );
        }),
      ),
    ),
  );
}
