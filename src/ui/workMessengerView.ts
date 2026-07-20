import type { GameContext } from "./context";
import type { WorkMsg } from "@/core/types";
import { acceptWorkMsg, canAcceptWork } from "@/systems/workMessenger";
import { dateLabel } from "@/systems/time";
import { el } from "@/utils/dom";
import { avatar } from "./icons";

const SENDER = "너아무튼온";

/**
 * 업무 메신저 "너아무튼온" — 회사가 보낸 업무 요청 목록(작업표시줄 업무 버튼으로 연다).
 * 카톡 친구목록(kklist) 룩앤필을 재사용하되 색조만 업무(파랑)로 구분한다.
 * 규칙 계산은 하지 않고 systems(canAcceptWork/acceptWorkMsg)만 호출한다.
 */
export function renderWorkMessengerView(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal kklist-modal wmsg-modal" });

  function msgRow(m: WorkMsg): HTMLElement {
    const state = ctx.store.getState();
    const canAccept = !m.resolved && canAcceptWork(state);

    let action: HTMLElement;
    if (m.resolved) {
      action = el("span", { class: "kklist__pill kklist__pill--done" }, "처리됨");
    } else if (!canAccept) {
      action = el(
        "button",
        { class: "kklist__pill", disabled: true, title: "남은 시간이 없어" },
        "시간 없어",
      );
    } else {
      action = el(
        "button",
        {
          class: "kklist__pill kklist__pill--accent",
          onclick: () => {
            let ok = false;
            ctx.update((s) => {
              ok = acceptWorkMsg(s, m.id);
            });
            if (ok) {
              ctx.toast("업무 처리 완료 · 성과↑ 정신력·행동력↓", "bad");
              ctx.closeModal(); // advanceTime 부수효과(취침·새벽 팝업) 자연 발생
            } else {
              render();
            }
          },
        },
        "수락",
      );
    }

    return el(
      "div",
      { class: "kklist__row" + (m.resolved ? " kklist__row--done" : "") },
      el("span", { class: "kklist__ava" }, avatar(SENDER, 44)),
      el(
        "div",
        { class: "kklist__main" },
        el(
          "span",
          { class: "kklist__nameline" },
          el("span", { class: "kklist__name" }, SENDER),
          el("span", { class: "kklist__sub" }, dateLabel(m.day)),
        ),
        el("span", { class: "kklist__sub wmsg__text" }, m.text),
      ),
      action,
    );
  }

  function render(): void {
    // 최신 요청이 위로
    const msgs = [...ctx.store.getState().workMsgs].reverse();

    const body =
      msgs.length === 0
        ? el(
            "div",
            { class: "kklist__empty" },
            "아직 온 업무 요청이 없어요.\n회사에 다니면 평일·주말에 업무 요청이 옵니다.",
          )
        : el("div", { class: "kklist" }, el("div", { class: "kklist__group" }, ...msgs.map(msgRow)));

    container.replaceChildren(
      el(
        "div",
        { class: "kklist__topbar wmsg__topbar" },
        el("span", { class: "kklist__title" }, "너아무튼온"),
        el("button", { class: "kklist__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el("div", { class: "kklist__panel" }, body),
    );
  }

  render();
  return container;
}

/**
 * 우측 하단 업무 메신저 토스트. 카톡 토스트와 같은 그릇(kakao-toast)을 색조만 바꿔 재사용.
 * @param stacked 카톡 토스트가 동시에 떠 있으면 그 위로 쌓아 겹침 방지.
 */
export function renderWorkToast(ctx: GameContext, msg: WorkMsg, stacked: boolean): HTMLElement {
  return el(
    "button",
    {
      class: "kakao-toast kakao-toast--work" + (stacked ? " kakao-toast--stacked" : ""),
      onclick: () => {
        ctx.update((s) => {
          for (const m of s.workMsgs) m.toastPending = false;
        });
        ctx.openModal(renderWorkMessengerView);
      },
    },
    el("span", { class: "kakao-toast__badge" }, "WORK"),
    el(
      "span",
      { class: "kakao-toast__body" },
      el("span", { class: "kakao-toast__sender" }, SENDER),
      el("span", { class: "kakao-toast__preview" }, msg.text),
    ),
  );
}
