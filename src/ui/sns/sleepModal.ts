import type { GameContext } from "@/ui/context";
import { advanceTime } from "@/systems/time";
import { runSavannaStream } from "@/systems/savanna";
import { doOfflineActivity, AUTHOR_WORK_ACTIVITY } from "@/systems/offline";
import { renderSavannaIntrusionModal } from "./savannaModal";
import { canWorkAvNow } from "@/systems/avJob";
import { renderAvWorkModal } from "@/ui/avWorkModal";
import { el } from "@/utils/dom";
import { icon } from "@/ui/icons";

/**
 * 저녁→심야 전환 시 뜨는 취침 선택(app.ts가 state.sleepPending을 감지해 띄운다).
 * 트윗은 이제 시간을 안 쓰므로, 오프라인 활동·근무 등 심야로 넘긴 무엇이든 트리거가 된다.
 * - 자러 가기: 바로 다음날로(수면 충분 → 회복 정상).
 * - 남는다: 심야 슬롯에 남아 심야 트윗을 쓸 수 있음(단, 심야 트윗 시 회복 감소).
 * - 사바나 라이브방송: 여캠 계약 시에만. 도네이션을 벌고 다음날로.
 * ⚠️ 모든 선택지가 sleepPending을 반드시 클리어한다 — 안 그러면 app.ts가 매 render마다 다시 띄운다.
 */
export function renderSleepModal(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "modal" });

  function choice(title: string, desc: string, onclick: () => void, cls = ""): HTMLElement {
    return el(
      "button",
      { class: "event-choice" + (cls ? " " + cls : ""), onclick },
      el("b", {}, title),
      el("div", { class: "sleep-choice__desc" }, desc),
    );
  }

  function head(title: string): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("bed", { size: 18 }), title),
    );
  }

  function showResult(message: string, title = "방송 종료"): void {
    container.replaceChildren(
      head(title),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.8;margin:0 0 16px" }, message),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.closeModal();
              ctx.afterAction("day");
            },
          },
          "다음날로",
        ),
      ),
    );
  }

  function showIntro(): void {
    const state = ctx.store.getState();
    const savannaJoined = state.savannaJoined;
    const underContract = state.authorContract != null;

    container.replaceChildren(
      head("저녁이 지났다"),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { class: "compose-hint", style: "margin-top:0;font-size:14px" },
          "이제 잘까, 심야까지 남아 트윗을 더 쓸까?",
        ),
        choice("자러 가기", "푹 자고 다음날 컨디션을 회복한다.", () => {
          ctx.update((s) => {
            s.sleepPending = false;
            advanceTime(s, 1); // 심야를 건너뛰고 다음날로(LATE→다음날은 sleepPending을 재설정하지 않는다)
          });
          ctx.closeModal();
          ctx.afterAction("day");
        }),
        choice("남는다", "심야 트윗을 쓸 수 있지만, 잠이 부족해 다음날 회복이 줄어든다.", () => {
          ctx.update((s) => {
            s.sleepPending = false; // 심야에 남되 팝업은 클리어(다시 뜨지 않게)
          });
          ctx.closeModal();
          ctx.toast("심야까지 깨어있기로 했다");
        }),
        underContract
          ? choice(
              "✍️ 작업 (원고 작업)",
              "심야에 원고를 붙잡아 이번 달 작업량을 채운다. 행동력·정신력을 쓰고 다음날로 넘어간다.",
              () => {
                let msg = "";
                ctx.update((s) => {
                  s.sleepPending = false; // doOfflineActivity가 다음날로 넘긴다
                  msg = doOfflineActivity(s, AUTHOR_WORK_ACTIVITY).message;
                });
                showResult(msg, "작업 완료");
              },
            )
          : null,
        savannaJoined
          ? choice(
              "🔴 사바나 라이브방송",
              "심야에 라이브 방송을 켜고 도네이션을 번다.",
              () => {
                let scenario = false;
                let msg = "";
                ctx.update((s) => {
                  s.sleepPending = false; // runSavannaStream이 다음날로 넘긴다
                  const r = runSavannaStream(s);
                  scenario = r.scenario ?? false;
                  msg = r.message;
                });
                if (scenario) {
                  // 시청자 난입 장문 시나리오로 전환
                  ctx.closeModal();
                  ctx.openModal(renderSavannaIntrusionModal);
                } else {
                  showResult(msg);
                }
              },
            )
          : null,
        // AV 촬영 업무 — 심야 활동이라 취침 모달에서 접근한다(상태-독 버튼은 취침 모달에 가려짐).
        canWorkAvNow(state)
          ? choice(
              "🎬 AV 촬영 업무",
              "심야 성인물 촬영을 뛰고 이번 달 근무일·수입을 채운다. 행동력을 쓰고 다음날로 넘어간다.",
              () => {
                ctx.update((s) => {
                  s.sleepPending = false; // avWorkModal의 resolveAvWork가 다음날로 넘긴다
                });
                ctx.closeModal();
                ctx.openModal(renderAvWorkModal);
              },
              "event-choice--av",
            )
          : null,
      ),
    );
  }

  showIntro();
  return container;
}
