import type { GameState, Tweet } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { pick, randInt, uid } from "@/utils/random";
import { spawnSpamEmails } from "./spam";
import { clampResource } from "./stats";

/**
 * '의문의 심리테스트' — 좋아요를 누르면 DM으로 링크가 오고, '결과 보기'를 누르면
 * 개인정보가 털려 스팸(피싱) 메일이 폭탄처럼 유입된다(까칠한외눈 몰드).
 *
 * ⚠️ content-author: *_ACCOUNT / *_TWEET_LINES / DM 문구 / resolvePsychoTest 결과 문구가 placeholder.
 * ⚠️ ui-builder: psychoLink DM 버튼('결과 보기') → resolvePsychoTest → toast.
 */

// 의문의 심리테스트 — SNS 낚시 심테 계정 패러디(피싱)
export const PSYCHO_ACCOUNT = { name: "숨은성격연구소", handle: "hidden_you_lab" };

// 성격 유형 낚시 유인 트윗 문구
export const PSYCHO_TWEET_LINES = [
  "【무료·1분컷】 당신의 숨은 성격 유형은? 참여자 98%가 '소름 돋게 정확하다'고 한 그 테스트. 궁금하면 좋아요.",
  "MBTI로는 절대 못 잡아내는 '진짜 나'. 12가지 숨은 유형 중 당신은 어느 쪽? 좋아요 누르면 결과 링크 드려요.",
  "당신의 전생 직업 + 연애 스타일 완벽 분석! 이 트윗 좋아요 누른 분께만 조용히 링크 보내드립니다.",
];

/** 심리테스트 트윗 하나를 만든다. */
export function makePsychoTweet(state: GameState): Tweet {
  return {
    id: uid("psychotw"),
    authorName: PSYCHO_ACCOUNT.name,
    authorHandle: PSYCHO_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(PSYCHO_TWEET_LINES),
    createdDay: state.day,
    likes: randInt(0, 50),
    retweets: randInt(0, 15),
    gainedFollowers: 0,
  };
}

/** 이 트윗이 심리테스트 트윗인지 */
export function isPsychoTweet(tweet: Tweet): boolean {
  return tweet.authorHandle === PSYCHO_ACCOUNT.handle;
}

/** 심리테스트 트윗에 좋아요 → DM으로 링크를 보낸다(스레드가 이미 있으면 무시). */
export function spawnPsychoDM(state: GameState): void {
  const account = getActiveAccount(state);
  if (account.dms.some((t) => t.psychoLink)) return;
  account.dms.unshift({
    id: uid("dm"),
    partnerName: PSYCHO_ACCOUNT.name,
    partnerHandle: PSYCHO_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    messages: [
      {
        id: uid("dmm"),
        from: "partner",
        // 링크 유인 DM(개인정보 요구 낌새)
        text: "좋아요 감사해요! 아래 링크에서 결과 확인하시면 돼요. 이름·생년월일·연락처만 입력하면 끝! 정확한 분석을 위해 꼭 실명으로 부탁드려요 :)",
        day: state.day,
      },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    psychoLink: true,
  });
}

/**
 * '결과 보기'를 눌러 피싱에 걸린다 — 스팸 메일 2~3통 즉시 유입 + 정신력 하락.
 * 링크 스레드도 함께 소비한다(재방문 불가).
 * @returns 표시용 결과 문구(placeholder — content-author 교체)
 */
export function resolvePsychoTest(state: GameState): string {
  const count = randInt(2, 3);
  spawnSpamEmails(state, count);
  state.resources.mental = clampResource(state.resources.mental - randInt(8, 15));
  // 링크 소비(재방문 불가)
  const account = getActiveAccount(state);
  account.dms = account.dms.filter((t) => !t.psychoLink);
  // 피싱 결과 서사(개인정보 유출)
  return `'가장 잘 어울리는 유형은…' 결과 창이 뜨기도 전에, 낯선 메일 ${count}통이 한꺼번에 쏟아졌다. 이름도 생년월일도… 넘겨버린 뒤였다.`;
}
