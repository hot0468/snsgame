import type { SkillStatId } from "@/core/types";

/**
 * 재능마켓(외주) 데이터.
 * 네이놈 검색창에 "외주" 입력 시 뜨는 크몽 패러디 사이트에 노출되는 외주 건 목록.
 * 수주 후 데드라인 안에 workload를 채우면 성공(reward+reputation), 못 채우면 실패(penalty+평판↓).
 * 진행 공식(1회 작업량 = round(30 * 내스탯 / reqStat))은 systems/gig.ts 소관 — 여기선 선언만.
 */

/** 하나의 외주 건 */
export interface GigJob {
  id: string;
  title: string; // 의뢰 제목
  client: string; // 의뢰처(패러디 기업/개인)
  stat: SkillStatId; // 요구 스탯 1종
  reqStat: number; // 요구 스탯 권장치(0~999 스케일). 진행 속도 기준 + 표시용
  workload: number; // 목표 작업량(진행도 목표)
  deadlineDays: number; // 수주 후 며칠 안에
  reward: number; // 성공 보상(원)
  reputation: number; // 성공 시 평판 +(0~100 스케일, +3~8)
  penalty: number; // 실패 시 위약금(원)
  desc: string; // 의뢰 상세
}

/** 크몽 패러디 사이트명 */
export const GIG_SITE_NAME = "끄몽";

/**
 * 외주 목록(9건). 요구 스탯을 쉬움~어려움으로 벌리고, 어려울수록 보상·위약금 모두 커진다(단조).
 * 추가 시: id 중복 금지, reqStat 오름차순으로 두면 난이도 곡선 확인이 쉽다.
 */
export const GIG_JOBS: GigJob[] = [
  {
    id: "gig_blog_review",
    title: "블로그 체험단 후기 10개 작성",
    client: "제이스마케팅",
    stat: "vocabulary",
    reqStat: 120,
    workload: 90,
    deadlineDays: 5,
    reward: 40000,
    reputation: 3,
    penalty: 15000,
    desc: "화장품 샘플 써보고 후기 10개만 써주면 됩니다. 사진은 저희가 드려요. 최대한 자연스럽게만 부탁드려요!",
  },
  {
    id: "gig_sns_comment",
    title: "온라인 카페 댓글 알바 100개",
    client: "개인 의뢰인 (닉네임: 급함123)",
    stat: "sociability",
    reqStat: 150,
    workload: 100,
    deadlineDays: 5,
    reward: 45000,
    reputation: 3,
    penalty: 15000,
    desc: "육아 카페에 저희 제품 자연스럽게 언급하는 댓글만 달아주시면 돼요. 티 안 나게만요.",
  },
  {
    id: "gig_meme_pack",
    title: "짤방 밈 10종 제작",
    client: "유머채널 '빵터짐닷컴'",
    stat: "comedy",
    reqStat: 200,
    workload: 100,
    deadlineDays: 5,
    reward: 55000,
    reputation: 4,
    penalty: 20000,
    desc: "요즘 유행하는 밈 포맷에 저희 캐릭터만 합성해주시면 됩니다. 웃기면 웃길수록 좋아요.",
  },
  {
    id: "gig_shopping_detail",
    title: "쇼핑몰 상세페이지 코딩",
    client: "(주)빨리빨리소프트",
    stat: "it",
    reqStat: 250,
    workload: 110,
    deadlineDays: 6,
    reward: 65000,
    reputation: 4,
    penalty: 25000,
    desc: "이미지 슬라이더랑 상품 옵션 선택창만 붙여주시면 됩니다. HTML/CSS 기본만 되시면 충분해요.",
  },
  {
    id: "gig_wedding_makeup",
    title: "웨딩 촬영 메이크업 리허설",
    client: "봄날스튜디오",
    stat: "beauty",
    reqStat: 280,
    workload: 100,
    deadlineDays: 5,
    reward: 70000,
    reputation: 5,
    penalty: 28000,
    desc: "신부 대역 리허설 메이크업 연습용 모델이 필요합니다. 사진 촬영 후 포트폴리오에 사용돼요.",
  },
  {
    id: "gig_kids_encyclopedia",
    title: "어린이 학습만화 감수",
    client: "새싹출판사",
    stat: "knowledge",
    reqStat: 320,
    workload: 120,
    deadlineDays: 6,
    reward: 80000,
    reputation: 5,
    penalty: 32000,
    desc: "초등 과학 학습만화 원고의 오류를 찾아 감수해주세요. 정확성이 생명입니다.",
  },
  {
    id: "gig_webnovel_illust",
    title: "웹소설 표지 일러스트",
    client: "필명 '한밤의작가'",
    stat: "creativity",
    reqStat: 380,
    workload: 130,
    deadlineDays: 7,
    reward: 95000,
    reputation: 6,
    penalty: 40000,
    desc: "판타지 로맨스 웹소설 표지 1장 부탁드려요. 참고 이미지 첨부했으니 분위기만 맞춰주시면 됩니다.",
  },
  {
    id: "gig_startup_landing",
    title: "스타트업 랜딩페이지 풀스택 개발",
    client: "(주)넥스트유니콘",
    stat: "it",
    reqStat: 450,
    workload: 130,
    deadlineDays: 7,
    reward: 120000,
    reputation: 7,
    penalty: 50000,
    desc: "투자 데모데이 전까지 랜딩페이지 하나 완성해야 합니다. 반응형에 문의폼까지 넣어주세요.",
  },
  {
    id: "gig_corp_speech",
    title: "기업 대표 신년사 연설문 대필",
    client: "대한중공업 비서실",
    stat: "vocabulary",
    reqStat: 520,
    workload: 140,
    deadlineDays: 8,
    reward: 150000,
    reputation: 8,
    penalty: 65000,
    desc: "대표님 신년사 초안 부탁드립니다. 격식 있으면서도 진부하지 않게, 회사 성장 비전을 담아주세요.",
  },
];
