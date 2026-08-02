import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { JOB_CATALOG, jobLevelRows, levelFromCount } from "@/systems/jobLevels";
import { JOB_ID, markJobExperienced } from "@/systems/jobExperience";
import { joinCallCenter } from "@/systems/callCenter";
import { joinTaxi } from "@/systems/taxi";
import { joinMlm } from "@/systems/mlm";
import { joinStylist } from "@/systems/stylist";
import { TAXI_REQ_CERT } from "@/data/taxi";
import { STYLIST_REQ_CERT } from "@/data/stylist";
import type { GameState } from "@/core/types";

/**
 * 직업 도감 회귀 테스트.
 *
 * 왜 넣었나: 택시·콜센터·다단계·헤어 넷이 `JOB_ID`에 있고 `markJobExperienced`도
 * 불렸는데 `JOB_CATALOG`에는 없었다. 이력은 쌓이는데 도감엔 칸조차 안 생겨서,
 * 그 직업들을 아무리 해도 볼 방법이 없었다.
 *
 * 고정하는 불변식:
 *  1) **JOB_ID의 모든 직업이 카탈로그에 있다** — 이게 위 사고의 재발 방지선이다.
 *  2) 카탈로그의 모든 직업이 해금 시 detail을 만든다(빈 문자열이면 케이스 누락).
 *  3) 안 해본 직업도 목록에 남고 hint를 보여준다(사라지면 있는 줄도 모른다).
 *  4) 그만둬도 칸은 남는다 — 해금 판정이 상태가 아니라 이력이기 때문.
 */

const row = (s: GameState, id: string) => jobLevelRows(s).find((r) => r.id === id);

describe("카탈로그 완전성", () => {
  it("JOB_ID의 모든 직업이 카탈로그에 있다", () => {
    const catalogIds = new Set(JOB_CATALOG.map((e) => e.id));
    for (const id of Object.values(JOB_ID)) {
      expect(catalogIds.has(id), `${id}가 도감에 없다 — 해도 볼 수가 없다`).toBe(true);
    }
  });

  it("카탈로그 id가 중복되지 않는다", () => {
    const ids = JOB_CATALOG.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("모든 칸에 라벨·이모지·hint가 있다", () => {
    for (const e of JOB_CATALOG) {
      expect(e.label.length, e.id).toBeGreaterThan(0);
      expect(e.emoji.length, e.id).toBeGreaterThan(0);
      expect(e.hint.length, e.id).toBeGreaterThan(0);
    }
  });

  it("해금하면 모든 직업이 detail을 만든다 — 빈 문자열이면 케이스 누락이다", () => {
    for (const e of JOB_CATALOG) {
      const s = createInitialState();
      s.adultMode = true; // 성인 직업 칸도 목록에 들어오게
      markJobExperienced(s, e.id);
      const r = row(s, e.id);
      expect(r, `${e.id} 행이 없다`).toBeTruthy();
      expect(r!.unlocked).toBe(true);
      expect(r!.detail.length, `${e.id}의 detail이 비었다`).toBeGreaterThan(0);
    }
  });
});

describe("안 해본 직업", () => {
  it("목록에서 사라지지 않고 hint를 보여준다", () => {
    const s = createInitialState();
    s.adultMode = true;
    const rows = jobLevelRows(s);
    // 도감엔 직업 + **방송 채널**(너튜브·사바나) 칸이 함께 뜬다. 채널은 직업이 아니지만
    // 같은 등급 사다리를 타므로 볼 자리가 여기다(systems/jobLevels의 CHANNEL_CATALOG).
    expect(rows.length).toBeGreaterThanOrEqual(JOB_CATALOG.length);
    for (const id of JOB_CATALOG.map((e) => e.id)) {
      expect(rows.some((r) => r.id === id), `${id}가 도감에서 빠졌다`).toBe(true);
    }
    for (const r of rows) {
      expect(r.unlocked).toBe(false);
      expect(r.detail).toBe(r.hint);
    }
  });
});

describe("최근 4직업이 실제로 도감에 뜬다", () => {
  it("택시: 입사하면 해금되고 운행 수가 레벨이 된다", () => {
    const s = createInitialState();
    s.certifications.push(TAXI_REQ_CERT);
    joinTaxi(s);
    s.taxiJob!.totalRides = 37;
    const r = row(s, "taxi")!;
    expect(r.unlocked).toBe(true);
    expect(r.active).toBe(true);
    expect(r.level).toBe(levelFromCount(37));
    expect(r.detail).toContain("37");
  });

  it("콜센터: 누적 콜이 레벨이 된다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    s.callCenterJob!.totalCalls = 22;
    const r = row(s, "callCenter")!;
    expect(r.level).toBe(levelFromCount(22));
    expect(r.detail).toContain("22");
  });

  it("다단계: 태운 지인 수가 진행도에 드러난다", () => {
    const s = createInitialState();
    joinMlm(s);
    s.mlmJob!.contracts = 11;
    s.mlmJob!.burnedContacts = ["a", "b", "c"];
    const r = row(s, "mlm")!;
    expect(r.level).toBe(levelFromCount(11));
    expect(r.detail, "이 직업의 대가가 곧 진행도다").toContain("3명");
  });

  it("헤어: 단골 수가 진행도에 드러난다", () => {
    const s = createInitialState();
    s.certifications.push(STYLIST_REQ_CERT);
    joinStylist(s);
    s.stylistJob!.cuts = 44;
    s.stylistJob!.regulars = 9;
    const r = row(s, "stylist")!;
    expect(r.level).toBe(levelFromCount(44));
    expect(r.detail).toContain("9명");
  });
});

describe("그만둬도 칸은 남는다", () => {
  it("상태가 지워져도 이력으로 해금이 유지된다", () => {
    const s = createInitialState();
    joinCallCenter(s);
    s.callCenterJob = null; // 퇴사
    const r = row(s, "callCenter")!;
    expect(r.unlocked, "해봤던 칸이 도로 잠기면 안 된다").toBe(true);
    expect(r.active).toBe(false);
    expect(r.detail).toContain("이력 있음");
  });
});
