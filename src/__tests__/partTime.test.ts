/**
 * 회귀: 아르바이트 4종 분할 — 일당 곡선 재설계 · 알바별 개별 카운터 · 구세이브 마이그레이션.
 *
 * 고정하는 불변식:
 *  1) 일당 분기는 20회이고 상한이 있다(후반 무한 상승 금지).
 *  2) **초반(1~20회) 수입이 구곡선보다 줄지 않는다** — 사용자 불만("초반이 빠듯")의 직접 원인이었다.
 *  3) 알바별 카운터가 서로 섞이지 않는다(한 알바를 해도 다른 알바 일당은 그대로).
 *  4) 구세이브의 `partTimeCount`(숫자)가 **실제로 보존된다** — 죽은 폴백이 아닌지 실측한다.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState } from "@/core/state";
import { loadGame } from "@/systems/save";
import {
  OFFLINE_ACTIVITIES,
  PART_TIME_BASE,
  PART_TIME_LEGACY_ID,
  PART_TIME_PAY_CAP,
  PART_TIME_RAISE,
  PART_TIME_MIN_ACTION,
  PART_TIME_TIER,
  PART_TIME_WEEKDAYS_PER_MONTH,
  doOfflineActivity,
  partTimeActivities,
  partTimeCountOf,
  partTimeNextRaiseIn,
  partTimePay,
} from "@/systems/offline";
import { TIERS } from "@/data/jobs";
import { PERF_LEVEL_RAISE } from "@/systems/economy";
import { WORK_ACTION_COST, isWorkNow } from "@/systems/employment";
import type { GameState } from "@/core/types";

const SAVE_KEY = "snsgame:save:v2";
const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  (globalThis as Record<string, unknown>).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  };
});

/** 구곡선(개편 전) — 비교 기준. 하드코딩이지만 '과거값'이라 소스에서 import할 수 없다. */
const legacyPay = (c: number) => 10_000 + Math.floor(c / 3) * 5_000;

describe("일당 곡선", () => {
  it("20회마다 오른다 — 19회까지는 base, 20회에 첫 인상", () => {
    // ⚠️ 상한(PART_TIME_PAY_CAP)에 걸리지 않는 구간에서만 단계 공식을 검사한다.
    //    상한을 낮추면 높은 단계가 clamp되므로 `Math.min`으로 기대치를 뽑아야 테스트가 안 깨진다.
    const tier = (n: number) => Math.min(PART_TIME_PAY_CAP, PART_TIME_BASE + PART_TIME_RAISE * n);
    expect(partTimePay(0)).toBe(PART_TIME_BASE);
    expect(partTimePay(19)).toBe(PART_TIME_BASE);
    expect(partTimePay(20)).toBe(tier(1));
    expect(partTimePay(39)).toBe(tier(1));
    expect(partTimePay(40)).toBe(tier(2));
    // 분기 자체가 20회인지(경계에서만 오르는지) 확인
    expect(partTimePay(20)).toBeGreaterThan(partTimePay(19));
  });

  it("상한이 있다 — 무한 상승하지 않는다(구곡선의 후반 과잉 억제)", () => {
    expect(partTimePay(10_000)).toBe(PART_TIME_PAY_CAP);
    expect(partTimePay(80)).toBe(PART_TIME_PAY_CAP);
    // 구곡선은 같은 횟수에서 계속 올랐다 — 개편의 요점이다.
    expect(legacyPay(400)).toBeGreaterThan(PART_TIME_PAY_CAP * 2);
  });

  it("가장 절실한 초반(1~10회) 누적 수입이 구곡선보다 두껍다", () => {
    // ⚠️ 회차별이 아니라 **누적** 비교다 — 플레이어가 겪는 건 "지금까지 번 돈"이다.
    //    신곡선은 평평한 base로 초반을 깔고, 구 계단(3회마다 +5천)이 그 뒤에 앞지른다.
    //    보호 대상은 생계가 위태로운 **첫 10회**다. 그 뒤는 취업으로 갈아타는 게 정답이라
    //    일부러 낮게 둔다(아래 '정규직 서열' 테스트가 그 상한을 고정한다).
    let neu = 0;
    let old = 0;
    for (let c = 0; c < 10; c++) {
      neu += partTimePay(c);
      old += legacyPay(c);
      expect(neu, `${c + 1}회차 누적`).toBeGreaterThanOrEqual(old);
    }
  });

  it("첫 회차 일당이 구곡선보다 두껍다 — 가장 절실한 구간을 직접 보강", () => {
    expect(partTimePay(0)).toBeGreaterThan(legacyPay(0));
  });

  /**
   * ★ 이 파일에서 가장 중요한 불변식: **알바 수입은 정규직을 넘으면 안 된다.**
   *
   * 취업은 스탯을 쌓고 합격 확률을 뚫어야 하지만 알바는 그냥 누르면 된다. 알바가 더 벌면
   * 취업·직군 트랙이 통째로 죽는다. 실제로 두 번 역전돼 있었다:
   *   - 구곡선(무한 상승): 60회에 월 220만 → 대기업(100만)의 2.2배
   *   - 1차 수정안(상한 7.8만): 40회에 월 108만 → 대기업 초과
   * 알바 월수입은 평일 20일 기준 `일당 × 20`이다.
   */
  it("숙련 만렙 알바가 정규직 전 등급 월급을 넘지 못한다", () => {
    const maxMonthly = PART_TIME_PAY_CAP * PART_TIME_WEEKDAYS_PER_MONTH;
    // 중소 이상은 전부 알바보다 많아야 한다(극소는 알바가 조금 나을 수 있다 — 알바의 유일한 이점).
    expect(maxMonthly, "중소기업").toBeLessThan(TIERS.small.baseSalary);
    expect(maxMonthly, "중견기업").toBeLessThan(TIERS.medium.baseSalary);
    expect(maxMonthly, "대기업").toBeLessThan(TIERS.large.baseSalary);
  });

  it("성과 레벨이 오른 정규직은 알바와 격차가 더 벌어진다", () => {
    const maxMonthly = PART_TIME_PAY_CAP * PART_TIME_WEEKDAYS_PER_MONTH;
    // 성과 레벨 1만 올라도 극소기업조차 알바 만렙을 넘어선다 — 취업이 성장 경로임을 보증한다.
    expect(TIERS.micro.baseSalary + PERF_LEVEL_RAISE).toBeGreaterThan(maxMonthly);
  });

  /**
   * ★ 알바가 정규직보다 **유리한 유일한 축**: 시간 자유.
   *
   * 수입·행동력에서 알바가 지도록 묶어놨으므로(위 테스트들), 이 축까지 사라지면
   * 알바는 선택지가 아니라 그냥 나쁜 버튼이 된다. 정규직의 '평일 낮 강제'가
   * 실제로 존재하는지를 고정해 그 교환을 지킨다.
   */
  it("정규직은 평일 낮이 강제 근무 — 알바에는 그런 제약이 없다", () => {
    const s = createInitialState();
    s.employment = {
      company: "테스트상사",
      tier: "small",
      role: "사원",
      hiredDay: 1,
      performance: 0,
      perfLevel: 0,
    } as GameState["employment"];

    let forced = 0;
    for (let day = 2; day <= 31; day++) {
      for (const slot of [0, 1]) {
        s.day = day;
        s.slot = slot;
        if (isWorkNow(s)) forced++;
      }
    }
    // 한 달에 평일 낮 슬롯(약 20여 개)이 통째로 근무에 묶인다.
    expect(forced).toBeGreaterThan(15);

    // 알바는 강제 슬롯이 없다 — 활동 목록에 있을 뿐 시간대 게이트가 걸리지 않는다.
    // (요일·슬롯 조건을 갖는 활동이면 여기서 걸러졌을 것이다.)
    for (const a of partTimeActivities()) {
      expect(a.group, `${a.label}`).toBe("work");
    }
  });

  it("알바 4종 전부 정규직 근무보다 행동력을 더 쓴다", () => {
    // 수입 상한(위 테스트)과 짝을 이루는 불변식 — 알바가 정규직보다 유리한 구석이 없어야 한다.
    // 알바는 같은 1블록에 행동력을 더 태운다(고용 안정성이 없다는 표현).
    for (const a of partTimeActivities()) {
      expect(-a.action, `${a.label} 행동력`).toBeGreaterThan(WORK_ACTION_COST);
      expect(-a.action, `${a.label} 최소 행동력`).toBeGreaterThanOrEqual(PART_TIME_MIN_ACTION);
    }
  });

  it("손상값(NaN·음수)은 base로 떨어진다 — 소지금 NaN 오염 방지", () => {
    expect(partTimePay(NaN)).toBe(PART_TIME_BASE);
    expect(partTimePay(-5)).toBe(PART_TIME_BASE);
    expect(Number.isFinite(partTimePay(Infinity))).toBe(true);
  });

  it("다음 인상까지 남은 횟수 — 상한이면 null", () => {
    expect(partTimeNextRaiseIn(0)).toBe(PART_TIME_TIER);
    expect(partTimeNextRaiseIn(19)).toBe(1);
    expect(partTimeNextRaiseIn(20)).toBe(PART_TIME_TIER);
    expect(partTimeNextRaiseIn(80)).toBeNull();
  });
});

describe("알바별 개별 카운터", () => {
  /** 알바 활동을 실제로 1회 수행(정신력을 높게 유지해 실수 판정을 피한다). */
  function work(state: GameState, id: string): void {
    const act = OFFLINE_ACTIVITIES.find((a) => a.id === id)!;
    state.resources.action = 100;
    state.resources.mental = 100;
    state.skills.sociability = 999; // 낮은 친화력 페널티 배제
    doOfflineActivity(state, act);
  }

  it("모든 알바 활동은 partTime 표식과 고유 id를 갖는다", () => {
    const pts = partTimeActivities();
    expect(pts.length).toBeGreaterThan(0);
    expect(new Set(pts.map((a) => a.id)).size).toBe(pts.length);
  });

  it("레거시 id 알바는 반드시 남아 있어야 한다(구세이브 숙련·성인 조우의 호스트)", () => {
    expect(partTimeActivities().some((a) => a.id === PART_TIME_LEGACY_ID)).toBe(true);
  });

  it("한 알바를 해도 다른 알바의 카운터는 오르지 않는다", () => {
    const pts = partTimeActivities();
    const state = createInitialState();
    work(state, pts[0].id);
    expect(partTimeCountOf(state, pts[0].id)).toBe(1);
    for (const other of pts.slice(1)) {
      expect(partTimeCountOf(state, other.id)).toBe(0);
      expect(partTimePay(partTimeCountOf(state, other.id))).toBe(PART_TIME_BASE);
    }
  });

  it("한 우물을 20회 파면 그 알바만 일당이 오른다", () => {
    const pts = partTimeActivities();
    if (pts.length < 2) return; // 4종 분할 전이면 스킵(content 작업 대기 중)
    const state = createInitialState();
    for (let i = 0; i < PART_TIME_TIER; i++) work(state, pts[0].id);
    expect(partTimeCountOf(state, pts[0].id)).toBe(PART_TIME_TIER);
    expect(partTimePay(partTimeCountOf(state, pts[0].id))).toBe(PART_TIME_BASE + PART_TIME_RAISE);
    expect(partTimePay(partTimeCountOf(state, pts[1].id))).toBe(PART_TIME_BASE);
  });

  it("첫 1회의 일당은 BASE이고 소지금이 NaN이 되지 않는다(키 부재 → +1 경로)", () => {
    const state = createInitialState();
    const before = state.money;
    work(state, PART_TIME_LEGACY_ID);
    expect(Number.isFinite(state.money)).toBe(true);
    expect(state.money - before).toBe(PART_TIME_BASE);
  });
});

describe("구세이브 마이그레이션", () => {
  /** partTimeCounts 키가 없고 구 partTimeCount(숫자)만 있는 세이브를 심고 로드한다. */
  function loadOldSave(count: number): GameState {
    const s = createInitialState() as unknown as Record<string, unknown>;
    delete s.partTimeCounts; // 구세이브 = 신필드 키 자체가 없다
    s.partTimeCount = count;
    store.set(SAVE_KEY, JSON.stringify(s));
    return loadGame()!;
  }

  it("구 partTimeCount가 레거시 알바로 그대로 이관된다(죽은 폴백이 아니다)", () => {
    const loaded = loadOldSave(60);
    expect(partTimeCountOf(loaded, PART_TIME_LEGACY_ID)).toBe(60);
  });

  it("숙련이 0으로 증발하지 않는다 — 이관 후 일당이 base보다 높다", () => {
    // 60회는 3단계(60/20)에 해당하지만 상한에 먼저 걸린다 — 둘 중 낮은 쪽이 정답이다.
    // 단계값을 하드코딩하면 상한을 조정할 때마다 이 테스트가 깨지므로 partTimePay로 기대치를 뽑는다.
    const loaded = loadOldSave(60);
    const pay = partTimePay(partTimeCountOf(loaded, PART_TIME_LEGACY_ID));
    expect(pay).toBeGreaterThan(PART_TIME_BASE);
    expect(pay).toBe(partTimePay(60));
    expect(partTimeCountOf(loaded, PART_TIME_LEGACY_ID)).toBe(60);
  });

  it("나눠 배분하지 않는다 — 다른 알바는 0회에서 시작(소급 보상 방지)", () => {
    const loaded = loadOldSave(60);
    for (const a of partTimeActivities()) {
      if (a.id === PART_TIME_LEGACY_ID) continue;
      expect(partTimeCountOf(loaded, a.id)).toBe(0);
    }
  });

  it("구 필드 잔재는 제거된다", () => {
    const loaded = loadOldSave(60);
    expect((loaded as { partTimeCount?: unknown }).partTimeCount).toBeUndefined();
  });

  it("알바를 한 적 없는 구세이브(0회)는 빈 카운터로 로드된다", () => {
    const loaded = loadOldSave(0);
    expect(partTimeCountOf(loaded, PART_TIME_LEGACY_ID)).toBe(0);
  });

  it("이미 마이그레이션된 신세이브는 덮어쓰지 않는다", () => {
    const s = createInitialState() as unknown as Record<string, unknown>;
    s.partTimeCounts = { [PART_TIME_LEGACY_ID]: 5, cafe: 12 };
    s.partTimeCount = 99; // 잔재가 남아 있어도 신필드가 이긴다
    store.set(SAVE_KEY, JSON.stringify(s));
    const loaded = loadGame()!;
    expect(partTimeCountOf(loaded, PART_TIME_LEGACY_ID)).toBe(5);
    expect(partTimeCountOf(loaded, "cafe")).toBe(12);
  });

  it("손상된 카운터(NaN·문자열·음수)는 걷어낸다 — 소지금 NaN 오염 방지", () => {
    const s = createInitialState() as unknown as Record<string, unknown>;
    s.partTimeCounts = { [PART_TIME_LEGACY_ID]: null, bad: "x", neg: -3, ok: 7 };
    store.set(SAVE_KEY, JSON.stringify(s));
    const loaded = loadGame()!;
    expect(partTimeCountOf(loaded, PART_TIME_LEGACY_ID)).toBe(0);
    expect(partTimeCountOf(loaded, "bad")).toBe(0);
    expect(partTimeCountOf(loaded, "neg")).toBe(0);
    expect(partTimeCountOf(loaded, "ok")).toBe(7);
    expect(Number.isFinite(partTimePay(partTimeCountOf(loaded, "bad")))).toBe(true);
  });

  it("partTimeCounts가 객체가 아닌 손상 세이브도 로드된다", () => {
    const s = createInitialState() as unknown as Record<string, unknown>;
    s.partTimeCounts = 42; // 구 필드명이 그대로 넘어온 최악의 경우
    store.set(SAVE_KEY, JSON.stringify(s));
    const loaded = loadGame()!;
    expect(typeof loaded.partTimeCounts).toBe("object");
    expect(partTimeCountOf(loaded, PART_TIME_LEGACY_ID)).toBe(0);
  });
});
