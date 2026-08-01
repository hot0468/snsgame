import type { Email, GameState, JobTrack, SkillStatId } from "@/core/types";
import type { JobPosting } from "@/data/jobs";
import { MORNING_SLOT, pushEmail } from "@/core/state";
import { TIERS, jobRankOf } from "@/data/jobs";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { NIGL_COMPANY, NIGL_REQ_IT, NIGL_REQ_KNOWLEDGE } from "@/data/niglnigl";
import { chance, uid } from "@/utils/random";
import { isLastDayOfMonth, isWeekday } from "./calendar";
import { certJobBonus } from "./certification";
import { markOvertime } from "./health";
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
 * 직군(트랙)별 역량 가중치.
 *
 * ⚠️ **각 트랙의 가중치 합은 반드시 1.0이어야 한다.** 스킬(0~999)에 가중평균을 걸고
 *    `skillTo100`으로 나누는 구조라, 합이 1이 아니면 0~100 스케일이 깨져
 *    `TIERS[].requirement`(8/28/52/78)와 어긋난다(전원 합격 또는 전원 불합격).
 *    `__tests__/jobTracks.test.ts`가 합=1.0을 강제한다.
 *
 * - `office`: **기존 단일 공식 그대로**(어휘 0.45 + 친화 0.35 + 미용 0.2).
 *   한 자리도 바꾸지 마라 — 사무직 합격률 회귀가 이 값에 걸려 있다.
 * - `fitness`/`beauty`: 주 스탯 0.65 + 친화력 0.35.
 *   친화력 비중을 office(0.35)와 **똑같이** 맞춘 건 의도다 — 어떤 트랙을 타든
 *   '사람 상대하는 직업'이라는 공통 축을 남겨, 친화력만 키운 플레이어가 트랙 전환으로
 *   손해 보지 않게 한다. 나머지 0.65를 주 스탯 하나에 몰아준 덕에
 *   "운동만 판 플레이어도 취업 경로가 생긴다"는 목적이 성립한다
 *   (office는 남은 0.65가 어휘 0.45 + 미용 0.2로 쪼개져 있어 단일 스탯 몰빵이 불가능하다).
 */
export const TRACK_WEIGHTS: Record<JobTrack, Partial<Record<SkillStatId, number>>> = {
  office: { vocabulary: 0.45, sociability: 0.35, beauty: 0.2 },
  fitness: { fitness: 0.65, sociability: 0.35 },
  beauty: { beauty: 0.65, sociability: 0.35 },
};

/** 트랙 미지정(구 공고·구세이브·기본 호출) 시 적용되는 트랙 */
export const DEFAULT_JOB_TRACK: JobTrack = "office";

/**
 * 취업 역량 점수(0~100). **직군(track)에 따라 판정 스탯이 갈린다**(TRACK_WEIGHTS).
 * 스킬은 0~999 스케일이므로 100점 만점으로 환산한다
 * (스킬 만렙 → 100점. 공고별 requirement는 계속 0~100 기준).
 *
 * @param track 생략 시 `"office"` — 기존 호출부·구 데이터의 동작을 그대로 보존한다.
 */
export function competence(state: GameState, track: JobTrack = DEFAULT_JOB_TRACK): number {
  const weights = TRACK_WEIGHTS[track] ?? TRACK_WEIGHTS[DEFAULT_JOB_TRACK];
  let weighted = 0;
  for (const [skill, w] of Object.entries(weights)) {
    weighted += (state.skills[skill as SkillStatId] ?? 0) * (w ?? 0);
  }
  return Math.round(skillTo100(weighted));
}

/**
 * 트랙별 역량 점수를 한 번에 계산한다 — UI가 "내 역량"을 트랙별로 늘어놓을 때 쓴다.
 * (`ui/jobplanet`은 공고와 무관한 기업 디렉터리라 단일 숫자로는 트랙을 표현할 수 없다.
 *  어떤 표현을 고를지는 ui의 몫이고, systems는 값만 제공한다.)
 */
export function competenceByTrack(state: GameState): Record<JobTrack, number> {
  return {
    office: competence(state, "office"),
    fitness: competence(state, "fitness"),
    beauty: competence(state, "beauty"),
  };
}

/**
 * 플레이어에게 가장 유리한 트랙과 그 점수 — UI가 단일 숫자 자리에 "내 최고 역량"을
 * 보여주고 싶을 때 쓰라고 둔 셀렉터. 동점이면 office > fitness > beauty 순으로 고른다.
 */
export function bestTrack(state: GameState): { track: JobTrack; score: number } {
  const scores = competenceByTrack(state);
  let best: JobTrack = DEFAULT_JOB_TRACK;
  for (const t of ["office", "fitness", "beauty"] as JobTrack[]) {
    if (scores[t] > scores[best]) best = t;
  }
  return { track: best, score: scores[best] };
}

/**
 * 특정 등급·직군 공고의 합격 확률(0~1).
 * 보유 자격증의 보너스가 더해지지만, 클램프(0.05~0.95)는 그대로라 상한을 뚫지 못한다.
 *
 * @param track 생략 시 `"office"`(기존 동작 보존).
 *
 * ── 자격증 보너스(certJobBonus)를 **트랙 무관으로 유지한 판단** ──
 * "헤어 자격증이 사무직 합격률을 올리는 게 맞나"는 지적은 타당하지만, 유지가 낫다고 봤다:
 *  1) `Certification.jobBonus`는 난이도·응시료와 **단조 증가**하도록 짜인 값이다(0.02~0.3).
 *     즉 도메인 적합도가 아니라 '들인 노력'을 값으로 표현한 축이다. 여기에 트랙 필터를 걸면
 *     자격증 25종 대부분이 3트랙 중 2트랙에서 가치가 0이 되어, data/certifications가
 *     명시한 "fee·requirement·jobBonus는 서로 정합적으로" 규약이 통째로 깨진다.
 *  2) 트랙 분화는 이미 competence 쪽에서 충분한 차별화를 만든다. 자격증에까지 트랙 게이트를
 *     이중으로 걸면 운동·뷰티 신규 트랙이 초반에 지나치게 좁아진다(신설 트랙의 목적과 역행).
 *  3) 게임 내적으로도 "자격증을 여러 개 딴 사람"은 어느 직군에서든 서류가 통과하는 게
 *     자연스럽다 — 스펙 인플레 개그가 이 게임의 톤이기도 하다.
 * 트랙별 자격증 가중을 넣고 싶다면 `Certification`에 `tracks?: JobTrack[]`를 새로 두고
 * 미지정=전 트랙으로 하는 게 맞다(기존 값 재조정이 필요하므로 별도 밸런스 작업으로 다뤄라).
 */
export function successChance(
  state: GameState,
  tier: JobPosting["tier"],
  track: JobTrack = DEFAULT_JOB_TRACK,
): number {
  const req = TIERS[tier].requirement;
  const gap = competence(state, track) - req;
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
  // 트랙 미지정 공고는 사무직으로 판정한다(기존 공고·구 데이터 호환).
  const track = posting.track ?? DEFAULT_JOB_TRACK;
  const p = successChance(state, posting.tier, track);
  const hired = chance(p);
  // ⚠️ pendingJobApp에 track을 넣지 않는 건 의도다 — 합격 여부(hired)가 **지원 시점에 이미
  //    확정**되므로 결과 통보(deliverJobResultEmail)는 트랙을 다시 볼 일이 없다.
  //    필드를 늘리지 않은 덕에 구세이브의 진행 중 지원도 폴백 없이 그대로 처리된다.
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

  pushEmail(state, email);
  addSchedule(state, app.hired ? "채용 합격 메일 도착" : "채용 결과 메일 도착", "system");
}

/* ─────────────────── 직업 배타(회사·AV·강사 택1) ─────────────────── */

/**
 * 회사·AV·강사 중 어느 직업이든 하나라도 재직 중인지.
 * ⚠️ 새 직업을 추가하면 **여기와 `quitCurrentJob`·`currentJobLabel` 셋을 같이** 고쳐야 한다.
 *    하나만 빠뜨리면 겸직이 뚫리거나(신청 통과) 전환 시 옛 직업이 남는다.
 */
export function hasAnyJob(state: GameState): boolean {
  return (
    !!state.employment ||
    !!state.avJob ||
    !!state.lecturerJob ||
    !!state.coachJob ||
    !!state.taxiJob
  );
}

/** 재직 중인 회사원의 직급(무직·타 직업이면 빈 문자열). */
export function currentRank(state: GameState): string {
  return state.employment ? jobRankOf(state.employment.perfLevel) : "";
}

/** 현재 직업의 표시 라벨(회사명·"AV배우"·"이비에듀 강사"). 직업 없으면 빈 문자열. */
export function currentJobLabel(state: GameState): string {
  if (state.employment) return state.employment.company;
  if (state.avJob) return "AV배우";
  if (state.lecturerJob) return "이비에듀 강사";
  if (state.coachJob) return "배구부 코치";
  if (state.taxiJob) return "택시 기사";
  return "";
}

/**
 * 현재 가진 직업(회사/AV)을 그만둔다 — 직업 전환(switch)의 선행 단계.
 * 월 정산 등 별도 마감 없이 상태만 해지한다(다음 정산부터 미지급).
 */
export function quitCurrentJob(state: GameState): void {
  if (state.employment) {
    addSchedule(state, `${state.employment.company} 퇴사`, "system");
    // 퇴사한 회사는 잡플래닛 리뷰 대상이 된다(리뷰 1건당 기업정보 무료 열람권 1장).
    if (!state.pastEmployers.includes(state.employment.company)) {
      state.pastEmployers.push(state.employment.company);
    }
    state.employment = null;
  }
  if (state.avJob) {
    addSchedule(state, "AV배우 계약 해지", "system");
    state.avJob = null;
  }
  // ⚠️ systems/lecturer.quitLecturer를 부르지 않는다 — 그쪽이 이 파일을 import하고 있어 순환이 된다.
  //    해지 동작이 상태 한 줄이라 여기서 직접 끊는다(문구도 그쪽과 같게 유지할 것).
  if (state.lecturerJob) {
    addSchedule(state, "이비에듀 강사 사직", "system");
    state.lecturerJob = null;
  }
  if (state.coachJob) {
    addSchedule(state, "배구부 코치 사임", "system");
    state.coachJob = null;
  }
  // lecturer와 같은 이유로 systems/taxi.quitTaxi를 부르지 않는다(순환 import).
  if (state.taxiJob) {
    addSchedule(state, "달빛운수 퇴사", "system");
    state.taxiJob = null;
  }
}

/** 잡플래닛 기업정보 1건 열람 비용(무료 열람권이 없을 때). */
export const JOBPLANET_VIEW_COST = 100_000;

/**
 * 이전 직장 리뷰를 쓴다 — pastEmployers에서 제거하고 무료 열람권 1장을 얻는다.
 * @returns 리뷰를 실제로 작성했으면 true(대상이 없으면 false).
 */
export function writeJobplanetReview(state: GameState, company: string): boolean {
  const i = state.pastEmployers.indexOf(company);
  if (i < 0) return false;
  state.pastEmployers.splice(i, 1);
  state.jobplanetCredits += 1;
  return true;
}

/** 잡플래닛 기업정보를 1건 열람한다(무료 열람권 우선, 없으면 10만원 차감). @returns 열람 성공 여부 */
export function payForJobplanetInfo(state: GameState): boolean {
  if (state.jobplanetCredits > 0) {
    state.jobplanetCredits -= 1;
    return true;
  }
  if (state.money < JOBPLANET_VIEW_COST) return false;
  state.money -= JOBPLANET_VIEW_COST;
  return true;
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
  markJobExperienced(state, JOB_ID.office); // 직업 도감 해금(퇴사해도 남는다)
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
  markJobExperienced(state, JOB_ID.office);
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
  if (chance(TIERS[emp.tier].overtimeRate)) {
    emp.overtimeDay = state.day;
    // 야근 연속 페널티 집계(너아무튼온 업무 요청과 같은 관문 — systems/health.ts).
    markOvertime(state);
  }
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
    // 성과 레벨 = 직급이라, 레벨업은 곧 승진이다(직급표 상한에 닿으면 승진 문구는 안 뜬다).
    const rank = jobRankOf(emp.perfLevel);
    const promoted = rank !== jobRankOf(emp.perfLevel - 1);
    addSchedule(
      state,
      promoted
        ? `${rank}(으)로 승진! 성과 레벨 ${emp.perfLevel} (월급 인상)`
        : `성과 레벨 ${emp.perfLevel} 달성! (월급 인상)`,
      "system",
    );
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
