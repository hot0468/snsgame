import type { GameContext } from "./context";
import { jobLevelRows } from "@/systems/jobLevels";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * '직업 보기' — 직업 도감. 스테이터스 독의 '상세 스탯 보기' 아래 버튼으로 연다.
 *
 * 크리처·요리 도감과 같은 그릇이다: **전 직업을 항상 보여주고** 안 해본 칸은 흐리게 잠근 채
 * '시작하는 법'만 알려준다. 계산은 전부 `systems/jobLevels.jobLevelRows`가 하고 여기선 그리기만 한다.
 */
export function renderJobLevelModal(ctx: GameContext): HTMLElement {
  const rows = jobLevelRows(ctx.store.getState());
  const done = rows.filter((r) => r.unlocked).length;
  const pct = rows.length > 0 ? Math.round((done / rows.length) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("article", { size: 18 }), "직업 도감"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      // 도감이므로 다른 도감과 같은 진행도 바를 쓴다(해본 직업 / 전체).
      el(
        "div",
        { class: "ach-progress" },
        el("span", { class: "ach-progress__count" }, `${done} / ${rows.length}`),
        el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
      ),
      el(
        "div",
        { class: "joblv-list" },
        ...rows.map((r) =>
          el(
            "div",
            {
              class:
                "joblv-row" +
                (r.active ? " joblv-row--on" : "") +
                (r.unlocked ? "" : " joblv-row--locked"),
            },
            el("span", { class: "joblv-row__emoji" }, r.unlocked ? r.emoji : "❓"),
            el(
              "div",
              { class: "joblv-row__copy" },
              el(
                "div",
                { class: "joblv-row__name" },
                r.label,
                r.active ? el("span", { class: "joblv-row__badge" }, "현재 직업") : null,
              ),
              el("div", { class: "joblv-row__desc" }, r.detail),
            ),
            // 안 해본 직업은 레벨 자리에 자물쇠를 둔다(Lv.0으로 두면 해본 것처럼 보인다).
            el("span", { class: "joblv-row__lv" }, r.unlocked ? `Lv.${r.level}` : "🔒"),
          ),
        ),
      ),
    ),
  );
}
