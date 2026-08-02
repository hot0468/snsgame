import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  JOB_GAP_BASE,
  JOB_GAP_MAX,
  JOB_GAP_STEP,
  RESIGN_MENTAL_GAIN,
  canOpenJobBoard,
  currentJobLabel,
  hasAnyJob,
  inJobGap,
  jobGapDaysFor,
  jobGapRemaining,
  quitCurrentJob,
  resignCurrentJob,
} from "@/systems/employment";
import { canApplyCallCenter, joinCallCenter } from "@/systems/callCenter";
import { canApplyTaxi, joinTaxi } from "@/systems/taxi";
import { canApplyStylist } from "@/systems/stylist";
import { canApplyLecturer } from "@/systems/lecturer";
import { canJoinMlm, joinMlm } from "@/systems/mlm";
import { acceptCoachJob } from "@/systems/coach";
import { isWeekday } from "@/systems/calendar";
import type { GameState } from "@/core/types";

/**
 * 퇴사 경로와 대가 회귀 테스트.
 *
 * 왜 넣었나: 퇴사 버튼이 회사원에게만 있어서 나머지 직업은 '갈아타기'로만 벗어날 수 있었고,
 * 그만두는 데 아무 대가가 없어 "싫으면 그만두고 필요하면 그날 다시"가 지배 전략이었다.
 *
 * 고정하는 불변식:
 *  1) **어떤 직업이든 그만둘 수 있다** — 배타 목록(hasAnyJob)에 있는 직업 전부.
 *  2) 자발적 퇴사는 **경력 공백**을 만들고, 그동안 새로 **지원**할 수 없다.
 *  3) 공백은 퇴사할수록 길어지고 상한이 있다(무한히 늘면 그냥 게임오버다).
 *  4) 직업 **전환**은 공백을 만들지 않는다 — 끊김이 없으므로.
 *  5) 제의로 들어오는 자리(코치·AV·다단계)는 공백 중에도 받을 수 있다. 그 순간 놓치면
 *     영영 사라지는 자리를 공백이 대신 날려버리면 억울하다.
 */

/** 평일로 옮긴다(채용공고는 평일에만 열린다). */
function toWeekday(s: GameState): void {
  for (let i = 0; i < 14 && !isWeekday(s.day); i++) s.day += 1;
}

describe("어떤 직업이든 그만둘 수 있다", () => {
  it("회사원이 아닌 직업도 퇴사가 상태를 실제로 끊는다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    expect(hasAnyJob(s)).toBe(true);
    resignCurrentJob(s);
    expect(hasAnyJob(s), "그만뒀는데 직업이 남아 있으면 안 된다").toBe(false);
    expect(currentJobLabel(s)).toBe("");
  });

  it("무직 상태에서 퇴사를 불러도 아무 일도 안 일어난다", () => {
    const s = createInitialState();
    resignCurrentJob(s);
    expect(s.quitCount, "무직 퇴사가 공백을 만들면 시작하자마자 취업이 막힌다").toBe(0);
    expect(inJobGap(s)).toBe(false);
  });
});

describe("퇴사의 대가 — 경력 공백", () => {
  it("퇴사하면 공백이 생기고 지원이 막힌다", () => {
    const s = createInitialState();
    toWeekday(s);
    joinCallCenter(s);
    resignCurrentJob(s);

    expect(inJobGap(s)).toBe(true);
    expect(jobGapRemaining(s)).toBe(JOB_GAP_BASE);
    expect(canApplyCallCenter(s), "같은 자리에 그날 바로 다시 붙을 수 없다").toBe(false);
    expect(canOpenJobBoard(s), "채용공고도 막힌다").toBe(false);
  });

  it("공백이 끝나면 다시 지원할 수 있다", () => {
    const s = createInitialState();
    toWeekday(s);
    joinCallCenter(s);
    resignCurrentJob(s);
    s.day += JOB_GAP_BASE;
    expect(inJobGap(s)).toBe(false);
    expect(canApplyCallCenter(s)).toBe(true);
  });

  it("퇴사를 반복할수록 공백이 길어진다", () => {
    expect(jobGapDaysFor(0)).toBe(JOB_GAP_BASE);
    expect(jobGapDaysFor(1)).toBe(JOB_GAP_BASE + JOB_GAP_STEP);
    expect(jobGapDaysFor(1)).toBeGreaterThan(jobGapDaysFor(0));
  });

  it("공백에 상한이 있다 — 무한히 늘면 영구 실업이다", () => {
    expect(jobGapDaysFor(999)).toBe(JOB_GAP_MAX);
    expect(jobGapDaysFor(-5), "이상한 값이 와도 음수 공백은 없다").toBe(JOB_GAP_BASE);
  });

  it("두 번째 퇴사의 공백이 실제로 더 길다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    resignCurrentJob(s);
    const first = jobGapRemaining(s);
    s.day += first;

    joinCallCenter(s);
    resignCurrentJob(s);
    expect(jobGapRemaining(s)).toBeGreaterThan(first);
  });

  it("그만두면 한숨 돌린다 — 정신력이 회복된다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    s.resources.mental = 20;
    resignCurrentJob(s);
    expect(s.resources.mental).toBe(20 + RESIGN_MENTAL_GAIN);
  });
});

describe("전환은 공백을 만들지 않는다", () => {
  it("갈아타기(quitCurrentJob)는 대가가 없다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    quitCurrentJob(s);
    expect(inJobGap(s), "전환에 공백이 붙으면 직업을 바꿀 수 없게 된다").toBe(false);
    expect(s.quitCount).toBe(0);
  });

  it("입사 함수가 부르는 정리도 공백을 안 만든다", () => {
    const s = createInitialState();
    s.certifications.push("driver_1");
    joinCallCenter(s);
    joinTaxi(s); // 내부에서 quitCurrentJob → 콜센터 정리
    expect(s.callCenterJob).toBeNull();
    expect(s.taxiJob).not.toBeNull();
    expect(inJobGap(s)).toBe(false);
  });
});

describe("공백은 '지원'만 막는다", () => {
  it("지원형 직업은 전부 막힌다", () => {
    const s = createInitialState();
    toWeekday(s);
    s.certifications.push("driver_1", "hairdresser");
    s.skills.knowledge = 99999;
    joinCallCenter(s);
    resignCurrentJob(s);

    expect(canOpenJobBoard(s), "회사원").toBe(false);
    expect(canApplyCallCenter(s), "콜센터").toBe(false);
    expect(canApplyTaxi(s), "택시").toBe(false);
    expect(canApplyStylist(s), "미용실").toBe(false);
    expect(canApplyLecturer(s), "강사").toBe(false);
  });

  it("제의로 오는 자리는 공백 중에도 받을 수 있다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    resignCurrentJob(s);
    expect(inJobGap(s)).toBe(true);

    // 다단계는 이사님 DM 제의뿐이라 게이트에 공백이 없다.
    expect(canJoinMlm(s), "제의를 공백이 날리면 그 자리는 영영 사라진다").toBe(true);
    expect(joinMlm(s)).not.toBeNull();

    // 코치 섭외(카톡)도 같은 규칙.
    const s2 = createInitialState();
    joinCallCenter(s2);
    resignCurrentJob(s2);
    acceptCoachJob(s2);
    expect(s2.coachJob).not.toBeNull();
  });
});
