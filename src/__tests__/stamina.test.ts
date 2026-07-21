import { describe, it, expect, vi, afterEach } from "vitest";
import { createInitialState } from "@/core/state";
import { clampStamina, gainStamina, STAMINA_MAX_CAP } from "@/systems/stats";
import { rollDisease, resolveSickDay, SICK_RECOVER, SICK_THRESHOLD } from "@/systems/health";

/**
 * 체력 스탯·질병 회귀 테스트.
 * - clampStamina/gainStamina: 0..staminaMax 경계.
 * - rollDisease: 체력이 문턱 위면 절대 발병 안 함(확률 무관), 아래면 확률로 발병.
 * - resolveSickDay: 하루를 앓아 다음날 아침 착지 + 회복 + 재발 플래그 클리어(무한루프 방지).
 */

afterEach(() => vi.restoreAllMocks());

describe("clampStamina / gainStamina", () => {
  it("0..staminaMax 범위로 자른다", () => {
    const s = createInitialState();
    s.staminaMax = 300;
    expect(clampStamina(s, -50)).toBe(0);
    expect(clampStamina(s, 500)).toBe(300);
    s.stamina = 10;
    gainStamina(s, -60);
    expect(s.stamina).toBe(0); // 음수로 안 내려감
    gainStamina(s, 1000);
    expect(s.stamina).toBe(300); // 상한 초과 안 함
  });

  it("staminaMax는 절대 상한 999를 넘겨 잡히지 않는다", () => {
    const s = createInitialState();
    s.staminaMax = STAMINA_MAX_CAP;
    expect(clampStamina(s, 99999)).toBe(999);
  });
});

describe("rollDisease", () => {
  it("체력이 문턱 초과면 발병 확률과 무관하게 발병하지 않는다", () => {
    const s = createInitialState();
    s.stamina = SICK_THRESHOLD + 1;
    vi.spyOn(Math, "random").mockReturnValue(0); // 확률 100% 상황
    expect(rollDisease(s)).toBe(false);
    expect(s.sickPending).toBe(false);
  });

  it("체력이 문턱 이하 + 확률 당첨이면 발병한다", () => {
    const s = createInitialState();
    s.stamina = SICK_THRESHOLD;
    vi.spyOn(Math, "random").mockReturnValue(0);
    expect(rollDisease(s)).toBe(true);
    expect(s.sickPending).toBe(true);
  });
});

describe("resolveSickDay", () => {
  it("하루를 앓아 다음날 아침에 착지하고 회복 후 플래그가 풀린다", () => {
    const s = createInitialState();
    s.money = 10_000_000; // 생활비 정산 게임오버 방지
    s.stamina = 30;
    s.sickPending = true;
    const day0 = s.day;

    resolveSickDay(s);

    expect(s.day).toBe(day0 + 1); // 하루 소모
    expect(s.slot).toBe(0); // 다음날 아침
    expect(s.stamina).toBe(30 + SICK_RECOVER); // 소량 회복
    expect(s.sickPending).toBe(false); // 재발 플래그 클리어(무한루프 방지)
    expect(s.sleepPending).toBe(false);
  });
});
