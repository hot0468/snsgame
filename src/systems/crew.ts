import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import type { CrewSecretScenario } from "@/data/crewSecret";
import { CREW_SECRET_SCENARIOS } from "@/data/crewSecret";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { addSchedule, advanceTime } from "./time";
import { applyEffect } from "./events";
import { clampAction, gainSkill } from "./stats";
import { PERVERT_GAIN_RATIO } from "./adultOffline";
import {
  CREW_RUN_ACTION_COST,
  scheduleNextCrewRun,
  scheduleNextPrivateClub,
} from "./appointments";

/**
 * 러닝크루 가입 흐름.
 * - 운동(fitness) 트윗을 올리면 확률적으로 가입 권유 DM이 온다.
 * - 가입하면 매주 목요일 낮 정기런 약속이 잡힌다(실제 정기런 처리는 appointments.ts).
 */

/** 운동 트윗 직후 크루 초대 DM이 올 확률 */
export const CREW_DM_CHANCE = 0.5;

const CREW_NAMES = ["한강 러닝크루", "새벽별 러닝크루", "달리는 사람들", "런하이 크루"];

const CREW_OPENERS = [
  "안녕하세요! 운동 트윗 보고 연락드려요 🏃 저희 러닝크루에서 같이 뛰실래요? 매주 목요일 낮에 가볍게 모여요!",
  "혹시 러닝 관심 있으세요? 트윗 보니 딱 저희 크루랑 잘 맞으실 것 같아서요! 목요일 낮마다 함께 달려요 :)",
  "운동 열심히 하시네요! 저희 크루 들어오시면 혼자보다 훨씬 꾸준히 뛸 수 있어요. 매주 목요일 낮 정기런 있어요!",
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
 * 러닝크루에 가입한다. 다음 목요일 낮부터 정기런 약속이 잡힌다.
 * 초대 스레드에 방장이 환영 메시지를 남긴다.
 */
export function joinCrew(state: GameState, thread: DMThread): void {
  state.crewJoined = true;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "환영해요! 🎉 이제 우리 크루원이에요. 매주 목요일 낮 정기런 잊지 말고 나와요, 기다릴게요 🏃‍♀️",
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
 * 비공개 클럽(SM 규율)에 가입한다. 다음 **화요일 심야**부터 정기 세션이 열린다.
 * (초대 서사·환영 문구는 ui가 PRIVATE_CREW_INVITE로 표시한다 — 여기선 상태만 확정.)
 *
 * ⚠️ **러닝 정기런과 별개 일정이다.** 처음엔 세션을 정기런(목요일 낮) 자리에 얹었는데,
 *    그러면 러닝을 나가면 세션이 되고 세션을 하면 러닝이 사라진다 — 둘은 다른 모임이다.
 *    이제 러닝크루원은 목요일 러닝과 화요일 세션을 둘 다 한다.
 * ⚠️ `crewJoined`를 건드리지 않는다. DM으로 들어온 사람은 러닝을 한 적이 없다.
 */
export function joinPrivateCrew(state: GameState): void {
  state.privateCrewJoined = true;
  scheduleNextPrivateClub(state);
  addSchedule(state, "비공개 클럽 가입", "system");
}

/* ─────────────────── 비공개 클럽 DM(러닝크루 우회로) ─────────────────── */

/** 체벌 트윗 직후 클럽 DM이 올 확률. */
export const PRIVATE_CLUB_DM_CHANCE = 0.6;

const CLUB_NAMES = ["더 체임버", "규율 클럽", "목요일의 방", "블랙 세션"];

const CLUB_OPENERS = [
  "그쪽 글, 계속 보고 있었어요. 취향이 확실하시더군요 🔞 저희는 매주 목요일에 모입니다. 규칙을 지킬 수 있는 분만 받아요.",
  "글만 쓰는 걸로 만족되던가요? 저희 클럽은 실제로 합니다. 정기 모임 자리 하나 비었어요.",
  "관심 있으실 것 같아 연락드려요. 비공개 클럽이고, 들어오면 매주 규율 세션이 있어요. 중간에 그만두는 건 자유입니다.",
];

function hasPrivateClubInvite(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.privateClub);
}

/**
 * 체벌 트윗을 올린 직후, 문턱을 넘었으면 확률적으로 비공개 클럽 초대 DM을 만든다.
 *
 * ⚠️ **러닝크루 가입 여부를 안 본다**(정기런 권유와의 차이). 그게 이 경로의 존재 이유다 —
 *    운동 트윗을 안 쓰는 플레이어도 체벌 트윗만으로 도달할 수 있어야 한다.
 */
export function maybeSpawnPrivateClubDM(state: GameState): boolean {
  if (!state.adultMode) return false;
  if (state.privateCrewJoined) return false;
  if (state.punishTweetsPosted < PRIVATE_CREW_PUNISH_THRESHOLD) return false;
  const account = getActiveAccount(state);
  if (hasPrivateClubInvite(account)) return false;
  if (!chance(PRIVATE_CLUB_DM_CHANCE)) return false;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: pick(CLUB_NAMES),
    partnerHandle: "the_chamber",
    attribute: "adult",
    isAdult: true,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(CLUB_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    privateClub: true,
  });
  addSchedule(state, "비공개 클럽 초대 DM", "sns");
  return true;
}

/** 클럽 DM 제의를 수락한다(가입 + 초대 스레드 플래그 해제 + 환영 메시지). */
export function acceptPrivateClub(state: GameState, thread: DMThread): void {
  joinPrivateCrew(state);
  thread.privateClub = false;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text:
      "환영합니다 🔞 매주 목요일, 장소는 당일에 알려드려요. 규칙은 하나뿐입니다 — 세는 걸 틀리지 마세요.",
    day: state.day,
  });
  thread.unread = true;
}

/** 클럽 DM 제의를 거절한다(플래그만 해제 — 재제의 없음). */
export function declinePrivateClub(state: GameState, thread: DMThread): void {
  thread.privateClub = false;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "알겠습니다. 마음이 바뀌면 그때 연락 주세요. 자리는 늘 있으니까요.",
    day: state.day,
  });
  thread.unread = true;
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
  // ⚠️ 클럽 세션은 **클럽 일정**을 재예약한다 — 러닝 정기런을 다시 잡으면 안 된다.
  scheduleNextPrivateClub(state);
  const dynamic = applyEffect(state, choice.effect);
  // SM 규율 세션인데 변태력이 안 올랐다 — 시나리오 80개가 전부 lewd만 준다.
  // adultOffline과 같은 규칙으로 여기서 파생시킨다: **음란이 오른 선택 = 그 방향을 받아들인
  // 선택**이라는 게 데이터에 있는 유일한 신호이고, 콘텐츠를 한 줄도 안 고치고 전부에 적용된다.
  const lewd = choice.effect.skills?.lewd ?? 0;
  if (lewd > 0) gainSkill(state, "pervert", Math.round(lewd * PERVERT_GAIN_RATIO));
  state.resources.action = clampAction(state, state.resources.action - CREW_RUN_ACTION_COST);
  addSchedule(state, "비공개 크루 정기런", "offline");
  advanceTime(state, 1);
  return dynamic || choice.result;
}
