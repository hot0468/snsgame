import type { GameContext } from "@/ui/context";
import type { AdultKind } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { resolveMotel } from "@/systems/meeting";
import { enqueueEventTweet } from "@/systems/eventTweets";
import { MOTEL_RESULT_TWEETS } from "@/data/tweets";
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { icon } from "@/ui/icons";

/**
 * 모텔 제안 수락 → 나가기 → 결과(종류·타락도에 따라 다름) → 결과 트윗 업로드.
 */
export function renderMotelModal(ctx: GameContext, threadId: string): HTMLElement {
  const container = el("div", { class: "modal modal--adult" });

  const thread = getActiveAccount(ctx.store.getState()).dms.find((t) => t.id === threadId);
  if (!thread) {
    container.append(el("div", { class: "modal__body" }, "대화를 찾을 수 없습니다."));
    return container;
  }

  function head(title: string): HTMLElement {
    return el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("bed", { size: 18 }), title),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    );
  }

  function showIntro(): void {
    container.replaceChildren(
      head(`${thread!.partnerName}의 제안`),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.7;margin:0 0 12px" },
          `${thread!.partnerName}님이 지금 만나서 모텔에 가자고 한다. 나갈까?`,
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            { class: "btn btn--ghost", onclick: () => ctx.closeModal() },
            "역시 그만둔다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let msg = "";
                let key = "meetup";
                let kind: AdultKind = "meetup";
                ctx.update((s) => {
                  const t = getActiveAccount(s).dms.find((x) => x.id === threadId);
                  if (t) {
                    const r = resolveMotel(s, t);
                    msg = r.message;
                    key = r.tweetKey;
                    kind = r.tweetKind;
                  }
                });
                showResult(msg, key, kind);
              },
            },
            "약속 장소로 나간다",
          ),
        ),
      ),
    );
  }

  function showResult(message: string, tweetKey: string, tweetKind: AdultKind): void {
    const tweetText = pick(MOTEL_RESULT_TWEETS[tweetKey] ?? MOTEL_RESULT_TWEETS.meetup);
    // 긴 결과 본문을 빈 줄(\n\n) 기준으로 나눠 한 장씩 넘겨 읽게 한다.
    const pages = message
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    if (pages.length === 0) pages.push(message);
    let idx = 0;

    const tweetBtn = () =>
      el(
        "button",
        {
          class: "btn",
          onclick: () => {
            ctx.update((s) =>
              enqueueEventTweet(s, {
                source: "모텔",
                attr: "adult",
                text: tweetText,
                isAdult: true,
                adultKind: tweetKind,
              }),
            );
            ctx.closeModal();
            ctx.toast("📝 트윗 소재를 작성 목록에 저장했어요 · 작성 팝업에서 게시");
          },
        },
        "트윗한다",
      );

    function renderPage(): void {
      const isLast = idx === pages.length - 1;
      const nav = isLast
        ? el(
            "div",
            { class: "compose-actions", style: "gap:10px" },
            el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "닫기"),
            tweetBtn(),
          )
        : el(
            "div",
            { class: "compose-actions", style: "gap:10px;justify-content:space-between" },
            el(
              "button",
              {
                class: "btn btn--ghost",
                disabled: idx === 0,
                onclick: () => {
                  if (idx > 0) idx--;
                  renderPage();
                },
              },
              "이전",
            ),
            el(
              "span",
              { style: "align-self:center;font-size:12px;opacity:.7" },
              `${idx + 1} / ${pages.length}`,
            ),
            el(
              "button",
              {
                class: "btn",
                onclick: () => {
                  if (idx < pages.length - 1) idx++;
                  renderPage();
                },
              },
              "다음",
            ),
          );

      const body = el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.8;margin:0 0 16px;white-space:pre-wrap" },
          pages[idx],
        ),
        nav,
      );
      container.replaceChildren(head("결과"), body);
      body.scrollTop = 0;
    }

    renderPage();
  }

  showIntro();
  return container;
}
