import type { AdultKind, AttributeId, DickSize, DMThread, GameState, PlayerAccount } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { makeRandomAccount } from "@/data/accounts";
import { ATTRIBUTES } from "@/data/attributes";
import {
  PARTNER_REPLIES,
  REPLY_LINES,
  randomOpener,
  type DMTone,
} from "@/data/dmContent";
import { MAX_SKILL } from "@/data/stats";
import { pick, randInt, uid, chance } from "@/utils/random";
import { changeFollowers } from "./followers";
import { bumpTchinProgress } from "./tchin";
import { clampResource, clampSkill } from "./stats";

/**
 * 팬이 DM을 보내올 확률(팔로워를 얻은 행동 직후 호출).
 *
 * ⚠️ 이 확률은 '하루 한 번'이 아니라 **팔로워가 오른 행동마다** 굴린다
 * (트윗·팔로우·리트윗 → tweetSystem.ts:112, exploreSystem.ts:86,186).
 * 보수적인 하루(트윗 3 + 팔로우 3 + 리트윗 2 = 8회)만 잡아도 기대값이
 * 0.35 × 8 = 2.8통/일이었고, 실측 10일 시뮬에서 27.2통이 나왔다.
 * 0.12로 낮춰 8회 기준 ≈0.96통/일 — "하루 1~2통이면 반가운" 수준으로 맞췄다.
 * 활동량이 많은 날에도 폭주하지 않도록 MAX_FAN_DM_PER_DAY가 상한을 잡는다.
 */
export const FAN_DM_CHANCE = 0.12;

/**
 * 하루에 새로 유입될 수 있는 팬 DM 스레드 수 상한.
 * 확률만으로는 행동 수에 비례해 무한정 늘어나므로(위 주석 참고) 상한을 함께 둔다.
 * 스토리성 DM(크루/사바나/작가/터커/모텔 등)은 이 상한과 무관하다.
 */
export const MAX_FAN_DM_PER_DAY = 2;

/** 오늘 이 계정에 도착한 팬 DM 스레드 수 (첫 메시지의 day 기준) */
function fanDMsToday(account: PlayerAccount, day: number): number {
  return account.dms.filter((t) => t.fan && t.messages[0]?.day === day).length;
}

/**
 * 팬 DM 상대로 등장할 수 있는 속성 목록.
 *
 * 기존에는 `makeRandomAccount`가 전체 속성에서 균일 랜덤으로 뽑은 NPC의 속성을
 * 그대로 오프너에 넘겨서(`randomOpener(npc.attribute)`), 강아지를 안 키우는데
 * "강아지 키우시네요" 같은 내 상황과 무관한 DM이 왔다.
 * 이제 **내가 실제로 쓰는 속성(unlockedAttributes)** 안에서만 뽑고, 아래를 제외한다:
 * - 반려동물(dog/cat): 실제로 그 동물을 키울 때만(state.pets)
 * - 성인 전용 속성: 성인 모드가 켜져 있을 때만
 *
 * 폴백: 걸러낸 결과가 비면 "daily"를 쓴다. createAccount가 모든 계정에 "daily"를
 * 항상 넣어주고(state.ts:114), OPENERS_BY_ATTR에는 "daily" 키가 없어 범용 오프너만
 * 나오므로 — 후보가 0이 되어 DM이 끊기는 일은 없다.
 */
export function fanDMAttributePool(state: GameState, account: PlayerAccount): AttributeId[] {
  const pool = account.unlockedAttributes.filter((attr) => {
    if (attr === "dog" && !state.pets.dog) return false;
    if (attr === "cat" && !state.pets.cat) return false;
    if (ATTRIBUTES[attr]?.adultOnly && !state.adultMode) return false;
    return true;
  });
  if (pool.length === 0) return ["daily"];
  // 실제로 많이 올리는 성향(계정 대표 속성)의 팬이 더 자주 오도록 가중치를 한 번 더 준다.
  if (pool.includes(account.attribute)) pool.push(account.attribute);
  return pool;
}

/** 후원 DM 확률의 기본값(친화력 0일 때) */
export const DONATION_BASE_CHANCE = 0.25;
/** 친화력 만렙일 때 후원 DM 확률에 더해지는 최대 보너스 */
export const DONATION_SOCIABILITY_BONUS = 0.4;
/** 후원 첨부가 붙기 시작하는 최소 팔로워(이 값 이하이면 팬 DM은 오되 후원은 미첨부) */
export const DONATION_MIN_FOLLOWERS = 300;

/** 팬 소액 후원 제안 문구(순수 응원 톤). {amount}는 ko-KR 포맷된 금액 문자열. */
const FAN_DONATION_OPENERS: Array<(amount: string) => string> = [
  (a) => `늘 잘 보고 있어요! 작지만 후원 ${a}원 보낼게요 💸`,
  (a) => `항상 힘 나는 콘텐츠 고마워요, ${a}원 보태요! 커피 한 잔 하세요 ☕`,
  (a) => `팬이에요 ㅎㅎ 얼마 안 되지만 ${a}원 보낼게요, 앞으로도 응원해요!`,
  (a) => `덕분에 매일이 즐거워요! 소소하게 ${a}원 후원할게요 🙌`,
  (a) => `이런 거 부담스러워하실까 봐 조심스럽지만... ${a}원 살짝 보태요 💕`,
  (a) => `오늘도 잘 봤어요! 마음의 ${a}원이에요, 받아주세요 😊`,
];

/** 후원 수령 후 팬이 보내는 감사 문구(금액 없음). */
const FAN_DONATION_THANKS: string[] = [
  "받아주셔서 감사해요 앞으로도 응원할게요! 🙌",
  "헉 진짜 받아주셨다 ㅠㅠ 앞으로도 쭉 응원해요!",
  "별거 아닌데 받아주셔서 고마워요, 우리 오래오래 봐요!",
  "기분 좋다 ㅎㅎ 계속 좋은 콘텐츠 부탁드려요, 화이팅!",
  "제 작은 마음이 닿았으면 좋겠어요, 늘 건강하세요 💕",
  "앞으로도 팬으로서 열심히 응원할게요! 😊",
];

/**
 * 활성 계정으로 새 팬 DM 스레드를 만들어 추가한다.
 * 성인 계정에서만 성인 성향 상대가 등장한다.
 */
export function spawnFanDM(state: GameState): DMThread | null {
  const account = getActiveAccount(state);
  const npc = makeRandomAccount(state.adultMode, state.day);
  // NPC의 이름/핸들만 빌리고, 속성은 내 상황에 맞는 후보에서 다시 뽑는다.
  // (makeRandomAccount의 속성은 전체 균일 랜덤이라 내 계정과 무관하다)
  const attr = pick(fanDMAttributePool(state, account));
  const thread: DMThread = {
    id: uid("dm"),
    partnerName: npc.name,
    partnerHandle: npc.handle,
    attribute: attr,
    isAdult: ATTRIBUTES[attr]?.adultOnly ?? false,
    messages: [
      {
        id: uid("dmm"),
        from: "partner",
        text: randomOpener(attr),
        day: state.day,
      },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    fan: true,
  };
  // 친화력이 높을수록 후원을 보내는 팬이 늘어난다(만렙에서 25%→65%).
  // 단, 팔로워가 너무 적으면(≤300) 소액 후원 자체가 안 붙는다 — 팬 DM은 그대로 온다.
  if (
    account.followers > DONATION_MIN_FOLLOWERS &&
    chance(
      DONATION_BASE_CHANCE +
        (state.skills.sociability / MAX_SKILL) * DONATION_SOCIABILITY_BONUS,
    )
  ) {
    const amount = randInt(1_000, 4_000) + Math.floor(account.followers * 0.3);
    thread.donation = { amount };
    thread.messages.push({
      id: uid("dmm"),
      from: "partner",
      text: pick(FAN_DONATION_OPENERS)(amount.toLocaleString("ko-KR")),
      day: state.day,
    });
  }
  account.dms.unshift(thread);
  return thread;
}

/**
 * 팬이 제안한 후원을 수령한다(스레드당 1회).
 * @returns 받은 금액(없으면 0)
 */
export function claimDonation(state: GameState, threadId: string): number {
  const thread = getActiveAccount(state).dms.find((t) => t.id === threadId);
  if (!thread?.donation || thread.donation.claimed) return 0;
  thread.donation.claimed = true;
  state.money += thread.donation.amount;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: pick(FAN_DONATION_THANKS),
    day: state.day,
  });
  thread.unread = true;
  return thread.donation.amount;
}

/** 상대가 오프라인 만남을 제안하는 문구 */
const MEET_PROPOSALS = [
  "저기... 우리 언젠가 직접 만나볼래?",
  "온라인으로만 얘기하긴 아쉬운데, 한 번 만날래?",
  "혹시 시간 되면 오프라인에서 보고 싶어!",
  "우리 이제 좀 친해진 것 같은데, 만나서 얘기할래?",
];

/**
 * 대화가 무르익으면 상대가 낮은 확률로 오프라인 만남을 제안한다.
 * 제안이 있어야만 '만나기'가 가능해진다.
 */
function maybePropose(state: GameState, thread: DMThread, p: number): void {
  if (thread.metOffline || thread.wantsToMeet) return;
  if (!chance(p)) return;
  thread.wantsToMeet = true;
  thread.meetProposedDay = state.day;
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: pick(MEET_PROPOSALS),
    day: state.day,
  });
}

/**
 * 팔로워 획득 등 긍정적 행동 뒤에 낮은 확률로 팬 DM을 생성한다.
 * @returns 생성되면 true
 */
export function maybeSpawnFanDM(state: GameState): boolean {
  const account = getActiveAccount(state);
  if (fanDMsToday(account, state.day) >= MAX_FAN_DM_PER_DAY) return false;
  if (!chance(FAN_DM_CHANCE)) return false;
  spawnFanDM(state);
  return true;
}

/**
 * 성인 트윗을 올렸을 때 모텔 제안 DM이 올 확률.
 * ⚠️ 성인 트윗 1건에 모텔·성기사진·사바나 DM이 **동시에** 굴려진다(tweetSystem.ts:117-120).
 * 구값(모텔 0.4 + 성기사진 0.45)이면 성인 트윗 1건당 기대 0.85통이 쏟아졌다.
 * 0.18로 낮춰 성인 트윗 1건당 모텔+성기사진 기대값을 ≈0.33통으로 맞춘다.
 */
export const MOTEL_DM_CHANCE = 0.18;

/** 성인 트윗 종류별 모텔 제안 오프너 */
const MOTEL_OPENERS: Record<AdultKind, string[]> = {
  sekt: [
    "트윗 보고 왔어요. 오늘 밤 가볍게 만나서 좋은 시간 보낼래요? 🔞",
    "느낌 좋으신데, 지금 만나서 뜨거운 밤 보낼래요? 방은 잡아둘게요",
    "혼자 있기 아까운 밤이잖아요. 우리 지금 만날까요?",
  ],
  meetup: [
    "트윗 잘 봤어요... 오늘 밤 만나서 모텔 갈래요? 🔞",
    "지금 너무 끌리는데, 만나서 진하게 놀래요? 방은 내가 잡을게요",
    "안 그래도 오늘 밤 상대 찾고 있었는데, 우리 지금 만날까요?",
  ],
  punish: [
    "맞고 싶다며? 내가 제대로 벌 줄게, 모텔로 와요 🔞",
    "손맛 하나는 자신 있어요. 오늘 밤 모텔에서 볼래요?",
    "말 안 들으면 아프게 다뤄줄게. 지금 나올 수 있어?",
  ],
  dom: [
    "주인을 찾는다며? 오늘 밤 내 밑으로 들어와요, 모텔로 🔞",
    "목줄 채워줄 사람 찾았어요. 지금 만나서 확실히 해줄게",
    "명령에 잘 따를 것 같은데... 오늘 밤 내 것이 되어볼래요?",
  ],
  group: [
    "여럿이 논다며? 오늘 밤 우리 쪽에 방 잡았어요, 올래요? 🔞",
    "몇 명 모여 있는데 한 자리 비어요. 지금 모텔로 와요",
    "제대로 달릴 팀이 있어요. 오늘 밤 함께할래요?",
  ],
};

/**
 * 티켓 양도 DM 확률.
 * 아이돌덕/배우덕 트윗마다 굴린다(tweetSystem.ts:123). 0.4면 해당 성향으로 파는
 * 플레이어에게 사실상 매 트윗 양도 DM이 왔다 — 0.18로 낮춰 특별한 제안처럼 느껴지게 한다.
 */
export const TICKET_DM_CHANCE = 0.18;

const TICKET_OPENERS: Record<"concert" | "gv", string[]> = {
  concert: [
    "저 콘서트 티켓 급하게 양도할 게 있는데 받으실래요? 자리 완전 좋아요!",
    "갑자기 못 가게 돼서 그러는데, 콘서트 티켓 양도 받으실 분 찾아요",
    "같은 최애시죠? 콘서트 티켓 한 장 남는데 넘길게요, 원가에!",
  ],
  gv: [
    "영화 GV 티켓 양도해요, 감독님도 오시는 회차예요! 받으실래요?",
    "GV 자리 하나 남는데 넘길 분 구합니다, 앞자리라 잘 보여요",
    "같은 배우 덕질하시네요, 무대인사 GV 티켓 양도 받으실래요?",
  ],
};

/**
 * 아이돌덕/배우덕 트윗 직후 확률적으로 티켓 양도 DM을 생성한다.
 * @returns 생성되면 true
 */
export function maybeSpawnTicketDM(state: GameState, attr: "idol" | "actor"): boolean {
  if (!chance(TICKET_DM_CHANCE)) return false;
  const account = getActiveAccount(state);
  const npc = makeRandomAccount(false, state.day);
  const ticketKind = attr === "idol" ? "concert" : "gv";
  account.dms.unshift({
    id: uid("dm"),
    partnerName: npc.name,
    partnerHandle: npc.handle,
    attribute: attr,
    isAdult: false,
    messages: [
      { id: uid("dmm"), from: "partner", text: pick(TICKET_OPENERS[ticketKind]), day: state.day },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: true,
    meetProposedDay: state.day,
    ticketKind,
  });
  return true;
}

/**
 * 성인 트윗 직후 확률적으로 '모텔 제안' DM을 생성한다.
 * 트윗 종류(kind)에 맞는 상대가 만남(모텔)을 제안한 상태다.
 * @returns 생성되면 true
 */
export function maybeSpawnMotelDM(state: GameState, kind: AdultKind): boolean {
  if (!chance(MOTEL_DM_CHANCE)) return false;
  const account = getActiveAccount(state);
  const npc = makeRandomAccount(true, state.day);
  account.dms.unshift({
    id: uid("dm"),
    partnerName: npc.name,
    partnerHandle: npc.handle,
    attribute: npc.attribute,
    isAdult: true,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(MOTEL_OPENERS[kind]), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: true,
    meetProposedDay: state.day,
    motel: true,
    motelKind: kind,
  });
  return true;
}

/**
 * 성기 사진 DM이 올 확률(성인 트윗을 올린 성인 계정 한정).
 * MOTEL_DM_CHANCE와 같은 트윗에서 함께 굴려지므로 같은 이유로 0.45 → 0.15로 낮춘다.
 */
export const DICKPIC_DM_CHANCE = 0.15;

/** "빨아보고 싶다" 노골적 반응이 나오는 최소 음란도 */
export const LEWD_HORNY_MIN = 400;

const DICKPIC_OPENERS = [
  "트윗 보고 참을 수가 없었어요... 이거 보여주고 싶었어요 🔞",
  "이런 거 좋아하실 것 같아서요. 놀라지 마요...",
  "부끄럽지만 한 번만 봐줄래요? 반응이 궁금해서요",
  "남들한텐 안 보여주는 건데, 특별히 보내요",
];

/** 크기 랜덤(평균이 흔하고 매우 작음/매우 큼은 드물게) */
function randomDickSize(): DickSize {
  const pool: DickSize[] = [
    "tiny",
    "small", "small",
    "average", "average", "average",
    "big", "big",
    "huge",
  ];
  return pick(pool);
}

/**
 * 성인 트윗을 올린 뒤 확률적으로 상대가 성기 사진을 DM으로 보낸다.
 * 크기는 랜덤(5단계). 아직 만남을 제안하진 않고, 이후 긍정 답변 + 높은 음란도에서
 * "빨아보고 싶다"며 만남을 제안한다.(replyDM 참고)
 * @returns 생성되면 true
 */
export function maybeSpawnDickPicDM(state: GameState): boolean {
  if (!state.adultMode) return false;
  const account = getActiveAccount(state);
  if (!chance(DICKPIC_DM_CHANCE)) return false;
  const npc = makeRandomAccount(true, state.day);
  const size = randomDickSize();
  account.dms.unshift({
    id: uid("dm"),
    partnerName: npc.name,
    partnerHandle: npc.handle,
    attribute: npc.attribute,
    isAdult: true,
    messages: [
      { id: uid("dmm"), from: "partner", text: pick(DICKPIC_OPENERS), day: state.day },
      { id: uid("dmm"), from: "partner", text: "", photoSize: size, day: state.day },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    genitalSize: size,
  });
  return true;
}

export interface DMReplyResult {
  followerDelta: number;
  partnerText: string;
}

/**
 * 특정 스레드에 톤을 골라 답장한다.
 * - 내 메시지 + 상대 자동응답을 추가.
 * - 톤에 따라 스탯/팔로워/도덕성이 소폭 변한다.
 */
export function replyDM(state: GameState, thread: DMThread, tone: DMTone): DMReplyResult {
  const myText = pick(REPLY_LINES[tone]);
  const partnerText = pick(PARTNER_REPLIES[tone]);

  thread.messages.push({ id: uid("dmm"), from: "me", text: myText, day: state.day });
  thread.messages.push({ id: uid("dmm"), from: "partner", text: partnerText, day: state.day });
  thread.unread = false;
  // DM 답장도 상대와의 상호작용 — 트친 누적에 센다.
  bumpTchinProgress(state, thread.partnerHandle);

  let followerDelta = 0;
  applyToneEffects(state, tone);

  if (tone === "friendly" && chance(0.5)) {
    followerDelta = 1 + Math.floor(Math.random() * 3);
  } else if (tone === "bold" && chance(0.55)) {
    followerDelta = 1 + Math.floor(Math.random() * 4);
  }
  if (followerDelta) changeFollowers(state, followerDelta);

  // 성기 사진을 보낸 상대 + 음란도가 높음 + 긍정 답변 → 노골적 반응 후 모텔(만남) 제안
  const positive = tone === "friendly" || tone === "bold";
  if (
    thread.genitalSize &&
    !thread.wantsToMeet &&
    !thread.metOffline &&
    positive &&
    state.skills.lewd >= LEWD_HORNY_MIN
  ) {
    thread.messages.push({
      id: uid("dmm"),
      from: "partner",
      text: "하아... 이거 지금 당장 빨아보고 싶다. 우리 만날래요? 🔞",
      day: state.day,
    });
    thread.unread = true;
    thread.wantsToMeet = true;
    thread.meetProposedDay = state.day;
    thread.motel = true;
    thread.motelKind = "meetup";
    return { followerDelta, partnerText };
  }

  // 친근/대담 대화를 이어가면 상대가 만남을 제안할 수 있음
  if (positive) maybePropose(state, thread, 0.3);

  return { followerDelta, partnerText };
}

/** 자유 입력 메시지 전송(간단 응답, 특별 효과 없음) */
export function sendCustomDM(state: GameState, thread: DMThread, text: string): void {
  thread.messages.push({ id: uid("dmm"), from: "me", text, day: state.day });
  bumpTchinProgress(state, thread.partnerHandle);
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text: pick(PARTNER_REPLIES.friendly),
    day: state.day,
  });
  thread.unread = false;
  maybePropose(state, thread, 0.15);
}

function applyToneEffects(state: GameState, tone: DMTone): void {
  switch (tone) {
    case "friendly":
      state.skills.sociability = clampSkill(state.skills.sociability + 5);
      break;
    case "cool":
      state.resources.mental = clampResource(state.resources.mental + 1);
      break;
    case "bold":
      state.skills.lewd = clampSkill(state.skills.lewd + 5);
      state.resources.morality = clampResource(state.resources.morality - 1);
      break;
  }
}

/** 화면에 보여줄 DM 스레드 — 성인물 보기 OFF면 성인(isAdult) 스레드는 목록에서 숨긴다. */
export function visibleDms(state: GameState): DMThread[] {
  const dms = getActiveAccount(state).dms;
  return state.adultMode ? dms : dms.filter((t) => !t.isAdult);
}

/** 활성 계정의 안 읽은 DM 개수(숨긴 성인 스레드는 제외) */
export function unreadDMCount(state: GameState): number {
  return visibleDms(state).filter((t) => t.unread).length;
}

/** 대담(성인) 톤 사용 가능 여부: 성인물 해제(유저 전역 설정)가 켜져 있어야 함 */
export function canUseBoldTone(state: GameState): boolean {
  return state.adultMode;
}
