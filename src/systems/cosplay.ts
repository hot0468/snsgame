import type { GameState, PlayerAccount } from "@/core/types";
import type { ShootScenario } from "@/data/cosplay";
import {
  COSPLAY_ADULT_SCENARIOS,
  COSPLAY_OFFER,
  COSPLAY_GENERAL_RESULTS,
} from "@/data/cosplay";
import { getActiveAccount } from "@/core/state";
import { charmLevel } from "./meeting";
import { chance, pick, randInt, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { applyEffect } from "./events";
import { clampAction, gainSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 코스프레 촬영 제의 흐름.
 * - 애니덕(anime) 트윗을 일정 수 이상 올리면 확률적으로 촬영 제의 DM이 온다(전연령 톤).
 * - 계약이 아니라 반복 제의라, 촬영을 마치면 스레드가 소진되고 이후 다시 제의가 올 수 있다.
 * - 수락하면 촬영. 성인모드면 촬영 전 의상 선택(일반/노출) — 일반(또는 성인 OFF)은 전연령 결과,
 *   노출은 촬영 후 성인 시나리오 분기로 이어진다(성인 경로는 adultMode에서만 UI가 연다).
 */

/** 코스프레 촬영 제의가 열리는 애니덕 트윗 누적 문턱 */
export const COSPLAY_ANIME_REQ = 10;

/** 애니덕 트윗 직후 촬영 제의 DM이 올 확률(쿨다운이 없어 처리 직후 재제의가 잦았다 → 0.35에서 낮춤) */
export const COSPLAY_DM_CHANCE = 0.12;

/** 촬영 제의 사이 최소 간격(일) — 지난 제의 이후 이 기간이 지나야 다시 온다. */
export const COSPLAY_COOLDOWN_DAYS = 14;

/** 촬영 제의가 오기 위한 최소 매력(0~100, 미용·음란 평균) — 스튜디오는 매력 있는 계정에 연락한다. */
export const COSPLAY_CHARM_REQ = 40;

/** 촬영 1회 행동력 소모 */
export const COSPLAY_ACTION_COST = 12;

/** 전연령 촬영 촬영비 범위(원, 소액) */
export const COSPLAY_GENERAL_FEE_MIN = 30_000;
export const COSPLAY_GENERAL_FEE_MAX = 80_000;

/** 성인 촬영 촬영비 범위(원) — choice.effect.money와 별개의 기본 촬영 수입 */
export const COSPLAY_ADULT_FEE_MIN = 100_000;
export const COSPLAY_ADULT_FEE_MAX = 250_000;

/** 이 계정에 이미 (미처리) 코스프레 제의 스레드가 있는지 */
function hasCosplayOffer(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.cosplay);
}

/**
 * 애니덕 트윗 직후 확률적으로 코스프레 촬영 제의 DM을 생성한다.
 * 애니덕 트윗이 문턱 미만이거나, 아직 처리 안 한 제의 스레드가 있으면 생성하지 않는다.
 * 전연령이라 isAdult=false(성인 DM 숨김 필터 대상 아님) — adultMode와 무관하게 발생한다.
 * @returns 생성되면 true
 */
export function maybeSpawnCosplayDM(state: GameState): boolean {
  if (state.animeTweetsPosted < COSPLAY_ANIME_REQ) return false;
  // 매력(미용·음란 평균)이 문턱 미만이면 오지 않는다 — 스튜디오는 매력 있는 계정에만 연락한다.
  if (charmLevel(state) < COSPLAY_CHARM_REQ) return false;
  // 최소 쿨다운 — 지난 제의 이후 COSPLAY_COOLDOWN_DAYS일이 지나야 다시 온다(처리 직후 재제의 방지).
  // lastCosplayDay 0 = 아직 한 번도 안 옴 → 쿨다운 미적용(첫 제의는 막지 않는다).
  if (state.lastCosplayDay > 0 && state.day - state.lastCosplayDay < COSPLAY_COOLDOWN_DAYS) {
    return false;
  }
  const account = getActiveAccount(state);
  if (hasCosplayOffer(account)) return false;
  if (!chance(COSPLAY_DM_CHANCE)) return false;

  state.lastCosplayDay = state.day;
  account.dms.unshift({
    id: uid("dm"),
    partnerName: "코스레이 스튜디오",
    partnerHandle: "cosray_studio",
    attribute: "anime",
    isAdult: false,
    messages: [
      { id: uid("dmm"), from: "partner", text: COSPLAY_OFFER.pages.join("\n\n"), day: state.day },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    cosplay: true,
  });
  return true;
}

/**
 * 촬영을 마친 코스프레 제의 스레드를 소진 처리한다(cosplay 플래그 해제).
 * 대화 기록은 남기되 재제의(maybeSpawnCosplayDM)가 다시 뜰 수 있게 한다.
 */
function consumeCosplayOffer(state: GameState): void {
  for (const t of getActiveAccount(state).dms) {
    if (t.cosplay) t.cosplay = false;
  }
}

/**
 * 전연령 코스프레 촬영 결과 — 팔로워↑·미용/덕질 스킬↑·소액 촬영비·행동력 소모·하루 진행.
 * 성인 OFF이거나, 성인모드에서 '일반 의상'을 고른 경우 이 경로로 처리된다.
 * @returns 결과 문구(COSPLAY_GENERAL_RESULTS pick + 획득 요약)
 */
export function resolveCosplayGeneral(state: GameState): string {
  consumeCosplayOffer(state);
  const fee = randInt(COSPLAY_GENERAL_FEE_MIN, COSPLAY_GENERAL_FEE_MAX);
  state.money += fee;
  gainSkill(state, "beauty", 12);
  gainSkill(state, "otaku", 10);
  const followers = randInt(20, 60);
  changeFollowers(state, followers);
  state.resources.action = clampAction(state, state.resources.action - COSPLAY_ACTION_COST);
  addSchedule(state, `코스프레 촬영 (+${fee.toLocaleString("ko-KR")}원)`, "offline");
  advanceTime(state, 1);
  return (
    pick(COSPLAY_GENERAL_RESULTS) +
    `\n\n(팔로워 +${followers} · +${fee.toLocaleString("ko-KR")}원)`
  );
}

/** 이번 성인 코스프레 촬영에 표출할 시나리오를 랜덤으로 고른다(반복 허용). */
export function pickCosplayAdultScenario(): ShootScenario {
  return pick(COSPLAY_ADULT_SCENARIOS);
}

/**
 * 성인 코스프레 촬영 시나리오의 선택을 확정한다(노출 의상 경로 — adultMode에서만 UI가 연다).
 * 효과 적용 → 촬영비 수입 → 행동력 소모 → 하루 진행 → 결과 문구.
 * @returns 결과 문구(customKey 동적 문구가 있으면 그것, 없으면 choice.result)
 */
export function resolveCosplayAdult(
  state: GameState,
  scenario: ShootScenario,
  choiceIndex: number,
): string {
  const choice = scenario.choices[choiceIndex];
  if (!choice) return "";
  consumeCosplayOffer(state);
  const dynamic = applyEffect(state, choice.effect);
  const fee = randInt(COSPLAY_ADULT_FEE_MIN, COSPLAY_ADULT_FEE_MAX);
  state.money += fee;
  state.resources.action = clampAction(state, state.resources.action - COSPLAY_ACTION_COST);
  addSchedule(state, `코스프레 성인 촬영 (+${fee.toLocaleString("ko-KR")}원)`, "offline");
  advanceTime(state, 1);
  return dynamic || choice.result;
}
