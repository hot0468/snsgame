import type { GameContext } from "./context";
import { DRUNK_TWEETS } from "@/data/drunk";
import { getRegretTweet, postDrunkTweet, resolveRegret } from "@/systems/drunk";
import { el, formatNumber } from "@/utils/dom";
import { pick } from "@/utils/random";

/* ============================================================
 * 심야 취중 트윗 + 이불킥(강제 팝업, app.ts가 상태로 감지해 띄운다).
 *
 * 취중팝업: "술을 마셨다" → 랜덤 문구가 블러로 안 읽히는 채로 [등록]밖에 없다(블라인드 게시).
 *          등록하면 postDrunkTweet이 초고분산 결과로 게시 + 다음날로 진행.
 * 이불킥: 다음날 아침, 어젯밤 글이 또렷이 보이며 [삭제(수습)]/[방치(박제)] 선택.
 * ⚠️ 앱 배경 블러는 app.ts가 drunkPending 동안 root에 .drunk-blur를 건다(여긴 문구 블러만).
 * ============================================================ */

/** 취중 트윗 팝업 — 블라인드 게시. */
export function renderDrunkTweetModal(ctx: GameContext): HTMLElement {
  // 팝업에 뜨는 문구는 블러라 안 읽힌다(장식). 실제 게시 문구는 postDrunkTweet이 뽑는다.
  const blurred = pick(DRUNK_TWEETS);
  return el(
    "div",
    { class: "modal drunk-modal" },
    el("div", { class: "modal__head" }, "🍶 술을 마셨다"),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "drunk-modal__lead" },
        "정신을 차려보니 트윗 작성 창이 열려 있다… 눈앞이 핑 돈다. 뭐라고 쓴 거지?",
      ),
      el(
        "div",
        { class: "drunk-modal__tweet" },
        el("p", { class: "drunk-blur-text" }, blurred),
      ),
      el(
        "div",
        { class: "compose-actions", style: "justify-content:center" },
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update((s) => {
                postDrunkTweet(s);
              });
              ctx.toast("취중 트윗을 올려버렸다… 🍶");
              ctx.closeModal();
            },
          },
          "등록",
        ),
      ),
    ),
  );
}

/** 다음날 아침 이불킥 팝업 — 삭제(수습) / 방치(박제). */
export function renderMorningRegretModal(ctx: GameContext): HTMLElement {
  const t = getRegretTweet(ctx.store.getState());
  const gain = t?.gainedFollowers ?? 0;
  const good = gain >= 0;
  return el(
    "div",
    { class: "modal" },
    el("div", { class: "modal__head" }, "🫣 이불킥"),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "drunk-modal__lead" },
        "어젯밤… 내가 이런 걸 올렸다고? 폰을 든 손이 부들부들 떨린다.",
      ),
      el(
        "div",
        { class: "drunk-modal__tweet drunk-modal__tweet--clear" },
        el("p", {}, t?.text ?? "(트윗을 찾을 수 없다)"),
      ),
      el(
        "div",
        { class: "drunk-modal__outcome" + (good ? "" : " drunk-modal__outcome--bad") },
        good
          ? `팔로워 +${formatNumber(gain)} — 어라, 의외로 반응이 좋았잖아?`
          : `팔로워 ${formatNumber(gain)} — 역시 사고를 쳤다…`,
      ),
      el(
        "div",
        { class: "compose-actions", style: "gap:10px" },
        el(
          "button",
          {
            class: "btn btn--ghost",
            onclick: () => {
              ctx.update((s) => resolveRegret(s, "delete"));
              ctx.toast(good ? "삭제했다. 얻은 팔로워는 반납… 없던 일로." : "얼른 삭제했다. 못 본 걸로.");
              ctx.closeModal();
            },
          },
          good ? "삭제(수습·팔로워 반납)" : "삭제(수습)",
        ),
        el(
          "button",
          {
            class: "btn",
            onclick: () => {
              ctx.update((s) => resolveRegret(s, "keep"));
              ctx.toast(good ? "당당하게 놔뒀다 😎" : "에라 모르겠다, 박제되든 말든.");
              ctx.closeModal();
            },
          },
          "방치(박제)",
        ),
      ),
    ),
  );
}
