import { describe, it, expect, vi, afterEach } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import { actionMax } from "@/systems/stats";
import { spendDayResting, canSpendDay, REST_ACTIVITY } from "@/systems/offline";
import { spawnFanDM, DONATION_MIN_FOLLOWERS } from "@/systems/dm";

/**
 * QoL 배치 systems 회귀 테스트.
 * - #3 spendDayResting: 남은 블록만큼 시간 진행 + 휴식 회복(클램프 내), day 넘김 시 onNewDay.
 * - #6 후원 게이트: 팔로워 300 이하 미첨부 / 초과 첨부 가능.
 */

afterEach(() => vi.restoreAllMocks());

describe("#3 spendDayResting / canSpendDay", () => {
  it("남은 블록을 전부 소비해 다음날 낮(slot 0)으로 넘어간다", () => {
    const s = createInitialState();
    s.money = 10_000_000; // 생활비 정산으로 게임오버되지 않게
    expect(s.slot).toBe(0);
    expect(canSpendDay(s)).toBe(true);
    const day0 = s.day;

    spendDayResting(s);

    // slot 0(남은 블록 전부) → 마지막 advance가 날짜를 넘겨 다음날 slot 0
    expect(s.day).toBe(day0 + 1);
    expect(s.slot).toBe(0);
    // onNewDay 발동 흔적
    expect(s.dawnPending).toBe(true);
  });

  it("반환 회복량은 블록당 휴식 회복(클램프 후 델타)의 합이다", () => {
    const s = createInitialState();
    s.money = 10_000_000;
    s.resources.action = 0;
    s.resources.mental = 0;

    const gain = spendDayResting(s); // slot 0 → 2블록(낮+심야)

    expect(gain.action).toBe(REST_ACTIVITY.action * 2); // 25*2
    expect(gain.mental).toBe(REST_ACTIVITY.mental * 2); // 30*2
  });

  it("상한에 걸리면 실제 증가분만 집계한다", () => {
    const s = createInitialState();
    s.money = 10_000_000;
    s.resources.action = actionMax(s) - 10; // 첫 블록에서 10만 오르고 이후 0
    s.resources.mental = 100; // 이미 상한

    const gain = spendDayResting(s);

    expect(gain.action).toBe(10);
    expect(gain.mental).toBe(0);
    expect(s.resources.action).toBeLessThanOrEqual(actionMax(s));
    expect(s.resources.mental).toBeLessThanOrEqual(100);
  });

  it("gameOver면 진행하지 않는다(canSpendDay false)", () => {
    const s = createInitialState();
    s.gameOver = "테스트 게임오버";
    expect(canSpendDay(s)).toBe(false);
  });
});

describe("#6 후원 팔로워 게이트", () => {
  it("팔로워 300 이하이면 후원이 첨부되지 않는다(팬 DM은 생성)", () => {
    const s = createInitialState();
    s.skills.sociability = 999; // 후원 확률 최대
    vi.spyOn(Math, "random").mockReturnValue(0); // chance() 항상 통과
    getActiveAccount(s).followers = DONATION_MIN_FOLLOWERS; // 300 (이하)

    const thread = spawnFanDM(s);
    expect(thread).not.toBeNull();
    expect(thread!.donation).toBeUndefined();
  });

  it("팔로워 300 초과이면 후원이 첨부될 수 있다", () => {
    const s = createInitialState();
    s.skills.sociability = 999;
    vi.spyOn(Math, "random").mockReturnValue(0);
    getActiveAccount(s).followers = DONATION_MIN_FOLLOWERS + 1; // 301

    const thread = spawnFanDM(s);
    expect(thread!.donation).toBeDefined();
    expect(thread!.donation!.amount).toBeGreaterThan(0);
  });
});
