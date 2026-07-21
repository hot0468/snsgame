import type { GameContext } from "./context";
import { clockLabel, timeLabel } from "@/systems/time";
import { hasPendingRelEvent } from "@/systems/relationship";
import { hasPendingWorkMsg } from "@/systems/workMessenger";
import { el } from "@/utils/dom";
import { icon } from "./icons";
import { renderKakaoListView } from "./kakaoListView";
import { renderWorkMessengerView } from "./workMessengerView";

/**
 * 하단 작업표시줄.
 * 왼쪽: 윈도우(시작) 버튼 / 가운데: 카톡(관계) / 오른쪽: 시계.
 */
export function renderTaskbar(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();

  const kakaoBtn = el(
    "button",
    {
      class: "taskbar-kakao",
      title: "카톡 친구",
      onclick: () => ctx.openModal(renderKakaoListView),
    },
    el("span", { class: "taskbar-kakao__icon" }, icon("comment", { size: 16 })),
    hasPendingRelEvent(s) ? el("span", { class: "taskbar-kakao__badge" }) : null,
  );

  const workBtn = el(
    "button",
    {
      class: "taskbar-kakao taskbar-work",
      title: "너아무튼온 (업무 메신저)",
      onclick: () => {
        ctx.update((st) => {
          for (const m of st.workMsgs) m.toastPending = false;
        });
        ctx.openModal(renderWorkMessengerView);
      },
    },
    el("span", { class: "taskbar-kakao__icon taskbar-work__icon" }, icon("mail", { size: 16 })),
    hasPendingWorkMsg(s) ? el("span", { class: "taskbar-kakao__badge" }) : null,
  );

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
    "시작",
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
      el(
        "span",
        { class: `clock-btn__slot clock-btn__slot--${["morning", "late"][s.slot] ?? "morning"}` },
        timeLabel(s),
      ),
    ),
  );

  return el(
    "footer",
    { class: "taskbar" },
    el("div", { class: "taskbar__left" }, startBtn),
    el("div", { class: "taskbar__center" }, kakaoBtn, workBtn),
    el("div", { class: "taskbar__right" }, clockBtn),
  );
}
