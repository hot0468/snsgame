import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import type { ShootScenario } from "@/data/lingerie";
import { LINGERIE_SCENARIOS, LINGERIE_OFFER } from "@/data/lingerie";
import { getActiveAccount } from "@/core/state";
import { chance, pick, randInt, uid } from "@/utils/random";
import { addSchedule, advanceTime } from "./time";
import { applyEffect } from "./events";
import { clampAction } from "./stats";
import { scheduleNextLingerieShoot } from "./appointments";

/**
 * 란제리 모델 전속 계약 흐름.
 * - 매력(beauty)·음란(lewd)이 충분하고 성인모드일 때, 트윗을 올리다 보면 확률적으로
 *   전속 계약 제의 DM이 온다(게임당 1회 제의 — lingerieOffered).
 * - 계약하면 매주 수요일 심야 정기 화보 촬영 약속이 잡힌다(실제 예약은 appointments.ts).
 * - 촬영마다 노출 심한 란제리 화보 시나리오가 랜덤 표출되고, 마지막 선택지가 성인 분기다.
 * - 효과 적용·전속료 수입·행동력 소모·시간 진행·다음 촬영 재예약은 이 파일이 맡는다(data는 '무엇을'만).
 */

/** 전속 계약 제의가 열리는 매력 하한 */
export const LINGERIE_BEAUTY_REQ = 200;
/** 전속 계약 제의가 열리는 음란도 하한 */
export const LINGERIE_LEWD_REQ = 200;

/** 트윗 직후 전속 계약 제의 DM이 올 확률 */
export const LINGERIE_DM_CHANCE = 0.4;

/** 촬영 1회 행동력 소모(심야 촬영) */
export const LINGERIE_SHOOT_ACTION_COST = 12;

/** 화보 촬영 전속료 범위(원) — choice.effect.money와 별개의 기본 촬영 수입 */
export const LINGERIE_SHOOT_FEE_MIN = 200_000;
export const LINGERIE_SHOOT_FEE_MAX = 400_000;

/** 전속 계약 제의가 가능한지 — 성인모드 + 미계약 + 미제의 + 매력·음란 충분 */
export function canOfferLingerie(state: GameState): boolean {
  return (
    state.adultMode &&
    !state.lingerieContract &&
    !state.lingerieOffered &&
    state.skills.beauty >= LINGERIE_BEAUTY_REQ &&
    state.skills.lewd >= LINGERIE_LEWD_REQ
  );
}

/** 이 계정에 이미 란제리 제의 스레드가 있는지 */
function hasLingerieOffer(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.lingerie);
}

/**
 * 트윗 직후 확률적으로 란제리 전속 계약 제의 DM을 생성한다.
 * 조건 미충족·이미 제의·기존 스레드가 있으면 생성하지 않는다.
 * @returns 생성되면 true
 */
export function maybeSpawnLingerieDM(state: GameState): boolean {
  if (!canOfferLingerie(state)) return false;
  const account = getActiveAccount(state);
  if (hasLingerieOffer(account)) return false;
  if (!chance(LINGERIE_DM_CHANCE)) return false;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: "뤼미에르 캐스팅",
    partnerHandle: "lumiere_studio",
    attribute: "adult",
    isAdult: true,
    messages: [
      { id: uid("dmm"), from: "partner", text: LINGERIE_OFFER.pages.join("\n\n"), day: state.day },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    lingerie: true,
  });
  state.lingerieOffered = true;
  return true;
}

/**
 * 란제리 전속 계약을 맺는다. 다음 수요일 심야부터 정기 화보 촬영이 잡힌다.
 * 제의 스레드에 스튜디오가 환영 메시지를 남긴다.
 */
export function signLingerie(state: GameState, thread: DMThread): void {
  state.lingerieContract = true;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: LINGERIE_OFFER.welcome,
    day: state.day,
  });
  thread.unread = true;
  addSchedule(state, "란제리 전속 계약", "system");
  scheduleNextLingerieShoot(state);
}

/** 이번 촬영에 표출할 란제리 화보 시나리오를 랜덤으로 고른다(반복 허용). */
export function pickLingerieScenario(): ShootScenario {
  return pick(LINGERIE_SCENARIOS);
}

/**
 * 란제리 화보 촬영 시나리오의 선택을 확정한다(정기 촬영 처리).
 * resolveCrewSecret 패턴 — 다음 촬영 재예약 → 효과 적용 → 전속료 수입 → 행동력 소모 →
 * 스케줄 기록 → 하루 진행. 재예약을 빼먹으면 정기 촬영 사이클이 끊긴다.
 * @returns 결과 문구(customKey 동적 문구가 있으면 그것, 없으면 choice.result)
 */
export function resolveLingerieShoot(
  state: GameState,
  scenario: ShootScenario,
  choiceIndex: number,
): string {
  const choice = scenario.choices[choiceIndex];
  if (!choice) return "";
  // 정기 일정이므로 다음 주를 먼저 다시 잡는다.
  scheduleNextLingerieShoot(state);
  const dynamic = applyEffect(state, choice.effect);
  const fee = randInt(LINGERIE_SHOOT_FEE_MIN, LINGERIE_SHOOT_FEE_MAX);
  state.money += fee;
  state.resources.action = clampAction(state, state.resources.action - LINGERIE_SHOOT_ACTION_COST);
  addSchedule(state, `란제리 화보 촬영 (+${fee.toLocaleString("ko-KR")}원)`, "offline");
  advanceTime(state, 1);
  return dynamic || choice.result;
}
