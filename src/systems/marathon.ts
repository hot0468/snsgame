import type { GameState } from "@/core/types";
import {
  RACES,
  RACE_DNF_LINES,
  RACE_FINISH_LINES,
  RACE_PODIUM_LINES,
  raceById,
  type Race,
} from "@/data/races";
import { MAX_SKILL } from "@/data/stats";
import { pick, uid } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampResource, STAMINA_RECOVER_BASE, STAMINA_MAX_CAP } from "./stats";
import { addSchedule } from "./time";

/**
 * 마라톤 대회(신청 → 대회일 기록 판정 → 결과 메일).
 * 운동 스킬(0~999)과 체력 한계치(staminaMax)를 '기록'이라는 눈에 보이는 숫자로 바꾸는 축이다.
 *
 * - 신청은 동시 1건(state.pendingRace). 참가비를 내고 appliedDay를 박는다.
 * - 판정은 onNewDay가 appliedDay + RACE_DELAY_DAYS에 1회(resolveRace) — contest.ts와 같은 형태.
 * - 결과 메일은 `contestResult`를 재사용한다 → 피메일의 '트윗하기' 버튼이 그대로 붙는다.
 */

/** 신청 후 대회일까지 걸리는 일수 */
export const RACE_DELAY_DAYS = 7;
/** 입상 시 평판 상승분 */
export const RACE_PODIUM_REP = 5;
/** 운동 스킬 0일 때의 페이스(분/km) */
export const PACE_WORST = 11;
/** 운동 스킬 만렙일 때의 페이스(분/km) */
export const PACE_BEST = 5;
/** 체력 한계치 만렙이 페이스에서 추가로 깎아주는 양(분/km) */
export const PACE_STAMINA_BONUS = 0.8;
/** 기록에 섞이는 컨디션 편차(±비율) — 같은 스펙이어도 대회마다 조금씩 다르다 */
export const PACE_VARIANCE = 0.06;

/** 지금 대회를 신청할 수 있는지(결과 대기 중이 아니어야 한다) */
export function canApplyRace(state: GameState): boolean {
  return state.pendingRace === null;
}

/** 이 코스에 도전할 운동 스킬이 되는지 */
export function meetsRaceRequirement(state: GameState, race: Race): boolean {
  return state.skills.fitness >= race.minFitness;
}

/**
 * 대회에 신청한다.
 * @returns "ok" | "busy"(이미 대기 중) | "poor"(참가비 부족 — 차감 없음) | "weak"(운동 미달)
 */
export function applyRace(state: GameState, race: Race): "ok" | "busy" | "poor" | "weak" {
  if (state.pendingRace !== null) return "busy";
  if (!meetsRaceRequirement(state, race)) return "weak";
  if (race.fee > state.money) return "poor";
  state.money -= race.fee;
  state.pendingRace = { id: race.id, appliedDay: state.day };
  addSchedule(state, `${race.name} 신청 (${RACE_DELAY_DAYS}일 뒤 대회)`, "system");
  return "ok";
}

/**
 * 체력 한계치가 페이스를 얼마나 당겨주는지(0~1). 시작치(200)에서 0, 상한(999)에서 1.
 * ⚠️ 하드코딩 금지 — 상한은 stats.ts가 안다(치트·성장으로 바뀔 수 있다).
 */
function staminaRatio(state: GameState): number {
  const max = state.staminaMax ?? STAMINA_RECOVER_BASE;
  const span = STAMINA_MAX_CAP - STAMINA_RECOVER_BASE;
  if (span <= 0) return 0;
  return Math.max(0, Math.min(1, (max - STAMINA_RECOVER_BASE) / span));
}

/**
 * 이 스펙으로 뛰면 나올 페이스(분/km). 난수를 굴리지 않는 **예상치**라
 * UI가 신청 화면에 그대로 보여줄 수 있다(runRace가 여기에 편차만 얹는다).
 *
 * 운동 스킬이 주 축이고, 체력 한계치가 보조로 당긴다. 장거리일수록 체력 부족이
 * 페이스를 갉아먹는다 — 5km는 운동만으로 되지만 풀코스는 체력이 받쳐야 한다.
 */
export function expectedPace(state: GameState, race: Race): number {
  const fit = Math.max(0, Math.min(MAX_SKILL, state.skills.fitness)) / MAX_SKILL;
  const sta = staminaRatio(state);
  const base = PACE_WORST - (PACE_WORST - PACE_BEST) * fit - PACE_STAMINA_BONUS * sta;
  // 후반 지침: 거리가 길수록, 체력이 낮을수록 페이스가 무너진다(5km 0.06 ~ 풀 0.5 분/km).
  const fatigue = (race.km / 42) * (1 - sta) * 0.5;
  return Math.max(3.5, base + fatigue);
}

/** 예상 기록(분, 반올림) — 신청 화면 안내용 */
export function expectedRecord(state: GameState, race: Race): number {
  return Math.round(expectedPace(state, race) * race.km);
}

/** 기록(분)을 "1시간 23분" 꼴로 */
export function formatRecord(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}시간 ${m}분` : `${m}분`;
}

export interface RaceOutcome {
  race: Race;
  /** 이번 기록(분). 제한 시간을 넘겼으면 완주 실패라도 기록 자체는 남는다 */
  record: number;
  finished: boolean;
  podium: boolean;
  /** 개인 최고 기록 경신 여부(완주했을 때만 갱신한다) */
  best: boolean;
}

/**
 * 대회 당일 기록을 굴린다. 예상 페이스에 ±PACE_VARIANCE 편차를 얹는다.
 * (상태를 바꾸지 않는 순수 계산 — 보상 적용은 resolveRace가 한다.)
 */
export function runRace(state: GameState, race: Race): RaceOutcome {
  const swing = 1 + (Math.random() * 2 - 1) * PACE_VARIANCE;
  const record = Math.max(1, Math.round(expectedPace(state, race) * race.km * swing));
  const finished = record <= race.cutoff;
  const prev = state.raceBests[race.id];
  return {
    race,
    record,
    finished,
    podium: finished && record <= race.podium,
    best: finished && (prev === undefined || record < prev),
  };
}

/**
 * 대회일 판정(time.onNewDay에서 호출).
 * 신청 후 RACE_DELAY_DAYS 경과 시 1회 판정 → 상금·팔로워·평판·개인기록 + 결과 메일.
 * pendingRace를 판정 전 먼저 비워 중복 발동을 차단한다(resolveContest와 같은 계약).
 */
export function resolveRace(state: GameState): RaceOutcome | null {
  const pending = state.pendingRace;
  if (!pending) return null;
  if (state.day < pending.appliedDay + RACE_DELAY_DAYS) return null;
  const race = raceById(pending.id);
  state.pendingRace = null; // 판정 전 먼저 비워 중복 발동 차단
  if (!race) return null;

  const out = runRace(state, race);
  if (out.finished) {
    const mult = out.podium ? 2 : 1;
    state.money += race.prize * mult;
    changeFollowers(state, race.followers * mult);
    if (out.best) state.raceBests[race.id] = out.record;
  }
  if (out.podium) {
    state.resources.reputation = clampResource(state.resources.reputation + RACE_PODIUM_REP);
  }

  const body = out.podium
    ? pick(RACE_PODIUM_LINES)
    : out.finished
      ? pick(RACE_FINISH_LINES)
      : pick(RACE_DNF_LINES);
  state.emails.unshift({
    id: uid("mail"),
    from: race.name,
    subject:
      `[${out.podium ? "입상" : out.finished ? "완주" : "미완주"}] ` +
      `${race.name} 기록 ${formatRecord(out.record)}`,
    body:
      `${body}\n\n기록: ${formatRecord(out.record)} (제한 ${formatRecord(race.cutoff)})` +
      (out.best ? "\n개인 최고 기록을 경신했습니다." : "") +
      (out.finished ? `\n상금 ${(race.prize * (out.podium ? 2 : 1)).toLocaleString("ko-KR")}원` : ""),
    day: state.day,
    read: false,
    // 대회 결과 메일 재사용 — 피메일의 '트윗하기' 버튼이 그대로 붙는다.
    contestResult: { name: race.name, won: out.podium },
  });
  addSchedule(
    state,
    out.finished
      ? `${race.name} ${out.podium ? "입상" : "완주"} · ${formatRecord(out.record)}`
      : `${race.name} 미완주`,
    "system",
  );
  return out;
}

/** 신청 가능한 코스 목록(운동 미달 코스도 잠금 상태로 보여주므로 전량 반환) */
export function allRaces(): Race[] {
  return RACES;
}
