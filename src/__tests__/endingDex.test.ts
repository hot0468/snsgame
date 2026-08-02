import { describe, it, expect, beforeEach } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  BAD_ENDINGS,
  WIN_DEX_ID,
  endingDexProgress,
  endingDexRows,
  markEndingSeen,
  seenEndings,
} from "@/systems/endingDex";
import { ENDING_OFFERS, DEBUT_FOLLOWERS, DEBUT_BEAUTY } from "@/systems/endings";
import type { GameState } from "@/core/types";

/**
 * 엔딩 도감.
 *
 * 왜 넣었나: 엔딩이 열두 갈래인데 플레이어가 **뭐가 있는지도 어떻게 여는지도 알 방법이
 * 없었다.** 직업 도감·인형 도감은 있는데 엔딩만 없었다.
 *
 * 고정하는 불변식:
 *  1) 모든 엔딩에 '여는 법' 한 줄이 있다(빠지면 그 칸만 "조건 미상"이 된다).
 *  2) 못 본 엔딩은 제목이 가려지고 힌트는 보인다.
 *  3) 기록은 **게임 상태가 아니라 별도 저장소**다 — 새 판에도 남아야 도감이다.
 *  4) 힌트에 수치를 적지 않는다(게임이 계산기가 된다).
 */

/** localStorage가 없는 노드 환경에서도 돌게 최소 구현을 깐다. */
beforeEach(() => {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  } as unknown as Storage;
});

function fresh(): GameState {
  return createInitialState();
}

describe("도감 목록", () => {
  it("엔딩 제안 전부 + 100만 엔딩 + 나쁜 엔딩이 있다", () => {
    // 제안 엔딩 + 승리 한 칸 + 망해서 끝나는 결말들. 나쁜 엔딩도 결말이라 도감에 들어간다.
    const rows = endingDexRows(fresh());
    expect(rows.length).toBe(ENDING_OFFERS.length + 1 + BAD_ENDINGS.length);
    expect(rows.some((r) => r.id === WIN_DEX_ID)).toBe(true);
    for (const b of BAD_ENDINGS) {
      expect(rows.some((r) => r.id === b.id), `${b.id}가 빠졌다`).toBe(true);
    }
  });

  it("모든 칸에 여는 법이 있다 — '조건 미상'이 남으면 안 된다", () => {
    for (const row of endingDexRows(fresh())) {
      expect(row.hint, `${row.id}: 힌트가 없다`).not.toBe("조건 미상");
      expect(row.hint.length, `${row.id}`).toBeGreaterThan(5);
    }
  });

  it("힌트에 숨은 문턱을 적지 않는다 — 적으면 게임이 계산기가 된다", () => {
    // ⚠️ 100만 엔딩만 예외다. 그건 숨은 문턱이 아니라 **게임의 제목이자 공개된 목표**라
    //    가릴 이유가 없다(제목: 팔로워 100만명 모으기). 나머지는 방향만 알려준다.
    for (const row of endingDexRows(fresh())) {
      if (row.id === WIN_DEX_ID) continue;
      expect(/\d{3,}|\d+만/.test(row.hint), `${row.id}: 힌트에 문턱이 박혀 있다 — ${row.hint}`).toBe(
        false,
      );
    }
  });

  it("못 본 엔딩은 제목이 가려지고 힌트는 보인다", () => {
    const rows = endingDexRows(fresh());
    for (const row of rows) {
      expect(row.seen).toBe(false);
      expect(row.title).toBe("???");
      expect(row.hint.length).toBeGreaterThan(0);
    }
  });
});

describe("기록", () => {
  it("본 엔딩은 제목이 드러난다", () => {
    const id = ENDING_OFFERS[0].id;
    markEndingSeen(id);
    const row = endingDexRows(fresh()).find((r) => r.id === id)!;
    expect(row.seen).toBe(true);
    expect(row.title).toBe(ENDING_OFFERS[0].offerTitle);
  });

  it("같은 엔딩을 두 번 기록해도 하나로 센다", () => {
    const id = ENDING_OFFERS[0].id;
    markEndingSeen(id);
    markEndingSeen(id);
    expect(seenEndings().size).toBe(1);
    expect(endingDexProgress(fresh()).seen).toBe(1);
  });

  it("기록이 게임 상태와 무관하다 — 새 게임을 시작해도 남는다", () => {
    markEndingSeen(ENDING_OFFERS[1].id);
    // 완전히 새 상태로 조회해도 그대로 보인다(도감은 판을 넘어 쌓인다).
    const row = endingDexRows(createInitialState()).find((r) => r.id === ENDING_OFFERS[1].id)!;
    expect(row.seen).toBe(true);
  });

  it("진행도가 본 수 / 전체다", () => {
    const total = endingDexProgress(fresh()).total;
    markEndingSeen(ENDING_OFFERS[0].id);
    markEndingSeen(WIN_DEX_ID);
    const p = endingDexProgress(fresh());
    expect(p.seen).toBe(2);
    expect(p.total).toBe(total);
  });
});

describe("지금 가능 표시", () => {
  it("조건을 채우면 ready가 선다 — 모르고 지나치면 곤란한 갈림길이다", () => {
    const s = fresh();
    getActiveAccount(s).followers = DEBUT_FOLLOWERS;
    s.skills.beauty = DEBUT_BEAUTY;
    const row = endingDexRows(s).find((r) => r.id === "debut")!;
    expect(row.ready, "조건을 채웠는데 '지금 가능'이 안 뜬다").toBe(true);
  });

  it("조건이 안 되면 ready가 서지 않는다", () => {
    const row = endingDexRows(fresh()).find((r) => r.id === "debut")!;
    expect(row.ready).toBe(false);
  });
});
