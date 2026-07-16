import type { CompanyTier } from "@/core/types";
import { pick, randInt, sample, uid } from "@/utils/random";

/** 회사 등급별 표시 정보 */
export interface TierDef {
  id: CompanyTier;
  label: string;
  /** 합격에 필요한 역량 기준(높을수록 어렵다) */
  requirement: number;
  /** 하루 야근 확률 */
  overtimeRate: number;
  /** 딴짓(트위터) 적발 확률 */
  caughtRate: number;
}

/**
 * 등급별 정의.
 *
 * ⚠️ overtimeRate와 caughtRate는 **서로 반대 방향**이며, 둘 다 의도된 설계다.
 * - overtimeRate(야근): 등급이 높을수록 **낮다**. 대기업일수록 인력이 갖춰져 워라밸이 산다.
 * - caughtRate(딴짓 적발): 등급이 높을수록 **높다**. 대기업일수록 감시·보안이 심하다.
 * 즉 대기업은 "일찍 퇴근하지만 근무 중 딴짓은 잘 걸린다". 한쪽을 다른 쪽에 맞춰
 * 정렬하지 마라 — 두 축의 상충이 등급 선택의 트레이드오프 그 자체다.
 */
export const TIERS: Record<CompanyTier, TierDef> = {
  micro: { id: "micro", label: "극소기업", requirement: 8, overtimeRate: 0.65, caughtRate: 0.15 },
  small: { id: "small", label: "중소기업", requirement: 28, overtimeRate: 0.45, caughtRate: 0.2 },
  medium: { id: "medium", label: "중견기업", requirement: 52, overtimeRate: 0.25, caughtRate: 0.28 },
  large: { id: "large", label: "대기업", requirement: 78, overtimeRate: 0.1, caughtRate: 0.35 },
};

/** 등급 순서(약→강) */
export const TIER_ORDER: CompanyTier[] = ["micro", "small", "medium", "large"];

/** 하나의 채용공고 */
export interface JobPosting {
  id: string;
  company: string;
  tier: CompanyTier;
  role: string;
  /** 근무요일 */
  workDays: string;
  /** 근무시간 */
  workHours: string;
  /** 급여형태 (월급/시급/회사내규) */
  salaryType: string;
  /** 급여액 표시 텍스트 */
  salaryText: string;
  /** 이 공고가 올라온 게임 day */
  postedDay: number;
}

const NAME_A = [
  "미래", "한빛", "가온", "다올", "정직한", "부지런", "새싹", "번개", "튼튼", "하나로",
  "글로벌", "스마트", "초코", "왕성", "성실",
];
const NAME_B: Record<CompanyTier, string[]> = {
  micro: ["공방", "상회", "스튜디오", "컴퍼니", "랩"],
  small: ["소프트", "테크", "미디어", "커머스", "에이전시"],
  medium: ["시스템즈", "네트웍스", "홀딩스", "인더스트리", "솔루션"],
  large: ["그룹", "전자", "물산", "바이오", "인터내셔널"],
};

const ROLES: Record<CompanyTier, string[]> = {
  micro: [
    "닭·오리 가공 성실하게 하실 분 급구 (당일 현금지급)",
    "편의점 야간 파트타이머 모집 (초보 환영, 경력무관)",
    "물류센터 상하차 단기 알바 모집합니다",
    "카페 주말 홀서빙 구해요 (성실하신 분)",
    "전단지 배포·부착 도우미 (일당 지급)",
    "포장·검수 단순 작업 도와주실 분 구합니다",
  ],
  small: [
    "고객지원(CS) 사원 채용 (정규직 전환 가능)",
    "온라인 쇼핑몰 운영·CS 사원 모집",
    "홈인테리어 설치/배송 전문가 양성 2기 모집",
    "SNS 마케팅 어시스턴트 채용 (신입 가능)",
    "사무보조·경리 직원 채용합니다",
    "물류·재고 관리 운영 사원 모집",
  ],
  medium: [
    "콘텐츠 마케팅 매니저 채용 (경력 2년↑)",
    "영업관리 대리급 채용 (인센티브 별도 지급)",
    "데이터 운영 담당자 채용 (경력직 우대)",
    "온라인 MD·상품기획 담당자 채용",
    "고객경험(CX) 기획 담당자 모집",
  ],
  large: [
    "2026 상반기 신입 공채 — 전략기획 부문",
    "브랜드 마케터 신입사원 채용",
    "R&D 연구개발 신입사원 모집 (석·박사 우대)",
    "경영지원 신입 공채 (인사/재무)",
    "글로벌 영업 신입 공채",
  ],
};

interface SalaryInfo {
  salaryType: string;
  salaryText: string;
}

/** 급여는 전 tier '회사내규'로 표기한다(월급·연봉·시급 금액 미노출). */
function makeSalary(): SalaryInfo {
  return { salaryType: "회사내규", salaryText: "회사내규" };
}

/**
 * 하나의 채용공고를 tier·현재 day 기반으로 생성한다.
 * 급여·게시일을 tier와 개연성 있게 채운다(근무일은 월~금 09:00~18:00 고정).
 */
function makePosting(tier: CompanyTier, currentDay: number): JobPosting {
  const company = `${pick(NAME_A)}${pick(NAME_B[tier])}`;
  const salary = makeSalary();
  return {
    id: uid("job"),
    company,
    tier,
    role: pick(ROLES[tier]),
    workDays: "월~금",
    workHours: "09:00~18:00",
    salaryType: salary.salaryType,
    salaryText: salary.salaryText,
    postedDay: Math.max(1, currentDay - randInt(0, 8)),
  };
}

/**
 * 채용공고 n종을 랜덤으로 생성한다.
 * 등급이 골고루 섞이도록 각 등급을 최소 1개 이상 노출하려 시도한다.
 * @param currentDay 현재 게임 day (공고 게시일 산정용)
 */
export function makeJobPostings(n = 5, currentDay = 0): JobPosting[] {
  const tiers: CompanyTier[] = [...TIER_ORDER];
  // 5칸: 각 등급 1개씩(4) + 랜덤 1개
  const chosen: CompanyTier[] = [...tiers, pick(tiers)];
  const list = sample(chosen, Math.min(n, chosen.length)).map((t) => makePosting(t, currentDay));
  while (list.length < n) list.push(makePosting(pick(tiers), currentDay));
  return list;
}
