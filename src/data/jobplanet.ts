import type { CompanyTier } from "@/core/types";

/**
 * 직플래닛(잡플래닛 패러디) 기업 디렉터리 — 그날 뜨는 채용공고와 무관한 '전체 업체' 목록.
 * 합격 요건은 등급(tier)에 달렸으므로(systems/employment.successChance), 각 업체는 등급만 갖는다.
 * 이름은 전부 창작/패러디(실존 기업 없음). jobs.ts의 작명 결(NAME_A+NAME_B)을 따른다.
 */
export interface JobplanetCompany {
  name: string;
  tier: CompanyTier;
}

export const JOBPLANET_COMPANIES: JobplanetCompany[] = [
  // 극소기업
  { name: "가온공방", tier: "micro" },
  { name: "다올상회", tier: "micro" },
  { name: "새싹스튜디오", tier: "micro" },
  { name: "튼튼컴퍼니", tier: "micro" },
  { name: "번개랩", tier: "micro" },
  // 중소기업
  { name: "한빛소프트", tier: "small" },
  { name: "미래테크", tier: "small" },
  { name: "정직한미디어", tier: "small" },
  { name: "초코커머스", tier: "small" },
  { name: "부지런에이전시", tier: "small" },
  // 중견기업
  { name: "글로벌시스템즈", tier: "medium" },
  { name: "스마트네트웍스", tier: "medium" },
  { name: "왕성홀딩스", tier: "medium" },
  { name: "하나로인더스트리", tier: "medium" },
  { name: "성실솔루션", tier: "medium" },
  // 대기업
  { name: "미래그룹", tier: "large" },
  { name: "한빛전자", tier: "large" },
  { name: "글로벌물산", tier: "large" },
  { name: "왕성바이오", tier: "large" },
  { name: "스마트인터내셔널", tier: "large" },
];
