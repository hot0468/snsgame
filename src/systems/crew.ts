import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import type { CrewSecretScenario } from "@/data/crewSecret";
import { CREW_SECRET_SCENARIOS } from "@/data/crewSecret";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { addSchedule, advanceTime } from "./time";
import { applyEffect } from "./events";
import { clampAction } from "./stats";
import { CREW_RUN_ACTION_COST, scheduleNextCrewRun } from "./appointments";

/**
 * 러닝크루 가입 흐름.
 * - 운동(fitness) 트윗을 올리면 확률적으로 가입 권유 DM이 온다.
 * - 가입하면 매주 목요일 저녁 정기런 약속이 잡힌다(실제 정기런 처리는 appointments.ts).
 */

/** 운동 트윗 직후 크루 초대 DM이 올 확률 */
export const CREW_DM_CHANCE = 0.5;

const CREW_NAMES = ["한강 러닝크루", "새벽별 러닝크루", "달리는 사람들", "런하이 크루"];

const CREW_OPENERS = [
  "안녕하세요! 운동 트윗 보고 연락드려요 🏃 저희 러닝크루에서 같이 뛰실래요? 매주 목요일 저녁에 가볍게 모여요!",
  "혹시 러닝 관심 있으세요? 트윗 보니 딱 저희 크루랑 잘 맞으실 것 같아서요! 목요일 저녁마다 함께 달려요 :)",
  "운동 열심히 하시네요! 저희 크루 들어오시면 혼자보다 훨씬 꾸준히 뛸 수 있어요. 매주 목요일 저녁 정기런 있어요!",
];

/** 이 계정에 이미 러닝크루 초대 스레드가 있는지 */
function hasCrewInvite(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.crew);
}

/**
 * 운동 트윗 직후 확률적으로 러닝크루 가입 권유 DM을 생성한다.
 * 이미 가입했거나, 이 계정에 초대 스레드가 있으면 생성하지 않는다.
 * @returns 생성되면 true
 */
export function maybeSpawnCrewInviteDM(state: GameState): boolean {
  if (state.crewJoined) return false;
  const account = getActiveAccount(state);
  if (hasCrewInvite(account)) return false;
  if (!chance(CREW_DM_CHANCE)) return false;

  const name = pick(CREW_NAMES);
  account.dms.unshift({
    id: uid("dm"),
    partnerName: name,
    partnerHandle: "run_crew",
    attribute: "fitness",
    isAdult: false,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(CREW_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    crew: true,
  });
  return true;
}

/**
 * 러닝크루에 가입한다. 다음 목요일 저녁부터 정기런 약속이 잡힌다.
 * 초대 스레드에 방장이 환영 메시지를 남긴다.
 */
export function joinCrew(state: GameState, thread: DMThread): void {
  state.crewJoined = true;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "환영해요! 🎉 이제 우리 크루원이에요. 매주 목요일 저녁 정기런 잊지 말고 나와요, 기다릴게요 🏃‍♀️",
    day: state.day,
  });
  thread.unread = true;
  addSchedule(state, "러닝크루 가입", "system");
  scheduleNextCrewRun(state);
}

/* ─────────────────── 비공개 엘리트 크루(SM 규율) ─────────────────── */

/** 비공개 크루 가입 권유가 뜨는 체벌 트윗 누적 문턱 */
export const PRIVATE_CREW_PUNISH_THRESHOLD = 10;

/**
 * 이번 정기런에서 비공개 엘리트 크루 가입을 권유할 조건.
 * 크루원이면서 성인모드이고, 체벌 트윗을 문턱 이상 올렸으며, 아직 미가입.
 */
export function canOfferPrivateCrew(state: GameState): boolean {
  return (
    state.crewJoined &&
    state.adultMode &&
    state.punishTweetsPosted >= PRIVATE_CREW_PUNISH_THRESHOLD &&
    !state.privateCrewJoined
  );
}

/**
 * 비공개 엘리트 크루(SM 규율)에 가입한다.
 * 오늘 런은 일반으로 진행되고, 다음 정기런부터 규율 시나리오가 랜덤 표출된다.
 * (초대 서사·환영 문구는 ui가 PRIVATE_CREW_INVITE로 표시한다 — 여기선 상태만 확정.)
 */
export function joinPrivateCrew(state: GameState): void {
  state.privateCrewJoined = true;
  addSchedule(state, "비공개 엘리트 러닝크루 가입", "system");
}

/** 정기런에 표출할 규율 시나리오를 랜덤으로 고른다(반복 허용 — seen 제외 없음). */
export function pickCrewSecretScenario(): CrewSecretScenario {
  return pick(CREW_SECRET_SCENARIOS);
}

/**
 * 비공개 크루 규율 시나리오의 선택을 확정한다(정기런 처리).
 * savanna resolveSavannaIntrusion 패턴 — 효과 적용 + 정기런 행동력 소모 +
 * 하루 진행 + 다음 주 정기런 재예약. 재예약을 빼먹으면 정기런 사이클이 끊긴다.
 * @returns 결과 문구(customKey 동적 문구가 있으면 그것, 없으면 choice.result)
 */
export function resolveCrewSecret(
  state: GameState,
  scenario: CrewSecretScenario,
  choiceIndex: number,
): string {
  const choice = scenario.choices[choiceIndex];
  if (!choice) return "";
  // 정기 일정이므로 다음 주를 먼저 다시 잡는다(resolveCrewRun과 동일 순서).
  scheduleNextCrewRun(state);
  const dynamic = applyEffect(state, choice.effect);
  state.resources.action = clampAction(state, state.resources.action - CREW_RUN_ACTION_COST);
  addSchedule(state, "비공개 크루 정기런", "offline");
  advanceTime(state, 1);
  return dynamic || choice.result;
}
