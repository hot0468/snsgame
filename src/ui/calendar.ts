import type { GameContext } from "./context";
import type { Appointment } from "@/core/types";
import { SLOT_LABELS } from "@/core/state";
import { dateOf } from "@/systems/time";
import { el } from "@/utils/dom";
import { icon, type IconName } from "./icons";

/** 약속 종류별 아이콘 */
const KIND_ICON: Record<Appointment["kind"], IconName> = {
  crew: "walk",
  friend: "smile",
  event: "star",
  ticketing: "ticket",
  groupRoom: "heart",
  lingerie: "camera",
  study: "book",
};

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

const DAY_MS = 86_400_000;

/**
 * 시계를 눌렀을 때 화면 중앙에 크게 뜨는 월간 달력.
 * 앞으로 예정된 '약속 일정'(정기런·친구 만남·행사)만 날짜 칸에 표시한다.
 */
export function renderCalendar(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();

  // 일차별 약속 그룹핑
  const byDay = new Map<number, Appointment[]>();
  for (const ev of s.appointments) {
    const list = byDay.get(ev.day) ?? [];
    list.push(ev);
    byDay.set(ev.day, list);
  }

  const close = () => {
    ctx.ui.calendarOpen = false;
    ctx.refresh();
  };
  const shiftMonth = (d: number) => {
    ctx.ui.calendarMonthOffset += d;
    ctx.refresh();
  };

  // 오늘(게임 날짜) 기준으로 보여줄 달을 계산
  const today = dateOf(s.day);
  const view = new Date(today.getFullYear(), today.getMonth() + ctx.ui.calendarMonthOffset, 1);
  const year = view.getFullYear();
  const month = view.getMonth();
  const firstWeekday = view.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayMid = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  // 요일 헤더
  const weekhead = el(
    "div",
    { class: "cal__weekdays" },
    ...WEEKDAYS.map((w, i) =>
      el(
        "div",
        { class: "cal__weekday" + (i === 0 ? " cal__weekday--sun" : i === 6 ? " cal__weekday--sat" : "") },
        w,
      ),
    ),
  );

  // 날짜 칸들
  const cells: HTMLElement[] = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push(el("div", { class: "cal__cell cal__cell--empty" }));
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const cellMid = new Date(year, month, d).getTime();
    const gameDay = s.day + Math.round((cellMid - todayMid) / DAY_MS);
    const events = byDay.get(gameDay) ?? [];
    const isToday = cellMid === todayMid;
    const wd = new Date(year, month, d).getDay();

    cells.push(
      el(
        "div",
        { class: "cal__cell" + (isToday ? " cal__cell--today" : "") },
        el(
          "div",
          {
            class:
              "cal__daynum" +
              (wd === 0 ? " cal__daynum--sun" : wd === 6 ? " cal__daynum--sat" : ""),
          },
          String(d),
        ),
        ...events.slice(0, 3).map((ev) =>
          el(
            "div",
            {
              class: `cal__event cal__event--appt-${ev.kind}`,
              title: `${SLOT_LABELS[ev.slot] ?? ""} ${ev.title}`,
            },
            icon(KIND_ICON[ev.kind], { size: 11 }),
            el("span", { class: "cal__event-txt" }, `${SLOT_LABELS[ev.slot] ?? ""} ${ev.title}`),
          ),
        ),
        events.length > 3
          ? el("div", { class: "cal__more" }, `+${events.length - 3}`)
          : null,
      ),
    );
  }

  const grid = el("div", { class: "cal__grid" }, ...cells);

  const header = el(
    "div",
    { class: "cal__head" },
    el("div", { class: "cal__title" }, `${year}년 ${month + 1}월`),
    el(
      "div",
      { class: "cal__nav" },
      el("button", { class: "cal__navbtn", title: "지난달", onclick: () => shiftMonth(-1) }, "‹"),
      el(
        "button",
        {
          class: "cal__navbtn cal__navbtn--today",
          title: "오늘",
          onclick: () => {
            ctx.ui.calendarMonthOffset = 0;
            ctx.refresh();
          },
        },
        "오늘",
      ),
      el("button", { class: "cal__navbtn", title: "다음달", onclick: () => shiftMonth(1) }, "›"),
      el("button", { class: "cal__navbtn cal__close", title: "닫기", onclick: close }, "✕"),
    ),
  );

  // 중앙 오버레이(배경 클릭 시 닫힘)
  return el(
    "div",
    {
      class: "cal-overlay",
      onclick: (e: Event) => {
        if (e.target === e.currentTarget) close();
      },
    },
    el("div", { class: "cal-modal" }, header, weekhead, grid),
  );
}
