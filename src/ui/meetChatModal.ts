import type { GameContext } from "./context";
import type { AttributeId } from "@/core/types";
import { SLOTS_PER_DAY, SLOT_LABELS } from "@/core/state";
import { addAppointment } from "@/systems/appointments";
import { meetSuccessChance } from "@/systems/relationship";
import { dateLabel } from "@/systems/time";
import { randInt, pick, chance } from "@/utils/random";
import { el } from "@/utils/dom";
import { icon, relAvatar } from "./icons";

/** 내가 만남을 제안하는 카톡 말풍선 템플릿(요일/시간대 보간). */
const PROPOSE_LINES = [
  (d: string, t: string) => `우리 언제 한번 볼래? 이번 주 ${d} ${t} 어때? 😊`,
  (d: string, t: string) => `요즘 통 못 봤네ㅠ ${d} ${t}쯤 시간 되면 얼굴 보자!`,
  (d: string, t: string) => `${d} ${t}에 잠깐 만날까? 오랜만에 수다 떨고 싶어 ㅎㅎ`,
];
/** 상대가 수락하는 답장. */
const ACCEPT_LINES = ["좋아, 그때 봐! 😊", "완전 좋지! 나도 보고 싶었어 ㅎㅎ", "콜! 그날 비워둘게 👍"];
/** 상대가 거절하는 답장. */
const DECLINE_LINES = [
  "아 미안ㅠ 그날은 좀 어려울 것 같아…",
  "그날은 선약이 있어서 😢 다음에 꼭 보자!",
  "미안, 요즘 좀 정신이 없어서ㅠ 다음 기회에!",
];

/**
 * '만남 약속' 카톡 대화 모달 — **내가 시간을 제안하고, 상대가 수락/거절**한다.
 * kakaoModal.ts의 채팅 룩앤필(.kk-chat / .kk-bubble--them·--me)을 재활용한다.
 * 수락 확률 = meetSuccessChance. 수락하면 확정 약속(confirmed)으로 등록되어 당일 무조건 성사한다
 * (거절은 약속을 잡지 않는다). 제안 day/slot은 열 때 한 번 무작위로 정한다.
 */
export function renderMeetChatModal(
  ctx: GameContext,
  charId: string,
  name: string,
  attribute: AttributeId,
): HTMLElement {
  const container = el("div", { class: "modal kakao-modal" });

  // 제안 시간은 열 때 한 번만 정한다(기존 scheduleMeet과 동일한 랜덤 규칙).
  const day = ctx.store.getState().day + randInt(2, 7);
  const slot = randInt(0, SLOTS_PER_DAY - 1);
  const whenLabel = `${dateLabel(day)} ${SLOT_LABELS[slot]}`;
  const prob = meetSuccessChance(ctx.store.getState());
  const chancePct = Math.round(prob * 100);

  type Msg = { from: "me" | "them"; text: string };
  const messages: Msg[] = [];
  // idle: 제안 전 / waiting: 답장 대기 / accepted·declined: 결과
  let phase: "idle" | "waiting" | "accepted" | "declined" = "idle";

  /** 내가 만남을 제안 → 상대가 수락/거절 판정. */
  function propose(): void {
    if (phase !== "idle") return;
    messages.push({ from: "me", text: pick(PROPOSE_LINES)(dateLabel(day), SLOT_LABELS[slot]) });
    phase = "waiting";
    render();
    // 잠깐 뒤 상대 답장(수락 확률 = prob).
    window.setTimeout(() => {
      if (chance(prob)) {
        messages.push({ from: "them", text: pick(ACCEPT_LINES) });
        phase = "accepted";
        ctx.update((s) => {
          addAppointment(s, {
            day,
            slot,
            kind: "friend",
            charId,
            partnerName: name,
            attribute,
            title: `${name}와의 만남`,
            confirmed: true, // 수락된 확정 약속 → 당일 무조건 성사
          });
        });
        render();
        window.setTimeout(() => {
          ctx.closeModal();
          ctx.toast(`${name}와 약속을 잡았어요! (${whenLabel})`);
        }, 1000);
      } else {
        messages.push({ from: "them", text: pick(DECLINE_LINES) });
        phase = "declined";
        render();
      }
    }, 800);
  }

  function render(): void {
    const bubbles = messages.map((m) => {
      const isMe = m.from === "me";
      return el(
        "div",
        { class: "kk-row kk-row--" + (isMe ? "me" : "them") },
        isMe ? null : relAvatar(name, 38),
        el(
          "div",
          { class: "kk-col" },
          isMe ? null : el("div", { class: "kk-name" }, name),
          el("div", { class: "kk-bubble kk-bubble--" + (isMe ? "me" : "them") }, m.text),
        ),
      );
    });

    const head = el(
      "div",
      { class: "kk-head" },
      relAvatar(name, 34),
      el(
        "div",
        { class: "kk-head__info" },
        el("div", { class: "kk-head__title" }, name),
        el("div", { class: "kk-head__sub" }, `카카오톡 · 만남 수락 확률 ${chancePct}%`),
      ),
      el("span", { class: "kk-head__ic" }, icon("search", { size: 17 })),
      el("button", { class: "kk-head__close", onclick: () => ctx.closeModal() }, "✕"),
    );

    let footInner: HTMLElement;
    if (phase === "idle") {
      footInner = el(
        "div",
        { class: "kk-input kk-quick" },
        el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "다음에…"),
        el("button", { class: "btn", onclick: propose }, "만나자고 해보기"),
      );
    } else if (phase === "waiting") {
      footInner = el(
        "div",
        { class: "kk-input" },
        el("span", { class: "kk-input__ph" }, "답장을 기다리는 중…"),
      );
    } else if (phase === "accepted") {
      footInner = el(
        "div",
        { class: "kk-input" },
        el("span", { class: "kk-input__ph" }, "약속을 잡았어요"),
      );
    } else {
      // declined — 약속 안 잡힘. 닫고 다음 기회에.
      footInner = el(
        "div",
        { class: "kk-input kk-quick" },
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "닫기"),
      );
    }
    const foot = el("div", { class: "kk-foot" }, footInner);

    container.replaceChildren(head, el("div", { class: "kk-chat" }, ...bubbles), foot);
  }

  render();
  return container;
}
