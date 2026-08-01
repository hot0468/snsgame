import { describe, it, expect } from "vitest";
import { createInitialState, MORNING_SLOT, LATE_SLOT } from "@/core/state";
import { RELATIONSHIP_CHARS } from "@/data/relationships";
import {
  COLD_TARGETS,
  KNOWN_AFFINITY_COST,
  KNOWN_BURNED_AT,
} from "@/data/insurance";
import {
  canApplyInsurance,
  coldChance,
  isInsuranceWorkNow,
  joinInsurance,
  knownChance,
  knownContacts,
  sellToCold,
  sellToKnown,
} from "@/systems/insurance";
import { mutableRelOf, relStateOf } from "@/systems/relationship";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { hasJobExperience, JOB_ID } from "@/systems/jobExperience";
import { isWeekday } from "@/systems/calendar";
import type { GameState } from "@/core/types";

/**
 * 보험설계사직 회귀 테스트.
 *
 * 고정하는 불변식:
 *  1) **지인은 유한한 자원이다** — 영업할수록 호감도가 닳고, 0이 되면 연락이 끊겨
 *     목록에서 영구히 빠진다. 이게 이 직업의 전부다.
 *  2) 호감도는 **성사 여부와 무관하게** 깎인다. 실패가 공짜면 지인을 무한히 긁는 게
 *     지배 전략이 되고 "언제 태울까"라는 결정이 사라진다.
 *  3) 지인 영업이 무작위 영업보다 성사율이 높다(그래야 태울 유인이 생긴다).
 *  4) 평일 낮에만 강제 출근한다.
 */

/** 설계사로 입사하고, 지인 몇 명의 호감도를 채워둔 상태. */
function hired(affinity = 80, n = 3): GameState {
  const s = createInitialState();
  joinInsurance(s);
  for (const c of RELATIONSHIP_CHARS.slice(0, n)) {
    mutableRelOf(s, c.id).affinity = affinity;
  }
  return s;
}

/** 평일을 찾아 그 날 낮으로 옮긴다. */
function toWeekdayNoon(s: GameState): void {
  for (let i = 0; i < 14; i++) {
    if (isWeekday(s.day)) break;
    s.day += 1;
  }
  s.slot = MORNING_SLOT;
}

describe("입사·출근", () => {
  it("자격 조건 없이 지원할 수 있고 배타·도감에 편입된다", () => {
    const s = createInitialState();
    expect(canApplyInsurance(s)).toBe(true);
    expect(joinInsurance(s)).not.toBeNull();
    expect(hasAnyJob(s)).toBe(true);
    expect(currentJobLabel(s)).toBe("보험설계사");
    expect(hasJobExperience(s, JOB_ID.insurance)).toBe(true);
  });

  it("평일 낮에만 강제 출근한다", () => {
    const s = hired();
    s.day += 1; // 입사 당일은 쉰다
    toWeekdayNoon(s);
    expect(isInsuranceWorkNow(s)).toBe(true);
    s.slot = LATE_SLOT;
    expect(isInsuranceWorkNow(s), "심야엔 출근 안 한다").toBe(false);
  });

  it("입사 당일은 출근하지 않는다", () => {
    const s = hired();
    toWeekdayNoon(s);
    s.day = s.insuranceJob!.hiredDay;
    expect(isInsuranceWorkNow(s)).toBe(false);
  });
});

describe("지인은 유한한 자원이다", () => {
  it("호감도가 0인 캐릭터는 애초에 지인이 아니다", () => {
    const s = createInitialState();
    joinInsurance(s);
    // 아무 관계도 안 쌓았으면 영업할 지인이 없다.
    expect(knownContacts(s).length).toBe(0);
  });

  it("영업하면 성사 여부와 무관하게 호감도가 깎인다", () => {
    const s = hired(90, 1);
    const id = RELATIONSHIP_CHARS[0].id;
    const before = relStateOf(s, id).affinity;
    sellToKnown(s, id);
    expect(relStateOf(s, id).affinity).toBeLessThanOrEqual(before - KNOWN_AFFINITY_COST);
  });

  it("호감도가 바닥나면 연락이 끊기고 목록에서 사라진다", () => {
    const s = hired(90, 1);
    const id = RELATIONSHIP_CHARS[0].id;
    let burnedSeen = false;
    for (let i = 0; i < 20; i++) {
      const r = sellToKnown(s, id);
      if (r?.burned) burnedSeen = true;
      if (relStateOf(s, id).affinity <= KNOWN_BURNED_AT) break;
    }
    expect(burnedSeen, "연락 끊김이 보고돼야 한다").toBe(true);
    expect(s.insuranceJob!.burnedContacts).toContain(id);
    expect(knownContacts(s).some((c) => c.id === id), "목록에서 빠져야 한다").toBe(false);
  });

  it("연락이 끊긴 지인은 다시 목록에 안 돌아온다 — 호감도를 되살려도", () => {
    const s = hired(90, 1);
    const id = RELATIONSHIP_CHARS[0].id;
    s.insuranceJob!.burnedContacts.push(id);
    mutableRelOf(s, id).affinity = 100;
    expect(knownContacts(s).some((c) => c.id === id)).toBe(false);
  });
});

describe("성사율", () => {
  it("친할수록 성사율이 높다", () => {
    const s = hired(20, 1);
    const id = RELATIONSHIP_CHARS[0].id;
    const low = knownChance(s, id);
    mutableRelOf(s, id).affinity = 95;
    expect(knownChance(s, id)).toBeGreaterThan(low);
  });

  it("지인 영업이 무작위 영업보다 성사율이 높다 — 그래야 태울 유인이 생긴다", () => {
    const s = hired(80, 1);
    expect(knownChance(s, RELATIONSHIP_CHARS[0].id)).toBeGreaterThan(coldChance(s));
  });

  it("무작위 영업은 친화력·평판이 올릴수록 좋아진다", () => {
    const s = hired();
    const base = coldChance(s);
    s.skills.sociability = 999;
    expect(coldChance(s)).toBeGreaterThan(base);
  });

  it("성사율은 항상 0~1 안에 있다", () => {
    const s = hired(100, 1);
    s.skills.sociability = 999;
    s.resources.reputation = 100;
    expect(coldChance(s)).toBeLessThanOrEqual(1);
    expect(knownChance(s, RELATIONSHIP_CHARS[0].id)).toBeLessThanOrEqual(1);
    s.skills.sociability = 0;
    s.resources.reputation = 0;
    expect(coldChance(s)).toBeGreaterThan(0);
  });
});

describe("무작위 영업", () => {
  it("정신력을 쓰고 친화력이 오르며 아무도 잃지 않는다", () => {
    const s = hired();
    const mental = s.resources.mental;
    const soc = s.skills.sociability;
    const contactsBefore = knownContacts(s).length;
    const r = sellToCold(s);
    expect(r).not.toBeNull();
    expect(s.resources.mental).toBeLessThan(mental);
    expect(s.skills.sociability).toBeGreaterThan(soc);
    expect(knownContacts(s).length, "지인은 그대로다").toBe(contactsBefore);
    expect(r!.burned).toBeNull();
  });

  it("설계사가 아니면 영업이 안 된다", () => {
    const s = createInitialState();
    expect(sellToCold(s)).toBeNull();
    expect(sellToKnown(s, RELATIONSHIP_CHARS[0].id)).toBeNull();
  });
});

describe("콘텐츠", () => {
  it("무작위 영업 대상이 비어 있지 않다", () => {
    expect(COLD_TARGETS.length).toBeGreaterThan(0);
    for (const t of COLD_TARGETS) {
      expect(t.place.length).toBeGreaterThan(0);
      expect(t.who.length).toBeGreaterThan(0);
    }
  });
});
