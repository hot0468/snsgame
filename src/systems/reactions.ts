import type { AttributeId, GameState, TweetReply } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { ALL_ATTRIBUTE_IDS, ATTRIBUTES } from "@/data/attributes";
import { MENTION_TEMPLATES, MY_REPLY_LINES, type ReplyTone } from "@/data/reactions";
import { mentionsForText } from "@/data/tweetSets";
import { mediaSetFor } from "@/data/mediaTweets";
import { randomName } from "@/data/accounts";
import { MAX_SKILL } from "@/data/stats";
import { chance, pick, randInt, sample, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampResource, clampSkill } from "./stats";

const NON_ADULT_ATTRS = ALL_ATTRIBUTE_IDS.filter((a) => !ATTRIBUTES[a].adultOnly);

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

/** 트윗당 최대 멘션 수 */
const MAX_MENTIONS = 5;

/**
 * 내 트윗에 달리는 멘션(답글)을 생성한다.
 * - 트윗에 귀속된 전용 멘션을 우선 쓰고, 부족분은 카테고리 기본 멘션으로 최대 5개까지 채운다.
 * - 멘션 '개수'는 트윗 카테고리의 관련 스탯(relatedSkills) 평균에 비례한다.
 *   (스탯이 높을수록 반응이 많이 달림, 트윗당 최대 5개)
 */
export function generateReactions(
  state: GameState,
  attr: AttributeId,
  text: string,
): TweetReply[] {
  // 트윗 전용(귀속) 멘션 + 카테고리 기본 멘션(중복 제외)을 합쳐 최대 5개 후보
  const bound = mediaSetFor(text)?.mentions ?? mentionsForText(text) ?? [];
  const category = MENTION_TEMPLATES[attr] ?? MENTION_TEMPLATES.daily;
  const extra = category.filter((m) => !bound.includes(m));
  const maxCount = Math.min(MAX_MENTIONS, bound.length + extra.length);

  // 카테고리 관련 스탯 평균(0~999) → 멘션 수(0~maxCount)에 비례
  const related = ATTRIBUTES[attr].relatedSkills;
  const skillAvg =
    related.reduce((sum, s) => sum + state.skills[s], 0) / Math.max(1, related.length);
  const skill01 = clamp(skillAvg / MAX_SKILL, 0, 1);
  const count = clamp(Math.round(skill01 * maxCount + (Math.random() - 0.5) * 0.6), 0, maxCount);

  // 귀속 멘션을 먼저 채우고, 부족하면 카테고리 멘션으로 채운다
  const chosen =
    count <= bound.length
      ? sample(bound, count)
      : [...sample(bound, bound.length), ...sample(extra, count - bound.length)];

  return chosen.map((mentionText) => {
    const { name, handle } = randomName();
    return {
      id: uid("reply"),
      authorName: name,
      authorHandle: handle,
      attribute: pick(NON_ADULT_ATTRS),
      text: mentionText,
      likes: randInt(0, 40),
    };
  });
}

/** 활성 계정 타임라인에서 (트윗, 멘션)을 찾는다. */
function findReply(
  state: GameState,
  tweetId: string,
  replyId: string,
): TweetReply | undefined {
  const tweet = getActiveAccount(state).timeline.find((t) => t.id === tweetId);
  return tweet?.replies?.find((r) => r.id === replyId);
}

/**
 * 멘션에 좋아요를 누른다(멘션당 1회).
 * 팬과의 호응 표시 — 낮은 확률로 팔로워가 소폭 는다.
 * @returns 팔로워 증가분(없으면 0)
 */
export function likeReply(state: GameState, tweetId: string, replyId: string): number {
  const reply = findReply(state, tweetId, replyId);
  if (!reply || reply.likedByMe) return 0;
  reply.likedByMe = true;
  reply.likes += 1;
  if (chance(0.25)) {
    changeFollowers(state, 1);
    return 1;
  }
  return 0;
}

/** 답글 톤별 효과 파라미터 */
const REPLY_TONE_EFFECT: Record<
  ReplyTone,
  { skill: "sociability" | "comedy" | null; mental: number; chance: number }
> = {
  friendly: { skill: "sociability", mental: 0, chance: 0.45 },
  witty: { skill: "comedy", mental: 0, chance: 0.35 },
  cool: { skill: null, mental: 1, chance: 0.15 },
};

/**
 * 멘션에 톤을 골라 답글을 단다(멘션당 1회).
 * 톤에 따라 오르는 스탯과 팔로워 확률이 다르다.
 * @returns 팔로워 증가분(없으면 0)
 */
export function replyToMention(
  state: GameState,
  tweetId: string,
  replyId: string,
  tone: ReplyTone,
): number {
  const reply = findReply(state, tweetId, replyId);
  if (!reply || reply.myReply) return 0;
  reply.myReply = pick(MY_REPLY_LINES[tone]);

  const fx = REPLY_TONE_EFFECT[tone];
  if (fx.skill) state.skills[fx.skill] = clampSkill(state.skills[fx.skill] + 5);
  if (fx.mental) state.resources.mental = clampResource(state.resources.mental + fx.mental);

  if (chance(fx.chance)) {
    const delta = randInt(1, 2);
    changeFollowers(state, delta);
    return delta;
  }
  return 0;
}
