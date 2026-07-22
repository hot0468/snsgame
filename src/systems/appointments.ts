import type { Appointment, AttributeId, GameState } from "@/core/types";
import { MORNING_SLOT, LATE_SLOT, SLOTS_PER_DAY, SLOT_LABELS, getActiveAccount } from "@/core/state";
import { chance, pick, randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { pushKakao } from "./kakao";
import { ownedCount } from "./shop";
import { clampAction, clampResource, clampSkill, gainSkill, skillTo100 } from "./stats";
import {
  addSchedule,
  advanceTime,
  dateLabel,
  dayOfWeek,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  SATURDAY,
} from "./time";

/**
 * 약속(Appointment) 시스템 — 앞으로 할 일을 등록하고, 해당 (day, slot)이 되면
 * '할지/말지' 팝업을 띄운다. 정기런(크루)과 친구 만남을 하나로 통합한다.
 */

/** (day, slot)을 하나의 시간축 값으로 */
function timeValue(day: number, slot: number): number {
  return day * SLOTS_PER_DAY + slot;
}

/** 약속 추가 */
export function addAppointment(state: GameState, data: Omit<Appointment, "id">): Appointment {
  const appt: Appointment = { id: uid("appt"), ...data };
  state.appointments.push(appt);
  return appt;
}

function removeAppointment(state: GameState, id: string): void {
  state.appointments = state.appointments.filter((a) => a.id !== id);
}

/**
 * 지금(또는 이미 지난) 시각에 도래한 약속들.
 * 같은 시간에 둘 이상이면 '중복' 상황이다.
 */
export function dueAppointments(state: GameState): Appointment[] {
  const now = timeValue(state.day, state.slot);
  return (
    state.appointments
      .filter((a) => timeValue(a.day, a.slot) <= now)
      // 생일은 비차단 약속: appointmentModal 강제팝업에 뜨면 안 된다(축하는 배너/버튼으로만,
      // 놓쳐도 무해가 원칙). 도래 처리는 onNewDay가 pendingBirthday로 따로 한다.
      .filter((a) => a.kind !== "birthday")
      .sort((a, b) => timeValue(a.day, a.slot) - timeValue(b.day, b.slot))
  );
}

/* ─────────────────── 러닝크루 정기런 ─────────────────── */

/** 정기런 참석 시 행동력 소모(일반 운동 -25보다 훨씬 적다) */
export const CREW_RUN_ACTION_COST = 8;

/** 지금 이후의 다음 목요일(정기런은 낮 슬롯) */
function nextCrewDay(state: GameState): number {
  let d = state.day;
  // 목요일이면서, 그 (day, 낮)이 지금보다 미래여야 한다.
  // 낮은 하루의 첫 슬롯(0)이라 오늘 목요일이면 이미 도래/경과 — 다음 목요일로 넘어간다
  // (slot < MORNING_SLOT(0)은 항상 거짓). 정기런 소화 시점(목요일 낮)에 오늘 재예약되는 걸 막는다.
  while (!(dayOfWeek(d) === THURSDAY && (d > state.day || state.slot < MORNING_SLOT))) {
    d += 1;
  }
  return d;
}

/**
 * 다음 목요일 낮 정기런을 예약한다(기존 크루 약속은 갈아끼운다).
 * 가입 직후, 그리고 매주 정기런을 소화/취소한 뒤에 호출된다.
 */
export function scheduleNextCrewRun(state: GameState): void {
  if (!state.crewJoined) return;
  state.appointments = state.appointments.filter((a) => a.kind !== "crew");
  addAppointment(state, {
    day: nextCrewDay(state),
    slot: MORNING_SLOT,
    kind: "crew",
    title: "러닝크루 정기런",
  });
}

function resolveCrewRun(state: GameState, go: boolean): string {
  // 정기 일정이므로 결과와 무관하게 다음 주를 다시 잡는다
  scheduleNextCrewRun(state);

  if (!go) {
    addSchedule(state, "정기런 불참", "system");
    state.resources.mental = clampResource(state.resources.mental + 2);
    return "오늘은 쉬기로 했다. 크루원들에게 양해를 구했다. 다음 주 목요일엔 꼭 나가야지.";
  }

  state.resources.action = clampAction(state, state.resources.action - CREW_RUN_ACTION_COST);
  gainSkill(state, "fitness", 22);
  gainSkill(state, "sociability", 10);
  gainSkill(state, "beauty", 3);
  state.resources.mental = clampResource(state.resources.mental + 5);
  const delta = randInt(3, 9);
  changeFollowers(state, delta);
  addSchedule(state, "러닝크루 정기런", "offline");
  advanceTime(state, 1);
  return (
    "약속 시간에 맞춰 집결지에 나가니 크루원들이 반갑게 맞아주었다. 가볍게 몸을 풀고 다 함께 강변을 " +
    "따라 달리기 시작했다. 처음엔 숨이 차서 몇 번이나 포기하고 싶었지만, 옆에서 페이스를 맞춰주는 " +
    "동료들 덕분에 이를 악물고 계속 발을 굴렀다. 혼자였다면 진작 멈춰 걸었을 거리를, 함께 뛰니 " +
    "신기하게도 끝까지 완주할 수 있었다.\n\n" +
    "노을이 지는 강물을 옆에 두고 달리다 보니 어느새 잡생각도 스트레스도 땀과 함께 씻겨 내려갔다. " +
    "결승 지점에 도착했을 땐 다들 숨을 헐떡이면서도 서로를 보며 웃음이 터졌다. 함께 스트레칭을 하고 " +
    "가볍게 음료를 나눠 마시며 도란도란 이야기를 나누는 시간이 오늘 러닝의 진짜 보상 같았다. 땀은 " +
    "뻘뻘 났지만 몸도 마음도 더없이 개운하다. 오늘 만난 크루원 몇몇이 내 계정을 팔로우해줬다. " +
    `(팔로워 +${delta})`
  );
}

/* ─────────────────── 성인 그룹방 정기 모임 ─────────────────── */

/** 정기 모임 참석 시 행동력 소모 */
export const GROUP_NIGHT_ACTION_COST = 12;

/** 지금 이후의 다음 토요일(정기 모임은 심야 슬롯) */
function nextGroupNightDay(state: GameState): number {
  let d = state.day;
  while (!(dayOfWeek(d) === SATURDAY && (d > state.day || state.slot < LATE_SLOT))) {
    d += 1;
  }
  return d;
}

/**
 * 다음 토요일 심야 그룹 모임을 예약한다(기존 groupRoom 약속은 갈아끼운다).
 * 가입 직후, 그리고 매주 모임을 소화/취소한 뒤에 호출된다.
 */
export function scheduleNextGroupNight(state: GameState): void {
  if (!state.groupRoomJoined) return;
  state.appointments = state.appointments.filter((a) => a.kind !== "groupRoom");
  addAppointment(state, {
    day: nextGroupNightDay(state),
    slot: LATE_SLOT,
    kind: "groupRoom",
    title: "그룹방 정기 모임",
  });
}

function resolveGroupNight(state: GameState, go: boolean): string {
  scheduleNextGroupNight(state);

  if (!go) {
    addSchedule(state, "그룹방 정기 모임 불참", "system");
    state.resources.mental = clampResource(state.resources.mental + 3);
    state.resources.morality = clampResource(state.resources.morality + 1);
    return (
      "단톡에 ‘이번 주는 패스’라고만 남겼다. 아쉽다는 이모지가 몇 개 붙었지만, " +
      "다음 토요일 심야 일정은 그대로 잡혀 있다."
    );
  }

  state.resources.action = clampAction(state, state.resources.action - GROUP_NIGHT_ACTION_COST);
  gainSkill(state, "lewd", 24);
  gainSkill(state, "sociability", 6);
  state.resources.mental = clampResource(state.resources.mental - 8);
  state.resources.morality = clampResource(state.resources.morality - 10);
  getActiveAccount(state).groupUnlocked = true;
  const delta = randInt(12, 28);
  changeFollowers(state, delta);
  addSchedule(state, "그룹방 정기 모임", "offline");
  advanceTime(state, 1);
  return (
    "토 심야, 단톡에 찍힌 주소는 외곽 모텔 한 동이었다. 문을 열자 이미 서넛이 술을 나눠 마시며 " +
    "기다리고 있었고, 곧 인원이 더 늘어 거실 매트리스가 가득 찼다. 번호 없이 교대하듯 몸이 바뀌었고, " +
    "입·허리·손이 동시에 쓰이는 동안 누군가는 타이머로 순번만 관리했다.\n\n" +
    "정액과 땀이 섞인 공기가 방을 채울 무렵, 마지막 사정이 끝나고 나서야 물티슈 통이 돌았다. " +
    "촬영은 합의된 각도만, 얼굴은 가린 채. 단톡에는 ‘오늘 호흡 좋았음. 다음 토 심야 동일’ " +
    "한 줄만 남았다. 몸은 무거웠지만 성인 피드 알림은 유난히 시끄러웠다. " +
    `(팔로워 +${delta})`
  );
}

/* ─────────────────── 란제리 전속 화보 정기 촬영 ─────────────────── */

/** 지금 이후의 다음 수요일(란제리 촬영은 심야 슬롯) */
function nextLingerieDay(state: GameState): number {
  let d = state.day;
  while (!(dayOfWeek(d) === WEDNESDAY && (d > state.day || state.slot < LATE_SLOT))) {
    d += 1;
  }
  return d;
}

/**
 * 다음 수요일 심야 란제리 화보 촬영을 예약한다(기존 lingerie 약속은 갈아끼운다).
 * 계약 직후, 그리고 매주 촬영을 소화/취소한 뒤에 호출된다.
 * scheduleNextCrewRun 패턴 — slot만 LATE_SLOT.
 * (여기 두는 이유: dropAppointment가 재예약하려면 appointments.ts가 이 함수를 알아야 한다.
 *  lingerie.ts가 appointments를 import하는 방향만 허용되므로, 스케줄러는 크루처럼 여기 산다.)
 */
export function scheduleNextLingerieShoot(state: GameState): void {
  if (!state.lingerieContract) return;
  state.appointments = state.appointments.filter((a) => a.kind !== "lingerie");
  addAppointment(state, {
    day: nextLingerieDay(state),
    slot: LATE_SLOT,
    kind: "lingerie",
    title: "란제리 화보 촬영",
  });
}

/**
 * 란제리 촬영을 소화하지 않고 지나갈 때(불참·겹침 취소)의 처리.
 * '간다'는 appointmentModal의 handleLingerieGo가 가로채 scenarioReader→resolveLingerieShoot로
 * 흐르므로 여기 오지 않는다. 여기 도달하는 건 오직 불참 경로다 —
 * 크루·그룹방처럼 정기 사이클이 끊기지 않게 다음 주를 다시 잡는다.
 */
function resolveLingerieSkip(state: GameState): string {
  scheduleNextLingerieShoot(state);
  addSchedule(state, "란제리 화보 촬영 불참", "system");
  state.resources.mental = clampResource(state.resources.mental + 2);
  return "오늘 심야 촬영은 쉬기로 했다. 스튜디오에 양해를 구했다. 다음 주 촬영 일정은 그대로 잡혀 있다.";
}

/* ─────────────────── 취업스터디 정기 모임 ─────────────────── */

/** 지금 이후의 다음 월요일(스터디는 낮 슬롯) */
function nextStudyDay(state: GameState): number {
  let d = state.day;
  // 크루(nextCrewDay)와 동일 — 오늘 월요일 낮이면 이미 도래/경과라 다음 주 월요일로 넘어간다.
  while (!(dayOfWeek(d) === MONDAY && (d > state.day || state.slot < MORNING_SLOT))) {
    d += 1;
  }
  return d;
}

/**
 * 다음 월요일 낮 취업스터디 모임을 예약한다(기존 study 약속은 갈아끼운다).
 * 가입 직후(studyGroup.joinStudy), 그리고 매주 모임을 소화(resolveStudy)/불참한 뒤 호출된다.
 * scheduleNextCrewRun 패턴 — 요일만 월요일.
 * (여기 두는 이유: dropAppointment/resolveStudySkip이 재예약하려면 appointments.ts가 알아야 한다.
 *  studyGroup.ts가 appointments를 import하는 방향만 허용되므로, 스케줄러는 크루처럼 여기 산다.)
 */
export function scheduleNextStudy(state: GameState): void {
  if (!state.studyJoined) return;
  state.appointments = state.appointments.filter((a) => a.kind !== "study");
  addAppointment(state, {
    day: nextStudyDay(state),
    slot: MORNING_SLOT,
    kind: "study",
    title: "취업스터디 모임",
  });
}

/**
 * 스터디를 소화하지 않고 지나갈 때(불참·겹침 취소)의 처리.
 * '간다'는 appointmentModal이 kind==="study"를 가로채 studyGroup.resolveStudy로 흐르므로
 * 여기 오지 않는다(란제리 resolveLingerieSkip 선례). 여기 도달하는 건 오직 불참 경로다 —
 * 정기 사이클이 끊기지 않게 다음 주를 다시 잡는다.
 */
function resolveStudySkip(state: GameState): string {
  scheduleNextStudy(state);
  addSchedule(state, "취업스터디 불참", "system");
  state.resources.mental = clampResource(state.resources.mental + 2);
  return "오늘 스터디는 쉬기로 했다. 스터디원들에게 양해를 구했다. 다음 주 월요일 일정은 그대로 잡혀 있다.";
}

/* ─────────────────── 에스테틱 정기권 방문 ─────────────────── */

/** 지금 이후의 다음 화요일(에스테틱 방문은 낮 슬롯) */
function nextEstheticDay(state: GameState): number {
  let d = state.day;
  // 크루(nextCrewDay)와 동일 — 오늘 화요일 낮이면 이미 도래/경과라 다음 주 화요일로 넘어간다.
  while (!(dayOfWeek(d) === TUESDAY && (d > state.day || state.slot < MORNING_SLOT))) {
    d += 1;
  }
  return d;
}

/**
 * 다음 화요일 낮 에스테틱 방문 약속을 예약한다(기존 esthetic 약속은 갈아끼운다).
 * 정품 가입 직후(applyEsthetic), 그리고 매주 방문(resolveEsthetic)/불참 뒤 호출된다.
 * scheduleNextCrewRun 패턴 — 요일만 화요일.
 * (여기 두는 이유: dropAppointment/resolveEstheticSkip이 재예약하려면 appointments.ts가 알아야 한다.
 *  esthetic.ts가 appointments를 import하는 방향만 허용되므로, 스케줄러는 크루처럼 여기 산다.)
 */
export function scheduleNextEsthetic(state: GameState): void {
  if (!state.estheticMember) return;
  state.appointments = state.appointments.filter((a) => a.kind !== "esthetic");
  addAppointment(state, {
    day: nextEstheticDay(state),
    slot: MORNING_SLOT,
    kind: "esthetic",
    title: "에스테틱 정기권 방문",
  });
}

/**
 * 에스테틱 방문을 소화하지 않고 지나갈 때(불참·겹침 취소)의 처리.
 * '간다'는 appointmentModal이 kind==="esthetic"을 가로채 esthetic.resolveEsthetic로 흐르므로
 * 여기 오지 않는다(스터디 resolveStudySkip 선례). 여기 도달하는 건 오직 불참 경로다 —
 * 정기 사이클이 끊기지 않게 다음 주를 다시 잡는다.
 */
function resolveEstheticSkip(state: GameState): string {
  scheduleNextEsthetic(state);
  addSchedule(state, "에스테틱 방문 불참", "system");
  state.resources.mental = clampResource(state.resources.mental + 2);
  return "이번 주 에스테틱은 건너뛰기로 했다. 관리비 1만원은 굳었다. 다음 주 화요일 예약은 그대로 잡혀 있다.";
}

/* ─────────────────── 친구 만남 ─────────────────── */

/** 만남을 완료한 상대가 '놀자' 카톡을 보낼 확률 */
export const FRIEND_INVITE_CHANCE = 0.7;

const FRIEND_OPENERS = [
  "저번에 만나서 진짜 즐거웠어! 😄",
  "야 우리 또 봐야지 ㅎㅎ",
  "그날 너무 재밌었다, 자꾸 생각나네",
  "오랜만에 사람 만나서 신났어 ㅋㅋ",
];

/**
 * 만남을 제대로 완료한 상대가 '만나서 놀자'는 카톡을 보낸다(무작위 날짜·시간대 제안).
 * 수락하면 friend 약속으로 등록된다.
 */
export function sendFriendHangoutInvite(
  state: GameState,
  partnerName: string,
  attribute?: AttributeId,
): void {
  if (!chance(FRIEND_INVITE_CHANCE)) return;
  const day = state.day + randInt(2, 7);
  const slot = randInt(0, SLOTS_PER_DAY - 1);
  const when = `${dateLabel(day)} ${SLOT_LABELS[slot]}`;
  const thread = pushKakao(
    state,
    partnerName,
    [pick(FRIEND_OPENERS), `${when}쯤에 또 만나서 놀래?`, "시간 되면 답 줘~"],
    { hue: 200 },
  );
  thread.invite = { day, slot, partnerName, attribute };
}

function resolveFriendMeet(state: GameState, appt: Appointment, go: boolean): string {
  const name = appt.partnerName ?? "친구";
  if (!go) {
    addSchedule(state, `${name}와 약속 취소`, "system");
    state.resources.mental = clampResource(state.resources.mental + 1);
    return `${name}에게 오늘은 못 만날 것 같다고 양해를 구했다. 미안한 마음이 남는다.`;
  }
  state.resources.action = clampAction(state, state.resources.action - 10);
  state.resources.mental = clampResource(state.resources.mental + 8);
  state.skills.sociability = clampSkill(state.skills.sociability + 20);
  const delta = randInt(4, 12);
  changeFollowers(state, delta);
  addSchedule(state, `${name}와 만나서 놀기`, "offline");
  advanceTime(state, 1);
  return (
    `약속 장소에 나가니 ${name}이(가) 먼저 도착해 손을 흔들며 반겨주었다. 오랜만의 만남이라 처음엔 ` +
    "조금 어색했지만, 근황을 주고받다 보니 금세 예전처럼 편해졌다. 맛있는 밥을 먹고 카페로 자리를 " +
    "옮겨, 시간 가는 줄 모르고 온갖 시시콜콜한 이야기를 나눴다. 요즘 힘들었던 일, 웃겼던 일, 서로의 " +
    "관심사까지 화제는 끝없이 이어졌다.\n\n" +
    `혼자 끙끙 앓던 고민도 ${name} 앞에서 털어놓으니 한결 가벼워졌다. 별것 아닌 농담에도 배가 아프게 ` +
    "웃고, 공감받는 기분에 마음이 따뜻해졌다. 사람을 만나 마음을 나눈다는 게 이렇게 큰 힘이 되는 " +
    `일이었나 새삼 느꼈다. 오랜만에 쌓였던 스트레스가 확 풀리는 하루였다. 헤어지기 전, ${name}이(가) ` +
    `친구들에게 내 계정을 소개해준 덕에 팔로워도 몇 명 늘었다. (팔로워 +${delta})`
  );
}

/* ─────────────────── 행사(콘서트·무대인사 등) ─────────────────── */

function resolveEventVisit(state: GameState, appt: Appointment, go: boolean): string {
  if (!go) {
    addSchedule(state, `${appt.title} 불참`, "system");
    state.resources.mental = clampResource(state.resources.mental + 1);
    return `${appt.title}에 가지 않기로 했다. 표는 아쉽지만 다음 기회에...`;
  }
  state.resources.action = clampAction(state, state.resources.action - 10);
  state.resources.mental = clampResource(state.resources.mental + 10);
  state.skills.sociability = clampSkill(state.skills.sociability + 10);
  const delta = randInt(15, 40);
  changeFollowers(state, delta);
  addSchedule(state, `${appt.title} 참여`, "offline");
  advanceTime(state, 1);
  return (
    `설레는 마음으로 일찌감치 ${appt.title} 현장에 도착했다. 입구에서부터 같은 걸 좋아하는 사람들의 ` +
    "열기가 후끈하게 느껴졌다. 줄을 서서 기다리는 시간마저 즐거웠고, 주변 사람들과 자연스럽게 정보를 " +
    "주고받으며 금세 동질감을 느꼈다. 드디어 시작된 무대는 상상 이상이었다. 화면으로만 보던 실물을 " +
    "눈앞에서 마주하는 순간, 심장이 터질 것처럼 뛰었다.\n\n" +
    "한순간도 놓칠세라 눈에 꾹꾹 담고, 함께 온 팬들과 환호하며 벅찬 감동을 나눴다. 같은 대상을 " +
    "좋아하는 사람들 사이에 있으니 혼자가 아니라는 안도감마저 들었다. 행사가 끝난 뒤에도 여운이 " +
    "가시질 않아, 집으로 돌아오는 내내 오늘의 장면들을 곱씹었다. 생생한 후기와 사진을 정리해 트윗을 " +
    `올리자 반응이 폭발했고, 덕분에 새 팔로워도 제법 늘었다. (팔로워 +${delta})`
  );
}

/* ─────────────────── 코믹콘(참관객/부스/코스프레) ─────────────────── */

export type ComicconMode = "visitor" | "booth" | "cosplay" | "cosplayLewd";

/**
 * 부스 참가 시 창작 스탯에 비례한 판매 수익.
 * 스킬은 0~999 스케일이므로 100점 만점으로 환산해 구 수익 규모를 보존한다.
 */
export function boothIncome(creativity: number): number {
  return Math.round(skillTo100(creativity) * randInt(200, 400));
}

/** '노출 심한 코스프레' 선택지가 열리는 음란도 하한 */
export const COMICCON_LEWD_MIN = 400;

/** 노출 코스프레 선택이 가능한지(성인물 해제 + 음란도 충분) */
export function canLewdCosplay(state: GameState): boolean {
  return state.adultMode && state.skills.lewd >= COMICCON_LEWD_MIN;
}

/**
 * 코믹콘 참여 방식을 확정한다. 처리 후 약속은 목록에서 제거된다.
 * - visitor(참관객): 즐기며 팔로워↑
 * - booth(부스): 창작물 판매. 창작 스탯이 높을수록 소지금↑
 * - cosplay(코스프레): 화제성↑ 팔로워 대폭↑·미용↑
 */
export function resolveComiccon(
  state: GameState,
  appt: Appointment,
  mode: ComicconMode,
): AppointmentResult {
  removeAppointment(state, appt.id);

  if (mode === "booth") {
    state.resources.action = clampAction(state, state.resources.action - 15);
    state.skills.creativity = clampSkill(state.skills.creativity + 15);
    state.skills.sociability = clampSkill(state.skills.sociability + 10);
    const followers = randInt(10, 30);
    changeFollowers(state, followers);
    const earned = boothIncome(state.skills.creativity);
    state.money += earned;
    addSchedule(state, `코믹콘 부스 참가 (+${earned.toLocaleString("ko-KR")}원)`, "offline");
    advanceTime(state, 1);
    const msg =
      earned > 0
        ? "밤새 준비한 창작물을 바리바리 싸 들고 새벽부터 부스를 차렸다. 테이블에 굿즈를 정성껏 " +
          "진열하고 손수 만든 안내판까지 세우니 제법 그럴듯한 판매대가 완성됐다. 행사가 시작되자 " +
          "사람들이 하나둘 부스 앞에 멈춰 섰고, 갈고닦은 창작 실력이 빛을 발하며 굿즈가 불티나게 " +
          "팔려나갔다. 어떤 손님은 팬이라며 사인을 요청하기도 했다.\n\n" +
          "직접 만든 작품이 누군가의 손에 들려 가는 걸 지켜보는 기쁨은 무엇과도 바꿀 수 없었다. 정신없이 " +
          "손님을 응대하다 보니 어느새 준비한 물량이 거의 동났다. 판매 수익 " +
          `${earned.toLocaleString("ko-KR")}원을 두둑이 벌었고, 명함 대신 나눠 준 계정 정보 덕에 홍보도 ` +
          `톡톡히 됐다. 창작자로서 자부심이 차오르는 하루였다. (팔로워 +${followers})`
        : "밤새 준비한 창작물을 들고 부스를 차렸지만, 현실은 녹록지 않았다. 옆 부스에는 사람이 북적이는데 " +
          "내 자리 앞은 유난히 한산했다. 애써 미소를 지으며 지나가는 사람들과 눈을 맞춰봤지만, 대부분은 " +
          "슬쩍 훑어보고는 그냥 지나쳐 갔다. 아직 내 창작 실력이 손님을 붙잡기엔 부족하다는 걸 뼈저리게 " +
          "느꼈다.\n\n" +
          "그래도 몇 안 되는 손님들이 건네준 진심 어린 감상평이 큰 위로가 됐다. 직접 부딪혀 보니 무엇이 " +
          "부족한지, 사람들이 어떤 걸 원하는지 조금은 감이 잡혔다. 오늘의 초라한 성적표는 다음을 위한 " +
          `밑거름이 될 것이다. 값진 경험을 얻은 하루였다. (창작 경험 +, 팔로워 +${followers})`;
    return { message: msg };
  }

  if (mode === "cosplayLewd") {
    state.resources.action = clampAction(state, state.resources.action - 12);
    state.skills.beauty = clampSkill(state.skills.beauty + 10);
    state.skills.sociability = clampSkill(state.skills.sociability + 15);
    state.skills.lewd = clampSkill(state.skills.lewd + 20);
    state.resources.morality = clampResource(state.resources.morality - 6);
    const followers = randInt(55, 95);
    changeFollowers(state, followers);
    addSchedule(state, "코믹콘 노출 코스프레 참가", "offline");
    advanceTime(state, 1);
    return {
      message:
        "이번엔 큰맘 먹고 수위를 확 끌어올린 의상을 준비했다. 탈의실에서 거울에 비친 스스로를 보며 " +
        "잠깐 망설였지만, 오늘만큼은 주목받고 싶다는 마음이 부끄러움을 앞질렀다. 심호흡을 하고 현장에 " +
        "나서는 순간, 사방에서 시선이 쏟아지는 게 온몸으로 느껴졌다. 아슬아슬한 노출의 코스프레는 단번에 " +
        "행사장의 이목을 사로잡았고, 여기저기서 사진 요청이 쏟아졌다.\n\n" +
        "포즈를 취할 때마다 카메라 셔터음이 소나기처럼 터졌다. 낯 뜨거운 시선도 있었지만, 그 아찔한 " +
        "관심이 묘한 쾌감으로 다가오는 걸 부정할 수 없었다. 평소의 나라면 상상도 못 할 대담한 모습이었다. " +
        "부끄러움과 짜릿함이 뒤섞인 채, 나는 점점 더 과감한 포즈로 카메라 앞에 섰다. 스스로가 특별한 " +
        "존재가 된 듯한 아득한 도취감이 밀려왔다.\n\n" +
        "행사가 끝나기도 전에, 현장에서 찍힌 아슬아슬한 사진들이 SNS를 타고 폭발적으로 퍼지기 시작했다. " +
        "타임라인은 순식간에 내 이야기로 도배됐고, 계정은 하루아침에 화제의 중심에 섰다. 팔로워 숫자가 " +
        "눈에 띄게 치솟는 걸 보며 짜릿함이 차올랐지만, 한편으로는 이렇게까지 해야 했나 하는 씁쓸함도 " +
        "살짝 스쳤다. 관심을 얻은 대가로 무언가를 조금 내어준 기분. 그래도 오늘의 나는 분명, 세상의 " +
        `시선을 온전히 독차지했다. (팔로워 +${followers})`,
    };
  }

  if (mode === "cosplay") {
    state.resources.action = clampAction(state, state.resources.action - 12);
    state.resources.mental = clampResource(state.resources.mental + 8);
    state.skills.beauty = clampSkill(state.skills.beauty + 15);
    state.skills.sociability = clampSkill(state.skills.sociability + 15);
    const followers = randInt(25, 55);
    changeFollowers(state, followers);
    addSchedule(state, "코믹콘 코스프레 참가", "offline");
    advanceTime(state, 1);
    return {
      message:
        "몇 주 동안 밤을 새워 준비한 코스프레 의상을 완성해 현장에 나섰다. 디테일 하나하나까지 " +
        "신경 쓴 보람이 있었는지, 등장하자마자 사람들의 눈길이 모였다. '완성도 미쳤다'는 감탄과 함께 " +
        "여기저기서 포토타임 요청이 쏟아졌고, 나는 캐릭터에 몰입해 다양한 포즈로 카메라 앞에 섰다.\n\n" +
        "같은 작품을 좋아하는 사람들과 캐릭터에 대해 열띤 이야기를 나누는 것도 큰 즐거움이었다. 서로의 " +
        "의상을 칭찬하고 함께 사진을 찍으며 시간 가는 줄 몰랐다. 좋아하는 캐릭터가 되어 온전히 하루를 " +
        "즐기고 나니 성취감이 가득 찼다. 현장에서 찍힌 멋진 사진들이 SNS에 퍼지면서 계정이 화제가 됐고, " +
        `새 팔로워도 부쩍 늘었다. (팔로워 +${followers})`,
    };
  }

  // visitor
  state.resources.action = clampAction(state, state.resources.action - 8);
  state.resources.mental = clampResource(state.resources.mental + 10);
  state.skills.sociability = clampSkill(state.skills.sociability + 15);
  const followers = randInt(12, 28);
  changeFollowers(state, followers);
  addSchedule(state, "코믹콘 참관", "offline");
  advanceTime(state, 1);
  return {
    message:
      "가벼운 마음으로 참관객이 되어 코믹콘 이곳저곳을 실컷 누볐다. 입구에서부터 화려한 부스와 " +
      "정교한 코스프레들이 눈을 사로잡았다. 한정판 굿즈를 사려 줄을 서고, 마음에 드는 부스에서 " +
      "지갑을 아낌없이 열었다. 사고 싶던 물건을 손에 넣을 때마다 절로 웃음이 났다.\n\n" +
      "무엇보다 좋았던 건 같은 취향을 가진 사람들과 자연스럽게 어울릴 수 있다는 점이었다. 처음 보는 " +
      "사이인데도 좋아하는 작품 이야기가 나오면 금세 마음이 통했다. 함께 사진을 찍고 정보를 주고받으며 " +
      "돌아다니다 보니 하루가 어떻게 지나갔는지 모를 정도였다. 집에 돌아와 오늘의 전리품과 인상 깊었던 " +
      `순간들을 정리해 올린 후기 트윗에 반응이 제법 좋았다. (팔로워 +${followers})`,
  };
}

/* ─────────────────── 티켓팅(무대인사·GV·콘서트) ─────────────────── */

/** 티켓팅 좌석 미니게임의 기본 제한시간(ms) */
export const TICKETING_BASE_TIME_MS = 3_000;
/** 마우스 1개당 늘어나는 제한시간(ms) */
export const TICKETING_MOUSE_BONUS_MS = 100;

/**
 * 티켓팅 좌석 미니게임의 제한시간(ms).
 * 좋은 마우스를 살수록 광클이 빨라져 여유가 생긴다(1개당 +0.1초, 상한 없음).
 */
export function ticketingTimeLimitMs(state: GameState): number {
  return TICKETING_BASE_TIME_MS + TICKETING_MOUSE_BONUS_MS * ownedCount(state, "mouse");
}

/**
 * 티켓팅 결과 처리 — 좌석 미니게임 성공 여부(won)로 결정된다.
 * 성공하면 실제 행사 관람 일정이 스케줄에 등록된다. 처리 후 티켓팅 약속은 제거.
 */
function resolveTicketing(state: GameState, appt: Appointment, won: boolean): string {
  const tf = appt.ticketFor;
  advanceTime(state, 1); // 티켓팅 순간이 지나 시간이 흐른다
  if (won && tf) {
    addAppointment(state, {
      day: Math.max(tf.day, state.day + 1),
      slot: tf.slot,
      kind: "event",
      title: tf.title,
      attribute: tf.attribute,
      variant: tf.variant,
    });
    state.resources.mental = clampResource(state.resources.mental + 5);
    addSchedule(state, `${tf.title} 티켓팅 성공`, "sns");
    return (
      `치열한 광클 끝에 원하는 좌석을 잡았다!! 「${tf.title}」 관람 일정이 스케줄에 등록됐다. ` +
      `(${dateLabel(tf.day)} ${SLOT_LABELS[tf.slot] ?? ""})`
    );
  }
  state.resources.mental = clampResource(state.resources.mental - 6);
  addSchedule(state, `${tf?.title ?? "행사"} 티켓팅 실패`, "system");
  return `아쉽게 티켓팅에 실패했다... 「${tf?.title ?? "행사"}」 관람은 물거품이 됐다. 다음 기회를 노리자.`;
}

/* ─────────────────── 공통 처리 ─────────────────── */

export interface AppointmentResult {
  message: string;
}

/** 약속을 확정 처리한다(참석/불참·티켓팅 성공여부). 처리 후 목록에서 제거된다. */
export function resolveAppointment(
  state: GameState,
  appt: Appointment,
  go: boolean,
): AppointmentResult {
  removeAppointment(state, appt.id);
  let message: string;
  if (appt.kind === "crew") message = resolveCrewRun(state, go);
  else if (appt.kind === "groupRoom") message = resolveGroupNight(state, go);
  else if (appt.kind === "ticketing") message = resolveTicketing(state, appt, go);
  else if (appt.kind === "event") message = resolveEventVisit(state, appt, go);
  else if (appt.kind === "lingerie") message = resolveLingerieSkip(state);
  else if (appt.kind === "study") message = resolveStudySkip(state);
  else if (appt.kind === "esthetic") message = resolveEstheticSkip(state);
  else message = resolveFriendMeet(state, appt, go);
  return { message };
}

/**
 * 중복으로 밀려난(선택받지 못한) 약속을 취소한다.
 * 크루·그룹방은 다음 주로 다시 잡히고, 나머지(친구·행사)는 그대로 사라진다.
 */
export function dropAppointment(state: GameState, appt: Appointment): void {
  removeAppointment(state, appt.id);
  if (appt.kind === "crew") {
    scheduleNextCrewRun(state);
    addSchedule(state, "정기런 취소(일정 겹침)", "system");
  } else if (appt.kind === "groupRoom") {
    scheduleNextGroupNight(state);
    addSchedule(state, "그룹방 정기 모임 취소(일정 겹침)", "system");
  } else if (appt.kind === "lingerie") {
    scheduleNextLingerieShoot(state);
    addSchedule(state, "란제리 화보 촬영 취소(일정 겹침)", "system");
  } else if (appt.kind === "study") {
    scheduleNextStudy(state);
    addSchedule(state, "취업스터디 모임 취소(일정 겹침)", "system");
  } else if (appt.kind === "esthetic") {
    scheduleNextEsthetic(state);
    addSchedule(state, "에스테틱 방문 취소(일정 겹침)", "system");
  } else {
    addSchedule(state, `${appt.title} 취소(일정 겹침)`, "system");
  }
}
