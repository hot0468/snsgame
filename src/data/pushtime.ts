/**
 * 푸시타임 — 애니덕+성인+음란 상태에서 DM 링크로 해금되는 성인 동인 콘텐츠 사이트.
 * 레이아웃은 '포스타입' 스타일 콘텐츠 피드. (실제 이미지 없이 모자이크 자리·암시적 제목만)
 */
export interface PushWork {
  id: string;
  title: string;
  /** 크리에이터(작가) */
  circle: string;
  /** 한 줄 소개 */
  excerpt: string;
  /** 태그 */
  tags: string[];
  /** 장식용 색상(hue) */
  hue: number;
}

export const PUSH_WORKS: PushWork[] = [
  { id: "pw1", title: "그날 밤의 비밀", circle: "달빛서클", excerpt: "아무에게도 말 못 한 그날의 이야기. 결국 선을 넘어버렸다.", tags: ["로맨스", "오피스", "달달"], hue: 320 },
  { id: "pw2", title: "선배는 짓궂어", circle: "밤샘공방", excerpt: "다정한 척 짓궂은 그 사람. 오늘도 나를 흔들어 놓는다.", tags: ["학원물", "밀당", "상황극"], hue: 280 },
  { id: "pw3", title: "이웃집 그녀의 초대", circle: "은밀스튜디오", excerpt: "옆집에서 건네온 은근한 초대. 거절할 이유가 없었다.", tags: ["일상", "이웃", "자극"], hue: 350 },
  { id: "pw4", title: "방과 후, 단둘이", circle: "야근의밤", excerpt: "모두가 떠난 교실. 둘만 남은 방과 후의 공기.", tags: ["학원물", "청춘", "설렘"], hue: 260 },
  { id: "pw5", title: "금지된 사이", circle: "붉은노트", excerpt: "해서는 안 될 관계일수록 더 뜨거워지는 마음.", tags: ["금단", "긴장감", "드라마"], hue: 0 },
  { id: "pw6", title: "출장 마사지사의 손길", circle: "오후세시", excerpt: "노곤한 오후, 낯선 손길에 몸도 마음도 무너진다.", tags: ["힐링", "상황극", "자극"], hue: 30 },
  { id: "pw7", title: "룸메이트와의 밤", circle: "심야방송국", excerpt: "한 집에 사는 우리. 밤이 깊을수록 거리도 좁아진다.", tags: ["동거", "슬로우번", "달달"], hue: 300 },
  { id: "pw8", title: "달아오른 여름 합숙", circle: "여름의끝", excerpt: "땀이 배도록 뜨거웠던 그해 여름의 합숙 이야기.", tags: ["여름", "청춘", "판타지"], hue: 200 },
];

/** 작품 1편 감상(결제) 비용 */
export const PUSH_VIEW_COST = 3_000;
