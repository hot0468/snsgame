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
                // 경력 등급 — 숫자 레벨과 달리 정점이 있는 사다리라, 지금 어디쯤인지가 보인다.
                r.rankTitle
                  ? el("span", { class: "joblv-row__badge" }, `${r.rankTitle}${r.peaked ? " 👑" : ""}`)
                  : null,
                r.active ? el("span", { class: "joblv-row__badge" }, "현재 직업") : null,
              ),
              el(
                "div",
                { class: "joblv-row__desc" },
                r.detail +
                  (r.unlocked && r.toNextRank != null ? ` · 다음 등급까지 ${r.toNextRank}회` : ""),
              ),
            ),
            // 안 해본 직업은 레벨 자리에 자물쇠를 둔다(Lv.0으로 두면 해본 것처럼 보인다).
            el("span", { class: "joblv-row__lv" }, r.unlocked ? `Lv.${r.level}` : "🔒"),
          ),
        ),
      ),
      awardsSection(ctx),
    ),
  );
}

/**
 * 수상 이력 — 연말 시상식(12/29 송년회 · 12/30 방송미디어대상)에서 받은 상.
 *
 * ⚠️ 이게 없으면 시상식이 **팝업 한 번 보고 끝**이다. 상패가 남지 않으면 트로피가 아니라
 *    그냥 지나가는 이벤트가 된다 — 전국체전 우승 횟수를 스테이터스에 남기는 것과 같은 이유다.
 *    (실제로 `awardsWon`을 기록만 해두고 아무 데도 안 보여준 채로 한 번 냈다.)
 */
function awardsSection(ctx: GameContext): HTMLElement | null {
  const won = ctx.store.getState().awardsWon ?? [];
  if (won.length === 0) return null;

  // 최근 해가 위로. 같은 해 안에서는 대상을 먼저 둔다.
  const sorted = [...won].sort((a, b) => b.year - a.year || Number(b.grand) - Number(a.grand));
  const grandCount = sorted.filter((w) => w.grand).length;

  return el(
    "div",
    { style: "margin-top:18px" },
    el(
      "div",
      { class: "joblv-row__name", style: "margin-bottom:8px" },
      "🏆 수상 이력",
      el(
        "span",
        { class: "joblv-row__badge" },
        `${sorted.length}회${grandCount > 0 ? ` · 대상 ${grandCount}` : ""}`,
      ),
    ),
    el(
      "div",
      { class: "joblv-list" },
      ...sorted.map((w) =>
        el(
          "div",
          { class: "joblv-row" },
          el("span", { class: "joblv-row__emoji" }, w.grand ? "🏆" : "🎖️"),
          el(
            "div",
            { class: "joblv-row__copy" },
            el(
              "div",
              { class: "joblv-row__name" },
              w.label,
              w.grand ? el("span", { class: "joblv-row__badge" }, "대상") : null,
            ),
            el("div", { class: "joblv-row__desc" }, `${w.year}년`),
          ),
        ),
      ),
    ),
  );
}
