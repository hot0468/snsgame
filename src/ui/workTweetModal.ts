import type { GameContext } from "./context";
import { WORK_TWEET_LINES } from "@/data/workTweets";
import { canPostTweet, postTweet } from "@/systems/tweetSystem";
import { canPostBySlot } from "@/systems/eggs";
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { icon } from "./icons";
import { showDdeoksang } from "./ddeoksang";

/**
 * '오늘 회사 얘기' 트윗 모달 — 재직 중일 때 상세 스탯의 직업란에서 연다.
 * 기사·실검 트윗처럼 긍정/부정 톤을 골라 올린다(안 써도 됨). 일반 트윗과 동일하게
 * 행동력·게시 슬롯을 소모하므로 게이트를 걸고, 톤에 맞는 문구를 랜덤으로 게시한다.
 */
export function renderWorkTweetModal(ctx: GameContext): HTMLElement {
  const s = ctx.store.getState();
  const container = el("div", { class: "modal" });

  function close(): HTMLElement {
    return el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕");
  }

  // 재직 중이 아니면(방어적) 안내만.
  if (!s.employment) {
    container.replaceChildren(
      el("div", { class: "modal__head" }, "오늘 회사 얘기", close()),
      el(
        "div",
        { class: "modal__body" },
        el("p", { class: "compose-hint", style: "margin:0" }, "재직 중일 때만 회사 얘기를 쓸 수 있어요."),
      ),
    );
    return container;
  }

  // 하루 1회 캡 — 오늘 이미 회사 얘기를 올렸으면 못 쓴다(부장님 카톡·EBS 무료 강의와 같은 day 캡).
  const doneToday = s.lastWorkTweetDay === s.day;
  const canPost = !doneToday && canPostTweet(s) && canPostBySlot(s);
  const blockHint = doneToday
    ? "오늘은 이미 회사 얘기를 올렸어요 (하루 1번)"
    : !canPostTweet(s)
      ? "행동력이 부족해요"
      : !canPostBySlot(s)
        ? "오늘 게시 슬롯을 다 썼어요"
        : null;

  /** 톤을 골라 회사 얘기 트윗을 게시한다(일반 트윗과 동일 경로 — 슬롯·행동력 소모). */
  function post(tone: "positive" | "negative"): void {
    if (!canPost) return;
    const text = pick(WORK_TWEET_LINES[tone]);
    let delta = 0;
    let dd: { likes: number; retweets: number; gain: number } | null = null;
    ctx.update((st) => {
      const res = postTweet(st, "daily", text, false);
      delta = res.followerDelta;
      st.lastWorkTweetDay = st.day; // 오늘 회사 얘기 소진(하루 1회)
      if (res.ddeoksang) {
        dd = { likes: res.tweet.likes, retweets: res.tweet.retweets, gain: res.followerDelta + res.ddeoksangGain };
      }
    });
    ctx.closeModal();
    ctx.toast(delta >= 0 ? `트윗 등록! +${delta} 팔로워` : `트윗 등록... ${delta} 팔로워`);
    if (dd) showDdeoksang(ctx, dd);
    ctx.afterAction("tweet");
  }

  const toneBtn = (tone: "positive" | "negative", label: string): HTMLElement =>
    el(
      "button",
      {
        class: "event-choice",
        disabled: !canPost,
        onclick: () => post(tone),
      },
      label,
    );

  container.replaceChildren(
    el(
      "div",
      { class: "modal__head" },
      el("span", { class: "modal__head-title" }, icon("article", { size: 18 }), "오늘 회사 얘기"),
      close(),
    ),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { style: "font-size:15px;line-height:1.6;margin:0 0 6px" },
        "오늘 하루 회사에서 있었던 일, 어떤 톤으로 올릴까?",
      ),
      el(
        "p",
        { class: "compose-hint", style: "margin:0 0 16px" },
        blockHint ?? "안 써도 돼요. 실검처럼 좋았던 일/힘들었던 일 중 골라 올릴 수 있어요.",
      ),
      toneBtn("positive", "👍 좋았던 일 (긍정)"),
      toneBtn("negative", "😮‍💨 힘들었던 일 (부정)"),
      el("button", { class: "event-choice", style: "opacity:.8", onclick: () => ctx.closeModal() }, "오늘은 안 쓸래"),
    ),
  );
  return container;
}
