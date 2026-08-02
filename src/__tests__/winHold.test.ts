import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import {
  WIN_FOLLOWERS,
  checkWin,
  declineWinEnding,
  finishWithEnding,
  isFrozen,
  shouldOfferWinEnding,
} from "@/systems/winEnding";
import { advanceTime } from "@/systems/time";
import { changeFollowers } from "@/systems/followers";
import type { GameState } from "@/core/types";

/**
 * 100만 달성 유예(박제 상태) 회귀 테스트.
 *
 * 왜 넣었나: 예전엔 100만을 찍는 순간 곧장 엔딩 화면이 떠서, 목표를 이룬 화면을 볼 새도
 * 없이 게임이 끝났다. 이제 축하 팝업에서 '엔딩 보기 / 아직이야'를 고른다.
 *
 * 고정하는 불변식:
 *  1) **도달만으로는 안 끝난다** — 엔딩을 고른 그 순간에만 gameOver가 선다.
 *  2) '아직이야'를 골라도 **박제 상태는 풀리지 않는다** — 팝업만 닫힌다.
 *  3) 박제 상태에서는 **시간이 안 흐른다**. 시간이 곧 타임라인이라, 여기가 뚫리면
 *     멈춘 화면 뒤에서 날짜·정산·새 트윗이 계속 돌아간다.
 *  4) 엔딩을 본 뒤에는 박제가 풀린다(gameOver 화면이 대신 전부를 덮는다).
 */

/** 100만을 찍은 직후 상태(팝업이 떠야 하는 시점). */
function reached(): GameState {
  const s = createInitialState();
  getActiveAccount(s).followers = WIN_FOLLOWERS;
  checkWin(s);
  return s;
}

describe("도달해도 바로 안 끝난다", () => {
  it("checkWin은 깃발만 세운다", () => {
    const s = reached();
    expect(s.winReached).toBe(true);
    expect(s.gameOver, "도달 즉시 끝나면 축하 팝업을 볼 수 없다").toBeNull();
  });

  it("팔로워 증가 초크포인트를 타고 들어와도 마찬가지다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = WIN_FOLLOWERS - 1;
    changeFollowers(s, 5);
    expect(s.winReached).toBe(true);
    expect(s.gameOver).toBeNull();
  });

  it("100만 미만이면 아무 일도 없다", () => {
    const s = createInitialState();
    getActiveAccount(s).followers = WIN_FOLLOWERS - 1;
    checkWin(s);
    expect(s.winReached).toBe(false);
    expect(isFrozen(s)).toBe(false);
  });

  it("엔딩을 고른 순간에만 끝난다", () => {
    const s = reached();
    finishWithEnding(s);
    expect(s.gameOver).toBeTruthy();
  });
});

describe("축하 팝업", () => {
  it("도달하면 뜬다", () => {
    expect(shouldOfferWinEnding(reached())).toBe(true);
  });

  it("'아직이야'를 고르면 다시 안 뜬다", () => {
    const s = reached();
    declineWinEnding(s);
    expect(shouldOfferWinEnding(s)).toBe(false);
  });

  it("이미 끝난 게임에는 안 뜬다", () => {
    const s = reached();
    finishWithEnding(s);
    expect(shouldOfferWinEnding(s)).toBe(false);
  });
});

describe("박제 상태", () => {
  it("'아직이야'를 골라도 박제는 안 풀린다 — 팝업만 닫힌다", () => {
    const s = reached();
    declineWinEnding(s);
    expect(isFrozen(s), "여기가 false면 게임이 그냥 계속된다").toBe(true);
  });

  it("시간이 흐르지 않는다", () => {
    const s = reached();
    declineWinEnding(s);
    const { day, slot } = s;
    advanceTime(s, 4);
    expect(s.day, "날짜가 넘어가면 타임라인이 갱신된다").toBe(day);
    expect(s.slot).toBe(slot);
  });

  it("팝업이 떠 있는 동안도 시간이 멈춘다", () => {
    const s = reached(); // 아직 아무것도 안 고른 상태
    const { day } = s;
    advanceTime(s, 4);
    expect(s.day).toBe(day);
  });

  it("엔딩을 보면 박제가 풀린다", () => {
    const s = reached();
    declineWinEnding(s);
    finishWithEnding(s);
    expect(isFrozen(s)).toBe(false);
  });

  it("100만 전에는 시간이 정상으로 흐른다 — 가드가 평상시를 막으면 안 된다", () => {
    const s = createInitialState();
    const { day, slot } = s;
    advanceTime(s, 2);
    expect(s.day !== day || s.slot !== slot).toBe(true);
  });
});
