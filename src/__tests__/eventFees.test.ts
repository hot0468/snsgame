import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import {
  COMICCON_ENTRY_FEE,
  COMICCON_MODE_FEES,
  EVENT_FEES,
  canAffordComiccon,
  comicconFee,
  eventFee,
  payComicconFee,
  payEventFee,
} from "@/systems/eventFees";
import { cdEntryCount, cdWinChance, runCdLottery } from "@/systems/cdLottery";
import { maybeEventTweet } from "@/data/tweetEvents";
import type { EventAttribute } from "@/data/tweetEvents";

/**
 * 트윗 행사 풀은 export되지 않으므로(내부 상수), 생성기를 여러 번 돌려
 * **실제로 나오는 제목 집합**으로 검증한다. 내부 구조가 아니라 동작을 본다.
 */
function observedTitles(attr: EventAttribute, tries = 4000): Set<string> {
  const seen = new Set<string>();
  for (let i = 0; i < tries; i++) {
    const res = maybeEventTweet(attr, 1);
    if (res) seen.add(res.event.title);
  }
  return seen;
}

/** 이 게임의 행사 갈래(트윗에 행사가 붙는 카테고리). */
const EVENT_ATTRS: EventAttribute[] = ["idol", "anime", "actor"];

/**
 * 행사 요금 · 음원CD 추첨 회귀 테스트.
 *
 * 이 파일이 지키는 것:
 * - **요금표 키가 행사 제목 문자열이라는 취약한 연결.** CD 추첨이 만드는 제목과
 *   EVENT_FEES의 키가 어긋나면 요금이 조용히 0원이 된다(typecheck는 통과한다).
 * - **팬사인회·팬미팅이 트윗 행사 풀에 다시 들어오지 않는 것.** 들어오면 CD를 안 사고도
 *   갈 수 있어 추첨 시스템 전체가 우회된다.
 * - **CD 무한당첨 방지**(추첨 시 전량 소모 + 같은 날 재추첨 차단).
 */

describe("코믹콘 요금", () => {
  it("모든 모드가 입장료를 포함한 총액이다", () => {
    for (const mode of Object.keys(COMICCON_MODE_FEES) as (keyof typeof COMICCON_MODE_FEES)[]) {
      expect(comicconFee(mode), mode).toBe(COMICCON_ENTRY_FEE + COMICCON_MODE_FEES[mode]);
    }
  });

  it("참관객 < 부스 < 코스프레 순으로 비싸다", () => {
    expect(comicconFee("visitor")).toBeLessThan(comicconFee("booth"));
    expect(comicconFee("booth")).toBeLessThan(comicconFee("cosplay"));
    expect(comicconFee("cosplay")).toBeLessThan(comicconFee("cosplayLewd"));
  });

  it("참관객도 입장료를 낸다(공짜 입장이 없다)", () => {
    expect(comicconFee("visitor")).toBeGreaterThan(0);
  });

  it("돈이 부족하면 결제가 실패하고 소지금이 그대로다", () => {
    const s = createInitialState();
    s.money = comicconFee("cosplay") - 1;
    expect(canAffordComiccon(s, "cosplay")).toBe(false);
    expect(payComicconFee(s, "cosplay")).toBe(false);
    expect(s.money, "실패했는데 돈이 빠졌다").toBe(comicconFee("cosplay") - 1);
  });

  it("결제하면 딱 그 금액만 빠진다", () => {
    const s = createInitialState();
    s.money = 1_000_000;
    expect(payComicconFee(s, "booth")).toBe(true);
    expect(s.money).toBe(1_000_000 - comicconFee("booth"));
  });
});

describe("요금 유실 방지", () => {
  /**
   * ⚠️ **UI는 약속 존재를 요금보다 먼저 확인해야 한다.**
   *    순서가 바뀌면 모달이 열려 있는 사이 약속이 사라졌을 때(removeAppointment·날짜 경과)
   *    돈만 빠지고 행사는 진행되지 않는다 — 실제로 그 상태였던 걸 고친 것이다.
   *    여기서는 systems 쪽 계약(요금 함수는 실패 시 상태를 안 바꾼다)을 고정한다.
   */
  it("잔고 부족으로 실패하면 소지금이 1원도 안 빠진다", () => {
    const s = createInitialState();
    const fee = eventFee("무대인사");
    s.money = fee - 1;
    const appt = { id: "a", kind: "event", title: "무대인사" } as unknown as Parameters<
      typeof payEventFee
    >[1];

    expect(payEventFee(s, appt)).toBe(false);
    expect(s.money).toBe(fee - 1);
  });

  it("무료 행사는 결제 없이 통과한다", () => {
    const s = createInitialState();
    s.money = 0;
    const appt = { id: "a", kind: "event", title: "시사회" } as unknown as Parameters<
      typeof payEventFee
    >[1];

    expect(payEventFee(s, appt)).toBe(true);
    expect(s.money).toBe(0);
  });
});

describe("행사 제목 ↔ 요금표 정합성", () => {
  /**
   * ⚠️ EVENT_FEES는 **제목 문자열**이 키다. CD 추첨이 등록하는 행사 제목이 바뀌면
   *    요금이 조용히 0원이 된다 — 타입이 안 잡아주는 자리라 테스트로 고정한다.
   */
  it("CD 당첨으로 열리는 행사가 전부 요금표에 있다", () => {
    // 추첨을 여러 번 돌려 실제로 등록되는 행사 제목을 수집한다(CD_EVENTS는 비공개).
    const titles = new Set<string>();
    for (let i = 0; i < 400; i++) {
      const s = createInitialState();
      for (let n = 0; n < 30; n++) s.ownedItems.push("music_cd");
      s.day += 1;
      const r = runCdLottery(s);
      if (r?.won && r.eventTitle) titles.add(r.eventTitle);
    }
    expect(titles.size, "당첨이 한 번도 안 나왔다").toBeGreaterThan(0);
    for (const t of titles) {
      expect(EVENT_FEES[t], `${t}이 요금표에 없다`).toBeGreaterThan(0);
    }
  });

  it("요금표의 무대인사가 트윗 행사 풀에 실재한다", () => {
    expect(observedTitles("actor")).toContain("무대인사");
    expect(eventFee("무대인사")).toBeGreaterThan(0);
  });

  it("요금표에 없는 행사는 0원이다(무료 행사가 크래시하지 않는다)", () => {
    expect(eventFee("시사회")).toBe(0);
    expect(eventFee("존재하지 않는 행사")).toBe(0);
  });
});

describe("팬사인회·팬미팅은 트윗으로 갈 수 없다", () => {
  /**
   * ⚠️ 이 둘이 트윗 행사 풀에 있으면 **CD를 사지 않고도** 갈 수 있어
   *    추첨 시스템 전체가 우회된다. 되돌리지 마라.
   */
  it("트윗 행사 풀에 팬사인회·팬미팅이 없다", () => {
    for (const attr of EVENT_ATTRS) {
      const titles = observedTitles(attr);
      expect(titles, `${attr}에서 팬사인회가 나왔다`).not.toContain("팬사인회");
      expect(titles, `${attr}에서 팬미팅이 나왔다`).not.toContain("팬미팅");
    }
  });

  it("갈래별 행사 풀이 빈약해지지 않았다(각 4종 이상)", () => {
    for (const attr of EVENT_ATTRS) {
      const titles = observedTitles(attr);
      expect(titles.size, `${attr} 풀이 ${titles.size}종이다`).toBeGreaterThanOrEqual(4);
    }
  });
});

describe("음원CD 추첨", () => {
  const stock = (n: number) => {
    const s = createInitialState();
    for (let i = 0; i < n; i++) s.ownedItems.push("music_cd");
    return s;
  };

  it("여러 장 살수록 당첨 확률이 오른다", () => {
    expect(cdWinChance(1)).toBeLessThan(cdWinChance(5));
    expect(cdWinChance(5)).toBeLessThan(cdWinChance(10));
  });

  it("아무리 사도 확정 당첨은 없다", () => {
    expect(cdWinChance(1000)).toBeLessThan(1);
  });

  it("CD가 없으면 추첨하지 않는다", () => {
    const s = createInitialState();
    s.day += 1;
    expect(runCdLottery(s)).toBeNull();
  });

  /** ⚠️ 남기면 매일 아침 같은 CD가 다시 굴려져 며칠이면 반드시 당첨된다. */
  it("응모한 CD는 전량 소모된다", () => {
    const s = stock(10);
    expect(cdEntryCount(s)).toBe(10);
    s.day += 1;
    const r = runCdLottery(s);
    expect(r?.entries).toBe(10);
    expect(cdEntryCount(s), "CD가 남아 무한 응모가 된다").toBe(0);
  });

  it("같은 날 두 번 추첨하지 않는다", () => {
    const s = stock(5);
    s.day += 1;
    expect(runCdLottery(s)).not.toBeNull();
    expect(runCdLottery(s), "같은 날 재추첨됐다").toBeNull();
  });

  it("추첨해도 구매 시 받은 덕질 스탯은 회수되지 않는다", () => {
    const s = stock(10);
    s.skills.otaku = 100;
    s.day += 1;
    runCdLottery(s);
    expect(s.skills.otaku).toBe(100);
  });
});
