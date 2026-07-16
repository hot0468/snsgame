import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { addSchedule } from "./time";
import { scheduleNextCrewRun } from "./appointments";

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
