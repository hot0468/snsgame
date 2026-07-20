import type { GameContext } from "./context";
import type { Video } from "@/data/videos";
import { ATTRIBUTES } from "@/data/attributes";
import { watchVideo } from "@/systems/videoSystem";
import { postTweet } from "@/systems/tweetSystem";
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { icon } from "./icons";

/** "아이돌덕" → "아이돌"처럼 '계/덕' 접미사를 다듬는다. */
function catLabel(video: Video): string {
  return ATTRIBUTES[video.attribute].label.replace(/(계|덕)$/, "");
}

/**
 * 너튜브 영상 모달.
 *  1) 감상 확인 → 2) 시청 결과(+해금 안내) → 관련 트윗 작성 선택
 */
export function renderVideoModal(ctx: GameContext, video: Video): HTMLElement {
  const container = el("div", { class: "modal" });

  function showConfirm(): void {
    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("youtube", { size: 18 }), "영상 감상"),
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "div",
          { class: "video-preview" },
          el("div", {
            class: "video-preview__thumb",
            style:
              `background:linear-gradient(135deg, hsl(${video.hue}deg 60% 58%),` +
              ` hsl(${(video.hue + 40) % 360}deg 60% 42%))`,
          }, icon("youtube", { size: 34 })),
          el(
            "div",
            { class: "video-preview__meta" },
            el("div", { class: "video-preview__title" }, video.title),
            el("div", { class: "video-preview__ch" }, `${video.channel} · ${catLabel(video)}`),
            el("div", { class: "video-preview__sub" }, `${video.views} · ${video.age}`),
          ),
        ),
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          "이 영상을 감상하시겠습니까? (시간 1칸 소요)",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "닫기"),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                let unlocked: string | null = null;
                let message = "";
                ctx.update((s) => {
                  const out = watchVideo(s, video);
                  message = out.message;
                  unlocked = out.unlockedAttribute;
                });
                showResult(message, unlocked);
              },
            },
            "감상하기",
          ),
        ),
      ),
    );
  }

  function showResult(message: string, unlocked: string | null): void {
    const unlockMsg = unlocked
      ? `새 트윗 소재를 얻었다! 이제 '${catLabel(video)}' 카테고리로 트윗할 수 있어요.`
      : null;

    container.replaceChildren(
      el(
        "div",
        { class: "modal__head" },
        el("span", { class: "modal__head-title" }, icon("youtube", { size: 18 }), "시청 완료"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "life-result__flavor" }, message),
        unlockMsg ? el("p", { class: "life-result__unlock" }, unlockMsg) : null,
        el(
          "p",
          { class: "compose-hint", style: "margin-top:14px" },
          "이 영상 내용으로 트윗을 올릴까?",
        ),
        el(
          "div",
          { class: "compose-actions", style: "gap:10px" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => ctx.closeModal(),
            },
            "안 올린다",
          ),
          el(
            "button",
            {
              class: "btn",
              onclick: () => {
                const text = pick(video.tweetLines);
                let delta = 0;
                ctx.update((s) => {
                  delta = postTweet(s, video.attribute, text, false).followerDelta;
                });
                ctx.closeModal();
                ctx.toast(delta >= 0 ? `트윗 게시! +${delta} 팔로워` : `트윗 게시... ${delta} 팔로워`);
              },
            },
            "트윗한다",
          ),
        ),
      ),
    );
  }

  showConfirm();
  return container;
}
