/**
 * 성인 그룹방 가입 흐름.
 * - 성인 트윗에 좋아요를 누르면 확률적으로 그룹방 초대 DM이 온다.
 * - 가입하면 매주 토요일 심야 정기 모임 약속이 잡힌다(appointments.ts).
 */
import type { DMThread, GameState, PlayerAccount, Tweet } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { chance, pick, uid } from "@/utils/random";
import { addSchedule } from "./time";
import { scheduleNextGroupNight } from "./appointments";

/** 성인 트윗 좋아요 직후 그룹방 초대 DM 확률 */
export const GROUP_ROOM_DM_CHANCE = 0.35;
/** 초대가 뜨는 최소 음란 */
export const GROUP_ROOM_LEWD_MIN = 300;
/** 초대가 뜨는 최소 변태력 — 그룹 플레이는 '정도'가 아니라 취향의 영역이라 2축으로 잠근다. */
export const GROUP_ROOM_PERVERT_MIN = 300;

const ROOM_NAMES = [
  "심야 로테이션방",
  "익명 난교 단톡",
  "토요 오프 모임",
  "블랙리스트 라운지",
  "번호표 대기방",
];

const ROOM_OPENERS = [
  "좋아요 봤어요 🔞 저희 그룹방에서 매주 토 밤에 오프 모여요. 들어올래요? 인원 맞춰 교대하는 식이에요.",
  "알림 보고 연락해요. 성인 취향 맞는 사람들만 모인 방인데, 토 심야 정기 모임 있어요. 자리 비었어요.",
  "그 트윗에 하트 찍은 거 보고… 혹시 그룹 플레이 관심 있어요? 매주 토요일 밤 정기. 카메라 OFF 기본.",
  "단톡 초대할게요. 수락하면 토 심야마다 장소 공유해요. 안 오면 다음 주, 오면… 인원 전부 돌려요.",
];

function hasGroupRoomInvite(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.groupRoom);
}

/**
 * 성인 트윗 좋아요 직후 확률적으로 그룹방 초대 DM을 생성한다.
 * 이미 가입·초대 스레드 있음·성인 모드 아님·음란 부족이면 생성하지 않는다.
 */
export function maybeSpawnGroupRoomInviteDM(state: GameState, tweet: Tweet): boolean {
  if (!state.adultMode) return false;
  if (state.groupRoomJoined) return false;
  if (!tweet.isAdult) return false;
  if (state.skills.lewd < GROUP_ROOM_LEWD_MIN) return false;
  if (state.skills.pervert < GROUP_ROOM_PERVERT_MIN) return false;
  const account = getActiveAccount(state);
  if (hasGroupRoomInvite(account)) return false;
  if (!chance(GROUP_ROOM_DM_CHANCE)) return false;

  const name = pick(ROOM_NAMES);
  account.dms.unshift({
    id: uid("dm"),
    partnerName: name,
    partnerHandle: "group_room",
    attribute: "adult",
    isAdult: true,
    messages: [
      { id: uid("dmm"), from: "partner", text: pick(ROOM_OPENERS), day: state.day },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    groupRoom: true,
  });
  addSchedule(state, "성인 그룹방 초대 DM", "sns");
  return true;
}

/**
 * 그룹방에 가입한다. 다음 토요일 심야부터 정기 모임이 잡힌다.
 * 그룹 플레이(groupUnlocked)도 연다.
 */
export function joinGroupRoom(state: GameState, thread: DMThread): void {
  state.groupRoomJoined = true;
  getActiveAccount(state).groupUnlocked = true;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text:
      "환영 🔞 매주 토요일 심야에 장소 찍어요. 오면 인원 전원 교대, 안 오면 다음 주. " +
      "단톡 규칙은 간단해요 — 얼굴 강요 없음, 촬영은 합의, 불참은 사전 톡. 토 밤에 봐요.",
    day: state.day,
  });
  thread.unread = true;
  addSchedule(state, "성인 그룹방 가입", "system");
  scheduleNextGroupNight(state);
}
