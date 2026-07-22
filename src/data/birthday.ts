/**
 * 트친 생일 — 카톡/축하 문구·생일 범위·보너스 상수.
 * 생일 날짜는 systems/tchin이 hashInt(handle)로 결정론 산출. 놓쳐도 무해(보너스만).
 * 판정·게시는 systems가 한다. 실존 인물/상표 패러디 금지, 한국어 창작 톤.
 */

/** 트친 성사 시점 기준, 생일까지 최소 며칠. */
export const BIRTHDAY_MIN_DAYS = 30;
/** 트친 성사 시점 기준, 생일까지 최대 며칠. */
export const BIRTHDAY_MAX_DAYS = 120;
/** 축하 트윗 보너스 팔로워 최소치. */
export const BIRTHDAY_BONUS_MIN = 15;
/** 축하 트윗 보너스 팔로워 최대치. */
export const BIRTHDAY_BONUS_MAX = 60;

/** 생일 당일 아침 카톡 알림 문구(달력이 보낸다). */
export const BIRTHDAY_KAKAO_LINES: string[] = [
  "오늘 트친 생일이래요! 축하 한마디 남겨보는 건 어때요? 🎂",
  "달력 보니 오늘 그 트친 생일이네요 🎉",
  "잊지 마요~ 오늘 트친 생일! 짧게라도 축하해주면 좋아할 거예요 🥳",
];

/** 축하 트윗 문구. {handle}=대상 트친 핸들. */
export const BIRTHDAY_TWEET_LINES: string[] = [
  "@{handle} 생일 축하해요!! 오늘 하루 완전 행복하길 🎂🎉",
  "우리 트친 @{handle} 생일이래요 다들 축하해줍시다 🥳",
  "@{handle}님 생신 축하드려요~ 좋은 일만 가득하시길 🎁",
];
