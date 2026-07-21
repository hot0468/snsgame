import type { GameContext } from "./context";
import type { WorkMsg } from "@/core/types";
import { acceptWorkMsg, canAcceptWork } from "@/systems/workMessenger";
import { dateLabel } from "@/systems/time";
import { el } from "@/utils/dom";
import { avatar, icon } from "./icons";
import type { IconName } from "./icons";

const SENDER = "너아무튼온";

// 좌측 레일 아이콘(순수 장식). 첫 번째(채팅)만 활성 강조.
const RAIL_ICONS: IconName[] = ["comment", "coin", "clock", "grid"];

/**
 * 업무 메신저 "너아무튼온" — 회사가 보낸 업무 요청 목록(작업표시줄 업무 버튼으로 연다).
 * 카톡 PC 클라이언트(아이콘 레일 + 광고 배너 + 검색 헤더 + 채팅 목록 행) 룩앤필.
 * 오른쪽 친구 패널은 게임 데이터가 없어 만들지 않는다. 레일·배너는 장식 프레임(하드코딩).
 * 규칙 계산은 하지 않고 systems(canAcceptWork/acceptWorkMsg)만 호출한다.
 */
export function renderWorkMessengerView(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal wmsg-modal" });

  // 채팅 목록의 한 행(업무 요청 1건 = 채팅방 1개)
  function chatRow(m: WorkMsg): HTMLElement {
    const state = ctx.store.getState();
    const canAccept = !m.resolved && canAcceptWork(state);

    let action: HTMLElement;
    if (m.resolved) {
      action = el("span", { class: "wmsg-chat__done" }, "처리됨");
    } else if (!canAccept) {
      action = el(
        "button",
        { class: "wmsg-chat__accept", disabled: true, title: "남은 시간이 없어" },
        "시간 없어",
      );
    } else {
      action = el(
        "button",
        {
          class: "wmsg-chat__accept wmsg-chat__accept--go",
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
      { class: "wmsg-chat" + (m.resolved ? " wmsg-chat--done" : "") },
      el(
        "span",
        { class: "wmsg-chat__ava" },
        avatar(SENDER, 42),
        !m.resolved && el("span", { class: "wmsg-chat__unread" }, "1"),
      ),
      el(
        "div",
        { class: "wmsg-chat__main" },
        el("span", { class: "wmsg-chat__title" }, SENDER),
        el("span", { class: "wmsg-chat__preview" }, m.text),
      ),
      el(
        "div",
        { class: "wmsg-chat__meta" },
        el("span", { class: "wmsg-chat__date" }, dateLabel(m.day)),
        action,
      ),
    );
  }

  // 좌측 아이콘 레일(장식). 마지막에 닫기.
  function rail(): HTMLElement {
    return el(
      "div",
      { class: "wmsg-rail" },
      ...RAIL_ICONS.map((name, i) =>
        el(
          "span",
          { class: "wmsg-rail__icon" + (i === 0 ? " wmsg-rail__icon--active" : "") },
          icon(name, { size: 22 }),
        ),
      ),
      el(
        "button",
        { class: "wmsg-rail__close", title: "닫기", onclick: () => ctx.closeModal() },
        icon("x", { size: 20 }),
      ),
    );
  }

  function render(): void {
    // 최신 요청이 위로
    const msgs = [...ctx.store.getState().workMsgs].reverse();

    const list =
      msgs.length === 0
        ? el(
            "div",
            { class: "wmsg-empty" },
            "아직 온 업무 요청이 없어요.\n회사에 다니면 평일·주말에 업무 요청이 옵니다.",
          )
        : el("div", { class: "wmsg-list" }, ...msgs.map(chatRow));

    const body = el(
      "div",
      { class: "wmsg-body" },
      // 상단 광고 배너(장식·가상 패러디, 실존 브랜드 없음)
      el(
        "div",
        { class: "wmsg-banner" },
        el("span", { class: "wmsg-banner__tag" }, "AD"),
        el("span", { class: "wmsg-banner__text" }, "너만의 바이브를 켜라 — 아무튼페이 야식결제 3천원 캐시백"),
      ),
      // 검색 헤더 행
      el(
        "div",
        { class: "wmsg-search" },
        el("span", { class: "wmsg-search__title" }, "너아무튼온"),
        el(
          "div",
          { class: "wmsg-search__box" },
          icon("search", { size: 16, className: "wmsg-search__glass" }),
          el("span", { class: "wmsg-search__ph" }, "대화 검색"),
        ),
        el("span", { class: "wmsg-search__ico" }, icon("pen", { size: 17 })),
      ),
      list,
    );

    container.replaceChildren(rail(), body);
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
