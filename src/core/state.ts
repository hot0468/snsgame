import type {
  AttributeId,
  AuctionState,
  CheatState,
  GameState,
  LabState,
  PlayerAccount,
  Tweet,
} from "./types";
import { uid } from "@/utils/random";
import { initialMarket } from "@/data/market";

/**
 * 치트의 초기(미사용) 상태 — 새 게임과 구세이브 보정이 함께 쓴다.
 * 새 게임이 이걸 쓰기 때문에 치트가 '게임당 1회'가 된다(actionMaxBonus: 0도 같은 이유).
 */
export function createInitialCheats(): CheatState {
  return { money: false, cheatExe: false };
}

/** 터커 연구실 퀘스트의 초기(미진행) 상태 — 새 게임과 구세이브 보정이 함께 쓴다. */
export function createInitialLab(): LabState {
  return {
    offer: "none",
    tuckerDmDay: null,
    shifts: 0,
    done: false,
  };
}

/** 서던피스 경매의 초기(미진행) 상태 — 새 게임과 구세이브 보정이 함께 쓴다. */
export function createInitialAuction(): AuctionState {
  return {
    mailedDay: null,
    bought: [],
    eyeDeal: "none",
    eyeBoughtDay: null,
    eyeRefusedDay: null,
    consoleReview: "none",
  };
}

/** 팔로워 목표치 — 게임 승리 조건 */
export const FOLLOWER_GOAL = 1_000_000;

/** 파이어족(조기 은퇴) 엔딩이 열리는 소지금(100억) */
export const FIRE_MONEY = 10_000_000_000;
/** 파이어족 엔딩 사유 문구(gameOver에 저장되어 축하 엔딩으로 렌더된다) */
export const FIRE_ENDING_REASON =
  "🎉 파이어족 달성! 100억을 모아 이른 은퇴에 성공했습니다. 이제 일하지 않아도 노후가 두렵지 않은 삶을 즐기세요.";

/** 연예인 데뷔 엔딩 사유 */
export const DEBUT_ENDING_REASON =
  "🌟 연예인 데뷔! SNS 인플루언서를 넘어 정식으로 연예계에 데뷔했습니다. 이제 화면 속에서 빛나는 스타로 새 인생을 시작합니다.";

/** 전업 작가 정착 엔딩 사유 */
export const AUTHOR_ENDING_REASON =
  "✍️ 전업 작가 정착! 꾸준한 창작과 마감의 나날 끝에, 이 길이 천직임을 확신하게 됐습니다. 오래도록 사랑받는 작가로 살아갑니다.";

/** 레전드 BJ 엔딩 사유 */
export const LEGEND_BJ_ENDING_REASON =
  "🎙️ 레전드 BJ 엔딩! 사바나를 대표하는 이름이 되었습니다. 켜면 사람이 모이고 그 방이 곧 기준이 되는 자리에서, 오래도록 전설로 불리며 살아갑니다.";

/** 사채 3회 연체 엔딩 사유 — 일반 모드(부모님이 빚을 갚고 강제 귀향) */
export const LOAN_DEFAULT_ENDING_REASON =
  "대부업체에 세 번이나 끌려간 끝에 결국 부모님께 모든 것이 들통났습니다. 빚은 다행히 모두 갚아주셨지만, 휴대폰을 빼앗긴 채 그대로 고향으로 내려가게 되었습니다...";

/** 사채 3회 연체 엔딩 사유 — 성인 모드(실종) */
export const LOAN_DEFAULT_ENDING_REASON_ADULT =
  "대부업체에 세 번째로 끌려간 그날 이후, 당신을 봤다는 사람은 아무도 없었습니다. 방은 그대로였고, 휴대폰만 꺼진 채 남아 있었습니다...";

/** gameOver 사유 → 축하 엔딩 제목(그 외 사유는 GAME OVER) */
export const CELEBRATORY_ENDING_TITLES: Record<string, string> = {
  [FIRE_ENDING_REASON]: "🏝️ FIRE 엔딩",
  [DEBUT_ENDING_REASON]: "🌟 데뷔 엔딩",
  [AUTHOR_ENDING_REASON]: "✍️ 작가 엔딩",
  [LEGEND_BJ_ENDING_REASON]: "🎙️ 레전드 BJ 엔딩",
};

/** 하루의 행동 슬롯 수 (0..SLOTS_PER_DAY-1) — 낮/심야 */
export const SLOTS_PER_DAY = 2;
export const SLOT_LABELS = ["낮", "심야"] as const;

/** 시간대 슬롯 인덱스 (구 아침·저녁을 '낮' 하나로 합침) */
export const MORNING_SLOT = 0; // '낮' (구 아침+저녁 통합)
export const LATE_SLOT = 1;

/** 이 값 미만이면 '우울 모드' — 우울한 트윗만 쓸 수 있다. */
export const MENTAL_LOW_THRESHOLD = 20;

/** 정신력이 바닥나 우울 모드인지 */
export function isMentalLow(mental: number): boolean {
  return mental < MENTAL_LOW_THRESHOLD;
}

/** 이 값 미만이면 도덕성이 매우 낮음 — 사기 트윗 작성 가능. */
export const MORALITY_SCAM_THRESHOLD = 20;

/** 도덕성이 매우 낮아 사기 트윗을 쓸 수 있는지 */
export function canWriteScam(morality: number): boolean {
  return morality < MORALITY_SCAM_THRESHOLD;
}

/** 계정 하나를 생성한다(신규 계정은 항상 일상계만 해금된 상태로 시작). */
export function createAccount(
  name: string,
  handle: string,
  attribute: AttributeId,
): PlayerAccount {
  return {
    id: uid("acct_me"),
    name,
    handle,
    attribute,
    followers: 0,
    following: 0,
    timeline: [],
    postCount: 0,
    // 기본 일상계 + 개설 시 고른 콘셉트 속성을 함께 해금(콘셉트 계정 지원)
    unlockedAttributes: attribute === "daily" ? ["daily"] : ["daily", attribute],
    groupUnlocked: false,
    // 섹트(일반 성인 트윗)는 기본 해금. meetup/punish/dom은 야밤 리뷰로 해금.
    unlockedAdultKinds: ["sekt"],
    lastTweetDay: 1,
    dms: [],
    followingAccounts: [],
    strikes: 0,
    suspendedUntilDay: 0,
    relationships: {},
    // 1일 트윗 카운트·게시 슬롯 소비는 계정별로 센다.
    dailyTweetDay: 1,
    dailyTweetCount: 0,
    postSlotsDay: 1,
    postSlotsUsed: 0,
    // 트친(단짝): 상호작용 누적으로 성사. 도달 배율은 systems/tchin이 계산.
    tchins: [],
    tchinProgress: {},
  };
}

/** 계정이 정지(밴) 상태인지 */
export function isSuspended(account: PlayerAccount, day: number): boolean {
  return (account.suspendedUntilDay ?? 0) > day;
}

/** 새 게임 초기 상태를 만든다. */
export function createInitialState(): GameState {
  const first = createAccount("이름없는 유저", "newbie", "daily");
  return {
    version: 3,
    accounts: [first],
    activeAccountId: first.id,
    adultMode: false,
    adultNoCoercion: false,
    money: 500_000, // 초기 저축(약 한 달 반 생활 runway)
    day: 1,
    slot: 0,
    resources: {
      action: 100,
      mental: 100,
      morality: 50,
      reputation: 100,
    },
    skills: {
      fitness: 0,
      beauty: 0,
      vocabulary: 0,
      knowledge: 0,
      sociability: 0,
      comedy: 0,
      creativity: 0,
      lewd: 0,
      game: 0,
      it: 0,
      otaku: 0,
    },
    stamina: 200,
    staminaMax: 200,
    // 새 게임은 상한 보너스 0 · 치트 미사용에서 시작한다 — 치트가 '게임당 1회'인 지점.
    actionMaxBonus: 0,
    cheats: createInitialCheats(),
    schedule: [],
    partTimeCount: 0,
    kakao: [],
    workMsgs: [],
    lastRentReminderDay: -1,
    crewJoined: false,
    rejectionTweets: 0,
    studyJoined: false,
    estheticMember: false,
    estheticScamDay: 0,
    privateCrewJoined: false,
    groupRoomJoined: false,
    savannaJoined: false,
    lingerieContract: false,
    lingerieOffered: false,
    animeTweetsPosted: 0,
    paidChannelJoined: false,
    appointments: [],
    employment: null,
    avJob: null,
    avOffered: false,
    niglShifts: 0,
    loan: null,
    loanOffered: false,
    unpaidRentStreak: 0,
    loanDefaultStreak: 0,
    overdueRent: 0,
    lastIncomeSettleMonth: -1,
    lastJobBoardDay: -1,
    pendingJobApp: null,
    pendingContest: null,
    certifications: [],
    pendingExam: null,
    pendingSpecialExam: null,
    auction: createInitialAuction(),
    lab: createInitialLab(),
    emails: [],
    pendingControversy: null,
    market: initialMarket(),
    ownedItems: [],
    pendingGoods: [],
    goblinShopMonth: null,
    pushtimeUnlocked: false,
    yabamUnlocked: false,
    youtubeUnlocked: false,
    medibooksUnlocked: false,
    steamUnlocked: false,
    ownedGames: [],
    reviewedGames: [],
    adTweets: [],
    dartpinUnlocked: false,
    dartpinBoard: null,
    dstoryUnlockedPosts: [],
    drunkPending: false,
    pendingRegretTweetId: null,
    hostsFile: null,
    adultTweetsPosted: 0,
    punishTweetsPosted: 0,
    yabamProductsOwned: [],
    seenWorks: [],
    creationTweetCount: 0,
    authorContract: null,
    housingTier: 0,
    lotto: null,
    fireDeclined: false,
    endingsDeclined: [],
    seasonalFired: [],
    seenMeetings: [],
    postedAdultEver: false,
    pets: { dog: false, cat: false },
    creatures: [],
    eggs: {
      lateStreak: 0,
      lastLateDay: -1,
      botFollows: 0,
      animalLikes: 0,
      authorEngage: {},
      adDays: [],
      done: {},
    },
    lateTweetToday: false,
    bossJokeDay: -1,
    dawnPending: false,
    sickPending: false,
    lastRestGain: { action: 0, mental: 0 },
    sleepPending: false,
    catPowerPending: false,
    lastMaxPostSlots: 1, // = maxPostSlots(0). 리터럴로 둔다(core→systems 순환 import 방지)
    postSlotIncreasedTo: null,
    pendingNews: null,
    pendingTchinToasts: [],
    lotteryLuck: 0,
    hauntPending: false,
    hauntVisitNow: false,
    daily: {
      adWatchedDay: -1,
      bannerClaimedDay: -1,
    },
    // 새 게임은 로그인 화면부터 시작한다. (구세이브 호환은 save.ts의 loadGame이 처리한다)
    loggedIn: false,
    gameOver: null,
    achievements: [],
    pendingAchievements: [],
  };
}

/**
 * 현재 활성 계정을 반환한다.
 * activeAccountId가 유효하지 않으면 첫 계정으로 보정한다.
 */
export function getActiveAccount(state: GameState): PlayerAccount {
  return (
    state.accounts.find((a) => a.id === state.activeAccountId) ?? state.accounts[0]
  );
}

/**
 * 타임라인 보관 상한. 게임이 길어지면 게시 트윗이 무한히 쌓이는데,
 * (1) 전체 재렌더가 타임라인을 통째로 DOM 카드로 그리고 (2) 저장이 상태를 통째로 직렬화하므로,
 * 상한이 없으면 상호작용마다 렉이 끼고 localStorage 쿼터(~5MB)를 넘겨 저장이 조용히 실패한다.
 * 오래된 트윗은 잘라내되, 총 게시물 수는 account.postCount로 보존한다.
 */
export const TIMELINE_MAX = 300;

/**
 * 게시 트윗을 타임라인 맨 앞에 넣고 총 게시물 수를 센 뒤, 상한을 넘으면 가장 오래된 것부터 잘라낸다.
 * **새 게시 경로는 반드시 이 헬퍼를 거쳐라.** account.timeline.unshift를 직접 부르면
 * postCount·TIMELINE_MAX 불변식이 깨져 게시물 수가 안 맞거나 누적 절벽이 되살아난다.
 */
export function pushTimeline(account: PlayerAccount, tweet: Tweet): void {
  account.timeline.unshift(tweet);
  account.postCount++;
  if (account.timeline.length > TIMELINE_MAX) account.timeline.length = TIMELINE_MAX;
}

/**
 * 화면에 보여줄 내 타임라인 — 성인물 보기 OFF면 내가 쓴 성인 트윗(isAdult)을 가린다.
 * (표시용 필터일 뿐, 트윗 자체는 남아 있다 — 팔로워 등엔 영향 없음.)
 */
export function visibleTimeline(state: GameState) {
  const tl = getActiveAccount(state).timeline;
  return state.adultMode ? tl : tl.filter((t) => !t.isAdult);
}

/**
 * 계정의 '성향'은 스스로 고르는 게 아니라, 그동안 올린 트윗에서
 * 가장 많은 비중을 차지한 카테고리로 자동 결정된다.
 * (유저에게는 표출되지 않으며, 트윗 성과의 궁합 계산 등에 쓰인다.)
 * 아직 올린 트윗이 없으면 기존 성향(초기값 daily)을 유지한다.
 */
export function dominantAttribute(account: PlayerAccount): AttributeId {
  const counts = new Map<AttributeId, number>();
  for (const t of account.timeline) {
    // 내가 직접 올린 트윗 + 내가 리트윗한 트윗을 함께 집계
    if (t.authorHandle !== account.handle && !t.isRetweet) continue;
    counts.set(t.attribute, (counts.get(t.attribute) ?? 0) + 1);
  }
  let best: AttributeId = account.attribute;
  let bestN = 0;
  for (const [attr, n] of counts) {
    if (n > bestN) {
      bestN = n;
      best = attr;
    }
  }
  return best;
}
