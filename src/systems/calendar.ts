/**
 * 순수 달력/요일 계산 헬퍼(게임 상태·다른 시스템에 비의존).
 * time.ts와 economy.ts 등이 서로를 import하며 순환하지 않도록 여기로 분리한다.
 */

/** 게임 시작일 = 2026년 6월 1일(월요일) */
const START_DATE = new Date(2026, 5, 1); // 월 인덱스 5 = 6월, 1일

/** day(1부터) → 해당 날짜의 Date */
export function dateOf(day: number): Date {
  const d = new Date(START_DATE);
  d.setDate(d.getDate() + (day - 1));
  return d;
}

/** day(1부터) → 실제 날짜 라벨. 시작일은 6월 1일. */
export function dateLabel(day: number): string {
  const d = dateOf(day);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

/** 요일 인덱스(0=일 … 4=목 … 6=토) */
export function dayOfWeek(day: number): number {
  return dateOf(day).getDay();
}

const WEEKDAY_NAMES = ["일", "월", "화", "수", "목", "금", "토"];

/** day(1부터) → 요일 한 글자 라벨 (예: "수") */
export function weekdayLabel(day: number): string {
  return WEEKDAY_NAMES[dayOfWeek(day)] ?? "";
}

/** 월요일 요일 인덱스(취업스터디 정기 모임 등) */
export const MONDAY = 1;
/** 화요일 요일 인덱스(에스테틱 정기권 방문 등) */
export const TUESDAY = 2;
/** 수요일 요일 인덱스(란제리 전속 화보 정기 촬영 등) */
export const WEDNESDAY = 3;
/** 목요일 요일 인덱스 */
export const THURSDAY = 4;
/** 토요일 요일 인덱스(성인 그룹방 정기 모임 등) */
export const SATURDAY = 6;

/** 평일(월~금)인지 */
export function isWeekday(day: number): boolean {
  const d = dayOfWeek(day);
  return d >= 1 && d <= 5;
}

/** 게임 시작(월요일)을 기준으로 한 주 인덱스(0부터). 같은 주는 같은 값. */
export function weekIndex(day: number): number {
  return Math.floor((day - 1) / 7);
}

/** 실제 달력상의 '일'(1~31) */
export function dateOfMonth(day: number): number {
  return dateOf(day).getDate();
}

/** 달 키(연*12+월 인덱스) — 달 비교용 */
export function monthKey(day: number): number {
  const d = dateOf(day);
  return d.getFullYear() * 12 + d.getMonth();
}

/** 해당 day가 그 달의 마지막 날인지(다음 날이 다른 달이면 마지막 날) */
export function isLastDayOfMonth(day: number): boolean {
  return monthKey(day) !== monthKey(day + 1);
}
