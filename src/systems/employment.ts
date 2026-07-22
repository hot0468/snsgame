import type { Email, GameState } from "@/core/types";
import type { JobPosting } from "@/data/jobs";
import { MORNING_SLOT } from "@/core/state";
import { TIERS } from "@/data/jobs";
import { NIGL_COMPANY, NIGL_REQ_IT, NIGL_REQ_KNOWLEDGE } from "@/data/niglnigl";
import { chance, uid } from "@/utils/random";
import { isLastDayOfMonth, isWeekday } from "./calendar";
import { certJobBonus } from "./certification";
import { currentSalary } from "./economy";
import { clampAction, clampResource, skillTo100 } from "./stats";
import { addSchedule, advanceTime } from "./time";

/**
 * 취업/근무 시스템.
 * - 채용공고에 지원 → 스탯 기반 성공률로 합격.
 * - 재직 중이면 평일 오전(야근 시 저녁도)이 강제 근무 시간이 된다.
 * - 성실히 근무하면 성과가 쌓이고, 성과 레벨이 오르면 월급이 오른다.
 */

/** 근무 1블록당 행동력 소모 */
export const WORK_ACTION_COST = 15;
/** 딴짓(트위터) 시 행동력 소모 */
const SLACK_ACTION_COST = 5;
/** 행동력이 이 값 미만이면 실수 위험 */
const MISTAKE_ACTION_THRESHOLD = 25;
/** 성실 근무 시 성과 상승량 */
const PERF_GAIN = 7;
/** 성과 레벨업 임계치 */
export const PERF_LEVELUP_AT = 100;

/**
 * 취업 역량 점수(0~100). 어휘력·친화력·미용에 좌우된다.
 * 스킬은 0~999 스케일이므로 100점 만점으로 환산한다
 * (스킬 만렙 → 100점. 공고별 requirement는 계속 0~100 기준).
 */
export function competence(state: GameState): number {
  const { vocabulary, sociability, beauty } = state.skills;
  const weighted = vocabulary * 0.45 + sociability * 0.35 + beauty * 0.2;
  return Math.round(skillTo100(weighted));
}

/**
 * 특정 등급 공고의 합격 확률(0~1).
 * 보유 자격증의 보너스가 더해지지만, 클램프(0.05~0.95)는 그대로라 상한을 뚫지 못한다.
 */
export function successChance(state: GameState, tier: JobPosting["tier"]): number {
  const req = TIERS[tier].requirement;
  const gap = competence(state) - req;
  return Math.max(0.05, Math.min(0.95, 0.5 + gap / 80 + certJobBonus(state)));
}

/** 응답을 기다리는 합격(채용 오퍼) 메일이 있는지 */
export function hasPendingJobOffer(state: GameState): boolean {
  return state.emails.some((e) => e.jobOffer);
}

/**
 * 오늘 채용공고를 열 수 있는지.
 * - 재직 중이 아니고, 결과 대기 중인 지원/오퍼가 없어야 하며, 평일 하루 1회.
 */
export function canOpenJobBoard(state: GameState): boolean {
  return (
    !state.employment &&
    !state.pendingJobApp &&
    !hasPendingJobOffer(state) &&
    state.lastJobBoardDay !== state.day &&
    isWeekday(state.day)
  );
}

/**
 * 채용공고에 지원한다(지원서 제출). 결과는 즉시 나오지 않고,
 * 합격 여부만 확정해 두었다가 익일에 피메일로 통보된다.
 */
export function submitJobApplication(state: GameState, posting: JobPosting): void {
  const p = successChance(state, posting.tier);
  const hired = chance(p);
  state.pendingJobApp = {
    company: posting.company,
    tier: posting.tier,
    role: posting.role,
    hired,
    resultDay: state.day + 1,
  };
  addSchedule(state, `${posting.company} 지원서 제출`, "system");
}

/**
 * 결과 대기 중인 지원이 있고 결과일이 되면, 합격/불합격 메일을 수신함에 넣는다.
 * time.onNewDay에서 매일 호출된다.
 */
export function deliverJobResultEmail(state: GameState): void {
  const app = state.pendingJobApp;
  if (!app || state.day < app.resultDay) return;
  state.pendingJobApp = null;

  const email: Email = app.hired
    ? {
        id: uid("mail"),
        from: `${app.company} 인사팀`,
        subject: `[합격] ${app.company} 최종 합격을 축하드립니다`,
        body:
          `안녕하세요, ${app.company} 인사팀입니다.\n\n` +
          `${app.role} 포지션에 지원해 주셔서 감사합니다. 서류·면접 결과 최종 합격하셨음을 안내드립니다!\n\n` +
          `입사 의사를 아래 버튼으로 알려주세요. '출근한다'를 누르시면 다음 근무일부터 출근하시게 됩니다.`,
        day: state.day,
        read: false,
        jobOffer: { company: app.company, tier: app.tier, role: app.role },
        jobResult: { company: app.company, hired: app.hired },
      }
    : {
        id: uid("mail"),
        from: `${app.company} 인사팀`,
        subject: `[불합격] ${app.company} 지원 결과 안내`,
        body:
          `안녕하세요, ${app.company} 인사팀입니다.\n\n` +
          `${app.role} 포지션에 지원해 주셔서 감사합니다. 아쉽게도 이번에는 함께하지 못하게 되었습니다.\n\n` +
          `지원자님의 앞날에 좋은 일이 가득하길 바랍니다. 스탯을 더 키워 다시 도전해 보세요.`,
        day: state.day,
        read: false,
        jobResult: { company: app.company, hired: app.hired },
      };

  state.emails.unshift(email);
  addSchedule(state, app.hired ? "채용 합격 메일 도착" : "채용 결과 메일 도착", "system");
}

/* ─────────────────── 직업 배타(회사·AV 택1) ─────────────────── */

/** 회사·AV 중 어느 직업이든 하나라도 재직 중인지. */
export function hasAnyJob(state: GameState): boolean {
  return !!state.employment || !!state.avJob;
}

/** 현재 직업의 표시 라벨(회사명 또는 "AV배우"). 직업 없으면 빈 문자열. */
export function currentJobLabel(state: GameState): string {
  if (state.employment) return state.employment.company;
  if (state.avJob) return "AV배우";
  return "";
}

/**
 * 현재 가진 직업(회사/AV)을 그만둔다 — 직업 전환(switch)의 선행 단계.
 * 월 정산 등 별도 마감 없이 상태만 해지한다(다음 정산부터 미지급).
 */
export function quitCurrentJob(state: GameState): void {
  if (state.employment) {
    addSchedule(state, `${state.employment.company} 퇴사`, "system");
    state.employment = null;
  }
  if (state.avJob) {
    addSchedule(state, "AV배우 계약 해지", "system");
    state.avJob = null;
  }
}

/**
 * 합격 메일에서 '출근한다'를 선택 — 입사한다(근무는 다음 근무일부터).
 * ⚠️ **기존 직업(회사/AV)이 있으면 아무것도 하지 않는다** — UI가 전환 여부를 물어
 *    switchToCompanyJob을 호출한다(직업 배타).
 */
export function acceptJobOffer(state: GameState, emailId: string): void {
  const email = state.emails.find((e) => e.id === emailId);
  if (!email?.jobOffer || hasAnyJob(state)) return;
  const { company, tier } = email.jobOffer;
  state.employment = {
    company,
    tier,
    hiredDay: state.day,
    performance: 0,
    perfLevel: 0,
    overtimeDay: -1,
    lastSalaryMonth: -1,
  };
  email.jobOffer = undefined;
  email.read = true;
  addSchedule(state, `${company} 입사!`, "system");
}

/** 기존 직업을 그만두고 회사 오퍼로 갈아탄다(UI 전환 확정 시). */
export function switchToCompanyJob(state: GameState, emailId: string): void {
  quitCurrentJob(state);
  acceptJobOffer(state, emailId);
}

/**
 * 니글니글 채용 합격 조건 — IT·지식이 둘 다 문턱(data/niglnigl)을 넘어야 한다.
 * 지원서 '제출'은 누구나 가능하지만, 합격(hireNigl 호출) 여부는 이 판정에 달렸다.
 */
export function canBeHiredByNigl(state: GameState): boolean {
  return state.skills.it >= NIGL_REQ_IT && state.skills.knowledge >= NIGL_REQ_KNOWLEDGE;
}

/**
 * 니글니글(꿈의 IT 기업)에 즉시 입사한다 — 주소창 지원서 제출로 호출된다.
 * hiredDay를 '이번 달 마지막 날'로 두면 기존 "근무는 익일부터" 규칙이 곧 다음달 1일 출근이 된다.
 * tier "large"라 생활비 무료·월세 반값·월급이 economy에서 자동 처리된다.
 */
export function hireNigl(state: GameState): void {
  quitCurrentJob(state);
  let hiredDay = state.day;
  while (!isLastDayOfMonth(hiredDay)) hiredDay++; // 이번 달 말일
  state.employment = {
    company: NIGL_COMPANY,
    tier: "large",
    hiredDay,
    performance: 0,
    perfLevel: 0,
    overtimeDay: -1,
    lastSalaryMonth: -1,
  };
  state.niglShifts = 0;
  addSchedule(state, "니글니글 합격 — 다음달 1일 출근", "system");
}

/** 합격 메일에서 '안 한다'를 선택 — 입사를 거절한다. */
export function declineJobOffer(state: GameState, emailId: string): void {
  const email = state.emails.find((e) => e.id === emailId);
  if (!email?.jobOffer) return;
  const company = email.jobOffer.company;
  email.jobOffer = undefined;
  email.read = true;
  addSchedule(state, `${company} 입사 거절`, "system");
}

/** 안 읽은 메일 수 */
export function unreadEmailCount(state: GameState): number {
  return state.emails.filter((e) => !e.read).length;
}

/** 지금이 강제 근무 시간인지(평일 낮) */
export function isWorkNow(state: GameState): boolean {
  const emp = state.employment;
  if (!emp || state.gameOver) return false;
  // 니글니글은 강제 출근이 없다 — 현생 살기에서 원할 때 자발적으로 출근한다(canNiglWork).
  if (emp.company === NIGL_COMPANY) return false;
  if (state.day <= emp.hiredDay) return false; // 근무는 익일부터
  if (!isWeekday(state.day)) return false;
  // 3→2슬롯 축소로 '저녁 야근'이 낮 근무와 같은 슬롯이 됐다. 낮 근무가 이미 이 슬롯을 강제하므로
  // overtimeDay 기반 별도 야근 슬롯은 사라졌다(밸런스 후 재설계 여지 — 계약서 명시).
  return state.slot === MORNING_SLOT;
}

/**
 * 니글니글 자발적 출근이 가능한지(주말·심야 포함 아무 슬롯이나, 다음달 1일=hiredDay 익일부터).
 * 강제가 아니라 현생 살기의 '출근하기' 버튼으로 원할 때 나간다 — 월 20일만 채우면 만근.
 */
export function canNiglWork(state: GameState): boolean {
  const emp = state.employment;
  if (!emp || state.gameOver) return false;
  return emp.company === NIGL_COMPANY && state.day > emp.hiredDay;
}

/** 아침 근무를 마치며 오늘 야근 여부를 굴린다. */
function rollOvertime(state: GameState): void {
  const emp = state.employment;
  if (!emp) return;
  if (chance(TIERS[emp.tier].overtimeRate)) emp.overtimeDay = state.day;
}

/** 성과를 올리고 레벨업을 처리한다. @returns 레벨업했으면 true */
export function gainPerformance(state: GameState, amount: number): boolean {
  const emp = state.employment!;
  emp.performance += amount;
  let leveled = false;
  while (emp.performance >= PERF_LEVELUP_AT) {
    emp.performance -= PERF_LEVELUP_AT;
    emp.perfLevel += 1;
    leveled = true;
  }
  if (emp.performance < 0) emp.performance = 0;
  return leveled;
}

export interface WorkResult {
  message: string;
  /** 성실 근무 중 실수했는지 */
  mistake: boolean;
  /** 딴짓하다 걸렸는지 */
  caught: boolean;
  /** 성과 레벨업했는지 */
  leveledUp: boolean;
}

/**
 * 근무 한 블록을 처리한다.
 * @param mode "work"=성실히 근무 / "slack"=트위터하며 딴짓
 */
export function doWork(state: GameState, mode: "work" | "slack"): WorkResult {
  const emp = state.employment!;
  const isMorning = state.slot === MORNING_SLOT;
  let message = "";
  let mistake = false;
  let caught = false;
  let leveledUp = false;

  if (mode === "work") {
    const lowStamina = state.resources.action < MISTAKE_ACTION_THRESHOLD;
    mistake = lowStamina && chance(0.6);
    state.resources.action = clampAction(state, state.resources.action - WORK_ACTION_COST);
    if (mistake) {
      // 행동력이 낮아 실수 → 성과·정신력 하락
      leveledUp = gainPerformance(state, -10);
      state.resources.mental = clampResource(state.resources.mental - 18);
      message =
        "피곤에 절어 실수를 연발했다. 상사에게 한 소리 듣고 다시 하느라 진이 다 빠졌다. 성과가 깎였다.";
    } else {
      leveledUp = gainPerformance(state, PERF_GAIN);
      state.resources.mental = clampResource(state.resources.mental - 12);
      message = "맡은 일을 야무지게 처리했다. 성과가 차곡차곡 쌓였지만 정신력이 닳았다.";
    }
  } else {
    state.resources.action = clampAction(state, state.resources.action - SLACK_ACTION_COST);
    caught = chance(TIERS[emp.tier].caughtRate);
    if (caught) {
      leveledUp = gainPerformance(state, -25);
      state.resources.mental = clampResource(state.resources.mental - 12);
      message =
        "몰래 트위터를 하다 상사에게 딱 걸렸다! 경위서까지 쓰고 나니 등에 식은땀이... 성과가 곤두박질쳤다.";
    } else {
      state.resources.mental = clampResource(state.resources.mental + 7);
      message = "책상 밑으로 트위터를 하며 슬렁슬렁 시간을 보냈다. 성과는 없지만 정신력이 회복됐다.";
    }
  }

  if (leveledUp) {
    addSchedule(state, `성과 레벨 ${emp.perfLevel} 달성! (월급 인상)`, "system");
  }
  // 니글니글은 처음부터 정규직 — 이번 '달' 출근 일수를 센다(월급날 20일 미달이면 반감 후 리셋).
  if (emp.company === NIGL_COMPANY) state.niglShifts += 1;
  // 아침 근무를 마치며 오늘 야근 여부 결정
  if (isMorning) rollOvertime(state);
  addSchedule(state, mode === "work" ? "성실 근무" : "근무 중 딴짓", "system");
  advanceTime(state, 1);

  return { message, mistake, caught, leveledUp };
}

/** 재직 중 월급 표시용 */
export function salaryOf(state: GameState): number {
  return state.employment ? currentSalary(state.employment) : 0;
}
