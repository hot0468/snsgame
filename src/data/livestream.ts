import type { SkillStatId } from "@/core/types";

/**
 * 너튜브 인방(라이브 방송) 콘텐츠.
 * 규칙·계산은 systems/livestream.ts가, 화면은 ui/livestreamModal.ts가 담당한다.
 * 여기는 선언만 한다.
 *
 * 톤: 실제 인터넷 방송의 결. 채팅은 짧고 맞춤법이 헐거우며(ㅋㅋ/ㅇㅇ/ㄹㅇ), 선택지 상황은
 *     방송인이 진짜로 겪는 난처함이다. 과장된 판타지 사건은 넣지 않는다.
 */

/** 방송 타입 id */
export type StreamTypeId = "game" | "talk" | "vtuber";

export interface StreamType {
  id: StreamTypeId;
  label: string;
  emoji: string;
  desc: string;
  /** 시청자 규모를 정하는 관련 스탯(합산해서 본다) */
  skills: SkillStatId[];
  /** 시청자 규모 계수 — 팔로워 대비 몇 %가 들어오는지의 기준 */
  reachFactor: number;
  /** 종료 정산 시 팔로워 전환율 */
  followerRate: number;
  /** 종료 정산 시 시청자 1명당 후원금(원) */
  donationPerViewer: number;
  /** 방송으로 오르는 스탯 */
  gainSkill: SkillStatId;
}

/**
 * 방송 타입 3종. 셋이 **서로 다른 이유로** 매력적이도록 갈랐다:
 * 게임은 숫자(시청자 규모), 수다는 팔로워 전환, 버튜버는 후원금이다.
 * ⚠️ 한 타입이 세 축을 다 이기면 나머지 둘이 죽는다 — 계수를 고칠 땐 이 균형을 확인하라.
 */
export const STREAM_TYPES: StreamType[] = [
  {
    id: "game",
    label: "게임 방송",
    emoji: "🎮",
    desc: "게임을 켜고 플레이를 보여준다. 시청자가 가장 많이 몰리지만 팔로워로는 잘 안 남는다.",
    skills: ["game"],
    reachFactor: 0.1,
    followerRate: 0.06,
    donationPerViewer: 12,
    gainSkill: "game",
  },
  {
    id: "talk",
    label: "수다 방송",
    emoji: "💬",
    desc: "카메라 켜놓고 이야기만 한다. 규모는 작아도 보러 온 사람이 팔로워로 가장 잘 남는다.",
    skills: ["sociability", "comedy"],
    reachFactor: 0.07,
    followerRate: 0.1,
    donationPerViewer: 8,
    gainSkill: "sociability",
  },
  {
    id: "vtuber",
    label: "버튜버 방송",
    emoji: "🐰",
    desc: "2D 아바타를 씌우고 방송한다. 사람은 적게 와도 후원이 유난히 후하다.",
    skills: ["creativity", "beauty"],
    reachFactor: 0.06,
    followerRate: 0.05,
    donationPerViewer: 30,
    gainSkill: "creativity",
  },
];

export function streamTypeById(id: StreamTypeId): StreamType | undefined {
  return STREAM_TYPES.find((t) => t.id === id);
}

/** 채팅 닉네임 풀 — 같은 닉이 여러 번 나와도 자연스럽다(실제 방송이 그렇다) */
export const CHAT_NICKS: string[] = [
  "감자탕전문가", "익명의시청자", "달빛여우", "무지개송편", "김밥천국VIP",
  "새벽세시", "야근중", "고양이집사", "라면물조절", "퇴근하고싶다",
  "지나가던행인", "구독중임", "첫방문", "치킨먹는중", "월요병환자",
  "노잼탐지기", "본방사수", "알림설정함", "폰으로보는중", "누워서보는중",
  "국밥한그릇", "커피수혈", "잠수함", "짤줍는사람", "출근길",
];

/** 방송 타입별 채팅 문구 풀 */
export const CHAT_LINES: Record<StreamTypeId, string[]> = {
  game: [
    "ㅋㅋㅋㅋㅋㅋ 지금 그걸 놓쳐요?", "아니 뒤에 뒤에!!", "와 이건 좀 잘했다",
    "그 템 왜 안 먹음", "님 실력 늘었네요 진짜", "아까부터 저기 적 있었는데",
    "ㄹㅇ 개꿀잼", "이 게임 뭐예요?", "저도 이거 하는데 어렵더라고요",
    "아 아깝다", "한 판만 더!!", "지금 몇 판째임", "손 빠르시네",
    "저 상황에서 그 선택은 좀...", "역시 갓겜", "핑 튀는 거 아님?",
    "ㅇㅇ 나도 저기서 항상 죽음", "컨트롤 미쳤다", "무빙 왜 저래요 ㅋㅋ",
    "설정 좀 만져보세요", "프레임 왜 저럼", "이겼다!!!!", "졌잘싸",
  ],
  talk: [
    "ㅋㅋㅋㅋ 무슨 말인지 알 것 같아요", "오늘 목소리 좋으시네", "저도 그런 적 있어요",
    "형 오늘 텐션 뭐임", "ㄹㅇ 공감", "그래서 어떻게 됐어요?", "헐 진짜요?",
    "저 지금 밥 먹으면서 보는 중", "말 잘하시네요 진짜", "그 얘기 저번에도 하셨어요 ㅋㅋ",
    "오늘 뭔가 기분 좋아 보임", "저 오늘 회사에서 개털림", "위로가 되네요",
    "목 안 아프세요?", "물 좀 드세요", "ㅇㅇ 맞는 말", "아 그거 나도 겪어봄",
    "웃음소리 좋다 ㅋㅋㅋ", "이런 방송 좋아요", "편안하다", "잠 오는데 못 끄겠음",
    "내일 출근인데 왜 보고 있지", "댓글 읽어주세요!",
  ],
  vtuber: [
    "오늘 모델 너무 귀엽다", "표정 바뀌는 거 봐 ㅋㅋ", "목소리 진짜 좋으심",
    "입 모양 싱크 잘 맞네", "아바타 새로 하셨어요?", "귀 움직이는 거 킬포",
    "울지 마세요ㅠㅠ", "후원 쐈어요!", "이 각도 좋다", "배경 예쁘네요",
    "노래 한 번만...", "오늘도 귀여움 인증", "굿즈 언제 나와요?",
    "ㅋㅋㅋㅋ 지금 표정 캡처함", "일러스트 누가 그리신 거예요?", "츄르 드세요",
    "안의 사람 얘기는 금지입니다", "우리 애 오늘 텐션 좋네", "저 이 방송 보려고 야근 째고 옴",
    "모션 부드러워요", "웃을 때 볼 빨개지는 거 좋다", "짱이다 진짜",
  ],
};

/** 선택지 하나 */
export interface StreamChoice {
  label: string;
  /** 고른 결과 문구 */
  result: string;
  /** 시청자 증감 비율(-1 ~ +1). +0.25 = 25% 증가 */
  viewerDelta: number;
  /** 이 선택으로 오르내리는 정신력(없으면 0) */
  mental?: number;
}

/** 방송 중 뜨는 선택지 이벤트 */
export interface StreamEvent {
  id: string;
  /** 이 이벤트가 나오는 방송 타입. 없으면 공용(전 타입) */
  types?: StreamTypeId[];
  /** 상황 설명 */
  situation: string;
  choices: StreamChoice[];
}

/**
 * 선택지 이벤트 풀.
 * ⚠️ 모든 선택지는 **명확한 트레이드오프**를 준다 — 시청자가 늘면 정신력이 깎이는 식이라
 *    항상 옳은 정답이 없어야 한다. 순이득 선택지를 넣으면 고민이 사라진다.
 */
export const STREAM_EVENTS: StreamEvent[] = [
  // ────────────── 게임 방송 전용 ──────────────
  {
    id: "ev_rank_lose",
    types: ["game"],
    situation:
      "랭크전에서 3연패했다. 채팅창이 '님 원래 이렇게 못했나요'로 도배되기 시작한다.",
    choices: [
      {
        label: "정색하고 실력을 증명한다",
        result:
          "말없이 집중 모드로 들어갔다. 다음 판을 캐리하자 채팅이 순식간에 감탄으로 뒤집혔다.",
        viewerDelta: 0.22,
        mental: -8,
      },
      {
        label: "같이 웃으며 자폭 개그",
        result:
          "'제가 원래 이럽니다' 하고 웃어넘겼다. 방송 분위기가 편해지며 사람들이 눌러앉았다.",
        viewerDelta: 0.08,
        mental: 3,
      },
      {
        label: "게임을 바꾼다",
        result: "조용히 다른 게임을 켰다. 랭크 보러 온 사람 일부가 빠져나갔다.",
        viewerDelta: -0.12,
        mental: 2,
      },
    ],
  },
  {
    id: "ev_game_bug",
    types: ["game"],
    situation: "게임이 튕겼다. 재접속하는 동안 화면에 로딩바만 돌아간다.",
    choices: [
      {
        label: "그 틈에 시청자와 잡담",
        result: "로딩을 기다리며 수다를 떨었다. 오히려 이 구간이 재밌었다는 반응이 나왔다.",
        viewerDelta: 0.1,
        mental: -2,
      },
      {
        label: "말없이 재접속만 기다린다",
        result: "정적이 흘렀다. 몇 명이 조용히 나갔다.",
        viewerDelta: -0.15,
      },
    ],
  },
  {
    id: "ev_coop_request",
    types: ["game"],
    situation: "구독자가 '같이 한 판 하고 싶다'며 합방을 요청했다. 채팅이 들썩인다.",
    choices: [
      {
        label: "바로 초대한다",
        result:
          "시청자를 파티에 넣었다. 어설픈 팀플이 오히려 웃겨서 채팅이 폭발했다.",
        viewerDelta: 0.3,
        mental: -6,
      },
      {
        label: "다음에 하자고 미룬다",
        result: "'담에 꼭 해요'로 넘겼다. 아쉬워하는 채팅이 몇 줄 올라왔다.",
        viewerDelta: -0.05,
        mental: 2,
      },
    ],
  },

  // ────────────── 수다 방송 전용 ──────────────
  {
    id: "ev_private_question",
    types: ["talk"],
    situation:
      "누군가 '실제로 무슨 일 하세요? 연봉은요?'라고 물었다. 채팅이 그 질문을 밀어올린다.",
    choices: [
      {
        label: "솔직하게 털어놓는다",
        result:
          "사는 얘기를 있는 그대로 했다. 진솔하다는 반응이 쏟아지며 사람들이 몰려들었다.",
        viewerDelta: 0.25,
        mental: -10,
      },
      {
        label: "농담으로 돌린다",
        result: "'백수입니다'로 웃어넘겼다. 무난하게 지나갔다.",
        viewerDelta: 0.02,
      },
      {
        label: "선을 긋는다",
        result:
          "'사생활은 말 안 할게요'라고 딱 잘랐다. 분위기가 잠깐 가라앉았지만 마음은 편하다.",
        viewerDelta: -0.1,
        mental: 5,
      },
    ],
  },
  {
    id: "ev_hater",
    types: ["talk"],
    situation: "악플러 하나가 계속 인신공격을 올린다. 다른 시청자들이 신고하라고 아우성이다.",
    choices: [
      {
        label: "차단하고 넘어간다",
        result: "조용히 밴을 눌렀다. 채팅창이 금세 평화로워졌다.",
        viewerDelta: 0.03,
        mental: -3,
      },
      {
        label: "정면으로 받아친다",
        result:
          "논리적으로 받아쳤다. 사이다라며 채팅이 터졌지만, 방송이 끝나고도 기분이 나빴다.",
        viewerDelta: 0.2,
        mental: -14,
      },
      {
        label: "못 본 척한다",
        result: "무시하고 하던 얘기를 이어갔다. 악플이 계속 올라와 몇 명이 나갔다.",
        viewerDelta: -0.12,
        mental: -6,
      },
    ],
  },
  {
    id: "ev_counsel",
    types: ["talk"],
    situation:
      "한 시청자가 긴 고민 상담 글을 올렸다. 읽는 데만 1분은 걸릴 분량이다.",
    choices: [
      {
        label: "끝까지 읽고 진지하게 답한다",
        result:
          "천천히 다 읽고 답을 해줬다. 다른 시청자들도 자기 얘기를 꺼내며 방송이 따뜻해졌다.",
        viewerDelta: 0.15,
        mental: -8,
      },
      {
        label: "가볍게 요약해서 답한다",
        result: "핵심만 짚어 짧게 답했다. 무난했다.",
        viewerDelta: 0.02,
      },
    ],
  },

  // ────────────── 버튜버 전용 ──────────────
  {
    id: "ev_inside_person",
    types: ["vtuber"],
    situation:
      "택배 초인종이 울렸다. 마이크가 켜진 채로 '네 잠시만요' 소리가 그대로 나갔다.",
    choices: [
      {
        label: "캐릭터를 유지한 채 넘긴다",
        result:
          "목소리를 다시 잡고 '요정계에도 택배가 온답니다'로 수습했다. 채팅이 프로라며 감탄했다.",
        viewerDelta: 0.18,
        mental: -7,
      },
      {
        label: "웃으며 인정한다",
        result:
          "'네 저도 사람입니다'하고 웃었다. 인간미 있다며 좋아하는 반응과 아쉬워하는 반응이 반반이었다.",
        viewerDelta: 0.05,
        mental: 3,
      },
      {
        label: "잠깐 자리를 비운다",
        result: "화면을 대기 이미지로 돌리고 다녀왔다. 그 사이 시청자가 꽤 빠졌다.",
        viewerDelta: -0.18,
        mental: 2,
      },
    ],
  },
  {
    id: "ev_song_request",
    types: ["vtuber"],
    situation: "'노래 한 번만'이라는 요청이 채팅을 도배한다. 준비한 곡은 없다.",
    choices: [
      {
        label: "즉석에서 한 소절 부른다",
        result:
          "부끄러워하며 한 소절을 불렀다. 클립이 될 것 같다며 채팅이 난리가 났다.",
        viewerDelta: 0.32,
        mental: -12,
      },
      {
        label: "다음 방송 예고로 미룬다",
        result: "'다음에 노래방송 할게요'로 달랬다. 기대된다는 반응이 남았다.",
        viewerDelta: 0.0,
        mental: 2,
      },
    ],
  },
  {
    id: "ev_goods",
    types: ["vtuber"],
    situation: "굿즈를 언제 내냐는 질문이 계속 올라온다. 아직 아무 계획도 없다.",
    choices: [
      {
        label: "당장 만들겠다고 약속한다",
        result:
          "'준비 중입니다!'라고 답했다. 채팅이 들뜨며 후원이 쏟아졌지만, 이제 진짜 만들어야 한다.",
        viewerDelta: 0.2,
        mental: -9,
      },
      {
        label: "솔직히 아직 없다고 말한다",
        result: "계획이 없다고 솔직히 말했다. 조금 김이 샜지만 거짓말은 안 했다.",
        viewerDelta: -0.06,
        mental: 4,
      },
    ],
  },

  // ────────────── 공용 ──────────────
  {
    id: "ev_big_donation",
    situation:
      "갑자기 큰 금액의 후원이 들어왔다. 알림음이 길게 울리고 채팅이 멈칫한다.",
    choices: [
      {
        label: "이름을 부르며 크게 감사 인사",
        result:
          "닉네임을 몇 번이고 부르며 고마워했다. 분위기가 달아올라 후원이 더 들어왔다.",
        viewerDelta: 0.15,
        mental: 5,
      },
      {
        label: "짧게 감사하고 방송을 이어간다",
        result: "'감사합니다' 한마디 하고 하던 걸 계속했다. 담백하게 지나갔다.",
        viewerDelta: 0.03,
      },
    ],
  },
  {
    id: "ev_net_down",
    situation: "인터넷이 불안정하다. 화면이 몇 초씩 멈추고 채팅에 '끊겨요'가 올라온다.",
    choices: [
      {
        label: "화질을 낮춰 방송을 이어간다",
        result: "화질을 내리자 끊김이 잡혔다. 화질은 아쉽지만 방송은 살렸다.",
        viewerDelta: -0.05,
      },
      {
        label: "공유기를 재부팅하고 온다",
        result:
          "잠깐 방송이 끊겼다 돌아왔다. 돌아와 보니 사람이 많이 줄어 있었다.",
        viewerDelta: -0.25,
        mental: -5,
      },
    ],
  },
  {
    id: "ev_late_night",
    situation:
      "방송이 길어졌다. 눈이 뻑뻑하고 목이 잠긴다. 채팅은 '더 해주세요'로 가득하다.",
    choices: [
      {
        label: "조금 더 이어간다",
        result: "더 버텼다. 남아 있던 사람들이 고마워하며 끝까지 함께했다.",
        viewerDelta: 0.12,
        mental: -12,
      },
      {
        label: "슬슬 마무리 짓는다",
        result: "'오늘은 여기까지'라고 말하자 아쉬워하면서도 다들 잘 자라고 인사했다.",
        viewerDelta: -0.08,
        mental: 6,
      },
    ],
  },
];

/** 방송 한 번에 발생하는 선택지 이벤트 수 */
export const STREAM_EVENT_COUNT = 4;
