import type { ActiveGig, GameState } from "@/core/types";
import { appendSchedule } from "@/core/state";
import type { GigJob } from "@/data/gig";
import { GIG_JOBS } from "@/data/gig";
import { uid } from "@/utils/random";
import { clampAction, clampResource } from "./stats";
import { advanceTime } from "./time";

/** 1회 '작업하기'에 드는 행동력 */
export const GIG_WORK_ACTION = 8;
/** 내 스탯 == reqStat일 때의 회당 진행량(기준값) */
export const GIG_BASE_GAIN = 30;
/** 마감 초과 실패 시 평판 하락(0~100 스케일) */
export const REP_FAIL = 6;

/** id로 외주 원본 스펙을 찾는다(진행 중 건은 id만 들고 있으므로 join용) */
export function jobById(id: string): GigJob | undefined {
  return GIG_JOBS.find((j) => j.id === id);
}

/** 이미 진행 중인 외주인지 */
export function isGigActive(state: GameState, id: string): boolean {
  return state.activeGigs.some((g) => g.id === id);
}

/**
 * 1회 작업 진행량 = round(GIG_BASE_GAIN * 내스탯 / reqStat), 최소 1.
 * 내 스탯이 요구치와 같으면 30, 절반이면 15. 스탯이 높을수록 빨리 끝낸다.
 */
export function gigGain(state: GameState, job: GigJob): number {
  return Math.max(1, Math.round((GIG_BASE_GAIN * state.skills[job.stat]) / job.reqStat));
}

/** 수주 가능 여부. 같은 id가 이미 진행 중이면 "already"(건수 제한은 없음) */
export function canAcceptGig(state: GameState, job: GigJob): "ok" | "already" {
  return isGigActive(state, job.id) ? "already" : "ok";
}

/** 외주 수주 — activeGigs에 진행 건을 추가하고 스케줄에 기록 */
export function acceptGig(state: GameState, job: GigJob): void {
  state.activeGigs.push({ id: job.id, progress: 0, dueDay: state.day + job.deadlineDays });
  appendSchedule(state, {
    id: uid("sch"),
    day: state.day,
    title: `외주 수주: ${job.title}`,
    kind: "offline",
  });
}

export type WorkGate = "ok" | "noaction";

/** 작업 가능 여부(행동력 게이트) */
export function canWorkGig(state: GameState): WorkGate {
  return state.resources.action < GIG_WORK_ACTION ? "noaction" : "ok";
}

/**
 * 진행 중 외주 1건을 1회 작업한다.
 * 행동력 8 소모 + 시간 1슬롯 진행(⚠️ advanceTime이 onNewDay/onLateNight를 유발할 수 있음 — 정상 흐름).
 * 완료(progress >= workload) 시 보상 지급 + 목록에서 제거.
 */
export function workGig(
  state: GameState,
  active: ActiveGig,
): { ok: boolean; label: string; done: boolean } {
  if (canWorkGig(state) !== "ok") {
    return { ok: false, label: "행동력 부족", done: false };
  }
  const job = jobById(active.id);
  if (!job) {
    // 원본 스펙이 사라진 유령 건 — 조용히 제거하고 실패 반환
    state.activeGigs = state.activeGigs.filter((g) => g !== active);
    return { ok: false, label: "외주 정보 없음", done: false };
  }

  state.resources.action = clampAction(state, state.resources.action - GIG_WORK_ACTION);
  advanceTime(state, 1);

  const gain = gigGain(state, job);
  active.progress += gain;

  if (active.progress >= job.workload) {
    state.money += job.reward;
    state.resources.reputation = clampResource(state.resources.reputation + job.reputation);
    state.activeGigs = state.activeGigs.filter((g) => g !== active);
    appendSchedule(state, {
      id: uid("sch"),
      day: state.day,
      title: `외주 완료 +${job.reward.toLocaleString()}원 (${job.title})`,
      kind: "system",
    });
    return { ok: true, label: `완료! +${job.reward.toLocaleString()}원`, done: true };
  }

  return {
    ok: true,
    label: `작업량 +${gain} (${active.progress}/${job.workload})`,
    done: false,
  };
}

/**
 * 마감 정산 — onNewDay에서 호출. day가 dueDay를 넘겼는데 작업량을 못 채운 건은 실패 처리:
 * 위약금 차감 + 평판↓ + 목록 제거. (성공 건은 workGig에서 이미 제거돼 이중 정산 없음)
 */
export function settleGigDeadlines(state: GameState): void {
  const failed = state.activeGigs.filter(
    (g) => state.day > g.dueDay && g.progress < (jobById(g.id)?.workload ?? Infinity),
  );
  if (failed.length === 0) return;
  for (const g of failed) {
    const job = jobById(g.id);
    const penalty = job?.penalty ?? 0;
    state.money -= penalty;
    state.resources.reputation = clampResource(state.resources.reputation - REP_FAIL);
    appendSchedule(state, {
      id: uid("sch"),
      day: state.day,
      title: `외주 마감 초과! 위약금 -${penalty.toLocaleString()}원 (${job?.title ?? g.id})`,
      kind: "system",
    });
  }
  state.activeGigs = state.activeGigs.filter((g) => !failed.includes(g));
}
