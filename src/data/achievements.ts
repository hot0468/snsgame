/**
 * 도전과제/업적 정의 — 게임 마일스톤을 자동 판정해 수집한다.
 *
 * 각 업적의 `condition`은 **순수 판정 함수**다: GameState(및 활성 계정)를 읽기만 하고
 * 절대 변형하지 않는다. 실제 달성 처리(중복 방지·알림 큐)는 systems/achievements.ts가 한다.
 * 여기선 "무엇을 달성으로 볼지"만 선언한다(데이터=선언형).
 *
 * ⚠️ condition은 **실존 state 필드만** 읽는다(없는 필드를 쓰면 typecheck가 깨진다).
 * 새 카운터가 필요한 업적은 이번 범위 밖 — 기존 상태로 판정 가능한 것만 담았다.
 * 게임플레이 보상은 없다(수집·표시 전용).
 */
import type { GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";
import { STREAM_TYPES } from "./livestream";
import { DOLLS } from "./arcade";
import { WALK_PLACES } from "./walkPlaces";
import { RECIPES } from "./grocery";

export interface Achievement {
  id: string;
  name: string;
  desc: string;
  emoji: string;
  /** true면 달성 전엔 이름/설명을 가린다(??? 표시). */
  hidden?: boolean;
  /** true면 성인 계열 업적 — 성인물 보기 OFF면 목록·진행 표기에서 숨긴다. */
  adult?: boolean;
  /** 순수 판정 — 상태만 읽고 변형하지 않는다. */
  condition: (s: GameState) => boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  // ── 팔로워 마일스톤 ──────────────────────────────
  {
    id: "fol_1k",
    name: "첫 네 자리",
    desc: "팔로워 1,000명 돌파. 이제 오타 내면 캡처당한다.",
    emoji: "🌱",
    condition: (s) => getActiveAccount(s).followers >= 1_000,
  },
  {
    id: "fol_10k",
    name: "만 명의 친구들",
    desc: "팔로워 10,000명 달성. 슬슬 협찬 DM이 온다.",
    emoji: "🌿",
    condition: (s) => getActiveAccount(s).followers >= 10_000,
  },
  {
    id: "fol_100k",
    name: "인플루언서",
    desc: "팔로워 100,000명 달성. 이제 당신은 '계정'이 아니라 '채널'이다.",
    emoji: "🔥",
    condition: (s) => getActiveAccount(s).followers >= 100_000,
  },
  {
    id: "fol_500k",
    name: "반백만 스타",
    desc: "팔로워 500,000명 돌파. 목표가 코앞이다.",
    emoji: "💫",
    condition: (s) => getActiveAccount(s).followers >= 500_000,
  },
  {
    id: "fol_1m",
    name: "100만의 정점",
    desc: "팔로워 1,000,000명 달성. 당신은 해냈다.",
    emoji: "👑",
    condition: (s) => getActiveAccount(s).followers >= 1_000_000,
  },

  // ── 소지금 ──────────────────────────────────────
  {
    id: "money_10m",
    name: "천만원 통장",
    desc: "소지금 1,000만 원 돌파. 통장에 처음으로 여유가 생겼다.",
    emoji: "💰",
    condition: (s) => s.money >= 10_000_000,
  },
  {
    id: "money_100m",
    name: "억 소리 나는 자산가",
    desc: "소지금 1억 원 돌파. 이제 월세 알림이 무섭지 않다.",
    emoji: "🏦",
    condition: (s) => s.money >= 100_000_000,
  },
  {
    id: "money_10b",
    name: "파이어족",
    desc: "소지금 100억 원 돌파. 일하지 않아도 되는 삶이 열렸다.",
    emoji: "🏝️",
    condition: (s) => s.money >= 10_000_000_000,
  },

  // ── 직업 ────────────────────────────────────────
  {
    id: "job_first",
    name: "월급쟁이 데뷔",
    desc: "첫 직장에 취업했다. SNS만으론 밥이 안 나오니까.",
    emoji: "💼",
    condition: (s) => s.employment != null,
  },
  {
    id: "job_author",
    name: "전업 작가의 길",
    desc: "플랫폼 작가 계약 성사. 마감이라는 새 친구가 생겼다.",
    emoji: "✍️",
    condition: (s) => s.authorContract != null,
  },
  {
    id: "job_av",
    adult: true,
    name: "카메라 앞에서",
    desc: "AV배우 계약을 맺었다. 이것도 엄연한 직업이다.",
    emoji: "🎬",
    condition: (s) => s.avJob != null,
  },

  // ── 성인·커뮤니티 ────────────────────────────────
  {
    id: "adult_first",
    adult: true,
    name: "선을 넘다",
    desc: "첫 성인 트윗을 올렸다. 되돌아갈 수 없는 강을 건넜다.",
    emoji: "🔞",
    condition: (s) => s.postedAdultEver,
  },
  {
    id: "crew_join",
    name: "달리는 사람들",
    desc: "러닝크루에 가입했다. 이제 새벽에도 알림이 온다.",
    emoji: "🏃",
    condition: (s) => s.crewJoined,
  },
  {
    id: "savanna_join",
    adult: true,
    name: "라이브 온에어",
    desc: "사바나 여캠 방송을 시작했다. 켜면 사람이 모인다.",
    emoji: "📹",
    condition: (s) => s.savannaJoined,
  },
  {
    id: "lingerie_deal",
    adult: true,
    name: "전속 모델",
    desc: "란제리 브랜드와 전속 계약을 맺었다. 카메라가 당신을 원한다.",
    emoji: "👙",
    condition: (s) => s.lingerieContract,
  },

  // ── 생활 ────────────────────────────────────────
  {
    id: "cert_first",
    name: "스펙 쌓기",
    desc: "첫 자격증을 손에 넣었다. 이력서에 한 줄 추가.",
    emoji: "📜",
    condition: (s) => s.certifications.length > 0,
  },
  {
    id: "housing_up",
    name: "내 집 마련의 꿈",
    desc: "더 넓은 집으로 이사했다. 3평 원룸은 이제 안녕.",
    emoji: "🏠",
    condition: (s) => s.housingTier >= 2,
  },
  {
    id: "paid_channel",
    adult: true,
    name: "유료 구독의 맛",
    desc: "유료 구독 채널을 개설했다. 팬심이 곧 현금흐름.",
    emoji: "💳",
    condition: (s) => s.paidChannelJoined,
  },
  {
    id: "multi_account",
    name: "부캐 인생",
    desc: "계정을 3개 이상 운영 중. 본캐가 어디였더라?",
    emoji: "🎭",
    condition: (s) => s.accounts.length >= 3,
  },

  // ── 창작·트윗·이스터에그 ──────────────────────────
  {
    id: "creation_20",
    name: "창작하는 인간",
    desc: "창작 트윗을 20개 넘게 올렸다. 손끝에서 이야기가 나온다.",
    emoji: "🎨",
    condition: (s) => s.creationTweetCount >= 20,
  },
  {
    id: "spam_king",
    name: "도배왕",
    desc: "하루에 트윗 10개 이상. 타임라인이 온통 당신이다.",
    emoji: "🌀",
    condition: (s) => getActiveAccount(s).dailyTweetCount >= 10,
  },
  {
    id: "night_owl",
    name: "불면의 밤",
    desc: "7일 연속 심야 트윗. 해는 뜨는데 당신은 아직 안 잤다.",
    emoji: "🦉",
    condition: (s) => s.eggs.lateStreak >= 7,
  },

  // ── 히든 ────────────────────────────────────────
  {
    id: "bankrupt",
    name: "마이너스 인생",
    desc: "소지금이 마이너스로 떨어졌다. 통장이 빨간불이다.",
    emoji: "📉",
    hidden: true,
    condition: (s) => s.money < 0,
  },
  {
    id: "controversy",
    name: "논란의 중심",
    desc: "제대로 된 논란에 휘말렸다. 실시간 트렌드 1위, 축하한다.",
    emoji: "💢",
    hidden: true,
    condition: (s) => s.pendingControversy != null,
  },
  {
    id: "loan_default",
    name: "그분들이 오셨다",
    desc: "사채를 못 갚아 끌려간 적이 있다. 다음엔 정말 조심하자.",
    emoji: "🚨",
    hidden: true,
    condition: (s) => s.loanDefaultStreak >= 1,
  },

  // ── 인방(라이브 방송) ─────────────────────────────
  {
    id: "stream_first",
    name: "첫 방송 켰다",
    desc: "인방을 한 번 진행했다. 시작이 반이다.",
    emoji: "🔴",
    condition: (s) => s.streamCount >= 1,
  },
  {
    id: "stream_10",
    name: "고정 시청자",
    desc: "방송을 10회 진행했다. 이제 기다려주는 사람이 생겼다.",
    emoji: "📺",
    condition: (s) => s.streamCount >= 10,
  },
  {
    id: "stream_1k",
    name: "동접 네 자리",
    desc: "한 방송에서 시청자 1,000명을 찍었다.",
    emoji: "🎯",
    condition: (s) => Object.values(s.streamBests ?? {}).some((v) => v >= 1_000),
  },
  {
    id: "stream_all_types",
    name: "만능 스트리머",
    desc: "게임·수다·버튜버 방송을 모두 경험했다.",
    emoji: "🎭",
    condition: (s) => STREAM_TYPES.every((t) => (s.streamBests?.[t.id] ?? 0) > 0),
  },

  // ── 오락실 인형뽑기 ─────────────────────────────
  {
    id: "doll_first",
    name: "집게의 은총",
    desc: "인형뽑기로 인형을 하나 건졌다. 그 집게가 정말 잡을 줄은 몰랐다.",
    emoji: "🧸",
    condition: (s) => (s.dolls?.length ?? 0) >= 1,
  },
  {
    id: "doll_rare",
    name: "유리장 맨 뒤",
    desc: "레어 인형을 뽑았다. 오락실에서 제일 안 뽑히던 그 자리다.",
    emoji: "🐻",
    condition: (s) =>
      DOLLS.some((d) => d.rarity === "rare" && (s.dolls ?? []).includes(d.id)),
  },
  {
    id: "doll_dex_complete",
    name: "인형 도감 완성",
    desc: `인형 ${DOLLS.length}종을 전부 모았다. 방에 둘 자리가 없다.`,
    emoji: "🏆",
    condition: (s) => DOLLS.every((d) => (s.dolls ?? []).includes(d.id)),
  },

  // ── 산책 장소 ──────────────────────────────────
  {
    id: "walk_place_first",
    name: "동네 탐험가",
    desc: "산책하다 새로운 장소를 발견했다. 여기 이런 게 있었구나.",
    emoji: "🗺️",
    condition: (s) => (s.walkPlaces?.length ?? 0) >= 1,
  },
  {
    id: "walk_place_all",
    name: "우리 동네 지도 완성",
    desc: `산책으로 갈 수 있는 장소 ${WALK_PLACES.length}곳을 전부 찾아냈다.`,
    emoji: "🧭",
    condition: (s) => WALK_PLACES.every((p) => (s.walkPlaces ?? []).includes(p.id)),
  },

  // ── 요리 도감 ──────────────────────────────────
  {
    id: "cooking_dex_complete",
    name: "요리 도감 완성",
    desc: `레시피 ${RECIPES.length}종을 전부 만들어봤다. 이제 배달앱을 지워도 된다.`,
    emoji: "🍳",
    condition: (s) => RECIPES.every((r) => (s.cookedDishes ?? []).includes(r.id)),
  },

  // ── 고생 훈장(숨김) ─────────────────────────────
  // 자랑거리가 아니라 흑역사라 hidden으로 둔다 — 목표로 삼을 일이 아니다.
  {
    id: "overtime_streak",
    name: "회사가 집이다",
    desc: "야근을 5일 연속으로 했다. 몸이 먼저 알아본다.",
    emoji: "🌃",
    hidden: true,
    condition: (s) => (s.overtimeStreak ?? 0) >= 5,
  },
  {
    id: "hunger_survivor",
    name: "물로 배 채우기",
    desc: "생활비를 못 내고 3일을 굶었다. 다시는 겪지 말자.",
    emoji: "🥄",
    hidden: true,
    condition: (s) => (s.hungerStreak ?? 0) >= 3,
  },
];
