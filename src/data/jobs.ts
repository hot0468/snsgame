import type { CompanyTier, JobTrack } from "@/core/types";
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
  // ⚠️ micro의 requirement가 **음수**인 건 의도다. successChance는 `0.5 + (역량-요건)/80`이라
  //    요건이 곧 '합격률 50% 선'이다. 극소를 0으로 둬도 스킬 0인 초반 플레이어는 딱 50%라
  //    안전망 구실을 못 한다(요건 8이던 시절엔 40%). -20이면 역량 0에서 75%로 시작해
  //    스킬을 조금만 올려도 상한 95%에 붙는다 — 극소는 '떨어지는 곳'이 아니라 '일단 되는 곳'이다.
  //    음수는 표시용이 아니므로 UI(ui/jobplanet)는 Math.max(0, req)로 '0 이상'으로 보여준다.
  micro: { id: "micro", label: "극소기업", requirement: -20, overtimeRate: 0.65, caughtRate: 0.15, baseSalary: 600_000 },
  small: { id: "small", label: "중소기업", requirement: 28, overtimeRate: 0.45, caughtRate: 0.2, baseSalary: 680_000 },
  medium: { id: "medium", label: "중견기업", requirement: 52, overtimeRate: 0.25, caughtRate: 0.28, baseSalary: 800_000 },
  large: { id: "large", label: "대기업", requirement: 78, overtimeRate: 0.1, caughtRate: 0.35, baseSalary: 1_000_000 },
};

/** 등급 순서(약→강) */
export const TIER_ORDER: CompanyTier[] = ["micro", "small", "medium", "large"];

/**
 * 회사원 직급 사다리 — **성과 레벨(`Employment.perfLevel`)이 곧 직급**이다.
 * 인덱스 = 성과 레벨. 레벨이 표를 넘으면 마지막 직급(임원)에 머문다.
 *
 * ⚠️ 승진에 별도 조건을 두지 않는 게 의도다. 성과 레벨업(성과 100 도달)이 이미
 *    "월급 인상"이라는 보상을 갖고 있는데, 거기에 직급 조건을 따로 걸면 두 축이 어긋난다.
 *    직급은 그 레벨업을 **눈에 보이게** 만드는 표시일 뿐이다.
 * ⚠️ 표를 늘리면 그만큼 승진이 늦어진다(레벨당 성과 100). 지금은 6단계까지만 둔다 —
 *    그 위는 실제 플레이 길이를 넘어서 아무도 못 본다.
 */
export const JOB_RANKS = ["사원", "주임", "대리", "과장", "차장", "부장", "이사"] as const;

/** 성과 레벨에 해당하는 직급. 표를 넘어서면 마지막 직급으로 고정된다. */
export function jobRankOf(perfLevel: number): string {
  const i = Math.min(Math.max(perfLevel, 0), JOB_RANKS.length - 1);
  return JOB_RANKS[i];
}

/** 다음 승진 직급(이미 최고 직급이면 null) — UI가 "다음 승진: 대리"를 그릴 때 쓴다. */
export function nextRankIn(perfLevel: number): string | null {
  const i = Math.max(perfLevel, 0) + 1;
  return i < JOB_RANKS.length ? JOB_RANKS[i] : null;
}

/**
 * 직군(트랙) 표시 라벨. UI가 공고 태그를 그릴 때 쓴다.
 * ⚠️ `JobTrack`(core/types)에 값을 추가하면 여기와 systems/employment의 `TRACK_WEIGHTS`를
 *    **반드시 함께** 채워라. 둘 다 `Record<JobTrack, ...>`이라 typecheck가 누락을 잡는다.
 */
export const TRACK_LABELS: Record<JobTrack, string> = {
  office: "사무",
  fitness: "운동",
  beauty: "뷰티",
};

/** 하나의 채용공고 */
export interface JobPosting {
  id: string;
  company: string;
  tier: CompanyTier;
  role: string;
  /**
   * 직군. 합격 판정 스탯이 이 값으로 갈린다(systems/employment.competence).
   * **선택 필드**인 건 의도다 — 생략 시 `"office"`(기존 사무직 공식)로 취급된다.
   * 덕분에 기존 공고 데이터·구세이브·외부 호출부가 손대지 않아도 종전 동작을 유지한다.
   */
  track?: JobTrack;
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

/**
 * 공고 원형. `track` 생략 시 사무직 취급(JobPosting.track 주석과 동일 규칙) — 기존 사무 공고
 * 20개는 문자열에서 `{ role }`로 감싸기만 했을 뿐 의미 변화가 없다.
 */
interface RoleDef {
  role: string;
  track?: JobTrack;
}

const ROLES: Record<CompanyTier, RoleDef[]> = {
  micro: [
    { role: "닭·오리 가공 성실하게 하실 분 급구 (당일 현금지급)" },
    { role: "편의점 야간 파트타이머 모집 (초보 환영, 경력무관)" },
    { role: "물류센터 상하차 단기 알바 모집합니다" },
    { role: "카페 주말 홀서빙 구해요 (성실하신 분)" },
    { role: "전단지 배포·부착 도우미 (일당 지급)" },
    { role: "포장·검수 단순 작업 도와주실 분 구합니다" },
    { role: "동네 헬스장 카운터 겸 청소 알바 구함 (PT 배우고 싶은 분 우대)", track: "fitness" },
    { role: "수영장 안전요원 단기 알바 모집 (구조자격증 없어도 지원 가능)", track: "fitness" },
    { role: "동네 미용실 스태프 구함 (샴푸·청소부터 배웁니다)", track: "beauty" },
    { role: "네일샵 데스크 겸 보조 모집 (손 야무진 분 급구)", track: "beauty" },
  ],
  small: [
    { role: "고객지원(CS) 사원 채용 (정규직 전환 가능)" },
    { role: "온라인 쇼핑몰 운영·CS 사원 모집" },
    { role: "홈인테리어 설치/배송 전문가 양성 2기 모집" },
    { role: "SNS 마케팅 어시스턴트 채용 (신입 가능)" },
    { role: "사무보조·경리 직원 채용합니다" },
    { role: "물류·재고 관리 운영 사원 모집" },
    { role: "필라테스 강사 채용 (자격증 소지자 우대, 무경력 교육 가능)", track: "fitness" },
    { role: "동네 헬스클럽 PT 트레이너 모집 (회원 유치 인센티브 지급)", track: "fitness" },
    { role: "피부관리샵 에스테티션 채용 (신입 교육 후 배치)", track: "beauty" },
    { role: "메이크업숍 디자이너 채용 (웨딩·촬영 메이크업 위주)", track: "beauty" },
  ],
  medium: [
    { role: "콘텐츠 마케팅 매니저 채용 (경력 2년↑)" },
    { role: "영업관리 대리급 채용 (인센티브 별도 지급)" },
    { role: "데이터 운영 담당자 채용 (경력직 우대)" },
    { role: "온라인 MD·상품기획 담당자 채용" },
    { role: "고객경험(CX) 기획 담당자 모집" },
    { role: "프랜차이즈 스포츠센터 수영강사 채용 (자격증 필수)", track: "fitness" },
    { role: "종합피트니스 트레이닝팀 팀장급 채용 (회원관리 경력 우대)", track: "fitness" },
    { role: "체인 에스테틱 브랜드 수석 매니저 채용 (VIP 고객 전담)", track: "beauty" },
    { role: "뷰티 브랜드 헤어디자이너 채용 (경력 3년↑, 지도 가능자 우대)", track: "beauty" },
  ],
  large: [
    { role: "2026 상반기 신입 공채 — 전략기획 부문" },
    { role: "브랜드 마케터 신입사원 채용" },
    { role: "R&D 연구개발 신입사원 모집 (석·박사 우대)" },
    { role: "경영지원 신입 공채 (인사/재무)" },
    { role: "글로벌 영업 신입 공채" },
    { role: "프랜차이즈 피트니스 본사 트레이닝팀 정규직 채용 (전국 지점 교육 총괄)", track: "fitness" },
    { role: "글로벌 스포츠 브랜드 앰버서더 트레이너 채용 (모델 겸 강사)", track: "fitness" },
    { role: "글로벌 뷰티 브랜드 본사 아티스트 채용 (신제품 메이크업 총괄)", track: "beauty" },
    { role: "대형 프랜차이즈 헤어그룹 수석 디렉터 채용 (전국 매장 트렌드 총괄)", track: "beauty" },
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
  const roleDef = pick(ROLES[tier]);
  return {
    id: uid("job"),
    company,
    tier,
    role: roleDef.role,
    track: roleDef.track,
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
