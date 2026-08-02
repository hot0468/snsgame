import type { GameState } from "@/core/types";
import { ENDING_OFFERS } from "./endings";
import { winEndingTitle } from "./winEnding";

/**
 * 엔딩 도감 — 어떤 결말이 있고 어떻게 여는지.
 *
 * 왜 넣었나: 엔딩이 열 개 넘게 있는데 **플레이어가 뭐가 있는지도 어떻게 여는지도 알 방법이
 * 없었다.** 직업 도감·인형 도감은 있는데 엔딩만 없어서, 콘텐츠가 있어도 목표가 되지 못했다.
 *
 * ⚠️ **본 엔딩 기록은 게임 상태가 아니라 별도 저장소에 둔다.** 엔딩을 보면 그 판이 끝나고
 *    새 게임은 `createInitialState()`로 시작하므로, GameState에 넣으면 도감이 매번 비워진다.
 *    도감은 판을 넘어 쌓이는 것이라야 도감이다.
 */

const DEX_KEY = "snsgame:endingdex:v1";

/** 본 엔딩 id 집합을 읽는다(저장소가 없거나 깨졌으면 빈 집합). */
export function seenEndings(): Set<string> {
  try {
    const raw = localStorage.getItem(DEX_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : []);
  } catch {
    return new Set();
  }
}

/** 엔딩 하나를 본 것으로 기록한다(중복 호출 무해). */
export function markEndingSeen(id: string): void {
  try {
    const seen = seenEndings();
    if (seen.has(id)) return;
    seen.add(id);
    localStorage.setItem(DEX_KEY, JSON.stringify([...seen]));
  } catch {
    // 저장 실패는 조용히 넘긴다 — 도감이 안 쌓이는 건 아쉽지만 게임을 막을 일은 아니다.
  }
}

export interface EndingDexRow {
  id: string;
  title: string;
  /** 여는 법 한 줄 */
  hint: string;
  /** 이미 본 엔딩인지 */
  seen: boolean;
  /** 지금 조건을 충족해 제안이 뜰 수 있는 상태인지 */
  ready: boolean;
}

/**
 * 엔딩별 '여는 법' 한 줄.
 *
 * ⚠️ **수치를 그대로 적지 마라.** 조건을 숫자로 박아두면 게임이 계산기가 된다
 *    (직업 도감 hint와 같은 원칙 — systems/jobLevels의 경고 참조).
 *    방향만 알려주고 나머지는 플레이가 알려주게 둔다.
 */
const ENDING_HINTS: Record<string, string> = {
  debut: "팔로워를 크게 모으고 외모를 가꾸면 기획사에서 연락이 온다",
  author: "작가 계약을 오래 유지하며 마감을 지킨다",
  legendBJ: "사바나에서 방송하며 큰돈을 번다",
  taxiMaster: "택시를 오래 몰고 평점을 지킨다",
  callMaster: "상담 콜을 아주 많이 받아낸다",
  mlmDiamond: "다단계에서 최상위 라인까지 올라간다",
  stylistOwn: "미용실에서 단골을 쌓고 가위를 오래 잡는다",
  officeExec: "회사에서 성과를 쌓아 최고 직급까지 오른다",
  lecturerStar: "강의를 아주 많이 진행한다",
  avIcon: "촬영을 아주 많이 소화한다",
  coachMaster: "배구부를 맡아 전국체전에서 여러 번 우승한다",
};

/** 100만 달성(승리) 엔딩 묶음의 도감 id — 개별 특화 엔딩은 하나로 묶는다. */
export const WIN_DEX_ID = "win";

/**
 * 나쁜 엔딩 — 제안을 수락해서가 아니라 **망해서** 끝나는 결말들.
 *
 * ⚠️ 이쪽은 `systems`가 `state.gameOver`에 사유 문자열을 직접 박고 끝난다(수락 버튼이 없다).
 *    그래서 도감 기록도 사유 문자열로 되짚어야 한다 — `dexIdForReason`이 그 단일 지점이다.
 *
 * ⚠️ **사유 문구를 고치면 여기 `match`도 같이 고쳐라.** 문구만 바꾸면 그 엔딩은 조용히
 *    도감에 안 남는다(`endingDex.test.ts`가 systems의 실제 사유와 짝을 감시한다).
 */
export interface BadEnding {
  id: string;
  title: string;
  hint: string;
  /** 사유 문자열에 이게 들어 있으면 이 엔딩이다 */
  match: string;
}

export const BAD_ENDINGS: readonly BadEnding[] = [
  {
    id: "bad_affair",
    title: "💔 네 번째 목요일",
    hint: "유부남인 걸 알고도 만남을 이어간다",
    match: "네 번째 목요일",
  },
  {
    id: "bad_evict",
    title: "🏚️ 길바닥",
    hint: "월세를 세 달 연속 밀린다",
    match: "월세를 세 달 연속",
  },
  {
    id: "bad_killer",
    title: "🔪 리스트의 맨 위",
    hint: "청부 일을 하다 실패를 거듭한다",
    match: "리스트의 맨 위",
  },
  {
    id: "bad_loan",
    title: "💸 사채의 끝",
    hint: "사채를 빌리고 갚지 못한다",
    match: "사채",
  },
];

/**
 * 게임오버 사유 → 도감 id. 모르는 사유면 null(도감에 안 남는다).
 *
 * ⚠️ 승리 엔딩(100만)과 제안 엔딩은 각자 수락 시점에 이미 기록하므로 여기서 안 본다 —
 *    여기는 **망해서 끝나는 경로 전용**이다.
 */
export function dexIdForReason(reason: string | null): string | null {
  if (!reason) return null;
  return BAD_ENDINGS.find((b) => reason.includes(b.match))?.id ?? null;
}

/**
 * 도감 행 목록. 본 것은 제목이 드러나고, 못 본 것은 제목이 가려진다(힌트는 항상 보인다).
 *
 * ⚠️ 힌트까지 가리면 목표가 안 되고, 제목까지 드러내면 발견의 재미가 없다 —
 *    그 중간이 이 화면의 값이다.
 */
export function endingDexRows(state: GameState): EndingDexRow[] {
  const seen = seenEndings();
  const rows: EndingDexRow[] = ENDING_OFFERS.map((e) => ({
    id: e.id,
    title: seen.has(e.id) ? e.offerTitle : "???",
    hint: ENDING_HINTS[e.id] ?? "조건 미상",
    seen: seen.has(e.id),
    ready: safeCondition(e.condition, state),
  }));

  // 최종 목표(팔로워 100만) 엔딩은 스탯별로 갈리지만 도감에선 한 칸으로 둔다 —
  // 갈래가 여럿이라 칸을 쪼개면 "안 본 엔딩"이 과장되게 많아 보인다.
  rows.push({
    id: WIN_DEX_ID,
    title: seen.has(WIN_DEX_ID) ? "🏆 팔로워 100만" : "???",
    hint: "팔로워 100만을 모은다 (가장 높은 스탯에 따라 결말이 갈린다)",
    seen: seen.has(WIN_DEX_ID),
    ready: false,
  });

  // 망해서 끝나는 결말도 결말이다 — 도감을 채우는 재미의 절반은 "이렇게도 끝나는구나"다.
  for (const b of BAD_ENDINGS) {
    rows.push({
      id: b.id,
      title: seen.has(b.id) ? b.title : "???",
      hint: b.hint,
      seen: seen.has(b.id),
      ready: false,
    });
  }
  return rows;
}

/** 본 엔딩 수 / 전체. */
export function endingDexProgress(state: GameState): { seen: number; total: number } {
  const rows = endingDexRows(state);
  return { seen: rows.filter((r) => r.seen).length, total: rows.length };
}

/** 승리 엔딩 제목(스탯별). ui가 결과 화면에 쓴다. */
export { winEndingTitle };

/** 조건 함수가 던져도 도감이 통째로 깨지지 않게 감싼다. */
function safeCondition(fn: (s: GameState) => boolean, state: GameState): boolean {
  try {
    return fn(state);
  } catch {
    return false;
  }
}
