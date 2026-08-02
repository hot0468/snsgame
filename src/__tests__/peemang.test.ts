import { describe, it, expect } from "vitest";
import { createInitialState } from "@/core/state";
import { PEEMANG_ITEMS } from "@/data/peemang";
import { PEEMANG_DAILY_COUNT, todayPeemangItems } from "@/systems/shop";

/**
 * 피망마켓 일일 매물 회귀 테스트.
 *
 * 왜 넣었나: 예전엔 전체 목록을 항상 보여주고 산 물건만 회색 처리했다. 중고 직거래인데
 * 목록이 영영 안 바뀌니 한 번 훑고 나면 다시 들어올 이유가 없었다.
 *
 * 고정하는 불변식:
 *  1) 하루치만 보인다.
 *  2) 같은 날엔 몇 번을 봐도 같다 — 재렌더마다 목록이 갈리면 누르려던 카드가 손 밑에서 바뀐다.
 *  3) 날이 바뀌면 달라진다.
 *  4) 산 물건은 내려간다.
 */

describe("피망마켓 일일 매물", () => {
  it("하루치만 보인다", () => {
    const s = createInitialState();
    expect(todayPeemangItems(s)).toHaveLength(PEEMANG_DAILY_COUNT);
    expect(PEEMANG_ITEMS.length).toBeGreaterThan(PEEMANG_DAILY_COUNT);
  });

  it("같은 날엔 몇 번을 봐도 같다", () => {
    const s = createInitialState();
    expect(todayPeemangItems(s).map((i) => i.id)).toEqual(todayPeemangItems(s).map((i) => i.id));
  });

  it("날이 바뀌면 목록도 바뀐다", () => {
    const a = createInitialState();
    const b = createInitialState();
    b.day = a.day + 1;
    // 6개를 뽑으니 우연히 겹칠 수는 있어도 통째로 같으면 리셋이 안 도는 것이다.
    expect(todayPeemangItems(a).map((i) => i.id)).not.toEqual(
      todayPeemangItems(b).map((i) => i.id),
    );
  });

  it("산 물건은 목록에서 내려간다", () => {
    const s = createInitialState();
    const bought = todayPeemangItems(s)[0];
    s.ownedItems.push(bought.id);
    expect(todayPeemangItems(s).map((i) => i.id)).not.toContain(bought.id);
  });

  it("매물이 동나면 빈 목록을 준다 — 화면이 빈 상태 문구로 받는다", () => {
    const s = createInitialState();
    s.ownedItems.push(...PEEMANG_ITEMS.map((i) => i.id));
    expect(todayPeemangItems(s)).toEqual([]);
  });
});
