import type { GameState } from "@/core/types";
import type { Doll } from "@/data/arcade";
import { CLAW_MISS_LINES, CLAW_SLIP_LINES, DOLLS, dollById } from "@/data/arcade";
import { clampResource, gainSkill } from "./stats";
import { addSchedule } from "./time";
import { pick } from "@/utils/random";

/**
 * 오락실 인형뽑기 — 외출 중 확률 조우로 진입한다.
 *
 * ⚠️ **한 방문 = 인형 1개**가 이 기능의 밸런스 축이다.
 *    판이 끝나는 판정은 ui가 한다(win이면 세션 종료) — systems는 판 하나만 계산한다.
 *    상한을 풀면 12종 수집이 소지금 문제로 바뀌어 도감이 하루만에 끝난다.
 *
 * ⚠️ 뽑기는 시간(advanceTime)을 소모하지 않는다. 외출 1블록 안에서 벌어지는 일이다.
 *
 * 순수 로직: DOM/표시 없음. 결과는 값으로 반환하고 표시는 ui가 맡는다.
 */

/** 1판 비용(원) */
export const CLAW_COST = 1_000;

/** 중앙에서 이 폭 안이면 레어 레인 */
export const RARE_BAND = 0.06;
/** 중앙에서 이 폭 안이면 일반 레인(레어 밴드 바깥부터) */
export const COMMON_BAND = 0.18;

/**
 * 집게 힐이 미끄러질 확률 — 레어일수록 높다.
 * 레인 폭과 곱해져 실질 성공률이 나온다: 일반 ≈ 24% · 레어 ≈ 4%.
 */
export const HOOK_SLIP_RARE = 0.55;
export const HOOK_SLIP_COMMON = 0.3;

/** 처음 뽑은 인형 1종당 회복하는 정신력 */
export const DOLL_FIRST_MENTAL = 3;
/** 도감을 전부 채웠을 때 1회 보너스(요리 도감과 같은 값) */
export const DEX_COMPLETE_MENTAL = 15;
export const DEX_COMPLETE_CREATIVITY = 60;

/** 도감 전체 종수 */
export const DOLL_TOTAL = DOLLS.length;

/** 도감에 등록된 종수 */
export function dollCount(state: GameState): number {
  return state.dolls.length;
}

/** 마커 위치(0~1)가 어느 레인에 걸리는지 */
export function laneAt(pos: number): "rare" | "common" | "miss" {
  const d = Math.abs(pos - 0.5);
  if (d <= RARE_BAND) return "rare";
  if (d <= COMMON_BAND) return "common";
  return "miss";
}

/** 한 판의 결과 */
export interface ClawResult {
  /** win=인형 획득(판 종료) / slip=집게가 놓침 / miss=레인 자체를 놓침 */
  outcome: "win" | "slip" | "miss";
  /** 결과 문구 */
  line: string;
  /** 획득한 인형. win이 아니면 null */
  doll: Doll | null;
  /** 이미 도감에 있어 재고로 갔는지 */
  duplicate: boolean;
  /** 이번 판으로 회복한 정신력(완성 보너스 포함) */
  mental: number;
  /** 이 등록으로 전종을 채웠는지 */
  completed: boolean;
}

/**
 * 한 판을 굴린다. 비용은 언제나 먼저 빠진다(꽝이어도 돈은 나간다 — 오락실이다).
 * ⚠️ 호출 전에 소지금이 CLAW_COST 이상인지 ui가 확인해야 한다.
 */
export function playClaw(state: GameState, pos: number): ClawResult {
  state.money -= CLAW_COST;

  const lane = laneAt(pos);
  if (lane === "miss") {
    return {
      outcome: "miss",
      line: pick(CLAW_MISS_LINES),
      doll: null,
      duplicate: false,
      mental: 0,
      completed: false,
    };
  }

  const slipChance = lane === "rare" ? HOOK_SLIP_RARE : HOOK_SLIP_COMMON;
  if (Math.random() < slipChance) {
    return {
      outcome: "slip",
      line: pick(CLAW_SLIP_LINES),
      doll: null,
      duplicate: false,
      mental: 0,
      completed: false,
    };
  }

  // 같은 등급 안에서 미수집 우선으로 고른다. 전부 모았으면 등급 전체에서 뽑아 재고로 쌓는다.
  const pool = DOLLS.filter((d) => d.rarity === lane);
  const fresh = pool.filter((d) => !state.dolls.includes(d.id));
  const doll = pick(fresh.length > 0 ? fresh : pool);

  const duplicate = state.dolls.includes(doll.id);
  let mental = 0;
  let completed = false;

  if (duplicate) {
    state.dollStock[doll.id] = (state.dollStock[doll.id] ?? 0) + 1;
    addSchedule(state, `인형뽑기: ${doll.name} (중복 — 서랍행)`, "system");
  } else {
    state.dolls.push(doll.id);
    state.resources.mental = clampResource(state.resources.mental + DOLL_FIRST_MENTAL);
    mental = DOLL_FIRST_MENTAL;
    addSchedule(state, `인형 도감 등록: ${doll.name}`, "system");

    if (state.dolls.length >= DOLL_TOTAL) {
      completed = true;
      state.resources.mental = clampResource(state.resources.mental + DEX_COMPLETE_MENTAL);
      mental += DEX_COMPLETE_MENTAL;
      gainSkill(state, "creativity", DEX_COMPLETE_CREATIVITY);
      addSchedule(state, `인형 도감 완성! (${DOLL_TOTAL}종)`, "system");
    }
  }

  return {
    outcome: "win",
    line: `${doll.emoji} ${doll.name}을(를) 뽑았다!`,
    doll,
    duplicate,
    mental,
    completed,
  };
}

/** 피망마켓 판매 목록에 뜨는 재고 한 줄 */
export interface StockedDoll {
  doll: Doll;
  count: number;
}

/** 재고가 1개 이상인 인형만 카탈로그 순서로 반환한다 */
export function stockedDolls(state: GameState): StockedDoll[] {
  const out: StockedDoll[] = [];
  for (const doll of DOLLS) {
    const count = state.dollStock[doll.id] ?? 0;
    if (count > 0) out.push({ doll, count });
  }
  return out;
}

/**
 * 인형 재고 1개를 피망마켓에 판다(즉시 정산 — 기존 서랍장 판매와 같은 규칙).
 * ⚠️ dolls(도감 1호기)는 절대 건드리지 않는다. 재고만 차감한다.
 * 재고가 없으면 아무 일도 하지 않고 0을 반환한다.
 */
export function sellDoll(state: GameState, dollId: string): number {
  const count = state.dollStock[dollId] ?? 0;
  if (count <= 0) return 0;
  const doll = dollById(dollId);
  if (!doll) return 0;

  if (count === 1) delete state.dollStock[dollId];
  else state.dollStock[dollId] = count - 1;

  state.money += doll.resale;
  addSchedule(state, `피망마켓: ${doll.name} 판매 (+${doll.resale.toLocaleString()}원)`, "system");
  return doll.resale;
}
