import type { GameContext } from "./context";
import type { ConsoleReviewResult, EyeDealResult } from "@/systems/auction";
import { postConsoleReview } from "@/systems/auction";
import { SKILL_STATS } from "@/data/stats";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 서던피스 경매 후속 분기의 딤팝업 2종.
 *  1) 낡은 게임기 → 9월 10일 리뷰 트윗 선택창(state.auction.consoleReview === "pending").
 *     dawnPending/catPowerPending과 같은 강제 팝업 패턴이라 app.ts가 띄우고,
 *     여기서 postConsoleReview를 호출해 pending을 반드시 해제한다(안 하면 계속 다시 뜬다).
 *  2) 진홍안 → 금발의 신사 제안의 결과 표시(DM 버튼에서 호출).
 *
 * ⚠️ 보상 계산은 전부 systems/auction이 한다. 여기서는 반환된 결과를 문구로 옮기기만 한다.
 * ============================================================ */

/** 결과 한 줄(항목 · 값) */
function resultRow(label: string, value: string): HTMLElement {
  return el(
    "div",
    { class: "auc-result__row" },
    el("span", { class: "auc-result__label" }, label),
    el("span", { class: "auc-result__val" }, value),
  );
}

/** 리뷰 트윗 게시 결과 */
function renderConsoleReviewResult(ctx: GameContext, r: ConsoleReviewResult): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "리뷰가 터졌다"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "auc-result__lead" },
        "올리자마자 인용이 붙기 시작했다. 타임라인이 이 게임기 이야기로 덮였다.",
      ),
      el(
        "div",
        { class: "auc-result" },
        resultRow("팔로워", `+${formatNumber(r.followerDelta)}`),
        resultRow(SKILL_STATS.game.label, `+${r.skillGain}`),
      ),
      el(
        "div",
        { class: "compose-actions" },
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
      ),
    ),
  );
}

/**
 * 9월 10일 낡은 게임기 리뷰 트윗 선택창.
 * ⚠️ 어느 쪽을 고르든 postConsoleReview가 consoleReview를 pending에서 빼므로 다시 뜨지 않는다.
 */
export function renderConsoleReviewModal(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "낡은 게임기"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "auc-result__lead" },
        "밤새 붙잡고 있었다. 어깨가 굳고 눈이 시린데도 손이 떨어지질 않는다.\n" +
          "왜인지 리뷰 트윗을 올리고 싶어졌다.",
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el(
          "button",
          {
            class: "btn btn--ghost",
            onclick: () => {
              // post=false면 systems가 declined로 닫는다(반환값 null).
              ctx.update((s) => {
                postConsoleReview(s, false);
              });
              ctx.closeModal();
            },
          },
          "올리지 않는다",
        ),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              let r: ConsoleReviewResult | null = null;
              ctx.update((s) => {
                r = postConsoleReview(s, true);
              });
              const result = r as ConsoleReviewResult | null;
              if (!result) {
                ctx.closeModal();
                return;
              }
              ctx.openModal((c) => renderConsoleReviewResult(c, result));
            },
          },
          "리뷰를 올린다",
        ),
      ),
    ),
  );
}

/** 진홍안을 넘긴 뒤의 사례 결과(금발의 신사 DM에서 이어진다) */
export function renderEyeDealResultModal(ctx: GameContext, r: EyeDealResult): HTMLElement {
  const skillLabel = r.skill ? SKILL_STATS[r.skill].label : null;
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, "사례"),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "auc-result__lead" },
        "물건을 건넨 자리에서 신사는 오래 인사했다. 돌아서는 길에, 어제까지 안 되던 것이 되기 시작했다.",
      ),
      el(
        "div",
        { class: "auc-result" },
        resultRow("사례금", `+${formatNumber(r.money)}원`),
        resultRow("도덕성", "가득 참"),
        skillLabel ? resultRow(skillLabel, `+${r.skillGain}`) : null,
      ),
      el(
        "div",
        { class: "compose-actions" },
        el("button", { class: "btn", onclick: () => ctx.closeModal() }, "확인"),
      ),
    ),
  );
}
