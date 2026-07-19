import type { GameContext } from "./context";
import type { Appointment } from "@/core/types";
import {
  CREW_RUN_ACTION_COST,
  GROUP_NIGHT_ACTION_COST,
  canLewdCosplay,
  dropAppointment,
  dueAppointments,
  resolveAppointment,
  resolveComiccon,
  ticketingTimeLimitMs,
  type ComicconMode,
} from "@/systems/appointments";
import { meetSuccessChance, resolveMeet } from "@/systems/relationship";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 제한시간(ms) → 안내 문구용 초 라벨(표시 전용).
 * 마우스 보너스가 100ms 단위라 소수점 1자리까지 보여준다(+마우스 1개 = +0.1초).
 * 3.0초처럼 딱 떨어지면 ".0"을 떼고 "3"으로 다듬는다.
 * ⚠️ 이 반올림은 문구에만 쓴다 — 타이머 바·판정은 원본 ms(limitMs)를 그대로 쓴다.
 */
function limitSecondsLabel(ms: number): string {
  return (ms / 1000).toFixed(1).replace(/\.0$/, "");
}

/**
 * 약속 당일 팝업.
 * - 도래한 약속이 하나면: 할지/말지 선택.
 * - 여러 개(시간 겹침)면: 먼저 어느 걸 살릴지 고르고, 고른 약속을 할지/말지 선택.
 * 시간대에 묶인 강제 선택이라 닫기 버튼은 없다.
 */
export function renderAppointmentModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  const due = dueAppointments(ctx.store.getState());
  if (due.length === 0) {
    // 방어적: 도래한 약속이 없으면 그냥 닫는다.
    queueMicrotask(() => ctx.closeModal());
    return container;
  }

  if (due.length > 1) showConflict(due);
  else showGoSkip(due[0]);

  /** 시간 겹침: 어느 약속을 살릴지 고른다. */
  function showConflict(list: Appointment[]): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("clock", { size: 18 }), "스케쥴이 겹쳐요"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 16px" },
          "같은 시간에 약속이 겹쳤어요. 한 쪽만 갈 수 있어요. 어느 스케쥴을 살릴까요?",
        ),
        ...list.map((appt) =>
          el(
            "button",
            {
              class: "event-choice",
              onclick: () => {
                // 고른 것만 남기고 나머지는 취소
                ctx.update((s) => {
                  for (const other of list) {
                    if (other.id !== appt.id) {
                      const live = s.appointments.find((a) => a.id === other.id);
                      if (live) dropAppointment(s, live);
                    }
                  }
                });
                showGoSkip(appt);
              },
            },
            appt.title,
          ),
        ),
        el(
          "button",
          {
            class: "event-choice",
            style: "opacity:.8",
            onclick: () => {
              let cancelled = 0;
              ctx.update((s) => {
                for (const appt of list) {
                  const live = s.appointments.find((a) => a.id === appt.id);
                  if (live) {
                    resolveAppointment(s, live, false);
                    cancelled += 1;
                  }
                }
              });
              showResult(`오늘은 아무 데도 가지 않기로 했다. (약속 ${cancelled}건 취소)`);
            },
          },
          "둘 다 안 갈래",
        ),
      ),
    );
  }

  /** 단일 약속: 할지/말지 (코믹콘은 참여 방식 선택, 티켓팅은 좌석 미니게임) */
  function showGoSkip(appt: Appointment): void {
    if (appt.charId) return showRelMeet(appt);
    if (appt.kind === "ticketing") return showTicketing(appt);
    if (appt.variant === "comiccon") return showComiccon(appt);
    const action = ctx.store.getState().resources.action;
    const needAction =
      appt.kind === "crew"
        ? CREW_RUN_ACTION_COST
        : appt.kind === "groupRoom"
          ? GROUP_NIGHT_ACTION_COST
          : 10;
    const canGo = action >= needAction;

    const prompt =
      appt.kind === "crew"
        ? "목요일 저녁, 러닝크루 정기런 시간이다. 체력 부담은 적지만 함께 뛰면 운동 효과가 쏠쏠하다. 오늘 나갈까?"
        : appt.kind === "groupRoom"
          ? "토요일 심야, 그룹방 정기 모임 시간이다. 단톡에 찍힌 장소로 가면 인원이 모여 교대 플레이가 이어진다. 오늘 나갈까?"
          : appt.kind === "event"
            ? `오늘은 「${appt.title}」 날이다. 행사에 참여하러 갈까?`
            : `${appt.partnerName ?? "친구"}와 만나기로 한 날이다. 오늘 만나러 갈까?`;

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), appt.title),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.6;margin:0 0 16px" }, prompt),
        el(
          "button",
          {
            class: "event-choice",
            disabled: !canGo,
            onclick: () => {
              if (!canGo) return;
              resolve(appt, true);
            },
          },
          canGo ? `간다 (행동력 -${needAction})` : "행동력이 부족해 못 감",
        ),
        el(
          "button",
          { class: "event-choice", onclick: () => resolve(appt, false) },
          "오늘은 안 간다",
        ),
      ),
    );
  }

  /** 관계 캐릭터와의 만남 약속: 만나러 갈지 고른다. 발동 시 resolveMeet가 성사/바람맞음을 판정한다. */
  function showRelMeet(appt: Appointment): void {
    const name = appt.partnerName ?? "친구";
    const chance = Math.round(meetSuccessChance(ctx.store.getState()) * 100);
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), appt.title),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 8px" },
          `${name}와 만나기로 한 날이다. 나가면 성사될 수도, 바람맞을 수도 있다.`,
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin:0 0 16px" },
          `성사 확률 ${chance}% · 성사하면 호감도가 크게 오른다`,
        ),
        el(
          "button",
          { class: "event-choice", onclick: () => resolveRelMeet(appt) },
          "만나러 간다",
        ),
        el(
          "button",
          { class: "event-choice", onclick: () => resolveRelMeet(appt, true) },
          "오늘은 안 나간다",
        ),
      ),
    );
  }

  /** 관계 만남 확정 — resolveMeet 판정 후 약속을 제거하고 결과 문구를 보여준다. */
  function resolveRelMeet(appt: Appointment, skip = false): void {
    const name = appt.partnerName ?? "친구";
    let msg = "";
    ctx.update((s) => {
      s.appointments = s.appointments.filter((a) => a.id !== appt.id);
      if (skip) {
        msg = `${name}에게 오늘은 못 나갈 것 같다고 양해를 구했다.`;
        return;
      }
      const r = resolveMeet(s, appt.charId!);
      msg = r.success
        ? `${name}을(를) 만나 즐거운 시간을 보냈다. 부쩍 가까워진 기분이다. (호감도 +${r.gain})`
        : `한참을 기다렸지만 ${name}은(는) 끝내 나오지 않았다... 바람맞았다. (호감도 +${r.gain})`;
      if (r.pending !== null) msg += "\n\n카톡에 새 이벤트가 도착했다!";
    });
    showResult(msg);
  }

  /** 티켓팅 도입: 좌석 미니게임을 시작할지, 포기할지 */
  function showTicketing(appt: Appointment): void {
    const eventTitle = appt.ticketFor?.title ?? appt.title;
    const secs = limitSecondsLabel(ticketingTimeLimitMs(ctx.store.getState()));
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("clock", { size: 18 }), appt.title),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 16px" },
          `「${eventTitle}」 티켓 오픈일이다! 좌석표가 뜨면 ${secs}초 안에 반짝이는(예매 가능) 좌석 하나를 클릭해야 성공해요. 성공해야 관람 일정이 잡힙니다. 준비됐나요?`,
        ),
        el("button", { class: "event-choice", onclick: () => showSeatGame(appt) }, "티켓팅 시작"),
        el("button", { class: "event-choice", style: "opacity:.85", onclick: () => resolve(appt, false) }, "포기한다"),
      ),
    );
  }

  /** 좌석 미니게임: 제한시간 안에 반짝이는 좌석을 클릭하면 티켓팅 성공. */
  function showSeatGame(appt: Appointment): void {
    // 타이머 바·판정·안내 문구가 모두 이 한 값을 쓴다(시각과 판정이 어긋나지 않게).
    const limitMs = ticketingTimeLimitMs(ctx.store.getState());
    let resolved = false;
    let timer = 0;
    const finish = (won: boolean): void => {
      if (resolved) return;
      resolved = true;
      window.clearTimeout(timer);
      resolve(appt, won);
    };

    const ROWS = 6;
    const COLS = 10;
    const TOTAL = ROWS * COLS;
    const OPEN = 5;
    const openSet = new Set<number>();
    while (openSet.size < OPEN) openSet.add(Math.floor(Math.random() * TOTAL));

    const seats = Array.from({ length: TOTAL }, (_, i) => {
      const open = openSet.has(i);
      return el("button", {
        class: "seat" + (open ? " seat--open" : " seat--taken"),
        disabled: !open,
        onclick: open ? () => finish(true) : undefined,
      });
    });

    const bar = el("div", { class: "ticket-timer__bar" });

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("clock", { size: 18 }), appt.title),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:14.5px;font-weight:700;margin:0 0 10px;text-align:center" },
          `🎫 좌석 오픈! ${limitSecondsLabel(limitMs)}초 안에 반짝이는 좌석을 클릭!`,
        ),
        el("div", { class: "ticket-screen" }, "S  C  R  E  E  N"),
        el(
          "div",
          { class: "seat-grid", style: `grid-template-columns: repeat(${COLS}, 1fr)` },
          ...seats,
        ),
        el("div", { class: "ticket-timer" }, bar),
      ),
    );

    // 타이머 바 + 시간 초과 시 실패 (둘 다 limitMs 기준)
    requestAnimationFrame(() => {
      bar.style.transition = `width ${limitMs}ms linear`;
      bar.style.width = "0%";
    });
    timer = window.setTimeout(() => finish(false), limitMs);
  }

  /** 코믹콘: 참관객/부스/코스프레 중 선택 */
  function showComiccon(appt: Appointment): void {
    const s = ctx.store.getState();
    const action = s.resources.action;
    const lewdOk = canLewdCosplay(s);

    const choice = (label: string, need: number, onPick: () => void, sub?: string) => {
      const enough = action >= need;
      return el(
        "button",
        {
          class: "event-choice",
          disabled: !enough,
          onclick: () => {
            if (enough) onPick();
          },
        },
        el("div", { style: "font-weight:700" }, `${label} (행동력 -${need})`),
        sub ? el("div", { class: "compose-hint", style: "margin:2px 0 0" }, sub) : null,
      );
    };

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("book", { size: 18 }), "코믹콘"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0 0 14px" },
          "코믹콘 현장에 도착했다! 오늘은 어떻게 참여할까?",
        ),
        choice("참관객으로 즐긴다", 8, () => resolveMode(appt, "visitor"), "굿즈를 구경하고 구매하며 즐긴다"),
        choice("부스를 차린다", 15, () => resolveMode(appt, "booth"), "직접 만든 창작물을 판매한다"),
        choice("코스프레로 참가한다", 12, () => resolveMode(appt, "cosplay"), "의상을 갖춰 입고 현장을 누빈다"),
        lewdOk
          ? choice(
              "노출 심한 코스프레로 참가한다",
              12,
              () => resolveMode(appt, "cosplayLewd"),
              "과감한 노출 의상으로 시선을 사로잡는다",
            )
          : null,
        el(
          "button",
          { class: "event-choice", style: "opacity:.85", onclick: () => resolve(appt, false) },
          "오늘은 안 간다",
        ),
      ),
    );
  }

  function resolveMode(appt: Appointment, mode: ComicconMode): void {
    let msg = "";
    ctx.update((s) => {
      const live = s.appointments.find((a) => a.id === appt.id);
      if (live) msg = resolveComiccon(s, live, mode).message;
    });
    showResult(msg);
  }

  function resolve(appt: Appointment, go: boolean): void {
    let msg = "";
    ctx.update((s) => {
      const live = s.appointments.find((a) => a.id === appt.id);
      if (live) msg = resolveAppointment(s, live, go).message;
    });
    showResult(msg);
  }

  function showResult(result: string): void {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "약속"),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.6;margin:0 0 18px" }, result),
        el(
          "div",
          { style: "text-align:right" },
          el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
        ),
      ),
    );
  }

  return container;
}
