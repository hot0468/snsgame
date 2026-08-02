import type { GameContext } from "./context";
import { endingDexProgress, endingDexRows } from "@/systems/endingDex";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * '엔딩 보기' — 엔딩 도감. 직업 도감과 같은 그릇이다.
 *
 * 엔딩이 열두 갈래나 있는데 **뭐가 있는지도 어떻게 여는지도 알 방법이 없었다.**
 * 여기서는 전 칸을 항상 보여주되, 못 본 엔딩은 제목만 가리고 여는 법은 알려준다 —
 * 힌트까지 가리면 목표가 안 되고, 제목까지 드러내면 발견의 재미가 없다.
 *
 * ⚠️ 본 엔딩 기록은 **게임 상태가 아니라 localStorage**에 있다(systems/endingDex).
 *    엔딩을 보면 그 판이 끝나므로 상태에 두면 새 게임마다 도감이 비워진다.
 */
export function renderEndingDexModal(ctx: GameContext): HTMLElement {
  const state = ctx.store.getState();
  const rows = endingDexRows(state);
  const { seen, total } = endingDexProgress(state);
  const pct = total > 0 ? Math.round((seen / total) * 100) : 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), "엔딩 도감"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "ach-progress" },
        el("span", { class: "ach-progress__count" }, `${seen} / ${total}`),
        el("div", { class: "bar" }, el("div", { class: "bar__fill", style: `width:${pct}%` })),
      ),
      el(
        "p",
        { class: "compose-hint", style: "margin:8px 0 12px" },
        "본 엔딩은 제목이 드러납니다. 도감은 새 게임을 시작해도 남습니다.",
      ),
      el(
        "div",
        { class: "joblv-list" },
        ...rows.map((r) =>
          el(
            "div",
            { class: "joblv-row" + (r.seen ? "" : " joblv-row--locked") },
            el("span", { class: "joblv-row__emoji" }, r.seen ? "🏁" : "❓"),
            el(
              "div",
              { class: "joblv-row__copy" },
              el(
                "div",
                { class: "joblv-row__name" },
                r.title,
                // 지금 조건을 채운 엔딩은 표시해 준다 — "지금 고르면 끝난다"를 모르고 지나치면 곤란하다.
                r.ready && !r.seen
                  ? el("span", { class: "joblv-row__badge" }, "지금 가능")
                  : null,
              ),
              el("div", { class: "joblv-row__desc" }, r.hint),
            ),
            el("span", { class: "joblv-row__lv" }, r.seen ? "✔" : "🔒"),
          ),
        ),
      ),
    ),
  );
}
