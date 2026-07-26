import type { AttributeId, GameState, PetKind, SkillStatId } from "@/core/types";
import { getActiveAccount, LATE_SLOT, SLOTS_PER_DAY } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { ALL_ATTRIBUTE_IDS } from "@/data/attributes";
import { SKILL_STATS } from "@/data/stats";
import { pick } from "@/utils/random";
import { clampAction, clampResource, gainSkill, gainStamina, STAMINA_MAX_CAP } from "./stats";
import { REST_STAMINA, WORKOUT_STAMINA, WORKOUT_STAMINA_MAX_GAIN, AUTHOR_WORK_STAMINA } from "./health";
import { addSchedule, advanceTime } from "./time";
import { doAuthorWork } from "./author";
import { estheticBeautyMult, maybeSpawnEstheticAd } from "./esthetic";
import { unlockAttribute } from "./attributeUnlock";
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
  group: "rest" | "study" | "growth";
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
  /** 아르바이트: 급여가 누적 횟수에 따라 동적으로 계산된다 */
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
  /** 활동 후 올릴 수 있는 트윗의 속성과 문구 */
  tweetAttr: AttributeId;
  tweetLines: string[];
}

/** 오프라인 활동 실행 결과 */
export interface OfflineOutcome {
  /** 결과 팝업에 표시할 분위기 문구 */
  message: string;
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

/** 아르바이트 기본 일당 */
export const PART_TIME_BASE = 10_000;
/** 급여 상승 단위(횟수) */
const PART_TIME_TIER = 3;
/** 단계마다 오르는 금액 */
const PART_TIME_RAISE = 5_000;

/** 누적 횟수(count)에 따른 다음 아르바이트 일당 */
export function partTimePay(count: number): number {
  return PART_TIME_BASE + Math.floor(count / PART_TIME_TIER) * PART_TIME_RAISE;
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
    skillGains: { sociability: 7 },
    unlockAttributePool: ["daily", "food", "beauty", "idol", "animal", "cooking"],
    results: [
      "여유있게 시간을 보냈다.",
      "거리를 걷다 보니 기분이 한결 가벼워졌다.",
      "햇볕을 쬐며 동네 한 바퀴를 돌았다.",
      "카페에 앉아 사람 구경을 하다 왔다.",
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
    skillGains: { sociability: 5, fitness: 2 },
    petWalk: true,
    results: [
      "선선한 바람을 맞으며 동네를 한 바퀴 돌았다.",
      "골목골목을 누비며 느긋하게 걸었다.",
      "천천히 걷다 보니 머릿속이 맑아졌다.",
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
    skillGains: { lewd: 12 },
    results: [
      "이불 속에서 혼자만의 은밀한 시간을 보내고 나니 몸도 마음도 나른하게 풀렸다.",
      "야릇한 상상에 한참 빠져 있다 나왔더니 묘하게 개운하다.",
      "달아오른 밤을 조용히 달래며 흘려보냈다. 이상하게 잠은 잘 올 것 같다.",
      "혼자만의 시간에 흠뻑 젖었다. 아무에게도 말 못 할 비밀이 하나 늘었다.",
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
    skillGains: { vocabulary: 10, knowledge: 10 },
    // 미술·코딩을 EBS로 옮기며 코딩이 갖던 IT계 해금을 교양이 이어받는다(현생 유일 IT계 해금 경로 유지).
    unlockAttributePool: ["politics", "humor", "info", "plant", "it"],
    results: [
      "책장을 넘기며 머릿속을 정리했다.",
      "조용히 집중하는 시간을 가졌다.",
      "새로 알게 된 것들을 노트에 적어뒀다.",
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
    skillGains: { comedy: 12 },
    unlockAttributePool: ["humor"],
    results: [
      "웃긴 짤을 모으다 보니 어느새 나만의 드립 노트가 두둑해졌다.",
      "예능을 돌려보며 웃음 타이밍과 밈을 연구했다. 포인트가 보이기 시작한다.",
      "거울 앞에서 개그를 연습하다 혼자 빵 터졌다.",
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
    skillGains: { sociability: 5 },
    results: [
      "땀 흘려 남을 도우니 마음 한구석이 따뜻해졌다.",
      "고맙다는 말 한마디에 하루의 피로가 싹 가셨다.",
      "봉사 끝에 다 같이 나눠 먹은 밥이 유난히 맛있었다.",
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
    skillGains: { fitness: 10, beauty: 2 },
    unlockAttributePool: ["fitness"],
    results: [
      "땀을 쫙 빼고 나니 상쾌하다.",
      "거울 속 내 모습이 조금 달라 보인다.",
      "근육통이 밀려오지만 왠지 뿌듯하다.",
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
    skillGains: { beauty: 10 },
    results: [
      "거울 앞에서 이것저것 손보니 한결 태가 난다.",
      "관리를 받고 나오니 피부가 반질반질 윤이 난다.",
      "새로 산 화장품으로 메이크업을 요리조리 연습해봤다.",
      "헤어숍에서 스타일을 바꾸고 나니 기분까지 산뜻해졌다.",
    ],
    tweetAttr: "beauty",
    tweetLines: ["피부 관리 받고 왔더니 광 미쳤다 ✨ #셀프관리", "헤어 새로 하고 화장 바꿨더니 딴사람 됨 오늘 나 좀 예쁨"],
  },
  {
    id: "parttime",
    label: "아르바이트",
    emoji: "",
    group: "growth",
    description: "잠깐 일하며 생활비를 번다.",
    action: -25,
    mental: -10,
    partTime: true,
    results: [
      "묵묵히 근무를 마치고 일당을 받았다.",
      "고된 하루였지만 통장이 조금 든든해졌다.",
      "손에 익어 예전보다 수월하게 일했다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["알바 끝, 오늘도 고생한 나에게 박수", "일당 벌었다 통장이 조금 든든"],
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

  // 아르바이트: 누적 횟수에 따라 급여가 오른다
  let earnedMoney: number | null = null;
  let partTimeMistake = false;
  if (activity.partTime) {
    // 친화력이 매우 낮으면 손님 응대가 버거워 정신력이 추가로 깎인다.
    // 실수 판정 '전에' 적용 → 낮은 친화력이 멘탈을 더 떨어뜨려 실수 확률까지 높인다(연쇄).
    if (state.skills.sociability < PART_TIME_LOW_SOCIAL) {
      state.resources.mental = clampResource(state.resources.mental - PART_TIME_LOW_SOCIAL_MENTAL);
    }
    earnedMoney = partTimePay(state.partTimeCount);
    // 정신력이 매우 낮으면 확률적으로 실수/사건 → 일당 절반.
    // ⚠️ mental 클램프는 이 함수 맨 위(activity.mental 반영)에서 이미 끝났으므로 갱신된 값을 본다.
    if (state.resources.mental < PART_TIME_MISTAKE_MENTAL && Math.random() < PART_TIME_MISTAKE_CHANCE) {
      earnedMoney = Math.round(earnedMoney / 2);
      partTimeMistake = true;
    }
    state.money += earnedMoney;
    state.partTimeCount += 1;
  }

  // 꾸미기(grooming)의 매력(beauty) 상승분은 에스테틱 정품 회원이면 1.5배(estheticBeautyMult).
  // grooming만이 '꾸미기' 활동이다(운동의 부수 beauty +2는 대상 아님).
  const isGrooming = activity.id === "grooming";
  for (const [skill, amount] of Object.entries(activity.skillGains ?? {})) {
    let amt = amount ?? 0;
    if (isGrooming && skill === "beauty") amt = Math.round(amt * estheticBeautyMult(state));
    gainSkill(state, skill as SkillStatId, amt);
  }

  // 랜덤 스탯 상승(예: 유튜브 → 미용/개그 중 하나)
  let randomSkillLabel: string | null = null;
  if (activity.randomSkillPool) {
    const key = pick(activity.randomSkillPool.pool);
    const gained = gainSkill(state, key, activity.randomSkillPool.amount);
    randomSkillLabel = `${SKILL_STATS[key].label} +${gained}`;
  }

  // 휴가: 20개 이벤트 중 하나가 랜덤 발생 → 특정 스킬↑ (행동력·정신력·비용은 위에서 이미 반영).
  //       발생 이벤트의 문구가 결과 메시지를 덮고, 오른 스킬은 randomSkillLabel로 표시한다.
  let vacationMessage: string | null = null;
  if (activity.vacation) {
    const ev = pick(VACATION_EVENTS);
    const gained = gainSkill(state, ev.stat, ev.amount);
    randomSkillLabel = `${SKILL_STATS[ev.stat].label} +${gained}`;
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

  // 성인 특수 우선순위: (산책) 봉고 > 심야 야외노출 > 활동별 조우 > 길동물
  let blackVanEncounter = false;
  let nudeExposure = false;
  let adultEncounter: AdultOfflineEncounterId | null = null;
  if (activity.petWalk && state.adultMode) {
    // 검정 봉고 납치(비합의/범죄)는 '강압/범죄 안 보기' 켜면 건너뛴다 → 노출/길동물로 폴백.
    if (
      !state.adultNoCoercion &&
      state.skills.lewd >= BLACK_VAN_LEWD_MIN &&
      Math.random() < BLACK_VAN_CHANCE
    ) {
      blackVanEncounter = true;
    } else if (
      wasLate &&
      state.skills.lewd >= NUDE_EXPOSURE_LEWD_MIN &&
      Math.random() < NUDE_EXPOSURE_CHANCE
    ) {
      nudeExposure = true;
    }
  }
  if (!blackVanEncounter && !nudeExposure) {
    adultEncounter = rollAdultOfflineEncounter(state, activity.id, wasLate);
  }

  // 산책: 성인 특수 이벤트가 안 떴을 때만, 아직 데려오지 않은 종류 중 하나를 낮은 확률로 마주친다.
  let petEncounter: PetKind | null = null;
  if (activity.petWalk && !blackVanEncounter && !nudeExposure && !adultEncounter) {
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
  if (activity.authorWork) {
    const r = doAuthorWork(state);
    if (r) {
      message = `${message} 작업량 +${r.gain} (${r.workload}/${r.target})` +
        (r.done ? " — 이번 달 목표 달성!" : "");
    }
  }

  // 꾸미기 활동 직후 에스테틱 정기권 광고 메일 스폰 시도(내부 가드로 중복/재가입/사기중 방지)
  if (isGrooming) maybeSpawnEstheticAd(state);

  addSchedule(state, `${activity.label}`, "offline");
  advanceTime(state, 1);

  return {
    message,
    unlockedAttribute,
    earnedMoney,
    randomSkillLabel,
    petEncounter,
    nudeExposure,
    blackVanEncounter,
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
