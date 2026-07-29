import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { buyLotto, drawLotto, LOTTO_PRIZE } from "@/systems/lotto";

/**
 * 복권 지급 가드. drawLotto는 티켓과 추첨일을 **자기 안에서** 검사해야 한다.
 * 예전엔 검사가 UI(lottoStatus)에만 있어서, 낡은 모달의 '결과 확인' 버튼이 살아남으면
 * 티켓 없이 20억이 지급될 수 있었다(실측 2000회 중 6회 당첨).
 * 확률 0.5%짜리 사고라 눈으로는 안 잡힌다 — 시행 횟수로 막는다.
 */

const TRIALS = 5_000;

describe("복권 추첨 가드", () => {
  it("티켓이 없으면 몇 번을 굴려도 지급되지 않는다", () => {
    const s = createInitialState();
    const before = s.money;
    for (let i = 0; i < TRIALS; i++) {
      expect(drawLotto(s).won).toBe(false);
    }
    expect(s.money).toBe(before);
  });

  it("추첨일 전에는 지급되지 않고 티켓도 소멸하지 않는다", () => {
    const s = createInitialState();
    expect(buyLotto(s)).toBe(true);
    const before = s.money;
    for (let i = 0; i < TRIALS; i++) {
      expect(drawLotto(s).won).toBe(false);
    }
    expect(s.money).toBe(before);
    expect(s.lotto).not.toBeNull(); // 대기 중인 티켓은 그대로 남아야 한다
  });

  it("추첨일 이후에는 정상 추첨되고 티켓이 소멸한다", () => {
    const s = createInitialState();
    buyLotto(s);
    s.day = s.lotto!.drawDay; // 추첨일 당일

    const money = s.money;
    const draw = drawLotto(s);
    expect(s.lotto).toBeNull();
    expect(s.money).toBe(money + (draw.won ? LOTTO_PRIZE : 0));
  });
});
