import type { GameState, ScheduleEvent } from "@/core/types";
import { SLOTS_PER_DAY, SLOT_LABELS, LATE_SLOT } from "@/core/state";
import { pick, uid } from "@/utils/random";
import { applyDailyCosts, daysUntilRent, settleMonthlyIncome } from "./economy";
import { settleAuthorMonthly } from "./author";
import { deliverJobResultEmail } from "./employment";
import { deliverExamResultEmail } from "./certification";
import { resolveContest } from "./contest";
import { maybeSpawnTuckerDM, maybeStartTuckerLine } from "./lab";
import {
  maybeOpenConsoleReview,
  maybeSendAuctionMail,
  maybeSpawnCrimsonEyeDM,
  maybeStealCrimsonEye,
} from "./auction";
import { maybeSpawnSpamEmail } from "./spam";
import { maybeHauntVisit } from "./haunt";
import { maybeGetDrunk } from "./drunk";
import { maybeSpawnAdEmail } from "./adMail";
import { checkEstheticScam } from "./esthetic";
import { spawnDailyAdTweets } from "./adTweets";
import { applySeasonalEvents } from "./seasonal";
import { rollDisease } from "./health";
import { pushKakao, sendLandlordOverdue, sendLandlordRentReminder } from "./kakao";
import { BIRTHDAY_KAKAO_LINES } from "@/data/birthday";
import { updateMarket } from "./market";
import { expireSuspensions } from "./ban";
import { checkStatEggs, maybeCatPowerButton } from "./eggs";
import { deliverPendingGoods } from "./groupBuy";
import { maybeSpawnWorkMsg } from "./workMessenger";
import { checkAchievements } from "./achievements";
import { checkStatMilestones } from "./milestones";
import { HOUSINGS } from "@/data/housing";
import { clampAction } from "./stats";
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

/** 3일 이상 트윗을 안 올린 계정의 팔로워 소폭 감소 */
const INACTIVE_DAYS = 3;
function applyInactivityDecay(state: GameState): void {
  for (const acc of state.accounts) {
    if (state.day - (acc.lastTweetDay ?? state.day) >= INACTIVE_DAYS && acc.followers > 0) {
      const loss = Math.max(1, Math.round(acc.followers * 0.01));
      acc.followers = Math.max(0, acc.followers - loss);
    }
  }
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
  state.schedule.push({ id: uid("sch"), day: state.day, title, kind });
}

/**
 * 한 슬롯만큼 시간을 진행한다.
 * 하루가 넘어가면 day 증가 + 일일 리소스 소폭 회복 + 광고 카운터 리셋.
 */
export function advanceTime(state: GameState, slots = 1): void {
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
  // 자고 일어나면 정신력/행동력 회복. 단, 심야 트윗을 썼으면 수면 부족으로 회복이 줄어든다.
  // 좋은 집일수록(주거 단계) 회복량이 늘어난다.
  const rested = !state.lateTweetToday;
  const home = HOUSINGS[state.housingTier] ?? HOUSINGS[0];
  // dawnModal이 "행동력 +N · 정신력 +N 회복"을 표시하려면 실제 적용한 증가분이 필요하다.
  // lateTweetToday 리셋 전에, 클램프 후 델타(상한이면 0)를 기록한다.
  const actionBefore = state.resources.action;
  const mentalBefore = state.resources.mental;
  // ⚠️ 행동력 상한은 가변(치트로 +20)이라 100을 하드코딩하면 안 된다 — clampAction이 상한을 안다.
  //    정신력은 상한이 고정 100이므로 아래 줄은 그대로 둔다.
  state.resources.action = clampAction(
    state,
    state.resources.action + (rested ? 30 : 10) + home.actionBonus,
  );
  state.resources.mental = Math.min(100, state.resources.mental + (rested ? 20 : 8) + home.mentalBonus);
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
  // 네이놈 대회 결과 메일(신청 1주 뒤) 도착
  resolveContest(state);
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
  // 오늘 도래한 트친 생일이 있으면 축하 배너/카톡을 세팅(전날 미축하는 무해하게 흘려보낸다)
  processBirthdayDue(state);
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
