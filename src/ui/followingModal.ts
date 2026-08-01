import type { GameContext } from "./context";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { hasNextChapter, storyTriggerFor } from "@/systems/dmStory";
import { el, formatNumber } from "@/utils/dom";
import { avatar } from "./icons";

/**
 * '팔로우 목록' 모달 — 현재 활성 계정이 팔로우한 계정들을 보여준다.
 * 목록은 활성 계정의 followingAccounts라, 계정을 바꾸면 자동으로 그 계정의 목록이 뜬다(계정별 분리).
 */
/** 트리거 동사별 배지 문구 — 이 계정에서 지금 뭘 하면 새 회차가 열리는지. */
const NEXT_CHAPTER_LABEL: Record<string, string> = {
  like: "좋아요 하면 새 DM",
  retweet: "리트윗하면 새 DM",
  follow: "새 DM 있음",
  engage: "반응 쌓으면 새 DM",
};

export function renderFollowingModal(ctx: GameContext): HTMLElement {
  const state = ctx.store.getState();
  const me = getActiveAccount(state);
  const list = me.followingAccounts;

  return el(
    "div",
    { class: "modal following-modal" },
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, `@${me.handle} · 팔로우 목록 (${list.length})`),
      el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
    ),
    el(
      "div",
      { class: "modal__body" },
      list.length === 0
        ? el("div", { class: "empty" }, "아직 팔로우한 계정이 없어요.\n둘러보기에서 마음에 드는 계정을 팔로우해보세요!")
        : el(
            "div",
            { class: "following-list" },
            ...list.map((a) =>
              el(
                "div",
                {
                  class: "following-row",
                  title: "프로필 보기",
                  // 트윗 아바타 클릭과 같은 그릇(SNS 프로필 페이지)으로 연다 — 모달을 닫고 그쪽으로 넘긴다.
                  // 뒤로가기가 모달을 열었던 페이지로 돌아가도록 profilePrevPage를 먼저 박아둔다.
                  onclick: () => {
                    if (ctx.ui.snsPage !== "profile") ctx.ui.profilePrevPage = ctx.ui.snsPage;
                    // 상태 객체를 그대로 들고 있지 않는다(세이브 로드 등으로 갈리면 UI가 옛 객체를 본다).
                    ctx.ui.viewProfile = { ...a, followed: true };
                    ctx.ui.snsPage = "profile";
                    ctx.closeModal(); // 재렌더까지 여기서 함께 처리된다
                  },
                },
                el("div", { class: "following-row__avatar" }, avatar(a.name, 40)),
                el(
                  "div",
                  { class: "following-row__meta" },
                  el("div", { class: "following-row__name" }, a.name),
                  el("div", { class: "following-row__handle" }, `@${a.handle}`),
                  // 스토리 계정인데 다음 회차가 열려 있으면 알려준다. 안 그러면 2·3회차는
                  // 앞 회차를 끝냈다는 사실 자체를 플레이어가 잊어서 영영 안 열린다.
                  hasNextChapter(state, a.handle)
                    ? el(
                        "div",
                        { class: "following-row__dm" },
                        NEXT_CHAPTER_LABEL[storyTriggerFor(a.handle) ?? "follow"],
                      )
                    : null,
                ),
                el(
                  "div",
                  { class: "following-row__side" },
                  el("span", { class: "following-row__attr" }, ATTRIBUTES[a.attribute].label),
                  el("span", { class: "following-row__followers" }, `${formatNumber(a.followers)} 팔로워`),
                ),
              ),
            ),
          ),
    ),
  );
}
