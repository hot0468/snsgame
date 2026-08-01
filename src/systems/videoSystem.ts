import type { GameState, SkillStatId } from "@/core/types";
import type { Video, VideoAttribute } from "@/data/videos";
import { getActiveAccount } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import { pick } from "@/utils/random";
import { isOwned } from "./shop";
import { clampMental, gainSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";
import { unlockAttribute } from "./attributeUnlock";

/**
 * 너튜브 영상 시청.
 * - 시간 1칸을 소비하고 정신력·관련 스탯을 소폭 올린다.
 * - 해당 카테고리 영상을 처음 보면 트윗 작성 속성이 해금된다.
 */

export interface VideoOutcome {
  message: string;
  /** 이번 시청으로 새로 해금된 트윗 속성(없으면 null) */
  unlockedAttribute: VideoAttribute | null;
}

/** 시청 시 회복되는 정신력 */
const WATCH_MENTAL = 5;

/** 숨은 영상(검색 이스터에그) 감상 효과 배율 — 일반 영상보다 좋다(정신력·스킬 2배). */
export const HIDDEN_VIDEO_BONUS = 2;

/** 그래픽카드 보유 시 시청으로 오르는 관련 스탯 증가량에 더해지는 보너스 */
export const GPU_WATCH_SKILL_BONUS = 5;

/** 이번 시청으로 오르는 관련 스탯 증가량(그래픽카드 보유 시 화질이 좋아져 더 얻는다) */
export function watchSkillAmount(state: GameState, base: number): number {
  return base + (isOwned(state, "gpu") ? GPU_WATCH_SKILL_BONUS : 0);
}

/** 카테고리별로 오르는 관련 스탯 */
const RELATED_SKILL: Record<VideoAttribute, { skill: SkillStatId; amount: number }> = {
  idol: { skill: "beauty", amount: 10 },
  actor: { skill: "vocabulary", amount: 10 },
  anime: { skill: "creativity", amount: 10 },
  fitness: { skill: "fitness", amount: 10 },
  politics: { skill: "knowledge", amount: 10 },
  info: { skill: "knowledge", amount: 10 },
  animal: { skill: "sociability", amount: 10 },
  humor: { skill: "comedy", amount: 10 },
  gaming: { skill: "game", amount: 10 },
};

const FLAVOR: Record<VideoAttribute, string[]> = {
  idol: [
    "영상을 보다 보니 어느새 최애의 매력에 흠뻑 빠져버렸다. 시간 순삭.",
    "무대를 몇 번이고 돌려보며 감탄했다. 덕질은 역시 즐겁다.",
    "화려한 무대에 눈이 즐거웠다. 오늘도 성공적인 덕질.",
  ],
  actor: [
    "배우의 섬세한 연기에 빠져 영상을 정주행했다. 여운이 길게 남는다.",
    "명장면을 곱씹으며 감상했다. 역시 믿고 보는 배우다.",
    "인터뷰 속 진솔한 모습에 더 깊이 빠져들었다.",
  ],
  anime: [
    "작화와 연출에 감탄하며 영상을 몇 번이고 돌려봤다. 시간 순삭.",
    "이번 분기 애니 정보를 잔뜩 얻었다. 정주행 리스트가 또 늘었다.",
    "성우들의 열연에 소름이 돋았다. 오늘도 성공적인 덕질.",
  ],
  fitness: [
    "운동 자극을 제대로 받았다. 당장 몸을 움직이고 싶어진다.",
    "따라 하기 좋은 루틴을 잔뜩 저장했다. 오늘부터 실천각.",
    "경기 하이라이트에 심장이 뛴다. 역시 스포츠는 못 참지.",
  ],
  politics: [
    "한 주 시사 이슈를 말끔히 정리했다. 세상 돌아가는 게 좀 보인다.",
    "어렵던 정책 얘기를 쉽게 풀어줘서 고개를 끄덕였다. 아는 게 늘었다.",
    "감정 빼고 팩트만 짚어주는 영상에 머리가 맑아졌다.",
  ],
  info: [
    "쓸모 있는 상식을 잔뜩 챙겼다. 어디 가서 아는 척하기 딱 좋겠다.",
    "매일 쓰던 것들의 원리를 알고 나니 세상이 다르게 보인다.",
    "짧고 알찬 지식에 시간 순삭. 똑똑해지는 기분이다.",
  ],
  animal: [
    "귀여운 동물 영상에 마음이 사르르 녹았다. 심신 안정 완료.",
    "야생 다큐의 경이로운 장면에서 눈을 떼지 못했다.",
    "구조 후 밝아진 아이의 모습에 괜히 코끝이 찡했다.",
  ],
  humor: [
    "짤방 모음을 보다가 혼자 빵 터졌다. 이건 못 참지.",
    "웃긴 영상에 스트레스가 싹 날아갔다. 역시 웃음이 보약이다.",
    "요즘 밈을 싹 정리했다. 이제 대화에 낄 수 있겠다.",
  ],
  gaming: [
    "공략을 눈에 담고 나니 손이 근질거린다. 오늘은 그 보스 잡는다.",
    "랭커의 플레이에 감탄만 하다 시간 순삭. 나도 저렇게 되고 싶다.",
    "신작 리뷰를 정주행했다. 위시리스트가 또 늘었다.",
    "스피드런 기록 경신 순간에 소름이 돋았다. 이 맛에 겜방을 챙겨본다.",
  ],
};

export function watchVideo(state: GameState, video: Video): VideoOutcome {
  // 검색으로만 뜨는 숨은 영상(id "hidden_*")은 감상 효과가 일반 영상의 2배다(발견 보상).
  const hiddenMul = video.id.startsWith("hidden_") ? HIDDEN_VIDEO_BONUS : 1;
  state.resources.mental = clampMental(state, state.resources.mental + WATCH_MENTAL * hiddenMul);
  const rel = RELATED_SKILL[video.attribute];
  const amount = watchSkillAmount(state, rel.amount) * hiddenMul;
  // 영상 시청은 반복 육성 — gainSkill 관문으로 정신력 배율·상단 감쇠를 받는다.
  gainSkill(state, rel.skill, amount);

  // 애니 영상이면 그 작품을 '봤던 작품'으로 기록(2차창작 대상이 된다)
  if (video.workId && !state.seenWorks.includes(video.workId)) {
    state.seenWorks.push(video.workId);
  }

  // 처음 보는 카테고리면 트윗 작성 속성 해금
  const account = getActiveAccount(state);
  let unlockedAttribute: VideoAttribute | null = null;
  // ⚠️ push 직접 호출 금지 — 해금 부수효과(게임 스킬 기준선 등)를 단일 관문이 보장한다.
  if (unlockAttribute(state, account, video.attribute)) {
    addSchedule(state, `새 트윗 속성 해금: ${ATTRIBUTES[video.attribute].label}`, "system");
    unlockedAttribute = video.attribute;
  }

  addSchedule(state, `너튜브 시청 (${ATTRIBUTES[video.attribute].label})`, "sns");
  advanceTime(state, 1);

  const base = pick(FLAVOR[video.attribute]);
  const message = hiddenMul > 1 ? `🔎 숨은 영상을 발견했다! ${base} (효과 2배)` : base;
  return { message, unlockedAttribute };
}
