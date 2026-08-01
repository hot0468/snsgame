import type { GameState } from "@/core/types";
import { lecturerLevel, lecturerQuota, lessonPay } from "./lecturer";
import { COACH_STAT_TARGET, coachLevel, coachSalaryOf, teamStrength } from "./coach";
import { avSalaryOf, AV_PAY_PER_DAY } from "./avJob";
import { authorPayPerWork } from "./author";
import { salaryOf } from "./employment";
import { hasJobExperience } from "./jobExperience";
import { jobRankOf, nextRankIn } from "@/data/jobs";

/**
 * 직업 도감 — '직업 보기' 화면(ui/jobLevelModal.ts) 하나가 이 셀렉터만 읽는다.
 *
 * 크리처·요리 도감과 같은 규칙이다: **직업 전체를 항상 보여주고**, 안 해본 직업은 잠근 채
 * '어떻게 시작하는지'만 알려준다. 목록에서 사라지면 그런 직업이 있는 줄도 모른다.
 *
 * 레벨의 근거는 직업마다 **이미 저장돼 있던 누적값**이다(레벨용 새 필드를 만들지 않는다):
 * - 회사원: 성과 레벨(`employment.perfLevel`) = 직급. 유일하게 월급에 직접 연동된 기존 레벨.
 * - 강사: 누적 수업 ÷ 5 · AV배우: 누적 근무 ÷ 5 · 청부업: 완료 임무 ÷ 5
 * - 웹툰작가: 정산 개월수(연차)
 *
 * ⚠️ **알바는 여기 넣지 않는다.** 알바는 계약도 재직도 없는 단발 활동이라 '직업'이 아니고,
 *    넣으면 도감의 절반이 알바로 채워져 진짜 직업 진행도가 묻힌다(사용자 확정).
 *    알바 숙련은 현생 살기 화면이 일당으로 이미 보여준다.
 *
 * ⚠️ 해금 판정은 **상태가 아니라 이력**(`jobsExperienced`)이다. 회사·AV·강사는 그만두면
 *    상태가 지워져서, 상태로 판정하면 해봤던 칸이 도로 잠긴다.
 * ⚠️ 성인 직업(AV)은 성인물 보기가 꺼져 있으면 목록에서 뺀다 — 단, 이미 해봤으면 남긴다
 *    (해금한 도감 칸이 설정 하나로 사라지면 그게 더 이상하다).
 */
export interface JobCatalogEntry {
  id: string;
  emoji: string;
  label: string;
  /** 아직 안 해봤을 때 보여줄 '시작하는 법' */
  hint: string;
  /** 성인물 보기가 켜져 있을 때만 노출 */
  adultOnly?: boolean;
}

export interface JobLevelRow extends JobCatalogEntry {
  /** 한 번이라도 해봤는지(도감 해금) */
  unlocked: boolean;
  /** 지금 그 일을 하고 있는지 */
  active: boolean;
  level: number;
  /** 해금됐을 때 레벨 아래에 붙는 한 줄(진행도·보수). 잠겼으면 `hint`를 쓴다. */
  detail: string;
}

/** 누적 횟수 → 레벨. 5회마다 1레벨(0부터) — 회사원(성과 레벨)을 뺀 전 직업이 같은 곡선이다. */
export const COUNT_PER_LEVEL = 5;

export function levelFromCount(count: number): number {
  return Math.floor(count / COUNT_PER_LEVEL);
}

/**
 * 직업 카탈로그(표시 순서) — 도감에 뜨는 전부다.
 *
 * ⚠️ hint에 **수치 기준을 적지 마라**(지식 400 같은 것). 채용 공고가 심사 기준을 숫자로
 *    적어두는 일은 없고, 적는 순간 게임이 계산기가 된다 — 이비에듀 배너와 같은 원칙이다.
 */
export const JOB_CATALOG: JobCatalogEntry[] = [
  {
    id: "office",
    emoji: "🏢",
    label: "회사원",
    hint: "채용공고에 지원해 합격하면 출근한다",
  },
  {
    id: "lecturer",
    emoji: "🎓",
    label: "이비에듀 강사",
    hint: "이비에듀 강사 모집에 지원한다 (아는 게 깊어야 한다)",
  },
  {
    id: "author",
    emoji: "🖊️",
    label: "웹툰작가",
    hint: "창작 트윗을 쌓으면 계약 제의가 온다",
  },
  {
    id: "av",
    emoji: "🎬",
    label: "AV배우",
    hint: "성인 트윗을 쌓으면 제의 DM이 온다",
    adultOnly: true,
  },
  {
    id: "coach",
    emoji: "🏐",
    label: "배구부 코치",
    hint: "몸을 꾸준히 만들면 학교에서 섭외 카톡이 온다",
  },
  {
    id: "killer",
    emoji: "🔪",
    label: "청부업",
    hint: "어떤 제안을 받아들이면 시작된다",
  },
];

function won(n: number): string {
  return `${n.toLocaleString("ko-KR")}원`;
}

/** 고정 직업 한 칸의 해금 후 상태(레벨·진행도). 안 해본 직업이면 호출되지 않는다. */
function unlockedDetail(state: GameState, id: string): { level: number; detail: string; active: boolean } {
  switch (id) {
    case "office": {
      const emp = state.employment;
      if (!emp) return { level: 0, detail: "지금은 무직 (이력 있음)", active: false };
      const next = nextRankIn(emp.perfLevel);
      return {
        level: emp.perfLevel,
        active: true,
        detail:
          `${emp.company} ${jobRankOf(emp.perfLevel)} · 성과 ${Math.round(emp.performance)}/100 · ` +
          `월급 ${won(salaryOf(state))} (고정급)` +
          (next ? ` · 다음 승진 ${next}` : " · 최고 직급"),
      };
    }
    case "lecturer": {
      const lec = state.lecturerJob;
      if (!lec) return { level: 0, detail: "지금은 강단을 떠나 있다 (이력 있음)", active: false };
      return {
        level: lecturerLevel(state),
        active: true,
        detail:
          `이번 달 ${lec.lessonsThisMonth}/${lecturerQuota(state)}회 · 누적 ${lec.totalLessons}회 · ` +
          `회당 ${won(lessonPay(state))}`,
      };
    }
    case "author": {
      const a = state.authorContract;
      if (!a) return { level: 0, detail: "지금은 계약이 없다 (이력 있음)", active: false };
      return {
        level: a.monthsWorked,
        active: true,
        detail:
          `${a.monthsWorked}개월차 · 이번 달 작업 ${a.worksThisMonth}회 · ` +
          `회당 ${won(authorPayPerWork(state))}`,
      };
    }
    case "av": {
      const av = state.avJob;
      if (!av) return { level: 0, detail: "지금은 계약이 없다 (이력 있음)", active: false };
      return {
        level: levelFromCount(av.totalWorkDays),
        active: true,
        detail:
          `이번 달 ${av.workDaysThisMonth}회 · 누적 ${av.totalWorkDays}회 · ` +
          `회당 ${won(AV_PAY_PER_DAY)} (이번 달 ${won(avSalaryOf(state))})`,
      };
    }
    case "coach": {
      const c = state.coachJob;
      if (!c) return { level: 0, detail: "지금은 팀을 맡고 있지 않다 (이력 있음)", active: false };
      const pending =
        c.pendingRaise > 0
          ? ` · ${c.pendingRaiseYear}년부터 +${won(c.pendingRaise)}`
          : "";
      return {
        level: coachLevel(state),
        active: true,
        detail:
          `팀 완성도 ${teamStrength(state)}/${COACH_STAT_TARGET} · 누적 훈련 ${c.totalTrainings}회 · ` +
          `월급 ${won(coachSalaryOf(state))}` +
          (c.championships > 0 ? ` · 전국체전 ${c.championships}회 우승` : "") +
          pending,
      };
    }
    case "killer": {
      const k = state.killerJob;
      if (!k) return { level: 0, detail: "손을 뗐다 (이력 있음)", active: false };
      return {
        level: levelFromCount(k.completed),
        active: !!k.active,
        detail: `완료 ${k.completed}건 · 실패 ${k.fails}건 (건당 정산)`,
      };
    }
    default:
      return { level: 0, detail: "", active: false };
  }
}

export function jobLevelRows(state: GameState): JobLevelRow[] {
  const rows: JobLevelRow[] = [];

  for (const entry of JOB_CATALOG) {
    const unlocked = hasJobExperience(state, entry.id);
    // 성인 직업은 성인물 보기 OFF면 숨긴다(이미 해본 칸은 남긴다 — 해금이 설정으로 사라지면 안 된다).
    if (entry.adultOnly && !state.adultMode && !unlocked) continue;
    if (!unlocked) {
      rows.push({ ...entry, unlocked: false, active: false, level: 0, detail: entry.hint });
      continue;
    }
    const { level, detail, active } = unlockedDetail(state, entry.id);
    rows.push({ ...entry, unlocked: true, active, level, detail });
  }

  return rows;
}
