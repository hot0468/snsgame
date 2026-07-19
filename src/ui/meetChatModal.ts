import type { GameContext } from "./context";
import type { AttributeId } from "@/core/types";
import { SLOTS_PER_DAY, SLOT_LABELS } from "@/core/state";
import { addAppointment } from "@/systems/appointments";
import { meetSuccessChance } from "@/systems/relationship";
import { dateLabel } from "@/systems/time";
import { randInt, pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { avatar, icon } from "./icons";

/** 상대가 만남을 제안하는 카톡 말풍선 템플릿(요일/시간대 보간). */
const PROPOSE_LINES = [
  (d: string, t: string) => `우리 언제 한번 볼래? 이번 주 ${d} ${t} 어때? 😊`,
  (d: string, t: string) => `요즘 통 못 봤네ㅠ ${d} ${t}쯤 시간 되면 얼굴 보자!`,
  (d: string, t: string) => `${d} ${t}에 잠깐 만날까? 오랜만에 수다 떨고 싶어 ㅎㅎ`,
];

/**
 * '만남 약속' 카톡 대화 모달 — 캐릭터가 시간을 제안하고, 내가 수락/취소한다.
 * kakaoModal.ts의 채팅 룩앤필(.kk-chat / .kk-bubble--them·--me)을 재활용한다.
 * systems는 addAppointment만 호출 — 약속 성사/도래 판정은 기존 appointmentModal이 담당.
 * 제안 day/slot은 열 때 한 번 무작위로 정하고, 수락 시 그대로 등록한다.
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
  const chance = Math.round(meetSuccessChance(ctx.store.getState()) * 100);

  type Msg = { from: "me" | "them"; text: string };
  const messages: Msg[] = [
    { from: "them", text: pick(PROPOSE_LINES)(dateLabel(day), SLOT_LABELS[slot]) },
  ];
  let done = false; // 수락/취소 후 버튼 숨김

  function accept(): void {
    if (done) return;
    done = true;
    messages.push({ from: "me", text: "좋아, 그때 봐!" });
    messages.push({ from: "them", text: "응! 그날 보자 😊" });
    ctx.update((s) => {
      addAppointment(s, {
        day,
        slot,
        kind: "friend",
        charId,
        partnerName: name,
        attribute,
        title: `${name}와의 만남`,
      });
    });
    render();
    window.setTimeout(() => {
      ctx.closeModal();
      ctx.toast(`${name}와 약속을 잡았어요! (${whenLabel})`);
    }, 1000);
  }

  function render(): void {
    const bubbles = messages.map((m) => {
      const isMe = m.from === "me";
      return el(
        "div",
        { class: "kk-row kk-row--" + (isMe ? "me" : "them") },
        isMe ? null : avatar(name, 38),
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
      avatar(name, 34),
      el(
        "div",
        { class: "kk-head__info" },
        el("div", { class: "kk-head__title" }, name),
        el("div", { class: "kk-head__sub" }, `카카오톡 · 만남 성사 확률 ${chance}%`),
      ),
      el("span", { class: "kk-head__ic" }, icon("search", { size: 17 })),
      el("button", { class: "kk-head__close", onclick: () => ctx.closeModal() }, "✕"),
    );

    const foot = el(
      "div",
      { class: "kk-foot" },
      done
        ? el(
            "div",
            { class: "kk-input" },
            el("span", { class: "kk-input__ph" }, "약속을 잡았어요"),
          )
        : el(
            "div",
            { class: "kk-input kk-quick" },
            el(
              "button",
              { class: "btn btn--ghost", onclick: () => ctx.closeModal() },
              "다음에…",
            ),
            el("button", { class: "btn", onclick: accept }, "좋아, 그때 봐!"),
          ),
    );

    container.replaceChildren(head, el("div", { class: "kk-chat" }, ...bubbles), foot);
  }

  render();
  return container;
}
