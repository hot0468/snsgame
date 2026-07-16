import type { GameContext } from "./context";
import type { YabamVideo, YabamProduct } from "@/data/yabam";
import {
  YABAM_VIDEOS,
  YABAM_PRODUCTS,
  YABAM_TOTO_BETS,
  YABAM_VIDEO_COST,
} from "@/data/yabam";
import {
  viewYabamVideo,
  playYabamToto,
  buyYabamProduct,
  reviewYabamProduct,
} from "@/systems/yabam";
import { getActiveAccount } from "@/core/state";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";
import { confirmPurchase } from "./confirmModal";

/* ============================================================
 * 야밤 — 성인 사이트(다크 무드). DM 링크로 해금.
 * 3섹션: ① 성인영상(결제 감상) ② 토토(베팅) ③ 성인용품(구매).
 * 실제 이미지 없이 모자이크 자리·암시적 제목만. (pushtime.ts 미러링)
 * ============================================================ */

function coverStyle(hue: number): string {
  return `background:linear-gradient(150deg, hsl(${hue}deg 55% 26%), hsl(${(hue + 40) % 360}deg 60% 12%))`;
}

/* ── 상단 마스트헤드 ── */
function masthead(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  return el(
    "header",
    { class: "yabam__mast" },
    el("span", { class: "yabam__logo" }, "야밤", el("span", { class: "yabam__logo-dot" }, "🔞")),
    el(
      "div",
      { class: "yabam__search" },
      icon("search", { size: 14 }),
      el("span", { class: "yabam__search-ph" }, "은밀한 밤 검색"),
    ),
    el(
      "div",
      { class: "yabam__mast-right" },
      el("span", { class: "yabam__cash" }, `${formatNumber(s.money)}원`),
      el("span", { class: "yabam__login" }, "MY 야밤"),
    ),
  );
}

/* ── 섹션 전환 탭 ── */
type Section = "video" | "toto" | "product";
const SECTION_TABS: { id: Section; label: string }[] = [
  { id: "video", label: "성인영상" },
  { id: "toto", label: "토토" },
  { id: "product", label: "성인용품" },
];

function sectionTabs(ctx: GameContext): HTMLElement {
  const cur = ctx.ui.yabamSection;
  return el(
    "div",
    { class: "yabam__tabs" },
    ...SECTION_TABS.map((t) =>
      el(
        "button",
        {
          class: "yabam__tab" + (t.id === cur ? " yabam__tab--on" : ""),
          onclick: () => {
            ctx.ui.yabamSection = t.id;
            ctx.refresh();
          },
        },
        t.label,
      ),
    ),
  );
}

/* ============================================================
 * ① 성인영상
 * ============================================================ */
function videoCard(ctx: GameContext, v: YabamVideo): HTMLElement {
  return el(
    "article",
    { class: "yabam-vid", onclick: () => openVideoModal(ctx, v) },
    el(
      "div",
      { class: "yabam-vid__cover", style: coverStyle(v.hue) },
      el("span", { class: "yabam-vid__adult" }, "🔞 19"),
      el("span", { class: "yabam-vid__play" }, "▶"),
      el(
        "div",
        { class: "yabam-vid__lock" },
        el("span", { class: "yabam-vid__lock-ic" }, "🔒"),
        el("span", {}, "결제 후 재생"),
      ),
    ),
    el(
      "div",
      { class: "yabam-vid__body" },
      el("div", { class: "yabam-vid__title" }, v.title),
      el("div", { class: "yabam-vid__uploader" }, `@${v.uploader}`),
      el("div", { class: "yabam-vid__excerpt" }, v.excerpt),
      el(
        "div",
        { class: "yabam-vid__tags" },
        ...v.tags.map((t) => el("span", { class: "yabam-vid__tag" }, `#${t}`)),
      ),
      el(
        "div",
        { class: "yabam-vid__meta" },
        el("span", {}, "🔥 HOT"),
        el("span", { class: "yabam-vid__price" }, `${formatNumber(YABAM_VIDEO_COST)}원`),
      ),
    ),
  );
}

function openVideoModal(ctx: GameContext, video: YabamVideo): void {
  const affordable = ctx.store.getState().money >= YABAM_VIDEO_COST;
  ctx.openModal((c) =>
    el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, "🔞 야밤"),
        el("button", { class: "popup__close", onclick: () => c.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;font-weight:800;margin:0 0 4px" }, `『${video.title}』`),
        el(
          "p",
          { style: "font-size:12.5px;color:var(--text-muted);margin:0 0 6px" },
          `@${video.uploader} · ${video.tags.map((t) => "#" + t).join(" ")}`,
        ),
        el(
          "p",
          { style: "font-size:13.5px;line-height:1.6;margin:0 0 14px" },
          "이 영상은 유료 성인 콘텐츠입니다. 결제하고 감상하시겠어요?",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => c.closeModal() }, "닫기"),
          el(
            "button",
            {
              class: "btn" + (affordable ? "" : " btn--ghost"),
              disabled: !affordable,
              onclick: () => {
                if (!affordable) {
                  c.toast(`잔고가 부족해요 (필요 ${formatNumber(YABAM_VIDEO_COST)}원)`);
                  return;
                }
                let msg = "";
                c.update((s) => {
                  msg = viewYabamVideo(s, video)?.message ?? "";
                });
                c.closeModal();
                if (msg) c.toast(msg);
              },
            },
            `결제하고 감상 (${formatNumber(YABAM_VIDEO_COST)}원)`,
          ),
        ),
      ),
    ),
  );
}

function videoSection(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "yabam__sec" },
    el(
      "p",
      { class: "compose-hint", style: "margin:0 2px 12px" },
      "19세 미만 이용 불가. 영상을 결제하면 감상할 수 있어요. (음란·정신력↑, 도덕성↓)",
    ),
    el("div", { class: "yabam__grid" }, ...YABAM_VIDEOS.map((v) => videoCard(ctx, v))),
  );
}

/* ============================================================
 * ② 토토
 * ============================================================ */
function totoSection(ctx: GameContext): HTMLElement {
  const money = ctx.store.getState().money;
  return el(
    "div",
    { class: "yabam__sec yabam-toto" },
    el(
      "div",
      { class: "yabam-toto__banner" },
      el("span", { class: "yabam-toto__banner-ic" }, "🎲"),
      el(
        "div",
        {},
        el("div", { class: "yabam-toto__banner-title" }, "야밤 토토 — 오늘 밤의 승부"),
        el(
          "div",
          { class: "yabam-toto__banner-sub" },
          "적중하면 배당 2배(순이익 = 베팅액), 꽝이면 베팅액을 잃어요. 도박은 도덕성·정신력을 갉아먹습니다.",
        ),
      ),
    ),
    el("p", { class: "compose-hint", style: "margin:0 2px 10px" }, `현재 소지금 ${formatNumber(money)}원`),
    el(
      "div",
      { class: "yabam-toto__bets" },
      ...YABAM_TOTO_BETS.map((bet) => {
        const affordable = money >= bet;
        return el(
          "button",
          {
            class: "yabam-toto__bet" + (affordable ? "" : " yabam-toto__bet--off"),
            disabled: !affordable,
            onclick: () => placeBet(ctx, bet),
          },
          el("span", { class: "yabam-toto__bet-amt" }, `${formatNumber(bet)}원`),
          el("span", { class: "yabam-toto__bet-sub" }, "베팅"),
        );
      }),
    ),
  );
}

function placeBet(ctx: GameContext, bet: number): void {
  if (ctx.store.getState().money < bet) {
    ctx.toast("소지금이 부족해요");
    return;
  }
  let msg = "";
  let won = false;
  ctx.update((s) => {
    const r = playYabamToto(s, bet);
    if (r) {
      msg = r.message;
      won = r.won;
    }
  });
  if (msg) ctx.toast((won ? "🎉 " : "💧 ") + msg);
}

/* ============================================================
 * ③ 성인용품
 * ============================================================ */
function productRow(ctx: GameContext, p: YabamProduct): HTMLElement {
  const s = ctx.store.getState();
  const owned = s.yabamProductsOwned.includes(p.id);
  const affordable = s.money >= p.price;
  const account = getActiveAccount(s);
  // 보유 중이고 이 용품이 성인 트윗 종류를 해금하는 용품인가?
  const unlockKind = p.unlocksKind;
  const alreadyUnlocked = unlockKind ? account.unlockedAdultKinds.includes(unlockKind) : false;

  // 액션 열: 미보유→구매 / 보유+리뷰용품 미해금→리뷰 트윗 / 보유+해금됨→해금 완료 / 일반 보유→보유중
  let action: HTMLElement;
  if (!owned) {
    action = el(
      "button",
      {
        class: "btn yabam-prod__btn" + (affordable ? "" : " btn--ghost"),
        onclick: () => buyProduct(ctx, p),
      },
      "구매",
    );
  } else if (unlockKind && !alreadyUnlocked) {
    action = el(
      "button",
      {
        class: "btn yabam-prod__btn yabam-prod__review",
        onclick: () => reviewProduct(ctx, p),
      },
      "리뷰 트윗 쓰기",
    );
  } else if (unlockKind && alreadyUnlocked) {
    action = el(
      "button",
      { class: "btn yabam-prod__btn yabam-prod__btn--owned", disabled: true },
      "리뷰 완료 · 해금됨",
    );
  } else {
    action = el(
      "button",
      { class: "btn yabam-prod__btn yabam-prod__btn--owned", disabled: true },
      "보유중",
    );
  }

  return el(
    "div",
    { class: "yabam-prod" },
    el("div", { class: "yabam-prod__thumb" }, "🎁"),
    el(
      "div",
      { class: "yabam-prod__info" },
      el("div", { class: "yabam-prod__name" }, p.name),
      el("div", { class: "yabam-prod__desc" }, p.desc),
      el("div", { class: "yabam-prod__effect" }, p.effect),
      owned && unlockKind && !alreadyUnlocked
        ? el(
            "div",
            { class: "yabam-prod__hint" },
            "리뷰 트윗을 올리면 새 성인 트윗 종류가 해금돼요. (트윗 작성 = 행동력·시간 소모)",
          )
        : null,
    ),
    el(
      "div",
      { class: "yabam-prod__buy" },
      el("div", { class: "yabam-prod__price" }, `${formatNumber(p.price)}원`),
      action,
    ),
  );
}

/** 보유한 리뷰용품의 리뷰 트윗을 올려 대응 성인 카테고리를 해금한다. */
function reviewProduct(ctx: GameContext, p: YabamProduct): void {
  let msg = "";
  ctx.update((s) => {
    msg = reviewYabamProduct(s, p)?.message ?? "";
  });
  ctx.toast(msg || "지금은 리뷰를 올릴 수 없어요.");
  ctx.refresh();
}

function buyProduct(ctx: GameContext, p: YabamProduct): void {
  const s0 = ctx.store.getState();
  if (s0.yabamProductsOwned.includes(p.id)) return;
  if (s0.money < p.price) {
    ctx.toast(`잔고가 부족해요 (필요 ${formatNumber(p.price)}원)`);
    return;
  }
  confirmPurchase(ctx, {
    itemName: p.name,
    priceText: `${formatNumber(p.price)}원`,
    onConfirm: () => {
      const s1 = ctx.store.getState();
      if (s1.yabamProductsOwned.includes(p.id)) return;
      if (s1.money < p.price) {
        ctx.toast(`잔고가 부족해요 (필요 ${formatNumber(p.price)}원)`);
        return;
      }
      let msg = "";
      ctx.update((s) => {
        msg = buyYabamProduct(s, p)?.message ?? "";
      });
      if (msg) ctx.toast(msg);
    },
  });
}

function productSection(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "yabam__sec" },
    el(
      "p",
      { class: "compose-hint", style: "margin:0 2px 12px" },
      "은밀 배송. 한 번 구매한 상품은 보유 처리됩니다. (음란↑ · 플레이버 효과)",
    ),
    el("div", { class: "yabam-prod__list" }, ...YABAM_PRODUCTS.map((p) => productRow(ctx, p))),
  );
}

/* ── 루트 ── */
export function renderYabam(ctx: GameContext): HTMLElement {
  const section = ctx.ui.yabamSection;
  const body =
    section === "toto"
      ? totoSection(ctx)
      : section === "product"
        ? productSection(ctx)
        : videoSection(ctx);

  return el(
    "div",
    { class: "yabam" },
    masthead(ctx),
    sectionTabs(ctx),
    el("div", { class: "yabam__body" }, body),
  );
}
