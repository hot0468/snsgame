import type { AttributeId, GameState } from "@/core/types";
import type { EbsLecture } from "@/data/ebs";
import { EBS_LECTURES } from "@/data/ebs";
import { ATTRIBUTES } from "@/data/attributes";
import { getActiveAccount } from "@/core/state";
import { unlockAttribute } from "./attributeUnlock";
import { SKILL_STATS } from "@/data/stats";
import { gainSkill, clampAction } from "@/systems/stats";
import { gainPerformance } from "@/systems/employment";
import { addSchedule, advanceTime } from "@/systems/time";
import { hashInt } from "@/utils/random";

/**
 * 강의 1편 시청 비용(원).
 *
 * ⚠️ 도서(교양 9,000원 → 지식+25·어휘+10)와 같은 코스트 구조(행동력 8 + 슬롯 1)라 **값으로만 갈린다.**
 *    3,000원이던 시절엔 스탯 1당 200원으로 도서(257원)보다 싼 데다 **원하는 축을 골라** 올릴 수 있어
 *    도서를 살 이유가 없었다(만화책 한 권 값). 6,000원이면 스탯 1당 400원 — 정밀 타겟팅 프리미엄.
 *    ⚠️ 바꾸면 data/dartpin.ts의 `dp_hint_ebs`(플레이어에게 '6천원'이라 말하는 힌트 글·쪽지)도 같이 고쳐라.
 */
export const LECTURE_COST = 6000;
/** 강의 1편 시청에 드는 행동력. */
export const LECTURE_ACTION_COST = 8;

/** 무료 강의 후보 — 업무 성과(재직 전용)는 제외해 무직이어도 항상 수강 가능하게 한다. */
const FREE_POOL = EBS_LECTURES.filter((l) => l.stat !== "performance");

/**
 * 오늘의 무료 강의 id — day 시드로 결정론적으로 하나 고른다(매일 바뀜, 렌더마다 안 튐).
 * 매일 이 강의 한 편은 소지금 없이(행동력만) 수강할 수 있다(하루 1회).
 */
export function freeLectureIdToday(state: GameState): string {
  if (FREE_POOL.length === 0) return "";
  return FREE_POOL[hashInt(`ebsFree:${state.day}`) % FREE_POOL.length].id;
}

/** 이 강의가 '오늘의 무료 강의'이고 아직 오늘 무료 수강을 안 썼는지. */
export function isFreeLectureToday(state: GameState, lec: EbsLecture): boolean {
  return lec.id === freeLectureIdToday(state) && state.ebsFreeWatchedDay !== state.day;
}

export type WatchGate = "ok" | "poor" | "noaction" | "nojob";

export function canWatchLecture(state: GameState, lec: EbsLecture): WatchGate {
  // 오늘의 무료 강의(미사용)면 소지금 검사를 건너뛴다 — 행동력·재직 조건은 그대로.
  if (!isFreeLectureToday(state, lec) && state.money < LECTURE_COST) return "poor";
  if (state.resources.action < LECTURE_ACTION_COST) return "noaction";
  if (lec.stat === "performance" && !state.employment) return "nojob";
  return "ok";
}

/**
 * 강의를 시청한다. 게이트를 통과하면 비용(6,000원 + 행동력 8 + 시간 1슬롯)을 차감하고
 * 스탯을 올린다. 단, '오늘의 무료 강의'는 소지금을 받지 않고 하루 1회 무료 수강으로 처리한다.
 *
 * ⚠️ 슬롯 소모는 여기(systems)가 책임진다 — 예전엔 ui/ebs.ts가 watchLecture 뒤에 advanceTime을
 *    따로 불렀는데, 규칙이 화면에 얹혀 있어 "EBS는 시간을 안 먹는다"고 오해할 여지가 있었다.
 *    advanceTime은 취침·새벽 팝업 등 훅을 유발할 수 있다(정상 흐름).
 */
export function watchLecture(
  state: GameState,
  lec: EbsLecture,
): { ok: boolean; label: string; unlockedAttr?: AttributeId } {
  if (canWatchLecture(state, lec) !== "ok") return { ok: false, label: "" };

  if (isFreeLectureToday(state, lec)) {
    state.ebsFreeWatchedDay = state.day; // 오늘 무료 수강 소진
  } else {
    state.money -= LECTURE_COST;
  }
  state.resources.action = clampAction(
    state,
    state.resources.action - LECTURE_ACTION_COST,
  );

  let statLabel: string;
  // ⚠️ 실제 반영치를 보고한다 — gainSkill이 정신력 배율(0.4~1.25)·상단 감쇠를 걸므로
  //    선언값 lec.amount를 그대로 쓰면 돈을 내고 "+20"이라 듣고 +8을 받는 불일치가 생긴다.
  let gained: number;
  if (lec.stat === "performance") {
    gainPerformance(state, lec.amount);
    statLabel = "업무 성과";
    gained = lec.amount;
  } else {
    gained = gainSkill(state, lec.stat, lec.amount);
    statLabel = SKILL_STATS[lec.stat].label;
  }

  // 배운 걸 트윗한다 — 도서 감상·너튜브 시청과 같은 결의 해금 경로.
  // 해금은 반드시 unlockAttribute를 거친다(attributeUnlock.ts의 기준선 보장).
  const unlockedNew =
    lec.unlockAttr != null && unlockAttribute(state, getActiveAccount(state), lec.unlockAttr);
  if (unlockedNew) {
    addSchedule(
      state,
      `새 트윗 속성 해금: ${ATTRIBUTES[lec.unlockAttr!].label}`,
      "system",
    );
  }

  addSchedule(state, `EBS 강의 수강: ${lec.title}`, "offline");
  advanceTime(state, 1);
  return {
    ok: true,
    label: `${statLabel} ${gained > 0 ? "+" : ""}${gained}`,
    unlockedAttr: unlockedNew ? lec.unlockAttr : undefined,
  };
}
