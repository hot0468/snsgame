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
  /** 성과 레벨 0일 때의 월급(등급이 높을수록 많다) */
  baseSalary: number;
}

/**
 * 등급별 정의.
 *
 * ⚠️ overtimeRate와 caughtRate는 **서로 반대 방향**이며, 둘 다 의도된 설계다.
 * - overtimeRate(야근): 등급이 높을수록 **낮다**. 대기업일수록 인력이 갖춰져 워라밸이 산다.
 * - caughtRate(딴짓 적발): 등급이 높을수록 **높다**. 대기업일수록 감시·보안이 심하다.
 * 즉 대기업은 "일찍 퇴근하지만 근무 중 딴짓은 잘 걸린다". 한쪽을 다른 쪽에 맞춰
 * 정렬하지 마라 — 두 축의 상충이 등급 선택의 트레이드오프 그 자체다.
 *
 * baseSalary는 등급이 높을수록 **많다**. 최저(극소)를 최저생계비 60만으로 잡고 위로 올린다 —
 * 어떤 직업이든 최저생계비는 벌고, 등급이 높을수록 여유가 커진다(대기업 100만 + 월세 반값·평일 생활비 면제).
 * 후반 수입은 광고가 좌우하므로 이 격차는 초·중반에만 크게 체감된다.
 */
export const TIERS: Record<CompanyTier, TierDef> = {
  micro: { id: "micro", label: "극소기업", requirement: 8, overtimeRate: 0.65, caughtRate: 0.15, baseSalary: 600_000 },
  small: { id: "small", label: "중소기업", requirement: 28, overtimeRate: 0.45, caughtRate: 0.2, baseSalary: 680_000 },
  medium: { id: "medium", label: "중견기업", requirement: 52, overtimeRate: 0.25, caughtRate: 0.28, baseSalary: 800_000 },
  large: { id: "large", label: "대기업", requirement: 78, overtimeRate: 0.1, caughtRate: 0.35, baseSalary: 1_000_000 },
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

/** 변호사 자격증 보유자에게만 뜨는 공고의 회사명(테스트·UI가 참조한다) */
export const LAWYER_JOB_COMPANY = "나루호도 법률사무소";

/**
 * 변호사 자격증(`lawyer`) 보유자에게만 뜨는 공고.
 *
 * 등급이 `micro`인 건 의도다 — 가장 어려운 자격증(기준 92)을 따고 극소기업에 가는 게
 * 이 공고의 개그이고, 원작의 그 사무소도 망하기 직전의 구멍가게다. 월급 60만(극소 기본급)·야근률 65%가
 * 붙지만 그건 등급이 정하는 값이지 이 공고의 페널티가 아니다.
 */
function makeLawyerPosting(currentDay: number): JobPosting {
  return {
    id: uid("job"),
    company: LAWYER_JOB_COMPANY,
    tier: "micro",
    role: "형사사건 맡아주실 변호사님 급구 (역전 가능하신 분 우대)",
    workDays: "월~금",
    workHours: "09:00~18:00",
    ...makeSalary(),
    postedDay: Math.max(1, currentDay - randInt(0, 8)),
  };
}

/** 개발자 공고를 목록에 띄우는 IT 스킬 문턱(스킬 0~999 스케일). 이 값 이상이면 노출된다. */
export const DEV_JOB_IT_REQ = 100;

/** IT 스킬 문턱을 넘긴 플레이어에게만 뜨는 개발자 공고의 회사명(테스트·UI가 참조한다). */
export const DEV_JOB_COMPANY = "우주최강소프트";

/**
 * IT 스킬이 `DEV_JOB_IT_REQ` 이상일 때만 뜨는 개발자 전용 공고.
 *
 * 오리지널 판교 IT 스타트업 패러디("우주최강"은 유니콘 되기 전부터 우주정복을 외치는
 * 스타트업 특유의 허장성세 개그). 등급이 `large`인 건 의도다 — IT 스킬 문턱을 넘긴
 * 보상으로 대기업 급여(월 100만)·낮은 야근률을 준다. 성과는 UI에서 커밋 잔디로 표시된다.
 */
function makeDevPosting(currentDay: number): JobPosting {
  return {
    id: uid("job"),
    company: DEV_JOB_COMPANY,
    tier: "large",
    role: "주니어 백엔드 개발자 채용 (커밋으로 말하는 분)",
    workDays: "월~금",
    workHours: "09:00~18:00",
    ...makeSalary(),
    postedDay: Math.max(1, currentDay - randInt(0, 8)),
  };
}

/**
 * 채용공고 n종을 랜덤으로 생성한다.
 * 등급이 골고루 섞이도록 각 등급을 최소 1개 이상 노출하려 시도한다.
 *
 * @param currentDay 현재 게임 day (공고 게시일 산정용)
 * @param hasLawyer 변호사 자격증 보유 여부. true면 5칸 중 **한 칸이** 나루호도 법률사무소로
 *   바뀐다(칸을 늘리지 않는다 — 사용자 확정).
 * @param hasDev IT 스킬 문턱 통과 여부. true면 5칸 중 **한 칸이** 우주최강소프트로 바뀐다.
 *   lawyer와 dev가 둘 다 true면 서로 다른 칸을 차지해 각각 한 칸씩 노출된다(칸을 늘리지 않는다).
 *
 * ⚠️ 자격증·스킬 보유 여부를 여기서 직접 조회하지 않고 **인자로 받는** 건 계층 규칙 때문이다.
 *    `hasCertification`은 systems에 있고 data는 systems를 import할 수 없다(data → systems → ui).
 *    호출부(ui)가 조회해서 넘긴다.
 */
export function makeJobPostings(n = 5, currentDay = 0, hasLawyer = false, hasDev = false): JobPosting[] {
  const tiers: CompanyTier[] = [...TIER_ORDER];
  // 5칸: 각 등급 1개씩(4) + 랜덤 1개
  const chosen: CompanyTier[] = [...tiers, pick(tiers)];
  const list = sample(chosen, Math.min(n, chosen.length)).map((t) => makePosting(t, currentDay));
  while (list.length < n) list.push(makePosting(pick(tiers), currentDay));
  // 특별 공고는 무작위 칸을 차지한다 — 항상 맨 위면 티가 나서 목록을 읽을 이유가 없어진다.
  // lawyer·dev가 둘 다면 서로 다른 칸에 넣어 공존시킨다(taken으로 중복 방지).
  const taken: number[] = [];
  const freeSlot = (): number => {
    const open = list.map((_, i) => i).filter((i) => !taken.includes(i));
    const idx = open.length ? pick(open) : randInt(0, list.length - 1);
    taken.push(idx);
    return idx;
  };
  if (hasLawyer && list.length > 0) list[freeSlot()] = makeLawyerPosting(currentDay);
  if (hasDev && list.length > 0) list[freeSlot()] = makeDevPosting(currentDay);
  return list;
}
