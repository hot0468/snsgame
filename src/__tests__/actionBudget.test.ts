import { describe, it, expect } from "vitest";
import { SLEEP_ACTION_RECOVER, LATE_ACTION_RECOVER } from "@/systems/time";
import { SLOTS_PER_DAY, createInitialState } from "@/core/state";
import {
  STAMINA_ACTION_RECOVER_MAX,
  STAMINA_MAX_CAP,
  staminaActionBonus,
} from "@/systems/stats";
import { OFFLINE_ACTIVITIES, partTimeActivities } from "@/systems/offline";
import { WORK_ACTION_COST } from "@/systems/employment";
import { HOUSINGS } from "@/data/housing";

/**
 * 하루 행동력 수지 회귀 테스트.
 *
 * 왜 필요한가: 하루는 2슬롯인데 활동 1회가 15~32를 먹는다. 회복이 30이던 시절엔
 * **슬롯당 평균 15**밖에 못 써서 "슬롯은 남았는데 행동력이 없어 아무것도 못 하는 날"이 생겼다.
 * 특히 알바 행동력을 올린 뒤로는 물류(32)를 하루 회복분으로 1회도 못 채웠다.
 *
 * 고정하는 불변식: **하루 회복으로 가장 비싼 활동 1회는 반드시 할 수 있어야 한다.**
 * (그래야 어떤 활동도 "오늘은 시도조차 못 함"이 되지 않는다.)
 */
describe("하루 행동력 수지", () => {
  /** 행동력을 소모하는 활동의 비용(양수)만 추린다. 회복 활동(쉬기·휴가)은 제외. */
  const costs = OFFLINE_ACTIVITIES.filter((a) => a.action < 0).map((a) => ({
    label: a.label,
    cost: -a.action,
  }));

  it("하루 회복으로 가장 비싼 활동 1회는 할 수 있다", () => {
    const worst = costs.reduce((m, c) => (c.cost > m.cost ? c : m));
    expect(SLEEP_ACTION_RECOVER, `가장 비싼 활동: ${worst.label}(${worst.cost})`).toBeGreaterThanOrEqual(
      worst.cost,
    );
  });

  it("슬롯당 평균 행동력이 정규직 근무 1회를 넘는다", () => {
    // 슬롯당 평균이 근무 비용(15)보다 적으면 '근무만 해도 하루가 모자란' 상태가 된다.
    expect(SLEEP_ACTION_RECOVER / SLOTS_PER_DAY).toBeGreaterThan(WORK_ACTION_COST);
  });

  it("체력을 키우면 '가장 비싼 알바 + 트윗'이 하루에 들어간다 — 운동의 보상", () => {
    // 시작 시점(체력 200)엔 물류(32)+트윗(10)=42가 안 들어간다. 그게 정상이다 —
    // 운동으로 staminaMax를 올리면 열리는 여유이고, 그래야 체력 육성에 이유가 생긴다.
    const worstPartTime = Math.max(...partTimeActivities().map((a) => -a.action));
    const need = worstPartTime + 10;

    const fresh = createInitialState();
    expect(SLEEP_ACTION_RECOVER + staminaActionBonus(fresh), "시작 시점").toBeLessThan(need);

    // 운동을 충분히 한 상태(staminaMax 600 ≈ 운동 50회)면 가능해져야 한다.
    const trained = createInitialState();
    trained.staminaMax = 600;
    expect(SLEEP_ACTION_RECOVER + staminaActionBonus(trained), "체력 600").toBeGreaterThanOrEqual(need);
  });

  it("체력 보너스는 한계치에서만 파생된다 — 오늘 지쳐도 내일 회복은 안 줄어든다", () => {
    // 현재 체력(state.stamina)에 연동하면 지칠수록 회복이 줄어 회복 불능 나선이 된다.
    const s = createInitialState();
    s.staminaMax = 600;
    s.stamina = 600;
    const full = staminaActionBonus(s);
    s.stamina = 0; // 완전히 지친 상태
    expect(staminaActionBonus(s)).toBe(full);
  });

  it("체력 보너스에 상한이 있다 — 운동 무한 반복이 지배 전략이 되지 않는다", () => {
    const s = createInitialState();
    s.staminaMax = STAMINA_MAX_CAP;
    expect(staminaActionBonus(s)).toBe(STAMINA_ACTION_RECOVER_MAX);
  });

  it("밤샘 회복은 숙면보다 확실히 손해다", () => {
    // 밤샘이 이득이면 '심야 트윗'이 공짜가 되어 수면 트레이드오프가 죽는다.
    expect(LATE_ACTION_RECOVER).toBeLessThan(SLEEP_ACTION_RECOVER / 2);
  });


  it("기본집에서는 무거운 활동 2개를 못 겹친다 — 집 투자로 풀리는 여유다", () => {
    // 최고급 집(3억)이면 무거운 2개가 가능해지는데, 그건 **투자로 얻은 보상**이라 정상이다.
    // 지켜야 할 건 "시작 시점(기본집)에는 조절이 필요하다"는 것 — 여기가 뒤집히면
    // 초반부터 행동력이 남아돌아 주거 업그레이드의 이유가 사라진다.
    const baseBonus = HOUSINGS[0].actionBonus;
    const sorted = costs.map((c) => c.cost).sort((a, b) => b - a);
    expect(SLEEP_ACTION_RECOVER + baseBonus).toBeLessThan(sorted[0] + sorted[1]);
  });
});
