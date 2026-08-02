import type { GameState } from "@/core/types";
import { pick } from "@/utils/random";
import { changeFollowers } from "./followers";
import { pushKakao } from "./kakao";
import { clampMental, clampResource, gainSkill } from "./stats";
import { postTweet } from "./tweetSystem";
import { addSchedule } from "./time";

/**
 * 바디프로필 도전 — 한 달짜리 게이지 도전.
 *
 * 시작하면 30일 카운트다운과 바디게이지(0~100)가 생긴다.
 * - **운동**하면 게이지가 찬다(컨디션 등급 배율이 그대로 실린다).
 * - **정신력이 낮은 상태**로 휴식·외출·산책을 하면 고칼로리 유혹이 터져 게이지가 깎인다.
 *   → 컨디션 관리를 못 하면 아무리 운동해도 게이지가 안 는다. 그게 이 도전의 축이다.
 * - 30일째 아침(time.onNewDay)에 판정: 게이지가 가득 찼으면 촬영 성공 → 자동 트윗 + 팔로워 급증.
 *
 * 게이지 적립·유혹 롤은 `systems/offline.ts`가 활동 처리 중에 호출한다(단일 지점).
 */

/** 도전 기간(일) */
export const BODY_PROFILE_DAYS = 30;
/** 스튜디오 예약금 — 시작할 때 낸다. 실패해도 돌려받지 못한다. */
export const BODY_PROFILE_FEE = 200_000;
/** 도전을 시작할 수 있는 최소 운동 스킬(0~999) */
export const BODY_PROFILE_MIN_FITNESS = 250;
/** 게이지 만점 */
export const BODY_GAUGE_MAX = 100;
/** 운동 1회당 게이지 적립분(컨디션 등급 배율이 곱해진다) */
export const BODY_GAUGE_PER_WORKOUT = 4;
/** 이 정신력 미만이면 휴식·외출·산책에서 고칼로리 유혹이 뜬다 */
export const BINGE_MENTAL_THRESHOLD = 45;
/** 유혹이 뜰 확률 */
export const BINGE_CHANCE = 0.4;
/** 유혹에 넘어갔을 때 깎이는 게이지 */
export const BINGE_PENALTY = 12;
/** 고칼로리를 먹으면 정신력은 오히려 회복된다(그래서 유혹이다) */
export const BINGE_MENTAL_GAIN = 8;
/** 촬영 성공 시 추가 팔로워 */
export const BODY_PROFILE_FOLLOWERS = 12_000;
/** 촬영 성공 시 미용 상승분(0~999 스케일) */
export const BODY_PROFILE_BEAUTY = 60;
/** 촬영 성공 시 평판 상승분(0~100 스케일) */
export const BODY_PROFILE_REP = 6;

/** 고칼로리 유혹 문구 — 활동 결과 문구 뒤에 붙는다 */
export const BINGE_LINES = [
  "편의점 앞을 지나다 결국 치킨 한 마리를 안고 들어왔다. 바디게이지가 주르륵 흘러내린다.",
  "야식 배달 앱을 '구경만' 하려다 결제까지 눌렀다. 내일의 나에게 사과한다.",
  "달다구리가 당겨 초콜릿을 뜯었는데 정신 차려보니 봉지가 비어 있었다.",
  "친구가 사 온 케이크를 한 조각만 먹으려 했다. 접시는 두 번 비었다.",
];

/** 촬영 성공 자동 트윗 문구 */
export const BODY_PROFILE_TWEETS = [
  "드디어 바디프로필 촬영 끝!! 한 달 동안 참은 야식들아 미안하다 그리고 고맙다 📸 #바디프로필 #한달의결실",
  "바디프로필 나왔다 이게 나라니… 한 달 전의 나에게 고맙다고 전해주고 싶다 📸 #바디프로필 #운동일지",
];

/** 진행 중인 도전이 있는지 */
export function hasBodyProfile(state: GameState): boolean {
  return state.bodyProfile !== null;
}

/** 도전 시작 가능 여부(운동 스킬·소지금·중복). UI 버튼 게이트가 쓴다. */
export function canStartBodyProfile(state: GameState): "ok" | "busy" | "weak" | "poor" {
  if (state.bodyProfile) return "busy";
  if (state.skills.fitness < BODY_PROFILE_MIN_FITNESS) return "weak";
  if (state.money < BODY_PROFILE_FEE) return "poor";
  return "ok";
}

/** 도전을 시작한다(예약금 차감). 시작할 수 없으면 그 사유를 반환하고 아무것도 바꾸지 않는다. */
export function startBodyProfile(state: GameState): "ok" | "busy" | "weak" | "poor" {
  const can = canStartBodyProfile(state);
  if (can !== "ok") return can;
  state.money -= BODY_PROFILE_FEE;
  state.bodyProfile = { startDay: state.day, gauge: 0, binges: 0 };
  addSchedule(state, `바디프로필 촬영 예약 (${BODY_PROFILE_DAYS}일 뒤 촬영)`, "system");
  return "ok";
}

/** 남은 일수(0이면 오늘이 촬영일) */
export function bodyProfileDaysLeft(state: GameState): number {
  const bp = state.bodyProfile;
  if (!bp) return 0;
  return Math.max(0, bp.startDay + BODY_PROFILE_DAYS - state.day);
}

/**
 * 운동으로 게이지를 적립한다(offline.doOfflineActivity의 운동 분기에서 호출).
 * @param gradeMult 컨디션 등급 배율(실패 0.25 · 보통 1 · 대성공 1.8)
 * @returns 실제로 오른 게이지(도전 중이 아니면 0)
 */
export function gainBodyGauge(state: GameState, gradeMult: number): number {
  const bp = state.bodyProfile;
  if (!bp) return 0;
  const before = bp.gauge;
  bp.gauge = Math.min(BODY_GAUGE_MAX, bp.gauge + Math.round(BODY_GAUGE_PER_WORKOUT * gradeMult));
  return bp.gauge - before;
}

/**
 * 고칼로리 유혹 판정(휴식·외출·산책 활동에서 호출).
 * 정신력이 BINGE_MENTAL_THRESHOLD 미만일 때만, BINGE_CHANCE로 터진다.
 * 터지면 게이지가 깎이고 정신력이 조금 오른다 — 그래서 이게 '유혹'이다.
 * @returns 유혹 문구(안 터졌거나 도전 중이 아니면 null)
 */
export function rollBinge(state: GameState): string | null {
  const bp = state.bodyProfile;
  if (!bp) return null;
  if (state.resources.mental >= BINGE_MENTAL_THRESHOLD) return null;
  if (Math.random() >= BINGE_CHANCE) return null;
  const before = bp.gauge;
  bp.gauge = Math.max(0, bp.gauge - BINGE_PENALTY);
  bp.binges += 1;
  state.resources.mental = clampMental(state, state.resources.mental + BINGE_MENTAL_GAIN);
  return `${pick(BINGE_LINES)} (바디게이지 -${before - bp.gauge})`;
}

/** 예약한 스튜디오 — 시작 안내와 결과 카톡이 같은 이름을 쓴다. */
export const STUDIO_NAME = "스튜디오 원컷";

/**
 * 촬영일 결과를 스튜디오 카톡으로 알린다.
 *
 * ⚠️ **이 알림이 없으면 도전이 조용히 사라진다.** 예전엔 addSchedule 한 줄이 전부였는데,
 *    일정은 SCHEDULE_MAX(100) 상한이라 30일치 활동에 금세 밀려난다. 무산일 때는 자동 트윗도
 *    팔로워 증가도 없어서 화면에 흔적이 아예 남지 않았다("기간 끝났는데 아무것도 안 뜬다").
 *    pushKakao는 toastPending까지 세워 토스트로도 한 번 알린다 — 그게 이 고침의 핵심이다.
 */
function sendResultKakao(
  state: GameState,
  gauge: number,
  binges: number,
  success: boolean,
): void {
  const lines = success
    ? [
        "촬영 잘 끝났습니다! 오늘 컨디션 최고셨어요 👏",
        `한 달 전에 오셨을 때랑 완전 다른 몸이에요. 게이지 ${gauge}/${BODY_GAUGE_MAX} 꽉 채우신 분 오랜만입니다.`,
        "보정본은 일주일 뒤에 드릴게요. 원본 몇 장 먼저 보냅니다 📸",
      ]
    : [
        "오늘 촬영일인데 스튜디오 안 오셨네요 😥",
        `준비 상태 ${gauge}/${BODY_GAUGE_MAX}로 찍으면 서로 아쉬울 것 같아 일정 접었습니다.` +
          (binges > 0 ? ` 중간에 ${binges}번 흔들리셨더라고요.` : ""),
        "예약금은 규정상 환불이 어렵습니다. 다음에 다시 도전하시면 그땐 꼭 찍어드릴게요.",
      ];
  pushKakao(state, STUDIO_NAME, lines, { hue: success ? 28 : 220 });
}

export interface BodyProfileResult {
  success: boolean;
  gauge: number;
  binges: number;
  /** 성공 시 자동 트윗으로 늘어난 팔로워 + 보너스 팔로워의 합 */
  followers: number;
}

/**
 * 촬영일 판정(time.onNewDay에서 호출).
 * 게이지가 가득 찼으면 성공 — **자동으로 트윗이 올라가고**(행동력 무료) 팔로워가 크게 는다.
 * 모자라면 촬영은 무산된다(예약금은 돌려받지 못한다).
 * 판정 전 bodyProfile을 먼저 비워 중복 발동을 차단한다(resolveContest와 같은 계약).
 */
export function resolveBodyProfile(state: GameState): BodyProfileResult | null {
  const bp = state.bodyProfile;
  if (!bp) return null;
  if (state.day < bp.startDay + BODY_PROFILE_DAYS) return null;
  state.bodyProfile = null;

  const success = bp.gauge >= BODY_GAUGE_MAX;
  if (!success) {
    addSchedule(
      state,
      `바디프로필 촬영 무산 (게이지 ${bp.gauge}/${BODY_GAUGE_MAX} · 유혹 ${bp.binges}회)`,
      "system",
    );
    sendResultKakao(state, bp.gauge, bp.binges, false);
    return { success: false, gauge: bp.gauge, binges: bp.binges, followers: 0 };
  }

  // 성공: 촬영 결과를 자랑하는 트윗이 자동으로 올라간다(행동력은 쓰지 않는다).
  const posted = postTweet(state, "fitness", pick(BODY_PROFILE_TWEETS), false, "meetup", 1, {
    free: true,
  });
  changeFollowers(state, BODY_PROFILE_FOLLOWERS);
  gainSkill(state, "beauty", BODY_PROFILE_BEAUTY);
  state.resources.reputation = clampResource(state.resources.reputation + BODY_PROFILE_REP);
  addSchedule(state, "바디프로필 촬영 성공! 결과물이 화제가 됐다", "system");
  sendResultKakao(state, bp.gauge, bp.binges, true);
  return {
    success: true,
    gauge: bp.gauge,
    binges: bp.binges,
    followers: posted.followerDelta + BODY_PROFILE_FOLLOWERS,
  };
}
