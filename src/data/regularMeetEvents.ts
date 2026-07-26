import type { EventEffect } from "./events";

/**
 * 정기 모임(러닝크루·성인 그룹방) 참석 누적 횟수 마일스톤 특별 이벤트.
 * systems/appointments.ts의 resolveCrewRun/resolveGroupNight가 참석(go=true) 처리 시
 * 누적 횟수(state.crewRunCount / groupNightCount)와 count가 일치하면 effect를 적용하고
 * message를 결과 문구 뒤에 덧붙인다. (효과 적용은 systems/events.applyEffect)
 */
export interface MeetMilestone {
  /** 이 '누적 참석 횟수'째에 발동 */
  count: number;
  message: string;
  effect: EventEffect;
}

/** 러닝크루 정기런 개근 마일스톤 — 밝은 성취 톤(운동·팔로워·친화 보상). */
export const CREW_MILESTONES: MeetMilestone[] = [
  {
    count: 5,
    message:
      "정기런 개근 5회 달성! 크루에서 러닝 기념 티셔츠를 선물로 주며 단체 인증샷을 남겼다. 꾸준함을 담은 게시물에 잔잔한 응원이 이어졌다.",
    effect: { followers: 40, skills: { fitness: 30 }, mental: 8 },
  },
  {
    count: 10,
    message:
      "10회 개근! 어느새 크루의 고정 멤버가 됐다. 정기 번개 러닝에 정식 러너로 초대받았고, 페이스가 몰라보게 좋아진 인증에 팔로워가 부쩍 늘었다.",
    effect: { followers: 120, skills: { fitness: 30, sociability: 20 }, mental: 10 },
  },
  {
    count: 20,
    message:
      "20회 달성! 크루 대표 러너로 하프마라톤에 출전해 끝내 완주했다. 결승선 인증에 응원 댓글이 쏟아지고, '꾸준함의 아이콘'이라는 별명까지 얻었다.",
    effect: { followers: 400, skills: { fitness: 40, sociability: 20 }, reputation: 5, mental: 10 },
  },
];

/** 그룹방 정기 모임 마일스톤 — 성인 톤(암시적, 음란·팔로워↑·도덕↓). */
export const GROUP_NIGHT_MILESTONES: MeetMilestone[] = [
  {
    count: 5,
    message:
      "5회 참석. 이제 단골 멤버로 통한다. 방장이 '고정 멤버 전용' 심야 세션에 초대했고, 은근한 후기가 성인 피드에서 화제가 됐다.",
    effect: { followers: 60, skills: { lewd: 30 }, morality: -6 },
  },
  {
    count: 10,
    message:
      "10회 참석. 소문을 듣고 모임 규모가 부쩍 커졌다. 오늘 밤의 진한 후기가 알림을 밤새 울렸다.",
    effect: { followers: 150, skills: { lewd: 40 }, morality: -8 },
  },
  {
    count: 20,
    message:
      "20회 참석. 이 바닥에선 이미 유명 인사다. 특별 초청 세션의 아찔한 후기에 팔로워가 폭발했지만, 거울 속 얼굴이 낯설게 느껴진다.",
    effect: { followers: 400, skills: { lewd: 50 }, morality: -10, reputation: -3 },
  },
];
