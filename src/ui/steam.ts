import type { GameContext } from "./context";
import type { SteamGame } from "@/data/steam";
import { STEAM_GAMES } from "@/data/steam";
import {
  buyGame,
  reviewGame,
  effectiveGamePrice,
  canBuyGame,
  isGameOwned,
} from "@/systems/steam";
import { canPostTweet } from "@/systems/tweetSystem";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "./icons";
import { confirmPurchase } from "./confirmModal";

/* ============================================================
 * 증기(Steam 패러디) — 게임 스토어. 광고 트윗 '바로가기'로 해금.
 * 다크+블루 톤. 대표 게임 배너 + 게임 그리드(구매/리뷰).
 * 구매는 소지금 차감, 첫 구매면 '게임' 트윗 카테고리 해금.
 * 보유 게임마다 '리뷰 트윗'(게임당 1회, 일반 트윗 = 행동력·시간 소모).
 * 규칙 계산은 전부 systems/steam가 담당 — 여기선 표시·호출만.
 * ============================================================ */

function coverStyle(hue: number): string {
  return (
    `background:linear-gradient(150deg, hsl(${hue}deg 48% 30%),` +
    ` hsl(${(hue + 40) % 360}deg 55% 16%))`
  );
}

/* ── 상단 마스트헤드 ── */
function masthead(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  return el(
    "header",
    { class: "steam__mast" },
    el(
      "span",
      { class: "steam__logo" },
      el("span", { class: "steam__logo-mark" }, "≋"),
      "증기",
    ),
    el(
      "nav",
      { class: "steam__menu" },
      ...["상점", "라이브러리", "커뮤니티", "정보"].map((m, i) =>
        el("span", { class: "steam__menu-item" + (i === 0 ? " steam__menu-item--on" : "") }, m),
      ),
    ),
    el(
      "div",
      { class: "steam__search" },
      icon("search", { size: 14 }),
      el("span", { class: "steam__search-ph" }, "상점 검색"),
    ),
    el(
      "div",
      { class: "steam__mast-right" },
      el("span", { class: "steam__wallet" }, `지갑 ${formatNumber(s.money)}원`),
      el("span", { class: "steam__login" }, "MY 증기"),
    ),
  );
}

/* ── 미디어 모자이크 자리(실제 스크린샷 없음) ── */
function mediaTile(game: SteamGame): HTMLElement {
  return el(
    "div",
    { class: "steam-cover__media", title: game.media.prompt },
    el("span", { class: "steam-cover__media-ic" }, game.media.kind === "video" ? "▶" : "🖼"),
    el("span", { class: "steam-cover__media-label" }, "스크린샷"),
  );
}

/* ── 가격 표시(할인 배지 + 취소선 + 실구매가) ── */
function priceTag(game: SteamGame, big = false): HTMLElement {
  const eff = effectiveGamePrice(game);
  const discounted = !!game.discount && game.discount > 0;
  return el(
    "div",
    { class: "steam-price" + (big ? " steam-price--big" : "") },
    discounted
      ? el("span", { class: "steam-price__badge" }, `-${game.discount}%`)
      : null,
    discounted
      ? el(
          "div",
          { class: "steam-price__stack" },
          el("span", { class: "steam-price__was" }, `${formatNumber(game.price)}원`),
          el("span", { class: "steam-price__now" }, `${formatNumber(eff)}원`),
        )
      : el("span", { class: "steam-price__now" }, `${formatNumber(eff)}원`),
  );
}

/* ── 평가 라벨(스팀 톤) ── */
function ratingLine(game: SteamGame): HTMLElement {
  return el(
    "div",
    { class: "steam-rating" },
    el("span", { class: "steam-rating__label" }, game.ratingLabel),
    el("span", { class: "steam-rating__count" }, `(평가 ${formatNumber(game.ratingCount)})`),
  );
}

/* ── 액션(구매 / 보유·리뷰) 버튼 열 ── */
function actionColumn(ctx: GameContext, game: SteamGame): HTMLElement {
  const s = ctx.store.getState();
  const owned = isGameOwned(s, game.id);

  if (!owned) {
    const affordable = canBuyGame(s, game);
    return el(
      "div",
      { class: "steam-actions" },
      priceTag(game),
      el(
        "button",
        {
          class: "btn steam-buy" + (affordable ? "" : " steam-buy--off"),
          disabled: !affordable,
          onclick: () => doBuy(ctx, game),
        },
        affordable ? "구매" : "잔고 부족",
      ),
    );
  }

  // 보유 중: 리뷰 상태에 따라 버튼 분기
  const reviewed = s.reviewedGames.includes(game.id);
  const canReview = canPostTweet(s);
  let reviewBtn: HTMLElement;
  if (reviewed) {
    reviewBtn = el(
      "button",
      { class: "btn steam-review steam-review--done", disabled: true },
      "리뷰 완료",
    );
  } else {
    reviewBtn = el(
      "button",
      {
        class: "btn steam-review" + (canReview ? "" : " steam-review--off"),
        disabled: !canReview,
        onclick: () => doReview(ctx, game),
      },
      canReview ? "리뷰 트윗 쓰기" : "행동력 부족",
    );
  }
  return el(
    "div",
    { class: "steam-actions" },
    el("span", { class: "steam-owned" }, "✔ 보유 중"),
    reviewBtn,
  );
}

function doBuy(ctx: GameContext, game: SteamGame): void {
  const s0 = ctx.store.getState();
  if (isGameOwned(s0, game.id)) return;
  const price = effectiveGamePrice(game);
  if (s0.money < price) {
    ctx.toast(`소지금이 부족해요 (필요 ${formatNumber(price)}원)`);
    return;
  }
  confirmPurchase(ctx, {
    itemName: `『${game.title}』`,
    priceText: `${formatNumber(price)}원`,
    onConfirm: () => {
      const s1 = ctx.store.getState();
      if (isGameOwned(s1, game.id)) return;
      if (s1.money < price) {
        ctx.toast(`소지금이 부족해요 (필요 ${formatNumber(price)}원)`);
        return;
      }
      // 첫 구매 판정: ownedGames.push 이전(=지금)의 length===0 기준.
      const wasFirst = s1.ownedGames.length === 0;
      let ok = false;
      ctx.update((st) => {
        ok = buyGame(st, game);
      });
      if (!ok) {
        ctx.toast("구매할 수 없어요.");
        return;
      }
      let msg = `『${game.title}』 구매 완료! (-${formatNumber(price)}원)`;
      if (wasFirst) msg += " 게임 카테고리가 트윗 작성에 추가됐어요!";
      ctx.toast(msg);
    },
  });
}

function doReview(ctx: GameContext, game: SteamGame): void {
  // reviewGame은 미보유/이미리뷰면 null. 행동력 부족은 버튼에서 이미 막힘.
  let msg = "";
  ctx.update((st) => {
    msg = reviewGame(st, game)?.message ?? "";
  });
  ctx.toast(msg || "지금은 리뷰를 올릴 수 없어요.");
  ctx.refresh();
}

/* ============================================================
 * 대표 게임 배너(featured)
 * ============================================================ */
function featuredCard(ctx: GameContext, game: SteamGame): HTMLElement {
  return el(
    "article",
    { class: "steam-feat" },
    el(
      "div",
      { class: "steam-feat__cover", style: coverStyle(game.hue) },
      el("span", { class: "steam-feat__badge" }, "대표 출시작"),
      mediaTile(game),
    ),
    el(
      "div",
      { class: "steam-feat__body" },
      el("div", { class: "steam-feat__title" }, game.title),
      el("div", { class: "steam-feat__dev" }, game.developer),
      ratingLine(game),
      el(
        "div",
        { class: "steam-feat__tags" },
        ...game.tags.map((t) => el("span", { class: "steam-tag" }, t)),
      ),
      el("div", { class: "steam-feat__foot" }, actionColumn(ctx, game)),
    ),
  );
}

function featuredSection(ctx: GameContext): HTMLElement | null {
  const featured = STEAM_GAMES.filter((g) => g.featured);
  if (featured.length === 0) return null;
  return el(
    "section",
    { class: "steam__sec" },
    el("h2", { class: "steam__sec-title" }, "지금 뜨는 대표작"),
    el("div", { class: "steam__feat-grid" }, ...featured.map((g) => featuredCard(ctx, g))),
  );
}

/* ============================================================
 * 게임 그리드(전체 목록)
 * ============================================================ */
function gameCard(ctx: GameContext, game: SteamGame): HTMLElement {
  const discounted = !!game.discount && game.discount > 0;
  return el(
    "article",
    { class: "steam-card" },
    el(
      "div",
      { class: "steam-card__cover", style: coverStyle(game.hue) },
      discounted ? el("span", { class: "steam-card__sale" }, `-${game.discount}%`) : null,
      mediaTile(game),
    ),
    el(
      "div",
      { class: "steam-card__body" },
      el("div", { class: "steam-card__title" }, game.title),
      el("div", { class: "steam-card__dev" }, game.developer),
      ratingLine(game),
      el(
        "div",
        { class: "steam-card__tags" },
        ...game.tags.map((t) => el("span", { class: "steam-tag" }, t)),
      ),
      actionColumn(ctx, game),
    ),
  );
}

/* ── 루트 ── */
export function renderSteam(ctx: GameContext): HTMLElement {
  return el(
    "div",
    { class: "steam" },
    masthead(ctx),
    el(
      "div",
      { class: "steam__body" },
      el(
        "p",
        { class: "compose-hint", style: "margin:0 2px 14px" },
        "게임을 구매하면 소지금이 줄어요. 첫 구매 시 '게임' 트윗 카테고리가 열립니다. 보유 게임은 리뷰 트윗(게임당 1회)으로 팔로워를 얻을 수 있어요.",
      ),
      featuredSection(ctx),
      el(
        "section",
        { class: "steam__sec" },
        el("h2", { class: "steam__sec-title" }, "전체 게임"),
        el("div", { class: "steam__grid" }, ...STEAM_GAMES.map((g) => gameCard(ctx, g))),
      ),
    ),
  );
}
