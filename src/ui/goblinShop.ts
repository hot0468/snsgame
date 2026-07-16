import type { GameContext } from "./context";
import { GOBLIN_ITEMS } from "@/data/goblin";
import { SKILL_STATS } from "@/data/stats";
import { buyGoblinItem, canBuyGoblin, isGoblinOwned } from "@/systems/goblin";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";

/* ============================================================
 * 도깨비 상점 — '열려라 참깨'로만 열리는 단발 사이트(월 1회).
 * 스탯을 크게 올려주는 레어 아이템을 비싼 값에 판다.
 * 소원 가게와 같은 방식으로 탭을 이동하면 닫힌다.
 * ============================================================ */

function closeSite(ctx: GameContext): void {
  ctx.ui.goblinSiteOpen = false;
  ctx.refresh();
}

export function renderGoblinShop(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "goblin-site" });

  function paint(): void {
    const s = ctx.store.getState();

    const cards = GOBLIN_ITEMS.map((item) => {
      const owned = isGoblinOwned(s, item.id);
      const buyable = canBuyGoblin(s, item);
      const boostText = Object.entries(item.boosts)
        .map(([k, v]) => `${SKILL_STATS[k as keyof typeof SKILL_STATS].label} +${v}`)
        .join(" · ");
      return el(
        "div",
        { class: "goblin-item" },
        el(
          "div",
          { class: "goblin-item__body" },
          el("div", { class: "goblin-item__name" }, item.name),
          el("div", { class: "goblin-item__desc" }, item.desc),
          el("div", { class: "goblin-item__boost" }, boostText),
        ),
        el(
          "div",
          { class: "goblin-item__buy" },
          el("div", { class: "goblin-item__price" }, `${formatNumber(item.price)}냥`),
          owned
            ? el("span", { class: "goblin-item__owned" }, "구매함")
            : el(
                "button",
                {
                  class: "goblin-buy" + (buyable ? "" : " goblin-buy--off"),
                  disabled: !buyable,
                  onclick: () => {
                    if (!buyable) {
                      ctx.toast(`금화가 부족하네… (필요 ${formatNumber(item.price)}냥)`);
                      return;
                    }
                    confirmPurchase(ctx, {
                      title: "🏮 도깨비 상점",
                      itemName: item.name,
                      priceText: `${formatNumber(item.price)}냥`,
                      message: "정녕 이 물건을 사겠느냐?",
                      confirmLabel: "산다",
                      onConfirm: () => {
                        if (!canBuyGoblin(ctx.store.getState(), item)) {
                          ctx.toast(`금화가 부족하네… (필요 ${formatNumber(item.price)}냥)`);
                          return;
                        }
                        ctx.update((st) => buyGoblinItem(st, item));
                        ctx.toast(`${item.name}을(를) 손에 넣었다!`);
                        paint();
                      },
                    });
                  },
                },
                "산다",
              ),
        ),
      );
    });

    container.replaceChildren(
      el("div", { class: "goblin-site__veil" }),
      el(
        "div",
        { class: "goblin-site__card" },
        el("div", { class: "goblin-site__title" }, "🏮 도깨비 상점 🏮"),
        el(
          "p",
          { class: "goblin-site__lead" },
          "허허, 용케 문을 열었구나. 값은 비싸도 물건은 확실하다.\n" +
            `가진 금화: ${formatNumber(s.money)}냥`,
        ),
        el("div", { class: "goblin-list" }, ...cards),
        el(
          "button",
          { class: "goblin-leave", onclick: () => closeSite(ctx) },
          "상점을 나선다",
        ),
      ),
    );
  }

  paint();
  return container;
}
