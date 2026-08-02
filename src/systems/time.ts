import type { GameState, ScheduleEvent } from "@/core/types";
import { SLOTS_PER_DAY, SLOT_LABELS, LATE_SLOT, appendSchedule } from "@/core/state";
import { pick, uid } from "@/utils/random";
// winEnding은 타입과 state만 읽는 말단 모듈이라 여기서 가져와도 순환이 안 생긴다.
import { isFrozen } from "./winEnding";
import { applyDailyCosts, daysUntilRent, settleMonthlyIncome } from "./economy";
import { settleAuthorMonthly } from "./author";
import { deliverJobResultEmail } from "./employment";
// ⚠️ lecturer도 여기서 addSchedule을 가져가므로 순환이지만, employment와 완전히 같은 모양이다
//    (모듈 초기화 때 실행되는 코드가 없어 ESM이 알아서 푼다).
import { deliverLecturerResultEmail } from "./lecturer";
import { deliverExamResultEmail } from "./certification";
import { resolveContest } from "./contest";
import { resolveRace } from "./marathon";
import { resolveBodyProfile } from "./bodyProfile";
import { maybeSpawnBlackmailDM } from "./blackmail";
import { maybeRankMonth } from "./popularity";
import { maybeSpawnSponsorOffer } from "./genreSponsor";
import { checkJobPromotions } from "./jobRanks";
import { maybeHoldAwards, snapshotYearStart } from "./awards";
import { maybeSpawnTuckerDM, maybeStartTuckerLine } from "./lab";
import {
  maybeOpenConsoleReview,
  maybeSendAuctionMail,
  maybeSpawnCrimsonEyeDM,
  maybeStealCrimsonEye,
} from "./auction";
import { trimFanDMs } from "./dm";
import { maybeSpawnSpamEmail } from "./spam";
import { maybeHauntVisit } from "./haunt";
import { maybeGetDrunk } from "./drunk";
import { maybeSpawnAdEmail } from "./adMail";
import { checkEstheticScam } from "./esthetic";
import { spawnDailyAdTweets } from "./adTweets";
import { applySeasonalEvents } from "./seasonal";
import { rollDisease, settleHunger, settleOvertimeStrain } from "./health";
import { pushKakao, sendLandlordOverdue, sendLandlordRentReminder } from "./kakao";
import { BIRTHDAY_KAKAO_LINES } from "@/data/birthday";
import { updateMarket } from "./market";
import { expireSuspensions } from "./ban";
import { checkStatEggs, maybeCatPowerButton } from "./eggs";
import { deliverPendingGoods } from "./groupBuy";
import { maybeSpawnWorkMsg } from "./workMessenger";
import { checkAchievements } from "./achievements";
import { ensureMissions } from "./missions";
import { checkStatMilestones, perkMentalRecovery } from "./milestones";
import { killerDailyTick } from "./killer";
import { resolveProphecy } from "./prophecy";
import { deliverPendingStoryNodes } from "./dmStory";
import { HOUSINGS } from "@/data/housing";
import { clampAction, clampMental, staminaActionBonus } from "./stats";
import { settleGigDeadlines } from "./gig";
// 달력/요일 헬퍼는 calendar.ts에 있다(순환 참조 방지). 내부에서 dateLabel을 쓰고, 나머지는 재노출한다.
import {
  dateLabel,
  dateOf,
  dayOfWeek,
  weekdayLabel,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  SATURDAY,
  isWeekday,
  dateOfMonth,
  monthKey,
  weekIndex,
} from "./calendar";

// 기존 `from "./time"` import 경로 호환을 위해 그대로 재노출.
export {
  dateLabel,
  dateOf,
  dayOfWeek,
  weekdayLabel,
  MONDAY,
  TUESDAY,
  WEDNESDAY,
  THURSDAY,
  SATURDAY,
  isWeekday,
  dateOfMonth,
  monthKey,
  weekIndex,
};

/** 현재 시간 라벨 (예: "3월 4일(수) 낮") */
export function timeLabel(state: GameState): string {
  return `${dateLabel(state.day)}(${weekdayLabel(state.day)}) ${SLOT_LABELS[state.slot] ?? ""}`;
}

/**
 * 아침 기상 시 행동력 회복량(숙면 기준). **밸런스 튜닝의 핵심 지점.**
 *
 * 하루는 2슬롯인데 주요 활동이 1회에 15~32를 먹는다(트윗 10 · 근무 15 · 교양 15 · 외출 20 ·
 * 알바 24~32 · 운동 25). 회복이 30이던 시절엔 **슬롯당 평균 15**밖에 못 써서
 * "슬롯은 남았는데 행동력이 없어 아무것도 못 하는 날"이 자주 생겼다 —
 * 특히 알바 행동력을 올린 뒤로는 물류(32)를 하루 회복분으로 1회도 못 채웠다.
 *
 * 35로 올려 슬롯당 평균 17.5를 확보한다(30이던 시절엔 15).
 *
 * ⚠️ **이 값만으로 여유를 다 주면 안 된다** — 나머지는 체력(`staminaActionBonus`)이 채운다.
 *    회복량을 45까지 올렸더니 시작부터 대부분의 조합이 가능해져 **운동을 100회 해도
 *    얻는 게 없어졌다**(체력 육성이 무의미). 기본은 '숨통이 트이는' 선에서 멈추고,
 *    그 위는 운동으로 벌게 하는 게 육성게임의 성장 곡선이다:
 *      운동 0회 → 하루 35 · 25회 → 40 · 50회 → 45 · 100회 → 55(상한)
 *
 * ⚠️ 이 값을 올리면 행동력이 병목이던 설계 전제가 함께 흔들린다:
 *    트윗(10)을 하루에 몇 번 쓸 수 있는지가 곧 팔로워 성장 속도라
 *    `systems/followers.ts`의 도달일 추정(주석의 실측표)이 같이 움직인다. 함께 보라.
 */
export const SLEEP_ACTION_RECOVER = 35;

/**
 * 심야 트윗을 써서 밤을 샜을 때의 행동력 회복량(수면 부족).
 * 숙면 대비 확실히 손해여야 '밤샘 트윗'이 공짜 이득이 되지 않는다(숙면의 약 1/3 유지).
 */
export const LATE_ACTION_RECOVER = 12;

/** 3일 이상 트윗을 안 올린 계정의 팔로워 소폭 감소 */
export const INACTIVE_DAYS = 3;
/**
 * 무활동 하루당 빠지는 팔로워 비율.
 *
 * ⚠️ 예전엔 이 감소가 **아무 데도 안 알려졌다.** 숫자만 조용히 줄어서, 팔로워가 안 느는 게
 *    내 트윗이 안 먹혀서인지 그냥 안 써서인지 구분이 안 됐다. 이제 `pendingDecay`를 세워
 *    ui가 팝업으로 알린다(app.ts) — 나가라고 등 떠미는 게 이 감소의 목적이다.
 */
export const INACTIVE_LOSS_RATE = 0.01;

function applyInactivityDecay(state: GameState): void {
  let lost = 0;
  let days = 0;
  for (const acc of state.accounts) {
    const idle = state.day - (acc.lastTweetDay ?? state.day);
    if (idle >= INACTIVE_DAYS && acc.followers > 0) {
      const loss = Math.max(1, Math.round(acc.followers * INACTIVE_LOSS_RATE));
      acc.followers = Math.max(0, acc.followers - loss);
      lost += loss;
      days = Math.max(days, idle);
    }
  }
  // 여러 계정이 함께 빠져도 팝업은 하나로 묶는다 — 계정마다 띄우면 아침이 팝업으로 막힌다.
  if (lost > 0) state.pendingDecay = { days, lost };
}

/** 시:분 형태의 대략적 표시용 시계 문자열 (낮 13시 / 심야 1시) */
export function clockLabel(state: GameState): string {
  const hours = [13, 1];
  const h = hours[state.slot] ?? 13;
  return `${String(h).padStart(2, "0")}:00`;
}

/** 스케줄 이벤트 추가 */
export function addSchedule(
  state: GameState,
  title: string,
  kind: ScheduleEvent["kind"],
): void {
  appendSchedule(state, { id: uid("sch"), day: state.day, title, kind });
}

/**
 * 한 슬롯만큼 시간을 진행한다.
 * 하루가 넘어가면 day 증가 + 일일 리소스 소폭 회복 + 광고 카운터 리셋.
 *
 * ⚠️ **박제 상태(100만 달성 후 엔딩 대기)면 통째로 무시한다.** 시간이 곧 타임라인이라
 *    여기만 막으면 새 트윗·일정·정산이 전부 멈춘다. ui의 입력 차단은 화면용 방어선이고,
 *    상태를 지키는 진짜 방어선은 이 한 줄이다.
 */
export function advanceTime(state: GameState, slots = 1): void {
  if (isFrozen(state)) return;
  for (let i = 0; i < slots; i++) {
    state.slot += 1;
    if (state.slot >= SLOTS_PER_DAY) {
      state.slot = 0;
      state.day += 1;
      onNewDay(state);
    } else if (state.slot === LATE_SLOT) {
      // 낮→심야 진입. 구 '저녁' 슬롯이 없어져 월 수익 정산도 심야로 옮겼다(내부 가드로 매월 1일에만 실제 동작).
      settleMonthlyIncome(state);
      onLateNight(state);
    }
    // 재직 중이면 슬롯 전환마다 업무 메신저("너아무튼온") 요청을 판정한다(내부 가드로 자격/확률 필터).
    maybeSpawnWorkMsg(state);
  }
  // 스탯 임계값 이스터에그(도덕성 0, 지식/어휘 100, 음란 100+성인) 점검
  checkStatEggs(state);
  // 고양이 전원 버튼 참사(고양이 보유 시 행동마다 아주 낮은 확률). 슬롯 루프 바깥 — 행동 1회당 1번만 굴린다.
  maybeCatPowerButton(state);
}

/**
 * 심야 슬롯(LATE_SLOT)에 갓 진입했을 때 1회 호출된다.
 *
 * 기존 메일은 전부 onNewDay(날짜가 넘어갈 때) 발송이라 '심야 발송' 훅이 없었다 — 그래서 추가했다.
 * ⚠️ onNewDay와 **상호 배타**다: 하루가 넘어가는 분기는 `slot >= SLOTS_PER_DAY`(=2)에서만 타고,
 *    이 훅은 `slot === LATE_SLOT`(=1)에서만 탄다. 같은 if/else-if 사슬의 뒤에 붙은 가지라
 *    앞선 분기의 판정·동작에 전혀 영향을 주지 않는다(onNewDay 발동 조건 불변).
 */
function onLateNight(state: GameState): void {
  // 낮→심야 진입 시 취침 선택 팝업을 예약(ui/app.ts가 감지해 sleepModal을 띄우고,
  // 모달의 모든 선택지가 클리어한다). 무엇이 시간을 진행시켰든(오프라인 활동·근무 등) 뜬다.
  // 심야→다음날 전환은 이 훅을 안 타므로(onNewDay만 탐) 모달이 부른 advanceTime이 재설정하지 않는다.
  state.sleepPending = true;
  // 서던피스 경매 초대장(헌터 자격증 보유 + 9월 6일 심야에만) 도착
  maybeSendAuctionMail(state);
  // 괴담 계정 좋아요 예약(hauntPending)이 있으면 오늘 심야 방문을 발동(hauntVisitNow).
  // ui는 취침(sleepPending)보다 먼저 괴담 모달을 띄운다.
  maybeHauntVisit(state);
  // 확률로 취한다(취중 트윗 팝업 예약). ui는 취침보다 먼저 취중팝업을 띄운다.
  maybeGetDrunk(state);
}

function onNewDay(state: GameState): void {
  // 새 날 아침이 밝았음을 표시(UI가 감지해 "또다시 해가 떴다" 딤팝업을 띄우고, 닫을 때 false로 되돌린다).
  state.dawnPending = true;
  // ⚠️ **어제 심야에 켜진 취침 예약을 반드시 끈다.**
  //    sleepPending은 낮→심야 전환(onLateNight)에서 켜지고 취침 모달의 선택지가 끄는데,
  //    그 모달이 뜨기 전에 **다른 무언가가 시간을 또 밀면** 플래그만 남은 채 날이 바뀐다
  //    (예: 현생 살기 결과를 닫자마자 뜬 이벤트가 '회식·고래 만남'처럼 시간을 진행시키는 경우).
  //    그러면 새 날 낮에 취침 모달이 뜨고, 그 선택이 시간을 또 밀어 낮·심야가 두 번씩 도는
  //    것처럼 보인다. spendDayResting이 같은 이유로 개별 방어를 하고 있었는데,
  //    경로마다 막을 게 아니라 '날이 바뀌면 어제 예약은 무효'라는 규칙을 여기 한 곳에 둔다.
  state.sleepPending = false;
  // 일일/주간 도전과제 리셋(날짜·주차 바뀌면 세트 재추첨)
  ensureMissions(state);
  // 자고 일어나면 정신력/행동력 회복. 단, 심야 트윗을 썼으면 수면 부족으로 회복이 줄어든다.
  // 좋은 집일수록(주거 단계) 회복량이 늘어난다.
  const rested = !state.lateTweetToday;
  const home = HOUSINGS[state.housingTier] ?? HOUSINGS[0];
  // dawnModal이 "행동력 +N · 정신력 +N 회복"을 표시하려면 실제 적용한 증가분이 필요하다.
  // lateTweetToday 리셋 전에, 클램프 후 델타(상한이면 0)를 기록한다.
  const actionBefore = state.resources.action;
  const mentalBefore = state.resources.mental;
  // ⚠️ 행동력 상한은 가변(치트로 +20)이라 100을 하드코딩하면 안 된다 — clampAction이 상한을 안다.
  //    정신력도 이제 상한이 가변(mentalMaxBonus)이라 clampMental을 쓴다.
  // 체력 한계치(운동으로 성장)가 아침 행동력 회복을 늘린다 — "수련해서 더 많이 행동한다"(staminaActionBonus).
  state.resources.action = clampAction(
    state,
    state.resources.action +
      (rested ? SLEEP_ACTION_RECOVER : LATE_ACTION_RECOVER) +
      home.actionBonus +
      staminaActionBonus(state),
  );
  // ④ 마일스톤 퍼크 'stamina'가 하루 정신력 회복을 +5 해준다(해금 전 0).
  // ⚠️ 상한을 100으로 박으면 mentalMaxBonus가 통째로 죽는다 — 채울 방법이 없어지기 때문이다.
  state.resources.mental = clampMental(
    state,
    state.resources.mental + (rested ? 20 : 8) + home.mentalBonus + perkMentalRecovery(state),
  );
  state.lastRestGain = {
    action: state.resources.action - actionBefore,
    mental: state.resources.mental - mentalBefore,
  };
  state.lateTweetToday = false;
  // 오래 트윗을 안 올리면 팔로워 소폭 감소
  applyInactivityDecay(state);
  // 생활비·월세 정산
  applyDailyCosts(state);
  // 재능마켓 외주 마감 정산(초과 미완료 건 위약금·평판↓·제거)
  settleGigDeadlines(state);
  // 작가 계약 월 정산(매월 1일, 익월부터)
  settleAuthorMonthly(state);
  // 취업 지원 결과 메일(지원 익일) 도착
  deliverJobResultEmail(state);
  // 이비에듀 강사 지원 결과 메일(지원 익일) 도착
  deliverLecturerResultEmail(state);
  // 네이놈 대회 결과 메일(신청 1주 뒤) 도착
  resolveContest(state);
  // 마라톤 대회일(신청 1주 뒤) — 기록 판정 + 결과 메일
  resolveRace(state);
  // 바디프로필 도전 마감일(시작 30일 뒤) — 성공이면 자동 트윗 + 팔로워
  resolveBodyProfile(state);
  // 자격증 시험 결과 메일(응시 3일 뒤) 도착
  deliverExamResultEmail(state);
  // ⚠️ 순서 의존: 국가연금술사 합격은 바로 위 deliverExamResultEmail에서 확정된다.
  //    maybeStartTuckerLine이 그 앞에 오면 합격 당일엔 도착일이 잡히지 않고 하루 밀린다.
  maybeStartTuckerLine(state); // 합격했으면 터커 DM 도착일을 한 번만 추첨해 확정
  maybeSpawnTuckerDM(state); // 확정된 날이 되면 터커 DM 도착
  // 진홍안 구매 다음날, 금발의 신사 DM 도착
  maybeSpawnCrimsonEyeDM(state);
  // 진홍안 제안을 거절하고 7일이 지났으면 도난
  maybeStealCrimsonEye(state);
  // 낡은 게임기 보유 + 9월 10일이면 리뷰 트윗 선택창 예약
  maybeOpenConsoleReview(state);
  // 해가 바뀌면 분야별 누적치를 찍는다(연말 시상식의 '올해 실적' 기준선)
  snapshotYearStart(state);
  // 12/29 송년회 · 12/30 방송미디어대상
  maybeHoldAwards(state);
  // 직업 경력 등급 승급 감지(카운터가 8개 시스템에 흩어져 있어 여기 한 곳에서 본다)
  checkJobPromotions(state);
  // 한 갈래를 깊게 판 계정에 협찬 제안이 온다(특화 보상 — 흩뿌린 플레이는 못 받는다)
  maybeSpawnSponsorOffer(state);
  // 말일이면 월간 인기 순위를 확정한다(발표는 ui가 팝업으로)
  maybeRankMonth(state);
  // 협박 카톡 도착일(강압 씬에서 씨가 심긴 뒤 며칠 후) — 돈/만남/거절 카드가 붙어 온다
  maybeSpawnBlackmailDM(state);
  // 스팸(피싱) 메일이 간간이 온다
  maybeSpawnSpamEmail(state);
  // 쇼핑몰 광고 메일(50% 특가, 당일 한정)이 드물게 온다
  maybeSpawnAdEmail(state);
  // 에스테틱 사기 결제 후 7일이 지났으면 폐업(30만원 날림) 폭로
  checkEstheticScam(state);
  // 추천탭 광고 트윗 2개 스폰(미해금 앱 홍보 우선)
  spawnDailyAdTweets(state);
  // 계절/연말 이벤트(크리스마스·새해·연말정산 + 폭염/한파 체력 피해)
  applySeasonalEvents(state);
  // 야근 연속 페널티(제곱 곡선)·굶주림(생활비 미납) 정산.
  // ⚠️ 순서 의존 2가지: applyDailyCosts(위)가 굶주림 연속일수를 정하므로 그 뒤여야 하고,
  //    rollDisease(아래)가 오늘 깎인 체력을 보려면 그 앞이어야 한다.
  settleOvertimeStrain(state);
  settleHunger(state);
  // 체력이 바닥이면 확률적으로 병에 걸린다(폭염/한파 피해 뒤에 판정 — 그날 깎인 체력을 반영).
  rollDisease(state);
  // 월세 납부 하루 전이면 집주인이 카톡으로 리마인드
  maybeSendRentReminder(state);
  // 익월 2일, 밀린 월세가 있으면 집주인 독촉 카톡
  maybeSendRentOverdueNag(state);
  // 투자 시세 갱신
  updateMarket(state);
  // 계정 정지 기간이 끝났으면 해제
  expireSuspensions(state);
  // 도착일이 된 굿즈 공구 배송분을 인벤토리로 옮긴다
  deliverPendingGoods(state);
  // 일 단위 상태 업적 판정(소지금·자격증·집·연속 밤샘 등)
  checkAchievements(state);
  // 스탯 마일스톤 판정(하루 중 여러 경로로 오른 스킬을 일괄 인정)
  checkStatMilestones(state);
  // 킬러 사이클(매일: 마감 지난 임무 실패·게임오버 / 매달 1일 새 타겟 배정)
  killerDailyTick(state);
  // 예약된 예언 실현(예언 계정 트윗 좋아요 이스터에그)
  resolveProphecy(state);
  // "내일 보낼게요"로 예약된 스토리 DM 노드가 도착일이 됐으면 그 말을 스레드에 넣는다
  deliverPendingStoryNodes(state);
  // 오늘 도래한 트친 생일이 있으면 축하 배너/카톡을 세팅(전날 미축하는 무해하게 흘려보낸다)
  processBirthdayDue(state);
  // 쌓이기만 하던 팬 DM을 상한까지 정리한다(계정마다 따로 — dms는 계정 소유다).
  // ⚠️ 스레드를 만드는 곳이 12군데라 push 헬퍼로는 막을 수 없다 → 하루 한 번 여기서 일괄 정리.
  for (const account of state.accounts) trimFanDMs(account);
}

/**
 * 오늘 도래한 트친 생일을 처리한다.
 * 도래 감지 전에 전날 미축하 pendingBirthday를 null로 밀어(놓침=무해),
 * 오늘 도래분이 있으면 첫 건의 상대를 pendingBirthday로 세팅 + 달력 카톡 + 그 약속 제거.
 * 배너/축하 트윗은 ui가 pendingBirthday를 보고 처리한다.
 */
function processBirthdayDue(state: GameState): void {
  state.pendingBirthday = null;
  const due = state.appointments.find((a) => a.kind === "birthday" && a.day === state.day);
  if (!due) return;
  state.pendingBirthday = due.partnerName ?? null;
  pushKakao(state, "달력", [pick(BIRTHDAY_KAKAO_LINES)], { hue: 330 });
  state.appointments = state.appointments.filter((a) => a.id !== due.id);
}

/**
 * 월세 납부 하루 전(daysUntilRent === 1)에 집주인 카톡을 보낸다.
 * 같은 납부일에 대해 한 번만(중복 방지). 이미 퇴거(게임오버)면 보내지 않는다.
 */
function maybeSendRentReminder(state: GameState): void {
  if (state.gameOver) return;
  if (daysUntilRent(state) !== 1) return;
  const rentDay = state.day + 1; // 내일이 납부일
  if (state.lastRentReminderDay === rentDay) return;
  state.lastRentReminderDay = rentDay;
  sendLandlordRentReminder(state);
}

/**
 * 익월 2일에, 지난달 월세를 못 내 밀린 게 있으면 집주인이 독촉 카톡을 보낸다.
 * day-2는 매월 하루뿐이라 onNewDay가 한 번만 타므로 별도 중복 방지는 불필요하다.
 */
function maybeSendRentOverdueNag(state: GameState): void {
  if (state.gameOver) return;
  if (dateOfMonth(state.day) !== 2) return;
  if (state.overdueRent <= 0) return; // 밀린 게 없으면 안 옴
  sendLandlordOverdue(state, state.unpaidRentStreak);
}
