import type { AttributeId, GameState, PetKind, SkillStatId } from "@/core/types";
import { getActiveAccount, LATE_SLOT } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { ALL_ATTRIBUTE_IDS } from "@/data/attributes";
import { SKILL_STATS } from "@/data/stats";
import { pick } from "@/utils/random";
import { clampAction, clampResource, clampSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";
import { doAuthorWork } from "./author";
import { unlockAttribute } from "./attributeUnlock";

export interface OfflineActivity {
  id: string;
  label: string;
  emoji: string;
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
}

/** 심야 산책 야외노출 이벤트가 뜨는 최소 음란도 */
export const NUDE_EXPOSURE_LEWD_MIN = 400;
/** 조건 충족 시 야외노출 이벤트 발생 확률 */
export const NUDE_EXPOSURE_CHANCE = 0.4;

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

export const OFFLINE_ACTIVITIES: OfflineActivity[] = [
  {
    id: "goout",
    label: "외출",
    emoji: "",
    description: "밖에 나가 견문을 넓힌다. 새로운 트윗 소재를 얻을 수 있다.",
    action: -20,
    mental: +10,
    skillGains: { sociability: 15 },
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
    description: "동네를 천천히 걷는다. 가끔 길 잃은 강아지나 고양이를 만날 수도 있다.",
    action: -12,
    mental: +12,
    skillGains: { sociability: 10, fitness: 5 },
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
    label: "휴식",
    emoji: "",
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
    id: "study",
    label: "공부",
    emoji: "",
    description: "책상 앞에서 어휘력과 지식을 쌓는다.",
    action: -15,
    mental: -10,
    skillGains: { vocabulary: 25, knowledge: 25 },
    unlockAttributePool: ["politics", "humor", "info", "it", "plant"],
    results: [
      "책장을 넘기며 머릿속을 정리했다.",
      "조용히 집중하는 시간을 가졌다.",
      "새로 알게 된 것들을 노트에 적어뒀다.",
    ],
    tweetAttr: "daily",
    tweetLines: ["오늘 공부 좀 했다 뿌듯", "책 읽는데 생각보다 재밌네"],
  },
  {
    id: "workout",
    label: "운동",
    emoji: "",
    description: "땀 흘리며 몸을 단련한다.",
    action: -25,
    mental: +5,
    skillGains: { fitness: 25, beauty: 5 },
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
    id: "parttime",
    label: "아르바이트",
    emoji: "",
    description: "잠깐 일하며 생활비를 번다. 오래 할수록 시급이 오른다.",
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
    description: "작가 원고 작업으로 이번 달 작업량을 채운다. (창작·어휘력·개그·지식이 높을수록 잘 채워짐)",
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

  // 아르바이트: 누적 횟수에 따라 급여가 오른다
  let earnedMoney: number | null = null;
  if (activity.partTime) {
    earnedMoney = partTimePay(state.partTimeCount);
    state.money += earnedMoney;
    state.partTimeCount += 1;
  }

  for (const [skill, amount] of Object.entries(activity.skillGains ?? {})) {
    const key = skill as SkillStatId;
    state.skills[key] = clampSkill(state.skills[key] + (amount ?? 0));
  }

  // 랜덤 스탯 상승(예: 유튜브 → 미용/개그 중 하나)
  let randomSkillLabel: string | null = null;
  if (activity.randomSkillPool) {
    const key = pick(activity.randomSkillPool.pool);
    state.skills[key] = clampSkill(state.skills[key] + activity.randomSkillPool.amount);
    randomSkillLabel = `${SKILL_STATS[key].label} +${activity.randomSkillPool.amount}`;
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

  // 심야 산책: 성인물 해제 + 음란이 높으면 확률적으로 야외노출 이벤트가 뜬다.
  let nudeExposure = false;
  if (activity.petWalk && wasLate) {
    const acc = getActiveAccount(state);
    if (
      acc.adultMode &&
      state.skills.lewd >= NUDE_EXPOSURE_LEWD_MIN &&
      Math.random() < NUDE_EXPOSURE_CHANCE
    ) {
      nudeExposure = true;
    }
  }

  // 산책: 야외노출이 안 떴을 때만, 아직 데려오지 않은 종류 중 하나를 낮은 확률로 마주친다.
  let petEncounter: PetKind | null = null;
  if (activity.petWalk && !nudeExposure) {
    const available = (["dog", "cat"] as PetKind[]).filter((k) => !state.pets[k]);
    if (available.length > 0 && Math.random() < 0.4) {
      petEncounter = pick(available);
    }
  }

  // 작가 원고 작업: 작업량 게이지를 채운다
  let message = pick(activity.results);
  if (activity.authorWork) {
    const r = doAuthorWork(state);
    if (r) {
      message = `${message} 작업량 +${r.gain} (${r.workload}/${r.target})` +
        (r.done ? " — 이번 달 목표 달성!" : "");
    }
  }

  addSchedule(state, `${activity.label}`, "offline");
  advanceTime(state, 1);

  return {
    message,
    unlockedAttribute,
    earnedMoney,
    randomSkillLabel,
    petEncounter,
    nudeExposure,
  };
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
