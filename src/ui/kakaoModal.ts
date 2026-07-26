import type { GameContext } from "./context";
import type { KakaoThread } from "@/core/types";
import { SLOT_LABELS } from "@/core/state";
import { NO_REPLY_SENDERS, FRIENDLY_SENDERS } from "@/systems/kakao";
import { addAppointment } from "@/systems/appointments";
import { acceptLoan } from "@/systems/loan";
import { dateLabel } from "@/systems/time";
import { el, formatNumber } from "@/utils/dom";
import { avatar, icon } from "./icons";
import { uid } from "@/utils/random";

/** 카톡 토스트/모달에서 스레드를 찾는다. */
function findThread(ctx: GameContext, id: string): KakaoThread | undefined {
  return ctx.store.getState().kakao.find((t) => t.id === id);
}

/**
 * 우측 하단 카카오톡 토스트 알림.
 * 클릭하면 해당 대화 메시지창(모달)이 열리고, 읽음 처리된다.
 */
export function renderKakaoToast(ctx: GameContext, thread: KakaoThread): HTMLElement {
  const last = thread.messages[thread.messages.length - 1];
  return el(
    "button",
    {
      class: "kakao-toast",
      onclick: () => {
        ctx.update((s) => {
          const t = s.kakao.find((x) => x.id === thread.id);
          if (t) {
            t.toastPending = false;
            t.unread = false;
          }
        });
        ctx.openModal((c) => renderKakaoModal(c, thread.id));
      },
    },
    el("span", { class: "kakao-toast__badge" }, "TALK"),
    el(
      "span",
      { class: "kakao-toast__body" },
      el("span", { class: "kakao-toast__sender" }, thread.sender),
      el("span", { class: "kakao-toast__preview" }, last ? last.text : ""),
    ),
  );
}

/** 카카오톡 메시지창(모달). */
export function renderKakaoModal(ctx: GameContext, threadId: string): HTMLElement {
  const container = el("div", { class: "modal kakao-modal" });

  function render(): void {
    const thread = findThread(ctx, threadId);
    if (!thread) {
      container.replaceChildren(el("div", { class: "modal__body" }, "대화를 찾을 수 없습니다."));
      return;
    }

    const msgs = thread.messages;
    const bubbles = msgs.map((m, i) => {
      const isMe = m.from === "me";
      // 같은 발신자가 연속이면 아바타·이름을 한 번만 보여준다(카톡처럼)
      const showHead = !isMe && (i === 0 || msgs[i - 1].from !== m.from);
      return el(
        "div",
        { class: "kk-row kk-row--" + (isMe ? "me" : "them") },
        !isMe
          ? showHead
            ? avatar(thread.sender, 38)
            : el("span", { class: "kk-avatar-gap" })
          : null,
        el(
          "div",
          { class: "kk-col" },
          showHead ? el("div", { class: "kk-name" }, thread.sender) : null,
          el("div", { class: "kk-bubble kk-bubble--" + (isMe ? "me" : "them") }, m.text),
        ),
      );
    });

    // 상단 바(제목 + 장식 아이콘)
    const head = el(
      "div",
      { class: "kk-head" },
      avatar(thread.sender, 34),
      el(
        "div",
        { class: "kk-head__info" },
        el("div", { class: "kk-head__title" }, thread.sender),
        el("div", { class: "kk-head__sub" }, "카카오톡"),
      ),
      el("span", { class: "kk-head__ic" }, icon("search", { size: 17 })),
      el("span", { class: "kk-head__ic" }, icon("clock", { size: 17 })),
      el(
        "span",
        { class: "kk-head__ic kk-head__menu" },
        el("i", {}),
        el("i", {}),
        el("i", {}),
      ),
      el("button", { class: "kk-head__close", onclick: () => ctx.closeModal() }, "✕"),
    );

    // 하단: 실제 답장/선택 버튼(있으면 회색 입력란 자리에 채운다) + 장식용 입력바
    const actions = footButtons(thread);
    const foot = el(
      "div",
      { class: "kk-foot" },
      actions.length
        ? el("div", { class: "kk-input kk-quick" }, ...actions)
        : el("div", { class: "kk-input" }, el("span", { class: "kk-input__ph" }, "메시지 입력")),
      el(
        "div",
        { class: "kk-inputbar" },
        el("span", { class: "kk-inputbar__ic" }, "＋"),
        el("span", { class: "kk-inputbar__ic" }, "🙂"),
        el("span", { class: "kk-inputbar__ic" }, "🗎"),
        el("span", { class: "kk-inputbar__send" }, "전송"),
      ),
    );

    container.replaceChildren(head, el("div", { class: "kk-chat" }, ...bubbles), foot);
  }

  /** 초대 카톡이면 수락/거절, 아니면 간단 답장 버튼 */
  function footButtons(thread: KakaoThread): HTMLElement[] {
    // '만나서 놀자' 초대 스레드
    if (thread.invite) {
      if (thread.invite.responded) return []; // 이미 수락/거절함
      const { day, slot, partnerName, attribute } = thread.invite;
      const accept = el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((s) => {
              const t = s.kakao.find((x) => x.id === threadId);
              if (!t?.invite) return;
              t.invite.responded = true;
              addAppointment(s, {
                day,
                slot,
                kind: "friend",
                title: `${partnerName}와 만나서 놀기`,
                partnerName,
                attribute,
              });
              t.messages.push({
                id: uid("kkom"),
                from: "me",
                text: "좋아! 그때 보자 😄",
                day: s.day,
              });
              t.messages.push({
                id: uid("kkom"),
                from: "them",
                text: `콜! ${dateLabel(day)} ${SLOT_LABELS[slot]}에 봐~ 약속 잡았다? 🤙`,
                day: s.day,
              });
            });
            ctx.toast(`약속을 잡았어요! (${dateLabel(day)} ${SLOT_LABELS[slot] ?? ""})`);
            render();
          },
        },
        "좋아, 그때 보자!",
      );
      const decline = el(
        "button",
        {
          class: "btn btn--ghost",
          onclick: () => {
            ctx.update((s) => {
              const t = s.kakao.find((x) => x.id === threadId);
              if (!t?.invite) return;
              t.invite.responded = true;
              t.messages.push({
                id: uid("kkom"),
                from: "me",
                text: "미안, 그날은 좀 어려울 것 같아 ㅠ",
                day: s.day,
              });
              t.messages.push({
                id: uid("kkom"),
                from: "them",
                text: "아쉽다 ㅠ 다음에 꼭 보자!",
                day: s.day,
              });
            });
            render();
          },
        },
        "다음에...",
      );
      return [decline, accept];
    }

    // 대부업체 대출 제안
    if (thread.loanOffer) {
      if (thread.loanOffer.responded) return [];
      const offer = thread.loanOffer;
      const accept = el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((s) => {
              const t = s.kakao.find((x) => x.id === threadId);
              if (!t?.loanOffer) return;
              t.loanOffer.responded = true;
              acceptLoan(s, t.loanOffer);
              t.messages.push({
                id: uid("kkom"),
                from: "me",
                text: "네, 대출 받을게요.",
                day: s.day,
              });
              t.messages.push({
                id: uid("kkom"),
                from: "them",
                text: `입금 완료됐습니다! ${offer.termDays}일 뒤 ${formatNumber(offer.repayAmount)}원, 잊지 마세요~ 😈`,
                day: s.day,
              });
            });
            ctx.toast(`${formatNumber(offer.principal)}원이 입금됐어요`);
            render();
          },
        },
        `${formatNumber(offer.principal)}원 대출받기`,
      );
      const decline = el(
        "button",
        {
          class: "btn btn--ghost",
          onclick: () => {
            ctx.update((s) => {
              const t = s.kakao.find((x) => x.id === threadId);
              if (!t?.loanOffer) return;
              t.loanOffer.responded = true;
              t.messages.push({
                id: uid("kkom"),
                from: "me",
                text: "아니요, 괜찮습니다.",
                day: s.day,
              });
              t.messages.push({
                id: uid("kkom"),
                from: "them",
                text: "필요하시면 언제든 다시 연락 주세요~",
                day: s.day,
              });
            });
            render();
          },
        },
        "거절",
      );
      return [decline, accept];
    }

    // 정산·급여 같은 통보 카톡은 답장이 필요 없다 — 답장 버튼을 아예 띄우지 않는다.
    if (NO_REPLY_SENDERS.includes(thread.sender)) return [];

    // 일반 카톡(집주인 등) — 간단 답장. 한 번 답하면(내 메시지가 생기면) 버튼을 없앤다.
    // (일반 스레드의 'me' 메시지는 이 답장뿐이라 이 검사가 곧 '이미 답함' 판정이다.)
    if (thread.messages.some((m) => m.from === "me")) return [];
    // 발신자가 단계별 답장을 지정했으면 그걸, 아니면 기본 문구를 쓴다.
    // 친구(타임라인 친구)에겐 반말, 집주인 등 공식 발신자에겐 존댓말로 답한다.
    const friendly = FRIENDLY_SENDERS.includes(thread.sender);
    const myText = thread.reply?.me ?? (friendly ? "ㅇㅇ 알겠어! 😊" : "네, 알겠습니다! 😊");
    const theirText = thread.reply?.them ?? (friendly ? "고맙다~ 믿는다 👍" : "고마워요~ 믿을게요 👍");
    const replyLabel = thread.reply?.label ?? (friendly ? "알겠어" : "네, 알겠습니다");
    const reply = el(
      "button",
      {
        class: "btn",
        onclick: () => {
          ctx.update((s) => {
            const t = s.kakao.find((x) => x.id === threadId);
            if (!t) return;
            t.messages.push({ id: uid("kkom"), from: "me", text: myText, day: s.day });
            t.messages.push({
              id: uid("kkom"),
              from: "them",
              text: theirText,
              day: s.day,
            });
          });
          render();
        },
      },
      replyLabel,
    );
    return [reply];
  }

  render();
  return container;
}
