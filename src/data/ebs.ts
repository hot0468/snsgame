import type { SkillStatId } from "@/core/types";

/** EBS(교육방송) 패러디 인터넷 강의 1편. 편당 3,000원 + 행동력 8로 시청(로직은 systems/ebs.ts). */
export interface EbsLecture {
  id: string;
  title: string;
  instructor: string;
  /** 오르는 세부 스킬. "performance"는 업무 성과(재직 중에만 수강 가능). */
  stat: SkillStatId | "performance";
  /** 스킬은 +12~18, performance는 +8~12(성과는 0~100 스케일). */
  amount: number;
  desc: string;
}

/** EBS 패러디 사이트명(네이놈에서 "듄" 검색 시 열림). */
export const EBS_SITE_NAME = "이비에듀";

export const EBS_LECTURES: EbsLecture[] = [
  {
    id: "lec_python",
    title: "왕초보 파이썬 30일 완성",
    instructor: "김코딩",
    stat: "it",
    amount: 15,
    desc: "변수부터 함수까지, 코딩 처음이어도 따라오게 만드는 진짜 기초반.",
  },
  {
    id: "lec_writing",
    title: "읽히는 글쓰기: 첫 문장의 기술",
    instructor: "문지현",
    stat: "vocabulary",
    amount: 14,
    desc: "어휘를 늘리고 문장을 다듬는다. 블로그·에세이·자소서까지 통하는 글쓰기.",
  },
  {
    id: "lec_interview",
    title: "합격하는 면접 스피치 10강",
    instructor: "한서준",
    stat: "sociability",
    amount: 16,
    desc: "긴장은 줄이고 호감은 올리고. 자기소개부터 압박 질문 대처까지.",
  },
  {
    id: "lec_history",
    title: "하룻밤에 끝내는 세계사 흐름 잡기",
    instructor: "오세경",
    stat: "knowledge",
    amount: 17,
    desc: "연도 암기 말고 흐름으로. 큰 그림이 잡히면 나머지는 저절로 따라온다.",
  },
  {
    id: "lec_makeup",
    title: "데일리 메이크업 기초부터 실전까지",
    instructor: "유하늘",
    stat: "beauty",
    amount: 13,
    desc: "손이 서툴러도 괜찮다. 베이스 잡는 법부터 상황별 데일리 룩까지.",
  },
  {
    id: "lec_design",
    title: "감각은 타고나지 않는다: 기획·디자인 입문",
    instructor: "정라온",
    stat: "creativity",
    amount: 15,
    desc: "아이디어를 정리하고 보기 좋게 구성하는 법. 발표 자료가 달라진다.",
  },
  {
    id: "lec_speech",
    title: "웃기는 사람이 이긴다: 유머 스피치",
    instructor: "박두식",
    stat: "comedy",
    amount: 14,
    desc: "타고난 입담이 없어도 배운다. 분위기 살리는 말맛과 타이밍의 기술.",
  },
  {
    id: "lec_workbasic",
    title: "신입이 알아야 할 직장 실무 A to Z",
    instructor: "서미란",
    stat: "performance",
    amount: 10,
    desc: "보고·메일·회의 매너까지. 일 잘한다는 소리 듣는 사람들의 기본기.",
  },
  {
    id: "lec_excel",
    title: "야근 줄이는 실무 엑셀 필살기",
    instructor: "강태오",
    stat: "performance",
    amount: 9,
    desc: "함수 몇 개로 반나절 일이 10분. 실무에서 바로 쓰는 엑셀만 골라 담았다.",
  },
];
