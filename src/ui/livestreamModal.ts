import type { GameContext } from "./context";
import type { StreamChoice, StreamEvent, StreamType } from "@/data/livestream";
import { STREAM_TYPES, STREAM_EVENT_COUNT } from "@/data/livestream";
import {
  applyChoiceMental,
  applyChoiceViewers,
  chatInterval,
  driftViewers,
  finishStream,
  rollChatLine,
  rollEventSequence,
  startStream,
  startingViewers,
  STREAM_MENTAL_COST,
} from "@/systems/livestream";
import { SKILL_STATS } from "@/data/stats";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 너튜브 인방(라이브 방송) 팝업.
 *
 * ⚠️ **타이머 정리가 이 파일의 최대 함정이다.** 채팅은 setInterval로 흐르는데,
 *    모달을 어떤 경로로 닫든(✕ · 방송 종료 · 정산 확인) 반드시 clearInterval을 거쳐야 한다.
 *    안 그러면 방송을 닫아도 타이머가 계속 돌며 CPU와 메모리를 먹는다.
 *    → 닫는 경로를 전부 `leave()` 하나로 모아 그 안에서만 정리한다.
 *
 * ⚠️ 이 모달은 **자기 DOM을 직접 갱신한다**(ctx.update로 전체 재렌더를 돌리지 않는다).
 *    app.ts가 ui.modal 함수가 그대로면 노드를 캐시해 재사용하므로 지역 상태·타이머가 살아남는다.
 *    반대로 말해 여기서 ctx.update를 부르면 방송이 끊기지 않지만 불필요한 전체 렌더가 돈다 —
 *    그래서 상태 변경(정신력·정산)은 **선택 시점과 종료 시점에만** 모아서 한다.
 * ============================================================ */

/** 채팅창에 남겨두는 최대 줄 수(pushTimeline 관례 — 긴 방송에서 DOM 무한 증식 방지) */
const MAX_CHAT_LINES = 60;

/** 선택지 하나가 뜨기까지 흐르는 채팅 줄 수 */
const CHATS_PER_EVENT = 6;

/** 방송 타입 선택 화면 — 여기서 고르면 방송이 시작된다(타임블록 1칸 소모) */
export function renderStreamTypeModal(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "🔴 방송 시작"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "compose-hint", style: "margin:0 0 14px" },
        `어떤 방송을 켤까요? 시청자 수는 팔로워와 관련 스탯이 정합니다. (시간 1칸 · 정신력 -${STREAM_MENTAL_COST})`,
      ),
      ...STREAM_TYPES.map((t) =>
        el(
          "button",
          {
            class: "live-pick",
            onclick: () => {
              ctx.update((s) => startStream(s, t));
              ctx.openModal((c) => renderLivestreamModal(c, t));
            },
          },
          el("span", { class: "live-pick__emoji" }, t.emoji),
          el(
            "span",
            { class: "live-pick__copy" },
            el("span", { class: "live-pick__name" }, t.label),
            el("span", { class: "live-pick__desc" }, t.desc),
            el(
              "span",
              { class: "live-pick__skills" },
              "관련 스탯: " + t.skills.map((id) => SKILL_STATS[id].label).join(" · "),
            ),
          ),
        ),
      ),
    ),
  );
}

/** 방송 진행 화면 — 방송화면 + 채팅창 + 시청자 수 */
export function renderLivestreamModal(ctx: GameContext, type: StreamType): HTMLElement {
  let viewers = startingViewers(ctx.store.getState(), type);
  let peak = viewers;
  const events: StreamEvent[] = rollEventSequence(type.id);
  let eventIdx = 0;
  let chatsSinceEvent = 0;
  /** 선택지가 떠 있는 동안 채팅을 멈춘다(사용자 확정 — 읽고 판단할 시간을 준다) */
  let paused = false;
  let timer = 0;
  let ended = false;
  /** 모달이 한 번이라도 문서에 붙었는지(누수 방어 판정의 전제) */
  let mounted = false;

  const viewerLabel = el("span", { class: "live-viewers__count" }, formatNumber(viewers));
  const chatBox = el("div", { class: "live-chat" });
  const stage = el("div", { class: "live-stage__art" }, type.emoji);
  const stageCaption = el("div", { class: "live-stage__caption" }, `${type.label} 진행 중`);
  const panel = el("div", { class: "live-panel" });

  /** 타이머를 멈춘다. 닫는 경로가 전부 여기를 거쳐야 한다. */
  const stopChat = (): void => {
    if (timer) window.clearInterval(timer);
    timer = 0;
  };

  const leave = (): void => {
    stopChat();
    ctx.closeModal();
    ctx.afterAction("offline");
  };

  const pushChat = (nick: string, text: string, kind?: string): void => {
    chatBox.appendChild(
      el(
        "div",
        { class: "live-chat__row" + (kind ? ` live-chat__row--${kind}` : "") },
        el("span", { class: "live-chat__nick" }, nick),
        el("span", { class: "live-chat__text" }, text),
      ),
    );
    // 오래된 줄을 잘라 DOM이 무한정 늘지 않게 한다.
    while (chatBox.childElementCount > MAX_CHAT_LINES) {
      chatBox.removeChild(chatBox.firstChild!);
    }
    chatBox.scrollTop = chatBox.scrollHeight;
  };

  const setViewers = (n: number): void => {
    viewers = n;
    if (viewers > peak) peak = viewers;
    viewerLabel.textContent = formatNumber(viewers);
  };

  /** 시청자 수가 바뀌면 채팅 속도도 따라 바뀌므로 타이머를 다시 건다 */
  const restartChat = (): void => {
    stopChat();
    if (ended || paused) return;
    timer = window.setInterval(tick, chatInterval(viewers));
  };

  function tick(): void {
    // ⚠️ 자기 방어: app.ts는 ui.modal이 교체될 때 옛 노드를 **teardown 훅 없이** 버린다.
    //    강제 팝업(질병·새 날 아침 등)이 방송 위로 끼어들면 leave()를 못 거치므로,
    //    노드가 문서에서 떨어졌으면 스스로 타이머를 끊는다(누수 방지 최후 방어선).
    //    ⚠️ 단, 한 번이라도 붙은 뒤에만 판정한다 — 첫 tick이 마운트보다 빠르면
    //       아직 안 붙은 상태라 즉시 자살해 방송이 시작도 못 한다.
    if (mounted && !root.isConnected) {
      stopChat();
      return;
    }
    if (root.isConnected) mounted = true;
    if (paused || ended) return;
    const line = rollChatLine(type.id);
    pushChat(line.nick, line.text);
    setViewers(driftViewers(viewers));
    chatsSinceEvent += 1;

    if (chatsSinceEvent >= CHATS_PER_EVENT) {
      chatsSinceEvent = 0;
      showEvent();
      return;
    }
    // 시청자 변동으로 간격이 달라졌을 수 있다 — 주기적으로 다시 건다.
    restartChat();
  }

  /** 선택지를 띄운다(채팅 정지). 남은 이벤트가 없으면 방송을 끝낸다. */
  function showEvent(): void {
    if (eventIdx >= events.length) {
      endStream();
      return;
    }
    const ev = events[eventIdx++];
    paused = true;
    stopChat();

    panel.replaceChildren(
      el(
        "div",
        { class: "live-event" },
        el("div", { class: "live-event__badge" }, `상황 ${eventIdx} / ${STREAM_EVENT_COUNT}`),
        el("p", { class: "live-event__situation" }, ev.situation),
        el(
          "div",
          { class: "live-event__choices" },
          ...ev.choices.map((c) =>
            el("button", { class: "btn live-event__choice", onclick: () => choose(c) }, c.label),
          ),
        ),
      ),
    );
  }

  /** 선택지를 고른다 — 시청자·정신력을 반영하고 결과를 보여준 뒤 채팅을 재개한다 */
  function choose(choice: StreamChoice): void {
    const before = viewers;
    setViewers(applyChoiceViewers(viewers, choice));
    const diff = viewers - before;
    if (choice.mental) ctx.update((s) => applyChoiceMental(s, choice));

    pushChat("📢 시스템", choice.result, "system");
    if (diff !== 0) {
      pushChat(
        "📢 시스템",
        diff > 0 ? `시청자 +${formatNumber(diff)}명` : `시청자 ${formatNumber(diff)}명`,
        diff > 0 ? "up" : "down",
      );
    }

    panel.replaceChildren(
      el(
        "div",
        { class: "live-event" },
        el("p", { class: "live-event__result" }, choice.result),
        el(
          "div",
          { class: "live-event__choices" },
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                paused = false;
                showIdlePanel();
                if (eventIdx >= events.length) endStream();
                else restartChat();
              },
            },
            eventIdx >= events.length ? "방송 마무리" : "방송 계속",
          ),
        ),
      ),
    );
  }

  /** 선택지가 없을 때의 우측 패널(방송 상태 안내) */
  function showIdlePanel(): void {
    panel.replaceChildren(
      el(
        "div",
        { class: "live-idle" },
        el("p", { class: "compose-hint" }, "방송이 순조롭게 흘러가고 있어요."),
        el(
          "p",
          { class: "live-idle__meta" },
          `남은 상황 ${Math.max(0, events.length - eventIdx)}개 · 최고 시청자 ${formatNumber(peak)}명`,
        ),
        el("button", { class: "btn btn--ghost", onclick: () => endStream() }, "방송 조기 종료"),
      ),
    );
  }

  /** 방송을 끝내고 정산 화면으로 넘어간다 */
  function endStream(): void {
    if (ended) return;
    ended = true;
    paused = true;
    stopChat();
    stageCaption.textContent = "방송 종료";
    stage.classList.add("live-stage__art--off");

    let result: ReturnType<typeof finishStream> | null = null;
    ctx.update((s) => {
      result = finishStream(s, type, viewers);
    });
    const r = result as ReturnType<typeof finishStream> | null;
    if (!r) return;

    pushChat("📢 시스템", "방송이 종료되었습니다. 오늘도 수고하셨어요.", "system");

    panel.replaceChildren(
      el(
        "div",
        { class: "live-result" },
        el("div", { class: "live-result__title" }, "📊 방송 결과"),
        el(
          "div",
          { class: "live-result__rows" },
          resultRow("최종 시청자", `${formatNumber(r.viewers)}명`),
          resultRow("최고 시청자", `${formatNumber(peak)}명`),
          resultRow("팔로워", `+${formatNumber(r.followers)}`),
          resultRow("후원금", `+${formatNumber(r.donation)}원`),
          resultRow(SKILL_STATS[r.skillId].label, `+${r.skillGain}`),
          resultRow("정신력", `-${STREAM_MENTAL_COST}`),
        ),
        el("button", { class: "btn", onclick: leave }, "확인"),
      ),
    );
  }

  const root = el(
    "div",
    { class: "modal modal--live" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, `🔴 LIVE · ${type.label}`),
      el(
        "span",
        { class: "live-viewers" },
        el("span", { class: "live-viewers__eye" }, "👁"),
        viewerLabel,
      ),
      el("button", { class: "popup__close", onclick: leave }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body live-body" },
      el(
        "div",
        { class: "live-left" },
        el("div", { class: "live-stage" }, stage, stageCaption),
        panel,
      ),
      el(
        "div",
        { class: "live-right" },
        el("div", { class: "live-chat__head" }, "실시간 채팅"),
        chatBox,
      ),
    ),
  );

  // 방송 시작 — root가 만들어진 뒤에 건다(tick이 root.isConnected를 본다).
  showIdlePanel();
  pushChat("📢 시스템", `${type.label}을(를) 시작했습니다.`, "system");
  restartChat();

  return root;
}

function resultRow(label: string, value: string): HTMLElement {
  return el(
    "div",
    { class: "live-result__row" },
    el("span", { class: "live-result__label" }, label),
    el("span", { class: "live-result__value" }, value),
  );
}
