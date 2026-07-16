import type { GameContext } from "./context";
import { WISHES, grantWish } from "@/systems/wish";
import { el } from "@/utils/dom";

/* ============================================================
 * 소원을 이루어주는 가게 — 까칠한외눈 링크로만 들어오는 수상한 사이트.
 * 소원을 빌면 이뤄지지 않고 대가를 치른다(몽키스포).
 * 탭을 이동하면 닫히고, 다시 들어오려면 트윗에 좋아요를 눌러야 한다.
 * ============================================================ */

function closeSite(ctx: GameContext): void {
  ctx.ui.wishSiteOpen = false;
  ctx.ui.wishOptions = [];
  ctx.refresh();
}

export function renderWishSite(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "wish-site" });

  function showResult(message: string): void {
    container.replaceChildren(
      el("div", { class: "wish-site__veil" }),
      el(
        "div",
        { class: "wish-site__card" },
        el("div", { class: "wish-site__title" }, "🕯 소원의 대가"),
        el("p", { class: "wish-site__result" }, message),
        el(
          "button",
          { class: "btn", style: "margin-top:16px", onclick: () => closeSite(ctx) },
          "가게를 나선다",
        ),
      ),
    );
  }

  function showWishes(): void {
    const ids = ctx.ui.wishOptions;
    const options = ids
      .map((id) => WISHES.find((w) => w.id === id))
      .filter((w): w is NonNullable<typeof w> => !!w);

    const wishButtons = options.map((w) =>
      el(
        "button",
        {
          class: "wish-option",
          onclick: () => {
            let msg = "";
            ctx.update((s) => {
              msg = grantWish(s, w.id).message;
            });
            showResult(msg);
          },
        },
        `"${w.label}"`,
      ),
    );

    container.replaceChildren(
      el("div", { class: "wish-site__veil" }),
      el(
        "div",
        { class: "wish-site__card" },
        el("div", { class: "wish-site__title" }, "✦ 소원을 이루어주는 가게 ✦"),
        el(
          "p",
          { class: "wish-site__lead" },
          "어서 오세요. 무엇이든 이루어 드립니다.\n마음속 소원을 하나만 고르세요… 값은 나중에 치르면 됩니다.",
        ),
        ...wishButtons,
        el(
          "button",
          { class: "wish-option wish-option--refuse", onclick: () => closeSite(ctx) },
          "소원을 말하지 않는다",
        ),
      ),
    );
  }

  showWishes();
  return container;
}
