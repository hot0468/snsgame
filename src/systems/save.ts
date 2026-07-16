import type { GameState } from "@/core/types";
import {
  createInitialAuction,
  createInitialCheats,
  createInitialLab,
  createInitialState,
} from "@/core/state";
import { grantAttributeUnlockFloor } from "./attributeUnlock";
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
    // ★호환: adultMode가 계정별이었다(구버전). 전역으로 옮기며 '하나라도 켜져 있었으면 전역 ON'으로 승격한다.
    //   위 youtubeUnlocked와 같은 이유로 반드시 parsed 원본에서 판정한다 —
    //   merged.adultMode는 createInitialState()의 false로 이미 덮여 있어 '부재'를 구분 못 한다.
    merged.adultMode =
      typeof parsed.adultMode === "boolean"
        ? parsed.adultMode
        : (parsed.accounts ?? []).some(
            (a) => (a as { adultMode?: boolean } | null)?.adultMode === true,
          );
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
    // 전역화 후 계정에 남은 잔재 필드 제거(있어도 무해하지만 타입과 어긋난다).
    // 승격 판정은 loadGame에서 parsed 기준으로 이미 끝났다.
    delete (acc as { adultMode?: boolean }).adultMode;
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
  // 행동력 상한 보너스·치트는 신규 필드 — 구세이브엔 키가 없다(치트 미사용 상태로 시작).
  // ⚠️ actionMaxBonus는 숫자를 보장해야 한다: undefined/NaN이면 actionMax가 NaN이 되고,
  //    그 NaN이 clampAction을 타고 resources.action에 저장돼 세이브까지 오염된다(복구 불가).
  if (typeof state.actionMaxBonus !== "number" || !Number.isFinite(state.actionMaxBonus)) {
    state.actionMaxBonus = 0;
  }
  state.cheats = { ...createInitialCheats(), ...(state.cheats ?? {}) };
  // 신규 필드 보강(구버전 저장본 대비)
  if (!Array.isArray(state.kakao)) state.kakao = [];
  if (!Array.isArray(state.appointments)) state.appointments = [];
  state.lastRentReminderDay ??= -1;
  state.crewJoined ??= false;
  state.savannaJoined ??= false;
  state.employment ??= null;
  state.pendingJobApp ??= null;
  // 자격증은 신규 기능이라 구세이브엔 키 자체가 없다 — 미취득/대기 없음으로 시작.
  if (!Array.isArray(state.certifications)) state.certifications = [];
  state.pendingExam ??= null;
  // 특별 시행 대기 슬롯은 신규 필드 — 구세이브엔 키가 없다.
  state.pendingSpecialExam ??= null;
  // 'game' 스킬은 이번에 신설됐다 — 모든 구세이브가 game=0으로 로드된다. 그중 이미 gaming이
  // 해금된 세이브는 기준선(attributeUnlock.GAME_UNLOCK_FLOOR)이 없던 시절에 열린 것이라,
  // gaming.relatedSkills의 3항 평균 때문에 게임계 트윗이 영구히 약해진 구간에 갇힌다.
  //
  // ⚠️ 죽은 폴백이 아니다 — 아래 조건은 실제 구세이브에서 반드시 참이 되고, 스스로 회복할
  //    수단도 없다: 구매 상승분은 '게임당 1회'라 이미 산 게임에서 소급 획득이 불가능하다
  //    (전 종을 사둔 세이브는 game을 올릴 길이 아예 없다).
  // 판정 근거: game은 어떤 경로로도 감소하지 않고, 신규 코드는 6개 해금 경로 전부에서
  //    해금 시 기준선을 보장한다. 따라서 (gaming 해금 && game === 0)은 '기준선 이전 세이브'를
  //    정확히·모호함 없이 가리킨다. 신규 게임은 createInitialState 경로라 여기 오지 않는다.
  if (
    state.skills.game === 0 &&
    state.accounts.some((a) => a.unlockedAttributes?.includes("gaming"))
  ) {
    grantAttributeUnlockFloor(state, "gaming");
  }
  // 서던피스 경매도 신규 기능 — 구세이브엔 키가 없다. 미진행 상태로 채운다.
  // 필드별로도 보정한다(중간 버전 세이브에 일부 키만 있을 수 있다).
  state.auction = { ...createInitialAuction(), ...(state.auction ?? {}) };
  if (!Array.isArray(state.auction.bought)) state.auction.bought = [];
  // 터커 연구실도 신규 기능이라 구세이브엔 lab 키가 아예 없다. 그 경우는 loadGame의 최상위
  // merge(createInitialState 기반)가 이미 기본 객체를 넣어주므로, 여기서 하는 일은
  // **필드 단위 보정**이다 — 키 일부만 있는 중간 버전 세이브를 메꾼다(auction과 같은 이유).
  // ⚠️ `?? {}`를 붙이지 않은 건 죽은 폴백이기 때문이다: lab은 위 merge로 항상 객체이고,
  //    우리는 lab에 null을 저장하는 경로가 없다(auction의 `?? {}`는 그 시절 관성이다).
  //    설령 undefined여도 스프레드는 {}로 동작해 결과가 같다.
  state.lab = { ...createInitialLab(), ...state.lab };
  if (!Array.isArray(state.emails)) state.emails = [];
  state.loan ??= null;
  state.loanOffered ??= false;
  state.loanDefaultStreak ??= 0;
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
  // '다트 핀'은 신규 기능이라 구세이브엔 키가 없다 — 미발견(false)이 정답이다.
  // youtube/medibooks의 `?? true` 호환과 반대인 이유는 steamUnlocked와 같다: 그 둘은
  // '이미 탭이 있던' 세이브의 탭을 뺏지 않으려는 보정이고, 다트 핀은 존재한 적이 없다.
  // merged가 이미 createInitialState()의 false로 덮여 있으므로 ??= false는 그 상태를 유지한다.
  state.dartpinUnlocked ??= false;
  // 게시판 스냅샷도 신규 필드. 구세이브는 null이고, ensureDartpinBoard가 방문 시 채운다.
  // 손상된 스냅샷(postIds가 배열이 아님)은 null로 되돌려 재편성시킨다 — getDartpinBoard가
  // `?? []`로 넘겨 빈 게시판이 되는 걸 막는다.
  if (!state.dartpinBoard || !Array.isArray(state.dartpinBoard.postIds)) {
    state.dartpinBoard = null;
  }
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
