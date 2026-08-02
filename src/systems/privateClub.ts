import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import type { ClubScenario } from "@/data/privateClub";
import { CLUB_NAME, CLUB_SCENARIOS } from "@/data/privateClub";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { scheduleNextPrivateClub } from "./appointments";
import { applyEffect } from "./events";
import { PERVERT_GAIN_RATIO } from "./adultOffline";
import { clampAction, gainSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 비공개 클럽 '더 체임버' — 체벌 위주 SM 정기 세션.
 *
 * ⚠️ **러닝크루(systems/crew.ts)와 완전히 별개다.** 그쪽의 '비공개 엘리트 러닝크루'는
 *    훈련 미달을 빌미로 한 운동 기반 규율이고, 이쪽은 운동과 무관한 순수 체벌 모임이다.
 *    상태 플래그·일정·시나리오·행동력 비용을 하나도 공유하지 않는다.
 *    (처음엔 러닝크루의 하위 개념으로 얹었다가 "다른 모임"이라 갈라냈다.)
 *
 * - **유입**: 체벌(punish) 트윗을 문턱 이상 올리면 확률적으로 초대 DM이 온다.
 *   러닝크루 가입 여부를 보지 않는다 — 운동을 안 하는 플레이어도 도달할 수 있어야 한다.
 * - **세션**: 매주 화요일 심야(`appointments`의 `privateClub` 약속).
 * - **효과**: 화제성이 없어 팔로워·수입이 없다. lewd·pervert 중심.
 */

/** 초대 DM이 뜨는 체벌 트윗 누적 문턱 */
export const CLUB_PUNISH_THRESHOLD = 10;

/** 체벌 트윗 직후 초대 DM이 올 확률 */
export const CLUB_DM_CHANCE = 0.6;

/** 세션 1회 행동력 소모 — 밤을 통째로 쓰는 자리라 러닝 정기런(8)보다 무겁다. */
export const CLUB_SESSION_ACTION_COST = 12;

const CLUB_OPENERS = [
  `그쪽 글, 계속 보고 있었어요. 취향이 확실하시더군요 🔞 저희 ${CLUB_NAME}는 매주 화요일에 모입니다. 규칙을 지킬 수 있는 분만 받아요.`,
  `글로만 쓰는 걸로 만족되던가요? ${CLUB_NAME}는 실제로 합니다. 안전어부터 정하고 시작하는 곳이에요. 자리 하나 비었습니다.`,
  `${CLUB_NAME}에서 연락드립니다. 비공개 모임이고, 들어오시면 매주 세션이 있어요. 촬영 금지·중단 자유, 그 두 가지가 저희 규칙의 전부입니다.`,
];

function hasClubInvite(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.privateClub);
}

/**
 * 체벌 트윗을 올린 직후, 문턱을 넘었으면 확률적으로 초대 DM을 만든다.
 *
 * ⚠️ **러닝크루 가입 여부를 안 본다.** 그게 이 모임이 러닝과 다른 지점이다.
 */
export function maybeSpawnClubDM(state: GameState): boolean {
  if (!state.adultMode) return false;
  if (state.privateClubJoined) return false;
  if (state.punishTweetsPosted < CLUB_PUNISH_THRESHOLD) return false;
  const account = getActiveAccount(state);
  if (hasClubInvite(account)) return false;
  if (!chance(CLUB_DM_CHANCE)) return false;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: CLUB_NAME,
    partnerHandle: "the_chamber",
    attribute: "adult",
    isAdult: true,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(CLUB_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    privateClub: true,
  });
  addSchedule(state, `${CLUB_NAME} 초대 DM`, "sns");
  return true;
}

/** 클럽에 가입한다. 다음 화요일 심야부터 세션이 열린다. */
export function joinPrivateClub(state: GameState): void {
  state.privateClubJoined = true;
  scheduleNextPrivateClub(state);
  addSchedule(state, `${CLUB_NAME} 가입`, "system");
}

/** 초대 수락(가입 + 스레드 플래그 해제 + 안내 메시지). */
export function acceptClubInvite(state: GameState, thread: DMThread): void {
  joinPrivateClub(state);
  thread.privateClub = false;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text:
      "환영합니다 🔞 매주 화요일 심야, 장소는 당일에 문자로 보내드려요. " +
      "정하신 안전어는 언제든 쓰실 수 있습니다 — 말하는 순간 멈춥니다.",
    day: state.day,
  });
  thread.unread = true;
}

/** 초대 거절(플래그만 해제 — 재제의 없음). */
export function declineClubInvite(state: GameState, thread: DMThread): void {
  thread.privateClub = false;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "알겠습니다. 마음이 바뀌면 그때 연락 주세요. 자리는 늘 있으니까요.",
    day: state.day,
  });
  thread.unread = true;
}

/** 이번 세션에 표출할 시나리오를 랜덤으로 고른다(반복 허용). */
export function pickClubScenario(): ClubScenario {
  return pick(CLUB_SCENARIOS);
}

/**
 * 세션 시나리오의 선택을 확정한다.
 *
 * ⚠️ **다음 주를 먼저 재예약한다.** 빼먹으면 세션 사이클이 끊겨 모임이 영영 안 열린다
 *    (resolveCrewRun과 같은 순서).
 * @returns 결과 문구(customKey 동적 문구가 있으면 그것, 없으면 choice.result)
 */
export function resolveClubSession(
  state: GameState,
  scenario: ClubScenario,
  choiceIndex: number,
): string {
  const choice = scenario.choices[choiceIndex];
  if (!choice) return "";
  scheduleNextPrivateClub(state);
  const dynamic = applyEffect(state, choice.effect);
  // 음란이 오른 선택은 변태력도 함께 올린다 — adultOffline과 같은 규칙.
  // 시나리오가 pervert를 직접 선언한 경우엔 그쪽이 이미 적용됐으므로 파생분만 얹는다.
  const lewd = choice.effect.skills?.lewd ?? 0;
  if (lewd > 0) gainSkill(state, "pervert", Math.round(lewd * PERVERT_GAIN_RATIO));
  state.resources.action = clampAction(
    state,
    state.resources.action - CLUB_SESSION_ACTION_COST,
  );
  addSchedule(state, `${CLUB_NAME} 세션`, "offline");
  advanceTime(state, 1);
  return dynamic || choice.result;
}
