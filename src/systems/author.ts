import type { AuthorContract, DMThread, GameState, PlayerAccount, ScheduleEvent, Tweet } from "@/core/types";
import { getActiveAccount, appendSchedule } from "@/core/state";
import { randomName } from "@/data/accounts";
import { WEBTOON_BUZZ, WEBTOON_BUZZ_ADULT, type BuzzTier } from "@/data/webtoonBuzz";
import { chance, pick, randInt, uid } from "@/utils/random";
import { dateOfMonth, monthKey } from "./calendar";
import { totalFollowers } from "./economy";
import { skillTo100 } from "./stats";
import { pushKakao } from "./kakao";
import { JOB_ID, markJobExperienced } from "./jobExperience";

/**
 * 플랫폼 작가 계약 시스템.
 * - 창작(1차/2차창작) 트윗이 20개 이상 쌓이면 확률적으로 계약 제안 이벤트가 뜬다(data/events.ts).
 * - 수락하면 '익월부터' 매월 1일에 월급이 들어온다(일한 월수·팔로워수에 비례).
 * - 매달 작업량 게이지를 채워야 하며, 미달 시 그 달 월급은 50%. 미달 3회 누적이면 계약 해지.
 * - 게이지는 '현생 살기 → 작업'으로 채운다(창작·어휘력·개그·지식이 높을수록 잘 오른다).
 */

/** 작가 계약 제안이 뜨기 위한 최소 창작 트윗 수 */
export const AUTHOR_CONTRACT_MIN_CREATIONS = 20;
/** 한 달 작업량 목표치(게이지 만땅) */
export const AUTHOR_WORKLOAD_TARGET = 100;
/** 작가 월급 기본급 */
export const AUTHOR_BASE_SALARY = 200_000;
/** 일한 개월 수 1당 월급 인상액 */
export const AUTHOR_MONTH_RAISE = 50_000;
/** 팔로워 1명당 월급 가산액 */
export const AUTHOR_FOLLOWER_RATE = 1;
/** 작업 1회당 원고료(연차 0일 때) */
export const AUTHOR_PAY_PER_WORK = 60_000;
/** 연차(개월) 1당 회당 원고료 인상액 */
export const AUTHOR_WORK_RAISE = 10_000;
/** 작업량 미달이 이 횟수(누적) 도달하면 계약 해지 */
export const AUTHOR_MAX_MISS = 3;

function pushSchedule(state: GameState, title: string, kind: ScheduleEvent["kind"]): void {
  appendSchedule(state, { id: uid("sch"), day: state.day, title, kind });
}

function won(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 작업 게이지 획득량 — 창작·어휘력·개그·지식이 높을수록 많이 오른다(6~31).
 * 스킬은 0~999 스케일이므로 100점 만점으로 환산해 구 게이지 규모를 보존한다.
 */
export function authorWorkGain(state: GameState): number {
  const s = state.skills;
  const adult = state.authorContract?.adult ?? false;
  // 성인물 계약이면 음란도가 성과 스탯에 '가산'된다(월급 만액/반액을 가르는 작업량 게이지에 반영).
  // 전연령은 기존과 동일(/16). 성인은 음란만큼 추가로 오르므로(상한 37) 페널티 없이 순수 혜택이다.
  const sum = s.creativity + s.vocabulary + s.comedy + s.knowledge + (adult ? s.lewd : 0);
  return Math.round(6 + skillTo100(sum) / 16);
}

/**
 * 웹툰 **인기 지표**(원고료 규모 환산액). 편집자 코멘트·SNS 반응 구간을 가르는 값이라
 * 연차와 팔로워로만 계산한다 — 이번 달 작업 횟수와 무관해야 "이번 달 덜 그렸다고 인기가 죽는"
 * 이상한 그림이 안 나온다.
 * ⚠️ 실지급액은 이 값이 아니라 `authorWorkPay`다(작업 횟수 비례).
 */
export function authorMonthlySalary(state: GameState, monthsWorked: number): number {
  return AUTHOR_BASE_SALARY + monthsWorked * AUTHOR_MONTH_RAISE + totalFollowers(state) * AUTHOR_FOLLOWER_RATE;
}

/** 작업 1회당 원고료 — 연차가 쌓일수록 회당 단가가 오른다. */
export function authorPayPerWork(state: GameState): number {
  const months = state.authorContract?.monthsWorked ?? 0;
  return AUTHOR_PAY_PER_WORK + months * AUTHOR_WORK_RAISE;
}

/**
 * 실지급 원고료 = **이번 달 작업 횟수 × 회당 단가** + 팔로워 가산.
 * 일반 직장인만 고정 월급이고 나머지 직업은 일한 횟수만큼 받는다(사용자 확정 규칙).
 * 작업량 게이지(workload)는 지급액이 아니라 **계약 유지 판정**에만 쓴다.
 */
export function authorWorkPay(state: GameState): number {
  const c = state.authorContract;
  if (!c) return 0;
  return c.worksThisMonth * authorPayPerWork(state) + totalFollowers(state) * AUTHOR_FOLLOWER_RATE;
}

/**
 * 담당 편집자가 전하는 '이번 달 웹툰 인기' 코멘트.
 * 인기 척도는 '기본 월급(full)' 액수 — 팔로워·연차가 클수록 올라간다(미달 반감은 반영 안 함).
 */
function authorPopularityLine(full: number): string {
  if (full < 300_000) return "이번 달은 반응이 좀 조용했어요. 조회수가 아쉬웠는데, 다음 화에서 뒤집어봐요!";
  if (full < 600_000) return "이번 달 인기는 무난했어요. 꾸준히 챙겨보는 독자층이 탄탄하네요 :)";
  if (full < 1_200_000) return "이번 달 반응 좋았어요! 댓글이 부쩍 늘고 별점도 올랐어요 👍";
  if (full < 3_000_000) return "이번 달 인기 대박이에요! 조회수가 껑충 뛰어서 위에서도 주목하고 있어요 🔥";
  return "이번 달 완전 역대급이에요!! 플랫폼 메인에 걸리고 화제작 소리 듣고 있어요 😱";
}

/**
 * 인기 구간(0~3). authorPopularityLine과 **같은 경계**를 쓴다 —
 * 편집자 코멘트와 SNS 반응이 어긋나면 세계가 깨진다.
 */
export function authorBuzzTier(state: GameState): BuzzTier {
  const c = state.authorContract;
  if (!c) return 0;
  const full = authorMonthlySalary(state, c.monthsWorked);
  if (full < 300_000) return 0;
  if (full < 600_000) return 1;
  if (full < 1_200_000) return 2;
  return 3;
}

/**
 * 필명 검색 결과로 뜨는 독자 반응 트윗.
 * 계약 중이 아니거나 필명이 검색어와 다르면 빈 배열 — 호출부(exploreSystem)가 그냥 이어붙이면 된다.
 *
 * 인기 구간이 높을수록 더 많이 뜬다(0~3 → 1~4개). 랭킹·화제성이 곧 트윗 수라는 직관과 맞다.
 */
export function webtoonBuzzTweets(state: GameState, query: string): Tweet[] {
  const c = state.authorContract;
  if (!c) return [];
  const norm = (s: string) => s.replace(/\s+/g, "").toLowerCase();
  const q = norm(query.replace(/^@/, ""));
  if (!q || norm(c.penName) !== q) return [];

  const tier = authorBuzzTier(state);
  const pool = c.adult ? WEBTOON_BUZZ_ADULT[tier] : WEBTOON_BUZZ[tier];
  const count = Math.min(tier + 1, pool.length);
  // 같은 문구가 겹치지 않게 섞어서 앞에서 count개.
  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, count);

  return shuffled.map((line) => {
    const reader = randomName();
    return {
      id: uid("wbuzz"),
      authorName: reader.name,
      authorHandle: reader.handle,
      attribute: "anime" as const,
      isAdult: c.adult,
      text: line.replaceAll("{pen}", c.penName),
      createdDay: state.day,
      // 인기 구간이 높을수록 반응 수치도 커진다(조용한 작품에 1만 좋아요가 붙으면 거짓말이 된다).
      likes: randInt(2, 60) * (tier + 1) * (tier + 1),
      retweets: randInt(0, 15) * (tier + 1),
      gainedFollowers: 0,
    };
  });
}

/**
 * 작가 계약을 체결한다(제안 DM 수락 시 호출).
 * @param adult 성인물 계약 여부
 * @param penName 데뷔 필명. 빈 값이면 활성 계정명을 쓴다(검색 대상이 없어지지 않게).
 */
export function signAuthorContract(state: GameState, adult = false, penName = ""): void {
  state.authorContract = {
    signedDay: state.day,
    monthsWorked: 0,
    workload: 0,
    worksThisMonth: 0,
    missCount: 0,
    lastSettledMonth: monthKey(state.day),
    adult,
    penName: penName.trim() || getActiveAccount(state).name,
  };
  markJobExperienced(state, JOB_ID.author); // 직업 도감 해금(계약 해지해도 남는다)
  pushSchedule(state, adult ? "성인물 작가 계약 체결" : "작가 계약 체결", "system");
  pushSchedule(state, `작가 필명 결정: ${state.authorContract.penName}`, "system");
}

/* ─────────────────── 작가 계약 제안 DM ─────────────────── */

/** 창작 트윗 직후 작가 계약 제안 DM이 올 확률 */
export const AUTHOR_DM_CHANCE = 0.5;

const AUTHOR_DM_OPENERS = [
  "안녕하세요, 콘텐츠 플랫폼 담당자입니다. 올리신 창작 트윗들 정말 인상 깊게 봤어요! 정식 연재 작가로 계약하실 생각 없으세요? 매달 원고 작업량만 채워주시면 월급을 드려요 :)",
  "작가님 창작물 팬입니다! 저희 플랫폼과 정식 계약 어떠세요? 매월 월급 드리고, 대신 매달 정해진 작업량을 채워주시면 됩니다. 관심 있으시면 아래 버튼으로 계약해요!",
  "창작 트윗 반응이 심상치 않던데요? 저희랑 연재 계약하시죠! 매월 1일 월급 지급, 작업량 미달 시엔 아쉽게도 월급이 절반이 됩니다. 함께해요!",
];

/** 이 계정에 이미 작가 계약 제안 스레드가 있는지 */
function hasAuthorOffer(account: PlayerAccount): boolean {
  return account.dms.some((t) => t.authorOffer);
}

/**
 * 창작 트윗이 20개 이상 쌓였을 때, 창작 트윗 직후 확률적으로 작가 계약 제안 DM을 보낸다.
 * 이미 계약했거나, 이 계정에 제안 스레드가 있으면 보내지 않는다.
 * @returns 생성되면 true
 */
export function maybeSpawnAuthorDM(state: GameState): boolean {
  if (state.authorContract) return false;
  if (state.creationTweetCount < AUTHOR_CONTRACT_MIN_CREATIONS) return false;
  const account = getActiveAccount(state);
  if (hasAuthorOffer(account)) return false;
  if (!chance(AUTHOR_DM_CHANCE)) return false;

  account.dms.unshift({
    id: uid("dm"),
    partnerName: "코믹웨이브 콘텐츠팀",
    partnerHandle: "comicwave_official",
    attribute: "anime",
    isAdult: false,
    messages: [{ id: uid("dmm"), from: "partner", text: pick(AUTHOR_DM_OPENERS), day: state.day }],
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    authorOffer: true,
  });
  return true;
}

/** 제안 DM에서 작가 계약을 수락한다(담당자가 환영 메시지를 남긴다). adult=성인물 계약 여부. */
export function acceptAuthorContract(
  state: GameState,
  thread: DMThread,
  adult = false,
  penName = "",
): void {
  signAuthorContract(state, adult, penName);
  thread.messages.push({
    id: uid("dmm"),
    from: "partner",
    text:
      (adult
        ? "성인물 연재로 계약 감사합니다! 🔞 수위 높은 작품인 만큼 음란도도 작업 성과에 반영돼요. "
        : "계약 감사합니다! 🎉 ") +
      `필명은 '${state.authorContract!.penName}'(으)로 등록했어요. 독자 반응이 궁금하면 SNS에 필명을 검색해보세요! ` +
      "이번 달은 준비 기간이에요. 다음 달부터 '현생 살기 → 작업'으로 작업량을 채우시면, 그다음 달 1일에 첫 월급이 정산됩니다!",
    day: state.day,
  });
  thread.unread = true;
}

export interface AuthorWorkResult {
  gain: number;
  workload: number;
  target: number;
  done: boolean;
}

/** 작업 1회 — 작업량 게이지를 채운다(리소스/시간 소모는 호출부에서 처리). */
export function doAuthorWork(state: GameState): AuthorWorkResult | null {
  const c = state.authorContract;
  if (!c) return null;
  const gain = authorWorkGain(state);
  c.workload = Math.min(AUTHOR_WORKLOAD_TARGET, c.workload + gain);
  c.worksThisMonth += 1; // 지급액은 이 횟수에 비례한다(게이지는 계약 유지 판정용)
  return { gain, workload: c.workload, target: AUTHOR_WORKLOAD_TARGET, done: c.workload >= AUTHOR_WORKLOAD_TARGET };
}

/** 지금이 계약한 달(준비 기간)인지 — 이 달엔 작업량이 요구되지 않는다. */
export function isAuthorPrepMonth(state: GameState): boolean {
  const c = state.authorContract;
  return !!c && monthKey(state.day) === monthKey(c.signedDay);
}

/**
 * 매월 1일 월 정산(time.onNewDay에서 호출).
 * - 계약한 달(부분 달)은 준비 기간: 작업량 요구 없음.
 * - 익월 1일: 준비 기간 종료 → 작업량 게이지만 리셋하고 작업 시작(정산·월급 없음).
 * - 익월+1 1일부터: 직전 한 달 작업량을 평가해 월급 지급(달성=전액, 미달=50%+미달 누적).
 *   → 3월에 계약하면 4월이 첫 작업 달, 첫 월급은 5월 1일.
 * - 정산 후 작업량 게이지를 리셋한다.
 */
export function settleAuthorMonthly(state: GameState): void {
  const c: AuthorContract | null = state.authorContract;
  if (!c) return;
  if (dateOfMonth(state.day) !== 1) return;
  const mk = monthKey(state.day);
  if (c.lastSettledMonth === mk) return; // 이미 이번 달 정산함
  const signMk = monthKey(c.signedDay);
  if (mk <= signMk) return; // 계약한 달은 건너뛴다
  c.lastSettledMonth = mk;

  // 익월 1일: 준비 기간이 끝나고 첫 작업 달이 시작된다(게이지 리셋만, 월급 없음).
  if (mk === signMk + 1) {
    c.workload = 0;
    c.worksThisMonth = 0;
    return;
  }

  // 익월+1 1일 이후: 직전 한 달치를 정산한다.
  // ⚠️ 지급액은 **작업 횟수**가 정하고(authorWorkPay), 게이지(workload)는 계약 유지 판정만 한다.
  //    예전처럼 미달 반감을 또 걸면 "덜 그려서 적게 받는데 거기서 또 반감"인 이중 페널티가 된다.
  const met = c.workload >= AUTHOR_WORKLOAD_TARGET;
  c.monthsWorked += 1;
  const full = authorMonthlySalary(state, c.monthsWorked); // 인기 지표(편집자 코멘트용)
  const salary = authorWorkPay(state);
  state.money += salary;

  // 월급날, 담당 편집자가 이번 달 웹툰 인기(=원고료 액수 기준)와 입금 내역을 카톡으로 전한다.
  const popLine = authorPopularityLine(full);
  const editorMsgs = met
    ? [
        `작가님, ${c.monthsWorked}개월차 정산 나왔어요!`,
        popLine,
        `그래서 이번 달 원고료 ${won(salary)}원 입금해드렸어요. 다음 화도 잘 부탁드려요 :)`,
      ]
    : [
        "작가님, 이번 달 정산 안내예요.",
        popLine,
        `그린 만큼 ${won(salary)}원 나갔어요. 다만 이번 달 작업량이 목표에 못 미쳤네요. 다음 달엔 마감 꼭 지켜주세요! (미달 ${c.missCount + 1}/${AUTHOR_MAX_MISS})`,
      ];
  pushKakao(state, "담당 편집자", editorMsgs, {
    hue: 265,
    reply: {
      me: "네, 다음 달도 열심히 그릴게요!",
      them: "믿을게요 작가님 :) 좋은 작품 기대할게요!",
      label: "네, 열심히 할게요",
    },
  });

  if (met) {
    pushSchedule(
      state,
      `작가 월급 +${won(salary)}원 (${c.worksThisMonth}회 작업 · ${c.monthsWorked}개월차)`,
      "system",
    );
  } else {
    c.missCount += 1;
    pushSchedule(
      state,
      `작업량 미달 — +${won(salary)}원 (${c.worksThisMonth}회, 미달 ${c.missCount}/${AUTHOR_MAX_MISS})`,
      "system",
    );
    if (c.missCount >= AUTHOR_MAX_MISS) {
      state.authorContract = null;
      pushSchedule(state, "작업량 미달 3회 누적 — 작가 계약이 해지됐다", "system");
      return;
    }
  }
  c.workload = 0; // 새 달 작업량 리셋
  c.worksThisMonth = 0; // 지급 근거(작업 횟수)도 같이 리셋 — 안 하면 월급이 눈덩이처럼 불어난다
}
