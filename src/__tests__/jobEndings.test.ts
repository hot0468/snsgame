import { describe, it, expect } from "vitest";
import { createInitialState, CELEBRATORY_ENDING_TITLES } from "@/core/state";
import {
  CALL_ENDING_TOTAL,
  ENDING_OFFERS,
  MLM_ENDING_BURNED,
  MLM_ENDING_COMMISSION,
  STYLIST_ENDING_CUTS,
  STYLIST_ENDING_REGULARS,
  TAXI_ENDING_RATING,
  TAXI_ENDING_RIDES,
  pendingEndingOffer,
} from "@/systems/endings";
import { CALL_MAX_STREAK } from "@/data/callCenter";
import { TAXI_DELUXE_CERT } from "@/data/taxi";
import { REGULAR_BONUS_MAX, REGULAR_FEE_BONUS } from "@/data/stylist";
import type { GameState } from "@/core/types";

/**
 * 직업 엔딩(택시·콜센터·다단계·헤어) 회귀 테스트.
 *
 * 왜 넣었나: 이 네 직업만 도달점이 없어 아무리 잘해도 끝이 없었다.
 *
 * 고정하는 불변식:
 *  1) **재직 중일 때만** 제안이 뜬다 — 그만둔 직업의 엔딩이 나중에 튀어나오면 안 된다.
 *  2) 조건은 **그 직업의 고유 축**이 만렙에 닿았을 때다(근속 일수 같은 공용 숫자가 아니다).
 *  3) 조건을 하나라도 덜 채우면 안 뜬다(둘 중 하나만으로 열리면 문턱이 무의미해진다).
 *  4) 거절하면 다시 안 뜬다.
 *  5) 모든 엔딩 사유가 축하 제목표에 등록돼 있다 — 빠지면 축하 엔딩이 'GAME OVER'로 뜬다.
 */

/** 모범택시 만렙 상태. */
function taxiMaxed(): GameState {
  const s = createInitialState();
  s.certifications.push(TAXI_DELUXE_CERT);
  s.taxiJob = {
    hiredDay: 1,
    totalRides: TAXI_ENDING_RIDES,
    totalEarned: 9_000_000,
    rating: TAXI_ENDING_RATING,
  };
  return s;
}

function callMaxed(): GameState {
  const s = createInitialState();
  s.callCenterJob = {
    hiredDay: 1,
    totalCalls: CALL_ENDING_TOTAL,
    totalEarned: 5_000_000,
    bestStreak: CALL_MAX_STREAK,
  };
  return s;
}

function mlmMaxed(): GameState {
  const s = createInitialState();
  s.mlmJob = {
    hiredDay: 1,
    contracts: 60,
    totalCommission: MLM_ENDING_COMMISSION,
    burnedContacts: Array.from({ length: MLM_ENDING_BURNED }, (_, i) => `rel_burn_${i}`),
    lastSalaryMonth: -1,
  };
  return s;
}

function stylistMaxed(): GameState {
  const s = createInitialState();
  s.stylistJob = {
    hiredDay: 1,
    cuts: STYLIST_ENDING_CUTS,
    totalEarned: 8_000_000,
    regulars: STYLIST_ENDING_REGULARS,
    botched: 3,
  };
  return s;
}

const CASES = [
  { id: "taxiMaster", make: taxiMaxed, label: "택시" },
  { id: "callMaster", make: callMaxed, label: "콜센터" },
  { id: "mlmDiamond", make: mlmMaxed, label: "다단계" },
  { id: "stylistOwn", make: stylistMaxed, label: "헤어" },
] as const;

describe("네 직업 모두 도달점이 있다", () => {
  for (const c of CASES) {
    it(`${c.label}: 만렙이면 엔딩 제안이 뜬다`, () => {
      const offer = pendingEndingOffer(c.make());
      expect(offer, `${c.label} 엔딩이 안 뜬다`).not.toBeNull();
      expect(offer!.id).toBe(c.id);
    });

    it(`${c.label}: 그만두면 엔딩이 안 뜬다`, () => {
      const s = c.make();
      s.taxiJob = null;
      s.callCenterJob = null;
      s.mlmJob = null;
      s.stylistJob = null;
      expect(pendingEndingOffer(s), "그만둔 직업의 엔딩이 뜨면 안 된다").toBeNull();
    });

    it(`${c.label}: 거절하면 다시 안 뜬다`, () => {
      const s = c.make();
      s.endingsDeclined.push(c.id);
      expect(pendingEndingOffer(s)).toBeNull();
    });

    it(`${c.label}: 게임오버 상태면 안 뜬다`, () => {
      const s = c.make();
      s.gameOver = "아무 사유";
      expect(pendingEndingOffer(s)).toBeNull();
    });
  }
});

describe("조건을 덜 채우면 안 뜬다", () => {
  it("택시: 모범택시 자격이 없으면 평점이 높아도 안 뜬다", () => {
    const s = taxiMaxed();
    s.certifications = s.certifications.filter((c) => c !== TAXI_DELUXE_CERT);
    expect(pendingEndingOffer(s)).toBeNull();
  });

  it("택시: 평점만 높고 운행이 모자라면 안 뜬다", () => {
    const s = taxiMaxed();
    s.taxiJob!.totalRides = TAXI_ENDING_RIDES - 1;
    expect(pendingEndingOffer(s)).toBeNull();
  });

  it("콜센터: 누적 콜만 채우고 연속 기록이 상한에 못 미치면 안 뜬다", () => {
    const s = callMaxed();
    s.callCenterJob!.bestStreak = CALL_MAX_STREAK - 1;
    expect(pendingEndingOffer(s)).toBeNull();
  });

  it("다단계: 돈만 벌고 아무도 안 태웠으면 안 뜬다 — 이 직업의 대가가 조건이다", () => {
    const s = mlmMaxed();
    s.mlmJob!.burnedContacts = [];
    expect(pendingEndingOffer(s)).toBeNull();
  });

  it("헤어: 단골이 만렙에 못 미치면 안 뜬다", () => {
    const s = stylistMaxed();
    s.stylistJob!.regulars = STYLIST_ENDING_REGULARS - 1;
    expect(pendingEndingOffer(s)).toBeNull();
  });
});

describe("문턱 자체의 계약", () => {
  it("헤어 단골 문턱 = 단가 배율이 상한에 닿는 인원", () => {
    // 만렙의 정의가 밸런스 상수와 어긋나면 '만렙인데 엔딩이 안 뜨는' 구간이 생긴다.
    expect(STYLIST_ENDING_REGULARS * REGULAR_FEE_BONUS).toBeGreaterThanOrEqual(REGULAR_BONUS_MAX);
  });

  it("콜센터 문턱은 한 자리 상한과 같다 — 상한을 낮추면 엔딩이 영영 안 열린다", () => {
    const offer = ENDING_OFFERS.find((e) => e.id === "callMaster")!;
    const s = callMaxed();
    s.callCenterJob!.bestStreak = CALL_MAX_STREAK;
    expect(offer.condition(s)).toBe(true);
  });

  it("모든 엔딩 사유가 축하 제목표에 있다", () => {
    for (const e of ENDING_OFFERS) {
      expect(CELEBRATORY_ENDING_TITLES[e.reason], `${e.id}의 제목이 없다`).toBeTruthy();
    }
  });

  it("엔딩 id가 중복되지 않는다 — 거절 기록이 서로 지워진다", () => {
    const ids = ENDING_OFFERS.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
