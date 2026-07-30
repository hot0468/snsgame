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

/** 연속 트윗 콤보 — 같은 갈래를 연달아 올릴 때 1연타당 붙는 도달 보너스. */
export const COMBO_BONUS_RATE = 0.1;

/** 콤보 상한 연타 수(이 이상은 배수도 논란도 더 안 오른다). */
export const COMBO_MAX_STEP = 4;

/** 콤보 1연타당 추가되는 논란 확률 — 같은 얘기만 반복하면 물리는 대가. */
export const COMBO_CONTROVERSY_RATE = 0.05;
