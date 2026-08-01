import type { GameState, DMThread, Tweet, Account } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { uid } from "@/utils/random";
import { dateOf } from "./calendar";
import { MAX_SKILL } from "@/data/stats";
import { clampResource, gainStamina } from "./stats";
import { JOB_ID, markJobExperienced } from "./jobExperience";
import { KILLER_TARGETS, targetById, targetFullTweets } from "@/data/killerTargets";
import {
  DOCTOR_ACCEPT_REPLY,
  DOCTOR_ALREADY,
  DOCTOR_ASSIGN_PREFIX,
  DOCTOR_ASSIGN_SUFFIX,
  DOCTOR_DECLINE_REPLY,
  DOCTOR_FAIL,
  DOCTOR_FAIL_FINAL,
  DOCTOR_OFFER,
} from "@/data/hospital";

/** 실패 누적 상한 — 이 횟수만큼 실패하면 본인이 처리된다(게임오버). */
export const KILLER_MAX_FAILS = 3;

/** 킬러 게임오버 사유(축하 엔딩 아님 → GAME OVER로 렌더). */
export const KILLER_DEAD_REASON =
  "청부는 한 번 발을 들이면 되돌릴 수 없다. 세 번의 실패 끝에, 이번엔 네 이름이 그 리스트의 맨 위에 올랐다. 문은 안에서 잠겨 있었다...";

/**
 * 킬러 승리 엔딩 사유 — 킬러 신분을 유지한 채 팔로워 100만(게임 최종 목표)에 도달하면
 * 스탯 엔딩 대신 이 엔딩이 나온다(systems/winEnding.checkWin가 분기). 은퇴는 없다.
 */
export const KILLER_LEGEND_REASON =
  "🕶️ 이중생활의 끝 — 낮에는 100만 명이 우러러보는 인플루언서, 밤에는 얼굴 없는 청부업자. 두 개의 삶을 완벽히 숨긴 채 당신은 정점에 올랐다. 화면 속 눈부신 미소 뒤로 그림자는 오늘도 일한다. 이 바닥에 은퇴란 없으니, 당신은 아무도 모르는 전설로 영원히 살아간다.";

const MOMO_HANDLE = "momo";
const MOMO_NAME = "momo";

/** 전연령 진입로의 연락책(병원 원장). momo와 같은 일을 하지만 말투가 정반대다. */
const DOCTOR_HANDLE = "doctor";
const DOCTOR_NAME = "의사";

/** 이 스레드가 의사(전연령 진입로) 스레드인지 — ui가 버튼 문구 톤을 고를 때 쓴다. */
export function isDoctorThread(partnerHandle: string): boolean {
  return partnerHandle === DOCTOR_HANDLE;
}

/**
 * 지금 나를 부리는 연락책. 구세이브(recruiter 없음)는 momo로 본다.
 * ⚠️ 이 판정을 여러 군데로 흩지 마라 — 배정·실패·게임오버 DM이 서로 다른 사람에게서
 *    오면 그 순간 전연령 각색이 무너진다(momo가 수술 얘기를 하거나 그 반대가 된다).
 */
function recruiterOf(state: GameState): "momo" | "doctor" {
  return state.killerJob?.recruiter ?? "momo";
}

/** 의뢰비 하한/역량 가산폭. 역량 0 → 30만, 역량 1 → 200만. */
const FEE_BASE = 300_000;
const FEE_RANGE = 1_700_000;

/**
 * 킬러 역량(0~1). 추적력·실행력(스킬)이 본체이고, 업계 신용(평판)은 거기 곱해지는 배수다.
 * = (지식+운동+어휘력+IT)/(4×999) × (0.5 + 0.5×평판/100)
 *
 * ⚠️ 평판을 **더하지** 마라 — 평판은 100(만점)에서 시작해 사고를 쳐야만 깎이는 자원이라,
 *    가산하면 스킬 0인 초짜도 역량이 항상 0.5 이상이 돼서 의뢰비 하한(30만)이 죽는다
 *    (실제로 첫 의뢰가 123만원 들어왔다). 평판 0이어도 스킬값의 절반은 인정한다.
 */
export function killerCompetence(state: GameState): number {
  const s = state.skills;
  const skillPart = (s.knowledge + s.fitness + s.vocabulary + s.it) / (4 * MAX_SKILL);
  const repMul = 0.5 + 0.5 * (state.resources.reputation / 100);
  return Math.min(1, Math.max(0, skillPart * repMul));
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
  return handlerThread(state, MOMO_HANDLE, MOMO_NAME);
}

/** 의사 대화 스레드를 찾거나 새로 만든다. */
function doctorThread(state: GameState): DMThread {
  return handlerThread(state, DOCTOR_HANDLE, DOCTOR_NAME);
}

/** 연락책 스레드를 찾거나 새로 만든다(활성 계정 기준, 고정 핸들). */
function handlerThread(state: GameState, handle: string, name: string): DMThread {
  const acc = getActiveAccount(state);
  let t = acc.dms.find((d) => d.partnerHandle === handle);
  if (!t) {
    t = {
      id: uid("dm"),
      partnerName: name,
      partnerHandle: handle,
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

/** 의사가 보내는 메시지를 스레드에 추가(unread 표시). */
function pushDoctor(state: GameState, text: string): void {
  const t = doctorThread(state);
  t.messages.push({ id: uid("dmm"), from: "partner", text, day: state.day });
  t.unread = true;
}

/**
 * 업무 연락을 **나를 고용한 연락책 이름으로** 보낸다. 같은 사건을 두 화법으로 쓴다.
 * 정보량은 반드시 같아야 한다 — 한쪽이 더 친절하면 진입로 선택이 난이도 선택이 돼버린다.
 */
function pushHandler(state: GameState, momoText: string, doctorText: string): void {
  if (recruiterOf(state) === "doctor") pushDoctor(state, doctorText);
  else pushMomo(state, momoText);
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

/**
 * 청부 제의 수락 — 킬러가 된다. 첫 타겟은 다음 달 1일 배정(killerDailyTick).
 * **제의가 온 스레드가 곧 연락책**이다 — 의사 스레드에서 수락하면 이후 업무 연락도 의사가 한다.
 */
export function acceptKillerJob(state: GameState, threadId: string): void {
  const acc = getActiveAccount(state);
  const t = acc.dms.find((d) => d.id === threadId);
  if (!t) return;
  const byDoctor = isDoctorThread(t.partnerHandle);
  t.momoOffer = false;
  state.killerJob = {
    active: true,
    fails: 0,
    completed: 0,
    assignment: null,
    recruiter: byDoctor ? "doctor" : "momo",
  };
  markJobExperienced(state, JOB_ID.killer); // 직업 도감 해금
  t.messages.push({
    id: uid("dmm"),
    from: "me",
    text: byDoctor ? "...하겠습니다." : "...하지.",
    day: state.day,
  });
  t.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: byDoctor
      ? DOCTOR_ACCEPT_REPLY
      : "현명해. 첫 타겟은 다음 달 1일에 보낸다. 명심해 — 한번 시작하면 스스로 그만두는 건 없어.",
    day: state.day,
  });
  t.unread = true;
}

/** 청부 제의 거절 — 나중에 다시 요청 가능. */
export function declineKillerJob(state: GameState, threadId: string): void {
  const acc = getActiveAccount(state);
  const t = acc.dms.find((d) => d.id === threadId);
  if (!t) return;
  const byDoctor = isDoctorThread(t.partnerHandle);
  t.momoOffer = false;
  t.messages.push({
    id: uid("dmm"),
    from: "me",
    text: byDoctor ? "...죄송합니다. 그만두겠습니다." : "...관심 없어.",
    day: state.day,
  });
  t.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: byDoctor ? DOCTOR_DECLINE_REPLY : "그래. 마음이 바뀌면 다시 서적을 요청하든가.",
    day: state.day,
  });
}

/**
 * 병원 사이트 [진료예약] — 의사에게서 집도 제의 DM이 온다(전연령 진입로).
 * momo의 [서적요청]과 완전히 같은 자리에 서는 함수다. 다른 건 말투뿐이고,
 * 수락하면 같은 `state.killerJob`이 켜진다.
 */
export function requestAppointment(state: GameState): void {
  const t = doctorThread(state);
  if (state.killerJob?.active) {
    pushDoctor(state, DOCTOR_ALREADY);
    return;
  }
  state.momoOfferedDay = state.day;
  t.messages.push({ id: uid("dmm"), from: "partner", text: DOCTOR_OFFER, day: state.day });
  t.momoOffer = true; // 수락/거절 버튼을 띄우는 공용 플래그(momo와 같은 UI를 그대로 쓴다)
  t.unread = true;
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
    // 타겟이 결정되는 이 순간에 트윗을 만들어 저장한다(이후 피드·검색·프로필이 재사용).
    tweets: buildTargetTweets(target, state.day),
  };
  // ⚠️ 이름·핸들은 절대 넣지 마라 — 계정을 직접 찾아내는 게 이 임무의 절반이다(사용자 확정).
  //    두 화법 모두 힌트 본문(idHint·hint)은 **똑같이** 넣는다(정보량 동일).
  const body = `${target.idHint}\n${target.hint}`;
  pushHandler(
    state,
    `이번 달 타겟이다.\n\n${body}\n\n이름도 계정도 안 알려준다. 그 정도는 직접 찾아 — 트윗을 검색해서 계정부터 특정하고, 그자가 흘린 위치를 읽어라. 일주일 안에 처리해.`,
    `${DOCTOR_ASSIGN_PREFIX}${body}${DOCTOR_ASSIGN_SUFFIX}`,
  );
  // 칠남 동맹이면 momo보다 한 단계 자세한 힌트를 DM으로 보낸다(계정은 특정해주되 정답 위치는 안 짚어줌).
  if (state.chilnamAlly) {
    const tip = CHILNAM_HINTS[target.id];
    if (tip) {
      pushChilnam(
        state,
        `형님, momo가 말한 그 인간 제가 특정했어요. 닉네임 '${target.name}', 계정은 @${target.handle} 입니다.\n${tip} 위치까진 못 짚어드리니 그 계정 트윗은 형님이 읽어보세요.`,
      );
    }
  }
}

/** 타겟별 칠남 힌트(정답 위치를 딱 집지 않고 지역/유형만 좁혀준다). */
const CHILNAM_HINTS: Record<string, string> = {
  coin_king: "바다 쪽 휴양지로 논다던데. 남쪽 섬이라던가.",
  pyramid_guru: "무슨 큰 전시장·컨벤션 같은 데서 설명회 연대요. 2호선 근처.",
  bad_landlord: "서울 근교로 힐링 간대요. 별장 있는 동네.",
  scam_boss: "남쪽 바닷가 지점 오픈식 간대요.",
  fake_reporter: "방송가 근처 몰에서 브런치래요. 섬 이름 붙은 동네.",
  abusive_boss: "강원도 쪽 골프장이래요. 호수 있는 동네.",
  fake_academy: "지방 광역시 번화가에서 설명회래요. 사과로 유명한 데.",
  rental_scam: "항구 쪽에서 차 인수한대요. 경기 남부.",
  stock_manipulator: "동해안 서핑 스팟이래요. 요즘 핫한 해변.",
  beauty_quack: "남쪽 대도시 전시장에서 학회래요.",
  jeonse_fraud: "인천 신도시 신축 임장이래요. 국제도시라던가.",
  used_scam: "충청권 번화가에서 직거래래요.",
  insurance_broker: "호남 대도시 중심가에서 미팅이래요.",
  secret_ad: "서울 힙한 동네 팝업이래요. 카페거리.",
  ghost_writer: "전북 관광지에서 학회 겸 힐링이래요. 한옥 많은 데.",
  rich_karen: "강남 편집숍 거리에서 쇼핑이래요.",
  loan_shark2: "대구 큰 재래시장 쪽 수금 돈대요.",
  chart_rigging: "경기 북부 큰 전시장 시상식이래요.",
  bully_noremorse: "경주 관광단지로 가족여행이래요.",
  cult_leader: "충청도 산에서 집회 연대요.",
};

/** 타겟이 결정될 때 그의 트윗 30개를 Tweet 객체로 만든다(assignment에 저장돼 재사용). */
function buildTargetTweets(target: { id: string; name: string; handle: string }, day: number): Tweet[] {
  const full = targetFullTweets(target as (typeof KILLER_TARGETS)[number]);
  return full.map((text, i) => ({
    id: `tgt_${target.id}_${i}`,
    authorName: target.name,
    authorHandle: target.handle,
    attribute: "daily" as const,
    isAdult: false,
    text,
    createdDay: day - (i % 5),
    likes: 20 + ((i * 37) % 400),
    retweets: 3 + ((i * 11) % 60),
    gainedFollowers: 0,
  }));
}

/** 배정 시 저장된 타겟 트윗(피드·검색 노출용). 배정이 없으면 빈 배열. */
export function assignedTargetTweets(state: GameState): Tweet[] {
  return state.killerJob?.assignment?.tweets ?? [];
}

/** 배정된 타겟의 계정(Account) — 계정 탐색·프로필 노출용. 저장된 트윗을 타임라인으로 쓴다. */
export function assignedTargetAccount(state: GameState): Account | null {
  const kj = state.killerJob;
  if (!kj?.active || !kj.assignment) return null;
  const target = targetById(kj.assignment.targetId);
  if (!target) return null;
  const me = getActiveAccount(state);
  return {
    id: `tgt_${target.id}`,
    name: target.name,
    handle: target.handle,
    attribute: "daily",
    isAdult: false,
    bio: target.bio,
    followers: 5000 + (target.id.length * 1234) % 90000,
    timeline: kj.assignment.tweets,
    followed: me.followingAccounts.some((a) => a.handle === target.handle),
  };
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
    pushHandler(
      state,
      `마감이 지났다. 이번 건 실패야. (실패 ${kj.fails}/${KILLER_MAX_FAILS})`,
      DOCTOR_FAIL(kj.fails, KILLER_MAX_FAILS),
    );
    kj.assignment = null;
    if (kj.fails >= KILLER_MAX_FAILS) {
      pushHandler(state, "세 번이나 놓쳤군. 실망이야. 정리해야겠어.", DOCTOR_FAIL_FINAL);
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

  // 역습 타겟: 정답이어도 역량이 낮으면 반격당해 피해를 입는다(역량 1이면 무피해).
  let counterNote = "";
  if (target.counter) {
    const dmg = Math.round((1 - killerCompetence(state)) * COUNTER_MAX_DAMAGE);
    if (dmg > 0) {
      gainStamina(state, -dmg);
      state.resources.mental = clampResource(state.resources.mental - dmg);
      pushMomo(state, "그 자식, 순순히 당하지 않더군. 다쳤나? 역량을 더 키워라.");
      counterNote = ` 하지만 반격당했다 — 체력·정신 -${dmg}.`;
    }
  }

  pushMomo(state, `깔끔하군. 의뢰비 ${fee.toLocaleString("ko-KR")}원 입금했다. 다음 달에 또 보지.`);

  return {
    ok: true,
    fee,
    msg: `처리 완료. 의뢰비 ${fee.toLocaleString("ko-KR")}원이 입금됐다.${counterNote}`,
  };
}

/** 역습 타겟에게 반격당했을 때 역량 0 기준 최대 피해(체력·정신 각각). */
const COUNTER_MAX_DAMAGE = 40;

/* ─────────────────── 칠남(동종업계 킬러) 상호작용 ─────────────────── */

const CHILNAM_HANDLE = "chilnam_7";
const CHILNAM_NAME = "칠남";

/** 칠남 대화 스레드를 찾거나 만든다. */
function chilnamThread(state: GameState): DMThread {
  const acc = getActiveAccount(state);
  let t = acc.dms.find((d) => d.partnerHandle === CHILNAM_HANDLE);
  if (!t) {
    t = {
      id: uid("dm"),
      partnerName: CHILNAM_NAME,
      partnerHandle: CHILNAM_HANDLE,
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

/** 칠남이 보내는 메시지를 스레드에 추가(unread 표시). */
function pushChilnam(state: GameState, text: string): void {
  const t = chilnamThread(state);
  t.messages.push({ id: uid("dmm"), from: "partner", text, day: state.day });
  t.unread = true;
}

/**
 * 칠남을 팔로우하면 그가 먼저 DM으로 말을 건다(킬러일 때만, 1회). 하소연 + 품앗이 동맹 제의.
 * exploreSystem.followAccount에서 호출한다.
 */
export function maybeSpawnChilnamDM(state: GameState): void {
  if (!state.killerJob?.active) return; // 킬러끼리만 통하는 대화
  if (state.chilnamOffered || state.chilnamAlly) return;
  state.chilnamOffered = true;
  const t = chilnamThread(state);
  t.messages.push(
    {
      id: uid("dmm"),
      from: "partner",
      text: "어... 혹시 당신도 그쪽 '일' 하시는 분? 팔로우 감사해요. 요즘 저만 실적이 없어서...",
      day: state.day,
    },
    {
      id: uid("dmm"),
      from: "partner",
      text: "우리 서로 품앗이 안 할래요? 제가 발로 뛰어서 타겟 위치 알아내는 건 자신 있거든요. 대신 저 좀 챙겨주시고요. 콜?",
      day: state.day,
    },
  );
  t.chilnamOffer = true;
  t.unread = true;
}

/** 칠남 품앗이 수락 — 이후 작업하기에서 칠남이 정답 트윗을 짚어준다. */
export function acceptChilnamOffer(state: GameState, threadId: string): void {
  const acc = getActiveAccount(state);
  const t = acc.dms.find((d) => d.id === threadId);
  if (!t) return;
  t.chilnamOffer = false;
  state.chilnamAlly = true;
  t.messages.push(
    { id: uid("dmm"), from: "me", text: "그래요, 같이 합시다.", day: state.day },
    {
      id: uid("dmm"),
      from: "partner",
      text: "감사해요 형님! 이제 타겟 배정될 때마다 제가 발로 뛴 정보를 DM으로 흘려드릴게요. 위치까진 못 짚어도 어느 쪽인지는 알려드릴 수 있어요.",
      day: state.day,
    },
  );
  t.unread = true;
}

/** 칠남 품앗이 거절. */
export function declineChilnamOffer(state: GameState, threadId: string): void {
  const acc = getActiveAccount(state);
  const t = acc.dms.find((d) => d.id === threadId);
  if (!t) return;
  t.chilnamOffer = false;
  t.messages.push(
    { id: uid("dmm"), from: "me", text: "혼자 하는 게 편해서요.", day: state.day },
    { id: uid("dmm"), from: "partner", text: "아... 그쵸 뭐. 역시 이 바닥은 각자도생... 저는 이만.", day: state.day },
  );
}

