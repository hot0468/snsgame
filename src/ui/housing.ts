import type { GameContext } from "./context";
import { HOUSINGS } from "@/data/housing";
import { upgradeHousing } from "@/systems/housing";
import { itemImg } from "./components";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 남의방 — 부동산(집 계약) 사이트.
 * 현재 집부터 단계별로 위로 올라가며 계약할 수 있다.
 * 단계가 오를수록 월세↑, 잠에서 깰 때 회복↑, 아파트 이상은 영구 스탯업.
 * ============================================================ */

function coverStyle(i: number): string {
  const hue = (200 + i * 20) % 360;
  return `background:linear-gradient(150deg, hsl(${hue}deg 45% 46%), hsl(${(hue + 30) % 360}deg 50% 30%))`;
}

function perks(i: number): string {
  const h = HOUSINGS[i];
  const parts: string[] = [];
  if (h.actionBonus || h.mentalBonus) {
    parts.push(`기상 회복 행동력+${h.actionBonus} · 정신력+${h.mentalBonus}`);
  }
  if (h.permaSkills) {
    const s = Object.entries(h.permaSkills)
      .map(([k, v]) => `${k}+${v}`)
      .join(" ");
    parts.push(`영구 스탯업 ${s}`);
  }
  return parts.join(" · ") || "특별한 혜택 없음";
}

export function renderHousing(ctx: GameContext): HTMLElement {
  function paint(container: HTMLElement): void {
    const s = ctx.store.getState();
    const tier = s.housingTier;

    const rows = HOUSINGS.map((h, i) => {
      const isCurrent = i === tier;
      const isNext = i === tier + 1;
      const isOwnedPast = i < tier;
      const canBuy = isNext && s.money >= h.price;

      const status = isCurrent
        ? el("span", { class: "chip chip--active" }, "현재 거주")
        : isOwnedPast
          ? el("span", { class: "chip", style: "opacity:.55" }, "지난 집")
          : isNext
            ? el(
                "button",
                {
                  class: "btn" + (canBuy ? "" : " btn--ghost"),
                  disabled: !canBuy,
                  onclick: () => {
                    if (!canBuy) {
                      ctx.toast(`계약금이 부족해요 (필요 ${formatNumber(h.price)}원)`);
                      return;
                    }
                    let moved: string | null = null;
                    ctx.update((st) => {
                      moved = upgradeHousing(st)?.name ?? null;
                    });
                    if (moved) ctx.toast(`${moved}(으)로 이사했어요! 🏠`);
                    paint(container);
                  },
                },
                canBuy ? "계약하기" : "계약금 부족",
              )
            : el("span", { class: "chip", style: "opacity:.4" }, "잠김");

      return el(
        "div",
        {
          class: "nb-house",
          style: isCurrent ? "border:1px solid var(--accent)" : "",
        },
        // 매물 사진 160x120(4:3). 이미지가 있으면 그라데이션 위를 덮는다(없는 게 기본).
        el("span", { class: "nb-house__cover", style: coverStyle(i) }, itemImg(h.id, h.name)),
        el(
          "span",
          { class: "mb-book__info", style: "flex:1" },
          el("span", { class: "mb-book__title" }, `${h.name}`),
          el("span", { class: "mb-book__author" }, h.tagline),
          el(
            "span",
            { class: "mb-book__rating", style: "color:var(--text-muted)" },
            `월세 ${formatNumber(h.rent)}원` + (h.price > 0 ? ` · 계약금 ${formatNumber(h.price)}원` : ""),
          ),
          el("span", { class: "mb-book__author", style: "color:var(--accent)" }, perks(i)),
        ),
        el("span", { style: "align-self:center;padding-left:8px" }, status),
      );
    });

    container.replaceChildren(
      el(
        "header",
        { class: "mb__mast" },
        el("div", { class: "mb__logo" }, "남의방"),
        el(
          "div",
          { class: "mb__mast-right" },
          el("span", {}, `보유금 ${formatNumber(s.money)}원`),
        ),
      ),
      el(
        "div",
        { class: "mb__body" },
        el("div", { class: "mb__sec-title" }, "집 계약 — 단계를 올릴수록 삶의 질이 오릅니다"),
        el(
          "p",
          { class: "compose-hint", style: "margin:0 4px 10px" },
          "좋은 집일수록 월세는 비싸지만, 잠에서 깰 때 행동력·정신력을 더 회복해요. 아파트부터는 세부 스탯이 영구히 올라요.",
        ),
        el("div", { class: "nb__list" }, ...rows),
      ),
    );
  }

  const container = el("div", { class: "mb" });
  paint(container);
  return container;
}
