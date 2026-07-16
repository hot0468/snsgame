import type { AttributeId, SkillStatId } from "@/core/types";

export interface AttributeDef {
  id: AttributeId;
  label: string;
  emoji: string;
  /** 이 성향 트윗 성과에 기여하는 세부 스탯들 */
  relatedSkills: SkillStatId[];
  /** 성인물 해제가 필요한 성향인지 */
  adultOnly: boolean;
}

export const ATTRIBUTES: Record<AttributeId, AttributeDef> = {
  daily: {
    id: "daily",
    label: "일상계",
    emoji: "",
    relatedSkills: ["sociability", "vocabulary"],
    adultOnly: false,
  },
  politics: {
    id: "politics",
    label: "정치계",
    emoji: "",
    relatedSkills: ["vocabulary"],
    adultOnly: false,
  },
  idol: {
    id: "idol",
    label: "아이돌덕",
    emoji: "",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  anime: {
    id: "anime",
    label: "애니덕",
    emoji: "",
    relatedSkills: ["comedy", "vocabulary"],
    adultOnly: false,
  },
  actor: {
    id: "actor",
    label: "배우덕",
    emoji: "",
    relatedSkills: ["beauty", "vocabulary"],
    adultOnly: false,
  },
  gaming: {
    id: "gaming",
    label: "게임계",
    emoji: "",
    relatedSkills: ["comedy", "sociability"],
    adultOnly: false,
  },
  food: {
    id: "food",
    label: "먹방계",
    emoji: "",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  fitness: {
    id: "fitness",
    label: "운동계",
    emoji: "",
    relatedSkills: ["fitness", "beauty"],
    adultOnly: false,
  },
  beauty: {
    id: "beauty",
    label: "뷰티계",
    emoji: "",
    relatedSkills: ["beauty", "sociability"],
    adultOnly: false,
  },
  humor: {
    id: "humor",
    label: "개그계",
    emoji: "",
    relatedSkills: ["comedy", "vocabulary"],
    adultOnly: false,
  },
  info: {
    id: "info",
    label: "정보계",
    emoji: "",
    relatedSkills: ["vocabulary", "sociability"],
    adultOnly: false,
  },
  it: {
    id: "it",
    label: "IT계",
    emoji: "",
    relatedSkills: ["vocabulary"],
    adultOnly: false,
  },
  dog: {
    id: "dog",
    label: "강아지계",
    emoji: "",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  cat: {
    id: "cat",
    label: "고양이계",
    emoji: "",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  animal: {
    id: "animal",
    label: "동물계",
    emoji: "",
    relatedSkills: ["sociability", "vocabulary"],
    adultOnly: false,
  },
  plant: {
    id: "plant",
    label: "식물계",
    emoji: "",
    relatedSkills: ["knowledge", "creativity"],
    adultOnly: false,
  },
  cooking: {
    id: "cooking",
    label: "요리계",
    emoji: "",
    relatedSkills: ["creativity", "sociability"],
    adultOnly: false,
  },
  adult: {
    id: "adult",
    label: "성인계",
    emoji: "",
    relatedSkills: ["lewd", "beauty"],
    adultOnly: true,
  },
};

export const ALL_ATTRIBUTE_IDS = Object.keys(ATTRIBUTES) as AttributeId[];

/**
 * 성향 간 궁합표.
 * 값 > 0 : 우호적(팔로우 시 팔로워 증가 경향)
 * 값 < 0 : 상충(언팔로우 발생 경향)
 * 정의되지 않은 쌍은 0(중립)으로 본다.
 */
const AFFINITY: Partial<Record<AttributeId, Partial<Record<AttributeId, number>>>> = {
  daily: { daily: 1, politics: -1, adult: -1, food: 1, idol: 1, dog: 1, cat: 1, animal: 1, plant: 1 },
  politics: { politics: 1, daily: -1, humor: -1, adult: -1 },
  idol: { idol: 1, actor: 1, daily: 1, beauty: 1, politics: -1 },
  anime: { anime: 1, gaming: 1, humor: 1, daily: 1, politics: -1 },
  actor: { actor: 1, idol: 1, daily: 1, beauty: 1, politics: -1 },
  gaming: { gaming: 1, anime: 1, humor: 1, politics: -1 },
  food: { food: 1, daily: 1, fitness: -1, cooking: 1 },
  fitness: { fitness: 1, beauty: 1, food: -1, adult: -1 },
  beauty: { beauty: 1, idol: 1, actor: 1, fitness: 1, adult: 1 },
  humor: { humor: 1, gaming: 1, anime: 1, politics: -1 },
  info: { info: 1, it: 1, daily: 1, politics: 1, fitness: 1 },
  it: { it: 1, info: 1, gaming: 1, anime: 1, humor: 1 },
  dog: { dog: 1, cat: 1, animal: 1, daily: 1, beauty: 1 },
  cat: { cat: 1, dog: 1, animal: 1, daily: 1, beauty: 1 },
  animal: { animal: 1, dog: 1, cat: 1, daily: 1, plant: 1, food: 1, politics: -1 },
  plant: { plant: 1, daily: 1, animal: 1, dog: 1, cat: 1, beauty: 1, cooking: 1 },
  cooking: { cooking: 1, food: 1, daily: 1, plant: 1, fitness: -1 },
  adult: { adult: 1, beauty: 1, daily: -1, politics: -1, fitness: -1 },
};

/** 내 성향(mine)이 상대(other)를 팔로우/조우했을 때의 궁합 값 */
export function getAffinity(mine: AttributeId, other: AttributeId): number {
  if (mine === other) return 1;
  return AFFINITY[mine]?.[other] ?? 0;
}
