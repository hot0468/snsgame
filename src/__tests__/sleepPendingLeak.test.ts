import { describe, it, expect } from "vitest";
import { createInitialState, LATE_SLOT, MORNING_SLOT } from "@/core/state";
import { advanceTime } from "@/systems/time";
import { OFFLINE_ACTIVITIES, doOfflineActivity, spendDayResting } from "@/systems/offline";
import { applyEffect } from "@/systems/events";
import { GAME_EVENTS } from "@/data/events";
import type { GameState } from "@/core/types";

/**
 * 취침 예약(sleepPending) 누수 회귀 테스트.
 *
 * 왜 넣었나: "현생 살기에서 이벤트가 뜰 때 낮·심야 블록이 두 번씩 돈다"는 제보.
 *
 * 재현 경로:
 *  1. 낮에 현생 살기 → `doOfflineActivity`가 시간을 1칸 밀어 **심야**가 되고
 *     `onLateNight`이 `sleepPending`을 켠다.
 *  2. 결과 화면을 닫는 순간 `afterAction`이 이벤트를 띄운다.
 *  3. 그 이벤트가 **시간을 또 미는** 종류면(회식·고래 만남) 취침 모달이 뜨기도 전에 날이 바뀐다.
 *  4. `sleepPending`은 켜진 채 남아 **새 날 낮**에 취침 모달이 뜨고, 그 선택이 시간을
 *     또 밀어 낮·심야가 두 번씩 도는 것처럼 보인다.
 *
 * 고정하는 불변식: **날이 바뀌면 어제의 취침 예약은 무효다.** 경로마다 막지 말고
 * `time.onNewDay` 한 곳에서 끈다(예전엔 spendDayResting만 개별 방어해 여기서 샜다).
 */

function morning(): GameState {
  const s = createInitialState();
  s.resources.action = 100;
  s.money = 10_000_000;
  s.slot = MORNING_SLOT;
  return s;
}

describe("취침 예약은 심야에만 살아 있다", () => {
  it("낮 → 심야로 넘어가면 켜진다", () => {
    const s = morning();
    advanceTime(s, 1);
    expect(s.slot).toBe(LATE_SLOT);
    expect(s.sleepPending).toBe(true);
  });

  it("날이 바뀌면 꺼진다 — 이게 새 날 낮에 취침 모달이 뜨던 원인이다", () => {
    const s = morning();
    advanceTime(s, 1); // 심야 (sleepPending on)
    expect(s.sleepPending).toBe(true);
    advanceTime(s, 1); // 다음날 낮
    expect(s.slot).toBe(MORNING_SLOT);
    expect(s.sleepPending, "어제 예약이 새 날까지 살아남으면 안 된다").toBe(false);
  });

  it("여러 칸을 한 번에 밀어도 마찬가지다", () => {
    const s = morning();
    advanceTime(s, 5);
    if (s.slot === MORNING_SLOT) expect(s.sleepPending).toBe(false);
  });
});

describe("제보된 경로 재현 — 현생 살기 뒤 시간을 미는 이벤트", () => {
  /** 효과 적용만으로 날짜/슬롯을 바꾸는 이벤트 선택지들(회식·고래 만남 등). */
  function timeMovingChoices() {
    const out: { id: string; effect: (typeof GAME_EVENTS)[number]["choices"][number]["effect"] }[] = [];
    for (const ev of GAME_EVENTS) {
      for (const ch of ev.choices ?? []) {
        const t = morning();
        const before = `${t.day}/${t.slot}`;
        try {
          applyEffect(t, ch.effect);
        } catch {
          continue;
        }
        if (`${t.day}/${t.slot}` !== before) out.push({ id: ev.id, effect: ch.effect });
      }
    }
    return out;
  }

  it("시간을 미는 이벤트가 실제로 존재한다 — 이게 없으면 이 버그도 없다", () => {
    expect(timeMovingChoices().length).toBeGreaterThan(0);
  });

  it("활동 → 심야 → 시간 미는 이벤트 → 새 날: 취침 예약이 안 남는다", () => {
    const walk = OFFLINE_ACTIVITIES.find((a) => a.id === "walk")!;
    for (const { id, effect } of timeMovingChoices()) {
      const s = morning();
      doOfflineActivity(s, walk); // 낮 → 심야, sleepPending on
      expect(s.sleepPending, `${id}: 전제(심야 진입)가 깨졌다`).toBe(true);

      applyEffect(s, effect); // 이벤트가 시간을 또 민다
      if (s.slot === MORNING_SLOT) {
        expect(s.sleepPending, `${id}: 새 날 낮인데 취침 예약이 남았다`).toBe(false);
      }
    }
  });
});

describe("오늘 남은 블록을 전부 쉬기", () => {
  it("다음날 낮에 착지하고 취침 예약이 안 남는다", () => {
    const s = morning();
    spendDayResting(s);
    expect(s.slot).toBe(MORNING_SLOT);
    expect(s.sleepPending).toBe(false);
  });
});
