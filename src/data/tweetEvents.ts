import type { AttributeId, EventVariant, TweetEvent } from "@/core/types";
import { SLOTS_PER_DAY, MORNING_SLOT } from "@/core/state";
import { chance, pick, randInt } from "@/utils/random";

/**
 * 아이돌/애니/배우 트윗은 가끔 '행사 안내' 트윗으로 뜬다.
 * (콘서트·코믹콘·무대인사 등) 참여하기를 누르면 스케줄에 등록된다.
 *
 * ⚠️ **팬사인회(idol)·팬미팅(actor)은 여기 없다.** 트윗을 눌러 가는 행사가 아니라
 *    상점 음원CD(music_cd)를 사서 **다음 날 아침 추첨에 당첨돼야** 일정이 잡히는 행사로 옮겼다
 *    (systems/cdLottery.ts). 이 풀에 다시 넣으면 추첨을 거치지 않는 우회로가 생긴다.
 *    두 자리는 각각 '음악방송 사전녹화'·'드라마 촬영지 투어'로 채웠다.
 */

/** 행사 트윗이 붙는 카테고리 */
export type EventAttribute = Extract<AttributeId, "idol" | "anime" | "actor">;

/** 일반 트윗이 행사 트윗으로 뜰 확률 */
export const EVENT_TWEET_CHANCE = 0.2;

interface EventTemplate {
  /** 스케줄에 등록될 행사명 */
  title: string;
  /** 트윗 본문(행사 홍보) */
  text: string;
  /** 특별 진행이 있는 행사면 그 종류 */
  variant?: EventVariant;
  /** 관람 전에 티켓팅이 필요한 행사인지(무대인사·GV·콘서트) */
  ticketing?: boolean;
}

const EVENT_TEMPLATES: Record<EventAttribute, EventTemplate[]> = {
  idol: [
    { title: "단독 콘서트", text: "드디어 단독 콘서트 개최 확정!! 이건 무조건 가야 해 같이 가실 분 참여하기 눌러요 🎤", ticketing: true },
    { title: "음악방송 사전녹화", text: "이번 컴백 무대 사전녹화 방청 모집 떴어요 카메라 뒤 최애를 볼 기회... 같이 가실 분 참여!" },
    { title: "컴백 쇼케이스", text: "컴백 쇼케이스 현장 관람 모집 중! 첫 무대 직관 각인데 안 갈 이유가 없지" },
    { title: "생일 카페 이벤트", text: "최애 생일 카페 오픈했대요 특전도 빵빵하고... 성지순례 가실 분 참여요" },
  ],
  anime: [
    {
      title: "코믹콘",
      text: "이번 코믹콘 라인업 실화? 굿즈에 성우 무대까지 총출동이라는데 같이 갈 사람 참여!",
      variant: "comiccon",
    },
    { title: "성우 토크쇼", text: "최애 성우 토크쇼 이벤트 열린다 실제 목소리 라이브로 듣는 기회... 참여 필수" },
    { title: "원화 전시회", text: "그 작품 원화 전시회 개최! 작화 실물 영접 기회, 덕후라면 참여 고고" },
    { title: "상영회 이벤트", text: "극장판 재상영 + 특전 이벤트래요 스크린으로 다시 보기 각 참여하실 분?" },
  ],
  actor: [
    { title: "무대인사", text: "이번 영화 무대인사 일정 공개! 실물 영접 기회라 이건 못 참지 같이 가실 분 참여 👀", ticketing: true },
    { title: "시사회", text: "개봉 전 시사회 초대 이벤트 떴다 누구보다 먼저 볼 수 있어요 참여 서두르세요" },
    { title: "드라마 촬영지 투어", text: "그 드라마 촬영지 투어 프로그램 열린대요 명장면 그 자리에 직접 서보기... 참여하실 분?" },
    { title: "GV 관객과의 대화", text: "이번 GV 감독님까지 오신대요 관객과의 대화 회차 예매 각, 같이 가요 참여!", ticketing: true },
  ],
};

/**
 * 해당 카테고리 트윗을 확률적으로 행사 트윗으로 만든다.
 * @param day 기준일(대개 트윗 생성일). 행사일은 며칠 뒤로 잡힌다.
 * @returns 행사 트윗이면 {본문, 행사정보}, 아니면 null
 */
export function maybeEventTweet(
  attr: AttributeId,
  day: number,
): { text: string; event: TweetEvent } | null {
  const pool = EVENT_TEMPLATES[attr as EventAttribute];
  if (!pool) return null;
  if (!chance(EVENT_TWEET_CHANCE)) return null;
  const tpl = pick(pool);
  return {
    text: tpl.text,
    event: {
      title: tpl.title,
      day: day + randInt(4, 21),
      // 코믹콘은 낮 행사라 낮 슬롯 고정(심야에 잡히면 자러 가는 흐름과 충돌). 그 외 행사는 아무 슬롯.
      slot: tpl.variant === "comiccon" ? MORNING_SLOT : randInt(0, SLOTS_PER_DAY - 1),
      attribute: attr,
      variant: tpl.variant,
      ticketing: tpl.ticketing,
      joined: false,
    },
  };
}
