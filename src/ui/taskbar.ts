import type { GameContext } from "./context";
import { clockLabel, timeLabel } from "@/systems/time";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 하단 작업표시줄.
 * 왼쪽: 윈도우(시작) 버튼 / 오른쪽: 시계.
 */
export function renderTaskbar(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();

  const startBtn = el(
    "button",
    {
      class: "start-btn",
      onclick: () => {
        ctx.ui.startMenuOpen = !ctx.ui.startMenuOpen;
        ctx.ui.calendarOpen = false;
        ctx.refresh();
      },
    },
    icon("grid", { size: 18 }),
    "메뉴",
  );

  const clockBtn = el(
    "button",
    {
      class: "clock-btn",
      onclick: () => {
        ctx.ui.calendarOpen = !ctx.ui.calendarOpen;
        if (ctx.ui.calendarOpen) ctx.ui.calendarMonthOffset = 0; // 열 때 이번 달로
        ctx.ui.startMenuOpen = false;
        ctx.refresh();
      },
    },
    icon("clock", { size: 18, className: "clock-btn__icon" }),
    el(
      "span",
      { class: "clock-btn__text" },
      el("span", {}, clockLabel(s)),
      el("span", { style: "opacity:0.7" }, timeLabel(s)),
    ),
  );

  return el(
    "footer",
    { class: "taskbar" },
    el("div", { class: "taskbar__left" }, startBtn),
    el("div", { class: "taskbar__right" }, clockBtn),
  );
}
