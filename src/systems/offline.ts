import type { AttributeId, GameState, PetKind, SkillStatId } from "@/core/types";
import { getActiveAccount, LATE_SLOT, SLOTS_PER_DAY } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { ALL_ATTRIBUTE_IDS } from "@/data/attributes";
import { SKILL_STATS, MAX_RESOURCE } from "@/data/stats";
import { pick } from "@/utils/random";
import { clampAction, clampResource, gainSkill, gainStamina, STAMINA_MAX_CAP } from "./stats";
import { REST_STAMINA, WORKOUT_STAMINA, WORKOUT_STAMINA_MAX_GAIN, AUTHOR_WORK_STAMINA } from "./health";
import { addSchedule, advanceTime } from "./time";
import { doAuthorWork } from "./author";
import { estheticBeautyMult, maybeSpawnEstheticAd } from "./esthetic";
import { unlockAttribute } from "./attributeUnlock";
import { recordMission } from "./missions";
import { perkFailMult } from "./milestones";
import { rollAdultOfflineEncounter } from "./adultOffline";
import type { AdultOfflineEncounterId } from "@/data/adultOffline";
import { CREATURES } from "@/data/creatures";
import type { Creature } from "@/data/creatures";
import { VACATION_EVENTS } from "@/data/vacation";

export interface OfflineActivity {
  id: string;
  label: string;
  emoji: string;
  /** 현생 탭 분류: rest(쉬기·산책·외출) / study(교양·미술·코딩) / growth(운동·꾸미기·아르바이트·작업) */
  group: "rest" | "study" | "growth" | "work";
  /** 성인물 보기(adultMode) ON일 때만 목록에 노출되는 성인 활동(예: 해피타임) */
  adultOnly?: boolean;
  description: string;
  /** 리소스 변화(음수=소모) */
  action: number;
  mental: number;
  morality?: number;
  /** 성장하는 세부 스탯과 증가량 */
  skillGains?: Partial<Record<SkillStatId, number>>;
  /** 소지금 변화 */
  money?: number;
  /** 조우 시 트윗 속성 해금을 시도할 후보군 */
  unlockAttributePool?: readonly (typeof ALL_ATTRIBUTE_IDS)[number][];
  /**
   * 아르바이트 표식 — 급여가 **이 알바 고유의** 누적 횟수에 따라 동적으로 계산된다.
   * `true`면 활동 자신의 `id`가 카운터 키가 된다(알바 4종은 각자 카운터를 갖는다).
   *
   * ⚠️ 카운터 키는 활동 id 그 자체다. 활동 id를 바꾸면 그 알바의 숙련이 0으로 리셋된다.
   */
  partTime?: boolean;
  /** 이 후보군 중 하나가 랜덤으로 오른다(예: 유튜브 → 미용/개그) */
  randomSkillPool?: { pool: SkillStatId[]; amount: number };
  /** 산책: 낮은 확률로 길 잃은 강아지/고양이를 만나는 이벤트가 뜬다 */
  petWalk?: boolean;
  /** 작가 계약 원고 작업 — 작업량 게이지를 채운다(계약 중일 때만 노출) */
  authorWork?: boolean;
  /** 휴가 — 10만원 소비, 20개 이벤트 중 하나가 랜덤 발생해 특정 스킬이 오른다(행동력·정신력은 기본 회복) */
  vacation?: boolean;
  /** 결과 팝업에 뜨는 분위기 문구(랜덤 선택) */
  results: string[];
  /**
   * 컨디션 실패 판정 시 결과 문구 앞에 붙는 활동 전용 문구(선택).
   * 없으면 공용 FAIL_RESULTS를 쓴다 — content-author가 활동 성격에 맞게 채우면 몰입이 올라간다.
   */
  failResults?: string[];
  /** 컨디션 대성공 판정 시 붙는 활동 전용 문구(선택). 없으면 공용 GREAT_RESULTS. */
  greatResults?: string[];
  /** 활동 후 올릴 수 있는 트윗의 속성과 문구 */
  tweetAttr: AttributeId;
  tweetLines: string[];
}

/**
 * 활동 판정 등급 — 컨디션(정신력)에서 파생된다. 독립 난수 굴림이 아니다.
 * - `fail`   집중이 흐트러져 성과가 거의 없음(획득 스킬 FAIL_SKILL_MULT배)
 * - `normal` 평소대로
 * - `great`  몰입해서 평소보다 크게 얻음(획득 스킬 GREAT_SKILL_MULT배)
 */
export type ActivityGrade = "fail" | "normal" | "great";

/** 오프라인 활동 실행 결과 */
export interface OfflineOutcome {
  /** 결과 팝업에 표시할 분위기 문구 */
  message: string;
  /**
   * 이번 활동의 컨디션 판정 등급. UI가 결과 팝업 연출(실패/대성공)에 쓴다.
   * 실패/대성공 문구는 message에 이미 합쳐져 있으므로, UI는 등급에 맞는 **연출**(색·아이콘·헤더)만 입힌다.
   */
  grade: ActivityGrade;
  /**
   * 이번 활동으로 실제 변동한 스킬 목록(등급 배율·감쇠·정신력 배율이 전부 반영된 최종 델타).
   * **음수 항목이 섞인다** — 반대급부 감소를 UI가 반드시 표시해야 플레이어가 버그로 오인하지 않는다.
   * 델타가 0인 스킬은 담기지 않는다.
   */
  skillDeltas: { skill: SkillStatId; label: string; delta: number }[];
  /** 이번 활동으로 새로 해금된 트윗 속성(없으면 null) */
  unlockedAttribute: AttributeId | null;
  /** 아르바이트로 번 금액(없으면 null) */
  earnedMoney: number | null;
  /** 랜덤으로 오른 스탯 라벨(없으면 null) */
  randomSkillLabel: string | null;
  /** 산책 중 마주친 길동물(데려갈지 선택). 없으면 null */
  petEncounter: PetKind | null;
  /** 심야 산책 중 발생한 야외노출 이벤트(성인·음란 높음). 감행/포기 선택 */
  nudeExposure: boolean;
  /**
   * 산책 중 검정 봉고 조우(성인·음란 매우 높음).
   * 길을 알려주러 다가가면 납치 난교 루트, 무시하면 안전.
   */
  blackVanEncounter: boolean;
  /**
   * 산책 중 '벽고'(벽 구멍에 몸이 끼여 비합의 희롱을 당하는) 조우.
   * 봉고와 같은 강압/범죄 계열 — adultNoCoercion ON이면 안 뜬다.
   */
  wallHoleEncounter: boolean;
  /**
   * 활동별 성인 조우(클럽·사우나·과외 앱 등).
   * 봉고/야외노출이 안 떴을 때만 후보. 없으면 null.
   */
  adultEncounter: AdultOfflineEncounterId | null;
  /**
   * 산책 중 조우한 미수집 크리처 id(데려갈지 선택). 없으면 null.
   * 펫·성인 특수 조우가 안 떴을 때만 낮은 확률로 뜬다.
   */
  creatureEncounter: string | null;
}

/* ─────────────────── 컨디션 판정(실패/대성공) ─────────────────── */

/**
 * 정신력이 이 값 이하이면 실패 확률이 최대(FAIL_CHANCE_MAX)다.
 * 이 값과 FAIL_MENTAL_SAFE 사이는 선형 보간.
 */
export const FAIL_MENTAL_FLOOR = 10;
/** 정신력이 이 값 이상이면 실패하지 않는다. */
export const FAIL_MENTAL_SAFE = 60;
/** 정신력이 바닥일 때의 활동 실패 확률. */
export const FAIL_CHANCE_MAX = 0.45;

/** 정신력이 이 값 이상부터 대성공이 뜨기 시작한다. */
export const GREAT_MENTAL_MIN = 75;
/** 정신력 100일 때의 대성공 확률. */
export const GREAT_CHANCE_MAX = 0.3;

/** 실패 시 스킬 획득에 곱하는 배율(감소는 그대로 — 아래 applyGrade 주석 참조). */
export const FAIL_SKILL_MULT = 0.25;
/** 대성공 시 스킬 획득에 곱하는 배율. */
export const GREAT_SKILL_MULT = 1.8;

/**
 * 현재 정신력에서 파생한 활동 실패 확률(0 ~ FAIL_CHANCE_MAX).
 * ⚠️ **독립 난수 굴림이 아니다** — 확률 자체가 컨디션의 함수여야 정신력이 육성의 단일 축이 된다.
 *   정신력 60+ → 0% · 40 → 18% · 20 → 32% · 10 이하 → 45% (퍼크 미해금 기준)
 * ④ 마일스톤 퍼크(focus·resilient)가 이 확률을 최대 0.64배까지 줄인다 — 0이 되진 않는다.
 */
export function activityFailChance(state: GameState): number {
  // 정신력 클램프는 activityGreatChance와 같은 이유(음수/100초과 방어).
  const m = clampResource(state.resources.mental);
  if (m >= FAIL_MENTAL_SAFE) return 0;
  const raw =
    m <= FAIL_MENTAL_FLOOR
      ? FAIL_CHANCE_MAX
      : FAIL_CHANCE_MAX * ((FAIL_MENTAL_SAFE - m) / (FAIL_MENTAL_SAFE - FAIL_MENTAL_FLOOR));
  return raw * perkFailMult(state);
}

/**
 * 현재 정신력에서 파생한 대성공 확률(0 ~ GREAT_CHANCE_MAX).
 * 실패와 같은 축의 반대편이라 컨디션을 올릴 이유가 생긴다.
 *   정신력 75 이하 → 0% · 85 → 12% · 100 → 30%
 */
export function activityGreatChance(state: GameState): number {
  // ⚠️ 정신력을 날것으로 읽지 않고 클램프한다(mentalEfficiency와 같은 이유).
  //    상한을 안 걸면 정신력이 100을 넘는 경로가 생겼을 때 GREAT_CHANCE_MAX를 조용히 초과한다.
  const m = clampResource(state.resources.mental);
  if (m <= GREAT_MENTAL_MIN) return 0;
  return GREAT_CHANCE_MAX * ((m - GREAT_MENTAL_MIN) / (MAX_RESOURCE - GREAT_MENTAL_MIN));
}

/**
 * 컨디션 판정 1회. 실패를 먼저 굴리고, 아니면 대성공을 굴린다.
 * 두 구간이 정신력 60~75에서 겹치지 않으므로 순서는 사실상 무관하다(안전하게 배타 처리).
 */
export function rollActivityGrade(state: GameState): ActivityGrade {
  if (Math.random() < activityFailChance(state)) return "fail";
  if (Math.random() < activityGreatChance(state)) return "great";
  return "normal";
}

/**
 * 등급을 스킬 변화량에 반영한다.
 * ⚠️ **양수(획득)에만 배율을 건다** — gainSkill의 "음수는 그대로 통과" 원칙과 같은 이유다.
 *    실패했다고 반대급부 감소까지 1/4로 줄어들면 "실패가 이득"인 구간이 생기고,
 *    대성공이라고 감소가 1.8배로 커지면 컨디션을 올릴수록 손해가 된다. 둘 다 축을 뒤집는다.
 */
export function applyGradeToGain(amount: number, grade: ActivityGrade): number {
  if (amount <= 0) return amount;
  if (grade === "fail") return amount * FAIL_SKILL_MULT;
  if (grade === "great") return amount * GREAT_SKILL_MULT;
  return amount;
}

/**
 * 활동 선언값에 걸리는 **활동 고유 보정**의 단일 출처(등급·정신력 배율 이전 단계).
 *
 * 현재 대상: 꾸미기(grooming)의 매력 — 에스테틱 정품 회원이면 1.5배(`estheticBeautyMult`).
 * grooming만이 '꾸미기' 활동이다(운동의 부수 beauty +2는 대상 아님).
 *
 * ⚠️ **실지급(`doOfflineActivity`)과 미리보기(ui의 `activityDeltas`)가 둘 다 이 함수를 통과해야 한다.**
 *    한쪽에만 보정이 걸리면 "미리보기 +10, 실제 +15"처럼 조용히 어긋난다(실제로 그랬다).
 *    새 활동 고유 보정이 생기면 반드시 여기에 추가하라 — 호출부에 인라인하지 마라.
 *    등급 배율은 여기 넣지 않는다(굴림 전이라 미리보기가 알 수 없다 — `applyGradeToGain` 참조).
 */
export function declaredSkillAmount(
  state: GameState,
  activity: OfflineActivity,
  skill: SkillStatId,
  amount: number,
): number {
  if (activity.id === "grooming" && skill === "beauty") {
    return Math.round(amount * estheticBeautyMult(state));
  }
  return amount;
}

/**
 * 컨디션 실패 시 공용 문구(활동에 failResults가 없을 때의 폴백).
 * 결과 문구 **앞에** 붙으므로 "그래서 어땠다"가 아니라 "왜 안 됐다"로 끝나야 자연스럽다.
 */
export const FAIL_RESULTS = [
  "머리가 멍해서 도무지 집중이 되지 않았다.",
  "몸만 와 있고 정신은 딴 데 가 있었다.",
  "자꾸 딴생각이 끼어들어 손에 잡히질 않았다.",
  "지친 몸을 끌고 나왔지만 결국 흐지부지 끝났다.",
];

/** 컨디션 대성공 시 공용 문구(활동에 greatResults가 없을 때의 폴백). */
export const GREAT_RESULTS = [
  "컨디션이 최고였다. 시작하자마자 완전히 몰입했다.",
  "오늘따라 머리가 맑아서 술술 풀렸다.",
  "물 만난 듯 집중이 이어졌다. 시간 가는 줄 몰랐다.",
  "마음이 가벼우니 뭐든 잘 흡수됐다.",
];

/** 펫·성인 조우가 안 뜬 산책 턴에 미수집 크리처를 마주칠 확률 */
export const CREATURE_ENCOUNTER_CHANCE = 0.1;

/** 심야 산책 야외노출 이벤트가 뜨는 최소 음란도 */
export const NUDE_EXPOSURE_LEWD_MIN = 400;
/** 조건 충족 시 야외노출 이벤트 발생 확률 */
export const NUDE_EXPOSURE_CHANCE = 0.4;

/** 산책 중 검정 봉고 납치 이벤트가 뜨는 최소 음란도 */
export const BLACK_VAN_LEWD_MIN = 500;
/** 조건 충족 시 봉고 조우 확률(야외노출보다 우선) */
export const BLACK_VAN_CHANCE = 0.28;

/** 산책 중 '벽고'(벽 구멍) 비합의 이벤트가 뜨는 최소 음란도 */
export const WALLHOLE_LEWD_MIN = 600;
/** 조건 충족 시 벽고 조우 확률(봉고 다음 우선순위). 봉고와 같은 강압/범죄 계열이라 adultNoCoercion으로 함께 가려진다. */
export const WALLHOLE_CHANCE = 0.28;

/* ─────────────────── 아르바이트 일당 곡선 ───────────────────
 *
 * 구곡선: `10,000 + floor(count/3) * 5,000` — 3회마다 +5천, **상한 없음**.
 *   문제는 "보상이 약하다"가 아니라 **곡선이 뒤집혀 있었다**는 것이다.
 *   절실한 초반엔 하루 1만원이고, 안 절실한 후반엔 60회에 11만·120회에 21만으로 무한 상승했다.
 *
 * 신곡선: `24,000 + floor(count/20) * 4,000`, **상한 30,000**(40회에 도달).
 *   ① base를 1만 → 2.4만으로 올려 **초반을 2.4배로 두껍게** 했다. 20회 분기(사용자 확정)로 늘리면
 *      상승이 느려지므로, 그 손실을 base가 먼저 메꾸지 않으면 초반이 지금보다 더 빠듯해진다.
 *   ② **상한이 정규직 최저 월급에 종속된다**(PART_TIME_PAY_CAP 주석 참조).
 *      알바 월수입 = 일당 × 평일 20일이므로 상한 30,000 → 월 60만.
 *      정규직은 극소 60만 · 중소 68만 · 중견 80만 · 대기업 100만이다.
 *      → "숙련 만렙 알바 = 극소기업 초봉과 동률, 승진하면 정규직이 앞선다"가 의도된 서열이다.
 *
 *   ⚠️ **알바가 정규직을 넘으면 취업 트랙 전체가 죽는다.** 취업은 스탯을 쌓고 합격 확률을
 *      뚫어야 하지만 알바는 그냥 누르면 되기 때문이다. 실제로 이전 곡선들이 그 상태였다:
 *        - 구곡선(무한 상승): 60회에 일당 11만 → 월 220만. 대기업(100만)의 2.2배.
 *        - 1차 수정안(상한 7.8만): 40회에 월 108만으로 대기업 초과, 80회엔 156만(1.36배).
 *      생활비 면제·월세 반값 같은 재직 혜택을 더해도 역전이었다(알바 80회 실질 96만 > 대기업 만렙 90만).
 *      이 상한은 그 역전을 끊는 값이므로, **올릴 때는 반드시 TIERS.baseSalary와 함께 보라.**
 *
 * ── 실측 비교(하루 알바 1회 페이스, 순자산 = 시작 50만 + 누적일당 − 생활비 1만/일 − 월세 30만/월) ──
 *   일차 |   구곡선  |   신규   | 판정
 *   -----+----------+----------+--------------------------------
 *   10일 |   56만   |   64만   | +8만 (초반 개선 — 사용자 불만 지점)
 *   20일 |   79만   |   78만   | ≈동률
 *   30일 |   88만   |   66만   | 이후로는 취업이 정답이 되도록 의도적으로 낮다
 *   60일 |  275만   |   98만   | 알바만으로는 부자가 될 수 없다
 *   → 초반(1~10일) 생계는 구곡선보다 낫고, 그 뒤부터는 취업·외주로 갈아타야 한다.
 *
 * ── 개별 카운터와의 상호작용(4종 분할) ──
 *   카운터가 알바별이라 '한 우물'과 '고루 하기'가 갈린다. 한 우물은 40회에 상한(3만)에 닿고,
 *   고루 하면 각 카운터가 천천히 올라 그만큼 일당을 손해 본다.
 *   대신 균등 쪽은 **스탯 4트랙을 동시에** 받으므로 지배 전략이 없다.
 *   상한이 낮아 '한 우물'의 금전 이득도 크지 않다 — 스탯 목적으로 알바를 고르는 게 자연스럽다.
 */

/**
 * 4종 분할 이전에 존재했던 단일 아르바이트의 활동 id.
 * 구세이브의 `partTimeCount`(합산 숫자)가 이 id로 이관된다(`systems/save.ts`의 migratePartTimeCounts).
 *
 * ⚠️ **이 id를 가진 활동은 OFFLINE_ACTIVITIES에 반드시 남아 있어야 한다.**
 *    없어지면 구세이브의 숙련이 갈 곳을 잃고, `data/adultOffline.ts`에서
 *    `activities: ["parttime"]`로 묶인 성인 조우 3종(배달 콜 등)도 호스트를 잃는다.
 *    `__tests__/partTime.test.ts`가 이 불변식을 고정한다.
 */
export const PART_TIME_LEGACY_ID = "parttime";

/** 아르바이트 기본 일당(알바 1회차) */
export const PART_TIME_BASE = 24_000;
/** 급여 상승 단위(횟수) — 하루 1회 페이스에서 약 한 달 */
export const PART_TIME_TIER = 20;
/** 단계마다 오르는 금액 */
export const PART_TIME_RAISE = 4_000;
/**
 * 일당 상한(= BASE + 2단계 = 40회 도달).
 *
 * ⚠️ **이 값은 정규직 최저 월급에 종속된다 — 단독으로 올리지 마라.**
 *    알바는 평일 20일 기준 월 `일당 × 20`이므로 30,000 → **월 60만**이고,
 *    정규직 월급은 극소 60만 · 중소 68만이다(`data/jobs.ts`의 TIERS.baseSalary).
 *    즉 "숙련 만렙 알바 = 가장 낮은 정규직의 초봉과 겨우 동률"이 의도된 천장이다.
 *
 *    ⚠️ 비교 대상은 초봉만이 아니다 — 정규직은 성과 레벨마다 `PERF_LEVEL_RAISE`(3만)씩 오른다.
 *       상한을 32,000(월 64만)으로 뒀더니 **극소기업 성과 Lv1(63만)이 알바 만렙보다 적어져**
 *       "승진했는데 알바보다 못 번다"가 됐다. 그래서 30,000으로 내렸다.
 *       `TIERS.baseSalary`나 `PERF_LEVEL_RAISE`를 조정하면 이 상한도 반드시 같이 보라.
 */
export const PART_TIME_PAY_CAP = 30_000;

/**
 * 알바 월수입 환산에 쓰는 평일 수(달력상 평일 ≈ 20일).
 * 알바는 일당제라 정규직 월급과 비교하려면 이 값을 곱해야 한다 —
 * `PART_TIME_PAY_CAP × 20` vs `TIERS[].baseSalary`가 서열 판정의 기준이며,
 * `__tests__/partTime.test.ts`가 이 서열을 고정한다.
 */
export const PART_TIME_WEEKDAYS_PER_MONTH = 20;

/**
 * 알바 1회의 최소 행동력 소모. **정규직 근무(`WORK_ACTION_COST` = 15)보다 반드시 커야 한다.**
 *
 * ⚠️ **"알바가 모든 면에서 열등"이 목표가 아니다.** 그러면 선택지가 아니라 그냥 나쁜 버튼이 된다.
 *    의도된 교환은 이렇다:
 *      - 정규직이 이기는 축 — **수입**(`PART_TIME_PAY_CAP`이 정규직 최저 월급 아래로 묶는다)과
 *        **효율**(여기: 알바는 같은 1블록에 행동력을 1.6~2.1배 태운다).
 *      - 알바가 이기는 축 — **시간 자유**. 정규직은 `isWorkNow`가 평일 낮 슬롯을 강제로 가져가
 *        주 5회·20슬롯이 근무로 고정되지만, 알바는 평일·주말·심야 아무 때나 원할 때만 한다.
 *        (스케줄이 빡빡한 주에 쉬거나, 이벤트·마감이 걸린 날을 피할 수 있는 건 알바뿐이다.)
 *    이 교환이 성립해야 "초반엔 알바, 자리 잡으면 취업"이라는 진행이 자연스러워진다.
 *    수입·효율을 더 깎을 때는 시간 자유가 그걸 상쇄할 만큼 큰지 함께 보라.
 * 현재 4종은 24~32로, 정규직 15 대비 1.6~2.1배다.
 * ⚠️ `__tests__/partTime.test.ts`가 "모든 알바 > WORK_ACTION_COST"를 고정한다.
 */
export const PART_TIME_MIN_ACTION = 20;

/**
 * 그 알바의 누적 횟수(count)에 따른 다음 일당.
 * count는 **알바 종류별** 카운터다(`partTimeCountOf`). 전 알바 합산이 아니다.
 */
export function partTimePay(count: number): number {
  const safe = Number.isFinite(count) && count > 0 ? count : 0;
  return Math.min(PART_TIME_PAY_CAP, PART_TIME_BASE + Math.floor(safe / PART_TIME_TIER) * PART_TIME_RAISE);
}

/**
 * 이 알바를 몇 번 했는지(종류별 카운터).
 * ⚠️ `state.partTimeCounts[id] ?? 0`을 직접 쓰지 마라 — 구세이브·손상값의 NaN이 `??`를 통과해
 *    partTimePay → state.money로 흘러들어 소지금을 NaN으로 영구 오염시킨다(actionMaxBonus 선례).
 */
export function partTimeCountOf(state: GameState, activityId: string): number {
  const v = state.partTimeCounts?.[activityId];
  return typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0;
}

/** 다음 일당 인상까지 남은 횟수. 이미 상한이면 null(UI가 "최고 시급" 같은 표시로 갈린다). */
export function partTimeNextRaiseIn(count: number): number | null {
  if (partTimePay(count) >= PART_TIME_PAY_CAP) return null;
  const safe = Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
  return PART_TIME_TIER - (safe % PART_TIME_TIER);
}

/** 목록에 노출되는 아르바이트 활동 전부(UI가 '일' 탭에서 알바만 따로 다룰 때 쓴다) */
export function partTimeActivities(): OfflineActivity[] {
  return OFFLINE_ACTIVITIES.filter((a) => a.partTime);
}

/** 휴가 1회 비용 */
export const VACATION_COST = 100_000;

/** 휴가를 갈 수 있는지(소지금이 비용 이상이어야 한다 — UI가 버튼 게이트에 쓴다) */
export function canAffordVacation(state: GameState): boolean {
  return state.money >= VACATION_COST;
}

/** 이 친화력(0~999) 미만에서 알바하면 손님 응대 스트레스로 정신력이 추가로 깎인다 */
export const PART_TIME_LOW_SOCIAL = 100;
/** 친화력이 낮을 때 알바로 추가 하락하는 정신력 */
export const PART_TIME_LOW_SOCIAL_MENTAL = 10;
/** 이 정신력 미만에서 알바하면 실수/사건 위험 */
export const PART_TIME_MISTAKE_MENTAL = 20;
/** 정신력이 낮을 때 실수/사건이 터질 확률(발생 시 일당 50%) */
export const PART_TIME_MISTAKE_CHANCE = 0.5;
/** 실수/사건 발생 시 보여줄 문구 */
const PART_TIME_MISTAKE_RESULTS = [
  "넋이 나간 채 일하다 실수를 연발했다. 사고를 수습하느라 진이 빠졌고, 일당이 반으로 깎였다.",
  "정신이 딴 데 팔려 물건을 깨뜨리고 말았다. 변상 얘기가 오갔고, 결국 일당이 절반만 나왔다.",
  "몽롱한 상태로 주문을 계속 헷갈렸다. 손님 컴플레인이 쏟아졌고, 일당에서 반이 잘렸다.",
  "졸다가 큰 실수를 쳤다. 사장이 한숨을 쉬며 오늘 일당은 절반이라고 못 박았다.",
];

export const OFFLINE_ACTIVITIES: OfflineActivity[] = [
  {
    id: "goout",
    label: "외출",
    emoji: "",
    group: "rest",
    description: "밖에 나가 견문을 넓힌다. 새로운 트윗 소재를 얻을 수 있다.",
    action: -20,
    mental: +10,
    skillGains: { sociability: 7, knowledge: -2 },
    unlockAttributePool: ["daily", "food", "beauty", "idol", "animal", "cooking", "fashion", "travel"],
    results: [
      "여유있게 시간을 보냈다.",
      "거리를 걷다 보니 기분이 한결 가벼워졌다.",
      "햇볕을 쬐며 동네 한 바퀴를 돌았다.",
      "카페에 앉아 사람 구경을 하다 왔다.",
    ],
    failResults: [
      "누구랑 눈만 마주쳐도 피곤해서 대충 인사만 하고 돌아섰다.",
      "사람 많은 곳에 나가긴 했는데 아무 말도 하기 싫었다.",
    ],
    greatResults: [
      "지나가는 사람마다 스스럼없이 말을 걸었다. 오늘따라 사교성이 폭발했다.",
      "낯선 사람과도 스몰토크가 술술 풀렸다. 나가길 잘했다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["외출했더니 기분이 한결 나아졌다", "바깥바람 쐬고 왔어요 날씨 좋더라"],
  },
  {
    id: "walk",
    label: "산책",
    emoji: "",
    group: "rest",
    description: "동네를 천천히 걷는다. 가끔 길 잃은 강아지나 고양이를 만날 수도 있다.",
    action: -12,
    mental: +12,
    skillGains: { sociability: 5, fitness: 2, knowledge: -2 },
    petWalk: true,
    results: [
      "선선한 바람을 맞으며 동네를 한 바퀴 돌았다.",
      "골목골목을 누비며 느긋하게 걸었다.",
      "천천히 걷다 보니 머릿속이 맑아졌다.",
    ],
    failResults: [
      "몇 걸음 걷지도 않았는데 그냥 돌아가고 싶었다.",
      "발은 걷는데 머릿속은 계속 딴 데 가 있었다.",
    ],
    greatResults: [
      "걸음마다 기분이 나아지는 게 느껴졌다. 평소보다 훨씬 멀리 걸었다.",
      "몸도 마음도 가벼워서 발걸음이 절로 빨라졌다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["산책하니까 머릿속이 맑아진다", "동네 한 바퀴 걷고 왔더니 개운하다"],
  },
  {
    id: "rest",
    label: "쉬기",
    emoji: "",
    group: "rest",
    description: "푹 쉬며 정신력과 행동력을 회복한다.",
    action: +25,
    mental: +30,
    results: [
      "이불 속에서 뒹굴며 푹 쉬었다.",
      "아무것도 하지 않는 하루의 소중함을 느꼈다.",
      "늘어지게 낮잠을 자고 일어나니 개운하다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["오늘은 아무것도 안 하고 푹 쉬는 날", "늘어지게 자고 일어나니 개운하다"],
  },
  {
    id: "vacation",
    label: "휴가",
    emoji: "",
    group: "rest",
    vacation: true,
    description: "10만원 들여 훌쩍 떠난다. 행동력·정신력을 크게 회복하고, 뜻밖의 경험으로 능력치도 오른다.",
    action: +30,
    mental: +45,
    money: -VACATION_COST,
    results: ["휴가를 다녀왔다."], // 실제 문구는 발생한 휴가 이벤트가 덮어쓴다(fallback)
    tweetAttr: "daily",
    tweetLines: ["휴가 다녀왔더니 세상이 다르게 보인다", "가끔은 이렇게 훌쩍 떠나줘야 해"],
  },
  {
    // 성인트윗 없이 음란도를 쌓는 유일 경로. lewd 12 → 해피타임 4회에 야밤(40), 5회에 푸시타임(50) 도달.
    // 수위는 암시·완곡까지(노골적 성행위 묘사 금지). "해피타임" 완곡어 유지.
    id: "happytime",
    label: "해피타임",
    emoji: "",
    group: "rest",
    adultOnly: true,
    description: "야릇한 상상에 빠져 혼자만의 은밀한 시간을 갖는다. 마음이 나른하게 풀리고, 은근한 음란함이 쌓인다.",
    action: -8,
    mental: +12,
    morality: -3,
    skillGains: { lewd: 12 },
    results: [
      "이불 속에서 혼자만의 은밀한 시간을 보내고 나니 몸도 마음도 나른하게 풀렸다.",
      "야릇한 상상에 한참 빠져 있다 나왔더니 묘하게 개운하다.",
      "달아오른 밤을 조용히 달래며 흘려보냈다. 이상하게 잠은 잘 올 것 같다.",
      "혼자만의 시간에 흠뻑 젖었다. 아무에게도 말 못 할 비밀이 하나 늘었다.",
    ],
    failResults: [
      "괜히 찝찝한 기분만 들어서 도중에 그만뒀다.",
      "집중이 안 돼서 흐지부지 끝나버렸다.",
    ],
    greatResults: [
      "평소보다 훨씬 깊이 빠져들었다. 스스로도 놀랄 정도였다.",
      "머릿속 브레이크가 완전히 풀려서 끝까지 몰입했다.",
    ],
    tweetAttr: "adult",
    tweetLines: ["오늘 밤은 좀... 야릇한 기분이네 🫣", "혼자 보내는 밤도 나쁘지 않아. 무슨 상상 했는진 비밀 🤫"],
  },
  {
    id: "study",
    label: "교양",
    emoji: "",
    group: "study",
    description: "책상 앞에서 어휘력과 지식을 쌓는다.",
    action: -15,
    mental: -10,
    skillGains: { vocabulary: 10, knowledge: 10, sociability: -3 },
    // 미술·코딩을 EBS로 옮기며 코딩이 갖던 IT계 해금을 교양이 이어받는다(현생 유일 IT계 해금 경로 유지).
    unlockAttributePool: ["politics", "humor", "info", "plant", "it", "finance"],
    results: [
      "책장을 넘기며 머릿속을 정리했다.",
      "조용히 집중하는 시간을 가졌다.",
      "새로 알게 된 것들을 노트에 적어뒀다.",
    ],
    failResults: [
      "같은 문장을 세 번이나 다시 읽었다. 도무지 머리에 들어오질 않았다.",
      "책상 앞에 앉아만 있었지 눈으로만 글자를 훑었다.",
    ],
    greatResults: [
      "한번 잡으니 손에서 놓기 싫을 만큼 술술 읽혔다.",
      "머리가 스펀지처럼 내용을 쭉쭉 빨아들였다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["오늘 교양 좀 쌓았다 뿌듯", "책 읽는데 생각보다 재밌네"],
  },
  {
    id: "comedy",
    label: "개그 연습",
    emoji: "",
    group: "study",
    description: "예능·밈·짤을 보며 드립과 개그 감각을 갈고닦는다.",
    action: -12,
    mental: -4,
    skillGains: { comedy: 12, vocabulary: -3 },
    unlockAttributePool: ["humor"],
    results: [
      "웃긴 짤을 모으다 보니 어느새 나만의 드립 노트가 두둑해졌다.",
      "예능을 돌려보며 웃음 타이밍과 밈을 연구했다. 포인트가 보이기 시작한다.",
      "거울 앞에서 개그를 연습하다 혼자 빵 터졌다.",
    ],
    failResults: [
      "웃긴 걸 봐도 하나도 안 웃겼다. 타이밍 감각이 영 안 잡혔다.",
      "짤을 아무리 모아도 하나도 재밌어 보이지 않았다.",
    ],
    greatResults: [
      "보는 것마다 빵빵 터졌다. 드립이 저절로 튀어나왔다.",
      "타이밍이 미친 듯이 잘 잡혔다. 이러다 진짜 웃긴 사람 될 것 같다.",
    ],
    tweetAttr: "humor",
    tweetLines: [
      "개그 감각은 갈고닦는 거임 ㅋㅋ 오늘도 드립 연습 완료",
      "웃긴 짤 수집만 세 시간째… 이게 다 자기계발이지",
    ],
  },
  {
    id: "volunteer",
    label: "봉사활동",
    emoji: "",
    group: "growth",
    description: "지역 센터에서 봉사한다. 몸은 고단해도 마음이 따뜻해지고 도덕성이 오른다.",
    action: -15,
    mental: +3,
    morality: +6,
    skillGains: { sociability: 5, beauty: -2 },
    results: [
      "땀 흘려 남을 도우니 마음 한구석이 따뜻해졌다.",
      "고맙다는 말 한마디에 하루의 피로가 싹 가셨다.",
      "봉사 끝에 다 같이 나눠 먹은 밥이 유난히 맛있었다.",
    ],
    failResults: [
      "몸이 따라주지 않아 손이 자꾸 겉돌았다. 도움이 됐는지도 모르겠다.",
      "마음이 콩밭에 가 있어 시늉만 하다 왔다.",
    ],
    greatResults: [
      "누가 시키지 않아도 몸이 먼저 움직였다. 오늘따라 힘든 줄도 몰랐다.",
      "구석구석 눈에 밟혀서 나서다 보니 어느새 제일 많이 도왔다.",
    ],
    tweetAttr: "daily",
    tweetLines: [
      "오늘 봉사활동 다녀옴. 받는 게 더 많은 하루였다",
      "작은 손길이라도 보태니 마음이 꽉 차는 기분",
    ],
  },
  {
    id: "workout",
    label: "운동",
    emoji: "",
    group: "growth",
    description: "땀 흘리며 몸을 단련한다.",
    action: -25,
    mental: +5,
    skillGains: { fitness: 10, beauty: 2, vocabulary: -3 },
    unlockAttributePool: ["fitness", "sports"],
    results: [
      "땀을 쫙 빼고 나니 상쾌하다.",
      "거울 속 내 모습이 조금 달라 보인다.",
      "근육통이 밀려오지만 왠지 뿌듯하다.",
    ],
    failResults: [
      "몇 세트 하지도 않았는데 숨이 턱까지 차서 그냥 접었다.",
      "몸이 천근만근이라 무게를 제대로 못 실었다.",
    ],
    greatResults: [
      "평소보다 무게가 훨씬 가볍게 느껴졌다. 한계까지 몰아붙였다.",
      "컨디션이 좋으니 세트 수를 늘려도 힘이 남았다.",
    ],
    tweetAttr: "fitness",
    tweetLines: ["오운완! 오늘도 나 자신 칭찬해", "운동 끝나고 마시는 물 최고"],
  },
  {
    id: "grooming",
    label: "꾸미기",
    emoji: "",
    group: "growth",
    description: "메이크업·헤어를 손보며 나를 가꾼다.",
    action: -15,
    mental: +5,
    money: -10_000,
    skillGains: { beauty: 10, knowledge: -3 },
    results: [
      "거울 앞에서 이것저것 손보니 한결 태가 난다.",
      "관리를 받고 나오니 피부가 반질반질 윤이 난다.",
      "새로 산 화장품으로 메이크업을 요리조리 연습해봤다.",
      "헤어숍에서 스타일을 바꾸고 나니 기분까지 산뜻해졌다.",
    ],
    failResults: [
      "손이 자꾸 삐끗해서 화장이 뜻대로 안 됐다.",
      "거울을 봐도 뭘 고쳐야 할지 감이 안 잡혔다.",
    ],
    greatResults: [
      "터치 하나하나가 완벽하게 먹혔다. 거울 속 내가 낯설 정도였다.",
      "손끝 감각이 살아나서 평소보다 훨씬 정교하게 꾸며졌다.",
    ],
    tweetAttr: "beauty",
    tweetLines: ["피부 관리 받고 왔더니 광 미쳤다 ✨ #셀프관리", "헤어 새로 하고 화장 바꿨더니 딴사람 됨 오늘 나 좀 예쁨"],
  },
  {
    // ⚠️ id 불변 — 구세이브 partTimeCount 마이그레이션 대상이자 adultOffline.ts의 성인 조우 3종 호스트.
    id: "parttime",
    label: "편의점 야간",
    emoji: "",
    group: "work",
    description: "심야 편의점에서 진상도 받아내고 손님도 응대한다. 밤을 새우는 만큼 피부는 축난다.",
    action: -29,
    mental: -14,
    skillGains: { sociability: 9, beauty: -3 },
    partTime: true,
    results: [
      "진상 손님 몇을 받아넘기고 나니 어지간한 일엔 눈 하나 깜짝 안 하게 됐다.",
      "밤새 계산대를 지키다 보니 사람 상대하는 게 예전보단 편해졌다.",
      "졸린 눈을 비비며 마감을 마쳤다. 그래도 오늘 하루 일당은 챙겼다.",
    ],
    failResults: [
      "밤샘에 정신이 딴 데 팔려서 손이 자꾸 느려졌다.",
      "멍하니 시간만 때우다시피 근무했다.",
    ],
    greatResults: [
      "손발이 착착 맞아서 사장님한테 칭찬까지 들었다.",
      "진상 손님도 웃으며 받아넘겼다. 오늘따라 응대가 술술 풀렸다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["편의점 야간 알바 끝, 오늘도 고생한 나에게 박수", "밤새 계산대 지켰다 일당 벌었으니 됐다"],
  },
  {
    id: "logistics",
    label: "물류 상하차",
    emoji: "",
    group: "work",
    description: "물류센터에서 박스를 나르고 쌓는다. 몸은 단련되지만 꾸밀 새가 없다.",
    action: -32,
    mental: -12,
    skillGains: { fitness: 9, beauty: -3 },
    partTime: true,
    results: [
      "박스를 하루 종일 날랐더니 팔뚝이 뻐근하다. 그래도 몸은 점점 단단해지는 느낌이다.",
      "컨베이어 벨트 속도에 맞춰 움직이다 보니 어느새 요령이 붙었다.",
      "땀에 절어 하루를 마쳤다. 힘들었지만 일당은 두둑하게 챙겼다.",
    ],
    failResults: [
      "몸이 안 따라줘서 박스를 놓치고 자꾸 헤맸다.",
      "허리가 뻐근해서 속도를 제대로 못 냈다.",
    ],
    greatResults: [
      "몸이 가벼우니 박스 나르는 속도가 남달랐다. 반장이 눈여겨봤다.",
      "평소보다 두 배는 빨리 움직였다. 오늘따라 근력이 폭발했다.",
    ],
    tweetAttr: "fitness",
    tweetLines: ["물류 상하차 끝냈다 팔이 후들거림", "오늘도 박스랑 씨름하고 옴 그래도 몸은 좋아지는 듯"],
  },
  {
    id: "cafe_serving",
    label: "카페 홀서빙",
    emoji: "",
    group: "work",
    description: "카페에서 손님을 맞고 서빙한다. 웃는 얼굴로 응대하다 보면 미용에도 신경 쓰게 된다.",
    action: -26,
    mental: -8,
    skillGains: { sociability: 7, beauty: 4, knowledge: -3 },
    partTime: true,
    results: [
      "손님 응대하며 웃다 보니 표정 관리가 자연스러워졌다. 유니폼도 늘 단정하게 챙겨 입었다.",
      "오늘도 주문을 받고 라떼아트를 연습했다. 조금씩 예뻐지는 것 같다.",
      "바쁜 시간대를 무사히 넘겼다. 단골손님이 알아봐 줘서 뿌듯했다.",
    ],
    failResults: [
      "주문을 헷갈려서 죄송하다는 말만 반복했다.",
      "손님 눈치 보느라 정신이 하나도 없었다.",
    ],
    greatResults: [
      "웃는 얼굴로 손님을 척척 응대했다. 사장님이 칭찬을 아끼지 않았다.",
      "라떼아트가 오늘따라 유난히 예쁘게 나왔다. 손님들 반응도 좋았다.",
    ],
    tweetAttr: "beauty",
    tweetLines: ["카페 알바 끝 오늘도 방긋 웃고 옴", "홀서빙하다 라떼아트 늘었다 은근 뿌듯"],
  },
  {
    id: "tutoring",
    label: "과외·학원 보조",
    emoji: "",
    group: "work",
    description: "학원에서 보조 수업을 하거나 과외를 뛴다. 머리는 잘 돌아가지만 몸 쓸 일은 없다.",
    action: -24,
    mental: -10,
    skillGains: { knowledge: 8, vocabulary: 6, fitness: -3 },
    partTime: true,
    results: [
      "질문에 막힘없이 답하다 보니 설명하는 요령이 늘었다.",
      "교재를 다시 훑으며 개념을 정리했다. 가르치는 게 곧 공부다.",
      "학생이 이해했다는 표정을 지을 때 은근히 뿌듯했다.",
    ],
    failResults: [
      "머리가 안 돌아가서 설명이 자꾸 꼬였다.",
      "앉아만 있었더니 몸이 찌뿌둥하고 집중도 안 됐다.",
    ],
    greatResults: [
      "질문이 나오기도 전에 핵심을 짚어줬다. 스스로도 놀랄 만큼 술술 풀렸다.",
      "설명이 머릿속에서 명쾌하게 정리됐다. 학생도 눈을 반짝였다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["과외 끝 오늘따라 설명이 술술 나왔다", "학원 보조 알바하고 옴 애들 질문 받다 보면 나도 공부됨"],
  },
  {
    id: "author_work",
    label: "작업",
    emoji: "",
    group: "growth",
    description: "작가 원고 작업으로 이번 달 작업량을 채운다. 체력이 크게 깎인다. (창작·어휘력·개그·지식이 높을수록 잘 채워짐)",
    action: -15,
    mental: -10,
    authorWork: true,
    results: [
      "원고를 붙잡고 씨름했다.",
      "마감을 향해 한 컷 한 컷 그려나갔다.",
      "밤새 원고와 씨름한 끝에 진도를 뺐다.",
    ],
    failResults: [
      "펜을 쥐고도 한 컷도 못 그린 채 시간만 흘려보냈다.",
      "머릿속이 하얘서 같은 페이지만 붙잡고 있었다.",
    ],
    greatResults: [
      "손이 먼저 움직이는 느낌이었다. 막힘없이 컷이 쏟아졌다.",
      "몰입이 제대로 걸려서 예상보다 훨씬 많이 그렸다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["오늘도 마감과 사투 중... 그래도 조금씩 나아간다", "작업 진척 있음 이 맛에 창작하지"],
  },
];

/** 작가 원고 작업 활동(계약 중일 때만 노출) — 심야 선택창 등에서 재사용 */
export const AUTHOR_WORK_ACTIVITY = OFFLINE_ACTIVITIES.find((a) => a.authorWork)!;

/** "하루 그냥 보내기"의 회복 기준이 되는 휴식 활동(action+25/mental+30) */
export const REST_ACTIVITY = OFFLINE_ACTIVITIES.find((a) => a.id === "rest")!;

/** 오늘 '하루 그냥 보내기'로 넘길 남은 블록이 있는지(UI 버튼 활성 판정) */
export function canSpendDay(state: GameState): boolean {
  return !state.gameOver && SLOTS_PER_DAY - state.slot > 0;
}

/**
 * 오늘 남은 블록을 전부 휴식으로 보낸다 — 순수 회복 + 시간 진행만.
 * doOfflineActivity와 달리 성인 조우·봉고·해금 등 부수 롤을 굴리지 않는다.
 * 각 블록마다 휴식 회복(REST_ACTIVITY) 적용 후 advanceTime(1)을 호출하므로,
 * 심야 진입/날짜 전환 시 기존 onLateNight/onNewDay(취침·새벽 팝업, 월세·생활비)가 자연 발생한다.
 * ⚠️ 날짜를 넘기면 onNewDay가 lastRestGain을 자체 수면 회복분으로 덮는다(#2와의 정상 상호작용).
 * @returns 실제 회복된 총량(클램프 후 델타 합)
 */
export function spendDayResting(state: GameState): { action: number; mental: number } {
  let action = 0;
  let mental = 0;
  const remaining = SLOTS_PER_DAY - state.slot;
  for (let i = 0; i < remaining; i++) {
    if (state.gameOver) break;
    const actionBefore = state.resources.action;
    const mentalBefore = state.resources.mental;
    state.resources.action = clampAction(state, state.resources.action + REST_ACTIVITY.action);
    state.resources.mental = clampResource(state.resources.mental + REST_ACTIVITY.mental);
    gainStamina(state, REST_STAMINA); // 쉬며 넘긴 슬롯마다 체력도 회복(rest 활동과 동일)
    action += state.resources.action - actionBefore;
    mental += state.resources.mental - mentalBefore;
    advanceTime(state, 1);
  }
  // 하루를 통째로 쉬어 넘겼으므로 다음날 아침에 착지한다. 통과 중 심야에서 켜진 취침 예약은
  // 실제로 취침 선택을 한 게 아니므로 지운다 — 안 지우면 새벽 팝업 뒤에 심야 선택창이 또 뜬다.
  state.sleepPending = false;
  return { action, mental };
}

/**
 * 오프라인 활동 실행.
 * 리소스/스킬/소지금을 반영하고 시간을 1슬롯 진행한다.
 * @returns 결과 팝업에 쓸 분위기 문구와 해금 정보
 */
export function doOfflineActivity(
  state: GameState,
  activity: OfflineActivity,
): OfflineOutcome {
  // 시간이 진행되기 전 슬롯을 기록(심야 여부 판정용)
  const wasLate = state.slot === LATE_SLOT;
  recordMission(state, "offline"); // 도전과제: 현생 살기 카운트

  // ⑤ 컨디션 판정: **활동의 mental 증감을 반영하기 전에** 굴린다.
  // 활동에 '들어갈 때'의 컨디션이 성패를 가르는 것이 서사적으로 맞고, 순서를 뒤집으면
  // 쉬기(mental +30)가 자기 자신의 판정을 밀어올려 항상 대성공이 되는 자기충족 루프가 생긴다.
  const grade = rollActivityGrade(state);

  // 휴식 활동은 activity.action이 양수 — 상한이 걸리는 지점이라 clampAction이어야 한다.
  state.resources.action = clampAction(state, state.resources.action + activity.action);
  state.resources.mental = clampResource(state.resources.mental + activity.mental);
  if (activity.morality) {
    state.resources.morality = clampResource(state.resources.morality + activity.morality);
  }
  if (activity.money) state.money += activity.money;

  // 체력: 운동은 한계치를 올리고(현재 체력도 소량 회복), 쉬기는 체력을 회복한다.
  if (activity.id === "workout") {
    state.staminaMax = Math.min(STAMINA_MAX_CAP, state.staminaMax + WORKOUT_STAMINA_MAX_GAIN);
    gainStamina(state, WORKOUT_STAMINA);
  } else if (activity.id === "rest") {
    gainStamina(state, REST_STAMINA);
  } else if (activity.authorWork) {
    gainStamina(state, -AUTHOR_WORK_STAMINA); // 웹툰 원고 작업은 체력을 깎는다
  }

  // 아르바이트: **그 알바의** 누적 횟수에 따라 급여가 오른다(4종이 각자 카운터를 갖는다).
  // ⚠️ 아래 두 페널티(낮은 친화력·낮은 정신력 실수)는 "알바는 하나"라는 가정 없이 쓰여 있다 —
  //    activity.partTime 표식만 보고 상태를 읽으므로 알바가 4종으로 늘어도 종류마다 그대로 적용된다.
  //    (알바별로 강도를 달리하고 싶어지면 OfflineActivity에 필드를 추가하라. 지금은 4종 공통.)
  let earnedMoney: number | null = null;
  let partTimeMistake = false;
  if (activity.partTime) {
    // 친화력이 매우 낮으면 손님 응대가 버거워 정신력이 추가로 깎인다.
    // 실수 판정 '전에' 적용 → 낮은 친화력이 멘탈을 더 떨어뜨려 실수 확률까지 높인다(연쇄).
    if (state.skills.sociability < PART_TIME_LOW_SOCIAL) {
      state.resources.mental = clampResource(state.resources.mental - PART_TIME_LOW_SOCIAL_MENTAL);
    }
    // 카운터 키는 활동 id. 이번 회차의 일당은 **증가 전** 카운트로 계산한다(1회차 = BASE).
    earnedMoney = partTimePay(partTimeCountOf(state, activity.id));
    // 정신력이 매우 낮으면 확률적으로 실수/사건 → 일당 절반.
    // ⚠️ mental 클램프는 이 함수 맨 위(activity.mental 반영)에서 이미 끝났으므로 갱신된 값을 본다.
    if (state.resources.mental < PART_TIME_MISTAKE_MENTAL && Math.random() < PART_TIME_MISTAKE_CHANCE) {
      earnedMoney = Math.round(earnedMoney / 2);
      partTimeMistake = true;
    }
    state.money += earnedMoney;
    // 부분 Record라 키가 없을 수 있다 — 셀렉터로 읽고 다시 써야 첫 1회가 NaN이 되지 않는다.
    state.partTimeCounts[activity.id] = partTimeCountOf(state, activity.id) + 1;
  }

  // 실제 반영된 스킬 델타를 모아 UI에 넘긴다 — 음수(반대급부)가 섞이므로 표시가 필수다.
  const skillDeltas: { skill: SkillStatId; label: string; delta: number }[] = [];
  const recordDelta = (skill: SkillStatId, delta: number) => {
    if (delta === 0) return;
    const hit = skillDeltas.find((d) => d.skill === skill);
    if (hit) hit.delta += delta;
    else skillDeltas.push({ skill, label: SKILL_STATS[skill].label, delta });
  };

  for (const [skill, amount] of Object.entries(activity.skillGains ?? {})) {
    const key = skill as SkillStatId;
    // 활동 고유 보정(에스테틱 등) → 컨디션 등급 배율(양수에만) → gainSkill이 정신력 배율·감쇠를 마저 건다.
    const amt = declaredSkillAmount(state, activity, key, amount ?? 0);
    recordDelta(key, gainSkill(state, key, applyGradeToGain(amt, grade)));
  }

  // 랜덤 스탯 상승(예: 유튜브 → 미용/개그 중 하나)
  let randomSkillLabel: string | null = null;
  if (activity.randomSkillPool) {
    const key = pick(activity.randomSkillPool.pool);
    const gained = gainSkill(state, key, applyGradeToGain(activity.randomSkillPool.amount, grade));
    // ⚠️ 하드코딩 '+' 금지 — 실패 등급·상단 감쇠·999 상한에서 gained가 0이 되어 "미용 +0"이 뜬다.
    randomSkillLabel = `${SKILL_STATS[key].label} ${gained > 0 ? "+" : ""}${gained}`;
  }

  // 휴가: 20개 이벤트 중 하나가 랜덤 발생 → 특정 스킬↑ (행동력·정신력·비용은 위에서 이미 반영).
  //       발생 이벤트의 문구가 결과 메시지를 덮고, 오른 스킬은 randomSkillLabel로 표시한다.
  // ⚠️ 휴가는 10만원을 낸 확정 이벤트라 컨디션 등급 배율을 걸지 않는다(돈 내고 실패하면 부당하다).
  let vacationMessage: string | null = null;
  if (activity.vacation) {
    const ev = pick(VACATION_EVENTS);
    const gained = gainSkill(state, ev.stat, ev.amount);
    // 휴가는 등급 배율이 없지만 정신력 배율·상단 감쇠·999 상한으로 gained가 0이 될 수 있다.
    randomSkillLabel = `${SKILL_STATS[ev.stat].label} ${gained > 0 ? "+" : ""}${gained}`;
    vacationMessage = ev.message;
  }

  // 활동을 통한 트윗 속성 해금 시도(현재 활성 계정에 적용)
  let unlockedAttribute: AttributeId | null = null;
  if (activity.unlockAttributePool) {
    const account = getActiveAccount(state);
    for (const attr of activity.unlockAttributePool) {
      if (account.unlockedAttributes.includes(attr)) continue;
      if (Math.random() < 0.35) {
        // ⚠️ push 직접 호출 금지 — 해금 부수효과(게임 스킬 기준선 등)를 단일 관문이 보장한다.
        unlockAttribute(state, account, attr);
        addSchedule(state, `새 트윗 속성 해금: ${ATTRIBUTES[attr].label}`, "system");
        unlockedAttribute = attr;
        break;
      }
    }
  }

  // 성인 특수 우선순위: (산책) 봉고 > 벽고 > 심야 야외노출 > 활동별 조우 > 길동물
  let blackVanEncounter = false;
  let wallHoleEncounter = false;
  let nudeExposure = false;
  let adultEncounter: AdultOfflineEncounterId | null = null;
  if (activity.petWalk && state.adultMode) {
    // 검정 봉고 납치(비합의/범죄)는 '강압/범죄 안 보기' 켜면 건너뛴다 → 벽고/노출/길동물로 폴백.
    if (
      !state.adultNoCoercion &&
      state.skills.lewd >= BLACK_VAN_LEWD_MIN &&
      Math.random() < BLACK_VAN_CHANCE
    ) {
      blackVanEncounter = true;
    } else if (
      // 벽고(벽 구멍)도 비합의/범죄 계열 — 강압/범죄 안 보기 켜면 건너뛴다. 음란도 문턱이 봉고보다 높다.
      !state.adultNoCoercion &&
      state.skills.lewd >= WALLHOLE_LEWD_MIN &&
      Math.random() < WALLHOLE_CHANCE
    ) {
      wallHoleEncounter = true;
    } else if (
      wasLate &&
      state.skills.lewd >= NUDE_EXPOSURE_LEWD_MIN &&
      Math.random() < NUDE_EXPOSURE_CHANCE
    ) {
      nudeExposure = true;
    }
  }
  if (!blackVanEncounter && !wallHoleEncounter && !nudeExposure) {
    adultEncounter = rollAdultOfflineEncounter(state, activity.id, wasLate);
  }

  // 산책: 성인 특수 이벤트가 안 떴을 때만, 아직 데려오지 않은 종류 중 하나를 낮은 확률로 마주친다.
  let petEncounter: PetKind | null = null;
  if (activity.petWalk && !blackVanEncounter && !wallHoleEncounter && !nudeExposure && !adultEncounter) {
    const available = (["dog", "cat"] as PetKind[]).filter((k) => !state.pets[k]);
    if (available.length > 0 && Math.random() < 0.4) {
      petEncounter = pick(available);
    }
  }

  // 크리처: 펫·성인 조우가 하나도 안 뜬 산책 턴에만, 미수집 크리처를 낮은 확률로 마주친다.
  let creatureEncounter: string | null = null;
  if (
    activity.petWalk &&
    !petEncounter &&
    !blackVanEncounter &&
    !wallHoleEncounter &&
    !nudeExposure &&
    !adultEncounter
  ) {
    const uncollected = CREATURES.filter((c) => !state.creatures.includes(c.id));
    if (uncollected.length > 0 && Math.random() < CREATURE_ENCOUNTER_CHANCE) {
      creatureEncounter = pick(uncollected).id;
    }
  }

  // 작가 원고 작업: 작업량 게이지를 채운다
  // (휴가면 발생한 이벤트 문구가 우선한다)
  let message =
    vacationMessage ?? (partTimeMistake ? pick(PART_TIME_MISTAKE_RESULTS) : pick(activity.results));
  // ⑤ 컨디션 판정 문구를 앞에 덧붙인다(휴가·알바실수 등 전용 문구가 있어도 등급은 별도로 알린다).
  // 활동별 전용 문구(activity.failResults/greatResults)가 있으면 그것을, 없으면 공용 문구를 쓴다.
  if (grade === "fail") {
    message = `${pick(activity.failResults ?? FAIL_RESULTS)} ${message}`;
  } else if (grade === "great") {
    message = `${pick(activity.greatResults ?? GREAT_RESULTS)} ${message}`;
  }
  if (activity.authorWork) {
    const r = doAuthorWork(state);
    if (r) {
      message = `${message} 작업량 +${r.gain} (${r.workload}/${r.target})` +
        (r.done ? " — 이번 달 목표 달성!" : "");
    }
  }

  // 꾸미기 활동 직후 에스테틱 정기권 광고 메일 스폰 시도(내부 가드로 중복/재가입/사기중 방지)
  if (activity.id === "grooming") maybeSpawnEstheticAd(state);

  addSchedule(state, `${activity.label}`, "offline");
  advanceTime(state, 1);

  return {
    message,
    grade,
    skillDeltas,
    unlockedAttribute,
    earnedMoney,
    randomSkillLabel,
    petEncounter,
    nudeExposure,
    blackVanEncounter,
    wallHoleEncounter,
    adultEncounter,
    creatureEncounter,
  };
}

/** id로 크리처 정의를 찾는다(도감 표시·수집 문구용) */
export function creatureById(id: string): Creature | undefined {
  return CREATURES.find((c) => c.id === id);
}

/**
 * 산책에서 만난 크리처를 도감에 등록한다(펫 adoptPet 패턴).
 * 이미 수집한 크리처면 아무 일도 하지 않는다(중복 방지).
 * 소소한 일회 보상으로 정신력을 조금 회복한다.
 */
export function collectCreature(state: GameState, id: string): void {
  if (state.creatures.includes(id)) return;
  state.creatures.push(id);
  const c = creatureById(id);
  addSchedule(state, `${c?.name ?? "크리처"} 도감 등록!`, "system");
  state.resources.mental = clampResource(state.resources.mental + 2);
}

/** 반려동물 이름(강아지/고양이) */
export function petLabel(kind: PetKind): string {
  return kind === "dog" ? "강아지" : "고양이";
}

/**
 * 산책에서 만난 동물을 데려온다.
 * 데려오면 그 동물 주접 트윗(강아지계/고양이계) 작성이 열린다.
 */
export function adoptPet(state: GameState, kind: PetKind): void {
  if (state.pets[kind]) return;
  state.pets[kind] = true;
  addSchedule(
    state,
    `${petLabel(kind)}를 데려왔다! 이제 ${petLabel(kind)} 주접 트윗을 올릴 수 있다`,
    "system",
  );
}
