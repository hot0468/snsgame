import type {
  Appointment,
  CdLotteryResult,
  GameState,
  ScheduleEvent,
  TweetEvent,
} from "@/core/types";
import { appendSchedule, MORNING_SLOT, SLOTS_PER_DAY } from "@/core/state";
import { chance, randInt, uid } from "@/utils/random";

/**
 * 음원CD 팬사인회 추첨.
 *
 * 흐름: 상점에서 **음원CD(music_cd)**를 산다 → 그날 밤이 지나고 **다음 날 아침**,
 * 보유한 CD 장수만큼 한 번에 응모 처리된다 → 당첨되면 팬사인회(또는 팬미팅) 일정이
 * 스케줄(약속)에 등록된다.
 *
 * ⚠️ **무한 당첨 방지**: 추첨에 들어간 CD는 **전량 소모된다**(ownedItems에서 제거).
 *    남겨두면 매일 아침 같은 CD가 다시 굴려져 며칠이면 반드시 당첨되는 무한 응모가 된다.
 *    "응모권을 뜯어 보냈다"는 것이 소모의 서사적 근거다(CD의 덕질 스탯 상승은 구매 시점에
 *    이미 지급되므로, 소모돼도 산 값어치는 남는다).
 *
 * ⚠️ **중복 실행 방지**: `lastCdDrawDay`로 같은 날 두 번 추첨하지 않는다. onNewDay는 하루에
 *    한 번만 타지만, 세이브 로드·시간 점프 경로에서 재호출돼도 안전하도록 가드를 둔다.
 *
 * 순환 참조 주의: time.ts가 이 파일의 `runCdLottery`를 onNewDay에서 부른다. 그래서 여기서
 * time.ts를 import하지 않고 addSchedule을 인라인으로 둔다(groupBuy.ts 선례).
 * 같은 이유로 `addAppointment`(systems/appointments.ts)도 쓰지 않는다 —
 * appointments.ts가 time.ts를 import하므로 time → cdLottery → appointments → time 순환이 된다.
 * 약속 push는 addAppointment와 동일한 형태로 인라인한다(state.appointments.push + uid).
 */

/** 상점 음원CD 아이템 id(data/shop.ts). */
export const MUSIC_CD_ID = "music_cd";

/** CD 1장당 당첨 확률. 10장이면 대략 40%가 되도록 잡았다(아래 표 참조). */
export const CD_WIN_CHANCE_PER_DISC = 0.05;

/**
 * 응모 장수에 따른 당첨 확률 상한 — 아무리 많이 사도 한 번의 추첨에서 이 이상은 되지 않는다.
 * (20장 이상 지르는 '큰손'이 사실상 확정 당첨이 되는 걸 막는다.)
 */
export const CD_WIN_CHANCE_MAX = 0.6;

/**
 * n장 응모 시 당첨 확률.
 *
 * 독립시행(1-(1-p)^n)이 아니라 **선형 누적**을 쓴다 — 독립시행은 초반 상승이 완만해
 * "10장 샀는데 체감이 없다"가 되기 쉽다. 선형이면 장수 대비 체감이 정직하게 붙는다.
 *
 * | 장수 | 확률 |
 * |------|------|
 * | 1장  | 5%   |
 * | 3장  | 15%  |
 * | 5장  | 25%  |
 * | 10장 | 50% → 상한 적용으로 50%(상한 60% 이내) |
 * | 12장+| 60%(상한) |
 */
export function cdWinChance(discs: number): number {
  if (discs <= 0) return 0;
  return Math.min(CD_WIN_CHANCE_MAX, discs * CD_WIN_CHANCE_PER_DISC);
}

/** 당첨 시 잡히는 행사 종류 — 아이돌 팬사인회 / 배우 팬미팅. */
interface LotteryPrize {
  title: string;
  attribute: TweetEvent["attribute"];
}

const LOTTERY_PRIZES: LotteryPrize[] = [
  { title: "팬사인회", attribute: "idol" },
  { title: "팬미팅", attribute: "actor" },
];

/** 당첨 행사가 잡히는 최소/최대 유예일(오늘로부터). 준비할 시간을 준다. */
export const CD_EVENT_MIN_DAYS = 3;
export const CD_EVENT_MAX_DAYS = 10;

/** 지금 보유한 음원CD 장수(=다음 추첨에 들어갈 응모 수). */
export function cdEntryCount(state: GameState): number {
  return state.ownedItems.filter((id) => id === MUSIC_CD_ID).length;
}

/** 하루 아침 추첨 결과(UI 알림용) — 타입은 core/types.ts에 산다(GameState가 담기 때문). */
export type { CdLotteryResult };

/**
 * 아침 추첨을 실행한다(time.onNewDay에서 호출).
 *
 * - 보유 CD가 없으면 아무것도 하지 않고 null.
 * - 오늘 이미 추첨했으면(lastCdDrawDay) 아무것도 하지 않고 null.
 * - 실행되면 보유 CD를 **전량 소모**하고, 확률 판정 후 당첨 시 팬사인회/팬미팅 약속을 등록한다.
 *
 * @returns 추첨을 실제로 돌렸으면 결과, 아니면 null. UI는 이 값을 `state.cdLotteryResult`에서 읽어
 *          아침 알림을 띄우고, 확인 후 `clearCdLotteryResult`로 지운다.
 */
export function runCdLottery(state: GameState): CdLotteryResult | null {
  if (state.lastCdDrawDay === state.day) return null;
  const entries = cdEntryCount(state);
  if (entries <= 0) return null;

  state.lastCdDrawDay = state.day;
  // 응모권을 뜯어 보냈다 — 추첨에 들어간 CD는 전량 소모된다(무한 재추첨 방지의 핵심).
  state.ownedItems = state.ownedItems.filter((id) => id !== MUSIC_CD_ID);

  const winChance = cdWinChance(entries);
  const won = chance(winChance);
  const result: CdLotteryResult = { entries, chance: winChance, won };

  if (won) {
    const prize = LOTTERY_PRIZES[randInt(0, LOTTERY_PRIZES.length - 1)] ?? LOTTERY_PRIZES[0]!;
    const day = state.day + randInt(CD_EVENT_MIN_DAYS, CD_EVENT_MAX_DAYS);
    // 팬사인회는 낮 행사다(심야에 잡히면 취침 흐름과 충돌 — 코믹콘과 같은 이유).
    const slot = Math.min(MORNING_SLOT, SLOTS_PER_DAY - 1);
    const appt: Appointment = {
      id: uid("appt"),
      day,
      slot,
      kind: "event",
      title: prize.title,
      attribute: prize.attribute,
    };
    state.appointments.push(appt);
    result.eventTitle = prize.title;
    result.eventDay = day;
    result.eventSlot = slot;
    addSchedule(state, `${prize.title} 응모 당첨! (CD ${entries}장)`, "system");
  } else {
    addSchedule(state, `음원CD 응모 낙첨 (${entries}장)`, "system");
  }

  state.cdLotteryResult = result;
  return result;
}

/** 아침 알림을 띄운 뒤 결과를 지운다(UI가 확인 후 호출). */
export function clearCdLotteryResult(state: GameState): void {
  state.cdLotteryResult = undefined;
}

/** 스케줄 로그 기록(time.ts와의 순환 참조를 피해 인라인 — groupBuy.ts 선례). */
function addSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  appendSchedule(state, { id: uid("sch"), day: state.day, title, kind });
}
