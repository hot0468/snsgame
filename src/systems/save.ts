import type { GameState } from "@/core/types";
import {
  createInitialAuction,
  createInitialCheats,
  createInitialLab,
  createInitialState,
  LATE_SLOT,
  MORNING_SLOT,
  SLOTS_PER_DAY,
} from "@/core/state";
import { grantAttributeUnlockFloor } from "./attributeUnlock";
import { maxPostSlots } from "./followers";
import { getActiveAccount } from "@/core/state";
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
    // ★호환: 로그인 플래그도 위 둘과 **같은 함정**이라 parsed 원본에서 판정한다.
    //   merged.loggedIn은 createInitialState()의 false로 이미 덮여 있어 '부재'를 구분 못 하고,
    //   sanitize에서 `??= true`를 써봐야 절대 발동하지 않는 죽은 폴백이 된다.
    //   - OLD 세이브(키 부재) → true. 진행 중인 세이브는 이미 로그인을 마친 것으로 본다.
    //     false로 두면 기존 플레이어가 로그인 화면으로 쫓겨나 계정명을 덮어쓰게 된다.
    //   - NEW 세이브 명시 false → 보존. 로그인 화면에서 새로고침한 경우이므로 다시 로그인 화면.
    merged.loggedIn = typeof parsed.loggedIn === "boolean" ? parsed.loggedIn : true;
    // ★슬롯 마이그레이션: 하루 3슬롯(아침0/저녁1/심야2) → 2슬롯(낮0/심야1).
    //   구 세이브(version<3, 또는 slot이 구 범위)면 slot·appointment.slot을 새 인덱스로 remap한다.
    //   구 0 아침·1 저녁 → 0 낮, 구 2 심야 → 1 심야. 게이트는 반드시 parsed 원본으로 판정한다
    //   (merged.version은 키 부재 구세이브에서 createInitialState의 3으로 덮여 마이그레이션을 놓친다).
    //   신규 게임은 createInitialState 경로라 이 함수를 안 타므로 영향 없다.
    if ((parsed.version ?? 0) < 3 || (parsed.slot ?? 0) >= SLOTS_PER_DAY) {
      merged.slot = (parsed.slot ?? 0) >= 2 ? LATE_SLOT : MORNING_SLOT;
      for (const appt of merged.appointments ?? []) {
        appt.slot = appt.slot >= 2 ? LATE_SLOT : MORNING_SLOT;
        if (appt.ticketFor) {
          appt.ticketFor.slot = appt.ticketFor.slot >= 2 ? LATE_SLOT : MORNING_SLOT;
        }
      }
      merged.version = 3;
    }
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
    // 구세이브엔 postCount가 없다 — 현재 남은 타임라인 길이로 최소 보정(과거 잘린 분은 알 수 없으니 하한).
    acc.postCount ??= acc.timeline.length;
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
    acc.relationships ??= {};
    // 1일 트윗 카운트·게시 슬롯 소비를 전역(eggs)→계정별로 옮김. 구세이브엔 계정에 없으니 초기화.
    acc.dailyTweetDay ??= state.day;
    acc.dailyTweetCount ??= 0;
    acc.postSlotsDay ??= state.day;
    acc.postSlotsUsed ??= 0;
    // 트친(단짝): 구세이브엔 없으므로 초기화.
    if (!Array.isArray(acc.tchins)) acc.tchins = [];
    acc.tchinProgress ??= {};
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
  // 체력(가변 상한)은 신규 필드. staminaMax가 0/NaN이면 clampStamina가 체력을 영구히 0으로
  // 눌러 세이브까지 오염된다(actionMaxBonus NaN 선례와 동급 함정) — 반드시 유효한 양수로 보정.
  // NaN은 JSON에서 null로 직렬화돼 최상위 merge로 넘어오므로 ??보다 isFinite 검사가 안전하다.
  if (typeof state.staminaMax !== "number" || !Number.isFinite(state.staminaMax) || state.staminaMax <= 0) {
    state.staminaMax = 200;
  }
  if (typeof state.stamina !== "number" || !Number.isFinite(state.stamina)) {
    state.stamina = 200;
  }
  state.sickPending ??= false;
  // 신규 필드 보강(구버전 저장본 대비)
  if (!Array.isArray(state.kakao)) state.kakao = [];
  if (!Array.isArray(state.workMsgs)) state.workMsgs = [];
  if (!Array.isArray(state.appointments)) state.appointments = [];
  state.lastRentReminderDay ??= -1;
  state.crewJoined ??= false;
  state.rejectionTweets ??= 0;
  state.studyJoined ??= false;
  state.estheticMember ??= false;
  state.estheticScamDay ??= 0;
  state.privateCrewJoined ??= false;
  state.groupRoomJoined ??= false;
  state.savannaJoined ??= false;
  state.lingerieContract ??= false;
  state.lingerieOffered ??= false;
  state.animeTweetsPosted ??= 0;
  state.employment ??= null;
  // AV배우 직업은 신규 기능 — 구세이브엔 키가 없다(미계약·미제의가 정답).
  state.avJob ??= null;
  // 노콘 가산이 영구→월누적으로 바뀌며 필드명이 condomlessThisMonth로 교체됐다.
  // 구세이브(condomlessCount 또는 필드 부재)는 이번 달 0에서 다시 시작한다.
  if (state.avJob) state.avJob.condomlessThisMonth ??= 0;
  if (state.avJob) state.avJob.stdUntilDay ??= -1; // 성병 상태 신규 필드(구세이브는 건강)
  state.avOffered ??= false;
  state.niglShifts ??= 0;
  state.pendingJobApp ??= null;
  // 네이놈 대회는 신규 기능 — 구세이브엔 키가 없다(대기 없음이 정답).
  state.pendingContest ??= null;
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
  if (!Array.isArray(state.pendingGoods)) state.pendingGoods = [];
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
  // d스토리 해제 목록도 신규 필드 — 구세이브엔 키가 없다(아무것도 안 푼 상태가 정답).
  // 최상위 merge가 기본 []를 넣지만, 배열이 아닌 값이 들어올 여지를 여기서 막는다
  // (kakao/appointments와 같은 패턴). 배열이 아니면 includes/push가 즉시 터진다.
  if (!Array.isArray(state.dstoryUnlockedPosts)) state.dstoryUnlockedPosts = [];
  // hosts 편집 내용은 신규 필드 — 구세이브엔 키가 없다(미편집=null이 정답).
  // 문자열도 null도 아닌 손상값이면 null로 되돌린다(미편집 취급).
  if (state.hostsFile !== null && typeof state.hostsFile !== "string") state.hostsFile = null;
  // 취중 트윗/이불킥 상태는 신규 필드 — 구세이브엔 없다(미취중이 정답).
  state.drunkPending ??= false;
  state.pendingRegretTweetId ??= null;
  state.adultTweetsPosted ??= 0;
  state.punishTweetsPosted ??= 0;
  if (!Array.isArray(state.yabamProductsOwned)) state.yabamProductsOwned = [];
  if (!Array.isArray(state.seenWorks)) state.seenWorks = [];
  state.creationTweetCount ??= 0;
  state.authorContract ??= null;
  if (state.authorContract) state.authorContract.adult ??= false; // 구세이브: 성인 계약 필드 보강
  state.housingTier ??= 0;
  state.lotto ??= null;
  state.fireDeclined ??= false;
  if (!Array.isArray(state.endingsDeclined)) state.endingsDeclined = [];
  if (!Array.isArray(state.seasonalFired)) state.seasonalFired = [];
  if (!Array.isArray(state.seenMeetings)) state.seenMeetings = [];
  state.postedAdultEver ??= false;
  state.dawnPending ??= false;
  state.bossJokeDay ??= -1;
  // 회복 표시 필드는 신규 — 최상위 merge가 구세이브(키 부재)엔 기본 객체를 넣지만,
  // 손상된 non-object가 저장돼 있으면 dawnModal이 .action/.mental에서 터진다(pets와 같은 방어).
  // onNewDay가 매일 덮으므로 값 정확도보단 shape만 보장하면 된다.
  if (
    !state.lastRestGain ||
    typeof state.lastRestGain !== "object" ||
    !Number.isFinite(state.lastRestGain.action) ||
    !Number.isFinite(state.lastRestGain.mental)
  ) {
    state.lastRestGain = { action: 0, mental: 0 };
  }
  state.sleepPending ??= false;
  state.catPowerPending ??= false;
  // 게시 슬롯 증가 감지 필드는 신규.
  // ⚠️ lastMaxPostSlots는 초기값 1로 폴백하면 안 된다 — 이미 팔로워 많은 구세이브가 로드 직후
  //    다음 changeFollowers에서 "슬롯 늘었어요" 오알림을 띄운다. 현 활성 계정 팔로워 기준으로 폴백한다.
  if (typeof state.lastMaxPostSlots !== "number" || !Number.isFinite(state.lastMaxPostSlots)) {
    state.lastMaxPostSlots = maxPostSlots(getActiveAccount(state).followers);
  }
  state.postSlotIncreasedTo ??= null;
  state.pendingNews ??= null;
  if (!Array.isArray(state.pendingTchinToasts)) state.pendingTchinToasts = [];
  // 특수 트윗(오하아사·괴담) 신규 필드. NaN은 ??를 통과하므로 숫자는 isFinite로 검사한다.
  if (typeof state.lotteryLuck !== "number" || !Number.isFinite(state.lotteryLuck)) {
    state.lotteryLuck = 0;
  }
  state.hauntPending ??= false;
  state.hauntVisitNow ??= false;
  state.adultNoCoercion ??= false;
  // 반려동물 보유 상태 보강(구버전 저장본 대비)
  state.pets ??= { dog: false, cat: false };
  state.pets.dog ??= false;
  state.pets.cat ??= false;
  // 크리처 도감은 신규 필드 — 구세이브엔 키가 없다(빈 도감이 정답).
  if (!Array.isArray(state.creatures)) state.creatures = [];
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
  // 도전과제는 신규 필드 — 구세이브엔 키가 없다(미달성·알림없음이 정답).
  if (!Array.isArray(state.achievements)) state.achievements = [];
  if (!Array.isArray(state.pendingAchievements)) state.pendingAchievements = [];
  return state;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
