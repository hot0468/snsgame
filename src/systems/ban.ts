import type { GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { uid } from "@/utils/random";
import { pushKakao } from "./kakao";

/**
 * 계정 정지(밴) 시스템.
 * - 사기 트윗·악질 논란 대응 등으로 경고(strike)가 쌓인다.
 * - 경고가 한계에 도달하면 계정이 며칠간 정지되어 게시·활동이 막힌다.
 */

/** 정지되는 경고 누적 횟수 */
export const STRIKE_BAN_THRESHOLD = 3;
/** 정지 기간(일) */
export const BAN_DAYS = 3;

function pushSchedule(state: GameState, title: string): void {
  state.schedule.push({ id: uid("sch"), day: state.day, title, kind: "system" });
}

/**
 * 활성 계정에 경고를 누적한다. 한계에 도달하면 계정을 정지시킨다.
 * @returns 이번에 정지됐으면 true
 */
export function addStrike(state: GameState, n = 1): boolean {
  const acc = getActiveAccount(state);
  acc.strikes = (acc.strikes ?? 0) + n;
  if (acc.strikes < STRIKE_BAN_THRESHOLD) return false;

  acc.strikes = 0;
  acc.suspendedUntilDay = state.day + BAN_DAYS;
  pushKakao(
    state,
    "트위터 운영팀",
    [
      "[운영팀] 계정 이용 제한 안내",
      `커뮤니티 규정 위반이 반복 확인되어 계정이 ${BAN_DAYS}일간 정지되었습니다.`,
      "정지 기간에는 게시·탐색 등 활동이 제한됩니다.",
    ],
    { hue: 0 },
  );
  pushSchedule(state, `계정 정지 (${BAN_DAYS}일)`);
  return true;
}

/** 정지 기간이 끝난 계정을 해제한다(매일 호출). */
export function expireSuspensions(state: GameState): void {
  for (const acc of state.accounts) {
    if ((acc.suspendedUntilDay ?? 0) > 0 && state.day >= acc.suspendedUntilDay) {
      acc.suspendedUntilDay = 0;
      acc.strikes = 0;
      pushKakao(
        state,
        "트위터 운영팀",
        [
          "[운영팀] 계정 정지 해제",
          `${acc.name} 계정의 이용 제한이 해제되었습니다.`,
          "규정을 지켜 활동해주세요.",
        ],
        { hue: 120 },
      );
    }
  }
}
