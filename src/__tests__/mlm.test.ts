import { describe, it, expect } from "vitest";
import { createInitialState, MORNING_SLOT, LATE_SLOT, getActiveAccount } from "@/core/state";
import { RELATIONSHIP_CHARS } from "@/data/relationships";
import {
  COLD_TARGETS,
  KNOWN_AFFINITY_COST,
  KNOWN_BURNED_AT,
  KNOWN_SIZE_MULTIPLIER,
  MLM_COMMISSION,
  MLM_MONTHLY_STOCK_COST,
} from "@/data/mlm";
import {
  acceptMlmOffer,
  canJoinMlm,
  coldChance,
  declineMlmOffer,
  isMlmWorkNow,
  joinMlm,
  knownChance,
  knownContacts,
  sellToCold,
  sellToKnown,
  switchToMlm,
} from "@/systems/mlm";
import { mutableRelOf, relStateOf } from "@/systems/relationship";
import { currentJobLabel, hasAnyJob } from "@/systems/employment";
import { hasJobExperience, JOB_ID } from "@/systems/jobExperience";
import { isWeekday, dateOfMonth } from "@/systems/calendar";
import { applyDailyCosts } from "@/systems/economy";
import { joinCallCenter } from "@/systems/callCenter";
import type { DMThread, GameState } from "@/core/types";

/**
 * 다단계 사업자직 회귀 테스트.
 *
 * 고정하는 불변식:
 *  1) **지인은 유한한 자원이다** — 권할수록 호감도가 닳고, 0이 되면 연락이 끊겨
 *     목록에서 영구히 빠진다. 이게 이 직업의 전부다.
 *  2) 호감도는 **성사 여부와 무관하게** 깎인다. 실패가 공짜면 지인을 무한히 긁는 게
 *     지배 전략이 되고 "언제 태울까"라는 결정이 사라진다.
 *  3) 지인 판매가 길거리 홍보보다 성사율이 높다(그래야 태울 유인이 생긴다).
 *  4) 평일 낮에만 강제 출근한다.
 *  5) **정산일에 돈이 나간다** — 고정급이 아니라 재고 매입비다. 방향이 뒤집히면
 *     이 직업은 그냥 '실적 좋은 회사원'이 되고 다단계가 아니게 된다.
 *  6) **입사 경로는 이사님 DM 제의뿐이다** — 채용 사이트를 지웠으므로 이 경로가 막히면
 *     직업 자체에 도달할 수 없다.
 */

/** 사업자로 등록하고, 지인 몇 명의 호감도를 채워둔 상태. */
function hired(affinity = 80, n = 3): GameState {
  const s = createInitialState();
  joinMlm(s);
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

/** 이사님 제의 DM 하나를 심어두고 그 스레드를 돌려준다. */
function withOffer(s: GameState): DMThread {
  const thread: DMThread = {
    id: "dm_mlm_test",
    partnerName: "이사님",
    partnerHandle: "freedom_king",
    attribute: "daily",
    isAdult: false,
    messages: [{ id: "m1", from: "partner", text: "설명회 오세요", day: s.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    scam: true,
    mlmOffer: true,
  };
  getActiveAccount(s).dms.unshift(thread);
  return thread;
}

describe("입사는 이사님 DM 제의로만", () => {
  it("제의를 수락하면 사업자가 되고 배타·도감에 편입된다", () => {
    const s = createInitialState();
    const t = withOffer(s);
    expect(canJoinMlm(s)).toBe(true);
    acceptMlmOffer(s, t.id);
    expect(hasAnyJob(s)).toBe(true);
    expect(currentJobLabel(s)).toBe("프리덤라이프 사업자");
    expect(hasJobExperience(s, JOB_ID.mlm)).toBe(true);
  });

  it("수락하면 제의 버튼이 사라지고 상대가 말을 덧붙인다", () => {
    const s = createInitialState();
    const t = withOffer(s);
    const before = t.messages.length;
    acceptMlmOffer(s, t.id);
    expect(t.mlmOffer, "버튼이 남으면 중복 입사 시도가 가능해진다").toBe(false);
    expect(t.messages.length).toBeGreaterThan(before);
  });

  it("거절하면 직업이 안 생기고 제의만 닫힌다", () => {
    const s = createInitialState();
    const t = withOffer(s);
    declineMlmOffer(s, t.id);
    expect(s.mlmJob).toBeNull();
    expect(t.mlmOffer).toBe(false);
  });

  it("다른 직업이 있으면 수락이 통째로 무시된다 — 전환은 switchToMlm이 한다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    const t = withOffer(s);
    acceptMlmOffer(s, t.id);
    expect(s.mlmJob, "겸직이 뚫리면 안 된다").toBeNull();
    expect(t.mlmOffer, "제의도 그대로 남아 있어야 다시 고를 수 있다").toBe(true);

    switchToMlm(s, t.id);
    expect(s.mlmJob).not.toBeNull();
    expect(s.callCenterJob, "옛 직업은 정리된다").toBeNull();
  });
});

describe("출근", () => {
  it("평일 낮에만 강제 출근한다", () => {
    const s = hired();
    s.day += 1; // 등록 당일은 쉰다
    toWeekdayNoon(s);
    expect(isMlmWorkNow(s)).toBe(true);
    s.slot = LATE_SLOT;
    expect(isMlmWorkNow(s), "심야엔 출근 안 한다").toBe(false);
  });

  it("등록 당일은 출근하지 않는다", () => {
    const s = hired();
    toWeekdayNoon(s);
    s.day = s.mlmJob!.hiredDay;
    expect(isMlmWorkNow(s)).toBe(false);
  });
});

describe("재고 매입비 — 정산일에 돈이 나간다", () => {
  /** 10일까지 하루씩 넘기며 일일 정산을 돌린다. */
  function runToTenth(s: GameState): number {
    const before = s.money;
    let charged = 0;
    for (let i = 0; i < 40 && charged === 0; i++) {
      s.day += 1;
      const cash = s.money;
      applyDailyCosts(s);
      if (dateOfMonth(s.day) === 10) charged = cash - s.money;
    }
    return before === s.money ? 0 : charged;
  }

  it("매월 10일에 매입비가 빠져나간다(들어오지 않는다)", () => {
    const s = hired();
    s.money = 5_000_000;
    const delta = runToTenth(s);
    expect(delta, "정산일에 잔고가 줄어야 한다").toBeGreaterThanOrEqual(MLM_MONTHLY_STOCK_COST);
  });

  it("매입비가 지인 판매 1건 수당보다 많다 — 한 달에 하나는 태워야 본전", () => {
    expect(MLM_MONTHLY_STOCK_COST).toBeGreaterThan(MLM_COMMISSION * KNOWN_SIZE_MULTIPLIER);
  });

  it("사업자가 아니면 매입비를 안 뗀다", () => {
    const s = createInitialState();
    s.money = 5_000_000;
    const before = s.money;
    s.day += 1;
    applyDailyCosts(s);
    expect(s.money).toBeLessThanOrEqual(before); // 생활비만 나간다
    expect(before - s.money).toBeLessThan(MLM_MONTHLY_STOCK_COST);
  });
});

describe("지인은 유한한 자원이다", () => {
  it("호감도가 0인 캐릭터는 애초에 지인이 아니다", () => {
    const s = createInitialState();
    joinMlm(s);
    // 아무 관계도 안 쌓았으면 권할 지인이 없다.
    expect(knownContacts(s).length).toBe(0);
  });

  it("권하면 성사 여부와 무관하게 호감도가 깎인다", () => {
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
    expect(s.mlmJob!.burnedContacts).toContain(id);
    expect(knownContacts(s).some((c) => c.id === id), "목록에서 빠져야 한다").toBe(false);
  });

  it("연락이 끊긴 지인은 다시 목록에 안 돌아온다 — 호감도를 되살려도", () => {
    const s = hired(90, 1);
    const id = RELATIONSHIP_CHARS[0].id;
    s.mlmJob!.burnedContacts.push(id);
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

  it("지인 판매가 길거리 홍보보다 성사율이 높다 — 그래야 태울 유인이 생긴다", () => {
    const s = hired(80, 1);
    expect(knownChance(s, RELATIONSHIP_CHARS[0].id)).toBeGreaterThan(coldChance(s));
  });

  it("길거리 홍보는 친화력·평판이 올릴수록 좋아진다", () => {
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

describe("길거리 홍보", () => {
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

  it("사업자가 아니면 영업이 안 된다", () => {
    const s = createInitialState();
    expect(sellToCold(s)).toBeNull();
    expect(sellToKnown(s, RELATIONSHIP_CHARS[0].id)).toBeNull();
  });
});

describe("콘텐츠", () => {
  it("길거리 홍보 대상이 비어 있지 않다", () => {
    expect(COLD_TARGETS.length).toBeGreaterThan(0);
    for (const t of COLD_TARGETS) {
      expect(t.place.length).toBeGreaterThan(0);
      expect(t.who.length).toBeGreaterThan(0);
    }
  });
});
