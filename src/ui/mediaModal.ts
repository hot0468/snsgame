import type { GameContext } from "./context";
import type { TweetMedia } from "@/core/types";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/**
 * 트윗의 사진/영상 자리를 클릭하면 뜨는 팝업.
 * 실제 미디어 대신, 그 사진/영상이 어떤 것인지 설명하는 프롬프트를 보여준다.
 */
export function renderMediaModal(ctx: GameContext, media: TweetMedia): HTMLElement {
  const isVideo = media.kind === "video";
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
        { class: "media-modal__frame" + (isVideo ? " media-modal__frame--video" : "") },
        icon(isVideo ? "film" : "image", { size: 40 }),
        isVideo ? el("span", { class: "media-modal__play" }, icon("youtube", { size: 30 })) : null,
      ),
      el("p", { class: "media-modal__prompt" }, media.prompt),
    ),
  );
}
