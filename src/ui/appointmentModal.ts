import type { GameContext } from "./context";
import {
  AFFAIR_ACTION_COST,
  endAffair,
  goAffairMeet,
  type AffairMeetResult,
} from "@/systems/affair";
import { simpleResultModal } from "./sns/snsPages";
import { clampAction } from "@/systems/stats";
import { advanceTime } from "@/systems/time";
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
import {
  REL_STAGE_THRESHOLDS,
  meetSuccessChance,
  relStateOf,
  resolveMeet,
} from "@/systems/relationship";
import { canOfferPrivateCrew, joinPrivateCrew } from "@/systems/crew";
import { PRIVATE_CREW_INVITE } from "@/data/crewSecret";
import { renderCrewSecretModal } from "./sns/crewSecretModal";
import { renderClubSessionModal } from "./sns/clubSessionModal";
import { CLUB_SESSION_ACTION_COST } from "@/systems/privateClub";
import { renderScenarioReaderModal } from "./sns/scenarioReader";
import { pickLingerieScenario, resolveLingerieShoot } from "@/systems/lingerie";
import { resolveStudy } from "@/systems/studyGroup";
import { resolveEsthetic } from "@/systems/esthetic";
import { postTweet } from "@/systems/tweetSystem";
import { pick } from "@/utils/random";
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
        : appt.kind === "privateClub"
          ? CLUB_SESSION_ACTION_COST
          : appt.kind === "groupRoom"
            ? GROUP_NIGHT_ACTION_COST
            : appt.kind === "affair"
              ? AFFAIR_ACTION_COST
            : 10;
    const canGo = action >= needAction;

    const prompt =
      appt.kind === "crew"
        ? "목요일 낮, 러닝크루 정기런 시간이다. 체력 부담은 적지만 함께 뛰면 운동 효과가 쏠쏠하다. 오늘 나갈까?"
        : appt.kind === "privateClub"
        ? "화요일 심야, 비공개 클럽 세션이다. 문자로 찍힌 주소로 가면 오늘의 규율이 기다린다. 나갈까?"
        : appt.kind === "groupRoom"
          ? "토요일 심야, 그룹방 정기 모임 시간이다. 단톡에 찍힌 장소로 가면 인원이 모여 교대 플레이가 이어진다. 오늘 나갈까?"
          : appt.kind === "lingerie"
            ? "심야, 이번 주 란제리 화보 촬영 스케줄이다. 스튜디오에 조명이 켜져 있다. 촬영하러 갈까?"
            : appt.kind === "study"
              ? "월요일 낮, 취업스터디 정기 모임 날이다. 같은 처지 사람들과 자소서를 다듬고 모의면접을 본다. 오늘 나갈까?"
              : appt.kind === "esthetic"
              ? "이번 주 에스테틱 방문일이다. 1만원 내고 관리받으면 꾸미기 매력이 더 잘 오른다. 오늘 다녀올까?"
              : appt.kind === "event"
              ? `오늘은 「${appt.title}」 날이다. 행사에 참여하러 갈까?`
              : appt.kind === "affair"
              ? affairPrompt(ctx)
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
              if (appt.kind === "crew") return handleCrewGo(appt);
              if (appt.kind === "privateClub") return ctx.openModal(renderClubSessionModal);
              if (appt.kind === "lingerie") return handleLingerieGo();
              if (appt.kind === "study") return handleStudyGo(appt);
              if (appt.kind === "esthetic") return handleEstheticGo(appt);
              if (appt.kind === "affair") return handleAffairGo();
              resolve(appt, true);
            },
          },
          canGo ? `간다 (행동력 -${needAction})` : "행동력이 부족해 못 감",
        ),
        el(
          "button",
          {
            class: "event-choice",
            // 외도의 '안 간다'는 단순 불참이 아니라 **관계를 끊는 선택**이다. 다시 안 잡힌다.
            onclick: () => (appt.kind === "affair" ? handleAffairSkip() : resolve(appt, false)),
          },
          appt.kind === "affair" ? "안 나간다 (여기서 끝낸다)" : "오늘은 안 간다",
        ),
      ),
    );
  }

  /** 관계 캐릭터와의 만남 약속: 만나러 갈지 고른다. 발동 시 resolveMeet가 성사/바람맞음을 판정한다. */
  function showRelMeet(appt: Appointment): void {
    const name = appt.partnerName ?? "친구";
    // 확정 약속(내가 제안 → 상대 수락)은 당일 무조건 성사 — 바람맞음 안내를 띄우지 않는다.
    const chance = Math.round(meetSuccessChance(ctx.store.getState()) * 100);
    const intro = appt.confirmed
      ? `${name}와 만나기로 약속한 날이다. 나가면 즐거운 시간을 보낼 것이다.`
      : `${name}와 만나기로 한 날이다. 나가면 성사될 수도, 바람맞을 수도 있다.`;
    const hint = appt.confirmed
      ? "약속 확정 · 만나면 호감도가 크게 오른다"
      : `성사 확률 ${chance}% · 성사하면 호감도가 크게 오른다`;
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
          intro,
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin:0 0 16px" },
          hint,
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

  /**
   * 만남 직후 호감도 게이지 — 이번 만남으로 오른 몫(gain)만 진한 색으로 덧붙여 차오른다.
   * 눈금은 **다음 관계 이야기가 열리는 임계**(REL_STAGE_THRESHOLDS[stage])라 "얼마나 남았나"가 바로 읽힌다.
   */
  function affinityGauge(charId: string, name: string, gain: number): HTMLElement {
    const rel = relStateOf(ctx.store.getState(), charId);
    const goal = REL_STAGE_THRESHOLDS[rel.stage] ?? 90; // 완주(stage 3)면 마지막 임계를 그대로 눈금으로
    const pct = (v: number): number => Math.min(v / goal, 1) * 100;
    const beforePct = pct(rel.affinity - gain);
    // 오른 몫은 0에서 시작해 차오르게 한다(모달 노드는 캐시되므로 재렌더에 애니메이션이 끊기지 않는다).
    const grown = el("div", {
      class: "bar__fill",
      style: "width:0;height:100%;transition:width .7s ease-out",
    });
    requestAnimationFrame(() => {
      grown.style.width = `${pct(rel.affinity) - beforePct}%`;
    });
    const left = goal - rel.affinity;
    return el(
      "div",
      { style: "margin:0 0 18px" },
      el(
        "div",
        {
          style:
            "display:flex;justify-content:space-between;font-size:12.5px;color:var(--text-muted);margin-bottom:6px",
        },
        el("span", {}, `${name} 호감도`),
        el(
          "span",
          { style: "font-variant-numeric:tabular-nums" },
          `${rel.affinity - gain} → ${rel.affinity} (+${gain})`,
        ),
      ),
      el(
        "div",
        { class: "bar" },
        el(
          "div",
          { style: "display:flex;height:100%" },
          el("div", { class: "bar__fill--skill", style: `width:${beforePct}%;height:100%` }),
          grown,
        ),
      ),
      el(
        "div",
        { class: "compose-hint", style: "margin-top:6px" },
        rel.stage >= 3
          ? "관계 완주 — 더 볼 이야기가 없다"
          : left > 0
            ? `다음 이야기까지 ${left}`
            : "새 이야기가 열렸다!",
      ),
    );
  }

  /** 관계 만남 확정 — resolveMeet 판정 후 약속을 제거하고 결과 문구·호감도 게이지를 보여준다. */
  function resolveRelMeet(appt: Appointment, skip = false): void {
    const name = appt.partnerName ?? "친구";
    let msg = "";
    let met = false;
    let gain = 0;
    ctx.update((s) => {
      s.appointments = s.appointments.filter((a) => a.id !== appt.id);
      if (skip) {
        msg = `${name}에게 오늘은 못 나갈 것 같다고 양해를 구했다.`;
        return;
      }
      const r = resolveMeet(s, appt.charId!, appt.confirmed ?? false);
      met = r.success;
      gain = r.gain;
      msg = r.success
        ? `${name}을(를) 만나 즐거운 시간을 보냈다. 부쩍 가까워진 기분이다.`
        : `한참을 기다렸지만 ${name}은(는) 끝내 나오지 않았다... 바람맞았다.`;
      if (r.pending !== null) msg += "\n\n카톡에 새 이벤트가 도착했다!";
    });
    // 수치는 게이지가 말한다(문구의 "(호감도 +N)"은 뺐다). 안 나간 날은 오른 게 없으니 게이지도 없다.
    showResult(msg, met ? appt : undefined, skip ? undefined : affinityGauge(appt.charId!, name, gain));
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
    showResult(msg, appt); // 코믹콘 참가 = 다녀옴 → 후기 트윗 가능
  }

  /**
   * 크루 정기런 "간다" 분기.
   * ① 비공개 크루 가입자 → 일반 정기런 대신 SM 규율 시나리오 모달.
   * ② 가입 조건 충족(체벌 트윗 10회 등) → 가입 권유 프롬프트.
   * ③ 그 외 → 기존 일반 정기런.
   */
  /**
   * 란제리 정기 촬영 "간다" 분기 → 강제 이수 시나리오 리더.
   * 시나리오를 여기서 한 번 확정하고, resolve에 같은 시나리오를 바인딩한다.
   * 재예약/시간진행/촬영비는 resolveLingerieShoot가 처리한다.
   */
  function handleLingerieGo(): void {
    const scenario = pickLingerieScenario();
    ctx.openModal((c) =>
      renderScenarioReaderModal(c, {
        headTitle: "란제리 화보 촬영",
        scenario,
        resolve: (s, idx) => resolveLingerieShoot(s, scenario, idx),
      }),
    );
  }

  /**
   * 취업스터디 정기 모임 "간다" 분기.
   * resolveStudy가 스탯 상승·행동력 소모·시간진행·다음 주 재예약을 모두 처리한다 —
   * UI는 결과 문구만 보여준다(크루의 resolveAppointment 역할을 study는 resolveStudy가 대신).
   */
  function handleStudyGo(appt: Appointment): void {
    let msg = "";
    ctx.update((s) => {
      msg = resolveStudy(s);
    });
    showResult(msg, appt);
  }

  /**
   * 에스테틱 정기 방문 "간다" 분기.
   * 유부남 외도 — 회차마다 문구가 다르다. 몇 번째인지 보여줘야 "이제 그만"이 선택이 된다.
   *
   * ⚠️ 남은 횟수를 숫자로 알려주지 않는다. 4번째에 무슨 일이 나는지 미리 알려주면
   *    그건 경고지 갈림길이 아니다. 대신 회차가 쌓일수록 문구가 무거워진다.
   */
  function affairPrompt(c: GameContext): string {
    const next = (c.store.getState().affair?.meetCount ?? 0) + 1;
    if (next === 1) return "그 사람이 잡은 첫 약속 날이다. 심야, 그가 보낸 방 번호가 문자로 와 있다. 나갈까?";
    if (next === 2) return "또 그 요일이다. 문자는 방 번호 네 자리뿐이었다. 오늘도 나갈까?";
    if (next === 3)
      return "세 번째다. 이제 묻지 않아도 시간과 장소를 안다. 그만둘 거면 오늘이 나을 텐데, 나갈까?";
    return "또 목요일이다. 이쯤 되면 이게 무엇으로 끝날지 스스로도 알고 있다. 그래도 나갈까?";
  }

  /** 외도 약속에 나간다 — 회차 씬을 보여주고, 4회차면 그대로 게임 오버로 이어진다. */
  function handleAffairGo(): void {
    let result: AffairMeetResult | null = null;
    ctx.update((st) => {
      st.resources.action = clampAction(st, st.resources.action - AFFAIR_ACTION_COST);
      result = goAffairMeet(st);
      advanceTime(st, 1);
    });
    if (!result) return ctx.closeModal();
    const r = result as AffairMeetResult;
    // 발각(게임 오버)이면 app이 게임 오버 화면을 띄우므로 여기선 씬만 보여주고 닫는다.
    ctx.openModal(() => simpleResultModal(ctx, r.scene.title, r.scene.text));
  }

  /** 외도를 끊는다 — 다음 약속이 다시 잡히지 않는다. */
  function handleAffairSkip(): void {
    let line = "";
    ctx.update((st) => {
      line = endAffair(st);
    });
    ctx.openModal(() => simpleResultModal(ctx, "그만두기로 했다", line));
  }

  /**
   * resolveEsthetic이 방문비·매력·시간진행·다음 주 재예약을 모두 처리한다(study 패턴).
   */
  function handleEstheticGo(appt: Appointment): void {
    let msg = "";
    ctx.update((s) => {
      msg = resolveEsthetic(s);
    });
    showResult(msg, appt);
  }

  /**
   * 러닝 정기런.
   *
   * ⚠️ 여기서 뜨는 SM 규율은 **러닝크루의 안쪽 모임**(훈련 미달 → 체벌)이다.
   *    운동과 무관한 체벌 모임인 비공개 클럽은 화요일 심야 별도 일정(`privateClub`)으로
   *    따로 열린다 — 둘을 같은 자리에서 처리하지 마라.
   */
  function handleCrewGo(appt: Appointment): void {
    const s = ctx.store.getState();
    if (s.privateCrewJoined) {
      ctx.openModal(renderCrewSecretModal);
      return;
    }
    if (canOfferPrivateCrew(s)) {
      showCrewInvite(appt);
      return;
    }
    resolve(appt, true);
  }

  /**
   * 비공개 크루 가입 권유(PRIVATE_CREW_INVITE 서사 리더).
   * 가입 → joinPrivateCrew 후 오늘은 일반 정기런 진행(다음 주부터 비공개).
   * 거절 → 일반 정기런.
   */
  function showCrewInvite(appt: Appointment): void {
    const pages = PRIVATE_CREW_INVITE.pages;
    let pageIndex = 0;

    const render = (): void => {
      const isLast = pageIndex === pages.length - 1;
      container.replaceChildren(
        el(
          "div",
          { class: "modal__head" },
          el("span", { class: "modal__head-title" }, icon("walk", { size: 18 }), PRIVATE_CREW_INVITE.title),
        ),
        el(
          "div",
          { class: "modal__body" },
          el("p", { style: "font-size:15px;line-height:1.7;margin:0 0 16px;white-space:pre-wrap" }, pages[pageIndex]),
          el("p", { class: "compose-hint", style: "margin:0 0 16px;text-align:right" }, `${pageIndex + 1} / ${pages.length}`),
          isLast
            ? el(
                "div",
                {},
                el(
                  "button",
                  {
                    class: "event-choice",
                    onclick: () => {
                      ctx.update((s) => joinPrivateCrew(s));
                      resolve(appt, true);
                    },
                  },
                  PRIVATE_CREW_INVITE.joinLabel,
                ),
                el(
                  "button",
                  { class: "event-choice", style: "opacity:.85", onclick: () => resolve(appt, true) },
                  PRIVATE_CREW_INVITE.declineLabel,
                ),
              )
            : el(
                "div",
                { style: "display:flex;gap:8px;justify-content:flex-end" },
                el(
                  "button",
                  {
                    class: "btn btn--ghost",
                    disabled: pageIndex === 0,
                    onclick: () => {
                      if (pageIndex > 0) pageIndex--;
                      render();
                    },
                  },
                  "이전",
                ),
                el(
                  "button",
                  {
                    class: "btn",
                    onclick: () => {
                      if (pageIndex < pages.length - 1) pageIndex++;
                      render();
                    },
                  },
                  "다음",
                ),
              ),
        ),
      );
    };
    render();
  }

  function resolve(appt: Appointment, go: boolean): void {
    let msg = "";
    ctx.update((s) => {
      const live = s.appointments.find((a) => a.id === appt.id);
      if (live) msg = resolveAppointment(s, live, go).message;
    });
    showResult(msg, go ? appt : undefined); // 다녀왔을 때만 후기 트윗 가능
  }

  /** 다녀온 약속의 '후기 트윗' 문구 — 상대/행사/일반 순으로 결이 다르다. attr은 약속 계열(없으면 일상). */
  function scheduleTweetText(appt: Appointment): string {
    if (appt.partnerName) {
      return pick([
        `${appt.partnerName} 만나고 왔다! 오랜만이라 더 반가웠어 ㅎㅎ`,
        `오늘 ${appt.partnerName}랑 신나게 놀다 옴 🥳 역시 만나야 제맛`,
        `${appt.partnerName}랑 수다 실컷 떨고 왔다 기분 좋아졌어`,
      ]);
    }
    if (appt.kind === "event") {
      return pick([
        `「${appt.title}」 다녀옴! 역시 현장이 최고다 🙌`,
        `${appt.title} 갔다 왔다 진짜 알찼음… 여운 오짐`,
        `오늘 ${appt.title} 다녀온 후기: 안 갔으면 후회할 뻔 👏`,
      ]);
    }
    return pick([
      `오늘 ${appt.title} 다녀옴! 알찬 하루였다`,
      `${appt.title} 갔다 오니 기분 전환 제대로 됐다 ㅎㅎ`,
      `밖에 나갔다 오니 몸은 피곤한데 마음은 든든하네`,
    ]);
  }

  /** 후기 트윗 게시 후 모달을 닫는다(트윗은 행동력 소모 — 일반 트윗과 동일). */
  function postScheduleTweet(appt: Appointment): void {
    const attr = appt.attribute ?? "daily";
    const text = scheduleTweetText(appt);
    let delta = 0;
    ctx.update((s) => {
      delta = postTweet(s, attr, text, false).followerDelta;
    });
    ctx.closeModal();
    ctx.toast(delta >= 0 ? `트윗 게시! +${delta} 팔로워` : `트윗 게시... ${delta} 팔로워`);
  }

  /** 결과 화면. attendedAppt가 있으면(실제로 다녀온 약속) 후기 트윗 버튼을 함께 띄운다. */
  function showResult(result: string, attendedAppt?: Appointment, extra?: HTMLElement): void {
    const actions = attendedAppt
      ? [
          el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "안 올린다"),
          el("button", { class: "btn", onclick: () => postScheduleTweet(attendedAppt) }, "트윗한다"),
        ]
      : [el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인")];

    container.replaceChildren(
      el("div", { class: "modal__head" }, "약속"),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.6;margin:0 0 18px" }, result),
        extra,
        el("div", { class: "compose-actions", style: "gap:10px" }, ...actions),
      ),
    );
  }

  return container;
}
