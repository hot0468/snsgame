import type { GameState, SkillStatId, Tweet } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { SKILL_STATS } from "@/data/stats";
import { chance, pick, randInt, uid } from "@/utils/random";
import { gainSkill } from "./stats";

/**
 * '불법 스탯 부스트상' — 좋아요를 누르면 DM으로 링크가 오고, 뒷거래로 스탯을 사려다
 * 성공(스탯↑) 또는 사기(돈만 날림)로 갈린다(까칠한외눈 몰드). 풀 브라우저탭이 아니라
 * ui가 띄우는 모달로 스탯을 고른다.
 *
 * ⚠️ content-author: *_ACCOUNT / *_TWEET_LINES / DM 문구 / resolveBoostDeal 결과 문구가 placeholder.
 * ⚠️ ui-builder: boostLink DM 버튼 → 스탯 선택 모달 → resolveBoostDeal → consumeBoostLink.
 */

// 불법 스탯 부스트상 — '자기계발 구루'를 가장한 뒷광고 계정
export const BOOST_ACCOUNT = { name: "갓생연구소", handle: "godlife_lab" };

// 뒷광고("노력 없이 스탯 올려드림") 톤 — 은근슬쩍 광고 아닌 척
export const BOOST_TWEET_LINES = [
  "솔직히 저도 반신반의했는데요… 이거 하고 딱 3일 만에 몸이 바뀌었어요. 광고 아니고요(웃음). 궁금한 분만 조용히 좋아요.",
  "노력? 요즘 누가 그렇게 해요. 아는 사람만 아는 방법이 있어요. 정보 공유차 알려드리는 거니까, 관심 있으면 좋아요만 눌러주세요.",
  "운동·미용·지식 뭐든 며칠이면 만렙 찍어드립니다. 자세한 건 쪽지로. 좋아요가 곧 신청이에요 :)",
];

/** 뒷거래 1회 비용(30만원). */
export const BOOST_COST = 300_000;
/** 거래가 성공할 확률(나머지는 사기). */
export const BOOST_SUCCESS_CHANCE = 0.55;

/** 부스트상 트윗 하나를 만든다. */
export function makeBoostTweet(state: GameState): Tweet {
  return {
    id: uid("boosttw"),
    authorName: BOOST_ACCOUNT.name,
    authorHandle: BOOST_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(BOOST_TWEET_LINES),
    createdDay: state.day,
    likes: randInt(0, 20),
    retweets: randInt(0, 5),
    gainedFollowers: 0,
  };
}

/** 이 트윗이 부스트상 트윗인지 */
export function isBoostTweet(tweet: Tweet): boolean {
  return tweet.authorHandle === BOOST_ACCOUNT.handle;
}

/** 부스트상 트윗에 좋아요 → DM으로 링크를 보낸다(스레드가 이미 있으면 무시). */
export function spawnBoostDM(state: GameState): void {
  const account = getActiveAccount(state);
  if (account.dms.some((t) => t.boostLink)) return;
  account.dms.unshift({
    id: uid("dm"),
    partnerName: BOOST_ACCOUNT.name,
    partnerHandle: BOOST_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    messages: [
      {
        id: uid("dmm"),
        from: "partner",
        // 뒷거래 유인 DM
        text: "좋아요 감사해요! 딱 하나만 골라주세요. 운동이든 미용이든, 30만원이면 오늘 밤 안에 확 올려드립니다. 효과는 보장, 환불은 없고요 ㅎㅎ 아래에서 고르시면 돼요.",
        day: state.day,
      },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    boostLink: true,
  });
}

/** 거래를 마치면 boostLink 스레드를 제거한다(재거래 불가). */
export function consumeBoostLink(state: GameState): void {
  const account = getActiveAccount(state);
  account.dms = account.dms.filter((t) => !t.boostLink);
}

export interface BoostResult {
  message: string;
  scammed: boolean;
}

/**
 * 스탯 하나를 골라 뒷거래한다 — 비용은 무조건 지불되고,
 * 55% 성공(해당 스킬 +150~250) / 45% 사기(돈만 날림).
 * ⚠️ ui가 소지금·스탯 선택을 게이팅한다(여기선 비용을 무조건 깐다).
 */
export function resolveBoostDeal(state: GameState, stat: SkillStatId): BoostResult {
  state.money -= BOOST_COST;
  if (chance(BOOST_SUCCESS_CHANCE)) {
    // flat: 30만원을 이미 지불했고 "확 올려드립니다"라는 확정 지급 거래다. 노력 없는 지름길이라
    // 컨디션(정신력)과 무관하다는 것이 이 뒷거래의 성격이기도 하다.
    // ⚠️ 문구에는 선언값이 아니라 실제 반영 델타를 쓴다(999 상한에 잘린 만큼도 반영된다).
    const gain = gainSkill(state, stat, randInt(150, 250), { flat: true });
    // 성공 서사
    return {
      message: `거래 성공! 다음 날 아침, 정말로 ${SKILL_STATS[stat].label}이(가) ${gain}이나 뛰어 있었다. 어떻게 한 건지는 묻지 않기로 했다.`,
      scammed: false,
    };
  }
  // 사기 서사
  return {
    message: `읽씹. 계정은 사라졌고 링크도 죽었다. ${BOOST_COST.toLocaleString("ko-KR")}원과 함께, '노력 없는 성공' 같은 건 없다는 교훈만 남았다.`,
    scammed: true,
  };
}
