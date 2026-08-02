import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { RECIPES } from "@/data/grocery";
import { RACES } from "@/data/races";
import { VACATION_DESTINATIONS } from "@/data/vacation";
import { HAIR_QUESTIONS } from "@/data/hairSalon";
import { recordCooking, DISH_TOTAL } from "@/systems/cooking";
import {
  applyRace,
  expectedRecord,
  meetsRaceRequirement,
  resolveRace,
  RACE_DELAY_DAYS,
} from "@/systems/marathon";
import {
  BODY_GAUGE_MAX,
  STUDIO_NAME,
  BODY_PROFILE_DAYS,
  BODY_PROFILE_FEE,
  BINGE_MENTAL_THRESHOLD,
  gainBodyGauge,
  resolveBodyProfile,
  rollBinge,
  startBodyProfile,
} from "@/systems/bodyProfile";
import { applyHairResult, talkGrade, SALON_COST } from "@/systems/hairSalon";
import { rollOffer } from "@/systems/offline";

/**
 * 운동·미용·요리·여행 확장 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - 요리 도감이 **중복 등록되지 않는다**(같은 요리를 두 번 만들어도 1종).
 * - 마라톤 기록이 운동·체력에 **단조 반응**한다(스탯을 올렸는데 기록이 나빠지면 축이 무너진다).
 * - 바디프로필 유혹이 **정신력 문턱 위에서는 절대 안 뜬다**(뜨면 관리 자체가 무의미해진다).
 * - 미니게임 등급 환산과 여행 목적지 가격/시간 곡선의 방향성.
 */

describe("요리 도감", () => {
  it("같은 요리를 두 번 만들어도 1종만 등록된다", () => {
    const s = createInitialState();
    const first = recordCooking(s, RECIPES[0]);
    const second = recordCooking(s, RECIPES[0]);
    expect(first).not.toBeNull();
    expect(second).toBeNull();
    expect(s.cookedDishes).toHaveLength(1);
  });

  it("전 종을 모으면 마지막 등록이 도감 완성으로 표시된다", () => {
    const s = createInitialState();
    const results = RECIPES.map((r) => recordCooking(s, r));
    expect(s.cookedDishes).toHaveLength(DISH_TOTAL);
    expect(results.at(-1)?.completed).toBe(true);
    expect(results[0]?.completed).toBe(false);
  });
});

describe("마라톤 대회", () => {
  it("운동이 높을수록 예상 기록이 빨라진다", () => {
    const slow = createInitialState();
    const fast = createInitialState();
    fast.skills.fitness = 900;
    for (const race of RACES) {
      expect(expectedRecord(fast, race), race.name).toBeLessThan(expectedRecord(slow, race));
    }
  });

  it("체력 한계치가 높을수록 기록이 빨라진다 (장거리일수록 격차가 크다)", () => {
    const weak = createInitialState();
    const strong = createInitialState();
    weak.skills.fitness = strong.skills.fitness = 500;
    strong.staminaMax = 900;
    const full = RACES.at(-1)!;
    const short = RACES[0];
    const gapFull = expectedRecord(weak, full) - expectedRecord(strong, full);
    const gapShort = expectedRecord(weak, short) - expectedRecord(strong, short);
    expect(gapFull).toBeGreaterThan(gapShort);
  });

  it("운동이 모자란 코스는 신청되지 않고 참가비도 안 나간다", () => {
    const s = createInitialState();
    const hard = RACES.at(-1)!;
    expect(meetsRaceRequirement(s, hard)).toBe(false);
    s.money = 10_000_000;
    const before = s.money;
    expect(applyRace(s, hard)).toBe("weak");
    expect(s.money).toBe(before);
    expect(s.pendingRace).toBeNull();
  });

  it("대회일 전에는 판정하지 않고, 대회일에 한 번만 판정한다", () => {
    const s = createInitialState();
    s.money = 1_000_000;
    s.skills.fitness = 800;
    expect(applyRace(s, RACES[0])).toBe("ok");
    expect(resolveRace(s)).toBeNull(); // 신청 당일

    s.day += RACE_DELAY_DAYS;
    expect(resolveRace(s)).not.toBeNull();
    expect(s.pendingRace).toBeNull();
    expect(resolveRace(s)).toBeNull(); // 중복 발동 없음
  });
});

describe("바디프로필 도전", () => {
  function started() {
    const s = createInitialState();
    s.money = BODY_PROFILE_FEE * 2;
    s.skills.fitness = 400;
    expect(startBodyProfile(s)).toBe("ok");
    return s;
  }

  it("운동 스킬·소지금이 모자라면 시작되지 않는다", () => {
    const weak = createInitialState();
    weak.money = BODY_PROFILE_FEE;
    expect(startBodyProfile(weak)).toBe("weak");

    const poor = createInitialState();
    poor.skills.fitness = 400;
    poor.money = 0;
    expect(startBodyProfile(poor)).toBe("poor");
    expect(poor.bodyProfile).toBeNull();
  });

  it("정신력이 문턱 이상이면 고칼로리 유혹이 절대 뜨지 않는다", () => {
    const s = started();
    s.resources.mental = BINGE_MENTAL_THRESHOLD;
    for (let i = 0; i < 200; i++) expect(rollBinge(s)).toBeNull();
    expect(s.bodyProfile?.binges).toBe(0);
  });

  it("정신력이 낮으면 유혹이 뜨고 게이지가 깎인다", () => {
    const s = started();
    gainBodyGauge(s, 1);
    gainBodyGauge(s, 1);
    gainBodyGauge(s, 1);
    const before = s.bodyProfile!.gauge;
    s.resources.mental = 5;
    let fired = 0;
    for (let i = 0; i < 200 && fired === 0; i++) {
      if (rollBinge(s)) fired++;
    }
    expect(fired, "200번 굴려도 유혹이 한 번도 안 떴다").toBe(1);
    expect(s.bodyProfile!.gauge).toBeLessThan(before);
  });

  it("게이지를 다 채우면 성공, 모자라면 무산 — 둘 다 도전이 종료된다", () => {
    const win = started();
    for (let i = 0; i < 100; i++) gainBodyGauge(win, 1);
    expect(win.bodyProfile!.gauge).toBe(BODY_GAUGE_MAX);
    win.day += BODY_PROFILE_DAYS;
    expect(resolveBodyProfile(win)?.success).toBe(true);
    expect(win.bodyProfile).toBeNull();

    const lose = started();
    lose.day += BODY_PROFILE_DAYS;
    expect(resolveBodyProfile(lose)?.success).toBe(false);
    expect(lose.bodyProfile).toBeNull();
  });

  it("마감일 전에는 판정하지 않는다", () => {
    const s = started();
    s.day += BODY_PROFILE_DAYS - 1;
    expect(resolveBodyProfile(s)).toBeNull();
    expect(s.bodyProfile).not.toBeNull();
  });

  it("성공이든 무산이든 스튜디오에서 결과 카톡이 온다", () => {
    // ⚠️ 예전엔 addSchedule 한 줄만 남겼다. 일정은 SCHEDULE_MAX(100) 상한이라 30일치
    //    활동에 금세 밀려나고, 무산일 때는 자동 트윗도 팔로워도 없어서 **화면에 아무 흔적이
    //    남지 않았다**("기간 끝났는데 아무것도 안 뜬다").
    //    카톡은 toastPending까지 세워 토스트로 한 번 더 알린다 — 그 두 가지를 여기서 고정한다.
    for (const gauge of [BODY_GAUGE_MAX, 0]) {
      const s = started();
      for (let i = 0; i < gauge / 4; i++) gainBodyGauge(s, 1);
      const before = s.kakao.length;
      s.day += BODY_PROFILE_DAYS;
      const r = resolveBodyProfile(s);
      expect(s.kakao.length, `게이지 ${gauge}: 결과 카톡이 없다`).toBe(before + 1);
      const thread = s.kakao[s.kakao.length - 1];
      expect(thread.sender).toBe(STUDIO_NAME);
      expect(thread.unread, "안 읽음이어야 배지가 뜬다").toBe(true);
      expect(thread.toastPending, "토스트로도 알려야 놓치지 않는다").toBe(true);
      expect(thread.messages.length).toBeGreaterThan(0);
      // 무산 카톡은 왜 안 됐는지(게이지)를 알려줘야 다음 도전에 쓸모가 있다.
      const body = thread.messages.map((m) => m.text).join("\n");
      if (!r!.success) expect(body).toContain(`${gauge}/${BODY_GAUGE_MAX}`);
    }
  });
});

describe("운동 중 제안(바디프로필·마라톤 진입로)", () => {
  /** rollOffer는 확률(OFFER_CHANCE)을 타므로, 여러 번 굴려 나온 종류의 집합을 본다. */
  function offersOver(s: ReturnType<typeof createInitialState>, n = 400): Set<string> {
    const seen = new Set<string>();
    for (let i = 0; i < n; i++) {
      const o = rollOffer(s);
      if (o) seen.add(o);
    }
    return seen;
  }

  it("초반(운동 0)에도 5K 자격은 되므로 대회 제안은 들어온다", () => {
    const s = createInitialState();
    expect(offersOver(s).has("race")).toBe(true);
  });

  it("바디프로필 조건(운동·소지금)을 채우면 촬영 제안도 들어온다", () => {
    const s = createInitialState();
    s.skills.fitness = 400;
    s.money = BODY_PROFILE_FEE * 2;
    expect(offersOver(s).has("bodyProfile")).toBe(true);
  });

  it("이미 진행 중이면 그 제안은 다시 오지 않는다", () => {
    const s = createInitialState();
    s.skills.fitness = 400;
    s.money = BODY_PROFILE_FEE * 2;
    startBodyProfile(s);
    s.pendingRace = { id: RACES[0].id, appliedDay: s.day };
    expect(offersOver(s).size).toBe(0);
  });
});

describe("미용실 미니게임", () => {
  it("대화 점수가 높을수록 등급이 좋다", () => {
    expect(talkGrade(6)).toBe("perfect");
    expect(talkGrade(4)).toBe("good");
    expect(talkGrade(0)).toBe("bad");
  });

  it("문항 선택지 점수는 0~2 범위이고, 각 문항에 정확(2) 선택지가 하나는 있다", () => {
    for (const q of HAIR_QUESTIONS) {
      expect(q.options.some((o) => o.score === 2), q.ask).toBe(true);
      for (const o of q.options) expect(o.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("망하면 미용이 깎이고, 인생머리면 크게 오른다 (비용은 어느 쪽이든 나간다)", () => {
    const good = createInitialState();
    good.money = 1_000_000;
    good.skills.beauty = 100;
    const gain = applyHairResult(good, "timing", "perfect");
    expect(gain.beauty).toBeGreaterThan(0);
    expect(good.money).toBe(1_000_000 - SALON_COST);

    const bad = createInitialState();
    bad.money = 1_000_000;
    bad.skills.beauty = 100;
    applyHairResult(bad, "talk", "bad");
    expect(bad.skills.beauty).toBeLessThan(100);
    expect(bad.money).toBe(1_000_000 - SALON_COST);
  });
});

describe("여행 목적지", () => {
  it("비쌀수록 오래 걸리고 더 많이 회복한다", () => {
    const byCost = [...VACATION_DESTINATIONS].sort((a, b) => a.cost - b.cost);
    const slots = byCost.map((d) => d.slots);
    const mental = byCost.map((d) => d.mental);
    expect(slots).toEqual([...slots].sort((a, b) => a - b));
    expect(mental).toEqual([...mental].sort((a, b) => a - b));
  });
});
