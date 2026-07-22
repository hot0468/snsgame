import type { GameContext } from "./context";
import type { Tweet } from "@/core/types";
import { QRT_COMMENTS, QRT_TONES, type QrtTone } from "@/data/quote";
import { postQuoteTweet } from "@/systems/quote";
import { canPostTweet } from "@/systems/tweetSystem";
import { canPostBySlot } from "@/systems/eggs";
import { showDdeoksang } from "./ddeoksang";
import { el } from "@/utils/dom";
import { pick } from "@/utils/random";

/**
 * 인용 트윗(QRT) 작성 모달 — 둘러보기의 남 트윗을 인용해 내 코멘트를 얹는다.
 * 톤(동조/맞장구/츳코미)을 고르면 그 톤의 코멘트 문구가 뽑히고, 등록 시 systems/quote가 판정한다.
 * 하이리스크: 궁합이 맞으면 대박, 어긋나면 알티 역풍(팔로워↓·논란).
 */
export function renderQuoteModal(ctx: GameContext, target: Tweet): HTMLElement {
  let tone: QrtTone = "agree";
  // 톤별 코멘트는 톤당 1회만 뽑아 캐시(재렌더에도 문구가 흔들리지 않게).
  const commentCache: Partial<Record<QrtTone, string>> = {};
  const commentFor = (t: QrtTone): string => (commentCache[t] ??= pick(QRT_COMMENTS[t]));

  const container = el("div", { class: "modal" });

  const head = el(
    "div",
    { class: "modal__head" },
    "인용 트윗",
    el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
  );

  function register(): void {
    const s = ctx.store.getState();
    if (!canPostTweet(s) || !canPostBySlot(s)) return;
    const text = commentFor(tone);
    let ratioed = false;
    let delta = 0;
    let ddPayload: { likes: number; retweets: number; gain: number } | null = null;
    ctx.update((st) => {
      const r = postQuoteTweet(st, target, tone, text);
      ratioed = r.ratioed;
      delta = r.followerDelta;
      if (r.ddeoksang) {
        const gain = r.followerDelta + r.ddeoksangGain;
        ddPayload = { likes: Math.round(gain * 0.7), retweets: Math.round(gain * 0.25), gain };
      }
    });
    ctx.toast(
      ratioed
        ? `알티 역풍을 맞았다... ${delta} 팔로워`
        : `인용 트윗 등록! +${delta} 팔로워`,
      ratioed ? "bad" : undefined,
    );
    ctx.closeModal();
    if (ddPayload) showDdeoksang(ctx, ddPayload);
    ctx.afterAction("tweet");
  }

  function paint(): void {
    const s = ctx.store.getState();
    const canPost = canPostTweet(s) && canPostBySlot(s);
    const gateHint = !canPostTweet(s)
      ? "행동력이 부족해요"
      : !canPostBySlot(s)
        ? "오늘 게시 슬롯을 다 썼어요"
        : null;

    const toneChips = el(
      "div",
      { class: "chip-row chip-row--center" },
      ...QRT_TONES.map((t) =>
        el(
          "button",
          {
            class: "chip" + (t.id === tone ? " chip--active" : ""),
            onclick: () => {
              if (tone === t.id) return;
              tone = t.id;
              paint();
            },
          },
          t.label,
        ),
      ),
    );

    // 내 코멘트 미리보기 + 원문 인용 카드
    const preview = el(
      "div",
      { class: "quote-compose" },
      el("div", { class: "quote-compose__comment" }, commentFor(tone)),
      el(
        "div",
        { class: "quote-card" },
        el(
          "div",
          { class: "quote-card__head" },
          el("span", { class: "quote-card__name" }, target.authorName),
          el("span", { class: "quote-card__handle" }, `@${target.authorHandle}`),
        ),
        el("p", { class: "quote-card__text" }, target.text),
      ),
    );

    const body = el(
      "div",
      { class: "modal__body compose-step" },
      el("h3", { class: "compose-step__title" }, "어떤 톤으로 인용할까?"),
      el(
        "p",
        { class: "compose-hint", style: "margin-top:0" },
        "결이 맞으면 원문 인기에 올라타 팔로워가 급증하지만, 안 맞으면 알티 역풍을 맞아요.",
      ),
      toneChips,
      preview,
      gateHint ? el("div", { class: "compose-hint" }, gateHint) : null,
      el(
        "div",
        { class: "compose-actions" },
        el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "취소"),
        el(
          "button",
          { class: "btn", disabled: !canPost, onclick: () => canPost && register() },
          "인용 등록",
        ),
      ),
    );
    container.replaceChildren(head, body);
  }

  paint();
  return container;
}
