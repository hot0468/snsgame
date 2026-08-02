import type { GameContext } from "./context";
import { INACTIVE_DAYS } from "@/systems/time";
import {
  followersToNextRank,
  followersToRankIn,
  rankAnnouncement,
  rankTier,
} from "@/systems/popularity";
import { RANK1_FOLLOWERS, RANK_SIZE } from "@/data/popularity";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 무활동 팔로워 감소 알림.
 *
 * ⚠️ 예전엔 조용히 숫자만 줄었다. 팔로워가 안 느는 게 트윗이 안 먹혀서인지 그냥 안 써서인지
 *    구분이 안 됐다 — 이 팝업이 그걸 구분해 준다. 확인이 `pendingDecay`를 비운다.
 */
export function renderDecayModal(ctx: GameContext): HTMLElement {
  const d = ctx.store.getState().pendingDecay;
  const days = d?.days ?? INACTIVE_DAYS;
  const lost = d?.lost ?? 0;

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("megaphone", { size: 18 }), "조용한 타임라인"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.7;margin:0 0 10px" },
        `${days}일째 아무것도 안 올렸다. 알림이 안 뜨는 계정은 금방 잊힌다 — ` +
          `오늘 팔로워 ${formatNumber(lost)}명이 조용히 빠져나갔다.`,
      ),
      el(
        "p",
        { class: "compose-hint", style: "margin:0 0 16px" },
        "트윗을 하나라도 올리면 그날부터 감소가 멈춘다.",
      ),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((s) => {
              s.pendingDecay = null;
            });
            ctx.closeModal();
          },
        },
        "확인",
      ),
    ),
  );
}

/**
 * 월간 인기 순위 발표(말일 집계).
 *
 * ⚠️ **다음 순위까지 남은 팔로워를 함께 보여준다.** 순위만 던지면 그냥 숫자 하나지만,
 *    "6,200명만 더" 가 붙으면 다음 달 트윗의 이유가 된다 — 그게 이 장치의 목적이다.
 */
export function renderPopularityModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const p = s.popularity;
  const tier = rankTier(p.rank);
  const toNext = p.rank == null ? null : followersToNextRank(p.followers);

  const goalLine =
    p.rank === 1
      ? `1위는 팔로워 ${formatNumber(RANK1_FOLLOWERS)}명부터다. 여기서 더 갈 곳은 100만뿐이다.`
      : p.rank == null
        ? `${RANK_SIZE}위에 들려면 ${formatNumber(followersToRankIn(p.followers))}명이 더 필요하다.`
        : toNext != null
          ? `${p.rank - 1}위까지 ${formatNumber(toNext)}명 남았다.`
          : "";

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("star", { size: 18 }), "월간 인기 순위"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        { class: "taxi__payout", style: "margin-bottom:12px" },
        el(
          "span",
          { class: "taxi__fare" },
          p.rank == null ? "순위권 밖" : `${p.rank}위${tier ? ` · ${tier.label}` : ""}`,
        ),
        el("span", { class: "taxi__rating" }, `팔로워 ${formatNumber(p.followers)}명`),
      ),
      el(
        "p",
        { style: "font-size:15px;line-height:1.7;margin:0 0 10px;white-space:pre-wrap" },
        rankAnnouncement(s),
      ),
      goalLine ? el("p", { class: "compose-hint", style: "margin:0 0 6px" }, goalLine) : null,
      p.best != null
        ? el("p", { class: "compose-hint", style: "margin:0 0 16px" }, `역대 최고 ${p.best}위`)
        : el("p", { class: "compose-hint", style: "margin:0 0 16px" }, ""),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((st) => {
              st.pendingPopularity = false;
            });
            ctx.closeModal();
          },
        },
        "확인",
      ),
    ),
  );
}
