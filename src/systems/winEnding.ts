import type { GameState, SkillStatId } from "@/core/types";
import { KILLER_LEGEND_REASON } from "./killer";

/**
 * 승리 엔딩 — 팔로워 100만 명 달성(게임의 최종 목표) 시, **가장 높은 스탯**으로 엔딩이 갈린다.
 *
 * 트리거: `systems/followers.ts`의 `changeFollowers`(팔로워 증감 초크포인트)가 매번 `checkWin`을 호출한다.
 * 계정 합계가 WIN_FOLLOWERS 이상이면 `state.gameOver`에 해당 엔딩 텍스트를 넣는다 → `ui/app.ts`가 감지해
 * 기존 종료 화면(`ui/gameOverModal.renderGameOver`)을 띄운다. 제목은 `winEndingTitle`로 조회한다
 * (state.ts의 CELEBRATORY_ENDING_TITLES와 같은 역할 — gameOverModal이 둘 다 본다).
 *
 * ⚠️ 순환 의존 금지: 이 모듈은 타입(GameState·SkillStatId)만 import하고 state.skills·state.accounts만 읽는다.
 *    그래서 followers.ts가 안전하게 import할 수 있다(followers→winEnding 단방향).
 */

/** 최종 목표 — 이 팔로워 수(계정 합계)에 도달하면 승리 엔딩. */
export const WIN_FOLLOWERS = 1_000_000;

/**
 * 특화 엔딩으로 인정하는 스탯 하한(0~999 스케일). 가장 높은 스탯이 이 값 미만이면
 * '특별히 키운 스탯이 없다'로 보고 기본(만인의 셀럽) 엔딩을 준다. 튜닝 지점.
 */
export const STAT_ENDING_MIN = 350;

export interface WinEnding {
  id: string;
  /** 종료 화면 상단 축하 제목 */
  title: string;
  /** gameOver에 저장 + 종료 화면 본문에 표시되는 엔딩 서사 */
  text: string;
}

interface StatEnding extends WinEnding {
  stat: SkillStatId;
}

/** 스탯별 엔딩. 각 스킬(SkillStatId)에 하나씩. */
const STAT_ENDINGS: StatEnding[] = [
  {
    id: "end_knowledge",
    stat: "knowledge",
    title: "🧠 지식인 셀럽 엔딩",
    text: "쌓아 올린 방대한 지식이 100만 명을 사로잡았다. 당신의 한마디에 사람들이 귀를 기울이고, 이제 '아는 사람' 하면 당신을 떠올린다. 강연과 방송을 넘나드는 지식 인플루언서로 이름을 남긴다.",
  },
  {
    id: "end_vocabulary",
    stat: "vocabulary",
    title: "✍️ 베스트셀러 작가 엔딩",
    text: "당신의 문장은 짧아도 오래 남았다. 140자에 담긴 촌철살인이 100만 명의 마음을 흔들었고, 출간 제의가 줄을 잇는다. SNS 스타를 넘어 시대를 대표하는 작가로 자리 잡는다.",
  },
  {
    id: "end_comedy",
    stat: "comedy",
    title: "😂 국민 코미디언 엔딩",
    text: "웃기는 사람이 결국 이겼다. 당신의 드립 하나에 타임라인이 뒤집히고, 100만 명이 매일 당신의 유머를 기다린다. 예능과 무대를 접수하며 이 시대의 국민 코미디언으로 등극한다.",
  },
  {
    id: "end_beauty",
    stat: "beauty",
    title: "💄 뷰티 아이콘 엔딩",
    text: "당신이 바르면 완판, 당신이 입으면 유행이 됐다. 100만 명이 당신의 감각을 따라 하고, 이제 대형 브랜드가 앞다투어 러브콜을 보낸다. 시대를 대표하는 뷰티 아이콘으로 남는다.",
  },
  {
    id: "end_it",
    stat: "it",
    title: "💻 테크 인플루언서 엔딩",
    text: "새 기술이 나올 때마다 사람들은 당신의 리뷰부터 찾았다. 100만 명이 당신의 코드와 통찰을 신뢰하고, 업계가 당신의 한마디에 주목한다. IT 씬을 이끄는 테크 인플루언서로 우뚝 선다.",
  },
  {
    id: "end_fitness",
    stat: "fitness",
    title: "💪 피트니스 스타 엔딩",
    text: "땀으로 빚어낸 몸과 루틴이 100만 명에게 동기를 줬다. 당신의 운동법을 따라 하는 사람들이 넘쳐나고, 이제 헬스 브랜드의 얼굴이자 국민 트레이너로 불린다. 건강한 삶의 상징이 된다.",
  },
  {
    id: "end_creativity",
    stat: "creativity",
    title: "🎨 아티스트 엔딩",
    text: "당신이 올린 창작물마다 감탄이 쏟아졌다. 100만 명이 당신의 상상력에 매료됐고, 전시와 콜라보 제의가 이어진다. SNS를 넘어 한 시대를 대표하는 아티스트로 이름을 새긴다.",
  },
  {
    id: "end_sociability",
    stat: "sociability",
    title: "🎤 국민 토크쇼 진행자 엔딩",
    text: "누구와도 자연스레 어울리는 그 친화력이 100만 명을 끌어당겼다. 당신 곁엔 늘 사람이 모이고, 마침내 당신의 이름을 건 토크쇼가 열린다. 만인의 친구, 국민 진행자로 자리매김한다.",
  },
  {
    id: "end_game",
    stat: "game",
    title: "🎮 전설의 스트리머 엔딩",
    text: "당신의 플레이는 곧 하나의 쇼였다. 100만 명이 매일 당신의 방송에 모여들고, e스포츠 무대가 당신을 부른다. 게임 씬의 살아있는 전설, 국민 스트리머로 남는다.",
  },
  {
    id: "end_otaku",
    stat: "otaku",
    title: "✨ 덕질 대통령 엔딩",
    text: "덕질에도 격이 있다는 걸 당신이 증명했다. 방대한 애정과 정보력으로 100만 명을 이끌었고, 이제 팬덤이 움직이면 세상이 반응한다. 모든 덕후의 대표, 덕질 대통령으로 불린다.",
  },
  {
    id: "end_lewd",
    stat: "lewd",
    title: "🔥 은밀한 제국 엔딩",
    text: "선을 아슬아슬하게 넘나드는 그 수위가 100만 명을 끌어모았다. 논란과 인기를 한 몸에 받으며, 당신은 아무도 흉내 못 낼 은밀한 제국을 세웠다. 화제의 중심에서 결코 잊히지 않는 이름이 된다.",
  },
];

/** 특화 스탯이 없을 때(가장 높은 스탯도 낮을 때)의 기본 엔딩. */
const DEFAULT_ENDING: WinEnding = {
  id: "end_star",
  title: "🌟 만인의 셀럽 엔딩",
  text: "특별히 내세울 재주 하나 없이도, 오직 화제성과 감각만으로 100만 명의 마음을 훔쳤다. 사람들은 당신이 왜 좋은지 설명하지 못하면서도 당신을 좋아한다. 설명이 필요 없는 만인의 셀럽으로 남는다.",
};

/** 모든 엔딩(제목 조회용). */
const ALL_ENDINGS: WinEnding[] = [...STAT_ENDINGS, DEFAULT_ENDING];

/** 계정 팔로워 합계(economy 의존을 피하려 여기서 직접 합산 — 순환 방지). */
function totalFollowers(state: GameState): number {
  return state.accounts.reduce((sum, a) => sum + a.followers, 0);
}

/**
 * 현재 스탯으로 결정되는 승리 엔딩. 가장 높은 스킬을 채택하되,
 * 그 값이 STAT_ENDING_MIN 미만이면 특화 없음 → 기본 엔딩.
 * 음란(lewd) 엔딩은 성인물 해제(adultMode) 상태에서만 후보다.
 */
export function winEnding(state: GameState): WinEnding {
  let best: StatEnding | null = null;
  for (const e of STAT_ENDINGS) {
    if (e.stat === "lewd" && !state.adultMode) continue;
    const v = state.skills[e.stat] ?? 0;
    if (v >= STAT_ENDING_MIN && (best === null || v > (state.skills[best.stat] ?? 0))) {
      best = e;
    }
  }
  return best ?? DEFAULT_ENDING;
}

/** 엔딩 텍스트(gameOver 사유)로 축하 제목을 되찾는다(gameOverModal 표시용). */
export function winEndingTitle(reason: string): string | undefined {
  if (reason === KILLER_LEGEND_REASON) return "🕶️ 전설의 청부업자 엔딩";
  return ALL_ENDINGS.find((e) => e.text === reason)?.title;
}

/**
 * 팔로워 100만 달성 판정 — 도달했으면 엔딩을 gameOver에 세운다.
 * 킬러 신분(killerJob.active)이면 스탯 엔딩 대신 '전설의 청부업자' 엔딩이 나온다.
 * `changeFollowers`가 팔로워 증가마다 호출한다. 이미 끝났으면 아무것도 안 한다.
 */
export function checkWin(state: GameState): void {
  if (state.gameOver) return;
  if (totalFollowers(state) >= WIN_FOLLOWERS) {
    state.gameOver = state.killerJob?.active ? KILLER_LEGEND_REASON : winEnding(state).text;
  }
}
