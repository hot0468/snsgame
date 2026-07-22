import type { Email, GameState, ScheduleEvent, Tweet } from "@/core/types";
import { getActiveAccount, pushTimeline } from "@/core/state";
import { chance, pick, randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampResource } from "./stats";

/**
 * 스팸(피싱) 메일.
 * - 피메일 수신함에 간간이 스팸이 들어온다(하루 확률).
 * - 스팸 메일을 클릭(열람)하면 낮은 확률로 트위터 계정이 해킹당한다.
 */

/** 하루에 스팸 메일이 올 확률 */
export const SPAM_EMAIL_CHANCE = 0.25;
/** 안 읽은 스팸이 이 개수 이상이면 더 안 온다(수신함 폭주 방지) */
const SPAM_MAX_UNREAD = 3;
/** 스팸 메일 열람 시 해킹당할 확률 */
export const SPAM_HACK_CHANCE = 0.15;

interface SpamTemplate {
  from: string;
  subject: string;
  body: string;
}

const SPAM_TEMPLATES: SpamTemplate[] = [
  {
    from: "국제 물류센터",
    subject: "[긴급] 고객님의 택배가 배송 보류 중입니다",
    body:
      "고객님, 주소 정보 불일치로 택배가 보류되었습니다.\n\n" +
      "아래 링크에서 24시간 내에 정보를 확인하지 않으면 반송 처리됩니다.\n" +
      "▶ 배송정보 확인하기: http://parcel-check.verify-track.co",
  },
  {
    from: "네이놈 보안팀",
    subject: "[보안경고] 회원님 계정에 비정상 로그인 감지",
    body:
      "회원님의 계정에서 해외 IP 로그인이 감지되었습니다.\n\n" +
      "본인이 아니라면 즉시 아래 링크에서 비밀번호를 변경하세요.\n" +
      "▶ 계정 보호하기: http://naenom-secure.account-verify.net",
  },
  {
    from: "당첨자 관리센터",
    subject: "🎉 축하합니다! 최신형 스마트폰 당첨 안내",
    body:
      "회원님이 이달의 경품 이벤트에 당첨되셨습니다!\n\n" +
      "배송비 결제 및 수령 정보 입력만 하시면 됩니다. 지금 바로 확인하세요.\n" +
      "▶ 경품 수령하기: http://event-win.free-gift.link",
  },
  {
    from: "코인거래소 고객지원",
    subject: "[입금완료] 0.42 BTC 출금 요청이 접수되었습니다",
    body:
      "회원님 지갑에서 0.42 BTC 출금이 요청되었습니다.\n\n" +
      "본인이 요청하지 않았다면 아래 링크에서 즉시 취소하세요.\n" +
      "▶ 출금 취소하기: http://wallet-guard.crypto-secure.io",
  },
  {
    from: "카드사 안내",
    subject: "[안내] 해외 결제 승인 5구간 확인 요청",
    body:
      "고객님 명의 카드로 해외 가맹점 결제가 승인되었습니다.\n\n" +
      "결제 내역이 다르다면 아래 링크에서 이의신청하세요.\n" +
      "▶ 결제내역 확인: http://card-center.payment-check.co",
  },
];

/** 스팸 템플릿 하나로 미열람 스팸 메일 객체를 만든다. */
function makeSpamEmail(state: GameState): Email {
  const t = pick(SPAM_TEMPLATES);
  return {
    id: uid("mail"),
    from: t.from,
    subject: t.subject,
    body: t.body,
    day: state.day,
    read: false,
    spam: true,
  };
}

/** 하루가 지날 때 확률적으로 스팸 메일을 수신함에 넣는다(time.onNewDay에서 호출). */
export function maybeSpawnSpamEmail(state: GameState): void {
  const unreadSpam = state.emails.filter((e) => e.spam && !e.read).length;
  if (unreadSpam >= SPAM_MAX_UNREAD) return;
  if (!chance(SPAM_EMAIL_CHANCE)) return;
  state.emails.unshift(makeSpamEmail(state));
}

/**
 * 스팸 메일 count통을 수신함에 강제로 밀어넣는다(피싱 결과 등 하루 확률·미열람 상한을 무시).
 * 심리테스트 피싱(psychoTest.resolvePsychoTest)에서 사용한다.
 */
export function spawnSpamEmails(state: GameState, count: number): void {
  for (let i = 0; i < count; i++) state.emails.unshift(makeSpamEmail(state));
}

function pushSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  state.schedule.push({ id: uid("sch"), day: state.day, title, kind });
}

const HACK_TWEETS = [
  "【이벤트】 지금 이 링크 클릭하면 아이폰 무료 증정! 선착순 마감 임박 👉 http://free-iphone.win",
  "팔로워분들께 특별 혜택! 무료 기프티콘 나눔 중이에요 지금 신청 👉 http://gift-drop.link",
  "재테크 비법 무료 공개합니다 이 계정 DM 주세요 원금 보장 투자처 알려드림",
];

/** 계정 해킹 피해를 입힌다(팔로워 감소 + 스팸 트윗 도배 + 정신력 하락). @returns 잃은 팔로워 수 */
function getHacked(state: GameState): number {
  const acc = getActiveAccount(state);
  const loss = Math.max(20, Math.round(acc.followers * 0.15));
  changeFollowers(state, -loss);
  state.resources.mental = clampResource(state.resources.mental - 12);

  // 해커가 내 계정으로 스팸 트윗을 올린다
  const tweet: Tweet = {
    id: uid("tweet"),
    authorName: acc.name,
    authorHandle: acc.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(HACK_TWEETS),
    createdDay: state.day,
    likes: randInt(0, 40),
    retweets: randInt(0, 20),
    gainedFollowers: 0,
    isAd: true,
  };
  pushTimeline(acc, tweet);

  pushSchedule(state, `계정 해킹 피해 (-${loss} 팔로워)`, "system");
  return loss;
}

export interface SpamOpenResult {
  hacked: boolean;
  followerLoss: number;
}

/**
 * 스팸 메일을 열람했을 때 — 낮은 확률로 계정이 해킹당한다.
 * (해킹 판정은 최초 열람 1회만; 호출부에서 처음 열 때만 부른다)
 */
export function openSpamEmail(state: GameState, emailId: string): SpamOpenResult {
  const email = state.emails.find((e) => e.id === emailId);
  if (!email?.spam) return { hacked: false, followerLoss: 0 };
  if (chance(SPAM_HACK_CHANCE)) {
    const loss = getHacked(state);
    return { hacked: true, followerLoss: loss };
  }
  return { hacked: false, followerLoss: 0 };
}
