import type { AdultKind, AttributeId, EventTweetDraft, GameState, TweetKind } from "@/core/types";
import { uid } from "@/utils/random";
import { canPostBySlot } from "./eggs";
import { postTweet, type PostTweetResult } from "./tweetSystem";

/** 이벤트 트윗 초안 보관 상한. 초과 시 가장 오래된 초안이 밀려난다. */
export const MAX_EVENT_TWEET_DRAFTS = 15;

/**
 * 이벤트 트윗을 즉시 게시하는 대신 초안으로 저장한다.
 * id/createdDay는 여기서 채운다. 길이가 상한을 넘으면 가장 오래된 초안(front)을 shift로 버린다.
 */
export function enqueueEventTweet(
  state: GameState,
  d: {
    source: string;
    attr: AttributeId;
    text: string;
    isAdult?: boolean;
    adultKind?: AdultKind;
    followerMult?: number;
    kind?: TweetKind;
  },
): void {
  const draft: EventTweetDraft = {
    id: uid("evtweet"),
    source: d.source,
    attr: d.attr,
    text: d.text,
    isAdult: d.isAdult ?? false,
    adultKind: d.adultKind ?? "meetup",
    followerMult: d.followerMult ?? 1,
    kind: d.kind ?? "plain",
    createdDay: state.day,
  };
  state.eventTweetDrafts.push(draft);
  while (state.eventTweetDrafts.length > MAX_EVENT_TWEET_DRAFTS) {
    state.eventTweetDrafts.shift();
  }
}

export function eventTweetDraftCount(state: GameState): number {
  return state.eventTweetDrafts.length;
}

/**
 * 초안을 실제 게시한다. 게시 슬롯이 없으면(canPostBySlot=false) null을 반환하고 아무것도 바꾸지 않는다.
 * 슬롯이 있으면 postTweet에 위임(무료 아님 → 슬롯/행동력/팔로워 반영, consumePostSlot은 postTweet 내부에서만)
 * 후 해당 초안을 리스트에서 제거하고 결과를 반환한다. 없는 id면 null.
 */
export function postEventTweetDraft(state: GameState, id: string): PostTweetResult | null {
  if (!canPostBySlot(state)) return null;
  const draft = state.eventTweetDrafts.find((d) => d.id === id);
  if (!draft) return null;
  const result = postTweet(
    state,
    draft.attr,
    draft.text,
    draft.isAdult,
    draft.adultKind,
    draft.followerMult,
    { kind: draft.kind },
  );
  state.eventTweetDrafts = state.eventTweetDrafts.filter((d) => d.id !== id);
  return result;
}

/** 초안을 게시하지 않고 버린다. */
export function removeEventTweetDraft(state: GameState, id: string): void {
  state.eventTweetDrafts = state.eventTweetDrafts.filter((d) => d.id !== id);
}
