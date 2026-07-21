/**
 * 네이놈 포털 대회 배너에 뜨는 대회 목록.
 *
 * 이 파일은 **선언만** 한다. 배너 회전(2주)·신청·1주 뒤 결과 판정은 `systems/contest.ts`가 맡는다.
 * 승패는 대회별 연관 스킬(skill)에 비례한다(contestWinChance).
 * ⚠️ 실존 방송·프로그램명을 그대로 쓰지 않는다(가상 패러디). "코미디 빅매치"·"도전! 퀴즈왕" 등.
 */

import type { SkillStatId } from "@/core/types";

export interface Contest {
  id: string;
  name: string;
  /** 배너/신청 화면 상징 이모지 */
  emoji: string;
  /** 배너·신청 화면 한 줄 소개 */
  desc: string;
  /** 입상 확률을 좌우하는 연관 스킬 */
  skill: SkillStatId;
  /** 참가비(0 가능) */
  fee: number;
  /** 입상 상금 */
  prize: number;
}

export const CONTESTS: Contest[] = [
  {
    id: "hackathon",
    name: "무박2일 해커톤",
    emoji: "💻",
    desc: "무박2일, 밤새 코드를 불태워 서비스 하나를 완성하라. 실력만이 답이다.",
    skill: "it",
    fee: 0,
    prize: 5_000_000,
  },
  {
    id: "webtoon_contest",
    name: "차세대 웹툰 공모전",
    emoji: "🎨",
    desc: "당신의 세계관을 한 화에 담아라. 차세대 웹툰 작가를 찾습니다.",
    skill: "creativity",
    fee: 0,
    prize: 3_000_000,
  },
  {
    id: "bodybuilding",
    name: "전국 보디빌딩 대회",
    emoji: "💪",
    desc: "무대 위, 조명 아래. 갈고닦은 몸 하나로 승부한다.",
    skill: "fitness",
    fee: 50_000,
    prize: 1_000_000,
  },
  {
    id: "comedy_bigmatch",
    name: "코미디 빅매치",
    emoji: "🎤",
    desc: "웃기면 이긴다. 무대에서 관객을 뒤집어 놓아라.",
    skill: "comedy",
    fee: 10_000,
    prize: 1_500_000,
  },
  {
    id: "esports_cup",
    name: "전국 e스포츠 챌린저컵",
    emoji: "🎮",
    desc: "전국의 고수들이 모이는 챌린저컵. 손끝 하나에 운명이 갈린다.",
    skill: "game",
    fee: 30_000,
    prize: 4_000_000,
  },
  {
    id: "essay_contest",
    name: "전국 백일장",
    emoji: "✍️",
    desc: "원고지 앞에서 겨루는 필력. 제한 시간 안에 한 편을 완성하라.",
    skill: "vocabulary",
    fee: 0,
    prize: 300_000,
  },
  {
    id: "quiz_king",
    name: "도전! 퀴즈왕",
    emoji: "🧠",
    desc: "상식의 끝을 겨룬다. 마지막까지 살아남는 자가 퀴즈왕.",
    skill: "knowledge",
    fee: 0,
    prize: 2_000_000,
  },
  {
    id: "cosplay_contest",
    name: "코스프레 왕중왕전",
    emoji: "🎭",
    desc: "최애를 향한 애정을 의상 한 벌로. 완성도로 승부하는 왕중왕전.",
    skill: "otaku",
    fee: 20_000,
    prize: 800_000,
  },
];

/** 입상(합격) 결과 메일 본문 — 대회명은 systems가 제목에 넣으므로 여기선 대회를 안 가리는 범용 톤. */
export const CONTEST_WIN_LINES: string[] = [
  "축하합니다! 심사 결과, 당신이 당당히 입상했습니다. 상금은 곧 계좌로 지급될 예정입니다. 🏆",
  "예선부터 결선까지, 당신의 실력이 확실히 빛났습니다. 수상을 진심으로 축하드립니다!",
  "치열한 경쟁을 뚫고 입상자 명단에 이름을 올렸습니다. 상금과 함께 영광을 누리세요.",
  "심사위원 만장일치. 당신의 결과물은 남달랐습니다. 정말 축하합니다! 🎉",
];

/** 탈락 결과 메일 본문 — 범용 톤. */
export const CONTEST_LOSE_LINES: string[] = [
  "아쉽게도 이번 심사에서는 입상하지 못했습니다. 다음 기회에 다시 도전해 주세요.",
  "좋은 시도였지만 수상권에는 들지 못했습니다. 참가 자체로 값진 경험이 되었길 바랍니다.",
  "치열한 경쟁이었습니다. 이번엔 인연이 닿지 않았지만, 분명 성장의 밑거름이 될 거예요.",
  "결과는 아쉽게도 탈락입니다. 그래도 무대에 선 것만으로 충분히 멋졌습니다. 다음을 노려봐요.",
];

/** 대회 결과를 자랑/한탄하는 내 트윗(플레이어 목소리) — 결과 메일의 '결과 트윗하기' 버튼이 쓴다. */
export const CONTEST_TWEET_WIN: string[] = [
  "대회 입상했다!!! 노력한 보람이 있네 🏆 아직도 안 믿겨",
  "상 받았어요 ㅠㅠㅠ 응원해주신 분들 진짜 감사합니다 #수상",
  "입상 인증 📜 올해 목표 하나 이뤘다. 나 자신 칭찬해",
];
export const CONTEST_TWEET_LOSE: string[] = [
  "이번 대회는 아쉽게 탈락 ㅠㅠ 그래도 도전한 게 어디야",
  "결과는 아쉬웠지만 값진 경험이었다. 다음엔 꼭 입상한다 🔥",
  "떨어졌다... 근데 무대에 서본 것만으로 성장한 기분이야",
];
