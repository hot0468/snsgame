import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  CONTEST_COOLDOWN_DAYS,
  CONTEST_ROTATION_DAYS,
  CONTEST_RESULT_DELAY,
  applyContest,
  canApplyContest,
  contestCooldownLeft,
  currentContest,
  resolveContest,
} from "@/systems/contest";
import type { GameState } from "@/core/types";

/**
 * 네이놈 대회 재신청 쿨다운 테스트.
 *
 * 왜 넣었나: 배너는 2주마다 바뀌는데 결과는 1주면 나와서, **같은 배너 주기 안에 같은
 * 대회를 두 번** 신청할 수 있었다. 참가비만 내면 같은 대회를 계속 긁는 게 가능했다.
 *
 * 고정하는 불변식:
 *  1) 한 번 신청한 대회는 30일간 다시 신청할 수 없다.
 *  2) 쿨다운은 **신청 시점**부터 돈다(결과 시점이 아니라).
 *  3) 쿨다운 중에는 참가비가 빠져나가지 않는다.
 *  4) 쿨다운은 배너 회전보다 길다 — 짧으면 애초에 막는 의미가 없다.
 */

/** 돈을 넉넉히 쥔 상태. */
function rich(): GameState {
  const s = createInitialState();
  s.money = 100_000_000;
  return s;
}

/** 그날의 배너 대회 id. */
const bannerId = (s: GameState) => currentContest(s.day).id;

describe("같은 대회 재신청 차단", () => {
  it("신청 직후에는 쿨다운이 꽉 차 있다", () => {
    const s = rich();
    const id = bannerId(s);
    expect(applyContest(s)).toBe("ok");
    expect(contestCooldownLeft(s, id)).toBe(CONTEST_COOLDOWN_DAYS);
  });

  it("결과가 나와도 쿨다운이 남아 있으면 다시 신청 못 한다", () => {
    const s = rich();
    applyContest(s);
    // 결과 발표(1주)까지 넘긴다 — pendingContest는 비지만 쿨다운은 남는다.
    s.day += CONTEST_RESULT_DELAY;
    resolveContest(s);
    expect(s.pendingContest, "결과는 나왔어야 한다").toBeNull();
    expect(canApplyContest(s), "결과만 나오면 또 되던 게 문제였다").toBe(false);
    expect(applyContest(s)).toBe("cooldown");
  });

  it("쿨다운 중 신청은 참가비를 안 뺀다", () => {
    const s = rich();
    applyContest(s);
    s.day += CONTEST_RESULT_DELAY;
    resolveContest(s);
    const before = s.money;
    expect(applyContest(s)).toBe("cooldown");
    expect(s.money, "막힌 신청에 돈이 나가면 안 된다").toBe(before);
  });

  it("30일이 지나면 다시 신청할 수 있다", () => {
    const s = rich();
    const id = bannerId(s);
    applyContest(s);
    s.day += CONTEST_COOLDOWN_DAYS;
    expect(contestCooldownLeft(s, id)).toBe(0);
    // 그 사이 배너가 바뀌었을 수 있으니 쿨다운 자체만 확인한다.
    s.pendingContest = null;
    expect(contestCooldownLeft(s, id)).toBe(0);
  });

  it("쿨다운은 신청 시점부터 돈다 — 결과를 안 기다려도 마찬가지", () => {
    const s = rich();
    const id = bannerId(s);
    applyContest(s);
    s.pendingContest = null; // 결과를 무시하고 비워도
    s.day += CONTEST_COOLDOWN_DAYS - 1;
    expect(contestCooldownLeft(s, id)).toBe(1);
  });

  it("신청한 적 없는 대회는 쿨다운이 0이다", () => {
    const s = rich();
    expect(contestCooldownLeft(s, "없는대회id")).toBe(0);
  });
});

describe("쿨다운 길이의 계약", () => {
  it("배너 회전보다 길다 — 짧으면 같은 배너 안에서 재신청이 뚫린다", () => {
    expect(CONTEST_COOLDOWN_DAYS).toBeGreaterThan(CONTEST_ROTATION_DAYS);
  });

  it("결과 대기보다 길다 — 결과만 기다렸다가 또 넣는 게 막혀야 한다", () => {
    expect(CONTEST_COOLDOWN_DAYS).toBeGreaterThan(CONTEST_RESULT_DELAY);
  });
});

describe("구세이브 방어", () => {
  it("기록이 없거나 깨져 있어도 신청이 막히지 않는다", () => {
    const s = rich();
    (s as { contestAppliedDays?: unknown }).contestAppliedDays = undefined;
    expect(contestCooldownLeft(s, "any")).toBe(0);
    expect(applyContest(s)).toBe("ok");
  });

  it("이상한 값이 들어 있어도 영구 차단되지 않는다", () => {
    const s = rich();
    const id = bannerId(s);
    s.contestAppliedDays = { [id]: Number.NaN };
    expect(contestCooldownLeft(s, id)).toBe(0);
  });
});
