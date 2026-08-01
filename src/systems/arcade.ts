import type { GameState } from "@/core/types";
import type { Doll } from "@/data/arcade";
import { DOLLS, dollById } from "@/data/arcade";
import { clampMental, gainSkill } from "./stats";
import { addSchedule } from "./time";

/**
 * 오락실 인형뽑기 — 외출 중 확률 조우로 진입한다.
 *
 * ⚠️ **성공/실패는 여기서 정하지 않는다.** 집게가 인형을 잡는지, 올라오다 놓치는지는
 *    ui/arcadeScene.ts의 **물리 시뮬레이션**이 정한다(Phaser + Matter).
 *    확률 판정(레인 폭·슬립 55%/30%)은 물리로 대체되면서 사라졌다 —
 *    난이도를 손보려면 여기가 아니라 그 씬의 물리 상수를 봐라.
 *
 * ⚠️ **한 방문 = 인형 1개**가 이 기능의 밸런스 축이다(물리로 바뀐 뒤에도 그대로).
 *    판이 끝나는 판정은 ui가 한다 — systems는 '동전 넣기'와 '경품 등록'만 한다.
 *    상한을 풀면 12종 수집이 손기술 문제가 되어 도감이 하루만에 끝난다.
 *
 * ⚠️ 뽑기는 시간(advanceTime)을 소모하지 않는다. 외출 1블록 안에서 벌어지는 일이다.
 *
 * 순수 로직: DOM/표시 없음. 결과는 값으로 반환하고 표시는 ui가 맡는다.
 */

/** 1판 비용(원) */
export const CLAW_COST = 1_000;

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

/** 인형 하나를 실제로 획득했을 때의 결과(도감 등록 · 정신력 · 완성 보너스) */
export interface ClawResult {
  /** 결과 문구 */
  line: string;
  /** 획득한 인형 */
  doll: Doll;
  /** 이미 도감에 있어 재고로 갔는지 */
  duplicate: boolean;
  /** 이번 판으로 회복한 정신력(완성 보너스 포함) */
  mental: number;
  /** 이 등록으로 전종을 채웠는지 */
  completed: boolean;
}

/**
 * 동전을 넣는다(집게를 내릴 때마다 1회). 잔액이 모자라면 아무 일도 없이 false.
 * ⚠️ 성공하든 말든 돈은 나간다 — 오락실이다.
 */
export function payClaw(state: GameState): boolean {
  if (state.money < CLAW_COST) return false;
  state.money -= CLAW_COST;
  return true;
}

/**
 * 물리 시뮬레이션이 인형 하나를 경품 배출구에 떨어뜨렸을 때 호출한다.
 * 도감 등록·중복 재고·정신력·완성 보너스가 여기서 정해진다.
 *
 * ⚠️ **어떤 인형인지는 물리가 정한다**(집게 아래 실제로 있던 그 인형).
 *    예전처럼 등급 안에서 미수집 우선으로 뽑아주지 않는다 — 유리장에 보이는 인형과
 *    받는 인형이 다르면 물리로 바꾼 의미가 없다.
 */
export function collectDoll(state: GameState, dollId: string): ClawResult | null {
  const doll = dollById(dollId);
  if (!doll) return null;

  const duplicate = state.dolls.includes(doll.id);
  let mental = 0;
  let completed = false;

  if (duplicate) {
    state.dollStock[doll.id] = (state.dollStock[doll.id] ?? 0) + 1;
    addSchedule(state, `인형뽑기: ${doll.name} (중복 — 서랍행)`, "system");
  } else {
    state.dolls.push(doll.id);
    state.resources.mental = clampMental(state, state.resources.mental + DOLL_FIRST_MENTAL);
    mental = DOLL_FIRST_MENTAL;
    addSchedule(state, `인형 도감 등록: ${doll.name}`, "system");

    if (state.dolls.length >= DOLL_TOTAL) {
      completed = true;
      state.resources.mental = clampMental(state, state.resources.mental + DEX_COMPLETE_MENTAL);
      mental += DEX_COMPLETE_MENTAL;
      gainSkill(state, "creativity", DEX_COMPLETE_CREATIVITY);
      addSchedule(state, `인형 도감 완성! (${DOLL_TOTAL}종)`, "system");
    }
  }

  return {
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
