import type { GameContext } from "./context";
import type { StreamChoice, StreamEvent, StreamType } from "@/data/livestream";
import { STREAM_TYPES, STREAM_EVENT_COUNT } from "@/data/livestream";
import {
  applyChoiceMental,
  applyChoiceViewers,
  chatChance,
  chatInterval,
  dedicatedAccount,
  driftViewers,
  finishStream,
  postStreamTweet,
  rollChatLine,
  rollEventSequence,
  setStreamName,
  startStream,
  startingViewers,
  streamName,
  DEDICATED_FOLLOWER_MULT,
  STREAM_ACTION_COST,
  STREAM_MENTAL_COST,
  STREAM_NAME_MAX,
} from "@/systems/livestream";
import { SKILL_STATS } from "@/data/stats";
import { openNameModal } from "./penNameModal";
import { getActiveAccount } from "@/core/state";
import { streamStageArt } from "./streamStage";
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

/**
 * 선택지 하나가 뜨기까지 흐르는 채팅 차례 수.
 * ⚠️ **방송 전체 길이가 여기서 정해진다**(차례 수 × 선택지 4개 × chatInterval).
 *    시청자가 적을수록 차례 간격이 길어지므로(최대 3초), 이 값이 소규모 방송의 길이를 정한다.
 *    6이던 시절 63초 → 2면 21초(시청자 3명 기준). **20초 안팎이 목표치다.**
 *    ⚠️ 침묵 차례(chatChance)도 한 번으로 세므로, 이 값은 '채팅 줄 수'가 아니라 '차례 수'다.
 */
const CHATS_PER_EVENT = 2;

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
        `어떤 방송을 켤까요? 시청자 수는 팔로워와 관련 스탯이 정합니다. (시간 1칸 · 행동력 -${STREAM_ACTION_COST} · 정신력 -${STREAM_MENTAL_COST})`,
      ),
      ...STREAM_TYPES.map((t) => {
        const state = ctx.store.getState();
        const name = streamName(state, t.id);
        const dedi = dedicatedAccount(state, t.id);
        return el(
          "div",
          { class: "live-pick" },
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
            el(
              "span",
              { class: "live-pick__name-row" },
              el(
                "span",
                { class: "live-pick__handle" },
                name ? `활동명 ${name}` : "활동명 없음",
                dedi ? el("b", { class: "live-pick__dedi" }, `전용 계정 @${dedi.handle}`) : null,
              ),
              el(
                "button",
                {
                  class: "live-pick__rename",
                  onclick: () => askStreamName(ctx, t, () => ctx.openModal(renderStreamTypeModal)),
                },
                name ? "이름 바꾸기" : "이름 정하기",
              ),
            ),
          ),
          el(
            "button",
            {
              class: "btn live-pick__go",
              // 활동명이 없으면 먼저 정하게 하고, 정하는 즉시 방송으로 이어간다.
              onclick: () =>
                name ? beginStream(ctx, t) : askStreamName(ctx, t, () => beginStream(ctx, t)),
            },
            "방송 켜기",
          ),
        );
      }),
    ),
  );
}

/** 방송을 실제로 시작한다(타임블록·행동력 소모 후 진행 화면으로) */
function beginStream(ctx: GameContext, t: StreamType): void {
  ctx.update((s) => startStream(s, t));
  ctx.openModal((c) => renderLivestreamModal(c, t));
}

/** 활동명 입력을 띄운다. 확정하면 onDone으로 이어간다(방송 시작 또는 목록 갱신). */
function askStreamName(ctx: GameContext, t: StreamType, onDone: () => void): void {
  const state = ctx.store.getState();
  openNameModal(ctx, {
    title: `${t.emoji} ${t.label} 활동명`,
    lead: `${t.label}에서 쓸 활동명을 정하세요. 방송마다 따로 쓸 수 있어요.`,
    hint: "이 이름으로 SNS를 검색하면 시청자 반응을 볼 수 있고, 같은 이름의 계정을 만들면 방송 전용 계정이 됩니다.",
    confirmLabel: "이 이름으로 방송",
    placeholder: "활동명을 입력하세요",
    suggested: streamName(state, t.id) || getActiveAccount(state).name,
    max: STREAM_NAME_MAX,
    onConfirm: (name) => {
      if (!name) return;
      ctx.update((s) => setStreamName(s, t.id, name));
      onDone();
    },
  });
}

/** 방송 진행 화면 — 방송화면(목업 영상) + 채팅창 + 시청자 수 */
export function renderLivestreamModal(ctx: GameContext, type: StreamType): HTMLElement {
  const account = getActiveAccount(ctx.store.getState());
  /**
   * 방송에 걸리는 이름은 **활동명**이다 — 계정명이 아니다.
   * 시청자는 내 SNS 계정을 모르고, 활동명이 곧 검색어이자 채널 이름이다.
   * (활동명 없이 방송이 시작되는 경로는 없지만, 옛 세이브 방어로 계정명을 뒤에 둔다.)
   */
  const channel = streamName(ctx.store.getState(), type.id) || account.name;
  let viewers = startingViewers(ctx.store.getState(), type);
  let peak = viewers;
  const events: StreamEvent[] = rollEventSequence(type.id);
  let eventIdx = 0;
  let chatsSinceEvent = 0;
  /** 선택지가 떠 있는 동안 채팅을 멈춘다(사용자 확정 — 읽고 판단할 시간을 준다) */
  let paused = false;
  /** 직전 채팅 문구 — 같은 줄이 연달아 뜨는 걸 막는 데만 쓴다 */
  let lastText = "";
  let timer = 0;
  let ended = false;
  /** 모달이 한 번이라도 문서에 붙었는지(누수 방어 판정의 전제) */
  let mounted = false;
  /** 방송 경과 시간의 기준 시각 — 표시용이라 게임 상태와 무관하다 */
  const startedAt = Date.now();

  const viewerLabel = el("span", { class: "live-viewers__count" }, formatNumber(viewers));
  const chatBox = el("div", { class: "live-chat" });
  const clock = el("span", { class: "live-stage__clock" }, "00:00");
  /**
   * 선택지·상황을 방송화면 **위에** 얹는 층. 방송을 보면서 고르는 감각이 핵심이라
   * 화면 아래 패널이 아니라 오버레이다(정산 결과만 아래 패널로 뺀다 — 줄이 길어 화면을 가린다).
   */
  const overlay = el("div", { class: "live-overlay live-overlay--off" });
  const stage = el(
    "div",
    { class: `live-stage live-stage--${type.id}` },
    streamStageArt(type.id),
    el(
      "div",
      { class: "live-stage__hud" },
      clock,
      el("span", { class: "live-stage__badge" }, "LIVE"),
    ),
    overlay,
  );
  const metaViewers = el(
    "span",
    { class: "live-meta__viewers" },
    `${formatNumber(viewers)}명 시청 중`,
  );
  const metaSub = el("span", { class: "live-meta__sub" });
  const endBtn = el(
    "button",
    { class: "live-meta__end", onclick: () => endStream() },
    "방송 종료",
  );

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
        el(
          "span",
          // 닉네임 색은 닉마다 고정(실제 방송 채팅의 결) — 같은 사람이 같은 색으로 보여야 한다.
          { class: "live-chat__nick", style: kind ? "" : `color:${nickColor(nick)}` },
          nick,
        ),
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
    metaViewers.textContent = `${formatNumber(viewers)}명 시청 중`;
  };

  /** 방송화면 위 오버레이를 띄우거나(내용 전달) 걷어낸다(인자 없음) */
  const showOverlay = (...nodes: HTMLElement[]): void => {
    if (nodes.length === 0) {
      overlay.replaceChildren();
      overlay.classList.add("live-overlay--off");
      return;
    }
    overlay.replaceChildren(...nodes);
    overlay.classList.remove("live-overlay--off");
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
    // 시청자가 적으면 대부분의 차례는 아무도 말하지 않는다(선택지 진행은 그대로 흐른다).
    if (Math.random() < chatChance(viewers)) {
      const line = rollChatLine(type.id, viewers, lastText);
      lastText = line.text;
      pushChat(line.nick, line.text);
    }
    setViewers(driftViewers(viewers));
    clock.textContent = elapsed(startedAt);
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

    showOverlay(
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

    showOverlay(
      el(
        "div",
        { class: "live-event live-event--result" },
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
                showOverlay();
                updateMeta();
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

  /** 방송화면 아래 정보줄 갱신(남은 상황·최고 시청자) */
  function updateMeta(): void {
    metaSub.textContent = ended
      ? `최고 시청자 ${formatNumber(peak)}명`
      : `남은 상황 ${Math.max(0, events.length - eventIdx)}개 · 최고 ${formatNumber(peak)}명`;
  }

  /** 방송을 끝내고 정산 화면으로 넘어간다 */
  function endStream(): void {
    if (ended) return;
    ended = true;
    paused = true;
    stopChat();
    showOverlay();
    stage.classList.add("live-stage--off");
    endBtn.remove();
    metaViewers.textContent = `최종 시청자 ${formatNumber(viewers)}명`;
    updateMeta();

    let result: ReturnType<typeof finishStream> | null = null;
    ctx.update((s) => {
      result = finishStream(s, type, viewers);
    });
    const r = result as ReturnType<typeof finishStream> | null;
    if (!r) return;

    pushChat("📢 시스템", "방송이 종료되었습니다. 오늘도 수고하셨어요.", "system");

    // 정산은 모달 전체를 덮는 오버레이로 띄운다 — 방송이 끝났다는 전환이 분명해야 한다.
    root.appendChild(
      el(
        "div",
        { class: "live-finish" },
        el(
          "div",
          { class: "live-result" },
          el("div", { class: "live-result__title" }, "📊 방송 결과"),
          r.isBest
            ? el("div", { class: "live-result__best" }, `🏆 ${type.label} 신기록!`)
            : null,
          el(
            "div",
            { class: "live-result__rows" },
            resultRow("최종 시청자", `${formatNumber(r.viewers)}명`),
            resultRow("이번 방송 최고", `${formatNumber(peak)}명`),
            resultRow("역대 최고 기록", `${formatNumber(r.best)}명`),
            resultRow("팔로워", `+${formatNumber(r.followers)}`),
            resultRow("후원금", `+${formatNumber(r.donation)}원`),
            resultRow(SKILL_STATS[r.skillId].label, `+${r.skillGain}`),
            resultRow("행동력", `-${STREAM_ACTION_COST}`),
            resultRow("정신력", `-${STREAM_MENTAL_COST}`),
          ),
          tweetPrompt(),
          el("button", { class: "btn btn--ghost", onclick: leave }, "확인"),
        ),
      ),
    );
  }

  /**
   * 정산 화면의 '오늘 방송 트윗하기' 블록.
   * 전용 계정(계정명 = 활동명)이 있으면 그 계정으로 올라가고 팔로워가 크게 붙는다 —
   * 없으면 활성 계정에 그냥 올라간다는 사실을 **누르기 전에** 알려준다.
   */
  function tweetPrompt(): HTMLElement {
    const state = ctx.store.getState();
    const dedi = dedicatedAccount(state, type.id);
    const target = dedi ?? getActiveAccount(state);
    const box = el("div", { class: "live-tweet" });

    const post = (): void => {
      let res: ReturnType<typeof postStreamTweet> | null = null;
      ctx.update((s) => {
        res = postStreamTweet(s, type, viewers);
      });
      const r = res as ReturnType<typeof postStreamTweet> | null;
      if (!r) return;
      box.replaceChildren(
        el("p", { class: "live-tweet__done" }, `@${r.account.handle}에 방송 후기를 올렸습니다.`),
        el("p", { class: "live-tweet__text" }, r.text),
        el(
          "p",
          { class: "live-tweet__gain" },
          `팔로워 +${formatNumber(r.followers)}${r.dedicated ? " (방송 전용 계정 보너스)" : ""}`,
        ),
      );
    };

    const name = streamName(state, type.id);
    box.replaceChildren(
      el("p", { class: "live-tweet__ask" }, "오늘 방송 얘기를 트윗할까요?"),
      el(
        "p",
        { class: "live-tweet__hint" },
        dedi
          ? `🔴 방송 전용 계정 @${target.handle}에 올라갑니다`
          : `@${target.handle}(일반 계정)에 올라갑니다`,
      ),
      // 전용 계정이 뭔지·어떻게 만드는지를 이 창에서 끝낸다 — 보너스를 놓치고
      // 나서야 알게 되면 이미 트윗은 올라간 뒤다.
      el(
        "p",
        { class: dedi ? "live-tweet__note live-tweet__note--on" : "live-tweet__note" },
        dedi
          ? `계정명이 활동명 '${name}'과 같아 전용 계정으로 인정됩니다. 방송 후기 팔로워가 ${DEDICATED_FOLLOWER_MULT}배로 붙어요.`
          : `💡 방송 전용 계정: SNS 계정 이름을 활동명 '${name}'과 똑같이 만들면 그 계정이 이 방송의 전용 계정이 됩니다. 전용 계정에 방송 후기를 올리면 팔로워가 ${DEDICATED_FOLLOWER_MULT}배로 붙어요.`,
      ),
      el("button", { class: "btn", onclick: post }, "트윗하기"),
    );
    return box;
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
        stage,
        el(
          "div",
          { class: "live-meta" },
          el("div", { class: "live-meta__title" }, `${channel}의 ${type.label}`),
          el(
            "div",
            { class: "live-meta__row" },
            el("span", { class: "live-meta__avatar" }, type.emoji),
            el(
              "span",
              { class: "live-meta__channel" },
              el("span", { class: "live-meta__name" }, channel),
              el(
                "span",
                { class: "live-meta__followers" },
                `팔로워 ${formatNumber(account.followers)}명`,
              ),
            ),
            el("span", { class: "live-meta__stats" }, metaViewers, metaSub),
            endBtn,
          ),
        ),
      ),
      el(
        "div",
        { class: "live-right" },
        el("div", { class: "live-chat__head" }, "채팅"),
        chatBox,
      ),
    ),
  );

  // 방송 시작 — root가 만들어진 뒤에 건다(tick이 root.isConnected를 본다).
  updateMeta();
  pushChat("📢 시스템", `${type.label}을(를) 시작했습니다.`, "system");
  restartChat();

  return root;
}

/** 경과 시간 mm:ss */
function elapsed(from: number): string {
  const sec = Math.floor((Date.now() - from) / 1000);
  return `${String(Math.floor(sec / 60)).padStart(2, "0")}:${String(sec % 60).padStart(2, "0")}`;
}

/** 채팅 닉네임 색 팔레트 — 실제 방송처럼 닉마다 색이 다르되 항상 같은 색이어야 한다 */
const NICK_COLORS = [
  "#ff9db4", "#8fd3ff", "#ffd166", "#a5e887", "#c9a8ff",
  "#ff9f6b", "#7fe0d0", "#f5a3e0", "#9fb6ff", "#e0c47f",
];

/** 닉네임 → 고정 색(단순 해시) */
function nickColor(nick: string): string {
  let h = 0;
  for (let i = 0; i < nick.length; i++) h = (h * 31 + nick.charCodeAt(i)) >>> 0;
  return NICK_COLORS[h % NICK_COLORS.length];
}

function resultRow(label: string, value: string): HTMLElement {
  return el(
    "div",
    { class: "live-result__row" },
    el("span", { class: "live-result__label" }, label),
    el("span", { class: "live-result__value" }, value),
  );
}
