import type { GameContext } from "@/ui/context";
import type { AttributeId } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { resolveTicket, ticketPrice } from "@/systems/meeting";
import { postTweet } from "@/systems/tweetSystem";
import { el, formatNumber } from "@/utils/dom";
import { icon } from "@/ui/icons";

/**
 * 티켓 양도 수락 → 양도가 송금 → 랜덤(관람 성사 / 사기) → 결과 트윗 업로드.
 */
export function renderTicketModal(ctx: GameContext, threadId: string): HTMLElement {
  const container = el("div", { class: "modal" });

  const thread = getActiveAccount(ctx.store.getState()).dms.find((t) => t.id === threadId);
  if (!thread) {
    container.append(el("div", { class: "modal__body" }, "대화를 찾을 수 없습니다."));
    return container;
  }
  const kind = thread.ticketKind ?? "concert";
  const label = kind === "concert" ? "콘서트 티켓" : "영화 GV 티켓";
  const price = ticketPrice(kind);

  function head(title: string): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon(kind === "concert" ? "mic" : "film", { size: 18 }), title),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    );
  }

  function showIntro(): void {
    const money = ctx.store.getState().money;
    const canPay = money >= price;
    container.replaceChildren(
      head(`${label} 양도`),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.7;margin:0 0 8px" },
          `${thread!.partnerName}님이 ${label}을 양도하겠다고 한다. 양도가 ${formatNumber(price)}원을 보내고 받을까?`,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "그만둔다"),
          el(
            "button",
            {
              class: "btn",
              disabled: !canPay,
              onclick: () => {
                if (!canPay) {
                  ctx.toast("잔고가 부족해요");
                  return;
                }
                let msg = "";
                let tweetText = "";
                ctx.update((s) => {
                  const t = getActiveAccount(s).dms.find((x) => x.id === threadId);
                  if (t) {
                    const r = resolveTicket(s, t);
                    msg = r.message;
                    tweetText = r.tweetText;
                  }
                });
                showResult(msg, tweetText);
              },
            },
            canPay ? `${formatNumber(price)}원 보내고 받는다` : "잔고 부족",
          ),
        ),
      ),
    );
  }

  function showResult(message: string, tweetText: string): void {
    const tweetAttr: AttributeId = kind === "concert" ? "idol" : "actor";
    container.replaceChildren(
      head("결과"),
      el(
        "div",
        { class: "modal__body" },
        el("p", { style: "font-size:15px;line-height:1.8;margin:0 0 16px" }, message),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "닫기"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let delta = 0;
                ctx.update((s) => {
                  delta = postTweet(s, tweetAttr, tweetText, false).followerDelta;
                });
                ctx.closeModal();
                ctx.toast(
                  delta >= 0 ? `트윗 등록! +${delta} 팔로워` : `트윗 등록... ${delta} 팔로워`,
                );
              },
            },
            "트윗한다",
          ),
        ),
      ),
    );
  }

  showIntro();
  return container;
}
