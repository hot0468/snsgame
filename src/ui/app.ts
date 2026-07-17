import type { Store } from "@/core/store";
import type { GameState } from "@/core/types";
import { createUIState, type GameContext } from "./context";
import { el } from "@/utils/dom";
import { renderBrowser } from "./browser";
import { renderTaskbar } from "./taskbar";
import { renderStartMenu } from "./startMenu";
import { renderCalendar } from "./calendar";
import { rollEvent } from "@/systems/events";
import { renderEventModal } from "./eventModal";
import { renderGameOver } from "./gameOverModal";
import { dueAppointments } from "@/systems/appointments";
import { renderAppointmentModal } from "./appointmentModal";
import { renderKakaoToast } from "./kakaoModal";
import { isLoanDue } from "@/systems/loan";
import { renderLoanModal } from "./loanModal";
import { isWorkNow } from "@/systems/employment";
import { renderWorkModal } from "./workModal";
import { isLabNow } from "@/systems/lab";
import { renderLabModal } from "./labModal";
import { getControversy } from "@/data/controversies";
import { renderControversyModal } from "./controversyModal";
import { FIRE_MONEY } from "@/core/state";
import { renderFireOfferModal } from "./fireModal";
import { pendingEndingOffer } from "@/systems/endings";
import { renderEndingOfferModal } from "./endingModal";
import { renderDawnModal } from "./dawnModal";
import { renderSleepModal } from "./sns/sleepModal";
import { renderCatPowerModal } from "./catPowerModal";
import { renderConsoleReviewModal } from "./auctionModals";
import { renderLoginScreen } from "./loginScreen";

/**
 * 앱 루트. 스토어를 구독해 전체 화면을 (단순하게) 통째로 다시 그린다.
 * 게임 규모가 작아 전체 재렌더로 충분하며, 유지보수가 단순하다.
 */
export function createApp(root: HTMLElement, store: Store): void {
  const ui = createUIState();
  let toastTimer: number | undefined;
  // 고양이 전원 버튼 블랙아웃 타이머. render()는 스토어 변경·토스트마다 통째로 다시 도므로
  // ui.catBlackout 플래그로 가드해 타이머가 중복 예약되지 않게 한다.
  let catBlackoutTimer: number | undefined;

  // 열려 있는 모달의 DOM 노드를 캐시한다.
  // 전체 재렌더(스토어 변경·토스트 등)마다 모달을 새로 만들면
  // 모달이 스스로 관리하던 내부 단계 상태(예: 이벤트 선택→결과)가 초기화되므로,
  // 같은 모달이면 노드를 재사용하고 모달이 바뀔 때만 다시 만든다.
  let modalFn: ((ctx: GameContext) => HTMLElement) | null = null;
  let modalNode: HTMLElement | null = null;
  // 로그인 화면 노드 캐시(같은 이유 — 입력 중 재렌더에 입력값이 초기화되지 않게).
  let loginNode: HTMLElement | null = null;

  const ctx: GameContext = {
    store,
    ui,
    update: (fn: (draft: GameState) => void) => store.dispatch(fn),
    refresh: () => render(),
    openModal: (renderFn) => {
      ui.modal = renderFn;
      render();
    },
    closeModal: () => {
      ui.modal = null;
      render();
    },
    toast: (message: string) => {
      ui.toast = message;
      render();
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        ui.toast = null;
        render();
      }, 2200);
    },
    afterAction: (trigger) => {
      // 다른 모달이 떠 있으면 이벤트를 겹쳐 띄우지 않는다.
      if (ui.modal) return;
      const event = rollEvent(store.getState(), trigger);
      if (event) ctx.openModal((c) => renderEventModal(c, event));
    },
  };

  function render(): void {
    const state = store.getState();

    // 로그인 화면. 아래 강제 팝업·gameOver보다 **먼저** 판정하고 즉시 return한다 —
    // 로그인 전에는 어떤 모달도 뜨면 안 된다.
    // ("새 게임 시작"은 loggedIn:false인 초기 상태로 replace하므로 여기로 자연히 되돌아온다.)
    if (!state.loggedIn) {
      // 이전 게임에서 남아 있던 팝업/메뉴 정리.
      ui.modal = null;
      modalFn = null;
      modalNode = null;
      ui.startMenuOpen = false;
      ui.calendarOpen = false;
      // 모달 노드와 같은 이유로 캐시한다: 재렌더에 입력값이 날아가지 않게.
      if (!loginNode) loginNode = renderLoginScreen(ctx);
      root.replaceChildren(loginNode);
      return;
    }
    loginNode = null; // 로그인 완료 — 다음 로그인(새 게임) 땐 새로 만든다.

    const gameOver = state.gameOver;

    // 강제 팝업. 우선순위: 새 날 아침 > 취침 > 논란 > 빚 상환 > 연구실 > 근무 > 약속.
    // (연구실이 근무보다 앞이다 — 겹치는 저녁에 연구실이 이긴다.)
    if (!ui.modal && !gameOver) {
      const controversy = state.pendingControversy ? getControversy(state.pendingControversy) : null;
      if (state.dawnPending) {
        // 새 날이 밝으면 해돋이 딤팝업을 가장 먼저 보여준다.
        ui.modal = (c) => renderDawnModal(c);
      } else if (state.sleepPending) {
        // 저녁→심야 진입(무엇이 진행시켰든). dawn 다음 우선순위. 모달의 모든 선택지가 클리어한다.
        ui.modal = (c) => renderSleepModal(c);
      } else if (state.auction.consoleReview === "pending") {
        // 9월 10일 낡은 게임기 리뷰 트윗 선택창(dawnPending과 같은 강제 팝업 패턴).
        // 모달 안에서 postConsoleReview가 pending을 해제해야 다시 뜨지 않는다.
        ui.modal = (c) => renderConsoleReviewModal(c);
      } else if (controversy) {
        ui.modal = (c) => renderControversyModal(c, controversy);
      } else if (isLoanDue(state)) {
        ui.modal = (c) => renderLoanModal(c);
      } else if (isLabNow(state)) {
        // ⚠️ 반드시 isWorkNow보다 **먼저** 판정한다(사용자 확정: 연구실 우선).
        //    평일 저녁에는 야근(isWorkNow)과 연구실이 동시에 true가 될 수 있어,
        //    isWorkNow가 앞에 오면 그 저녁을 야근이 가져가 연구실이 영영 열리지 않는다.
        ui.modal = (c) => renderLabModal(c);
      } else if (isWorkNow(state)) {
        ui.modal = (c) => renderWorkModal(c);
      } else if (dueAppointments(state).length > 0) {
        ui.modal = (c) => renderAppointmentModal(c);
      } else if (state.money >= FIRE_MONEY && !state.fireDeclined) {
        // 소지금 100억 도달 — 파이어족(조기 은퇴) 제안
        ui.modal = (c) => renderFireOfferModal(c);
      } else {
        // 조건부 엔딩 제안(연예인 데뷔·전업 작가 등)
        const ending = pendingEndingOffer(state);
        if (ending) ui.modal = (c) => renderEndingOfferModal(c, ending);
      }
    }

    // 고양이 전원 버튼: 화면을 2초간 까맣게 만든 뒤 팝업으로 이어진다(페널티 없는 개그).
    // 위 강제 팝업 블록 다음에 둔다 — 모달이 떠 있으면(예: 새 날 아침) 덮어쓰지 않고 미루며,
    // catPowerPending은 true로 남아 그 모달이 닫힌 뒤 자연히 발동한다.
    if (state.catPowerPending && !ui.catBlackout && !ui.modal && !gameOver) {
      ui.catBlackout = true;
      window.clearTimeout(catBlackoutTimer);
      catBlackoutTimer = window.setTimeout(() => {
        ui.catBlackout = false;
        // 블랙아웃 도중 다른 강제 팝업이 떴다면 그것을 덮지 않는다(다음 기회에 다시 발동).
        if (!ui.modal) ui.modal = (c) => renderCatPowerModal(c);
        render();
      }, 2000);
    }

    // 우측 하단 카카오톡 토스트: 아직 확인 안 한 최신 알림 하나.
    const kakaoToast = !gameOver
      ? [...state.kakao].reverse().find((t) => t.toastPending) ?? null
      : null;

    // 모달 노드 캐시 갱신: 모달이 바뀌었을 때만 새로 만든다.
    if (ui.modal !== modalFn) {
      modalFn = ui.modal;
      modalNode = ui.modal ? ui.modal(ctx) : null;
    }
    const modalBackdrop =
      ui.modal && modalNode ? el("div", { class: "modal-backdrop" }, modalNode) : null;

    const children: (Node | null)[] = [
      renderBrowser(ctx),
      renderTaskbar(ctx),
      // 스테이터스는 브라우저 오른쪽에 상시 도킹(browser.ts). 달력은 시계 클릭 시 표시.
      ui.calendarOpen ? renderCalendar(ctx) : null,
      ui.startMenuOpen ? renderStartMenu(ctx) : null,
      modalBackdrop,
      ui.toast ? el("div", { class: "toast" }, ui.toast) : null,
      // 카카오톡 토스트는 모달이 없을 때만(모달과 겹치지 않게)
      kakaoToast && !ui.modal ? renderKakaoToast(ctx, kakaoToast) : null,
      // 고양이 전원 버튼 블랙아웃: 모니터가 꺼진 것처럼 전부 가리고 클릭도 먹는다.
      ui.catBlackout ? el("div", { class: "catpower-blackout" }) : null,
      // 게임 오버 오버레이는 최상단에 표시(다른 상호작용 차단)
      gameOver ? renderGameOver(ctx) : null,
    ];
    root.replaceChildren(...children.filter((c): c is Node => c !== null));
  }

  // 상태 변경 시 재렌더
  store.subscribe(() => render());
  render();
}
