/**
 * 회귀: 이비에듀 강사직 · 직업 레벨 · "일반 직장인만 고정급" 규칙.
 *
 * 고정하는 불변식:
 *  1) 강사 채용은 **지식 기준**과 **겸직 금지** 둘 다 건다.
 *  2) 강사료는 수업 횟수에 비례하고, 레벨이 오르면 필수 회차가 줄어든다.
 *  3) 월급날(15일)에 지급하고 **그 자리에서 이번 달 횟수를 리셋**한다(안 하면 월급이 누적된다).
 *  4) AV·작가는 '일한 횟수'가 곧 월급이다 — 회사원(고정급)만 예외.
 *  5) 직업 레벨 목록은 재직 중인 직업과 해본 알바만 싣는다.
 */
import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { dateOfMonth } from "@/systems/calendar";
import { applyDailyCosts } from "@/systems/economy";
import {
  LECTURER_BASE_QUOTA,
  LECTURER_LESSONS_PER_LEVEL,
  LECTURER_MIN_QUOTA,
  LECTURER_REQ_KNOWLEDGE,
  acceptLecturerOffer,
  applyLecturer,
  canSubmitLecturerApp,
  declineLecturerOffer,
  deliverLecturerResultEmail,
  doLecture,
  lecturerLevel,
  lecturerQuota,
  lecturerSalaryOf,
  lessonPay,
  submitLecturerApplication,
} from "@/systems/lecturer";
import { jobLevelRows } from "@/systems/jobLevels";
import { markJobExperienced } from "@/systems/jobExperience";
import { quitCurrentJob } from "@/systems/employment";
import { JOB_RANKS, jobRankOf, nextRankIn } from "@/data/jobs";
import { AV_PAY_PER_DAY, avSalaryOf } from "@/systems/avJob";
import { authorPayPerWork, authorWorkPay } from "@/systems/author";
import type { GameState } from "@/core/types";

/** 지식만 채운 초기 상태 */
function stateWithKnowledge(knowledge: number): GameState {
  const s = createInitialState();
  s.skills.knowledge = knowledge;
  return s;
}

/** state.day를 이번 달 `date`일로 옮긴다(정산일 테스트용). */
function moveToDate(s: GameState, date: number): void {
  for (let i = 0; i < 400; i++) {
    if (dateOfMonth(s.day) === date) return;
    s.day += 1;
  }
  throw new Error(`${date}일을 못 찾았다`);
}

describe("강사 지원 → 익일 결과 메일", () => {
  /** 지원 후 하루를 넘겨 결과 메일까지 받는다. */
  function applyAndWait(knowledge: number): GameState {
    const s = stateWithKnowledge(knowledge);
    submitLecturerApplication(s);
    s.day += 1;
    deliverLecturerResultEmail(s);
    return s;
  }

  it("지원 당일에는 결과가 나오지 않는다", () => {
    const s = stateWithKnowledge(999);
    submitLecturerApplication(s);
    deliverLecturerResultEmail(s); // 같은 날 호출해도 아무 일 없어야 한다
    expect(s.emails.length).toBe(0);
    expect(s.pendingLecturerApp).not.toBeNull();
    expect(s.lecturerJob).toBeNull();
  });

  it("지식이 충분하면 익일 합격 메일이 오고, 그것만으로는 채용되지 않는다", () => {
    const s = applyAndWait(LECTURER_REQ_KNOWLEDGE);
    expect(s.pendingLecturerApp).toBeNull();
    expect(s.emails.length).toBe(1);
    expect(s.emails[0].subject).toContain("합격");
    expect(s.emails[0].lecturerOffer).toBe(true);
    // 메일은 통보일 뿐 — '출근한다'를 눌러야 강사가 된다.
    expect(s.lecturerJob).toBeNull();
  });

  it("지식이 모자라면 익일 불합격 메일이 오고 오퍼가 안 붙는다", () => {
    const s = applyAndWait(LECTURER_REQ_KNOWLEDGE - 1);
    expect(s.emails.length).toBe(1);
    expect(s.emails[0].subject).toContain("불합격");
    expect(s.emails[0].lecturerOffer).toBeUndefined();
    expect(s.lecturerJob).toBeNull();
  });

  it("합격 여부는 지원 시점의 지식으로 굳는다 — 밤새 공부해도 안 바뀐다", () => {
    const s = stateWithKnowledge(0);
    submitLecturerApplication(s);
    s.skills.knowledge = 999; // 통보 전에 벼락치기
    s.day += 1;
    deliverLecturerResultEmail(s);
    expect(s.emails[0].subject).toContain("불합격");
  });

  it("'출근한다'를 누르면 채용되고 오퍼 버튼이 사라진다", () => {
    const s = applyAndWait(LECTURER_REQ_KNOWLEDGE);
    expect(acceptLecturerOffer(s, s.emails[0].id)).toBe("hired");
    expect(s.lecturerJob).not.toBeNull();
    expect(s.emails[0].lecturerOffer).toBeUndefined();
  });

  it("'안 한다'를 누르면 아무것도 안 바뀌고 오퍼만 사라진다", () => {
    const s = applyAndWait(LECTURER_REQ_KNOWLEDGE);
    declineLecturerOffer(s, s.emails[0].id);
    expect(s.lecturerJob).toBeNull();
    expect(s.emails[0].lecturerOffer).toBeUndefined();
  });

  it("출근하면 기존 직업이 정리된다(겸직 금지)", () => {
    const s = applyAndWait(LECTURER_REQ_KNOWLEDGE);
    s.employment = {
      company: "니글니글",
      tier: "small",
      role: "사원",
      hiredDay: 1,
      perfLevel: 0,
      workDaysThisMonth: 0,
      lastWorkDay: 0,
      lastSalaryMonth: -1,
    } as GameState["employment"];
    acceptLecturerOffer(s, s.emails[0].id);
    expect(s.employment).toBeNull();
    expect(s.lecturerJob).not.toBeNull();
  });

  it("중복 지원을 막는다 — 대기 중이거나 합격 메일이 남아 있으면 못 넣는다", () => {
    const s = stateWithKnowledge(999);
    expect(canSubmitLecturerApp(s)).toBe(true);
    submitLecturerApplication(s);
    expect(canSubmitLecturerApp(s), "결과 대기 중").toBe(false);
    s.day += 1;
    deliverLecturerResultEmail(s);
    expect(canSubmitLecturerApp(s), "미응답 합격 메일 있음").toBe(false);
    declineLecturerOffer(s, s.emails[0].id);
    expect(canSubmitLecturerApp(s), "거절했으면 재지원 가능").toBe(true);
  });

  it("지식이 모자라도 지원 자체는 막지 않는다 — 그래야 불합격이 성립한다", () => {
    expect(canSubmitLecturerApp(stateWithKnowledge(0))).toBe(true);
  });
});

describe("강사 채용", () => {
  it("지식이 기준 미만이면 채용되지 않는다", () => {
    const s = stateWithKnowledge(LECTURER_REQ_KNOWLEDGE - 1);
    expect(applyLecturer(s)).toBe("low");
    expect(s.lecturerJob).toBeNull();
  });

  it("지식이 기준 이상이면 그 자리에서 채용된다", () => {
    const s = stateWithKnowledge(LECTURER_REQ_KNOWLEDGE);
    expect(applyLecturer(s)).toBe("hired");
    expect(s.lecturerJob).not.toBeNull();
    expect(s.lecturerJob!.totalLessons).toBe(0);
  });

  it("다른 직업이 있으면 겸직이 막힌다", () => {
    const s = stateWithKnowledge(999);
    s.employment = {
      company: "테스트상사",
      tier: "micro",
      hiredDay: s.day,
      performance: 0,
      perfLevel: 0,
      overtimeDay: -1,
      lastSalaryMonth: -1,
    };
    expect(applyLecturer(s)).toBe("busy");
    expect(s.lecturerJob).toBeNull();
  });
});

describe("수업과 레벨", () => {
  it("수업할수록 회차가 쌓이고, 레벨이 오르면 필수 회차가 준다", () => {
    const s = stateWithKnowledge(999);
    applyLecturer(s);
    expect(lecturerQuota(s)).toBe(LECTURER_BASE_QUOTA);

    for (let i = 0; i < LECTURER_LESSONS_PER_LEVEL; i++) doLecture(s);
    expect(s.lecturerJob!.totalLessons).toBe(LECTURER_LESSONS_PER_LEVEL);
    expect(lecturerLevel(s)).toBe(1);
    expect(lecturerQuota(s)).toBe(LECTURER_BASE_QUOTA - 1);
  });

  it("필수 회차는 하한 아래로 안 내려간다", () => {
    const s = stateWithKnowledge(999);
    applyLecturer(s);
    // 하한에 닿고도 남을 만큼 수업한다
    for (let i = 0; i < LECTURER_LESSONS_PER_LEVEL * (LECTURER_BASE_QUOTA + 5); i++) doLecture(s);
    expect(lecturerQuota(s)).toBe(LECTURER_MIN_QUOTA);
  });

  it("강사료는 수업 횟수 × 회당 강사료다", () => {
    const s = stateWithKnowledge(600);
    applyLecturer(s);
    const per = lessonPay(s);
    doLecture(s);
    doLecture(s);
    doLecture(s);
    // 수업으로 어휘력이 올라 회당 단가가 오르므로, 회차 수 × '현재 단가' 공식만 확인한다.
    expect(lecturerSalaryOf(s)).toBe(3 * lessonPay(s));
    expect(lessonPay(s)).toBeGreaterThanOrEqual(per);
  });
});

describe("강사 월급날(15일)", () => {
  it("지급하고 그 자리에서 이번 달 횟수를 리셋한다", () => {
    const s = stateWithKnowledge(600);
    applyLecturer(s);
    doLecture(s);
    doLecture(s);
    const expected = lecturerSalaryOf(s);
    expect(expected).toBeGreaterThan(0);

    moveToDate(s, 15);
    const before = s.money;
    applyDailyCosts(s);

    expect(s.money - before).toBeGreaterThanOrEqual(expected - 100_000); // 생활비 차감분 허용
    expect(s.lecturerJob!.lessonsThisMonth).toBe(0);
  });

  it("같은 달에 두 번 지급하지 않는다", () => {
    const s = stateWithKnowledge(600);
    applyLecturer(s);
    doLecture(s);
    moveToDate(s, 15);
    applyDailyCosts(s);
    const after = s.money;
    applyDailyCosts(s); // 같은 날 다시 (생활비만 빠져야 한다)
    expect(s.money).toBeLessThanOrEqual(after);
    expect(s.lecturerJob!.lessonsThisMonth).toBe(0);
  });
});

describe("일한 횟수만큼 받는 직업들", () => {
  it("AV 월급은 근무 횟수에 비례한다(반감 없음)", () => {
    const s = createInitialState();
    s.avJob = {
      joinedDay: s.day,
      workDaysThisMonth: 3,
      totalWorkDays: 3,
      lastWorkDay: -1,
      condomlessThisMonth: 0,
      lastSalaryMonth: -1,
      stdUntilDay: -1,
    };
    expect(avSalaryOf(s)).toBe(3 * AV_PAY_PER_DAY);
    s.avJob.workDaysThisMonth = 0;
    expect(avSalaryOf(s)).toBe(0); // 안 나가면 0원
  });

  it("작가 원고료는 이번 달 작업 횟수에 비례한다", () => {
    const s = createInitialState();
    s.authorContract = {
      signedDay: s.day,
      monthsWorked: 0,
      workload: 0,
      worksThisMonth: 0,
      missCount: 0,
      lastSettledMonth: -1,
      adult: false,
      penName: "테스트",
    };
    const zero = authorWorkPay(s);
    s.authorContract.worksThisMonth = 4;
    expect(authorWorkPay(s) - zero).toBe(4 * authorPayPerWork(s));
  });
});

describe("회사원 직급", () => {
  it("성과 레벨이 곧 직급이고, 표를 넘으면 최고 직급에 머문다", () => {
    expect(jobRankOf(0)).toBe(JOB_RANKS[0]);
    expect(jobRankOf(2)).toBe(JOB_RANKS[2]);
    // 표 밖(음수·초과)에서도 안 터지고 양끝으로 고정된다
    expect(jobRankOf(-5)).toBe(JOB_RANKS[0]);
    expect(jobRankOf(JOB_RANKS.length + 10)).toBe(JOB_RANKS[JOB_RANKS.length - 1]);
  });

  it("최고 직급에서는 다음 승진이 없다", () => {
    expect(nextRankIn(0)).toBe(JOB_RANKS[1]);
    expect(nextRankIn(JOB_RANKS.length - 1)).toBeNull();
  });

  it("직업 도감의 회사원 칸 설명에 직급이 붙는다", () => {
    const s = createInitialState();
    s.employment = {
      company: "테스트상사",
      tier: "micro",
      hiredDay: s.day,
      performance: 0,
      perfLevel: 2,
      overtimeDay: -1,
      lastSalaryMonth: -1,
    };
    markJobExperienced(s, "office");
    const row = jobLevelRows(s).find((r) => r.id === "office");
    // 라벨은 도감 항목명(회사원)이고, 회사·직급은 설명 줄에 들어간다.
    expect(row!.detail).toContain(jobRankOf(2));
    expect(row!.level).toBe(2);
  });
});

describe("직업 도감", () => {
  it("아무 직업도 안 해봤어도 목록은 다 보이고, 전부 잠겨 있다", () => {
    const rows = jobLevelRows(createInitialState());
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => !r.unlocked)).toBe(true);
    // 잠긴 칸은 '시작하는 법'을 설명으로 보여준다
    expect(rows.every((r) => r.detail.length > 0)).toBe(true);
  });

  it("성인 직업은 성인물 보기가 꺼져 있으면 목록에서 빠진다", () => {
    const off = jobLevelRows(createInitialState());
    expect(off.some((r) => r.id === "av")).toBe(false);
    const s = createInitialState();
    s.adultMode = true;
    expect(jobLevelRows(s).some((r) => r.id === "av")).toBe(true);
  });

  it("강사로 채용되면 그 칸이 해금되고 현재 직업으로 뜬다", () => {
    const s = stateWithKnowledge(999);
    applyLecturer(s);
    doLecture(s);
    const lec = jobLevelRows(s).find((r) => r.id === "lecturer");
    expect(lec).toBeDefined();
    expect(lec!.unlocked).toBe(true);
    expect(lec!.active).toBe(true);
    expect(lec!.level).toBe(lecturerLevel(s));
  });

  it("그만둬도 해금은 남는다(도감은 잊지 않는다)", () => {
    const s = stateWithKnowledge(999);
    applyLecturer(s);
    quitCurrentJob(s); // 다른 직업으로 갈아타며 강사 사직
    expect(s.lecturerJob).toBeNull();
    const lec = jobLevelRows(s).find((r) => r.id === "lecturer");
    expect(lec!.unlocked).toBe(true);
    expect(lec!.active).toBe(false);
  });
});
