import type { GameState, SkillStatId, Tweet } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { SKILL_STATS, SKILL_STAT_IDS } from "@/data/stats";
import { pick, randInt, sample, uid } from "@/utils/random";
import { clampResource, clampSkill } from "./stats";

/**
 * '까칠한외눈(@Apr1)' — 소원을 이루어주는 가게로 유인하는 수상한 계정.
 * 낮은 확률로 트윗이 뜨고, 좋아요를 누르면 DM으로 링크가 온다.
 * 링크로 들어간 '가게'에서 소원을 빌면, 소원은 이뤄지지 않고 오히려 대가를 치른다(몽키스포).
 */

export const WISH_ACCOUNT = { name: "까칠한외눈", handle: "Apr1" };

const WISH_TWEET_LINES = [
  "이루고 싶은 소원, 하나쯤 있잖아요. 진심이라면 이 트윗에 좋아요를. 조용히 방법을 알려드릴게요.",
  "간절한 소원이 있나요? … 저는 그걸 이뤄주는 곳을 알아요. 궁금하면 좋아요만 눌러요.",
  "세상엔 노력으로 안 되는 것도 있죠. 그럴 땐… 방법이 있어요. 관심 있으면 좋아요.",
  "당신의 소원, 값을 치를 각오만 있다면 못 이룰 게 없어요. 좋아요를 누른 분께만.",
];

/** 소원 목록 — 각 소원이 가리키는 '스탯'(money 포함). 소원은 실제로 이뤄지지 않는다. */
export interface Wish {
  id: string;
  label: string;
  /** 이 소원이 가리키는 스탯(하락 대상에서 제외된다). "money"는 소지금. */
  target: SkillStatId | "money";
}

export const WISHES: Wish[] = [
  { id: "money", label: "돈이 많아지게 해주세요", target: "money" },
  { id: "friend", label: "친구가 많아지고 싶어요", target: "sociability" },
  { id: "pretty", label: "더 예뻐지고 싶어요", target: "beauty" },
  { id: "smart", label: "똑똑해지고 싶어요", target: "knowledge" },
  { id: "writing", label: "글솜씨가 좋아지고 싶어요", target: "vocabulary" },
  { id: "funny", label: "웃긴 사람이 되고 싶어요", target: "comedy" },
  { id: "creative", label: "창의력이 넘쳤으면 좋겠어요", target: "creativity" },
  { id: "healthy", label: "건강하고 탄탄해지고 싶어요", target: "fitness" },
];

/** 소원을 빌었을 때 깎이는 소지금 */
export const WISH_MONEY_PENALTY = 4_100_000;

/** 소원 3개를 무작위로 뽑는다(사이트에 표시). */
export function rollWishOptions(): string[] {
  return sample(WISHES, WISHES.length).slice(0, 3).map((w) => w.id);
}

/** 까칠한외눈 트윗 하나를 만든다(둘러보기 피드에 낮은 확률로 섞인다). */
export function makeWishTweet(state: GameState): Tweet {
  return {
    id: uid("wishtw"),
    authorName: WISH_ACCOUNT.name,
    authorHandle: WISH_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(WISH_TWEET_LINES),
    createdDay: state.day,
    likes: randInt(0, 13),
    retweets: randInt(0, 4),
    gainedFollowers: 0,
  };
}

/** 이 트윗이 까칠한외눈 트윗인지 */
export function isWishTweet(tweet: Tweet): boolean {
  return tweet.authorHandle === WISH_ACCOUNT.handle;
}

/** 까칠한외눈 트윗에 좋아요를 눌렀을 때 — DM으로 링크를 보낸다(스레드가 이미 있으면 무시). */
export function spawnWishDM(state: GameState): void {
  const account = getActiveAccount(state);
  if (account.dms.some((t) => t.wishLink)) return;
  account.dms.unshift({
    id: uid("dm"),
    partnerName: WISH_ACCOUNT.name,
    partnerHandle: WISH_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    messages: [
      {
        id: uid("dmm"),
        from: "partner",
        text: "좋아요 고마워요. 약속대로 알려드릴게요. 아래 링크로 들어오면, 당신의 소원을 들어주는 가게가 있어요. …단, 문은 한 번만 열려요.",
        day: state.day,
      },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    wishLink: true,
  });
}

/** 링크를 클릭해 가게에 들어가면, 그 DM 스레드는 사라진다(재방문 불가). */
export function consumeWishLink(state: GameState): void {
  const account = getActiveAccount(state);
  account.dms = account.dms.filter((t) => !t.wishLink);
}

export interface WishOutcome {
  message: string;
}

/**
 * 소원을 빈다 — 소원은 이뤄지지 않고 대가를 치른다.
 * 소원이 가리키는 스탯을 '제외한' 것 중 하나가 대폭 하락하거나 돈 410만원이 깎이고,
 * 정신력도 함께 깎인다.
 */
export function grantWish(state: GameState, wishId: string): WishOutcome {
  const wish = WISHES.find((w) => w.id === wishId);
  const target = wish?.target;
  // 하락 후보: 소지금 + 모든 세부 스탯 중, 소원이 가리키는 대상은 제외
  const pool: (SkillStatId | "money")[] = (["money", ...SKILL_STAT_IDS] as (SkillStatId | "money")[])
    .filter((o) => o !== target);
  const chosen = pick(pool);

  let detail: string;
  if (chosen === "money") {
    state.money -= WISH_MONEY_PENALTY;
    detail = `통장에서 ${WISH_MONEY_PENALTY.toLocaleString("ko-KR")}원이 흔적도 없이 사라졌다`;
  } else {
    const drop = randInt(150, 250);
    state.skills[chosen] = clampSkill(state.skills[chosen] - drop);
    detail = `${SKILL_STATS[chosen].label}이(가) ${drop}이나 곤두박질쳤다`;
  }

  const mentalDrop = randInt(15, 25);
  state.resources.mental = clampResource(state.resources.mental - mentalDrop);

  return {
    message:
      `가게 주인이 음산하게 웃는다. "소원은… 원래 공짜가 아니랍니다."\n` +
      `소원은 이뤄지지 않았고, 대신 ${detail}. 정신력도 ${mentalDrop}만큼 갉아먹혔다.`,
  };
}
