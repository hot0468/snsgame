import type { GameState, ScheduleEvent } from "@/core/types";
import { AIRCON_ID, HEATPAD_ID } from "@/data/shop";
import {
  COLDWAVE_MENTAL,
  COLDWAVE_STAMINA,
  HEATWAVE_MENTAL,
  HEATWAVE_STAMINA,
} from "./health";
import {
  COLDWAVE_NOTICE_HIT,
  COLDWAVE_NOTICE_SAFE,
  HEATWAVE_NOTICE_HIT,
  HEATWAVE_NOTICE_SAFE,
} from "@/data/health";
import { randInt, uid } from "@/utils/random";
import { dateOf } from "./calendar";
import { pushKakao } from "./kakao";
import { clampAction, clampResource, gainStamina } from "./stats";

/**
 * 계절/연말 시스템.
 * - 세일 시즌(블프·연말·신년·여름): 쇼핑 아이템 가격 할인.
 * - 연말 이벤트(크리스마스·새해·연말정산): 날짜에 도래하면 1회 발생.
 * 모두 실제 달력(dateOf)의 월/일 기준.
 */

export interface Sale {
  name: string;
  /** 할인율(0~1) */
  rate: number;
}

interface SaleWindow {
  name: string;
  /** 0=1월 … 11=12월 */
  month: number;
  from: number;
  to: number;
  rate: number;
}

const SALE_WINDOWS: SaleWindow[] = [
  { name: "블랙 프라이데이", month: 10, from: 22, to: 30, rate: 0.4 },
  { name: "연말 결산 세일", month: 11, from: 24, to: 31, rate: 0.3 },
  { name: "신년 세일", month: 0, from: 1, to: 3, rate: 0.25 },
  { name: "여름 빅세일", month: 6, from: 10, to: 20, rate: 0.3 },
];

/** 오늘 진행 중인 세일(없으면 null) */
export function currentSale(day: number): Sale | null {
  const d = dateOf(day);
  const m = d.getMonth();
  const date = d.getDate();
  const w = SALE_WINDOWS.find((x) => x.month === m && date >= x.from && date <= x.to);
  return w ? { name: w.name, rate: w.rate } : null;
}

/** 세일 반영 가격(세일 없으면 원가) */
export function salePrice(day: number, price: number): number {
  const s = currentSale(day);
  return s ? Math.round(price * (1 - s.rate)) : price;
}

/* ─────────────────── 연말 이벤트 ─────────────────── */

function pushSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  state.schedule.push({ id: uid("sch"), day: state.day, title, kind });
}
function won(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 날짜에 도래한 계절 이벤트를 1회 발생시킨다(time.onNewDay에서 호출).
 * - 12/25 크리스마스, 1/1 새해, 12/31 연말정산.
 */
export function applySeasonalEvents(state: GameState): void {
  if (state.gameOver) return;
  const d = dateOf(state.day);
  const y = d.getFullYear();
  const m = d.getMonth();
  const date = d.getDate();

  const fire = (key: string): boolean => {
    if (state.seasonalFired.includes(key)) return false;
    state.seasonalFired.push(key);
    return true;
  };

  // 🎄 크리스마스
  if (m === 11 && date === 25 && fire(`xmas:${y}`)) {
    state.resources.mental = clampResource(state.resources.mental + 10);
    pushSchedule(state, "메리 크리스마스 🎄", "offline");
    pushKakao(
      state,
      "타임라인 친구",
      ["메리 크리스마스! 🎄 오늘은 좀 쉬면서 행복한 하루 보내~", "연말인데 트윗도 좋지만 몸도 챙겨!"],
      { hue: 350 },
    );
  }

  // 🎊 새해 — 새해 목표 다짐(정신력·행동력 회복)
  if (m === 0 && date === 1 && fire(`newyear:${y}`)) {
    state.resources.mental = clampResource(state.resources.mental + 12);
    state.resources.action = clampAction(state, state.resources.action + 15);
    pushSchedule(state, "새해 목표 다짐 🎊", "offline");
    pushKakao(
      state,
      "타임라인 친구",
      [`${y}년 새해 복 많이 받아! 🎊`, "올해는 팔로워 목표 꼭 이루자! 새해 다짐 트윗 각이지?"],
      { hue: 45 },
    );
  }

  // ☀️ 폭염주의보(8/1) — 에어컨 없으면 체력·정신력 급감. 연 1회(fire 키에 연도).
  if (m === 7 && date === 1 && fire(`heatwave:${y}`)) {
    if (state.ownedItems.includes(AIRCON_ID)) {
      pushSchedule(state, HEATWAVE_NOTICE_SAFE, "system");
      pushKakao(state, "안전안내문자", [HEATWAVE_NOTICE_SAFE], { hue: 200 });
    } else {
      gainStamina(state, -HEATWAVE_STAMINA);
      state.resources.mental = clampResource(state.resources.mental - HEATWAVE_MENTAL);
      pushSchedule(state, HEATWAVE_NOTICE_HIT, "system");
      pushKakao(state, "안전안내문자", [HEATWAVE_NOTICE_HIT], { hue: 15 });
    }
  }

  // ❄️ 한파주의보(1/15) — 전기장판 없으면 체력·정신력 급감. 연 1회(fire 키에 연도).
  if (m === 0 && date === 15 && fire(`coldwave:${y}`)) {
    if (state.ownedItems.includes(HEATPAD_ID)) {
      pushSchedule(state, COLDWAVE_NOTICE_SAFE, "system");
      pushKakao(state, "안전안내문자", [COLDWAVE_NOTICE_SAFE], { hue: 200 });
    } else {
      gainStamina(state, -COLDWAVE_STAMINA);
      state.resources.mental = clampResource(state.resources.mental - COLDWAVE_MENTAL);
      pushSchedule(state, COLDWAVE_NOTICE_HIT, "system");
      pushKakao(state, "안전안내문자", [COLDWAVE_NOTICE_HIT], { hue: 210 });
    }
  }

  // 🧾 연말정산 — 환급(대개) 또는 추징(가끔)
  if (m === 11 && date === 31 && fire(`taxsettle:${y}`)) {
    const refund = randInt(0, 100) < 75;
    const amount = refund ? randInt(150_000, 600_000) : -randInt(100_000, 350_000);
    state.money += amount;
    if (refund) {
      pushSchedule(state, `연말정산 환급 +${won(amount)}원`, "system");
      pushKakao(
        state,
        "홈택스 안내",
        ["[연말정산] 올해 환급액 안내드립니다.", `${won(amount)}원이 환급 계좌로 지급될 예정입니다. 🧾`],
        { hue: 150 },
      );
    } else {
      pushSchedule(state, `연말정산 추가 납부 ${won(amount)}원`, "system");
      pushKakao(
        state,
        "홈택스 안내",
        ["[연말정산] 올해는 아쉽게도 추가 납부가 발생했어요.", `${won(-amount)}원이 추가로 징수됩니다. 😩`],
        { hue: 0 },
      );
    }
  }
}
