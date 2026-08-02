import type { GameContext } from "./context";
import { AUTHOR_RANK_SIZE } from "@/data/authorRank";
import {
  authorRankAnnouncement,
  authorRankThreshold,
  authorRankTier,
  rivalAbove,
} from "@/systems/authorRank";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 웹툰 플랫폼 월간 연재 순위 발표(정산일).
 *
 * ⚠️ **내 위에 걸린 작품 이름을 같이 보여준다.** 등수만 던지면 숫자 하나지만, 바로 위에
 *    뭐가 있는지 보이면 표가 된다 — 다음 달에 그걸 제치는 게 목표가 된다.
 */
export function renderAuthorRankModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const r = s.authorRank;
  const penName = s.authorContract?.penName ?? "내 작품";
  const tier = authorRankTier(r?.rank ?? null);
  const rival = r ? rivalAbove(r.lastMonth, r.rank) : null;
  const toNext =
    r && r.rank != null && r.rank > 1
      ? Math.max(0, authorRankThreshold(r.rank - 1) - r.score)
      : null;

  /** 순위표 한 줄. 내 작품은 강조한다. */
  const chartRow = (rank: number, title: string, mine: boolean): HTMLElement =>
    el(
      "div",
      { class: "taxi__payout", style: `margin:0 0 6px${mine ? "" : ";opacity:.6"}` },
      el("span", { class: "taxi__fare" }, `${rank}위`),
      el("span", { class: "taxi__rating" }, mine ? `《${title}》 ← 내 작품` : `《${title}》`),
    );

  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("article", { size: 18 }), "이달의 연재 순위"),
    ),
    el(
      "div",
      { class: "modal__body" },
      // 순위표 — 내 바로 위 작품과 내 자리.
      r?.rank != null && rival ? chartRow(r.rank - 1, rival, false) : null,
      r?.rank != null
        ? chartRow(r.rank, penName, true)
        : el(
            "div",
            { class: "taxi__payout", style: "margin:0 0 6px" },
            el("span", { class: "taxi__fare" }, "순위권 밖"),
            el("span", { class: "taxi__rating" }, `${AUTHOR_RANK_SIZE}위 안에 못 들었다`),
          ),
      el(
        "p",
        { class: "compose-hint", style: "margin:10px 0 12px" },
        `이달 점수 ${formatNumber(r?.score ?? 0)} · 연재 ${r?.diligence ?? "-"}` +
          (tier ? ` · ${tier.label}` : ""),
      ),
      el(
        "p",
        { style: "font-size:15px;line-height:1.7;margin:0 0 10px;white-space:pre-wrap" },
        authorRankAnnouncement(s),
      ),
      toNext != null
        ? el(
            "p",
            { class: "compose-hint", style: "margin:0 0 6px" },
            `${(r?.rank ?? 2) - 1}위까지 점수 ${formatNumber(toNext)} 남았다.`,
          )
        : null,
      r?.best != null
        ? el("p", { class: "compose-hint", style: "margin:0 0 16px" }, `역대 최고 ${r.best}위`)
        : el("p", { class: "compose-hint", style: "margin:0 0 16px" }, ""),
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((st) => {
              st.pendingAuthorRank = false;
            });
            ctx.closeModal();
          },
        },
        "확인",
      ),
    ),
  );
}
