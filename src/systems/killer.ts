import type { GameState, DMThread, Tweet, Account } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { uid } from "@/utils/random";
import { dateOf } from "./calendar";
import { MAX_SKILL } from "@/data/stats";
import { clampResource, gainStamina } from "./stats";
import { KILLER_TARGETS, targetById, targetFullTweets } from "@/data/killerTargets";

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
    // 타겟이 결정되는 이 순간에 트윗을 만들어 저장한다(이후 피드·검색·프로필이 재사용).
    tweets: buildTargetTweets(target, state.day),
  };
  pushMomo(
    state,
    `이번 달 타겟이다.\n\n@${target.handle}\n${target.hint}\n\n일주일 안에 처리해라. 그자가 어디 있을지는 자기 트윗에 흘렸다 — 트윗을 검색하거나 피드에서 찾아 읽어.`,
  );
  // 칠남 동맹이면 타겟이 배정될 때마다 좁혀주는 힌트를 DM으로 보낸다(정답은 안 알려줌).
  if (state.chilnamAlly) {
    const tip = CHILNAM_HINTS[target.id];
    if (tip) pushChilnam(state, `형님, 이번 타겟 @${target.handle} 제가 좀 알아봤는데요. ${tip} 이 정도면 찾으실 수 있죠?`);
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

