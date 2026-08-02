import type { Email, GameState } from "@/core/types";
import { uid } from "@/utils/random";
import { hasAnyJob, inJobGap, quitCurrentJob } from "./employment";
import { clampMental, gainSkill, skillTo100 } from "./stats";
import { recordMission } from "./missions";
import { addSchedule } from "./time";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { pushEmail } from "@/core/state";

/**
 * 이비에듀 강사직.
 *
 * - 이비에듀에서 **강사 모집 지원** → 익일 피메일로 합/불합 통보 → 합격 메일의 '출근한다'로 채용 확정.
 *   (지원은 누구나 넣을 수 있고, 지식이 기준 미달이면 불합격 메일이 온다.)
 * - **겸직 불가**: 지원은 막지 않되, 합격 메일에서 출근할 때 기존 직업 정리를 묻는다.
 *   지원만 해두고 잊었다가 직장을 잃는 일이 없어야 한다.
 * - 근무는 '현생 살기 → 수업하기'. **시간대·요일 제약이 없다** — 한 달 안에 정해진 회차만 채우면 된다.
 * - 월급은 매월 15일, **이번 달 수업 횟수 × 회당 강사료**로 지급한다(회사 10일·AV 25일과 안 겹친다).
 * - 레벨이 오를수록 월 필수 회차가 줄어든다. 레벨은 누적 수업 횟수에서 파생된다(`lecturerLevel`).
 *
 * ⚠️ 회차를 채우면 '필수 달성'일 뿐 월급이 고정되는 게 아니다. 더 하면 더 받는다 —
 *    미달이어도 한 회차분은 나온다(무노동 무임금이지 벌금이 아니다).
 */

/** 강사 신청이 통과되는 지식 기준(0~999 스케일) */
export const LECTURER_REQ_KNOWLEDGE = 400;

/** 수업 1회 기본 강사료 */
export const LECTURER_PAY_BASE = 30_000;
/** 가중 스탯 1점당 회차 강사료 가산 */
export const LECTURER_PAY_PER_POINT = 150;

/**
 * 회차 강사료 산정 가중치. 합이 1.0이라 가중합이 스킬과 같은 0~999 스케일을 유지한다.
 * ⚠️ 합을 1이 아니게 바꾸면 강사료가 통째로 어긋난다(employment.TRACK_WEIGHTS와 같은 규칙).
 */
export const LECTURER_WEIGHTS = { knowledge: 0.5, vocabulary: 0.3, comedy: 0.2 } as const;

/** 레벨 0의 월 필수 수업 회차 */
export const LECTURER_BASE_QUOTA = 12;
/** 레벨이 아무리 올라도 이 아래로는 안 내려간다 */
export const LECTURER_MIN_QUOTA = 6;
/** 이 횟수를 누적할 때마다 레벨 1 */
export const LECTURER_LESSONS_PER_LEVEL = 5;

/** 수업 1회 행동력 소모 — 현생 활동 정의(`systems/offline.ts`)와 값을 맞춰야 한다. */
export const LECTURE_ACTION_COST = 12;

/** 강사 레벨(0부터). 누적 수업 횟수에서 파생 — 별도 저장 필드를 두지 않는다. */
export function lecturerLevel(state: GameState): number {
  const job = state.lecturerJob;
  if (!job) return 0;
  return Math.floor(job.totalLessons / LECTURER_LESSONS_PER_LEVEL);
}

/** 이번 달 필수 수업 회차 — 레벨 1당 1회씩 준다(하한 `LECTURER_MIN_QUOTA`). */
export function lecturerQuota(state: GameState): number {
  return Math.max(LECTURER_MIN_QUOTA, LECTURER_BASE_QUOTA - lecturerLevel(state));
}

/** 회차 강사료 — 지식·어휘력·개그 가중합에 비례한다. */
export function lessonPay(state: GameState): number {
  const s = state.skills;
  const weighted =
    s.knowledge * LECTURER_WEIGHTS.knowledge +
    s.vocabulary * LECTURER_WEIGHTS.vocabulary +
    s.comedy * LECTURER_WEIGHTS.comedy;
  return LECTURER_PAY_BASE + Math.round(weighted) * LECTURER_PAY_PER_POINT;
}

/** 이번 달 지금까지 쌓인 강사 월급(표시=실지급). */
export function lecturerSalaryOf(state: GameState): number {
  const job = state.lecturerJob;
  if (!job) return 0;
  return job.lessonsThisMonth * lessonPay(state);
}

/** 강사 신청 자격 — 지식만 본다(겸직 여부는 `canApplyLecturer`가 따로 본다). */
export function meetsLecturerBar(state: GameState): boolean {
  return state.skills.knowledge >= LECTURER_REQ_KNOWLEDGE;
}

/** 지금 강사 신청을 넣을 수 있는지(이미 강사·다른 직업 보유·경력 공백 중이면 불가). */
export function canApplyLecturer(state: GameState): boolean {
  return !state.gameOver && !state.lecturerJob && !hasAnyJob(state) && !inJobGap(state);
}

/* ─────────────────── 지원 → 익일 결과 메일 ─────────────────── */

/** 아직 응답하지 않은 강사 합격 메일이 수신함에 있는지. */
export function hasPendingLecturerOffer(state: GameState): boolean {
  return state.emails.some((e) => e.lecturerOffer);
}

/**
 * 지금 강사 모집에 지원할 수 있는지.
 *
 * ⚠️ **지식 미달을 여기서 막지 않는다.** 미달이면 익일 불합격 메일이 오는 게 이 흐름의 요점이다
 *    (막아버리면 '합/불합'이 성립하지 않고 메일이 늘 합격 통보가 된다).
 * ⚠️ **겸직도 막지 않는다.** 기존 직업 정리는 합격 메일에서 출근할 때 묻는다.
 * 막는 건 중복 지원(대기 중인 지원·미응답 합격 메일)과 이미 강사인 경우뿐이다.
 */
export function canSubmitLecturerApp(state: GameState): boolean {
  return (
    !state.gameOver &&
    !state.lecturerJob &&
    !state.pendingLecturerApp &&
    !hasPendingLecturerOffer(state)
  );
}

/**
 * 강사 모집에 지원한다. 결과는 즉시 나오지 않고 익일 피메일로 통보된다.
 * 합격 여부는 **지원 시점의 지식**으로 확정한다(pendingJobApp과 같은 규칙 —
 * 통보 시점에 다시 판정하면 "지원 후 밤새 공부해서 통과"가 되어 심사라는 서사가 깨진다).
 */
export function submitLecturerApplication(state: GameState): void {
  state.pendingLecturerApp = { hired: meetsLecturerBar(state), resultDay: state.day + 1 };
  addSchedule(state, "이비에듀 강사 지원서 제출", "system");
}

/**
 * 결과일이 되면 합격/불합격 메일을 수신함에 넣는다. `time.onNewDay`에서 매일 호출된다.
 * 합격 메일에는 `lecturerOffer`가 붙어 ui가 '출근한다/안 한다'를 렌더한다.
 */
export function deliverLecturerResultEmail(state: GameState): void {
  const app = state.pendingLecturerApp;
  if (!app || state.day < app.resultDay) return;
  state.pendingLecturerApp = null;

  const email: Email = app.hired
    ? {
        id: uid("mail"),
        from: "이비에듀 강사지원센터",
        subject: "[합격] 이비에듀 강사 채용 심사 결과 안내",
        body:
          "안녕하세요, 이비에듀 강사지원센터입니다.\n\n" +
          "강사 모집에 지원해 주셔서 감사합니다. 제출해 주신 내용을 검토한 결과 " +
          "합격하셨음을 안내드립니다!\n\n" +
          "출근 의사를 아래 버튼으로 알려주세요. '출근한다'를 누르시면 그날부터 수업을 맡으시게 됩니다. " +
          "수업은 '현생 살기 → 일' 탭에서 진행하시면 되고, 시간대와 요일은 자유입니다.",
        day: state.day,
        read: false,
        lecturerOffer: true,
      }
    : {
        id: uid("mail"),
        from: "이비에듀 강사지원센터",
        subject: "[불합격] 이비에듀 강사 채용 심사 결과 안내",
        body:
          "안녕하세요, 이비에듀 강사지원센터입니다.\n\n" +
          "강사 모집에 지원해 주셔서 감사합니다. 아쉽게도 이번에는 함께하지 못하게 되었습니다.\n\n" +
          "저희는 폭넓고 깊은 지식을 갖춘 분을 찾고 있습니다. 더 쌓으신 뒤 다시 지원해 주세요.",
        day: state.day,
        read: false,
      };

  pushEmail(state, email);
  addSchedule(state, app.hired ? "강사 합격 메일 도착" : "강사 결과 메일 도착", "system");
}

/**
 * 합격 메일의 '출근한다'. 겸직 중이면 기존 직업을 정리하고 갈아탄다(호출부가 먼저 확인을 받는다).
 * 응답한 메일의 오퍼 표식은 지워 버튼이 사라지게 한다.
 */
export function acceptLecturerOffer(state: GameState, mailId: string): LecturerApplyResult {
  const mail = state.emails.find((e) => e.id === mailId);
  if (!mail?.lecturerOffer) return "busy";
  delete mail.lecturerOffer;
  // ⚠️ 합격은 이미 확정됐다 — 여기서 지식을 다시 보지 않는다(합격 통보 후 지식이 떨어져도 채용은 유효).
  if (hasAnyJob(state)) quitCurrentJob(state);
  hireLecturer(state);
  return "hired";
}

/** 합격 메일의 '안 한다'. 오퍼만 지우고 아무 상태도 바꾸지 않는다. */
export function declineLecturerOffer(state: GameState, mailId: string): void {
  const mail = state.emails.find((e) => e.id === mailId);
  if (mail) delete mail.lecturerOffer;
}

/**
 * 강사 신청 결과.
 * - `hired`: 채용됨
 * - `low`: 지식 미달
 * - `busy`: 겸직 불가(다른 직업 재직 중)
 */
export type LecturerApplyResult = "hired" | "low" | "busy";

/**
 * 강사 채용 확정 — **상태 생성만** 한다. 자격·겸직 판정은 호출부 몫이다.
 * `applyLecturer`(즉시 채용 경로)와 `acceptLecturerOffer`(합격 메일 출근)가 공유한다.
 */
function hireLecturer(state: GameState): void {
  state.lecturerJob = {
    hiredDay: state.day,
    lessonsThisMonth: 0,
    totalLessons: 0,
    lastSalaryMonth: -1,
  };
  markJobExperienced(state, JOB_ID.lecturer); // 직업 도감 해금(사직해도 남는다)
  addSchedule(state, "이비에듀 강사 채용", "system");
}

/**
 * 즉시 채용 경로 — 지식이 기준을 넘고 겸직이 아니면 그 자리에서 채용한다.
 * ⚠️ 이비에듀 화면은 이제 이 경로를 쓰지 않는다(지원 → 익일 메일 → 출근).
 *    자격·겸직 가드의 계약을 지키는 지점으로 남겨둔다.
 */
export function applyLecturer(state: GameState): LecturerApplyResult {
  if (state.lecturerJob || hasAnyJob(state)) return "busy";
  if (!meetsLecturerBar(state)) return "low";
  hireLecturer(state);
  return "hired";
}

/** 강사 사직 — 다른 직업으로 갈아탈 때 호출된다(`employment.quitCurrentJob`과 짝). */
export function quitLecturer(state: GameState): void {
  if (!state.lecturerJob) return;
  state.lecturerJob = null;
  addSchedule(state, "이비에듀 강사 사직", "system");
}

export interface LessonResult {
  /** 이번 수업으로 받은(=이번 달 누적에 더해질) 회차 강사료 */
  pay: number;
  lessons: number;
  quota: number;
  /** 이번 수업으로 이번 달 필수 회차를 막 채웠는지 */
  metQuota: boolean;
  /** 이번 수업으로 레벨이 올랐는지 */
  leveledUp: boolean;
}

/**
 * 수업 1회. **리소스·시간 소모는 호출부(현생 살기)가 처리한다** — 여기서는 카운트와 스탯만 만진다.
 * 가르치면서 배우는 게 있으므로 어휘력·친화력이 조금 오른다(지식은 안 오른다 — 가르치는 쪽이라).
 */
export function doLecture(state: GameState): LessonResult | null {
  const job = state.lecturerJob;
  if (!job) return null;
  const before = lecturerLevel(state);
  const quotaBefore = lecturerQuota(state);

  job.lessonsThisMonth += 1;
  job.totalLessons += 1;
  recordMission(state, "lesson");
  gainSkill(state, "vocabulary", 6);
  gainSkill(state, "sociability", 4);
  state.resources.mental = clampMental(state, state.resources.mental - 6);

  return {
    pay: lessonPay(state),
    lessons: job.lessonsThisMonth,
    quota: lecturerQuota(state),
    metQuota: job.lessonsThisMonth === quotaBefore,
    leveledUp: lecturerLevel(state) > before,
  };
}

/** 스탯 표시용 — 강사료 산정에 쓰이는 가중합(0~100 환산). UI 설명에 쓴다. */
export function lecturerCompetence(state: GameState): number {
  const s = state.skills;
  return Math.round(
    skillTo100(
      s.knowledge * LECTURER_WEIGHTS.knowledge +
        s.vocabulary * LECTURER_WEIGHTS.vocabulary +
        s.comedy * LECTURER_WEIGHTS.comedy,
    ),
  );
}
