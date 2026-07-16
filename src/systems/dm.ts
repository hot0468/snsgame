import type { AdultKind, DickSize, DMThread, GameState, PlayerAccount } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { makeRandomAccount } from "@/data/accounts";
import {
  PARTNER_REPLIES,
  REPLY_LINES,
  randomOpener,
  type DMTone,
} from "@/data/dmContent";
import { MAX_SKILL } from "@/data/stats";
import { pick, randInt, uid, chance } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampResource, clampSkill } from "./stats";

/** 팬이 DM을 보내올 확률(팔로워를 얻은 행동 직후 호출) */
export const FAN_DM_CHANCE = 0.35;

/** 후원 DM 확률의 기본값(친화력 0일 때) */
export const DONATION_BASE_CHANCE = 0.25;
/** 친화력 만렙일 때 후원 DM 확률에 더해지는 최대 보너스 */
export const DONATION_SOCIABILITY_BONUS = 0.4;

/**
 * 활성 계정으로 새 팬 DM 스레드를 만들어 추가한다.
 * 성인 계정에서만 성인 성향 상대가 등장한다.
 */
export function spawnFanDM(state: GameState): DMThread | null {
  const account = getActiveAccount(state);
  const npc = makeRandomAccount(state.adultMode, state.day);
  const thread: DMThread = {
    id: uid("dm"),
    partnerName: npc.name,
    partnerHandle: npc.handle,
    attribute: npc.attribute,
    isAdult: npc.isAdult,
    messages: [
      {
        id: uid("dmm"),
        from: "partner",
        text: randomOpener(npc.attribute),
        day: state.day,
      },
    ],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
  };
  // 친화력이 높을수록 후원을 보내는 팬이 늘어난다(만렙에서 25%→65%)
  if (
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
      text: `늘 잘 보고 있어요! 작지만 후원 ${amount.toLocaleString("ko-KR")}원 보낼게요 💸`,
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
    text: "받아주셔서 감사해요 앞으로도 응원할게요! 🙌",
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
  if (!chance(FAN_DM_CHANCE)) return false;
  spawnFanDM(state);
  return true;
}

/** 성인 트윗을 올렸을 때 모텔 제안 DM이 올 확률 */
export const MOTEL_DM_CHANCE = 0.4;

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

/** 티켓 양도 DM 확률 */
export const TICKET_DM_CHANCE = 0.4;

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
    motel: true,
    motelKind: kind,
  });
  return true;
}

/** 성기 사진 DM이 올 확률(성인 트윗을 올린 성인 계정 한정) */
export const DICKPIC_DM_CHANCE = 0.45;

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

/** 활성 계정의 안 읽은 DM 개수 */
export function unreadDMCount(account: PlayerAccount): number {
  return account.dms.filter((t) => t.unread).length;
}

/** 대담(성인) 톤 사용 가능 여부: 성인물 해제(유저 전역 설정)가 켜져 있어야 함 */
export function canUseBoldTone(state: GameState): boolean {
  return state.adultMode;
}
