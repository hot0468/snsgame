/**
 * 트윗 재미 팩 — 떡상(대박 트윗) 판정·보너스 밸런스 상수.
 *
 * 판정·연출은 systems/ui가 하고, 여기선 수치만 둔다(밸런스 조정 지점).
 */

/** 떡상 최소 팔로워 증가분(계정이 작아도 이 이상이면 떡상). */
export const DDEOKSANG_MIN = 300;

/** 떡상 판정 비율 — 증가분이 활성 계정 팔로워의 이 비율 이상이면 떡상. */
export const DDEOKSANG_RATE = 0.05;

/** 떡상 확정 시 증가분에 얹는 눈덩이 보너스 비율(1회). */
export const DDEOKSANG_BONUS_RATE = 0.3;
