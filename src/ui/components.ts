import type { Tweet, TweetReply } from "@/core/types";
import { likeReply } from "@/systems/reactions";
import { imageForTweet } from "@/systems/mediaImages";
import { imageForItem } from "@/data/itemImages";
import { el, formatNumber } from "@/utils/dom";
import { dateLabel } from "@/systems/time";
import { SLOT_LABELS } from "@/core/state";
import type { GameContext } from "./context";
import { icon, avatar } from "./icons";

/**
 * 아이템 id에 붙은 썸네일 이미지. **없으면 null을 돌려준다** — el()이 null 자식을 무시하므로
 * 호출부는 `thumb(..., itemImg(id), ...)`로 끼워 넣기만 하면 폴백(그라데이션/이모지)이 그대로 산다.
 * 이미지 없는 아이템이 기본값이고 대부분이다.
 *
 * 담는 그릇은 position:relative여야 한다(.item-thumb-img가 inset:0으로 덮는다).
 */
export function itemImg(id: string, alt = ""): HTMLElement | null {
  const url = imageForItem(id);
  return url ? el("img", { class: "item-thumb-img", src: url, alt }) : null;
}

/** 라벨 + 게이지 바 한 줄 (fillClass로 스탯별 색상 지정) */
export function statBar(
  label: string,
  value: number,
  max: number,
  fillClass?: string,
): HTMLElement {
  const pct = Math.round((Math.max(0, value) / max) * 100);
  return el(
    "div",
    { class: "stat-row" },
    el("span", { class: "stat-row__label" }, label),
    el(
      "div",
      { class: "bar" },
      el("div", {
        class: "bar__fill" + (fillClass ? ` ${fillClass}` : ""),
        style: `width:${pct}%`,
      }),
    ),
    el("span", { class: "stat-row__val" }, String(Math.round(value))),
  );
}

/**
 * 윈도우 앱 창(.modal--win)의 제목표시줄.
 * 최소화·최대화 버튼은 장식이고 ✕만 실제로 닫는다.
 * 명령 프롬프트·작업 관리자가 공유한다.
 */
export function winTitlebar(ctx: GameContext, title: string): HTMLElement {
  return el(
    "div",
    { class: "win-titlebar" },
    el("span", { class: "win-titlebar__title" }, title),
    el(
      "div",
      { class: "win-titlebar__btns" },
      el("button", { class: "win-btn", tabindex: "-1" }, "─"),
      el("button", { class: "win-btn", tabindex: "-1" }, "☐"),
      el("button", { class: "win-btn win-btn--close", onclick: () => ctx.closeModal() }, "✕"),
    ),
  );
}

/** 어휘력이 부족할 때 글자를 대체하는 '깨진' 글리프들 */
const GLITCH_GLYPHS = "▨▩▦▧▤▥░▒▓■◆◈◇※□▪◘◙╳";

/**
 * 읽는 사람의 어휘력(vocab)이 글 난도(difficulty)보다 낮으면
 * 부족한 만큼 글자를 깨진 글리프로 치환한다(어휘력이 오르면 정상 표시).
 * 같은 글은 항상 같은 모양으로 깨지도록 텍스트를 시드로 쓴다.
 */
function garbleText(text: string, difficulty: number, vocab: number): string {
  if (vocab >= difficulty) return text;
  const ratio = Math.min(0.9, (difficulty - vocab) / difficulty);
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = (h ^ text.charCodeAt(i)) * 16777619;
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === " " || ch === "\n") {
      out += ch;
      continue;
    }
    h = (h * 1103515245 + 12345 + i) & 0x7fffffff;
    if ((h % 1000) / 1000 < ratio) out += GLITCH_GLYPHS[h % GLITCH_GLYPHS.length];
    else out += ch;
  }
  return out;
}

interface TweetCardOpts {
  showGain?: boolean;
  /** 있으면 멘션에 좋아요/답글 등 상호작용을 활성화한다(내 타임라인용) */
  ctx?: GameContext;
  /**
   * 읽는 사람(플레이어)의 어휘력. 주어지고 트윗에 난도가 있으면
   * 어휘력이 부족한 만큼 본문 글자가 깨져 보인다(남의 트윗 표시용).
   */
  readerVocab?: number;
  /** 있으면 '리트윗' 버튼을 표시한다(남의 트윗을 내 탐라로 담기용) */
  retweet?: { done: boolean; onClick: () => void };
  /** 행사 트윗의 '참여하기'를 눌렀을 때 동작(있으면 버튼 활성) */
  onJoinEvent?: () => void;
  /** 사진/영상 자리를 눌렀을 때 동작(설명 팝업 열기) */
  onMedia?: (tweet: Tweet) => void;
  /** 있으면 카드 전체가 클릭 가능해지고(트윗 상세 열기), 액션 버튼은 개별 동작을 유지한다 */
  onOpen?: () => void;
  /** 멘션(답글) 본문을 항상 펼쳐 보여준다(개별 트윗 상세 화면 전용) */
  forceMentions?: boolean;
}

/**
 * 사진/영상 첨부 자리.
 * 파일명(키워드)이 맞는 이미지가 있으면 실제 이미지를, 없으면 아이콘 자리표시자를 그린다
 * (이미지 없는 트윗이 대다수라 자리표시자가 기본 경로다).
 */
function mediaBlock(tweet: Tweet, onMedia?: (t: Tweet) => void): HTMLElement {
  const media = tweet.media!;
  const isVideo = media.kind === "video";
  const img = imageForTweet(tweet);
  return el(
    "button",
    {
      class:
        "tweet-media" +
        (isVideo ? " tweet-media--video" : "") +
        (img ? " tweet-media--img" : ""),
      onclick: (e: Event) => {
        e.stopPropagation();
        onMedia?.(tweet);
      },
    },
    img
      ? el("img", {
          // ⚠️ 블러는 **출처가 성인 풀일 때만**이다. tweet.isAdult로 판정하지 마라 —
          //    isAdult가 붙은 아이돌 트윗은 아이돌 이미지를 받으므로(카테고리가 이긴다)
          //    그것까지 뭉갠다. systems/mediaImages.ts의 TweetImageSource 주석 참고.
          class: "tweet-media__img" + (img.source === "adult" ? " tweet-media__img--blur" : ""),
          src: img.url,
          alt: media.prompt,
        })
      : el("span", { class: "tweet-media__icon" }, icon(isVideo ? "film" : "image", { size: 30 })),
    // 영상은 이미지가 붙어도 재생 아이콘을 위에 얹는다(썸네일처럼).
    isVideo ? el("span", { class: "tweet-media__play" }, icon("youtube", { size: 26 })) : null,
  );
}

/** 행사 안내 박스(참여하기 버튼 포함) */
function eventBox(tweet: Tweet, onJoin?: () => void): HTMLElement | null {
  const ev = tweet.event;
  if (!ev) return null;
  const when = `${dateLabel(ev.day)} ${SLOT_LABELS[ev.slot] ?? ""}`;
  const joined = ev.joined;
  const btn = joined
    ? el("span", { class: "tweet-event__done" }, "참여 신청함")
    : onJoin
      ? el(
          "button",
          {
            class: "tweet-event__btn",
            onclick: (e: Event) => {
              e.stopPropagation();
              onJoin();
            },
          },
          "참여하기",
        )
      : null;
  return el(
    "div",
    { class: "tweet-event" },
    el(
      "div",
      { class: "tweet-event__info" },
      icon("clock", { size: 14 }),
      el(
        "div",
        {},
        el("div", { class: "tweet-event__title" }, ev.title),
        el("div", { class: "tweet-event__when" }, when),
      ),
    ),
    btn,
  );
}

/** 트윗 카드 하나 렌더 (아바타 + 본문 + 액션 바) */
export function tweetCard(tweet: Tweet, opts: TweetCardOpts = {}): HTMLElement {
  const gainNode =
    opts.showGain && tweet.gainedFollowers !== 0
      ? el(
          "span",
          {
            class:
              "tweet__gain" + (tweet.gainedFollowers < 0 ? " tweet__gain--neg" : ""),
          },
          `${tweet.gainedFollowers > 0 ? "+" : ""}${tweet.gainedFollowers} 팔로워`,
        )
      : null;

  const replyCount = tweet.replies?.length ?? 0;
  const ctx = opts.ctx;

  const rtLabel = tweet.isRetweet
    ? el(
        "div",
        { class: "tweet__rt-label" },
        icon("retweet", { size: 13 }),
        "재게시했습니다",
      )
    : null;

  // 멘션 개수는 표시만 한다. 멘션 본문은 개별 트윗(상세) 화면에서만 펼쳐진다.
  const commentAction = tweetAction("comment", "reply", replyCount);

  // 리트윗 액션: 남의 트윗이면 리트윗 실행(내 트윗은 표시만)
  const rtAction = opts.retweet
    ? tweetAction("retweet", "rt", tweet.retweets, {
        active: opts.retweet.done,
        onClick: () => opts.retweet?.onClick(),
      })
    : tweetAction("retweet", "rt", tweet.retweets);

  return el(
    "article",
    {
      class: "tweet" + (opts.onOpen ? " tweet--clickable" : ""),
      onclick: opts.onOpen ? () => opts.onOpen?.() : undefined,
    },
    avatar(tweet.authorName, 40),
    el(
      "div",
      { class: "tweet__body" },
      rtLabel,
      el(
        "div",
        { class: "tweet__head" },
        el("span", { class: "tweet__name" }, tweet.authorName),
        el("span", { class: "tweet__handle" }, `@${tweet.authorHandle}`),
        el("span", { class: "tweet__meta" }, `· ${dateLabel(tweet.createdDay)}`),
      ),
      el(
        "p",
        { class: "tweet__text" },
        tweet.difficulty && opts.readerVocab !== undefined
          ? garbleText(tweet.text, tweet.difficulty, opts.readerVocab)
          : tweet.text,
      ),
      tweet.media ? mediaBlock(tweet, opts.onMedia) : null,
      eventBox(tweet, opts.onJoinEvent),
      el(
        "div",
        { class: "tweet__actions" },
        commentAction,
        rtAction,
        tweetAction("heart", "like", tweet.likes),
        gainNode,
      ),
      renderReactions(tweet, ctx, opts.forceMentions),
    ),
  );
}

/** 아이콘 + 수치 한 쌍(멘션/인용 통계용) */
function metric(name: Parameters<typeof icon>[0], value: number): HTMLElement {
  return el("span", { class: "metric" }, icon(name, { size: 15 }), formatNumber(value));
}

/**
 * 트윗 하단 액션(코멘트/리트윗/좋아요).
 * onClick이 있으면 버튼처럼 눌러 동작한다(멘션·인용 펼침, 리트윗 등).
 */
function tweetAction(
  name: Parameters<typeof icon>[0],
  kind: "reply" | "rt" | "like",
  value: number,
  opts?: { onClick?: () => void; active?: boolean },
): HTMLElement {
  const interactive = !!opts?.onClick;
  return el(
    interactive ? "button" : "span",
    {
      class:
        `tweet__action tweet__action--${kind}` +
        (interactive ? " tweet__action--btn" : "") +
        (opts?.active ? " tweet__action--active" : ""),
      onclick: interactive
        ? (e: Event) => {
            e.stopPropagation();
            opts?.onClick?.();
          }
        : undefined,
    },
    el("span", { class: "tweet__action-icon" }, icon(name, { size: 17 })),
    value > 0 ? el("span", {}, formatNumber(value)) : null,
  );
}

/** 멘션 본문을 렌더한다. 개별 트윗(상세) 화면에서 forceMentions로만 표시된다. */
function renderReactions(tweet: Tweet, ctx?: GameContext, show?: boolean): HTMLElement | null {
  if (!ctx || !show) return null;
  const replies = tweet.replies ?? [];
  if (!replies.length) return null;
  return el(
    "div",
    { class: "reactions" },
    el("div", { class: "reactions__body" }, ...replies.map((r) => renderReply(r, tweet, ctx))),
  );
}

function renderReply(reply: TweetReply, tweet: Tweet, ctx?: GameContext): HTMLElement {
  const likeBtn = ctx
    ? el(
        "button",
        {
          class: "reply__btn" + (reply.likedByMe ? " reply__btn--on" : ""),
          disabled: reply.likedByMe,
          onclick: () => {
            let gained = 0;
            ctx.update((s) => {
              gained = likeReply(s, tweet.id, reply.id);
            });
            ctx.toast(gained > 0 ? "좋아요! 팔로워 +1" : "좋아요를 눌렀다");
          },
        },
        icon(reply.likedByMe ? "heart-fill" : "heart", { size: 14 }),
        reply.likedByMe ? "좋아요됨" : "좋아요",
      )
    : null;

  // 멘션에 답글(멘션)을 다는 기능은 제거. 멘션엔 좋아요만 남길 수 있다.
  const actions = ctx ? el("div", { class: "reply__actions" }, likeBtn) : null;

  return el(
    "div",
    { class: "reply" },
    avatar(reply.authorName, 34),
    el(
      "div",
      { class: "reply__body" },
      el(
        "div",
        { class: "reply__head" },
        el("span", { class: "tweet__name" }, reply.authorName),
        el("span", { class: "tweet__handle" }, `@${reply.authorHandle}`),
        el("span", { class: "tweet__meta" }, "님의 멘션"),
      ),
      el("p", { class: "reply__text" }, reply.text),
      el("div", { class: "reply__stats" }, metric("heart", reply.likes)),
      actions,
    ),
  );
}
