import type { GameContext } from "./context";
import { RESOURCE_STATS, RESOURCE_STAT_IDS, SKILL_STATS, SKILL_STAT_IDS } from "@/data/stats";
import { daysUntilRent, livingCostToday, rentAmount } from "@/systems/economy";
import { salaryOf } from "@/systems/employment";
import type { SkillStatId } from "@/core/types";
import { el, formatNumber } from "@/utils/dom";
import { statBar } from "./components";
import { icon, type IconName } from "./icons";
import { renderOfflineModal } from "./offlineModal";

/** 세부 스탯 아이콘 */
const SKILL_ICON: Record<SkillStatId, IconName> = {
  fitness: "dumbbell",
  beauty: "sparkle",
  vocabulary: "book",
  knowledge: "article",
  sociability: "heart",
  comedy: "smile",
  creativity: "pen",
  lewd: "shield",
  game: "gamepad",
};

/**
 * 시계 위에 상시 표시되는 스테이터스 팝업.
 * 기본은 행동력/정신력/도덕성, "상세 스탯"을 누르면 세부 스탯도 펼친다.
 */
let detailOpen = false;

/** 생활비/월세/재직 안내 */
function renderMoneyInfo(s: import("@/core/types").GameState): HTMLElement {
  const dRent = daysUntilRent(s);
  const rentText = dRent === 0 ? "오늘 납부일!" : `${dRent}일 후`;
  const rent = rentAmount(s);
  const living = livingCostToday(s);
  const emp = s.employment;

  return el(
    "div",
    {
      class: "money-info",
      style: s.money < 0 ? "color:var(--danger)" : "",
    },
    emp
      ? el(
          "div",
          { style: "color:var(--good);font-weight:700" },
          `재직: ${emp.company} · 월급 ${formatNumber(salaryOf(s))}원 (10일)`,
        )
      : null,
    el(
      "div",
      {},
      `월세 ${formatNumber(rent)}원 · ${rentText}` +
        (s.overdueRent > 0
          ? ` · 미납누적 ${formatNumber(s.overdueRent)}원(${s.unpaidRentStreak}/3)`
          : ""),
    ),
    el("div", {}, living > 0 ? `오늘 생활비 ${formatNumber(living)}원` : "오늘 생활비 면제(회사 복지)"),
    s.loan
      ? el(
          "div",
          { style: "color:var(--danger);font-weight:700" },
          `사채 ${formatNumber(s.loan.repayAmount)}원 · 상환 ${Math.max(0, s.loan.dueDay - s.day)}일 후`,
        )
      : null,
    s.money < 0 && !s.loan
      ? el("div", { style: "font-weight:700" }, "적자! 광고·취업으로 수익을 내세요")
      : null,
  );
}

/** 스테이터스 내용(제목 + 본문) — 팝업/도킹 패널이 공유한다. */
function statusInner(ctx: GameContext): HTMLElement[] {
  const s = ctx.store.getState();

  const resourceRows = RESOURCE_STAT_IDS.map((id) => {
    const def = RESOURCE_STATS[id];
    return statBar(def.label, s.resources[id], def.max, `bar__fill--${id}`);
  });

  // 세부 스탯은 스크롤 대신 왼쪽에 뜨는 팝오버로 표시한다.
  const detailPop = detailOpen
    ? el(
        "div",
        { class: "detail-pop" },
        el(
          "div",
          { class: "detail-pop__head" },
          el("span", { class: "detail-stats__title" }, "세부 스탯"),
          el(
            "button",
            {
              class: "detail-pop__close",
              title: "닫기",
              onclick: () => {
                detailOpen = false;
                ctx.refresh();
              },
            },
            "✕",
          ),
        ),
        ...SKILL_STAT_IDS.map((id) => {
          const def = SKILL_STATS[id];
          const val = Math.round(s.skills[id]);
          const pct = Math.round((Math.max(0, val) / def.max) * 100);
          return el(
            "div",
            { class: "detail-row" },
            el("span", { class: "detail-row__icon" }, icon(SKILL_ICON[id], { size: 13 })),
            el("span", { class: "detail-row__label" }, def.label),
            el(
              "div",
              { class: "bar bar--sm" },
              el("div", { class: "bar__fill bar__fill--skill", style: `width:${pct}%` }),
            ),
            el("span", { class: "detail-row__val" }, String(val)),
          );
        }),
      )
    : null;

  const nodes: HTMLElement[] = [
    el(
      "div",
      { class: "popup__title" },
      "스테이터스",
      el(
        "span",
        {
          class: "money-badge",
          style:
            "font-weight:700;font-size:12px;" +
            (s.money < 0 ? "color:var(--danger)" : ""),
        },
        icon("coin", { size: 14 }),
        `${formatNumber(s.money)}원`,
      ),
    ),
    el(
      "div",
      { class: "popup__body" },
      ...resourceRows,
      renderMoneyInfo(s),
      el(
        "button",
        {
          class: "link-btn",
          onclick: () => {
            detailOpen = !detailOpen;
            ctx.refresh();
          },
        },
        icon("chevron", { size: 14, className: detailOpen ? "chev chev--open" : "chev" }),
        detailOpen ? " 상세 스탯 닫기" : " 상세 스탯 보기",
      ),
    ),
  ];
  if (detailPop) nodes.push(detailPop);
  return nodes;
}

/** 시계 위에 떠 있는 팝업 형태(달력이 열리면 자리 양보) */
export function renderStatusPopup(ctx: GameContext): HTMLElement {
  return el("div", { class: "popup status-popup" }, ...statusInner(ctx));
}

/** 브라우저 오른쪽에 상시 도킹되는 스테이터스 패널 */
export function renderStatusDock(ctx: GameContext): HTMLElement {
  return el(
    "aside",
    { class: "status-dock" },
    ...statusInner(ctx),
    el(
      "div",
      { class: "status-dock__foot" },
      el(
        "button",
        { class: "life-btn", onclick: () => ctx.openModal(renderOfflineModal) },
        icon("walk", { size: 18 }),
        "현생살기",
      ),
    ),
  );
}
