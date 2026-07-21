import type { GameContext } from "./context";
import { pickBossJoke, laughAtBossJoke } from "@/systems/bossJoke";
import { BOSS_NAME, BOSS_LAUGH_REPLIES, BOSS_ALREADY_LAUGHED } from "@/data/bossJokes";
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { avatar, icon } from "./icons";

/**
 * 부장님 카톡 챗 모달 — 아재개그로 개그(comedy) 스탯을 얻는 전용 특수 친구.
 * kakaoModal의 kk-* 버블 스타일을 재사용한다. 열 때마다 새 아재개그(랜덤).
 * openModal은 함수 identity로 노드를 캐시하므로, 상태 변경 뒤엔 내부 render()로 다시 그린다.
 */
export function renderBossChatModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal kakao-modal" });

  // 이번에 연 창의 대화(휘발성). 부장님 아재개그 1개로 시작.
  const joke = pickBossJoke(ctx.store.getState());
  const bubbles: { from: "me" | "them"; text: string }[] = [
    { from: "them", text: joke },
  ];
  let laughed = false; // 이번 창에서 이미 반응함(버튼 숨김)

  function bubbleRow(from: "me" | "them", text: string, showHead: boolean): HTMLElement {
    const isMe = from === "me";
    return el(
      "div",
      { class: "kk-row kk-row--" + (isMe ? "me" : "them") },
      !isMe
        ? showHead
          ? avatar(BOSS_NAME, 38)
          : el("span", { class: "kk-avatar-gap" })
        : null,
      el(
        "div",
        { class: "kk-col" },
        showHead ? el("div", { class: "kk-name" }, BOSS_NAME) : null,
        el("div", { class: "kk-bubble kk-bubble--" + (isMe ? "me" : "them") }, text),
      ),
    );
  }

  function render(): void {
    const rows = bubbles.map((m, i) => {
      const showHead = m.from === "them" && (i === 0 || bubbles[i - 1].from !== "them");
      return bubbleRow(m.from, m.text, showHead);
    });

    const head = el(
      "div",
      { class: "kk-head" },
      avatar(BOSS_NAME, 34),
      el(
        "div",
        { class: "kk-head__info" },
        el("div", { class: "kk-head__title" }, BOSS_NAME),
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

    const laugh = el(
      "button",
      {
        class: "btn",
        onclick: () => {
          let gained = 0;
          ctx.update((s) => {
            gained = laughAtBossJoke(s);
          });
          laughed = true;
          if (gained > 0) {
            ctx.toast(`개그 +${gained} 😆`);
            bubbles.push({ from: "me", text: "ㅋㅋㅋㅋㅋ 재밌다" });
            bubbles.push({ from: "them", text: pick(BOSS_LAUGH_REPLIES) });
          } else {
            // 오늘 이미 웃음 — 스탯 안 오름, 시무룩한 반응(답장 버블 없음)
            ctx.toast(pick(BOSS_ALREADY_LAUGHED));
          }
          render();
        },
      },
      "재밌다 ㅋㅋㅋ",
    );
    const close = el(
      "button",
      { class: "btn btn--ghost", onclick: () => ctx.closeModal() },
      "아 부장님~",
    );

    const foot = el(
      "div",
      { class: "kk-foot" },
      el("div", { class: "kk-input kk-quick" }, ...(laughed ? [close] : [close, laugh])),
      el(
        "div",
        { class: "kk-inputbar" },
        el("span", { class: "kk-inputbar__ic" }, "＋"),
        el("span", { class: "kk-inputbar__ic" }, "🙂"),
        el("span", { class: "kk-inputbar__ic" }, "🗎"),
        el("span", { class: "kk-inputbar__send" }, "전송"),
      ),
    );

    container.replaceChildren(head, el("div", { class: "kk-chat" }, ...rows), foot);
  }

  render();
  return container;
}
