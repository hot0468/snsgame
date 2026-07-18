import type { GameEvent } from "./events";

/**
 * 논란/박제 시나리오. 사기·성인·저평판 상태에서 확률적으로 터진다.
 * 대응(사과문/잠수/역공)에 따라 팔로워·평판이 크게 출렁인다.
 * GameEvent 구조를 재사용하되, 일반 이벤트 풀과 분리되어 강제로만 발생한다.
 */
export const CONTROVERSY_EVENTS: GameEvent[] = [
  {
    id: "ctrl_scam_exposed",
    emoji: "",
    title: "사기 트윗 박제",
    description:
      "예전에 올린 '꿀팁' 트윗이 사기라는 폭로가 캡처와 함께 퍼지고 있다. " +
      "인용과 리트윗을 타고 순식간에 박제되는 중. 어떻게 대응할까?",
    triggers: [],
    choices: [
      {
        label: "정중히 사과문을 올린다",
        effect: { followersPct: -12, reputation: 6, mental: -8 },
        result: "진솔한 사과로 일부는 등을 돌렸지만, 더 큰 불은 막았다.",
      },
      {
        label: "계정 잠그고 잠수 탄다",
        effect: { followersPct: -25, reputation: -6, mental: -4 },
        result: "잠수 타는 사이 논란은 더 커졌고 팔로워가 대거 이탈했다.",
      },
      {
        label: "재치 있게 받아친다",
        effect: { customKey: "counterAttack" },
        result: "",
      },
    ],
  },
  {
    id: "ctrl_sniped",
    emoji: "",
    title: "저격글 논란",
    description:
      "한 계정이 당신을 콕 집어 저격하는 글을 올렸고, 편이 갈려 타임라인이 설전으로 달아올랐다.",
    triggers: [],
    choices: [
      {
        label: "차분하게 해명글을 쓴다",
        effect: { followersPct: -8, reputation: 5, mental: -6 },
        result: "감정 빼고 사실만 짚었다. 소란은 잦아들었지만 진이 빠졌다.",
      },
      {
        label: "무시하고 넘긴다",
        effect: { followersPct: -14, reputation: -3 },
        result: "무대응으로 일관하자 소문만 무성해지고 팔로워가 빠졌다.",
      },
      {
        label: "재치 있게 받아친다",
        effect: { customKey: "counterAttack" },
        result: "",
      },
    ],
  },
  {
    id: "ctrl_old_take",
    emoji: "",
    title: "과거 발언 재조명",
    description:
      "예전에 올린 아슬아슬한 발언이 다시 발굴돼 도마 위에 올랐다. 지금 기준으론 확실히 위험한 트윗이었다.",
    triggers: [],
    choices: [
      {
        label: "쿨하게 인정하고 사과한다",
        effect: { followersPct: -10, reputation: 7, mental: -7, morality: 3 },
        result: "빠르게 인정하는 태도에 일부는 오히려 호감을 보였다.",
      },
      {
        label: "그 트윗을 조용히 지운다",
        effect: { followersPct: -18, reputation: -5 },
        result: "삭제 사실까지 캡처당해 '증거인멸'이라며 불이 더 붙었다.",
      },
      {
        label: "재치 있게 받아친다",
        effect: { customKey: "counterAttack" },
        result: "",
      },
    ],
  },
  {
    id: "ctrl_adult_doxx",
    emoji: "",
    title: "성인물 신상 유출",
    description:
      "성인 콘텐츠를 올리던 계정의 실명과 얼굴이 특정돼 커뮤니티에 박제됐다. " +
      "지인들에게까지 퍼질까 봐 손이 떨린다. 어떻게 대응할까?",
    triggers: [],
    // 성인물 해제(유저 전역 설정)가 켜져 있어야 후보가 된다
    condition: (s) => s.adultMode,
    choices: [
      {
        label: "당당하게 정면돌파한다",
        effect: { followersPct: -15, reputation: -6, mental: -12, morality: +2 },
        result:
          "숨기지 않고 당당히 맞섰다. 떠나는 사람도 많았지만, 오히려 응원하며 남는 팬들도 생겼다.",
      },
      {
        label: "계정을 비공개로 잠근다",
        effect: { followersPct: -30, reputation: -4, mental: -8 },
        result: "황급히 계정을 잠갔지만 이미 퍼질 대로 퍼진 뒤였다. 팔로워가 대거 이탈했다.",
      },
      {
        label: "재치 있게 받아친다",
        effect: { customKey: "counterAttack" },
        result: "",
      },
    ],
  },
  {
    // 대형 협찬(first_big_sponsor) 수락 후 낮은 확률로 소환된다(systems/events.ts sponsorDeal).
    // triggers:[]이라 스스로 안 뜨고 pendingControversy로만 등장한다.
    id: "ctrl_paid_promo",
    emoji: "",
    title: "뒷광고 논란",
    description:
      "협찬 트윗에 '광고' 표기가 빠졌다는 지적이 올라왔다. 캡처가 돌며 '뒷광고 아니냐'는 말이 번지고 있다.",
    triggers: [],
    choices: [
      {
        label: "바로 광고 표기를 달고 사과한다",
        effect: { followersPct: -6, reputation: 4, mental: -6, morality: 3 },
        result: "빠르게 인정하고 표기를 정정했다. 소란은 하루 만에 잦아들었다.",
      },
      {
        label: "'실수였다'며 대수롭지 않게 넘긴다",
        effect: { followersPct: -16, reputation: -6 },
        result: "안일한 해명에 오히려 불이 붙어, 지켜보던 사람들까지 등을 돌렸다.",
      },
      {
        label: "재치 있게 받아친다",
        effect: { customKey: "counterAttack" },
        result: "",
      },
    ],
  },
];

/** id로 논란 시나리오를 찾는다. */
export function getControversy(id: string): GameEvent | undefined {
  return CONTROVERSY_EVENTS.find((e) => e.id === id);
}
