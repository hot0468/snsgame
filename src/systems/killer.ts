import type { GameState, DMThread } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { uid } from "@/utils/random";
import { dateOf } from "./calendar";
import { MAX_SKILL } from "@/data/stats";
import { KILLER_TARGETS, targetById } from "@/data/killerTargets";

/** 실패 누적 상한 — 이 횟수만큼 실패하면 본인이 처리된다(게임오버). */
export const KILLER_MAX_FAILS = 3;

/** 킬러 게임오버 사유(축하 엔딩 아님 → GAME OVER로 렌더). */
export const KILLER_DEAD_REASON =
  "청부는 한 번 발을 들이면 되돌릴 수 없다. 세 번의 실패 끝에, 이번엔 네 이름이 그 리스트의 맨 위에 올랐다. 문은 안에서 잠겨 있었다...";

const MOMO_HANDLE = "momo";
const MOMO_NAME = "momo";

/** 의뢰비 하한/역량 가산폭. 역량 0 → 30만, 역량 1 → 200만. */
const FEE_BASE = 300_000;
const FEE_RANGE = 1_700_000;

/**
 * 킬러 역량(0~1). 트윗에서 위치를 캐내는 추적력·실행력·업계 신용을 합산한다.
 * = (지식+운동+어휘력+IT)/(4×999) 와 평판/100 의 평균.
 */
export function killerCompetence(state: GameState): number {
  const s = state.skills;
  const skillPart = (s.knowledge + s.fitness + s.vocabulary + s.it) / (4 * MAX_SKILL);
  const repPart = state.resources.reputation / 100;
  return Math.min(1, Math.max(0, (skillPart + repPart) / 2));
}

/** 이번 임무 의뢰비(역량이 높을수록 고액). */
export function killerFee(state: GameState): number {
  return Math.round(FEE_BASE + killerCompetence(state) * FEE_RANGE);
}

/**
 * 위치 입력 정규화 — 공백 제거 + 흔한 조사/어미 제거. 정답 비교 양쪽에 같이 건다.
 * (오타는 통과시키지 않는다 — '정확한 값 입력' 원칙. 조사·띄어쓰기만 관대하게.)
 */
export function normalizeLocation(s: string): string {
  return s
    .trim()
    .replace(/\s+/g, "")
    .replace(/(으로|에서|에게|까지|부터|이나|에|을|를|이|가|은|는|도|의|로)$/u, "");
}

/** momo 대화 스레드를 찾거나 새로 만든다(활성 계정 기준, 고정 핸들). */
function momoThread(state: GameState): DMThread {
  const acc = getActiveAccount(state);
  let t = acc.dms.find((d) => d.partnerHandle === MOMO_HANDLE);
  if (!t) {
    t = {
      id: uid("dm"),
      partnerName: MOMO_NAME,
      partnerHandle: MOMO_HANDLE,
      attribute: "daily",
      isAdult: false,
      messages: [],
      unread: false,
      metOffline: false,
      wantsToMeet: false,
    };
    acc.dms.unshift(t);
  }
  return t;
}

/** momo가 보내는 메시지를 스레드에 추가(unread 표시). */
function pushMomo(state: GameState, text: string): void {
  const t = momoThread(state);
  t.messages.push({ id: uid("dmm"), from: "partner", text, day: state.day });
  t.unread = true;
}

/**
 * momo.com 하단 [서적요청] — momo에게서 청부 제의 DM이 온다.
 * 이미 킬러면 안내만, 아니면 제의 스레드(momoOffer)로 수락/거절 버튼을 띄운다.
 */
export function requestBook(state: GameState): void {
  const t = momoThread(state);
  if (state.killerJob?.active) {
    pushMomo(state, "또 왔군. 다음 타겟은 일요일에 보낸다. 조급해하지 마.");
    return;
  }
  state.momoOfferedDay = state.day;
  t.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "...'서적'을 찾는 손님이 진짜 원하는 건 따로 있지. 사람 하나를 조용히 지워주면 큰돈을 주지. 할 수 있겠어?",
    day: state.day,
  });
  t.momoOffer = true;
  t.unread = true;
}

/** 청부 제의 수락 — 킬러가 된다. 첫 타겟은 다가오는 일요일 배정. */
export function acceptKillerJob(state: GameState, threadId: string): void {
  const acc = getActiveAccount(state);
  const t = acc.dms.find((d) => d.id === threadId);
  if (!t) return;
  t.momoOffer = false;
  state.killerJob = { active: true, fails: 0, completed: 0, assignment: null };
  t.messages.push({ id: uid("dmm"), from: "me", text: "...하지.", day: state.day });
  t.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "현명해. 첫 타겟은 다음 달 1일에 보낸다. 명심해 — 한번 시작하면 스스로 그만두는 건 없어.",
    day: state.day,
  });
  t.unread = true;
}

/** 청부 제의 거절 — 나중에 다시 요청 가능. */
export function declineKillerJob(state: GameState, threadId: string): void {
  const acc = getActiveAccount(state);
  const t = acc.dms.find((d) => d.id === threadId);
  if (!t) return;
  t.momoOffer = false;
  t.messages.push({ id: uid("dmm"), from: "me", text: "...관심 없어.", day: state.day });
  t.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: "그래. 마음이 바뀌면 다시 서적을 요청하든가.",
    day: state.day,
  });
}

/** 임무 마감까지의 기간(일). 배정 후 이 안에 처리해야 한다. */
export const KILLER_DEADLINE_DAYS = 7;

/** 다음 타겟을 배정하고 momo가 힌트 DM을 보낸다(마감은 배정일로부터 일주일). */
function assignNextTarget(state: GameState): void {
  const kj = state.killerJob;
  if (!kj) return;
  const idx = (kj.completed + kj.fails) % KILLER_TARGETS.length;
  const target = KILLER_TARGETS[idx];
  kj.assignment = {
    targetId: target.id,
    assignedDay: state.day,
    deadlineDay: state.day + KILLER_DEADLINE_DAYS,
  };
  pushMomo(
    state,
    `이번 달 타겟이다.\n\n@${target.handle}\n${target.hint}\n\n일주일 안에 처리해라. 그자가 어디 있을지는 자기 입으로 흘렸다 — 트윗을 읽어.`,
  );
}

/**
 * 킬러 훅(onNewDay 말미) — 매일:
 *  1) 배정된 임무가 마감(일주일)을 넘겼으면 실패 누적(3회면 게임오버).
 *  2) 임무가 없고 매달 1일이면 이달 새 타겟 배정(의뢰는 월 1회).
 */
export function killerDailyTick(state: GameState): void {
  const kj = state.killerJob;
  if (!kj?.active) return;
  // 1) 마감 지난 미완 임무 실패
  if (kj.assignment && state.day > kj.assignment.deadlineDay) {
    kj.fails += 1;
    pushMomo(state, `마감이 지났다. 이번 건 실패야. (실패 ${kj.fails}/${KILLER_MAX_FAILS})`);
    kj.assignment = null;
    if (kj.fails >= KILLER_MAX_FAILS) {
      pushMomo(state, "세 번이나 놓쳤군. 실망이야. 정리해야겠어.");
      state.gameOver = KILLER_DEAD_REASON;
      return;
    }
  }
  // 2) 월 1회(매달 1일) 새 타겟 배정 — 이미 진행 중인 임무가 없을 때만
  if (!kj.assignment && dateOf(state.day).getDate() === 1) assignNextTarget(state);
}

export interface HitResult {
  ok: boolean;
  fee?: number;
  msg: string;
}

/**
 * [작업하기] — 입력한 위치가 타겟의 정답 위치면 처리 성공(의뢰비 지급).
 * 마감(다음 일요일) 전이며 배정된 임무가 있을 때만 유효.
 */
export function attemptHit(state: GameState, input: string): HitResult {
  const kj = state.killerJob;
  if (!kj?.active || !kj.assignment) return { ok: false, msg: "지금은 배정된 임무가 없다." };
  const target = targetById(kj.assignment.targetId);
  if (!target) return { ok: false, msg: "타겟 정보를 찾을 수 없다." };
  const guess = normalizeLocation(input);
  if (!guess) return { ok: false, msg: "위치를 입력해라." };
  const hit = target.answers.map(normalizeLocation).includes(guess);
  if (!hit) return { ok: false, msg: "그곳엔 타겟이 없었다. 트윗을 다시 읽어봐." };
  const fee = killerFee(state);
  state.money += fee;
  kj.completed += 1;
  kj.assignment = null;
  pushMomo(state, `깔끔하군. 의뢰비 ${fee.toLocaleString("ko-KR")}원 입금했다. 다음 달에 또 보지.`);
  return { ok: true, fee, msg: `처리 완료. 의뢰비 ${fee.toLocaleString("ko-KR")}원이 입금됐다.` };
}
