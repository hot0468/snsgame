import type { SkillStatId } from "@/core/types";

/** 마일스톤 문턱 4구간(오름차순). 인덱스 = tier. */
export const MILESTONE_THRESHOLDS = [100, 300, 600, 999] as const;

/**
 * 스킬별 4개 칭호(tier 0~3 오름차순). 한 스킬 안에서 서사적으로 상승한다.
 * ⚠️ Record<SkillStatId, ...>라 11개 스킬 전부 있어야 컴파일된다(개수 보증).
 */
export const MILESTONE_TITLES: Record<SkillStatId, [string, string, string, string]> = {
  fitness: ["동네 헬스 입문", "주 5일 헬창", "바디프로필 각", "인간 병기"],
  beauty: ["거울 좀 봄", "셀카 장인", "화보 각", "걸어다니는 뷰티템"],
  vocabulary: ["맞춤법 졸업", "드립 사전", "글빨 좀 침", "문장의 연금술사"],
  knowledge: ["상식 채움", "잡학다식", "걸어다니는 위키", "인간 백과사전"],
  sociability: ["인싸 지망생", "친구 부자", "인맥 왕", "모두의 최애"],
  comedy: ["아재개그 입문", "드립력 상승", "타임라인 광대", "밈 제조기"],
  creativity: ["끄적이는 사람", "떡밥 장인", "콘텐츠 공장", "창작의 신"],
  lewd: ["야한 상상", "수위 조절 실패", "선넘는 트친", "금지된 지식"],
  game: ["뉴비 탈출", "겜창 인증", "랭커의 향기", "프로게이머 각"],
  it: ["복붙 코더", "스택오버플로 순례자", "풀스택 각", "코드의 마법사"],
  otaku: ["입덕 부정기", "성지순례러", "굿즈 파산", "찐텐 덕후"],
};

/** 마일스톤 고유 id: `${skill}:${tier}` */
export function milestoneId(skill: SkillStatId, tier: number): string {
  return `${skill}:${tier}`;
}

/** 마일스톤 대상 스킬 목록(= MILESTONE_TITLES의 키). */
export const SKILL_MILESTONE_IDS = Object.keys(MILESTONE_TITLES) as SkillStatId[];
