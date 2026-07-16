import type { GameContext } from "./context";
import type { AuctionItem } from "@/data/auction";
import {
  AUCTION_ITEMS,
  auctionOpen,
  buyAuctionItem,
  canBuyAuctionItem,
  isAuctionItemBought,
} from "@/systems/auction";
import { el, formatNumber } from "@/utils/dom";
import { confirmPurchase } from "./confirmModal";

/* ============================================================
 * 서던피스(southernpeace.auction) — 피메일 초대장의 링크로만 열리는
 * 비공개 경매장. 소원 가게·도깨비 상점·O넷과 같은 단발 사이트 패턴이며
 * 탭을 이동하면 닫힌다(ui/browser.ts 3곳 + ui/context.ts의 auctionSiteOpen).
 *
 * 톤: O넷의 딱딱한 관공서와 정반대인 고급 경매 하우스(먹빛 배경 + 금박 세리프).
 *
 * ⚠️ 열람 기간·구매 가능 여부·차감은 전부 systems/auction이 판정한다.
 *    여기서는 호출 결과를 보여주기만 한다(규칙 재구현 금지).
 *
 * ⚠️ AUCTION_ITEMS가 비거나 적어도 크래시하지 않는다 — 있는 만큼만 그린다.
 * ============================================================ */

function closeSite(ctx: GameContext): void {
  ctx.ui.auctionSiteOpen = false;
  ctx.refresh();
}

/** 응찰 버튼이 비활성일 때의 사유. canBuyAuctionItem은 bool만 주므로 UI가 문구를 고른다. */
function blockReason(
  s: import("@/core/types").GameState,
  item: AuctionItem,
): string | null {
  if (isAuctionItemBought(s, item.id)) return null; // 낙찰 완료는 별도 표시
  if (!auctionOpen(s)) return "열람 종료";
  if (s.money < item.price) return "예치금 부족";
  return null;
}

/** 출품 한 점 카드(로트) */
function lotCard(
  ctx: GameContext,
  item: AuctionItem,
  index: number,
  paint: () => void,
): HTMLElement {
  const s = ctx.store.getState();
  const bought = isAuctionItemBought(s, item.id);
  const buyable = canBuyAuctionItem(s, item);
  const reason = blockReason(s, item);

  const bid = (): void => {
    confirmPurchase(ctx, {
      title: "응찰 확인",
      itemName: item.name,
      priceText: `${formatNumber(item.price)}원`,
      message:
        "낙찰가 전액이 즉시 인출됩니다. 서던피스의 낙찰은 취소·환불되지 않으며,\n" +
        "출품물의 내력과 상태에 대해 본사는 어떠한 보증도 하지 않습니다.\n\n" +
        "그래도 응찰하시겠습니까?",
      confirmLabel: "응찰한다",
      onConfirm: () => {
        // 확인 팝업 사이에 시간이 흘렀을 수 있으므로 최신 상태로 다시 판정한다.
        let ok = false;
        ctx.update((st) => {
          ok = buyAuctionItem(st, item);
        });
        if (!ok) {
          ctx.toast("응찰이 성사되지 않았습니다. 열람 기간과 예치금을 확인해 주세요.");
          paint();
          return;
        }
        ctx.toast(`낙찰 — ${item.name}`);
        paint();
      },
    });
  };

  return el(
    "div",
    { class: "auc-lot" + (bought ? " auc-lot--won" : "") },
    el(
      "div",
      { class: "auc-lot__head" },
      el("span", { class: "auc-lot__no" }, `LOT ${String(index + 1).padStart(3, "0")}`),
      el("span", { class: "auc-lot__name" }, item.name),
    ),
    el("p", { class: "auc-lot__desc" }, item.desc),
    el(
      "div",
      { class: "auc-lot__foot" },
      el(
        "div",
        { class: "auc-lot__price" },
        el("span", { class: "auc-lot__price-label" }, "낙찰가"),
        el("span", { class: "auc-lot__price-val" }, `${formatNumber(item.price)}원`),
      ),
      reason ? el("span", { class: "auc-lot__reason" }, reason) : null,
      bought
        ? el("span", { class: "auc-lot__won-tag" }, "낙찰 완료")
        : el(
            "button",
            {
              class: "auc-bid" + (buyable ? "" : " auc-bid--off"),
              disabled: !buyable,
              onclick: () => {
                if (!canBuyAuctionItem(ctx.store.getState(), item)) return;
                bid();
              },
            },
            "응찰",
          ),
    ),
  );
}

export function renderAuction(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "auction-site" });

  function paint(): void {
    const s = ctx.store.getState();
    const open = auctionOpen(s);

    container.replaceChildren(
      el(
        "header",
        { class: "auc-head" },
        el(
          "div",
          { class: "auc-head__brand" },
          el("span", { class: "auc-logo" }, "SOUTHERN PEACE"),
          el("span", { class: "auc-head__sub" }, "서던피스 · 비공개 경매"),
        ),
        el(
          "div",
          { class: "auc-head__me" },
          el("span", { class: "auc-head__member" }, "회원 등급 · 헌터"),
          el("span", { class: "auc-head__money" }, `${formatNumber(s.money)}원`),
        ),
      ),
      el(
        "div",
        { class: "auc-body" },
        el(
          "div",
          { class: "auc-hero" },
          el("div", { class: "auc-hero__rule" }),
          el("h1", { class: "auc-hero__title" }, "이번 회차 출품 목록"),
          el(
            "p",
            { class: "auc-hero__lead" },
            "자격이 확인된 분들께만 공개되는 목록입니다. 출품물의 내력은 묻지 않는 것이 본사의 오랜 관례이며, " +
              "낙찰 이후의 일은 전적으로 낙찰자의 몫입니다.",
          ),
        ),
        open
          ? el(
              "div",
              { class: "auc-status auc-status--open" },
              el("span", { class: "auc-status__dot" }),
              "열람 중 — 본 회차의 목록은 9월 9일 자정에 닫힙니다.",
            )
          : el(
              "div",
              { class: "auc-status auc-status--closed" },
              el("span", { class: "auc-status__tag" }, "종료"),
              "본 회차 경매는 종료되었습니다. 낙찰 내역은 아래에서 확인하실 수 있으며, " +
                "다음 회차 초대는 자격 확인 후 별도로 발송됩니다.",
            ),
        AUCTION_ITEMS.length === 0
          ? el(
              "div",
              { class: "auc-empty" },
              "이번 회차에는 출품물이 없습니다.",
              el("div", { class: "auc-empty__sub" }, "다음 회차를 기다려 주십시오."),
            )
          : el(
              "div",
              { class: "auc-list" },
              ...AUCTION_ITEMS.map((item, i) => lotCard(ctx, item, i, paint)),
            ),
        el(
          "div",
          { class: "auc-foot" },
          el("div", {}, "SOUTHERN PEACE PRIVATE SALE — 회원 외 열람 및 목록 유출을 금합니다."),
          el(
            "button",
            { class: "auc-leave", onclick: () => closeSite(ctx) },
            "경매장을 나선다",
          ),
        ),
      ),
    );
  }

  paint();
  return container;
}
