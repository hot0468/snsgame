import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  normalizeLocation,
  attemptHit,
  killerFee,
  killerDailyTick,
  KILLER_MAX_FAILS,
  KILLER_DEAD_REASON,
  KILLER_LEGEND_REASON,
} from "@/systems/killer";
import { checkWin } from "@/systems/winEnding";
import { getActiveAccount } from "@/core/state";
import { KILLER_TARGETS } from "@/data/killerTargets";

describe("killer job", () => {
  it("위치 정규화: 공백·조사 제거", () => {
    expect(normalizeLocation(" 협재 해변 ")).toBe("협재해변");
    expect(normalizeLocation("협재에서")).toBe("협재");
    expect(normalizeLocation("코엑스로")).toBe("코엑스");
  });

  it("정답 위치 입력 시 처리 성공 + 의뢰비 입금", () => {
    const s = createInitialState();
    const target = KILLER_TARGETS[0]; // coin_king → 협재
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: target.id, assignedDay: s.day, deadlineDay: s.day + 7, tweets: [] },
    };
    const before = s.money;
    const res = attemptHit(s, "협재");
    expect(res.ok).toBe(true);
    expect(s.money).toBe(before + (res.fee ?? 0));
    expect(s.killerJob!.completed).toBe(1);
    expect(s.killerJob!.assignment).toBeNull();
  });

  it("틀린 위치는 실패(임무 유지)", () => {
    const s = createInitialState();
    const target = KILLER_TARGETS[0];
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: target.id, assignedDay: s.day, deadlineDay: s.day + 7, tweets: [] },
    };
    const res = attemptHit(s, "강남");
    expect(res.ok).toBe(false);
    expect(s.killerJob!.assignment).not.toBeNull();
    expect(s.killerJob!.completed).toBe(0);
  });

  it("마감(일주일) 초과 임무 3회 실패 → 게임오버", () => {
    const s = createInitialState();
    s.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
    for (let i = 0; i < KILLER_MAX_FAILS; i++) {
      s.killerJob!.assignment = { targetId: KILLER_TARGETS[0].id, assignedDay: 1, deadlineDay: 8, tweets: [] };
      s.day = 9; // 마감(8) 초과
      killerDailyTick(s);
    }
    expect(s.killerJob!.fails).toBe(KILLER_MAX_FAILS);
    expect(s.gameOver).toBe(KILLER_DEAD_REASON);
  });

  it("매달 1일에 임무 없으면 새 타겟 배정(마감 = 배정일+7)", () => {
    const s = createInitialState();
    s.day = 1; // 그달 1일
    s.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
    killerDailyTick(s);
    expect(s.killerJob!.assignment).not.toBeNull();
    expect(s.killerJob!.assignment!.deadlineDay).toBe(1 + 7);
  });

  it("킬러 신분으로 팔로워 100만 달성 → 전설의 청부업자 엔딩", () => {
    const s = createInitialState();
    s.killerJob = { active: true, fails: 0, completed: 3, assignment: null };
    getActiveAccount(s).followers = 1_000_000;
    checkWin(s);
    expect(s.gameOver).toBe(KILLER_LEGEND_REASON);
  });

  it("역습 타겟 + 저역량 → 체력·정신 피해", () => {
    const s = createInitialState();
    s.stamina = 200;
    s.resources.mental = 100;
    s.killerJob = {
      active: true,
      fails: 0,
      completed: 0,
      assignment: { targetId: "bad_landlord", assignedDay: s.day, deadlineDay: s.day + 7, tweets: [] },
    };
    const res = attemptHit(s, "가평"); // bad_landlord 정답
    expect(res.ok).toBe(true);
    expect(s.stamina).toBeLessThan(200); // 반격 피해
    expect(s.resources.mental).toBeLessThan(100);
  });

  it("momo 배정 DM은 이름·핸들을 흘리지 않는다(계정은 직접 찾아야 함)", () => {
    const s = createInitialState();
    s.day = 1;
    s.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
    killerDailyTick(s);
    const target = KILLER_TARGETS[0];
    const dm = getActiveAccount(s).dms.find((d) => d.partnerHandle === "momo")!;
    const text = dm.messages.map((m) => m.text).join("\n");
    expect(text).not.toContain(target.handle);
    expect(text).not.toContain(target.name);
    expect(text).toContain(target.idHint);
  });

  it("칠남 동맹이면 momo보다 자세히 — 닉네임·핸들까지 특정해준다", () => {
    const s = createInitialState();
    s.day = 1;
    s.chilnamAlly = true;
    s.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
    killerDailyTick(s);
    const target = KILLER_TARGETS[0];
    const dm = getActiveAccount(s).dms.find((d) => d.partnerHandle === "chilnam_7")!;
    const text = dm.messages.map((m) => m.text).join("\n");
    expect(text).toContain(target.handle);
    expect(text).toContain(target.name);
  });

  it("idHint의 '따옴표 단어'는 이름이나 트윗에 실제로 있어야 검색으로 찾아진다", () => {
    const norm = (x: string) => x.replace(/\s+/g, "").toLowerCase();
    for (const t of KILLER_TARGETS) {
      const haystack = norm([t.name, ...t.tweets].join("|"));
      for (const [, word] of t.idHint.matchAll(/'([^']+)'/g)) {
        expect(`${t.id}:${word}:${haystack.includes(norm(word))}`).toBe(`${t.id}:${word}:true`);
      }
    }
  });

  /**
   * 난이도 불변식 — 예전엔 모든 타겟이 "이번 주 토요일 ○○에서…" 트윗 하나를 갖고 있어서
   * 30개 중 그 한 줄만 찾으면 끝이었다. 정답은 한 트윗에만 두되, 미끼(취소된 일정·지난 일정)를
   * 함께 깔아 전부 읽고 교차 대조하게 만든다.
   */
  describe("난이도 — 정답은 하나, 미끼는 여럿", () => {
    const squash = (x: string) => x.replace(/\s+/g, "");

    it("정답 위치는 딱 한 트윗에만 등장한다(못 찾거나 여러 곳에 흩어지면 안 된다)", () => {
      for (const t of KILLER_TARGETS) {
        const hits = t.tweets.filter((tw) =>
          t.answers.some((a) => squash(tw).includes(squash(a))),
        );
        expect(`${t.id}:${hits.length}`).toBe(`${t.id}:1`);
      }
    });

    it("momo 힌트는 정답 지명을 흘리지 않는다", () => {
      for (const t of KILLER_TARGETS) {
        for (const a of t.answers) {
          expect(`${t.id}:${squash(t.hint).includes(squash(a))}`).toBe(`${t.id}:false`);
        }
      }
    });

    it("타겟마다 미끼 일정이 깔려 있다(고유 트윗 7개 이상)", () => {
      for (const t of KILLER_TARGETS) {
        expect(`${t.id}:${t.tweets.length >= 7}`).toBe(`${t.id}:true`);
      }
    });
  });

  it("의뢰비는 역량(지식·운동·어휘력·IT·평판)에 비례", () => {
    const low = createInitialState();
    const high = createInitialState();
    high.skills.knowledge = 999;
    high.skills.fitness = 999;
    high.skills.vocabulary = 999;
    high.skills.it = 999;
    high.resources.reputation = 100;
    expect(killerFee(high)).toBeGreaterThan(killerFee(low));
  });

  it("스킬 0이면 평판이 만점이어도 최저 의뢰비(평판은 가산이 아니라 배수)", () => {
    const s = createInitialState(); // 스킬 0, 평판 100(초기값)
    expect(killerFee(s)).toBe(300_000);
    s.skills.knowledge = 999;
    s.skills.fitness = 999;
    s.skills.vocabulary = 999;
    s.skills.it = 999;
    expect(killerFee(s)).toBe(2_000_000);
  });
});
