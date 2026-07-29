import type { GameContext } from "./context";
import {
  PREMIUM_FOLLOWER_MULTIPLIER,
  PREMIUM_MONTHLY_FEE,
  monthlyFollowerIncome,
  totalFollowers,
} from "@/systems/economy";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/* ============================================================
 * 트위터 프리미엄 가입/해지 모달(좌측 네비의 '프리미엄'에서 연다).
 *
 * ⚠️ 아래 안내 문구는 전부 systems/economy의 상수·함수에서 뽑아 쓴다.
 *    수치를 문자열에 직접 박지 마라 — 구독료나 배율을 바꾸면 안내가 곧바로 거짓말이 된다.
 *    손익분기 팔로워 수는 **일부러 안 알려준다**(사용자 확정). 가입/해지 시 수익 두 줄만 보여주고
 *    이득인지는 플레이어가 판단한다 — PREMIUM_BREAKEVEN_FOLLOWERS를 문구로 되살리지 마라.
 * 첫 달 구독료는 가입 즉시가 아니라 **다음 정산일(매월 1일)**에 빠진다 — 청구가
 * settleMonthlyIncome 한 곳에만 있어야 이중 청구가 안 생긴다.
 * ============================================================ */

const won = (n: number): string => n.toLocaleString("ko-KR");

export function renderPremiumModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const joined = s.premium;
  const followers = totalFollowers(s);
  // 지금 수익과 '반대편'(가입/해지 시) 수익을 나란히 보여준다.
  const now = monthlyFollowerIncome(s);
  const flipped = joined ? now / PREMIUM_FOLLOWER_MULTIPLIER : now * PREMIUM_FOLLOWER_MULTIPLIER;

  const row = (label: string, value: string): HTMLElement =>
    el(
      "div",
      { style: "display:flex;justify-content:space-between;gap:12px;font-size:13.5px;padding:4px 0" },
      el("span", { style: "color:var(--text-muted)" }, label),
      el("b", {}, value),
    );

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el(
        "span",
        { class: "modal__head-title" },
        icon("star", { size: 18 }),
        joined ? "프리미엄 구독 중" : "트위터 프리미엄",
      ),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:13.5px;color:var(--text-muted);line-height:1.6;margin:0 0 12px" },
        `월 ${won(PREMIUM_MONTHLY_FEE)}원. 매월 1일 팔로워 수익을 정산할 때 함께 빠져나가고, ` +
          `구독 중에는 팔로워 수익이 ${PREMIUM_FOLLOWER_MULTIPLIER}배가 됩니다.`,
      ),
      row("내 팔로워", `${won(followers)}명`),
      row("이번 달 팔로워 수익", `${won(now)}원`),
      row(joined ? "해지하면" : "가입하면", `${won(flipped)}원`),
      el(
        "p",
        { style: "font-size:12.5px;color:var(--text-muted);line-height:1.6;margin:12px 0 16px" },
        joined
          ? "해지하면 다음 정산부터 구독료가 청구되지 않습니다."
          : "정산일에 잔고가 모자라면 빚을 지지 않고 구독이 자동 해지됩니다.",
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "닫기"),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update((st) => {
                st.premium = !st.premium;
              });
              ctx.closeModal();
              ctx.toast(joined ? "프리미엄을 해지했어요" : "프리미엄에 가입했어요");
            },
          },
          joined ? "구독 해지" : "구독하기",
        ),
      ),
    ),
  );
}
