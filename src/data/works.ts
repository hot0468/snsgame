/**
 * 창작(1차/2차창작)의 소재가 되는 '작품' 데이터.
 * - 애니: 아래 고정 목록(패러디 창작 데이터).
 * - 만화: 미디북스의 만화(comic) 도서를 그대로 작품으로 쓴다.
 * 실제 작품/저자와 무관한 창작 데이터다.
 */
import { BOOKS } from "./books";

export type WorkKind = "anime" | "manga";

export interface CreativeWork {
  id: string;
  title: string;
  kind: WorkKind;
}

/** 애니 작품(너튜브에서 시청하면 '봤던 작품'으로 기록된다) */
export const ANIME_WORKS: CreativeWork[] = [
  { id: "a1", title: "검은 사슬의 레퀴엠", kind: "anime" },
  { id: "a2", title: "은하 카페 3분 대기", kind: "anime" },
  { id: "a3", title: "마왕은 오늘도 알바 중", kind: "anime" },
  { id: "a4", title: "푸른 시간의 소녀", kind: "anime" },
  { id: "a5", title: "강철 심장 크로니클", kind: "anime" },
  { id: "a6", title: "여름의 끝, 그 너머", kind: "anime" },
  { id: "a7", title: "던전밥상 판타지아", kind: "anime" },
  { id: "a8", title: "고교 음양사 로그", kind: "anime" },
];

/** 만화 작품 = 미디북스의 만화 도서(감상하면 '봤던 작품'으로 기록된다) */
export const MANGA_WORKS: CreativeWork[] = BOOKS.filter((b) => b.category === "comic").map((b) => ({
  id: b.id,
  title: b.title,
  kind: "manga",
}));

/** 2차창작 대상이 될 수 있는 전체 작품(애니 + 만화) */
export const ALL_WORKS: CreativeWork[] = [...ANIME_WORKS, ...MANGA_WORKS];

const WORK_BY_ID = new Map(ALL_WORKS.map((w) => [w.id, w]));

/** id로 작품 조회 */
export function workById(id: string): CreativeWork | undefined {
  return WORK_BY_ID.get(id);
}

/**
 * 그 달의 '인기 작품' — 달(monthKey)마다 랜덤으로 하나 고정된다.
 * 2차창작에서 이 작품을 맞추면 팔로워 증가분이 크게 오른다.
 */
export function popularWork(monthKey: number): CreativeWork {
  const i = ((monthKey % ALL_WORKS.length) + ALL_WORKS.length) % ALL_WORKS.length;
  return ALL_WORKS[i];
}

/* ─────────────────── 창작 트윗 문구 ─────────────────── */

/** 창작 종류 */
export type CreationKind = "original" | "fan";

/** 팔로워 증가분 배율 — 1차창작/2차창작/2차창작(이달의 인기작 적중) */
export const CREATION_MULTIPLIER = {
  original: 1.15,
  fan: 1.1,
  fanPopular: 2.0,
} as const;

/** 1차창작(오리지널) 트윗 문구 후보 */
export function originalCreationLines(): string[] {
  return [
    "밤새 오리지널 캐릭터 그려서 올려본다 아무도 모르는 내 세계관인데 봐주면 좋겠다 #오너캐 #1차창작",
    "머릿속에만 있던 세계관을 드디어 그림으로 옮겼다 반응이 어떨지 떨리지만 그래도 완성해서 뿌듯 #오리지널",
    "직접 구상한 스토리로 짧은 창작 만화 그려봤어요 첫 연재 도전이라 두근두근합니다 #창작만화",
    "내 손으로 만든 캐릭터에 이름 붙여주고 설정 짜는 게 세상에서 제일 재밌다 오늘도 오너캐 자랑 투척 #1차창작",
    "누가 알아주지 않아도 내가 좋아서 그리는 나만의 이야기 오늘도 한 컷 완성했습니다 #오리지널창작",
  ];
}

/** 2차창작(팬아트/팬만화) 트윗 문구 후보 — 특정 작품을 소재로 */
export function fanCreationLines(work: CreativeWork): string[] {
  const t = work.title;
  return [
    `『${t}』 최애캐 팬아트 그려봤어요 밤새 그린 보람이 있으면 좋겠다 #2차창작 #팬아트`,
    `『${t}』 보고 나서 손이 근질거려서 결국 팬아트 한 장 투척합니다 이 작품 너무 좋아`,
    `『${t}』 그 장면이 자꾸 생각나서 2차창작 짧은 만화로 그려봤다 원작 감사합니다`,
    `『${t}』 최애 커플링 도저히 못 참고 팬아트 그렸어요 같은 사람 있으면 손 #2차창작`,
    `『${t}』 세계관에 푹 빠져서 오늘도 팬아트 한 장 그렸습니다 이 맛에 덕질하지`,
  ];
}
