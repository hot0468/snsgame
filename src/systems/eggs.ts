import type { GameState, ScheduleEvent, Tweet, Account, SkillStatId } from "@/core/types";
import { getActiveAccount, LATE_SLOT } from "@/core/state";
import { MAX_SKILL, SKILL_STATS } from "@/data/stats";
import { chance, pick, randInt, uid } from "@/utils/random";
import { changeFollowers, maxPostSlots } from "./followers";
import { pushKakao } from "./kakao";
import { clampSkill } from "./stats";
import { maybeSpawnGroupRoomInviteDM } from "./groupRoom";
import { bumpTchinProgress } from "./tchin";

/**
 * 이스터에그·특수 이벤트 로직.
 * 반응(좋아요/리트윗)·팔로우·트윗·스탯 변화에 훅으로 붙는다.
 * 피드백은 카카오톡(축하/경고)과 DM(사기/찐친 등), 팔로워 변화로 전달한다.
 */

/** 레몬Z 이스터에그로 오르는 스킬 수치. */
export const LEMONZ_GAIN = 200;

/** 레몬Z 이스터에그의 랜덤 대상 — 음란(lewd)을 제외한 스킬 8종. */
export const LEMONZ_SKILLS: readonly SkillStatId[] = [
  "fitness",
  "beauty",
  "vocabulary",
  "knowledge",
  "sociability",
  "comedy",
  "creativity",
  "game",
];

/** 레몬Z 발동 조합(장바구니의 중복 제거 id 집합이 정확히 이것과 같아야 한다). */
const LEMONZ_CART = ["lemon", "mandarin"] as const;

/** 스케줄 로그 기록(time.ts와의 순환 참조를 피해 인라인). */
function addSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  state.schedule.push({ id: uid("sch"), day: state.day, title, kind });
}

/** 1회성 이벤트를 처음 발동할 때만 true. 이미 발동했으면 false. */
function fire(state: GameState, key: string): boolean {
  if (state.eggs.done[key]) return false;
  state.eggs.done[key] = true;
  return true;
}

/** 간단한 알림용 DM 스레드를 만든다. */
function spawnDM(
  state: GameState,
  name: string,
  handle: string,
  lines: string[],
  scam = false,
): void {
  const account = getActiveAccount(state);
  account.dms.unshift({
    id: uid("dm"),
    partnerName: name,
    partnerHandle: handle,
    attribute: "daily",
    isAdult: false,
    messages: lines.map((text) => ({ id: uid("dmm"), from: "partner" as const, text, day: state.day })),
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    // 사기 접선(코인·다단계 등)은 만남 제안 흐름을 타면 안 된다(로맨스 아님).
    scam: scam || undefined,
  });
}

/* ─────────────────── 하루 리셋 ─────────────────── */

/** 날짜가 바뀌었으면 일일 카운터를 초기화한다. */
export function ensureEggDay(state: GameState): void {
  const acc = getActiveAccount(state);
  if (acc.dailyTweetDay !== state.day) {
    acc.dailyTweetDay = state.day;
    acc.dailyTweetCount = 0;
  }
}

/* ─────────────────── 게시 슬롯(트윗 전용 일일 예산) ─────────────────── */

/**
 * 게시 슬롯. **행동력(resources.action)과 무관한 트윗 전용 카운터다** — 초반 슬롯이 1이어도
 * 공부·운동·근무·휴식은 행동력으로 정상 작동한다(데드락 없음). 상한·소비 모두 활성 계정 기준이라
 * 계정마다 따로 센다(계정 전환 시 소비량이 섞이지 않는다). 도배 카운트(dailyTweetCount)와 별도
 * 필드라 free 게시가 슬롯을 갉지 않는다.
 */

/** 슬롯 날짜가 바뀌었으면 오늘 소비량을 초기화한다(ensureEggDay와 같은 패턴, 계정별). */
export function ensurePostSlotDay(state: GameState): void {
  const acc = getActiveAccount(state);
  if (acc.postSlotsDay !== state.day) {
    acc.postSlotsDay = state.day;
    acc.postSlotsUsed = 0;
  }
}

/**
 * 오늘 남은 게시 슬롯 수(0 이상). **순수 읽기 — 상태를 변형하지 않는다**(렌더 중 UI가 호출).
 * 날짜가 지난 소비량은 0으로 간주하므로 하루가 바뀌면 리셋 없이도 만충으로 읽힌다.
 */
export function remainingPostSlots(state: GameState): number {
  const acc = getActiveAccount(state);
  const max = maxPostSlots(acc.followers);
  const used = acc.postSlotsDay === state.day ? acc.postSlotsUsed : 0;
  return Math.max(0, max - (Number.isFinite(used) ? used : 0));
}

/** 오늘 슬롯이 남아 트윗을 올릴 수 있는지(UI 게이트). */
export function canPostBySlot(state: GameState): boolean {
  return remainingPostSlots(state) > 0;
}

/** 게시 슬롯 1개 소비(트윗 게시 시). free 게시는 호출하지 않는다. */
export function consumePostSlot(state: GameState): void {
  ensurePostSlotDay(state);
  getActiveAccount(state).postSlotsUsed += 1;
}

/* ─────────────────── 좋아요/리트윗 ─────────────────── */

/** 남 계정과의 상호작용(좋아요+리트윗)을 누적해 '찐친'을 판정한다. */
function bumpEngage(state: GameState, tweet: Tweet): void {
  const h = tweet.authorHandle;
  // 트친(단짝) 누적도 좋아요/RT를 상호작용으로 센다(성사 시 pendingTchinToasts에 쌓임).
  bumpTchinProgress(state, h, tweet.authorName);
  const n = (state.eggs.authorEngage[h] ?? 0) + 1;
  state.eggs.authorEngage[h] = n;
  if (n === 5 && fire(state, `bff:${h}`)) {
    spawnDM(state, tweet.authorName, h, [
      "저기, 제 글에 계속 반응 남겨주셔서 감사해요 ㅎㅎ 알아봐 주시니까 신기하고 좋네요!",
      "우리 이제 완전 찐친 아니에요? 앞으로 자주 소통해요 :)",
    ]);
    changeFollowers(state, randInt(3, 10));
    addSchedule(state, `${tweet.authorName}와(과) 찐친이 됨`, "sns");
  }
}

/** 남의 트윗에 좋아요를 눌렀을 때(이스터에그 처리). */
export function onLikeTweet(state: GameState, tweet: Tweet): void {
  bumpEngage(state, tweet);

  if (tweet.egg === "coin") {
    if (fire(state, "coinRoom")) {
      spawnDM(
        state,
        "코인 리딩방",
        "moon_signal",
        [
          "좋아요 감사합니다! 방금 그 종목, 사실 저희 리딩방에서 미리 콕 찍어드린 거예요 🚀",
          "무료 체험방 초대해드릴게요. 이번 주 '확실한 거' 하나 더 있는데... 궁금하시죠?",
        ],
        true, // 사기 접선 — 만남 제안 금지
      );
      addSchedule(state, "코인 리딩방 접선", "sns");
    }
    return;
  }
  if (tweet.egg === "pyramid") {
    if (fire(state, "pyramidDM")) {
      spawnDM(
        state,
        "이사님",
        "freedom_king",
        [
          "관심 가져주셔서 감사합니다! 딱 보니 마인드가 남다르시네요 ✨",
          "이번 주말 무료 사업 설명회가 있어요. 인생을 바꿀 기회, 커피 한 잔 사드릴게요!",
          "자리가 몇 개 안 남았어요. 지금 결정하는 사람만이 자유를 얻습니다.",
        ],
        true, // 다단계 접선 — 만남 제안 금지
      );
      addSchedule(state, "다단계 설명회 권유", "sns");
    }
    return;
  }
  if (tweet.egg === "animal") {
    state.eggs.animalLikes += 1;
    if (state.eggs.animalLikes >= 3 && fire(state, "catButler")) {
      state.resources.mental = Math.min(100, state.resources.mental + 12);
      addSchedule(state, "길고양이 집사 데뷔", "offline");
      pushKakao(
        state,
        "동네 주민",
        [
          "저기, 요즘 우리 동네 길고양이들 챙겨주시는 분 맞죠? ㅎㅎ",
          "고양이들이 아주 건강해졌어요. 덕분이에요 정말 고마워요 🐈",
          "사료 필요하면 언제든 말해요, 같이 챙겨요!",
        ],
        { hue: 40 },
      );
    }
    return;
  }

  // 성인 트윗 좋아요 → 확률적으로 그룹방 초대 DM(가입 시 토 심야 정기 모임)
  maybeSpawnGroupRoomInviteDM(state, tweet);
}

/** 남의 트윗을 리트윗했을 때(이스터에그 처리). */
export function onRetweet(state: GameState, tweet: Tweet): void {
  bumpEngage(state, tweet);
}

/* ─────────────────── 팔로우 ─────────────────── */

/** 봇/유령 계정을 여러 번 팔로우하면 계정 신뢰도가 떨어진다. */
export function onFollow(state: GameState, account: Account): void {
  if (!account.bot) return;
  state.eggs.botFollows += 1;
  if (state.eggs.botFollows >= 5 && fire(state, "botPurge")) {
    const acc = getActiveAccount(state);
    const loss = Math.max(30, Math.round(acc.followers * 0.15));
    changeFollowers(state, -loss);
    addSchedule(state, `유령 팔로우 대숙청 (-${loss})`, "system");
    pushKakao(
      state,
      "SNS 운영팀",
      [
        "[안내] 회원님 계정에서 다수의 비정상(봇/유령) 계정 팔로우가 감지되었습니다.",
        `계정 신뢰도 보호를 위해 관련 계정이 정리되었습니다. 팔로워 ${loss.toLocaleString("ko-KR")}명이 감소했습니다.`,
        "건전한 소통 활동을 부탁드립니다.",
      ],
      { hue: 210 },
    );
  }
}

/* ─────────────────── 트윗(도배·밤샘) ─────────────────── */

/** 트윗을 올린 직후 호출(시간 진행 전). postedSlot은 올린 시간대. */
export function onTweetPosted(state: GameState, postedSlot: number): void {
  ensureEggDay(state);
  const acc = getActiveAccount(state);
  acc.dailyTweetCount += 1;
  // 하루 트윗 10개 초과 → 도배로 인식돼 노출·유입 감소 (계정별 카운트)
  if (acc.dailyTweetCount > 10) {
    changeFollowers(state, -randInt(5, 15));
    if (acc.dailyTweetCount === 11) {
      pushKakao(
        state,
        "타임라인 친구",
        ["야 너 오늘 트윗 왜 이렇게 많이 올려 ㅋㅋ 타임라인 도배됨...", "적당히 좀 하자 언팔 마려워"],
        { hue: 0 },
      );
      addSchedule(state, "트윗 도배 역풍", "system");
    }
  }

  // 7일 연속 심야 트윗 → 밤샘 인플루언서
  if (postedSlot === LATE_SLOT) {
    if (state.eggs.lastLateDay === state.day) {
      // 오늘 이미 심야 트윗 카운트됨 — 무시
    } else {
      state.eggs.lateStreak = state.eggs.lastLateDay === state.day - 1 ? state.eggs.lateStreak + 1 : 1;
      state.eggs.lastLateDay = state.day;
      if (state.eggs.lateStreak >= 7 && fire(state, "nightOwl")) {
        changeFollowers(state, randInt(30, 60));
        addSchedule(state, "밤샘 인플루언서 등극", "sns");
        pushKakao(
          state,
          "타임라인 친구",
          ["너 진짜 매일 새벽까지 트윗하더라... 이젠 밤의 지배자 인정 ㅋㅋ", "근데 몸 좀 챙겨 제발"],
          { hue: 260 },
        );
      }
    }
  }
}

/* ─────────────────── 스탯 임계값 ─────────────────── */

/** 스탯 변화 후 임계값 이스터에그를 점검한다(행동/시간 진행 시 호출). */
export function checkStatEggs(state: GameState): void {
  // 도덕성 0 → 타락 루트
  if (state.resources.morality <= 0 && fire(state, "corrupt")) {
    addSchedule(state, "타락 루트 각성", "system");
    pushKakao(
      state,
      "내면의 목소리",
      [
        "…양심 같은 건 이제 거추장스럽지?",
        "규칙도, 눈치도 다 던져버려. 넌 이제 뭐든 할 수 있어.",
        "이 세계에서 이기는 건 착한 사람이 아니야.",
      ],
      { hue: 320 },
    );
  }
  // 지식 또는 어휘력 만렙 → 박학다식(정보/시사 트윗 성과 버프)
  if (
    (state.skills.knowledge >= MAX_SKILL || state.skills.vocabulary >= MAX_SKILL) &&
    fire(state, "smart")
  ) {
    addSchedule(state, "박학다식 달성", "system");
    pushKakao(
      state,
      "네이놈 지식iN",
      ["회원님, 지식·어휘력이 만렙에 도달했습니다! 🎓", "이제 정보·시사·IT 트윗이 한층 더 잘 먹힐 거예요."],
      { hue: 150 },
    );
  }
  // 음란 만렙 + 성인모드 + 사바나 계약 → 레전드 BJ(사바나 도네이션 버프)
  // 레전드 BJ = 사바나 BJ라 계약이 전제. 미계약이면 카톡·버프가 뜨면 안 된다.
  if (
    state.skills.lewd >= MAX_SKILL &&
    state.adultMode &&
    state.savannaJoined &&
    fire(state, "legendBJ")
  ) {
    addSchedule(state, "레전드 BJ 등극", "sns");
    state.money += 300_000;
    pushKakao(
      state,
      "사바나 매니저",
      [
        "회원님, 음란도 만렙 달성 축하드려요! 🔥 이제 레전드 BJ세요.",
        "앞으로 방송 도네이션이 확 뛸 거예요. 오늘 특별 보너스도 넣어드렸어요 💸",
      ],
      { hue: 340 },
    );
  }
}

/* ─────────────────── 고양이 전원 버튼 ─────────────────── */

/** 고양이가 전원 버튼을 밟을 확률(행동당) */
export const CAT_POWER_CHANCE = 0.005;

/**
 * 고양이를 키우면 행동마다 아주 낮은 확률로 전원 버튼 참사(advanceTime에서 호출).
 * 플래그만 세운다 — 2초 블랙아웃과 팝업 연출은 전적으로 UI가 소유한다.
 * 페널티는 없다(순수 개그).
 */
export function maybeCatPowerButton(state: GameState): void {
  if (!state.pets.cat) return;
  if (state.gameOver) return;
  if (state.catPowerPending) return;
  if (chance(CAT_POWER_CHANCE)) state.catPowerPending = true;
}

/** 박학다식 버프 배율(정보성 트윗 성과). */
export function smartTweetMultiplier(state: GameState, attr: string): number {
  if (!state.eggs.done.smart) return 1;
  return attr === "info" || attr === "politics" || attr === "it" ? 1.3 : 1;
}

/** 레전드 BJ 버프 배율(사바나 도네이션). */
export function legendBJMultiplier(state: GameState): number {
  return state.eggs.done.legendBJ ? 1.5 : 1;
}

/* ─────────────────── 마켓걸리버 레몬Z ─────────────────── */

export interface LemonZResult {
  /** 오른 스탯 id */
  stat: SkillStatId;
  /** 화면 표기용 라벨(예: "어휘력") — data/stats.ts의 label을 쓴다 */
  label: string;
  before: number;
  after: number;
  /** 실제 상승분(상한 clamp 때문에 200보다 작을 수 있다) */
  gained: number;
}

/** 장바구니(중복 허용 배열)의 id 집합이 정확히 {lemon, mandarin}인가. 수량은 무관하다. */
function isLemonZCart(cart: string[]): boolean {
  const ids = new Set(cart);
  return ids.size === LEMONZ_CART.length && LEMONZ_CART.every((id) => ids.has(id));
}

/**
 * 마켓걸리버 레몬Z 이스터에그.
 * 장바구니 중복 제거 집합이 정확히 {lemon, mandarin}이고 아직 발동한 적 없으면
 * 랜덤 스킬 1개를 +200 올리고 결과를 반환한다. 아니면 null.
 *
 * 랜덤 대상은 **아직 만렙(999)이 아닌 스킬**로 좁힌다 — 게임당 1회뿐이라
 * 만렙 스탯이 뽑히면 +0으로 보상이 증발한다. 후보가 하나도 없으면(8종 전부 만렙)
 * 발동시키지 않고 null을 반환한다: 줄 게 없는데 1회성만 태우지 않기 위함이다.
 */
export function tryLemonZ(state: GameState, cart: string[]): LemonZResult | null {
  // ⚠️ 조합 판정과 후보 확인이 반드시 fire()보다 먼저다. fire는 호출 즉시 done을 세우므로
  //    발동하지 않는 경로에서 부르면 이스터에그가 영영 죽는다.
  if (!isLemonZCart(cart)) return null;

  const candidates = LEMONZ_SKILLS.filter((s) => state.skills[s] < MAX_SKILL);
  if (candidates.length === 0) return null;

  if (!fire(state, "lemonZ")) return null;

  const stat = pick(candidates);
  const before = state.skills[stat];
  const after = clampSkill(before + LEMONZ_GAIN);
  state.skills[stat] = after;

  const label = SKILL_STATS[stat].label;
  const gained = after - before;
  addSchedule(state, `🍋 레몬Z! ${label} +${gained}`, "system");
  return { stat, label, before, after, gained };
}
