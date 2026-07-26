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
import { renderWorkToast } from "./workMessengerView";
import { isLoanDue } from "@/systems/loan";
import { renderLoanModal } from "./loanModal";
import { isWorkNow } from "@/systems/employment";
import { renderWorkModal } from "./workModal";
import { isLabNow } from "@/systems/lab";
import { renderLabModal } from "./labModal";
import { getControversy } from "@/data/controversies";
import { renderControversyModal } from "./controversyModal";
import { FIRE_MONEY, LATE_SLOT } from "@/core/state";
import { renderFireOfferModal } from "./fireModal";
import { pendingEndingOffer } from "@/systems/endings";
import { renderEndingOfferModal } from "./endingModal";
import { renderDawnModal } from "./dawnModal";
import { renderSickModal } from "./sickModal";
import { renderSleepModal } from "./sns/sleepModal";
import { renderHauntModal } from "./sns/hauntModal";
import { renderDrunkTweetModal, renderMorningRegretModal } from "./drunkModal";
import { renderNewsModal } from "./newsModal";
import { renderCatPowerModal } from "./catPowerModal";
import { renderConsoleReviewModal } from "./auctionModals";
import { renderLoginScreen } from "./loginScreen";
import { renderPostSlotModal } from "./postLimitModal";
import { ACHIEVEMENTS } from "@/data/achievements";
import { MILESTONE_TITLES } from "@/data/milestones";

/**
 * 앱 루트. 스토어를 구독해 전체 화면을 (단순하게) 통째로 다시 그린다.
 * 게임 규모가 작아 전체 재렌더로 충분하며, 유지보수가 단순하다.
 */
export function createApp(root: HTMLElement, store: Store): void {
  const ui = createUIState();
  let toastTimer: number | undefined;
  // 업적 달성 토스트 소비가 마이크로태스크로 이미 예약됐는지(한 프레임에 render가 여러 번
  // 돌아도 중복 예약하지 않게 한다). computeDrops의 commitScheduled와 같은 가드.
  let achToastScheduled = false;
  // 마일스톤 달성 토스트도 같은 마이크로태스크 가드로 중복 예약을 막는다.
  let mileToastScheduled = false;
  // 예언 실현 토스트 가드.
  let prophecyToastScheduled = false;
  // 트친 성사 토스트도 같은 마이크로태스크 가드로 중복 예약을 막는다.
  let tchinToastScheduled = false;
  // 고양이 전원 버튼 블랙아웃 타이머. render()는 스토어 변경·토스트마다 통째로 다시 도므로
  // ui.catBlackout 플래그로 가드해 타이머가 중복 예약되지 않게 한다.
  let catBlackoutTimer: number | undefined;

  // 열려 있는 모달의 DOM 노드를 캐시한다.
  // 전체 재렌더(스토어 변경·토스트 등)마다 모달을 새로 만들면
  // 모달이 스스로 관리하던 내부 단계 상태(예: 이벤트 선택→결과)가 초기화되므로,
  // 같은 모달이면 노드를 재사용하고 모달이 바뀔 때만 다시 만든다.
  let modalFn: ((ctx: GameContext) => HTMLElement) | null = null;
  let modalNode: HTMLElement | null = null;
  // 모달 전용 레이어 — root.replaceChildren 대상 밖에 둔다. 매 재렌더에 모달/백드롭을 뗐다
  // 붙이면 CSS 등장 애니메이션(modal-pop·backdrop-fade)이 재생돼 "두 번 뜨는 듯" 깜빡인다.
  // 표시할 모달이 실제로 바뀔 때만 이 레이어를 갈아끼워 애니메이션이 한 번만 재생되게 한다.
  const modalLayer = el("div", { class: "modal-layer" });
  (root.parentElement ?? document.body).appendChild(modalLayer);
  let layerNode: HTMLElement | null = null; // 현재 레이어에 붙어 있는 모달 노드
  // 로그인 화면 노드 캐시(같은 이유 — 입력 중 재렌더에 입력값이 초기화되지 않게).
  let loginNode: HTMLElement | null = null;
  // 스크롤 보존용: 직전 렌더의 '뷰 키'. 같은 뷰에서 재렌더될 때만(영상 모달 열고닫기 등)
  // 스크롤 위치를 복원하고, 탭·페이지가 바뀐 재렌더는 자연히 맨 위에서 시작하게 둔다.
  let lastViewKey = "";
  // 전체 재렌더는 스크롤 컨테이너를 새 노드로 갈아끼워 scrollTop을 0으로 되돌린다.
  // 너튜브(.browser__content)·야밤(.yabam__body) 본문 + SNS 피드(.sns__feed)를 보존한다.
  // .sns__feed는 자체 overflow-y:auto라 별도 스크롤 컨테이너다 — 좋아요·리트윗 재렌더에
  // 이걸 저장·복원하지 않으면 피드가 매번 최상단으로 튄다.
  const SCROLL_SELECTORS = [".browser__content", ".yabam__body", ".sns__feed"];

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
    toast: (message: string, kind) => {
      ui.toast = message;
      // 명시 kind 우선. 없으면 메시지 내용으로 부정 알림을 추정해 빨갛게 표시한다.
      // (음수 증감 "-3" 또는 부정 키워드) — ponytail 휴리스틱: 대다수만 잡으면 충분.
      ui.toastKind =
        kind ??
        (/-\s*\d|실패|하락|빠졌|깎|떨어|미달|추징|부족|손실|이탈|삭감|반으로/.test(message)
          ? "bad"
          : null);
      render();
      window.clearTimeout(toastTimer);
      toastTimer = window.setTimeout(() => {
        ui.toast = null;
        ui.toastKind = null;
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
      modalLayer.replaceChildren();
      layerNode = null;
      ui.startMenuOpen = false;
      ui.calendarOpen = false;
      // 모달 노드와 같은 이유로 캐시한다: 재렌더에 입력값이 날아가지 않게.
      if (!loginNode) loginNode = renderLoginScreen(ctx);
      root.replaceChildren(loginNode);
      return;
    }
    loginNode = null; // 로그인 완료 — 다음 로그인(새 게임) 땐 새로 만든다.

    const gameOver = state.gameOver;

    // 강제 팝업. 우선순위: 새 날 아침 > 괴담 방문 > 취침 > 논란 > 빚 상환 > 연구실 > 근무 > 약속.
    // (연구실이 근무보다 앞이다 — 겹치는 저녁에 연구실이 이긴다.)
    if (!ui.modal && !gameOver) {
      const controversy = state.pendingControversy ? getControversy(state.pendingControversy) : null;
      if (state.dawnPending) {
        // 새 날이 밝으면 보던 화면과 무관하게 SNS 홈 추천탭으로 되돌린다(팝업이 막고 있어 무해).
        ui.activeTab = "sns";
        ui.snsPage = "home";
        ui.homeTab = "recommend";
        // 해돋이 딤팝업을 가장 먼저 보여준다.
        ui.modal = (c) => renderDawnModal(c);
      } else if (state.pendingRegretTweetId) {
        // 이불킥 — 어젯밤 취중 트윗. 새 날 아침(dawn) 다음으로 뜬다(삭제/방치가 flag를 클리어).
        ui.modal = (c) => renderMorningRegretModal(c);
      } else if (state.pendingNews) {
        // 내 트윗이 기사화 — 다음날 아침 강제 팝업. dawn 다음, 이불킥/취침류와 같은 층.
        // 팝업의 모든 선택(resolveNews)이 pendingNews를 클리어해야 재팝업되지 않는다.
        ui.modal = (c) => renderNewsModal(c);
      } else if (state.sickPending) {
        // 체력이 바닥나 앓아누운 날 — 아무것도 못 한다(haunt/취침/근무/약속보다 먼저).
        ui.modal = (c) => renderSickModal(c);
      } else if (state.hauntVisitNow) {
        // 괴담 계정 심야 방문. dawn 다음, 취침보다 먼저 — 문을 열어야(resolveHauntVisit) flag가 풀린다.
        ui.modal = (c) => renderHauntModal(c);
      } else if (state.drunkPending) {
        // 심야 취중 트윗 — 취침보다 먼저(등록이 밤을 마감하고 다음날로 넘긴다).
        ui.modal = (c) => renderDrunkTweetModal(c);
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
      } else if (state.postSlotIncreasedTo != null) {
        // 팔로워 티어가 올라 오늘 게시 가능 트윗 수가 늘었다는 안내(확인 시 systems 플래그 클리어).
        ui.modal = (c) => renderPostSlotModal(c, state.postSlotIncreasedTo!);
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

    // 업적 달성 토스트. systems가 pendingAchievements에 새로 달성한 id를 쌓아두면
    // 여기서 이름을 찾아 토스트로 알리고 **배열을 비운다**(안 비우면 매 렌더 재토스트).
    // 렌더 도중 update/toast를 재진입시키지 않도록 마이크로태스크로 미룬다(computeDrops 선례).
    if (!gameOver && state.pendingAchievements?.length && !achToastScheduled) {
      achToastScheduled = true;
      queueMicrotask(() => {
        achToastScheduled = false;
        const ids = store.getState().pendingAchievements;
        if (!ids?.length) return;
        const names = ids
          .map((id) => ACHIEVEMENTS.find((a) => a.id === id)?.name)
          .filter((n): n is string => !!n);
        ctx.update((d) => {
          d.pendingAchievements = [];
        });
        if (names.length === 0) return;
        const msg =
          names.length === 1
            ? `🏆 업적 달성: ${names[0]}`
            : `🏆 업적 달성: ${names[0]} 외 ${names.length - 1}개`;
        ctx.toast(msg, "good");
      });
    }

    // 마일스톤 달성 토스트. systems가 pendingMilestones에 쌓아둔 id의 칭호를 찾아
    // 알린 뒤 **배열을 비운다**(안 비우면 매 렌더 재토스트). 업적 토스트와 동일 패턴.
    if (!gameOver && state.pendingMilestones?.length && !mileToastScheduled) {
      mileToastScheduled = true;
      queueMicrotask(() => {
        mileToastScheduled = false;
        const ids = store.getState().pendingMilestones;
        if (!ids?.length) return;
        const labels = ids
          .map((id) => {
            const [skill, tierStr] = id.split(":");
            const titles = MILESTONE_TITLES[skill as keyof typeof MILESTONE_TITLES];
            return titles ? titles[Number(tierStr)] : null;
          })
          .filter((n): n is string => !!n);
        ctx.update((d) => {
          d.pendingMilestones = [];
        });
        if (labels.length === 0) return;
        const msg =
          labels.length === 1
            ? `🏅 마일스톤 달성: ${labels[0]}`
            : `🏅 마일스톤 달성: ${labels[0]} 외 ${labels.length - 1}개`;
        ctx.toast(msg, "good");
      });
    }

    // 예언 실현 토스트. onNewDay가 pendingProphecyText를 채우면 여기서 알린 뒤 비운다.
    if (!gameOver && state.pendingProphecyText && !prophecyToastScheduled) {
      prophecyToastScheduled = true;
      queueMicrotask(() => {
        prophecyToastScheduled = false;
        const text = store.getState().pendingProphecyText;
        ctx.update((d) => {
          d.pendingProphecyText = null;
        });
        if (text) ctx.toast(text);
      });
    }

    // 트친 성사 토스트. systems/tchin이 pendingTchinToasts에 새 트친 핸들을 쌓아두면
    // 여기서 알린 뒤 **배열을 비운다**(안 비우면 매 렌더 재토스트). 업적 토스트와 동일 패턴.
    if (!gameOver && state.pendingTchinToasts?.length && !tchinToastScheduled) {
      tchinToastScheduled = true;
      queueMicrotask(() => {
        tchinToastScheduled = false;
        const handles = store.getState().pendingTchinToasts;
        if (!handles?.length) return;
        ctx.update((d) => {
          d.pendingTchinToasts = [];
        });
        const msg =
          handles.length === 1
            ? `🤝 @${handles[0]}님과 트친이 됐어요!`
            : `🤝 @${handles[0]} 외 ${handles.length - 1}명과 트친이 됐어요!`;
        ctx.toast(msg, "good");
      });
    }

    // 우측 하단 카카오톡 토스트: 아직 확인 안 한 최신 알림 하나.
    const kakaoToast = !gameOver
      ? [...state.kakao].reverse().find((t) => t.toastPending) ?? null
      : null;
    // 업무 메신저 토스트: 카톡과 동시에 뜨면 그 위로 쌓아 겹치지 않게 한다.
    const workToast = !gameOver
      ? [...state.workMsgs].reverse().find((m) => m.toastPending) ?? null
      : null;

    // 모달 노드 캐시 갱신: 모달이 바뀌었을 때만 새로 만든다.
    if (ui.modal !== modalFn) {
      modalFn = ui.modal;
      modalNode = ui.modal ? ui.modal(ctx) : null;
    }
    // 전용 레이어에 표시할 모달이 바뀔 때만 백드롭째 갈아끼운다(같은 모달의 재렌더엔 손대지
    // 않아 등장 애니메이션이 재생되지 않는다). 게임오버 오버레이가 뜰 땐 모달을 내린다.
    const shownModalNode = ui.modal && !gameOver ? modalNode : null;
    if (shownModalNode !== layerNode) {
      layerNode = shownModalNode;
      if (layerNode) {
        modalLayer.replaceChildren(el("div", { class: "modal-backdrop" }, layerNode));
      } else {
        modalLayer.replaceChildren();
      }
    }

    const children: (Node | null)[] = [
      renderBrowser(ctx),
      renderTaskbar(ctx),
      // 스테이터스는 브라우저 오른쪽에 상시 도킹(browser.ts). 달력은 시계 클릭 시 표시.
      ui.calendarOpen ? renderCalendar(ctx) : null,
      ui.startMenuOpen ? renderStartMenu(ctx) : null,
      ui.toast
        ? el(
            "div",
            {
              class:
                "toast" +
                (ui.toastKind === "bad"
                  ? " toast--bad"
                  : ui.toastKind === "good"
                    ? " toast--good"
                    : ""),
            },
            ui.toast,
          )
        : null,
      // 카카오톡 토스트는 모달이 없을 때만(모달과 겹치지 않게)
      kakaoToast && !ui.modal ? renderKakaoToast(ctx, kakaoToast) : null,
      // 업무 메신저 토스트도 모달이 없을 때만. 카톡 토스트와 동시면 위로 쌓는다.
      workToast && !ui.modal ? renderWorkToast(ctx, workToast, !!kakaoToast) : null,
      // 고양이 전원 버튼 블랙아웃: 모니터가 꺼진 것처럼 전부 가리고 클릭도 먹는다.
      ui.catBlackout ? el("div", { class: "catpower-blackout" }) : null,
      // 게임 오버 오버레이는 최상단에 표시(다른 상호작용 차단)
      gameOver ? renderGameOver(ctx) : null,
    ];
    // 스크롤 보존: 뷰(탭·SNS페이지·열린 사이트·상세 id 등)가 직전 렌더와 같으면
    // 재렌더 전 스크롤 컨테이너의 scrollTop을 저장했다가 재렌더 후 복원한다.
    const viewKey = [
      ui.activeTab, ui.snsPage, ui.homeTab, ui.wishSiteOpen, ui.goblinSiteOpen,
      ui.onetSiteOpen, ui.auctionSiteOpen, ui.dstorySiteOpen, ui.portalArticleId,
      ui.exploreSelectedId, ui.mailSelectedId, ui.dartpinPostId, ui.dstoryPostId,
      ui.tweetDetailId, ui.dmThreadId, ui.searchCategory,
    ].join("|");
    const savedScroll: Record<string, number> = {};
    if (viewKey === lastViewKey) {
      for (const sel of SCROLL_SELECTORS) {
        const e = root.querySelector<HTMLElement>(sel);
        if (e) savedScroll[sel] = e.scrollTop;
      }
    }
    lastViewKey = viewKey;

    root.replaceChildren(...children.filter((c): c is Node => c !== null));
    // 취중(drunkPending) 동안 앱 배경을 블러 처리한다(모달 레이어는 root 밖이라 선명하게 유지).
    root.classList.toggle("drunk-blur", !!state.drunkPending && !gameOver);
    // 시간대 앰비언트: 심야엔 데스크톱 배경을 밤 톤으로 어둡게(하루 안 시간 흐름 체감).
    root.classList.toggle("night", state.slot === LATE_SLOT && state.loggedIn && !gameOver);

    for (const sel in savedScroll) {
      const e = root.querySelector<HTMLElement>(sel);
      if (e) {
        // 방금 삽입한 새 노드는 아직 레이아웃이 없어 scrollTop이 0으로 클램프된다.
        // scrollHeight를 읽어 리플로를 강제한 뒤 복원해야 값이 유지된다.
        void e.scrollHeight;
        e.scrollTop = savedScroll[sel];
      }
    }
  }

  // 상태 변경 시 재렌더
  store.subscribe(() => render());
  render();
}
