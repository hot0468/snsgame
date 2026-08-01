import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  BOOKING_MAX,
  CUT_STYLES,
  CUSTOMERS,
  STYLIST_REQ_CERT,
} from "@/data/stylist";
import {
  bookingCount,
  canApplyStylist,
  cutChance,
  doCut,
  estimateFee,
  fameFeeMultiplier,
  joinStylist,
  regularFeeMultiplier,
  stylesFor,
} from "@/systems/stylist";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { hasJobExperience, JOB_ID } from "@/systems/jobExperience";
import type { GameState } from "@/core/types";

/**
 * 헤어디자이너직 회귀 테스트.
 *
 * 고정하는 불변식:
 *  1) **팔로워가 예약과 단가를 둘 다 올린다** — 이 직업이 SNS 본편과 협력한다는 축.
 *     다른 직업(택시 심야·콜센터 정신력)은 전부 본편과 경쟁하므로, 이게 깨지면
 *     헤어디자이너의 존재 이유가 사라진다.
 *  2) 시술을 망치면 **평판이 깎이고 단골이 떠난다** — 직업 실수가 본편으로 되돌아오는
 *     유일한 지점.
 *  3) 망쳐도 시술비는 절반 받는다. 0원이면 어려운 시술을 시도할 이유가 없어져
 *     모두가 '다듬기'만 하고 시술 5종이 죽는다.
 *  4) 미용사 자격증이 게이트다.
 */

function licensed(): GameState {
  const s = createInitialState();
  s.certifications.push(STYLIST_REQ_CERT);
  return s;
}

function hired(): GameState {
  const s = licensed();
  joinStylist(s);
  return s;
}

const style = (id: string) => CUT_STYLES.find((c) => c.id === id)!;

describe("입사", () => {
  it("미용사 자격증이 없으면 지원할 수 없다", () => {
    const s = createInitialState();
    expect(canApplyStylist(s)).toBe(false);
    expect(joinStylist(s)).toBeNull();
  });

  it("자격증이 있으면 입사되고 배타·도감에 편입된다", () => {
    const s = hired();
    expect(s.stylistJob).not.toBeNull();
    expect(hasAnyJob(s)).toBe(true);
    expect(currentJobLabel(s)).toBe("헤어디자이너");
    expect(hasJobExperience(s, JOB_ID.stylist)).toBe(true);
  });

  it("입사하면 기존 직업이 정리된다", () => {
    const s = licensed();
    s.lecturerJob = { hiredDay: 1, lessonsThisMonth: 0, totalLessons: 0, lastSalaryMonth: -1 };
    joinStylist(s);
    expect(s.lecturerJob).toBeNull();
    expect(s.stylistJob).not.toBeNull();
  });
});

describe("팔로워가 곧 손님이다 — 이 직업의 축", () => {
  it("팔로워가 늘면 예약이 늘어난다", () => {
    const s = hired();
    const low = bookingCount(s);
    getActiveAccount(s).followers = 50_000;
    expect(bookingCount(s)).toBeGreaterThan(low);
  });

  it("예약은 상한을 넘지 않는다", () => {
    const s = hired();
    getActiveAccount(s).followers = 5_000_000;
    expect(bookingCount(s)).toBe(BOOKING_MAX);
  });

  it("팔로워가 늘면 단가도 오른다", () => {
    const s = hired();
    const low = fameFeeMultiplier(s);
    getActiveAccount(s).followers = 200_000;
    expect(fameFeeMultiplier(s)).toBeGreaterThan(low);
  });

  it("예약과 단가에 둘 다 걸린다 — 하나만 걸리면 축이 절반이 된다", () => {
    const s = hired();
    const cut = style("cut");
    const bookingsLow = bookingCount(s);
    const feeLow = estimateFee(s, cut);
    getActiveAccount(s).followers = 150_000;
    expect(bookingCount(s)).toBeGreaterThan(bookingsLow);
    expect(estimateFee(s, cut)).toBeGreaterThan(feeLow);
  });

  it("뷰티 스킬이 높을수록 단가와 성공률이 오른다", () => {
    const s = hired();
    const cut = style("cut");
    const feeLow = estimateFee(s, cut);
    const chanceLow = cutChance(s, cut);
    s.skills.beauty = 999;
    expect(estimateFee(s, cut)).toBeGreaterThan(feeLow);
    expect(cutChance(s, cut)).toBeGreaterThan(chanceLow);
  });
});

describe("단골 — 쌓는 자원", () => {
  it("단골이 늘면 단가가 오른다", () => {
    const s = hired();
    const low = regularFeeMultiplier(s);
    s.stylistJob!.regulars = 10;
    expect(regularFeeMultiplier(s)).toBeGreaterThan(low);
  });

  it("단골 보너스는 상한이 있다", () => {
    const s = hired();
    s.stylistJob!.regulars = 10_000;
    expect(regularFeeMultiplier(s)).toBeLessThanOrEqual(1.6 + 1e-9);
  });
});

describe("시술", () => {
  it("시술비가 즉시 소지금에 들어오고 누적이 쌓인다", () => {
    const s = hired();
    const before = s.money;
    const r = doCut(s, style("cut"));
    expect(r).not.toBeNull();
    expect(s.money - before).toBe(r!.fee);
    expect(s.stylistJob!.cuts).toBe(1);
  });

  it("망쳐도 시술비를 받는다 — 0원이면 어려운 시술을 할 이유가 없어진다", () => {
    const s = hired();
    s.skills.beauty = 0;
    // 최악의 시술을 여러 번 돌려 실패 케이스를 반드시 만난다.
    let sawFail = false;
    for (let i = 0; i < 80; i++) {
      const r = doCut(s, style("makeover"));
      if (r && !r.ok) {
        sawFail = true;
        expect(r.fee).toBeGreaterThan(0);
        break;
      }
    }
    expect(sawFail, "실패를 한 번은 만나야 한다").toBe(true);
  });

  it("망치면 평판이 깎이고 단골이 떠난다 — 실수가 본편으로 되돌아온다", () => {
    const s = hired();
    s.skills.beauty = 0;
    s.stylistJob!.regulars = 10;
    const rep = s.resources.reputation;
    for (let i = 0; i < 80; i++) {
      const r = doCut(s, style("makeover"));
      if (r && !r.ok) {
        expect(s.resources.reputation).toBeLessThan(rep);
        expect(r.lostRegulars).toBeGreaterThan(0);
        return;
      }
    }
    throw new Error("실패를 한 번도 못 만났다");
  });

  it("디자이너가 아니면 시술이 안 된다", () => {
    const s = createInitialState();
    expect(doCut(s, style("cut"))).toBeNull();
  });
});

describe("콘텐츠", () => {
  it("어려운 시술일수록 비싸고 성공률이 낮다", () => {
    const s = hired();
    const trim = style("trim");
    const makeover = style("makeover");
    expect(estimateFee(s, makeover)).toBeGreaterThan(estimateFee(s, trim));
    expect(cutChance(s, makeover)).toBeLessThan(cutChance(s, trim));
  });

  it("원하는 시술이 정해진 손님은 그것만 고를 수 있다", () => {
    const wanting = CUSTOMERS.find((c) => c.wants)!;
    const list = stylesFor(wanting);
    expect(list.length).toBe(1);
    expect(list[0].id).toBe(wanting.wants);
  });

  it("손님이 원하는 시술 id는 실재하는 시술이어야 한다", () => {
    const ids = new Set(CUT_STYLES.map((c) => c.id));
    for (const c of CUSTOMERS) {
      if (c.wants) expect(ids.has(c.wants), `${c.wants}`).toBe(true);
    }
  });

  it("시술 id가 중복되지 않는다", () => {
    const ids = CUT_STYLES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
