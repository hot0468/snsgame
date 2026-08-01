import type { GameState } from "@/core/types";
import { ESTHETIC_AD_MAIL, ESTHETIC_SCAM_LINES, ESTHETIC_VISIT_LINES } from "@/data/esthetic";
import { chance, pick, uid } from "@/utils/random";
import { clampAction, clampResource, gainSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";
import { scheduleNextEsthetic } from "./appointments";
import { pushEmail } from "@/core/state";

/**
 * 에스테틱 정기권 (평판 분기 사기).
 * - 현생 '꾸미기' 활동 직후 확률로 저렴한 정기권 광고 메일이 온다(maybeSpawnEstheticAd).
 * - 신청 시 평판으로 갈린다(applyEsthetic):
 *   · 평판 ≥ 50(정품): 매주 화요일 낮 방문, 관리비 1만원 → 현생 꾸미기 매력 1.5배(estheticBeautyMult).
 *   · 평판 < 50(사기): 일시불 30만원 결제 → 7일 뒤 방문하려니 이미 폐업, 돈만 날림(checkEstheticScam).
 *
 * 크루(crew.ts)/스터디(studyGroup.ts) 패턴 — 스케줄러/불참 처리는 appointments.ts에,
 * 유입·가입·방문 로직은 여기. '간다'는 UI(appointmentModal)가 resolveEsthetic으로 가로챈다.
 */

/** 정품 회원이 되는 평판 문턱(미만이면 사기 분기) */
export const ESTHETIC_REP_THRESHOLD = 50;
/** 정품 회원 매주 방문 관리비 */
export const ESTHETIC_WEEKLY_COST = 10_000;
/** 평판 낮을 때 결제하는 정기권 일시불(사기, 전액 손실) */
export const ESTHETIC_SCAM_COST = 300_000;
/** 정품 회원일 때 현생 꾸미기 매력 상승 배수 */
export const ESTHETIC_BEAUTY_MULT = 1.5;
/** 꾸미기 활동 직후 광고 메일이 올 확률 */
export const ESTHETIC_AD_CHANCE = 0.4;
/** 사기 결제 후 폐업이 드러나기까지의 일수(다음 주 방문일) */
export const ESTHETIC_SCAM_DELAY = 7;
/** 정품 회원 방문 시 오르는 소량 매력 */
export const ESTHETIC_VISIT_BEAUTY = 6;
/** 방문 1회 행동력 소모(appointmentModal 기본 약속 비용과 일치) */
export const ESTHETIC_VISIT_ACTION = 10;
/** 폐업 폭로 시 하락하는 정신력 */
export const ESTHETIC_SCAM_MENTAL = 6;
/** 폐업 폭로 시 하락하는 평판 */
export const ESTHETIC_SCAM_REP = 4;

/** 광고·폐업 메일 발신자 표기 */
const ESTHETIC_AD_FROM = "에스테틱 정기권";

/**
 * 꾸미기 활동 직후 확률적으로 에스테틱 정기권 광고 메일을 수신함에 넣는다.
 * 이미 정품 회원이거나, 사기가 진행 중이거나, 안 읽은 에스테틱 메일이 이미 있으면 넣지 않는다.
 * (offline.doOfflineActivity의 꾸미기 활동에서 호출)
 * @returns 생성되면 true
 */
export function maybeSpawnEstheticAd(state: GameState): boolean {
  if (state.estheticMember) return false;
  if (state.estheticScamDay !== 0) return false;
  if (state.emails.some((e) => e.esthetic)) return false;
  if (!chance(ESTHETIC_AD_CHANCE)) return false;

  pushEmail(state, {
    id: uid("mail"),
    from: ESTHETIC_AD_FROM,
    subject: ESTHETIC_AD_MAIL.subject,
    body: ESTHETIC_AD_MAIL.body,
    day: state.day,
    read: false,
    esthetic: true,
  });
  return true;
}

/**
 * 정기권을 신청한다. 평판으로 정품/사기가 갈린다(신청 메일 소비/제거는 UI가 한다).
 * - 평판 ≥ 문턱: 정품 회원 등록 + 매주 화요일 방문 예약.
 * - 평판 < 문턱: 30만원 일시불 결제(사기) + 7일 뒤 폐업 예정. 신청 시엔 정상 결제처럼 보인다.
 * @returns "member"(정품) | "scam"(사기)
 */
export function applyEsthetic(state: GameState): "member" | "scam" {
  // 신청한 광고 메일은 소비한다 — 안 지우면 사기 폐업(scamDay→0) 후 버튼이 되살아나 재사기가 열린다.
  state.emails = state.emails.filter((e) => !e.esthetic);
  if (state.resources.reputation >= ESTHETIC_REP_THRESHOLD) {
    state.estheticMember = true;
    addSchedule(state, "에스테틱 정기권 등록", "system");
    scheduleNextEsthetic(state);
    return "member";
  }
  state.money -= ESTHETIC_SCAM_COST;
  state.estheticScamDay = state.day + ESTHETIC_SCAM_DELAY;
  addSchedule(state, "에스테틱 정기권 일시불 결제", "system");
  return "scam";
}

/**
 * 이번 주 에스테틱 방문을 처리한다(appointmentModal '간다' 경로가 호출).
 * 관리비 1만원 + 소량 매력 + 하루 진행 + 다음 주 재예약(빼먹으면 정기 사이클이 끊긴다 — crew 패턴).
 * @returns 결과 문구(ESTHETIC_VISIT_LINES에서 선택)
 */
export function resolveEsthetic(state: GameState): string {
  // 정기 일정이므로 다음 주를 먼저 다시 잡는다(resolveCrewRun과 동일 순서).
  scheduleNextEsthetic(state);
  state.money -= ESTHETIC_WEEKLY_COST;
  state.resources.action = clampAction(state, state.resources.action - ESTHETIC_VISIT_ACTION);
  gainSkill(state, "beauty", ESTHETIC_VISIT_BEAUTY);
  addSchedule(state, "에스테틱 정기권 방문 (관리비 1만원)", "offline");
  advanceTime(state, 1);
  return pick(ESTHETIC_VISIT_LINES);
}

/**
 * 사기 폐업 이벤트를 점검한다(time.onNewDay에서 호출).
 * 결제 후 estheticScamDay(=결제일+7)에 도달하면 폐업을 폭로한다: 이미 결제한 30만원이 날아가고
 * (돈은 결제 시점에 이미 차감됨), 정신력·평판이 소폭 하락한다. 처리 후 scamDay를 0으로 되돌려
 * 1회만 발동한다.
 * @returns 이번에 폐업을 폭로했으면 true
 */
export function checkEstheticScam(state: GameState): boolean {
  if (state.estheticScamDay <= 0 || state.day < state.estheticScamDay) return false;
  state.estheticScamDay = 0;
  pushEmail(state, {
    id: uid("mail"),
    from: ESTHETIC_AD_FROM,
    subject: "[안내] 에스테틱 폐업 공지",
    body: pick(ESTHETIC_SCAM_LINES),
    day: state.day,
    read: false,
  });
  addSchedule(state, "에스테틱 폐업 — 정기권 30만원 날림", "system");
  state.resources.mental = clampResource(state.resources.mental - ESTHETIC_SCAM_MENTAL);
  state.resources.reputation = clampResource(state.resources.reputation - ESTHETIC_SCAM_REP);
  return true;
}

/** 현생 꾸미기 매력 상승 배수 — 정품 회원이면 1.5배, 아니면 1(offline이 곱한다). */
export function estheticBeautyMult(state: GameState): number {
  return state.estheticMember ? ESTHETIC_BEAUTY_MULT : 1;
}
