import type { SkillStatId } from "@/core/types";

/**
 * 자격증 데이터.
 * O넷(o-net.go.kr)에 매일 5종이 랜덤 노출되고, 응시료를 내고 시험을 신청하면
 * 3일 뒤 피메일로 합격/불합격이 통보된다. 취득하면 취업 성공률이 오른다.
 */

/** 하나의 자격증 */
export interface Certification {
  id: string;
  name: string;
  /** 발급기관 — 연출용 */
  issuer: string;
  /** 응시료(원) */
  fee: number;
  /** 합격 판정 스킬과 가중치(합 1.0 권장). competence()처럼 가중 평균한다 */
  skills: Partial<Record<SkillStatId, number>>;
  /** 합격 기준선(0~100 환산 기준). 높을수록 어렵다 */
  requirement: number;
  /** 취업 성공률 보너스(0~1, 예: 0.08 = +8%p) */
  jobBonus: number;
  /** O넷 목록에 뜨는 한 줄 소개 */
  desc: string;
  /**
   * 지정하면 매년 그 날짜에만 O넷에 노출되는 '특별 시행' 자격증(1-based month).
   * 예: `{ month: 1, date: 7 }` = 매년 1월 7일.
   * - 평소에는 랜덤 5종 후보에서 아예 제외된다(todaysCertifications).
   * - 해당 날짜에는 5종과 **별도로** specialCertificationToday로 반환된다(5칸을 잡아먹지 않는다).
   * 연도는 보지 않으므로 매년 반복된다.
   */
  onlyOn?: { month: number; date: number };
}

/**
 * 자격증 목록(20종). 매일 이 중 5종이 O넷에 노출된다.
 * 추가 시: id 중복 금지, skills 가중치 합 1.0 권장, fee·requirement·jobBonus는 서로 정합적으로
 * (비싸고 어려운데 보너스가 낮으면 아무도 안 딴다).
 */
export const CERTIFICATIONS: Certification[] = [
  {
    id: "driver_1",
    name: "1종 보통 운전면허",
    issuer: "한국도로주행공단",
    fee: 30000,
    skills: { fitness: 0.5, knowledge: 0.5 },
    requirement: 18,
    jobBonus: 0.03,
    desc: "굴러가는 쇳덩이를 합법적으로 다루는 첫 관문.",
  },
  {
    id: "gtq",
    name: "GTQ 그래픽기술자격 2급",
    issuer: "한국그래픽진흥원",
    fee: 31000,
    skills: { creativity: 0.6, beauty: 0.4 },
    requirement: 20,
    jobBonus: 0.03,
    desc: "포토샵 좀 만져봤다는 사람의 첫 번째 증명서.",
  },
  {
    id: "word_proc",
    name: "워드프로세서",
    issuer: "한국사무능력검정원",
    fee: 34000,
    skills: { vocabulary: 0.6, knowledge: 0.4 },
    requirement: 24,
    jobBonus: 0.04,
    desc: "표 하나 만드는 데 30분 쓰던 시절과의 작별.",
  },
  {
    id: "barista",
    name: "바리스타 2급",
    issuer: "대한커피애호협회",
    fee: 42000,
    skills: { sociability: 0.5, creativity: 0.3, beauty: 0.2 },
    requirement: 30,
    jobBonus: 0.05,
    desc: "원두 이름을 외우는 순간 대화가 길어진다.",
  },
  {
    id: "comp_active",
    name: "컴퓨터활용능력 2급",
    issuer: "대한상공협의소",
    fee: 45000,
    skills: { knowledge: 0.7, vocabulary: 0.3 },
    requirement: 34,
    jobBonus: 0.05,
    desc: "엑셀 함수 앞에서 당황하지 않는 최소한의 품격.",
  },
  {
    id: "korean_history",
    name: "한국사능력검정 2급",
    issuer: "한국사편찬위원회",
    fee: 52000,
    skills: { knowledge: 0.8, vocabulary: 0.2 },
    requirement: 40,
    jobBonus: 0.06,
    desc: "술자리에서 아무도 못 이기는 근거를 얻는다.",
  },
  {
    id: "bakery",
    name: "제과제빵기능사",
    issuer: "대한제과기능원",
    fee: 58000,
    skills: { creativity: 0.5, fitness: 0.3, beauty: 0.2 },
    requirement: 46,
    jobBonus: 0.07,
    desc: "반죽이 부푸는 시간을 견딜 줄 아는 사람의 증명.",
  },
  {
    id: "webdesign",
    name: "웹디자인기능사",
    issuer: "한국산업기능공단",
    fee: 62000,
    skills: { creativity: 0.5, beauty: 0.3, knowledge: 0.2 },
    requirement: 48,
    jobBonus: 0.08,
    desc: "감각과 코드 사이 어딘가, 국가가 인정한 그 지점.",
  },
  {
    id: "toeic",
    name: "토익 750+",
    issuer: "한국국제어학평가원",
    fee: 64000,
    skills: { vocabulary: 0.6, knowledge: 0.4 },
    requirement: 50,
    jobBonus: 0.08,
    desc: "숫자 세 자리로 사람을 줄 세우는 문명의 언어.",
  },
  {
    id: "hairdresser",
    name: "미용사(일반)",
    issuer: "한국미용인력공단",
    fee: 68000,
    skills: { beauty: 0.7, creativity: 0.3 },
    requirement: 52,
    jobBonus: 0.09,
    desc: "남의 머리에 가위를 대도 되는 국가의 허락.",
  },
  {
    id: "yoga",
    name: "요가지도자 2급",
    issuer: "대한요가연맹",
    fee: 75000,
    skills: { fitness: 0.7, beauty: 0.3 },
    requirement: 55,
    jobBonus: 0.1,
    desc: "숨 쉬는 법부터 다시 배웠다고 말할 수 있게 된다.",
  },
  {
    id: "taekwondo_3",
    name: "태권도 3단",
    issuer: "국기당",
    fee: 80000,
    skills: { fitness: 0.85, sociability: 0.15 },
    requirement: 62,
    jobBonus: 0.11,
    desc: "검은 띠 세 줄. 접어서 가방에 넣고 다니는 자신감.",
  },
  {
    id: "counselor",
    name: "심리상담사 2급",
    issuer: "대한심리상담원",
    fee: 85000,
    skills: { sociability: 0.5, knowledge: 0.3, vocabulary: 0.2 },
    requirement: 64,
    jobBonus: 0.12,
    desc: "남의 이야기를 끝까지 듣는 게 기술이라는 증거.",
  },
  {
    id: "social_worker",
    name: "사회복지사 2급",
    issuer: "한국사회복지인력원",
    fee: 90000,
    skills: { sociability: 0.6, knowledge: 0.4 },
    requirement: 68,
    jobBonus: 0.13,
    desc: "선의만으로는 부족해서 자격증까지 만들었다.",
  },
  {
    id: "info_engineer",
    name: "정보처리기사",
    issuer: "한국정보인력공단",
    fee: 100000,
    skills: { knowledge: 0.7, creativity: 0.3 },
    requirement: 72,
    jobBonus: 0.14,
    desc: "밤을 새워 본 사람만 아는 그 필기 범위.",
  },
  {
    id: "ninja_mid",
    name: "중급닌자",
    issuer: "한국닌자인력공단",
    fee: 110000,
    skills: { fitness: 0.7, comedy: 0.2, creativity: 0.1 },
    requirement: 76,
    jobBonus: 0.15,
    desc: "초급 3년 차, 드디어 그림자를 밟는 것까지는 배웠다.",
  },
  {
    id: "realtor",
    name: "공인중개사",
    issuer: "국토부동산평가원",
    fee: 120000,
    skills: { knowledge: 0.6, sociability: 0.25, vocabulary: 0.15 },
    requirement: 78,
    jobBonus: 0.16,
    desc: "남의 집 이야기로 밥을 먹는 자격.",
  },
  {
    id: "cpa",
    name: "공인회계사",
    issuer: "금융감동원",
    fee: 150000,
    skills: { knowledge: 0.75, vocabulary: 0.25 },
    requirement: 82,
    jobBonus: 0.18,
    desc: "숫자가 맞을 때까지 잠들지 못하는 병의 공식 진단서.",
  },
  {
    id: "pro_hero",
    name: "프로히어로 자격",
    issuer: "국가히어로등록원",
    fee: 160000,
    skills: { fitness: 0.5, sociability: 0.35, comedy: 0.15 },
    requirement: 86,
    jobBonus: 0.2,
    desc: "망토는 본인 부담, 등록증은 국가 발급.",
  },
  {
    id: "lawyer",
    name: "변호사",
    issuer: "대한법조인력원",
    fee: 200000,
    skills: { knowledge: 0.6, vocabulary: 0.4 },
    requirement: 92,
    jobBonus: 0.25,
    desc: "이 나라에서 말로 이기는 가장 비싼 방법.",
  },
  {
    id: "hunter",
    name: "헌터",
    issuer: "한국각성자관리원",
    fee: 300000,
    skills: { fitness: 0.5, knowledge: 0.5 },
    requirement: 96,
    jobBonus: 0.3,
    desc: "1년에 단 하루, 게이트 앞에서 도망치지 않을 사람만 골라낸다.",
    onlyOn: { month: 1, date: 7 },
  },
];
