import { describe, it, expect } from "vitest";
import { createInitialState, getActiveAccount } from "@/core/state";
import type { DMThread, GameState, PlayerAccount } from "@/core/types";
import { FAN_DM_MAX, trimFanDMs } from "@/systems/dm";

/**
 * 상태 배열이 무한히 자라면 저장이 죽는다.
 * 상태가 바뀔 때마다 state 전체를 JSON으로 직렬화해 localStorage(~5MB)에 쓰기 때문에,
 * 누적 배열은 길게 플레이할수록 저장 비용이 그대로 커지고 결국 조용히 실패한다.
 * timeline·schedule·emails·kakao는 이미 상한이 있었고, 팬 DM만 빠져 있었다.
 *
 * ⚠️ 상한만큼이나 **무엇을 안 지우는지**가 중요하다 — 안 읽은 스레드나 진행 중인 제안을
 *    지우면 플레이어가 보지도 못한 콘텐츠가 사라져 진행이 막힌다.
 */

function fanThread(s: GameState, i: number, extra: Partial<DMThread> = {}): DMThread {
  return {
    id: `dm-${i}`,
    partnerName: `팬${i}`,
    partnerHandle: `fan_${i}`,
    attribute: "daily",
    isAdult: false,
    messages: [{ id: `m-${i}`, from: "partner", text: "안녕하세요!", day: s.day }],
    unread: false,
    metOffline: false,
    wantsToMeet: false,
    fan: true,
    ...extra,
  };
}

/** 오래된 것이 배열 뒤로 가도록 넣는다(실제 유입도 unshift다). */
function seedFanDMs(account: PlayerAccount, s: GameState, n: number): void {
  for (let i = 0; i < n; i++) account.dms.unshift(fanThread(s, i));
}

describe("팬 DM 누적 상한", () => {
  it("상한을 넘은 읽은 잡담은 오래된 것부터 잘린다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    seedFanDMs(acc, s, FAN_DM_MAX + 40);

    trimFanDMs(acc);

    expect(acc.dms.length).toBe(FAN_DM_MAX);
    // 가장 최근(마지막에 unshift된 dm-99)은 남고, 가장 오래된 dm-0은 사라진다
    expect(acc.dms.some((t) => t.id === `dm-${FAN_DM_MAX + 39}`)).toBe(true);
    expect(acc.dms.some((t) => t.id === "dm-0")).toBe(false);
  });

  it("안 읽음·스토리·유효한 만남 제안·미수령 후원은 상한을 넘겨서라도 남긴다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    const keep: DMThread[] = [
      fanThread(s, 900, { unread: true }),
      fanThread(s, 901, { story: { id: "st", node: "n1" } }),
      fanThread(s, 902, { wantsToMeet: true, metOffline: false }),
      fanThread(s, 903, { donation: { amount: 5000 } }),
    ];
    // 보호 대상을 배열 맨 뒤(=가장 오래된 자리)에 둬서 먼저 잘릴 위치에 놓는다
    seedFanDMs(acc, s, FAN_DM_MAX + 40);
    acc.dms.push(...keep);

    trimFanDMs(acc);

    for (const t of keep) {
      expect(acc.dms.some((x) => x.id === t.id), `${t.id}이(가) 잘렸다`).toBe(true);
    }
  });

  it("팬 DM이 아닌 스레드(제안·스토리성)는 개수와 무관하게 건드리지 않는다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    // fan 플래그 없는 스레드만 잔뜩 — 콘텐츠 수만큼만 생기는 유한한 것들이다
    for (let i = 0; i < FAN_DM_MAX + 40; i++) {
      acc.dms.unshift(fanThread(s, i, { fan: undefined, crew: true }));
    }

    trimFanDMs(acc);

    expect(acc.dms.length).toBe(FAN_DM_MAX + 40);
  });

  it("상한 이하면 아무것도 안 지운다", () => {
    const s = createInitialState();
    const acc = getActiveAccount(s);
    seedFanDMs(acc, s, FAN_DM_MAX);

    trimFanDMs(acc);

    expect(acc.dms.length).toBe(FAN_DM_MAX);
  });
});
