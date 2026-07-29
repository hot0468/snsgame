import type { GameContext } from "./context";
import { DOLLS } from "@/data/arcade";
import { el } from "@/utils/dom";

/**
 * 인형 도감 화면(크리처·요리 도감과 같은 그릇 — ach-* 클래스 재사용).
 * 수집 판정은 systems/arcade.ts가 끝냈고(state.dolls), 여기선 현황만 보여준다.
 * 미수집 인형은 이름·설명을 가리되 **등급은 보여준다** — 어느 레인을 노려야 하는지가 힌트다.
 */
export function renderDollDexModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const got = new Set(s.dolls);
  const n = DOLLS.filter((d) => got.has(d.id)).length;
  const total = DOLLS.length;
  const pct = total > 0 ? Math.round((n / total) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🧸 인형 도감"),
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
        ...DOLLS.map((d) => {
          const has = got.has(d.id);
          const stock = s.dollStock[d.id] ?? 0;
          const grade = d.rarity === "rare" ? "레어" : "일반";
          return el(
            "div",
            { class: "ach-row" + (has ? "" : " ach-row--locked") },
            el("span", { class: "ach-row__emoji" }, has ? d.emoji : "❓"),
            el(
              "div",
              { class: "ach-row__copy" },
              el(
                "div",
                { class: "ach-row__name" },
                has ? d.name : "???",
                stock > 0 ? el("span", { class: "inv-row__count" }, `여분 ×${stock}`) : null,
              ),
              el("div", { class: "ach-row__desc" }, has ? d.desc : `${grade} 인형`),
            ),
          );
        }),
      ),
    ),
  );
}
