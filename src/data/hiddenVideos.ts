import type { AttributeId } from "@/core/types";

/**
 * 너튜브 검색으로만 뜨는 숨은 영상.
 * 일반 영상 목록(makeRandomVideos)에는 절대 섞이지 않고, 검색창에 trigger가
 * 부분일치(공백무시)로 들어갈 때만 결과에 끼어든다(ui/youtube.ts).
 * 감상 시 효과는 기존 Video 처리 로직을 그대로 재사용한다(신규 효과 없음).
 */
export interface HiddenVideo {
  /** 이 영상을 띄우는 검색어(부분일치, 공백무시 비교) */
  trigger: string;
  title: string;
  channel: string;
  attribute: AttributeId;
}

export const HIDDEN_VIDEOS: HiddenVideo[] = [
  {
    trigger: "부업",
    title: "퇴사 없이 월급 두 배 버는 부업 총정리 (풀버전)",
    channel: "부업연구소",
    attribute: "info",
  },
  {
    trigger: "고백",
    title: "짝사랑한테 고백 직전 심박수 측정해봄 (결과 실화)",
    channel: "심쿵실험실",
    attribute: "humor",
  },
  {
    trigger: "억텐",
    title: "'억텐'이 대체 무슨 뜻이냐면요 (실검 1위 계기)",
    channel: "밈창고",
    attribute: "humor",
  },
  {
    trigger: "다이어트",
    title: "3일 만에 5kg 뺀 미친 루틴 (의사 주의 요망)",
    channel: "오운완TV",
    attribute: "fitness",
  },
  {
    trigger: "정치",
    title: "3분만에 정리하는 이번 주 정치 이슈",
    channel: "이슈정리왕",
    attribute: "politics",
  },
  {
    trigger: "고양이",
    title: "츤데레 고양이가 집사 무시하는 레전드 모음.zip",
    channel: "냥냥펀치",
    attribute: "animal",
  },
];
