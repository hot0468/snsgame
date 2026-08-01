import type { DMThread, Email, GameState } from "@/core/types";
import { JOB_RESULT_TWEETS, STUDY_INVITE, STUDY_MEET_LINES } from "@/data/studyGroup";
import { getActiveAccount } from "@/core/state";
import { pick, randInt, uid } from "@/utils/random";
import { postTweet, type PostTweetResult } from "./tweetSystem";
import { scheduleNextStudy } from "./appointments";
import { addSchedule, advanceTime } from "./time";
import { clampAction, clampMental, gainSkill } from "./stats";

/**
 * 취업스터디 모임 흐름.
 * - 채용 결과 메일(합격/불합격)을 트윗할 수 있다(메일당 1회).
 * - 불합격 결과를 문턱 이상 트윗하면 DM으로 취업스터디 가입 권유가 온다.
 * - 가입하면 매주 월요일 낮 정기 모임 약속이 잡힌다(스케줄러는 appointments.ts).
 * - 참석하면 친화력·어휘력·지식이 소폭 오른다.
 *
 * 크루(crew.ts) 패턴 그대로 — 스케줄러/불참 처리는 appointments.ts에, 유입/가입/참석은 여기.
 */

/** 취업스터디 가입 권유가 뜨는 불합격 결과 트윗 누적 문턱 */
export const STUDY_REJECTION_THRESHOLD = 3;

/** 스터디 참석 시 행동력 소모(정기 일정이라 일반 활동보다 적다) */
export const STUDY_ACTION_COST = 10;

/**
 * 채용 결과 메일을 트윗한다(메일당 1회 — jobResult.tweeted).
 * 불합격이면 rejectionTweets를 올리고 곧바로 스터디 DM 유입을 판정한다.
 * @returns 게시 결과(PostTweetResult). 이미 트윗했거나 결과 메일이 아니면 null.
 */
export function tweetJobResult(state: GameState, email: Email): PostTweetResult | null {
  const jr = email.jobResult;
  if (!jr || jr.tweeted) return null;
  const text = pick(jr.hired ? JOB_RESULT_TWEETS.hired : JOB_RESULT_TWEETS.rejected);
  const result = postTweet(state, "daily", text, false);
  jr.tweeted = true;
  if (!jr.hired) {
    state.rejectionTweets += 1;
    maybeSpawnStudyDM(state);
  }
  return result;
}

/** 이 계정에 이미 취업스터디 초대 스레드가 있는지 */
function hasStudyInvite(state: GameState): boolean {
  return getActiveAccount(state).dms.some((t) => t.study);
}

/**
 * 지금 스터디 가입 권유 DM을 띄울 조건.
 * 불합격 결과 트윗 문턱 이상 + 미가입 + 아직 초대 스레드 없음.
 */
export function canOfferStudy(state: GameState): boolean {
  return (
    state.rejectionTweets >= STUDY_REJECTION_THRESHOLD &&
    !state.studyJoined &&
    !hasStudyInvite(state)
  );
}

/**
 * 조건을 충족하면 취업스터디 가입 권유 DM을 1회 생성한다(확률 없이 결정론적).
 * 불합격 결과 트윗 직후 tweetJobResult가 호출한다.
 * @returns 생성되면 true
 */
export function maybeSpawnStudyDM(state: GameState): boolean {
  if (!canOfferStudy(state)) return false;
  getActiveAccount(state).dms.unshift({
    id: uid("dm"),
    partnerName: STUDY_INVITE.title,
    partnerHandle: "job_study",
    attribute: "daily",
    isAdult: false,
    messages: STUDY_INVITE.pages.map((text) => ({
      id: uid("dmm"),
      from: "partner" as const,
      text,
      day: state.day,
    })),
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    study: true,
  });
  return true;
}

/**
 * 취업스터디에 가입한다. 다음 월요일 낮부터 정기 모임 약속이 잡힌다.
 * 초대 스레드에 운영자가 환영 메시지를 남긴다.
 */
export function joinStudy(state: GameState, thread: DMThread): void {
  state.studyJoined = true;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: STUDY_INVITE.welcome,
    day: state.day,
  });
  thread.unread = true;
  addSchedule(state, "취업스터디 모임 가입", "system");
  scheduleNextStudy(state);
}

/**
 * 이번 스터디 참석을 처리한다(appointmentModal '간다' 경로가 호출).
 * 친화력·어휘력·지식 소폭 상승 + 행동력 소모 + 하루 진행 + 다음 주 재예약.
 * 재예약을 빼먹으면 정기 사이클이 끊긴다(crew resolveCrewRun 패턴).
 * @returns 결과 문구(STUDY_MEET_LINES에서 선택)
 */
export function resolveStudy(state: GameState): string {
  // 정기 일정이므로 다음 주를 먼저 다시 잡는다(resolveCrewRun과 동일 순서).
  scheduleNextStudy(state);
  // 정기 육성 활동 — gainSkill 관문으로 정신력 배율·상단 감쇠를 받는다.
  gainSkill(state, "sociability", randInt(8, 12));
  gainSkill(state, "vocabulary", randInt(8, 12));
  gainSkill(state, "knowledge", randInt(8, 12));
  state.resources.action = clampAction(state, state.resources.action - STUDY_ACTION_COST);
  state.resources.mental = clampMental(state, state.resources.mental + 4);
  addSchedule(state, "취업스터디 모임", "offline");
  advanceTime(state, 1);
  return pick(STUDY_MEET_LINES);
}
