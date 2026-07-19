import type { GameContext } from "./context";
import type { Tweet } from "@/core/types";
import { resolvedTweetImage } from "@/systems/mediaImages";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 트윗의 사진/영상 자리를 클릭하면 뜨는 팝업.
 * 이미지가 붙는 트윗이면 실제 이미지를, 아니면 자리표시자를 보여준다.
 * 프롬프트(사진 설명)는 이미지 유무와 무관하게 늘 남긴다 — 설명 자체가 정보다.
 *
 * ⚠️ media가 아니라 **트윗**을 받는다. imageForTweet이 트윗 id로 이미지를 고정하므로,
 *    media만 받으면 카드와 다른 이미지가 나올 수 있다.
 */
export function renderMediaModal(ctx: GameContext, tweet: Tweet): HTMLElement {
  const media = tweet.media;
  const isVideo = media?.kind === "video";
  const img = resolvedTweetImage(tweet);
  return el(
    "div",
    { class: "modal" },
    el(
      "div",
      { class: "modal__head" },
      el(
        "span",
        { class: "modal__head-title" },
        icon(isVideo ? "film" : "image", { size: 18 }),
        isVideo ? "영상 설명" : "사진 설명",
      ),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "div",
        {
          class:
            "media-modal__frame" +
            (isVideo ? " media-modal__frame--video" : "") +
            (img ? " media-modal__frame--img" : ""),
        },
        img
          ? el("img", {
              // 카드와 같은 규칙 — 성인 풀에서 온 것만 블러(components.ts 주석 참고).
              class: "media-modal__img" + (img.source === "adult" ? " media-modal__img--blur" : ""),
              src: img.url,
              alt: media?.prompt ?? "",
            })
          : icon(isVideo ? "film" : "image", { size: 40 }),
        isVideo ? el("span", { class: "media-modal__play" }, icon("youtube", { size: 30 })) : null,
      ),
      el("p", { class: "media-modal__prompt" }, media?.prompt ?? ""),
    ),
  );
}
