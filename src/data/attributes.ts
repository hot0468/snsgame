import type { AttributeId, SkillStatId } from "@/core/types";

export interface AttributeDef {
  id: AttributeId;
  label: string;
  emoji: string;
  /**
   * 프로필 이름 밑에 노출되는 한 줄 소개멘트(1인칭 SNS bio 톤).
   * 내 주 성향(dominantAttribute)은 타임라인에서 자동 산출되므로,
   * 플레이어가 "지금 내 계정이 어느 색으로 물들었는지" 알아채게 하는 힌트 역할이다.
   */
  bio: string;
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
    bio: "별일 없는 하루도 어딘가엔 적어두고 싶어서",
    relatedSkills: ["sociability", "vocabulary"],
    adultOnly: false,
  },
  politics: {
    id: "politics",
    label: "정치계",
    emoji: "",
    bio: "할 말은 합니다. 리트윗은 동의가 아님",
    relatedSkills: ["vocabulary"],
    adultOnly: false,
  },
  idol: {
    id: "idol",
    label: "아이돌덕",
    emoji: "",
    bio: "내 최애가 세상에서 제일 잘함. 이견 안 받음",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  anime: {
    id: "anime",
    label: "애니덕",
    emoji: "",
    bio: "이번 분기도 정주행 중. 원작 얘기는 언제든 환영",
    relatedSkills: ["comedy", "vocabulary"],
    adultOnly: false,
  },
  actor: {
    id: "actor",
    label: "배우덕",
    emoji: "",
    bio: "필모 정주행이 취미. 여운은 며칠씩 갑니다",
    relatedSkills: ["beauty", "vocabulary"],
    adultOnly: false,
  },
  gaming: {
    id: "gaming",
    label: "게임계",
    emoji: "",
    bio: "오늘도 한 판만 하려다 밤 샜습니다",
    // 게임 스킬이 게임계 트윗 성과에 기여한다(systems/steam.ts의 구매·리뷰로 획득).
    // ⚠️ game은 0에서 시작하므로 skillAvg가 2항 평균 → 3항 평균이 되며 초반 성과가 낮아진다.
    //    이는 의도된 설계로, 증기에서 게임을 사고 리뷰할수록 상쇄된다.
    relatedSkills: ["comedy", "sociability", "game"],
    adultOnly: false,
  },
  food: {
    id: "food",
    label: "먹방계",
    emoji: "",
    bio: "맛집 지도 채우는 중. 웨이팅은 두 시간까지 참음",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  fitness: {
    id: "fitness",
    label: "운동계",
    emoji: "",
    bio: "오운완 안 올리면 안 한 거임. 오늘도 갑니다",
    relatedSkills: ["fitness", "beauty"],
    adultOnly: false,
  },
  beauty: {
    id: "beauty",
    label: "뷰티계",
    emoji: "",
    bio: "인생템 찾을 때까지 지갑을 엽니다",
    relatedSkills: ["beauty", "sociability"],
    adultOnly: false,
  },
  humor: {
    id: "humor",
    label: "개그계",
    emoji: "",
    bio: "웃기면 그만이지 뭐. 진지한 건 옆집 가서",
    relatedSkills: ["comedy", "vocabulary"],
    adultOnly: false,
  },
  info: {
    id: "info",
    label: "정보계",
    emoji: "",
    bio: "몰라도 사는 데 지장 없는 꿀팁만 골라 드립니다",
    relatedSkills: ["vocabulary", "sociability"],
    adultOnly: false,
  },
  it: {
    id: "it",
    label: "IT계",
    emoji: "",
    bio: "새벽 세 시에 버그 잡고 새 기기에 지갑 엽니다",
    // it 스킬을 반드시 물린다 — 빼면 IT 스킬이 게임에 아무 영향이 없는 장식이 된다.
    // followers.ts가 성과를 relatedSkills로만 매기므로, 여기 없는 스킬은 올려도 무의미하다
    // (gaming 속성이 game 스킬을 무는 것과 같은 이유).
    relatedSkills: ["vocabulary", "it"],
    adultOnly: false,
  },
  dog: {
    id: "dog",
    label: "강아지계",
    emoji: "",
    bio: "우리 애 자랑하려고 계정 팠습니다",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  cat: {
    id: "cat",
    label: "고양이계",
    emoji: "",
    bio: "집사입니다. 이 계정 주인은 따로 있어요",
    relatedSkills: ["sociability", "beauty"],
    adultOnly: false,
  },
  animal: {
    id: "animal",
    label: "동물계",
    emoji: "",
    bio: "길에서 만난 애들 얘기 하다 보면 하루가 갑니다",
    relatedSkills: ["sociability", "vocabulary"],
    adultOnly: false,
  },
  plant: {
    id: "plant",
    label: "식물계",
    emoji: "",
    bio: "새 잎 하나 났다고 하루 종일 기분 좋은 사람",
    relatedSkills: ["knowledge", "creativity"],
    adultOnly: false,
  },
  cooking: {
    id: "cooking",
    label: "요리계",
    emoji: "",
    bio: "레시피 없이 감으로 합니다. 대체로 성공해요",
    relatedSkills: ["creativity", "sociability"],
    adultOnly: false,
  },
  adult: {
    id: "adult",
    label: "성인계",
    emoji: "",
    bio: "밤에 솔직해지는 계정. 미성년자는 조용히 뒤로",
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
