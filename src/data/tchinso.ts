/**
 * 트친소(트친 소개) — 트윗/응답 문구·상수.
 * 판정은 systems/tchin이 한다. 사교 목적이라 팔로워 효과는 미미.
 */

/** 트친소 재게시 쿨다운(일). */
export const TCHINSO_COOLDOWN_DAYS = 7;
/** 응답 계정 1건당 선채움되는 트친 진행도 최소치. */
export const TCHINSO_PREFILL_MIN = 2;
/** 응답 계정 1건당 선채움되는 트친 진행도 최대치. */
export const TCHINSO_PREFILL_MAX = 3;
/** 트친소 트윗에 붙는 응답 계정 수 최소치. */
export const TCHINSO_RESP_MIN = 2;
/** 트친소 트윗에 붙는 응답 계정 수 최대치(친화력 보정 전). */
export const TCHINSO_RESP_MAX = 4;

/** 트친소 트윗 본문 풀. */
export const TCHINSO_TWEET_TEXT: string[] = [
  "트친 구합니다! 맞팔 소통해요 서로 챙겨주는 사이 되고 싶어요 🙌",
  "트친소 올려요~ 취향 비슷한 분들 저요 눌러주세요!",
  "조용히 트친 모집... 같이 타임라인 데워요 ☕",
];

/** 응답 계정이 다는 답글 풀. */
export const TCHINSO_REPLY_LINES: string[] = [
  "저요! 트친해요 앞으로 잘 부탁드려요 :)",
  "오 저랑 결 비슷하신 듯 맞팔 갑니다!",
  "트친 신청이요~ 자주 소통해요!",
  "저도 트친 구하고 있었어요 반가워요 🤝",
];
