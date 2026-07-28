import type { GameContext } from "./context";
import type { SkillStatId } from "@/core/types";
import { HOUSINGS } from "@/data/housing";
import { SKILL_STATS } from "@/data/stats";
import { moveToHousing } from "@/systems/housing";
import { itemImg } from "./components";
import { confirmPurchase } from "./confirmModal";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 남의방 — 부동산(집 계약) 사이트.
 * 계약금만 되면 지금 집보다 위인 매물은 **단계를 건너뛰고 바로** 계약할 수 있다.
 * 단계가 오를수록 월세↑, 잠에서 깰 때 회복↑, 아파트 이상은 계약 시 영구 스탯업.
 * 기상 회복은 현재 집에 귀속(이사하면 바뀜)이고, 영구 스탯은 계약한 집 것만 1회 붙어 안 빠진다.
 * 그래서 건너뛰면 지나친 집의 영구 스탯은 못 받는 대신 계약금 총액을 아낀다.
 * ============================================================ */

function coverStyle(i: number): string {
  const hue = (200 + i * 20) % 360;
  return `background:linear-gradient(150deg, hsl(${hue}deg 45% 46%), hsl(${(hue + 30) % 360}deg 50% 30%))`;
}

/**
 * 매물 혜택 한 줄. 스탯 키는 반드시 한글 라벨로 옮긴다(`sociability+40`은 화면에 그대로 두면
 * 읽히지 않는다). 줄이 길어 잘리지 않도록 호출부에서 말줄임을 풀고 여러 줄로 흐르게 한다.
 */
function perks(i: number): string {
  const h = HOUSINGS[i];
  const parts: string[] = [];
  if (h.actionBonus || h.mentalBonus) {
    parts.push(`기상 회복 행동력+${h.actionBonus} · 정신력+${h.mentalBonus}`);
  }
  if (h.permaSkills) {
    const s = Object.entries(h.permaSkills)
      .map(([k, v]) => `${SKILL_STATS[k as SkillStatId].label}+${v}`)
      .join(" · ");
    parts.push(`영구 스탯업 ${s}`);
  }
  return parts.join(" / ") || "특별한 혜택 없음";
}

export function renderHousing(ctx: GameContext): HTMLElement {
  function paint(container: HTMLElement): void {
    const s = ctx.store.getState();
    const tier = s.housingTier;

    const rows = HOUSINGS.map((h, i) => {
      const isCurrent = i === tier;
      const isOwnedPast = i < tier;
      // 단계 제한 없음 — 계약금만 되면 어느 상위 매물이든 한 번에 계약한다.
      const canBuy = i > tier && s.money >= h.price;
      const skipped = i - tier - 1; // 이 계약으로 건너뛰는 집 수

      const doMove = (): void => {
        let moved: string | null = null;
        ctx.update((st) => {
          moved = moveToHousing(st, i)?.name ?? null;
        });
        if (moved) ctx.toast(`${moved}(으)로 이사했어요! 🏠`);
        paint(container);
      };

      const status = isCurrent
        ? el("span", { class: "chip chip--active" }, "현재 거주")
        : isOwnedPast
          ? el("span", { class: "chip", style: "opacity:.55" }, "지난 집")
          : el(
              "button",
              {
                class: "btn" + (canBuy ? "" : " btn--ghost"),
                disabled: !canBuy,
                onclick: () => {
                  if (!canBuy) {
                    ctx.toast(`계약금이 부족해요 (필요 ${formatNumber(h.price)}원)`);
                    return;
                  }
                  // 한 칸 승급은 바로 계약, 건너뛰기는 금액이 크므로 확인을 한 번 받는다.
                  if (skipped <= 0) {
                    doMove();
                    return;
                  }
                  confirmPurchase(ctx, {
                    title: "집 계약 확인",
                    itemName: `${h.name} · ${h.tagline}`,
                    priceText: `계약금 ${formatNumber(h.price)}원 · 월세 ${formatNumber(h.rent)}원`,
                    message: `${skipped}단계를 건너뛰고 바로 입주합니다. 건너뛴 집의 영구 스탯업은 받지 못하지만, 그만큼 계약금 총액을 아껴요. 계약할까요?`,
                    confirmLabel: "계약",
                    onConfirm: doMove,
                  });
                },
              },
              canBuy ? "계약하기" : "계약금 부족",
            );

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
            // word-break:keep-all — 안 주면 "900,000,000" 뒤에서 줄이 갈려 '원'만 다음 줄로 떨어진다.
            { class: "mb-book__rating", style: "color:var(--text-muted);word-break:keep-all" },
            `월세 ${formatNumber(h.rent)}원` + (h.price > 0 ? ` · 계약금 ${formatNumber(h.price)}원` : ""),
          ),
          // .mb-book__author는 모모북스와 공용이라 nowrap+말줄임이 걸려 있다. 혜택 문구는
          // 길어서 그대로 두면 "…"로 잘리므로, 이 칸에서만 풀어 여러 줄로 흐르게 한다.
          el(
            "span",
            {
              class: "mb-book__author",
              style:
                "color:var(--accent);white-space:normal;overflow:visible;text-overflow:clip;line-height:1.5;word-break:keep-all",
            },
            perks(i),
          ),
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
        el("div", { class: "mb__sec-title" }, "집 계약 — 계약금만 되면 단계를 건너뛰어 바로 입주"),
        el(
          "p",
          { class: "compose-hint", style: "margin:0 4px 10px" },
          "좋은 집일수록 월세는 비싸지만, 잠에서 깰 때 행동력·정신력을 더 회복해요(현재 사는 집 기준). 아파트부터는 계약할 때 세부 스탯이 영구히 올라요 — 나중에 이사해도 빠지지 않아요. 계약금만 되면 단계를 건너뛰어도 되지만, 건너뛴 집의 영구 스탯업은 받지 못해요.",
        ),
        el("div", { class: "nb__list" }, ...rows),
      ),
    );
  }

  const container = el("div", { class: "mb" });
  paint(container);
  return container;
}
