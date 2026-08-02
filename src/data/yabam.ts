/**
 * 야밤 — 성인 트윗을 일정 이상 올린 유저에게 DM 링크로 해금되는 성인 사이트.
 * 3섹션: ① 성인영상(결제 감상) ② 토토(단순 베팅) ③ 성인용품 구매.
 * 톤은 pushtime과 동일하게 암시적·모자이크 수위(실제 이미지·노골적/불법 묘사 없음).
 * 데이터는 선언형이며, 실제 효과 적용·해금·정산 로직은 systems/yabam.ts가 처리한다.
 */
import type { AdultKind } from "@/core/types";

export interface YabamVideo {
  id: string;
  /** 암시적 제목 */
  title: string;
  /** 업로더(채널명) */
  uploader: string;
  /** 한 줄 소개 */
  excerpt: string;
  /** 태그 2~3개 */
  tags: string[];
  /** 장식용 색상(hue 0~360) */
  hue: number;
  /**
   * 이 영상이 올려주는 **변태력**(없으면 0 — 음란만 오른다).
   *
   * ⚠️ 변태력은 '얼마나 야한가'가 아니라 '어느 방향인가'다. 그래서 아무 영상이나 준다고
   *    올려선 안 되고, **취향이 뚜렷한 물건**에만 붙인다. 이게 없어서 변태력을 올릴
   *    창구가 사실상 없었다(오프라인 조우·도서 정도뿐이었다).
   */
  pervert?: number;
  /** 이 영상을 보려면 필요한 최소 변태력(취향이 안 맞으면 목록에 안 뜬다). */
  minPervert?: number;
}

export interface YabamProduct {
  id: string;
  name: string;
  /** 한 줄 설명 */
  desc: string;
  /** 가격(원) */
  price: number;
  /** 효과 라벨(플레이버 — 실제 수치 효과는 systems가 처리) */
  effect: string;
  /** 이 용품을 보유하고 리뷰 트윗을 쓰면 해금되는 성인 트윗 카테고리(없으면 일반 용품) */
  unlocksKind?: AdultKind;
}

/** 성인영상 목록(8개, 모자이크·암시 톤) */
export const YABAM_VIDEOS: YabamVideo[] = [
  { id: "yv1", title: "심야 라디오, 단둘이", uploader: "새벽방송국", excerpt: "잠 못 드는 밤, 귓가에 속삭이는 목소리에 몸이 나른해진다.", tags: ["ASMR", "상황극"], hue: 280 },
  { id: "yv2", title: "출장 온 그 사람", uploader: "노크스튜디오", excerpt: "문을 두드리는 소리에 심장이 먼저 반응했다.", tags: ["상황극", "자극"], hue: 350 },
  { id: "yv3", title: "커플의 주말 기록", uploader: "달콤한오후", excerpt: "카메라 앞에서 조금 더 솔직해진 두 사람의 하루.", tags: ["커플", "일상", "달달"], hue: 320 },
  { id: "yv4", title: "선배님, 야근 중입니다", uploader: "야근의밤", excerpt: "사무실에 둘만 남은 밤, 공기가 묘하게 달라졌다.", tags: ["오피스", "상황극"], hue: 220 },
  { id: "yv5", title: "은밀한 마사지 예약", uploader: "오후세시", excerpt: "노곤한 오후, 낯선 손길에 긴장이 스르르 풀린다.", tags: ["힐링", "자극"], hue: 30 },
  { id: "yv6", title: "옆방이 너무 시끄러워", uploader: "벽너머채널", excerpt: "얇은 벽 너머로 들려오는 소리에 잠이 확 달아났다.", tags: ["상황극", "ASMR", "자극"], hue: 0 },
  { id: "yv7", title: "한여름 밤의 캠핑", uploader: "여름의끝", excerpt: "텐트 안, 땀이 밸 만큼 뜨거웠던 그날 밤의 기록.", tags: ["커플", "여름"], hue: 150 },
  { id: "yv8", title: "새벽 세 시의 초대", uploader: "심야초대장", excerpt: "잠들기 아까운 밤, 조용히 건네온 은근한 초대.", tags: ["상황극", "달달", "자극"], hue: 300 },
  // ── 취향 계열(변태력이 오른다) ─────────────────────────────
  // 앞의 8편은 음란만 올린다. 아래는 방향이 뚜렷한 물건이라 변태력을 준다.
  { id: "yv9", title: "규율의 방", uploader: "가죽과사슬", excerpt: "무릎 꿇는 법부터 배웠다. 세는 소리가 틀리면 처음부터 다시.", tags: ["SM", "훈육", "하드"], hue: 340, pervert: 9 },
  { id: "yv10", title: "목줄의 규칙", uploader: "계약서스튜디오", excerpt: "이름 대신 번호로 불린 하루. 허락 없이는 눈도 마주치지 못한다.", tags: ["주종", "복종", "하드"], hue: 260, pervert: 11 },
  { id: "yv11", title: "묶인 채로 세 시간", uploader: "매듭공방", excerpt: "밧줄 자국이 사라질 때까지 그 자세를 기억하게 만든다.", tags: ["결박", "인내", "하드"], hue: 200, pervert: 12, minPervert: 60 },
  { id: "yv12", title: "관객이 있는 방", uploader: "유리벽채널", excerpt: "보는 사람이 늘수록 얼굴이 붉어지는데, 멈춰달라는 말은 나오지 않았다.", tags: ["노출", "다수", "하드"], hue: 20, pervert: 14, minPervert: 120 },
];

/** 성인용품 목록(6개, 완곡·유머 톤) */
export const YABAM_PRODUCTS: YabamProduct[] = [
  { id: "yp1", name: "무드등 세트 '붉은밤'", desc: "방 분위기를 순식간에 바꿔주는 은은한 붉은 조명.", price: 19_000, effect: "분위기 UP" },
  { id: "yp2", name: "커플 게임 카드", desc: "둘만의 밤을 위한 짓궂은 미션 카드 한 벌.", price: 25_000, effect: "친밀도 보조" },
  { id: "yp3", name: "SM 입문 세트 '길들임'", desc: "가죽 채찍·수갑·안대까지 갖춘, 오늘 밤 제대로 다뤄지고 싶은 사람을 위한 세트.", price: 38_000, effect: "긴장감 UP", unlocksKind: "punish" },
  { id: "yp4", name: "아로마 마사지 오일", desc: "노곤한 몸을 녹여주는 따뜻한 향의 오일.", price: 42_000, effect: "정신력 회복 보조" },
  { id: "yp5", name: "페로몬 향수 '유혹의 밤'", desc: "한 번 뿌리면 시선이 달라진다는, 만남을 부르는 은밀한 향.", price: 55_000, effect: "매력 어필 UP", unlocksKind: "meetup" },
  { id: "yp6", name: "주종 플레이 세트 '계약'", desc: "가죽 목줄·초커·복종 계약서까지, 확실한 관계를 원하는 밤을 위한 풀세트.", price: 89_000, effect: "복종 무드 UP", unlocksKind: "dom" },
];

/** 영상 1편 감상(결제) 비용 */
export const YABAM_VIDEO_COST = 3000;

/** 토토 베팅 금액 선택지(원) */
export const YABAM_TOTO_BETS: number[] = [10000, 50000, 100000];

/** 토토 적중 확률(~45%) */
export const YABAM_TOTO_WIN_CHANCE = 0.45;

/** 토토 적중 플레이버(승리감 + 살짝 위험한 뉘앙스) */
export const TOTO_WIN_LINES: string[] = [
  "적중! 통장에 불이 들어온다. 이 맛에 끊질 못하지…",
  "대박 났다 🎉 오늘 밤 감이 좋더라니.",
  "배당 2배 적중! 손이 떨리는 게 돈 때문인지 아드레날린 때문인지 모르겠다.",
  "빙고. 딱 한 번만 더… 하는 생각이 스멀스멀 올라온다.",
];

/** 토토 꽝 플레이버(허탈함 + 중독 경계 뉘앙스) */
export const TOTO_LOSE_LINES: string[] = [
  "꽝. 방금 그 돈이면 뭘 했더라… 속이 쓰리다.",
  "아깝게 빗나갔다. '다음 판에 복구하면 되지'라는 생각이 제일 위험한데.",
  "날렸다. 화면만 멍하니 바라보는 새벽.",
  "역시 도박은 도박. 빈 지갑만큼 마음도 헛헛해진다.",
];
