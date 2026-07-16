import type { GameState } from "@/core/types";
import { createInitialState } from "@/core/state";
import { initialMarket } from "@/data/market";

// 다계정 구조로 바뀌며 v2로 올림(구 v1 저장본은 무시하고 새로 시작).
const SAVE_KEY = "snsgame:save:v2";

/** 현재 상태를 localStorage에 저장 */
export function saveGame(state: GameState): boolean {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    console.error("저장 실패", e);
    return false;
  }
}

/** 저장된 게임이 있는지 */
export function hasSave(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

/**
 * 저장된 상태를 불러온다.
 * 저장본이 없거나 손상되면 null 반환.
 * 스키마가 바뀌어도 최소한 필수 필드는 초기값으로 메꿔 로드되게 병합한다.
 */
export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<GameState>;
    const merged = { ...createInitialState(), ...parsed } as GameState;
    // ★호환: 앱 탭 해금 플래그는 '부재/명시'를 반드시 parsed 원본에서 판정한다.
    //   merged는 createInitialState()의 false로 덮여 있어 부재를 구분 못 한다(죽은 폴백 방지).
    //   - OLD 세이브(키 부재) → true(기존처럼 탭 유지)
    //   - NEW 세이브 명시 false/true → 그 값 보존
    //   새 게임은 createInitialState 경로라 loadGame과 무관(탭 없음 유지).
    merged.youtubeUnlocked = parsed.youtubeUnlocked ?? true;
    merged.medibooksUnlocked = parsed.medibooksUnlocked ?? true;
    return sanitize(merged);
  } catch (e) {
    console.error("불러오기 실패", e);
    return null;
  }
}

/** 로드된 상태의 필수 불변식을 보정한다. */
function sanitize(state: GameState): GameState {
  if (!Array.isArray(state.accounts) || state.accounts.length === 0) {
    return createInitialState();
  }
  // 각 계정의 신규 필드 보강(구버전 저장본 대비)
  for (const acc of state.accounts) {
    acc.timeline ??= [];
    acc.unlockedAttributes ??= ["daily"];
    acc.dms ??= [];
    acc.adultMode ??= false;
    acc.groupUnlocked ??= false;
    if (!Array.isArray(acc.unlockedAdultKinds)) acc.unlockedAdultKinds = ["sekt"];
    acc.lastTweetDay ??= state.day;
    acc.followingAccounts ??= [];
    acc.strikes ??= 0;
    acc.suspendedUntilDay ??= 0;
    for (const thread of acc.dms) {
      thread.metOffline ??= false;
      thread.wantsToMeet ??= false;
    }
  }
  // 활성 계정 id가 유효하지 않으면 첫 계정으로
  if (!state.accounts.some((a) => a.id === state.activeAccountId)) {
    state.activeAccountId = state.accounts[0].id;
  }
  // 신규 스킬/리소스 키가 빠진 구버전 저장본 보강(예: creativity, reputation)
  const fresh = createInitialState();
  state.skills = { ...fresh.skills, ...state.skills };
  state.resources = { ...fresh.resources, ...state.resources };
  state.daily = { ...fresh.daily, ...state.daily };
  // 신규 필드 보강(구버전 저장본 대비)
  if (!Array.isArray(state.kakao)) state.kakao = [];
  if (!Array.isArray(state.appointments)) state.appointments = [];
  state.lastRentReminderDay ??= -1;
  state.crewJoined ??= false;
  state.savannaJoined ??= false;
  state.employment ??= null;
  state.pendingJobApp ??= null;
  if (!Array.isArray(state.emails)) state.emails = [];
  state.loan ??= null;
  state.loanOffered ??= false;
  state.unpaidRentStreak ??= 0;
  state.overdueRent ??= 0;
  state.lastIncomeSettleMonth ??= -1;
  state.lastJobBoardDay ??= -1;
  state.pendingControversy ??= null;
  if (!Array.isArray(state.ownedItems)) state.ownedItems = [];
  state.goblinShopMonth ??= null;
  state.pushtimeUnlocked ??= false;
  state.yabamUnlocked ??= false;
  // youtubeUnlocked/medibooksUnlocked는 loadGame에서 parsed 원본 기준으로 결정한다
  // (merged가 createInitialState()의 false로 덮여 부재를 구분 못 하므로 여기선 손대지 않는다).
  // '증기'는 신규 기능이라 구세이브도 잠금(false)이 정답 — youtube/medibooks의 ??true 호환과 반대다.
  // merged가 이미 createInitialState()의 false로 덮여 있으므로 ??= false는 그 잠금 상태를 유지한다.
  state.steamUnlocked ??= false;
  if (!Array.isArray(state.ownedGames)) state.ownedGames = [];
  if (!Array.isArray(state.reviewedGames)) state.reviewedGames = [];
  if (!Array.isArray(state.adTweets)) state.adTweets = [];
  state.adultTweetsPosted ??= 0;
  if (!Array.isArray(state.yabamProductsOwned)) state.yabamProductsOwned = [];
  if (!Array.isArray(state.seenWorks)) state.seenWorks = [];
  state.creationTweetCount ??= 0;
  state.authorContract ??= null;
  state.housingTier ??= 0;
  state.lotto ??= null;
  state.fireDeclined ??= false;
  if (!Array.isArray(state.endingsDeclined)) state.endingsDeclined = [];
  if (!Array.isArray(state.seasonalFired)) state.seasonalFired = [];
  state.postedAdultEver ??= false;
  state.dawnPending ??= false;
  state.catPowerPending ??= false;
  // 반려동물 보유 상태 보강(구버전 저장본 대비)
  state.pets ??= { dog: false, cat: false };
  state.pets.dog ??= false;
  state.pets.cat ??= false;
  // 이스터에그 추적 상태 보강(구버전 저장본 대비)
  const freshEggs = fresh.eggs;
  state.eggs = { ...freshEggs, ...(state.eggs ?? {}) };
  state.eggs.authorEngage ??= {};
  state.eggs.adDays ??= [];
  state.eggs.done ??= {};
  if (!state.market || typeof state.market !== "object") {
    state.market = initialMarket();
  } else {
    // 자산 목록이 바뀌었을 수 있으니 빠진 키를 초기값으로 메꾼다
    const base = initialMarket();
    state.market.prices = { ...base.prices, ...state.market.prices };
    state.market.prevPrices = { ...base.prevPrices, ...state.market.prevPrices };
    state.market.holdings = { ...base.holdings, ...state.market.holdings };
  }
  state.gameOver ??= null;
  return state;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
