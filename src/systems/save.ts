import type { GameState, MlmJob } from "@/core/types";
import {
  createInitialAuction,
  createInitialCheats,
  createInitialLab,
  createInitialState,
  getActiveAccount,
  LATE_SLOT,
  MORNING_SLOT,
  SLOTS_PER_DAY,
} from "@/core/state";
import { scheduleNextPrivateClub } from "./appointments";
import { grantAttributeUnlockFloor, syncUnlockedAttributes } from "./attributeUnlock";
import { backfillClaimedMilestones } from "./milestones";
import { ensureMissions } from "./missions";
import { currentMaxPostSlots } from "./followers";
import { PART_TIME_LEGACY_ID } from "./offline";
import { initialMarket } from "@/data/market";
import { TAXI_RATING_START } from "@/data/taxi";

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

/** 세이브를 로컬 JSON 파일로 내려받는다(브라우저 다운로드 폴더). */
export function exportSaveFile(state: GameState): void {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(state)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `snsgame-day${state.day}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * JSON 파일을 골라 세이브로 되돌린다. 취소·손상 시 null.
 * 파싱·마이그레이션은 loadGame에 그대로 위임한다(경로 이중화 금지).
 */
export async function importSaveFile(): Promise<GameState | null> {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "application/json,.json";
  const file = await new Promise<File | null>((resolve) => {
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.oncancel = () => resolve(null);
    input.click();
  });
  if (!file) return null;
  const state = loadGame(await file.text());
  if (state) saveGame(state);
  return state;
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
export function loadGame(raw: string | null = localStorage.getItem(SAVE_KEY)): GameState | null {
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
    return sanitize(merged, parsed);
  } catch (e) {
    console.error("불러오기 실패", e);
    return null;
  }
}

/**
 * 로드된 상태의 필수 불변식을 보정한다.
 *
 * @param state  createInitialState()와 병합된 상태(키 부재를 판정할 수 없다 — 초기값으로 이미 덮여 있다).
 * @param parsed 세이브 원본. **'키가 없던 구세이브'는 반드시 이쪽으로 판정한다** —
 *               loadGame의 youtubeUnlocked·adultMode·loggedIn과 같은 이유다(죽은 폴백 방지).
 */
function sanitize(state: GameState, parsed: Partial<GameState> = state): GameState {
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
    // 1일 트윗 카운트는 계정별. (게시 슬롯 예산은 전 계정 공유로 이관 → 계정 잔재 필드는 제거.)
    acc.dailyTweetDay ??= state.day;
    acc.dailyTweetCount ??= 0;
    delete (acc as { postSlotsDay?: number }).postSlotsDay;
    delete (acc as { postSlotsUsed?: number }).postSlotsUsed;
    // 트친(단짝): 구세이브엔 없으므로 초기화.
    if (!Array.isArray(acc.tchins)) acc.tchins = [];
    if (typeof acc.tchinNames !== "object" || acc.tchinNames === null) acc.tchinNames = {};
    acc.tchinProgress ??= {};
    acc.lastTchinsoDay ??= 0;
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
  // 정신력 상한 보너스도 같은 함정 — NaN이면 mentalMax가 NaN이 되고 정신력이 통째로 오염된다.
  if (typeof state.mentalMaxBonus !== "number" || !Number.isFinite(state.mentalMaxBonus)) {
    state.mentalMaxBonus = 0;
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
  // 야근 연속·굶주림은 신규 필드 — 구세이브엔 키가 없다(0에서 시작하는 게 정답).
  state.overtimeToday ??= false;
  state.overtimeStreak ??= 0;
  state.hungerStreak ??= 0;
  migratePartTimeCounts(state, parsed);
  // 신규 필드 보강(구버전 저장본 대비)
  if (!Array.isArray(state.kakao)) state.kakao = [];
  if (!Array.isArray(state.workMsgs)) state.workMsgs = [];
  if (!Array.isArray(state.appointments)) state.appointments = [];
  // 코믹콘은 낮 행사로 바뀌었다 — 구세이브에 심야로 잡힌 코믹콘 약속을 낮 슬롯으로 옮긴다.
  for (const appt of state.appointments) {
    if (appt.variant === "comiccon" && appt.slot !== MORNING_SLOT) appt.slot = MORNING_SLOT;
  }
  if (!Array.isArray(state.pastEmployers)) state.pastEmployers = [];
  if (!Array.isArray(state.jobplanetViewed)) state.jobplanetViewed = [];
  if (!Array.isArray(state.bookmarks)) state.bookmarks = [];
  if (typeof state.jobplanetCredits !== "number" || !Number.isFinite(state.jobplanetCredits)) {
    state.jobplanetCredits = 0;
  }
  state.lastRentReminderDay ??= -1;
  state.crewJoined ??= false;
  if (typeof state.crewRunCount !== "number" || !Number.isFinite(state.crewRunCount)) {
    state.crewRunCount = 0;
  }
  if (typeof state.groupNightCount !== "number" || !Number.isFinite(state.groupNightCount)) {
    state.groupNightCount = 0;
  }
  state.rejectionTweets ??= 0;
  state.studyJoined ??= false;
  state.estheticMember ??= false;
  state.estheticScamDay ??= 0;
  state.privateCrewJoined ??= false;
  // 클럽 세션은 예전엔 러닝 정기런 자리에서 돌아 전용 일정이 없었다. 그때 가입한 세이브는
  // 지금 코드에선 모임이 영영 안 열리므로(가입 시점에만 일정을 잡는다) 여기서 되살린다.
  // ⚠️ 신규 가입은 joinPrivateCrew가 잡는다 — 여긴 **구세이브 백필 전용**이다.
  if (state.privateCrewJoined && !state.appointments.some((a) => a.kind === "privateClub")) {
    scheduleNextPrivateClub(state);
  }
  state.groupRoomJoined ??= false;
  state.savannaJoined ??= false;
  state.lingerieContract ??= false;
  state.lingerieOffered ??= false;
  state.animeTweetsPosted ??= 0;
  // 갈래 숙련은 신규 기능 — 구세이브엔 키가 없다(전 갈래 0에서 시작이 정답).
  state.tweetMastery ??= {};
  state.lastCosplayDay ??= 0;
  state.employment ??= null;
  // AV배우 직업은 신규 기능 — 구세이브엔 키가 없다(미계약·미제의가 정답).
  state.avJob ??= null;
  // 킬러 직업(momo.com)도 신규 필드 — 구세이브엔 미취직·미제의가 정답.
  state.killerJob ??= null;
  // 배정 트윗은 신규 필드 — 구세이브의 진행 중 임무엔 없을 수 있다(빈 배열로 보정, 다음 배정부터 채워짐).
  if (state.killerJob?.assignment && !Array.isArray(state.killerJob.assignment.tweets)) {
    state.killerJob.assignment.tweets = [];
  }
  if (typeof state.momoOfferedDay !== "number") state.momoOfferedDay = -1;
  // 요리 도감·마라톤·바디프로필은 신규 필드 — 구세이브엔 키가 없다(빈 도감·미신청·미도전이 정답).
  if (!Array.isArray(state.cookedDishes)) state.cookedDishes = [];
  state.pendingRace ??= null;
  if (!state.raceBests || typeof state.raceBests !== "object") state.raceBests = {};
  state.bodyProfile ??= null;
  state.chilnamAlly ??= false;
  state.chilnamOffered ??= false;
  state.pendingProphecy ??= false;
  if (state.pendingProphecyText === undefined) state.pendingProphecyText = null;
  // 노콘 가산이 영구→월누적으로 바뀌며 필드명이 condomlessThisMonth로 교체됐다.
  // 구세이브(condomlessCount 또는 필드 부재)는 이번 달 0에서 다시 시작한다.
  if (state.avJob) state.avJob.condomlessThisMonth ??= 0;
  if (state.avJob) state.avJob.stdUntilDay ??= -1; // 성병 상태 신규 필드(구세이브는 건강)
  // 누적 근무일은 직업 레벨이 생기며 추가됐다. 구세이브엔 과거 근무 이력이 없으므로
  // 이번 달 근무일로 시작한다(0으로 두면 오래 뛴 플레이어의 레벨이 통째로 날아간다).
  if (state.avJob) state.avJob.totalWorkDays ??= state.avJob.workDaysThisMonth ?? 0;
  state.avOffered ??= false;
  // 강사직은 신규 기능 — 구세이브엔 키가 없다(미채용이 정답).
  state.lecturerJob ??= null;
  state.niglShifts ??= 0;
  state.pendingJobApp ??= null;
  // 강사 지원 대기는 신규 기능 — 구세이브엔 키가 없다(대기 없음이 정답).
  state.pendingLecturerApp ??= null;
  // 배구부 코치직도 신규 — 구세이브엔 미부임·미제의가 정답.
  state.coachJob ??= null;
  // 시즌 진행도가 훈련 횟수에서 완성도 게이지로 바뀌었다 — 옛 값은 버리고 0에서 다시 쌓는다.
  if (state.coachJob) state.coachJob.teamStat ??= 0;
  // 합숙·졸업생 모임 기록은 신규 — 구세이브는 '아직 안 겪음'(-1)에서 시작한다.
  if (state.coachJob) {
    state.coachJob.campYear ??= -1;
    state.coachJob.lastMeetYear ??= -1;
    state.coachJob.alumniYear ??= -1;
    state.coachJob.nationalPartyYear ??= -1;
  }
  state.coachOffered ??= false;
  // 택시·콜센터도 신규 — 구세이브엔 미취업이 정답.
  state.taxiJob ??= null;
  state.callCenterJob ??= null;
  // 보험설계사 → 다단계 사업자로 갈아치웠다. 필드 shape이 같아 진행도를 그대로 옮긴다
  // (회사·문구만 바뀌었을 뿐 '지인을 태워 파는' 축은 동일하다).
  const legacy = (state as unknown as { insuranceJob?: MlmJob | null }).insuranceJob;
  if (legacy && !state.mlmJob) state.mlmJob = legacy;
  delete (state as unknown as { insuranceJob?: MlmJob | null }).insuranceJob;
  state.mlmJob ??= null;
  state.stylistJob ??= null;
  // 경력 공백은 신규 — 구세이브는 공백 없이(0) 시작한다. NaN이 들어오면 지원이 영영 막힌다.
  if (!Number.isFinite(state.jobGapUntilDay)) state.jobGapUntilDay = 0;
  if (!Number.isFinite(state.quitCount)) state.quitCount = 0;
  // 100만 달성 유예도 신규. 구세이브는 도달 즉시 gameOver로 끝났으므로 진행 중 세이브엔 미달성이 정답이다.
  state.winReached ??= false;
  state.winOfferDeclined ??= false;
  // 태운 지인 목록이 배열이 아니면 knownContacts의 includes가 터진다.
  if (state.mlmJob && !Array.isArray(state.mlmJob.burnedContacts)) {
    state.mlmJob.burnedContacts = [];
  }
  // 평점은 요금 단가에 곱해진다 — undefined/NaN이면 요금이 통째로 NaN이 되어 소지금을 오염시킨다.
  if (state.taxiJob && !Number.isFinite(state.taxiJob.rating)) {
    state.taxiJob.rating = TAXI_RATING_START;
  }
  // 직업 도감(해본 직업)은 신규 필드. 구세이브는 '지금 상태'에서 역산해 채운다 —
  // 빈 배열로 두면 이미 회사를 다니는 플레이어의 도감이 통째로 잠긴 채 시작한다.
  if (!Array.isArray(state.jobsExperienced)) {
    state.jobsExperienced = [];
    if (state.employment || (state.pastEmployers?.length ?? 0) > 0) state.jobsExperienced.push("office");
    if (state.lecturerJob) state.jobsExperienced.push("lecturer");
    if (state.avJob) state.jobsExperienced.push("av");
    if (state.authorContract) state.jobsExperienced.push("author");
    if (state.killerJob) state.jobsExperienced.push("killer");
    if (state.coachJob) state.jobsExperienced.push("coach");
  }
  // ★직군(JobPosting.track) 폴백은 **일부러 두지 않았다** — 죽은 코드가 되기 때문이다.
  //   JobPosting은 세이브에 들어가지 않는다: 공고는 채용공고 모달을 열 때 makeJobPostings로
  //   그때그때 생성돼 메모리에만 살고, 세이브로 넘어가는 건 company/tier/role뿐인
  //   pendingJobApp·email.jobOffer·employment 셋이다(전부 track 무관 — tier가 급여·야근·적발률을
  //   전부 결정한다). 합격 여부(hired)도 지원 시점에 확정돼 저장되므로 결과 통보 단계에서
  //   트랙을 다시 볼 일이 없다. 게다가 JobPosting.track은 선택 필드라 부재 시
  //   employment.DEFAULT_JOB_TRACK("office")로 해석된다 — 구 동작과 동일.
  //   ⚠️ 훗날 JobApplication/Employment에 track을 **저장**하게 되면 그때는 폴백이 필요하다.
  //      그 경우 반드시 loadGame의 parsed 원본에서 키 부재를 판정하라(merged는 초기값으로
  //      덮여 있어 부재를 구분 못 한다 — 위 youtubeUnlocked 주석 참고).
  // 네이놈 대회는 신규 기능 — 구세이브엔 키가 없다(대기 없음이 정답).
  state.pendingContest ??= null;
  // 대회 쿨다운은 신규 — 구세이브는 기록이 없으니 전부 신청 가능에서 시작한다.
  if (!state.contestAppliedDays || typeof state.contestAppliedDays !== "object") {
    state.contestAppliedDays = {};
  }
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
  state.pendingJobAdult ??= null;
  if (!Array.isArray(state.yabamProductsOwned)) state.yabamProductsOwned = [];
  if (!Array.isArray(state.seenWorks)) state.seenWorks = [];
  state.creationTweetCount ??= 0;
  state.authorContract ??= null;
  if (state.authorContract) {
    state.authorContract.adult ??= false; // 구세이브: 성인 계약 필드 보강
    // 원고료가 '개월수 고정'에서 '이번 달 작업 횟수 비례'로 바뀌며 추가된 필드.
    // 구세이브는 이번 달 실적을 알 수 없으니 0에서 시작한다(다음 정산부터 정상 반영).
    state.authorContract.worksThisMonth ??= 0;
    // 필명은 신규 필드다. 없으면 검색 대상이 사라져 기능 자체가 죽으므로 계정명으로 채운다.
    if (!state.authorContract.penName) {
      // ⚠️ accounts는 배열이라 activeAccountId(문자열)로 인덱싱하면 안 된다 — 셀렉터를 쓴다.
      state.authorContract.penName = getActiveAccount(state)?.name ?? "작가";
    }
  }
  state.housingTier ??= 0;
  state.lotto ??= null;
  state.fireDeclined ??= false;
  if (!Array.isArray(state.endingsDeclined)) state.endingsDeclined = [];
  if (!Array.isArray(state.seasonalFired)) state.seasonalFired = [];
  if (!Array.isArray(state.seenMeetings)) state.seenMeetings = [];
  state.postedAdultEver ??= false;
  state.dawnPending ??= false;
  state.bossJokeDay ??= -1;
  state.ebsFreeWatchedDay ??= -1;
  state.lastWorkTweetDay ??= -1;
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
  // 게시 슬롯 예산은 전 계정 공유(전역) — 구세이브엔 전역 필드가 없으니 초기화.
  state.postSlotsDay ??= state.day;
  if (typeof state.postSlotsUsed !== "number" || !Number.isFinite(state.postSlotsUsed)) {
    state.postSlotsUsed = 0;
  }
  // 해금 카테고리는 전 계정 공유 — 구세이브의 계정별 차이를 합집합으로 통일한다.
  syncUnlockedAttributes(state);
  // 게시 슬롯 증가 감지 필드는 신규.
  // ⚠️ lastMaxPostSlots는 초기값 1로 폴백하면 안 된다 — 이미 팔로워 많은 구세이브가 로드 직후
  //    다음 changeFollowers에서 "슬롯 늘었어요" 오알림을 띄운다. 전 계정 팔로워 합계 기준으로 폴백한다.
  if (typeof state.lastMaxPostSlots !== "number" || !Number.isFinite(state.lastMaxPostSlots)) {
    state.lastMaxPostSlots = currentMaxPostSlots(state);
  }
  state.postSlotIncreasedTo ??= null;
  state.pendingNews ??= null;
  state.pendingBirthday ??= null;
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
  // 산책 장소도 신규 필드 — 구세이브엔 키가 없다(아무것도 발견 안 한 상태가 정답).
  if (!Array.isArray(state.walkPlaces)) state.walkPlaces = [];
  state.streamCount ??= 0;
  if (!state.streamBests || typeof state.streamBests !== "object") state.streamBests = {};
  if (!state.streamNames || typeof state.streamNames !== "object") state.streamNames = {};
  // 인형 도감·재고도 같은 취급(구세이브엔 키가 없다).
  if (!Array.isArray(state.dolls)) state.dolls = [];
  if (!state.dollStock || typeof state.dollStock !== "object") state.dollStock = {};
  // 농구 최고 기록도 신규 필드. NaN이 들어가면 신기록 판정이 영구히 깨지므로 유한수를 보장한다.
  if (typeof state.hoopBest !== "number" || !Number.isFinite(state.hoopBest)) state.hoopBest = 0;
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
    // 매수 원가(cost)는 신규 필드다. 구세이브엔 없어서 손익을 계산할 근거가 아예 없으므로
    // '지금 산 셈'(현재가 × 보유량)으로 채운다 — 없는 과거를 지어내지 않고 손익 0에서 다시 시작.
    const prevCost = state.market.cost ?? {};
    state.market.cost = { ...base.cost };
    for (const id of Object.keys(state.market.holdings)) {
      const held = state.market.holdings[id] ?? 0;
      state.market.cost[id] =
        prevCost[id] ?? (held > 0 ? held * (state.market.prices[id] ?? 0) : 0);
    }
  }
  state.gameOver ??= null;
  // 도전과제는 신규 필드 — 구세이브엔 키가 없다(미달성·알림없음이 정답).
  if (!Array.isArray(state.achievements)) state.achievements = [];
  if (!Array.isArray(state.pendingAchievements)) state.pendingAchievements = [];
  // 마일스톤은 신규 필드. statMilestones 키가 없으면 구세이브 → 현재 스킬 기준으로
  // 칭호만 소급(claimed 백필)하고 일회성·퍼크는 지급하지 않는다(소급 보상 방지).
  //
  // ⚠️ 판정은 반드시 **parsed 원본**으로 한다. merged.statMilestones는 createInitialState()의
  //    []로 이미 덮여 있어 `!Array.isArray(state.…)`가 절대 참이 되지 않는다(죽은 폴백).
  //    이 게이트가 죽으면 백필이 안 돌고, 구세이브 플레이어는 다음 onNewDay의
  //    checkStatMilestones에서 밀린 마일스톤을 **전부 신규 달성으로** 받는다 —
  //    스킬 650 세이브 기준 소급 550만원·팔로워 11만·행동력 상한 +33·토스트 33개.
  if (!Array.isArray(parsed.statMilestones)) {
    state.statMilestones = [];
    backfillClaimedMilestones(state);
  }
  if (!Array.isArray(state.pendingMilestones)) state.pendingMilestones = [];
  // 도전과제(미션)는 신규 필드. 없으면 빈 세트로 두고 ensureMissions가 현재 날짜 기준으로 굴린다.
  if (!state.missions || !Array.isArray(state.missions.daily)) {
    state.missions = { day: -1, week: -1, daily: [], weekly: [] };
  }
  if (!Array.isArray(state.pendingMissions)) state.pendingMissions = [];
  ensureMissions(state);
  return state;
}

/**
 * ★마이그레이션: 아르바이트 누적이 `partTimeCount: number`(전체 합산 하나) →
 * `partTimeCounts: Partial<Record<알바id, number>>`(종류별)로 바뀌었다.
 *
 * ⚠️ **판정은 반드시 parsed 원본으로 한다.** merged.partTimeCounts는 createInitialState()의 `{}`로
 *    이미 덮여 있어, merged를 보고 `Object.keys(...).length === 0`으로 게이트하면
 *    "알바를 한 번도 안 한 신규 세이브"와 "구세이브"를 구분하지 못한다. 게이트 자체는 참이 되지만
 *    (둘 다 빈 객체) 정작 값을 **구세이브의 partTimeCount에서 가져와야** 하므로 parsed가 필수다.
 *    loadGame의 youtubeUnlocked·adultMode·loggedIn, sanitize의 statMilestones와 같은 함정이다.
 *
 * ── 배분 근거: 구 카운트 전량을 `PART_TIME_LEGACY_ID`(기존 활동 id "parttime")에 **몰아준다.** ──
 *   ① 구세이브 플레이어가 실제로 한 알바는 '아르바이트' 하나뿐이다. 4종에 나누면
 *      그가 해본 적 없는 알바 3종의 일당까지 올려주는 소급 보상이 된다.
 *   ② 나누면 **오히려 손해다.** 신곡선은 20회 분기라, 60회를 4등분하면 각 15회 → 전부 0단계
 *      (일당 3만)로 **숙련이 통째로 증발한다.** 몰아주면 60회 = 3단계(일당 6.6만)로 보존된다.
 *      "그동안 쌓은 숙련이 0이 되면 기존 플레이어가 손해"라는 요구를 만족하는 유일한 배분이다.
 *   ③ 분기가 3회 → 20회로 늘었지만 **횟수를 환산하지 않는다**(예: ×6.7). 구 60회는 구곡선에서
 *      일당 11만이었으나 신곡선 상한이 7.8만이라 어차피 재현 불가능하고, 환산하면 대부분의
 *      구세이브가 즉시 상한에 붙어 앞으로의 성장이 사라진다. 원 횟수 보존이 곡선 개편의 취지
 *      (후반 과잉 억제)와도 일치한다 — 구 60회 플레이어는 신곡선 3단계에서 계속 오른다.
 *
 * 신규 게임은 createInitialState 경로라 이 함수를 타지 않는다.
 */
function migratePartTimeCounts(state: GameState, parsed: Partial<GameState>): void {
  // 손상값 방어: 객체가 아니면(구세이브의 number 포함) 빈 객체로 되돌린다.
  if (!state.partTimeCounts || typeof state.partTimeCounts !== "object") {
    state.partTimeCounts = {};
  }
  // 구세이브 판정 — parsed 원본에 신필드가 **없고** 구필드(number)가 있으면 마이그레이션 대상.
  const legacy = (parsed as { partTimeCount?: unknown }).partTimeCount;
  const alreadyMigrated =
    !!parsed.partTimeCounts && typeof parsed.partTimeCounts === "object";
  if (!alreadyMigrated && typeof legacy === "number" && Number.isFinite(legacy) && legacy > 0) {
    state.partTimeCounts[PART_TIME_LEGACY_ID] = Math.floor(legacy);
  }
  // 값 위생: NaN/음수/비숫자 키를 걷어낸다(NaN이 partTimePay를 타면 소지금이 NaN으로 오염된다).
  for (const [id, v] of Object.entries(state.partTimeCounts)) {
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) delete state.partTimeCounts[id];
  }
  // 구 필드는 타입에서 사라졌으므로 잔재를 지운다(남아도 무해하지만 세이브가 계속 커진다).
  delete (state as { partTimeCount?: unknown }).partTimeCount;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}
