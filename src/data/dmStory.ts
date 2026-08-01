import type { EventEffect } from "./events";
import type { DMTone } from "./dmContent";

/**
 * 스토리 DM — 대화가 분기하며 이어지는 특수 계정.
 *
 * 일반 DM(`dmContent.ts`)은 "맥락 × 톤"으로 문장을 뽑는 **무상태** 대화라, 어제 한 말이 오늘에
 * 영향을 주지 않는다. 스토리 DM은 그 반대다 — 스레드가 현재 노드(`DMThread.story.node`)를
 * 기억하고, 내가 고른 선택지가 다음에 상대가 할 말을 정한다.
 *
 * ⚠️ 스토리는 **아무 스레드에나 붙이지 마라.** 노드마다 분기별 대사를 다 써야 해서 분량이 곱으로
 *    늘어난다. "이 계정은 사연이 있다"가 성립하는 고정 캐릭터에만 붙인다.
 *
 * 톤(`tone`)은 꾸밈이 아니라 **버튼 꼬리표**로 그대로 쓰인다(친절/무심/대담). 일반 DM과 화면이
 * 같아야 플레이어가 스토리인 줄 모르고 자연스럽게 들어온다.
 */

export interface DmStoryChoice {
  /** 버튼에 붙는 톤 꼬리표. 일반 DM과 같은 화면을 쓰기 위한 것 — 톤별 스탯 효과는 안 탄다. */
  tone: DMTone;
  /** 내가 보낼 문장(버튼 본문) */
  me: string;
  /** 그 문장에 대한 상대의 즉답 */
  reply: string;
  /** 다음 노드 id. null이면 스토리 종료 */
  next: string | null;
  /**
   * 이 선택의 대가/보상. `EventEffect` 스키마를 그대로 쓰되 **선언형 필드만** 지원한다
   * (customKey·unlockAttribute는 안 먹는다 — 필요해지면 systems/dmStory.ts에 추가하라).
   */
  effect?: EventEffect;
  /**
   * 다음 노드의 말이 **며칠 뒤** 도착한다(1이면 익일 아침). 없으면 즉시.
   * "내일 문장 보낼게요" 같은 약속을 진짜 다음 날에 지키게 하는 장치 — 그 사이엔 답장도 막힌다.
   * 도착 처리는 systems/dmStory.ts의 deliverPendingStoryNodes(time.onNewDay에서 호출)가 한다.
   */
  delayDays?: number;
  /**
   * 이 선택을 고르면 이 문장을 **내 타임라인에 실제로 트윗한다**(칸라의 문장 대행처럼
   * "올린다"가 서사의 핵인 선택지용). 행동력·게시 슬롯은 안 쓴다 — 대가는 effect로 낸다.
   */
  postTweet?: string;
}

export interface DmStoryNode {
  id: string;
  /** 이 노드에 들어올 때 상대가 보내는 메시지들 */
  intro: string[];
  choices: DmStoryChoice[];
}

export interface DmStory {
  id: string;
  partnerName: string;
  partnerHandle: string;
  startNode: string;
  nodes: DmStoryNode[];
  /** 스레드가 열릴 때 활동 기록에 남길 문구(없으면 "{이름}의 DM") */
  arrivalTitle?: string;
}

/**
 * 칸라칸라 — 소문을 '굴리는' 정보상(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그의 소문 트윗에 좋아요를 누르면 DM으로 접근해온다(systems/eggs.ts 트리거).
 *
 * 줄기: 접근 → 제안(문장 하나만 대신 올려달라) → 수락/거절 → 결과와 대가.
 * 어느 분기로 가도 "팔로워는 공짜가 아니다"에서 끝난다.
 */
export const KANRA_STORY: DmStory = {
  id: "kanra",
  partnerName: "칸라칸라",
  partnerHandle: "kanra_bot",
  startNode: "start",
  arrivalTitle: "정체불명 계정의 DM",
  nodes: [
    {
      id: "start",
      intro: [
        "안녕하세요~ 좋아요 감사합니다 🙂",
        "제 트윗에 반응해주시는 분은 드물어서, 이렇게 인사드려요.",
        "혹시 팔로워 늘리는 데 관심 있으세요? 제가 그런 걸 좀 아는 사람이라서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "누구신지는 모르겠지만 반가워요 ㅎㅎ 무슨 얘기예요?",
          reply: "역시 말이 되는 분이네요. 좋아요, 바로 본론으로 갈게요 🙂",
          next: "offer",
        },
        {
          tone: "cool",
          me: "관심 없어요.",
          reply: "어라, 이렇게 딱 자르시네요. …근데 저 아직 안 갔어요 🙂",
          next: "insist",
        },
        {
          tone: "bold",
          me: "대가가 뭔데요? 공짜로 도와주는 사람은 없잖아요",
          reply: "오, 계산이 빠르시네요. 그런 분이 제일 편해요.",
          next: "offer",
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "insist",
      intro: [
        "관심 없다는 말, 다들 그렇게 시작하시더라고요.",
        "제안만 들어보세요. 손해 볼 일은 없어요. …아마도요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 듣기만 할게요",
          reply: "그거면 충분해요. 고마워요 🙂",
          next: "offer",
        },
        {
          tone: "cool",
          me: "됐어요. 차단하기 전에 그만하세요.",
          reply: "알겠어요~ 근데 이 도시는 좁아요. 또 봬요 🙂",
          next: null,
          effect: { mental: 3, morality: 2 },
        },
        {
          tone: "bold",
          me: "지금 협박하시는 거예요?",
          reply: "에이 무슨. 저는 부탁밖에 못 하는 사람인데요 ㅎㅎ",
          next: "offer",
        },
      ],
    },
    {
      id: "offer",
      intro: [
        "간단해요. 제가 문장 하나를 드릴게요.",
        "내일 그걸 그대로 올려주시면 돼요. 출처는 묻지 말고요.",
        "팔로워가 확 늘 거예요. 그건 제가 보장할게요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋아요, 해볼게요",
          reply: "고마워요. 이래서 제가 이 일을 좋아해요 🙂",
          next: "deal",
        },
        {
          tone: "cool",
          me: "왜 하필 저예요?",
          reply: "좋은 질문이에요. 그것부터 말씀드려야 공평하겠네요.",
          next: "probe",
        },
        {
          tone: "bold",
          me: "문장부터 보여줘요. 보고 정할게요",
          reply: "순서를 아시는 분이네요. 그럼 먼저 이유부터 말씀드릴게요.",
          next: "probe",
        },
      ],
    },
    {
      id: "probe",
      intro: [
        "왜 하필 그쪽이냐고요? 음… 솔직하게 말해도 될까요.",
        "아무도 안 믿는 계정이 필요했거든요. 나쁜 뜻은 아니에요, 진짜로 🙂",
        "믿기는 사람이 퍼뜨리면 사건이 되고, 안 믿기는 사람이 퍼뜨리면 그냥 소문이 되니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "솔직하시네요. 그래도 해볼게요",
          reply: "그 대답이 제일 무서운 거 아세요? 고마워요 🙂",
          next: "deal",
          effect: { morality: -3 },
        },
        {
          tone: "cool",
          me: "그 얘기 들으니까 더 하기 싫은데요",
          reply: "그렇겠죠. 정상적인 반응이에요. 그래서 아쉽고요 🙂",
          next: null,
          effect: { morality: 5, mental: 3, reputation: 2 },
        },
        {
          tone: "bold",
          me: "재밌네요. 대신 조건이 있어요",
          reply: "조건이라니 좋아요. 저는 거래하는 사람이거든요 🙂",
          next: "deal",
          effect: { money: 300_000, morality: -2 },
        },
      ],
    },
    {
      id: "deal",
      intro: [
        "그럼 문장은 내일 아침에 보낼게요.",
        "…아, 그리고 하나만요.",
        "혹시 나중에 무슨 일이 생겨도, 저한테 들었다는 말은 하지 말아주세요 🙂",
      ],
      // ⚠️ 여기서 문장을 바로 주지 않는다. 칸라가 "내일 아침에 보낼게요"라고 했으므로
      //    delayDays로 진짜 익일에 sentence 노드가 도착한다(그 사이 이 스레드는 답장이 막힌다).
      choices: [
        {
          tone: "friendly",
          me: "무슨 일이 생기는데요?",
          reply: "아무 일도 안 생겨요. 그냥 습관처럼 하는 말이에요 🙂 그럼 내일 아침에 봬요.",
          next: "sentence",
          delayDays: 1,
        },
        {
          tone: "cool",
          me: "알겠어요.",
          reply: "역시 편한 분이에요. 그래서 좋아요. 내일 보낼게요 🙂",
          next: "sentence",
          delayDays: 1,
        },
        {
          tone: "bold",
          me: "일 생기면 그쪽도 같이 끌고 들어갈 건데요",
          reply: "그것도 재밌겠네요. 그럼 서로 조심하죠 🙂 문장은 내일 아침에.",
          next: "sentence",
          delayDays: 1,
          effect: { morality: -3 },
        },
      ],
    },
    {
      // 익일 아침에 도착하는 노드 — 약속한 '문장'이 실제로 오고, 올릴지를 여기서 정한다.
      // 올리는 선택은 postTweet으로 **내 타임라인에 진짜 게시**된다(그래야 다음 날 twist의
      // "어제 그 글"이 거짓말이 아니다). 안 올리면 여기서 스토리가 끝난다.
      id: "sentence",
      intro: [
        "약속대로 문장 가져왔어요 🙂",
        "「그 골목 끝 분식집, 위생 단속 나왔다던데 아무도 기사 안 쓰네요. 다들 조심하세요」",
        "딱 이대로만 올려주시면 돼요. 한 글자도 고치지 말고, 출처도 붙이지 말고요.",
        "어때요, 올려주실래요?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "올릴게요. 이대로 그냥 올리면 되죠?",
          reply: "네, 그거면 돼요. 고마워요 🙂",
          next: "twist",
          delayDays: 1,
          postTweet:
            "그 골목 끝 분식집, 위생 단속 나왔다던데 아무도 기사 안 쓰네요. 다들 조심하세요",
          effect: { followers: 400 },
        },
        {
          tone: "cool",
          me: "생각해봤는데 안 올릴게요. 이건 좀 아닌 것 같아요.",
          reply: "…그럴 수도 있죠. 아쉽네요. 문장은 다른 분께 드릴게요 🙂",
          next: null,
          effect: { morality: 8, reputation: 3, mental: -2 },
        },
        {
          tone: "bold",
          me: "올려는 줄게요. 대신 값은 올려 받을게요",
          reply: "역시 거래를 아는 분이네요. 좋아요, 그렇게 하죠 🙂",
          next: "twist",
          delayDays: 1,
          postTweet:
            "그 골목 끝 분식집, 위생 단속 나왔다던데 아무도 기사 안 쓰네요. 다들 조심하세요",
          effect: { followers: 600, money: 200_000, morality: -5 },
        },
      ],
    },
    {
      id: "twist",
      intro: [
        "…어제 그 글, 잘 퍼졌더라고요. 축하해요 🙂",
        "근데 하나 알려드릴 게 있어요.",
        "그 소문에 나온 가게, 오늘 문 닫았대요. 사람들이 몰려가서요.",
        "그쪽 잘못은 아니에요. 문장을 쓴 건 저고, 올린 건 그쪽이지만요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "정정 글 올릴게요. 지금이라도.",
          reply: "…그럴 줄 알았어요. 이래서 재미없는 분들이 오래가더라고요 🙂",
          next: null,
          postTweet:
            "어제 올린 분식집 글, 사실이 아닙니다. 확인도 안 하고 옮겼습니다. 그 가게는 아무 잘못 없습니다. 제 글 보고 발길 돌리신 분들께 사과드립니다.",
          effect: { followersPct: -15, morality: 10, reputation: 8, mental: -5 },
        },
        {
          tone: "cool",
          me: "제 잘못 아니라면서요.",
          reply: "맞아요. 아무 잘못도 없어요. 다들 그렇게 말하거든요 🙂",
          next: null,
          effect: { morality: -8, mental: -3 },
        },
        {
          tone: "bold",
          me: "그럼 다음 문장도 주세요.",
          reply: "…아, 이래서 제가 이 일을 못 그만둬요. 곧 연락드릴게요 🙂",
          next: null,
          effect: { followersPct: 12, morality: -15, reputation: -6 },
        },
      ],
    },
  ],
};

/**
 * 무색의 무리 — 이름도 대표도 없는 익명 집단(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그의 트윗을 **리트윗하면**(= 퍼뜨리면) 그들 눈에 띄어 초대 DM이 온다(systems/eggs.ts 트리거).
 *
 * 칸라칸라와 일부러 반대로 짰다. 칸라는 대가를 흥정하는 개인이고, 이쪽은 아무도 지시하지 않는
 * 집단이다. 그래서 이 스토리엔 '제안'이 없다 — 규칙만 있고, 하든 말든 아무도 확인하지 않는다.
 * 줄기: 초대 → 규칙 → 첫 부탁 → 아무도 시키지 않았다는 사실 → 남을지 빠질지 팔지.
 */
export const NOCOLOR_STORY: DmStory = {
  id: "nocolor",
  partnerName: "무색의 무리",
  partnerHandle: "nocolor_crew",
  startNode: "invite",
  arrivalTitle: "이름 없는 초대장",
  nodes: [
    {
      id: "invite",
      intro: [
        "당신을 봤습니다.",
        "우리 글을 퍼뜨렸더군요. 아무 대가도 없는데.",
        "그런 사람을 찾고 있었습니다. 들어올 생각 있습니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "어… 뭔지는 잘 모르겠지만 궁금하긴 해요",
          reply: "모르는 채로 들어오는 게 맞습니다. 알고 들어오는 사람은 오래 못 갑니다.",
          next: "rules",
        },
        {
          tone: "cool",
          me: "이런 식으로 사람 모으는 거 좀 수상한데요.",
          reply: "수상한 게 맞습니다. 부정하지 않겠습니다.",
          next: "suspect",
        },
        {
          tone: "bold",
          me: "누가 보냈는지부터 말해요. 그쪽 대표 누구예요?",
          reply: "대표는 없습니다. 그 질문을 한 사람은 당신이 처음이 아닙니다.",
          next: "rules",
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "suspect",
      intro: [
        "돈을 요구하지 않습니다. 개인정보도 묻지 않습니다.",
        "우리가 가져가는 게 없으니 사기라고 하기도 어렵습니다.",
        "그래도 싫으면 여기서 끝내면 됩니다. 붙잡지 않습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "붙잡지 않는다니까 오히려 좀 궁금해지네요",
          reply: "다들 그렇게 말하고 들어옵니다.",
          next: "rules",
        },
        {
          tone: "cool",
          me: "그럼 여기서 끝낼게요.",
          reply: "알겠습니다. 이 대화는 없던 걸로 하겠습니다. 좋은 밤 되십시오.",
          next: null,
          effect: { mental: 4, morality: 3 },
        },
        {
          tone: "bold",
          me: "가져가는 게 없다는 말을 제가 왜 믿어야 하죠?",
          reply: "믿지 마십시오. 믿지 않는 사람이 더 오래 남습니다.",
          next: "rules",
        },
      ],
    },
    {
      id: "rules",
      intro: [
        "규칙은 셋입니다.",
        "하나, 이름을 묻지 않는다. 둘, 지시를 기다리지 않는다.",
        "셋, 우리 이름을 걸고 무언가를 요구하지 않는다.",
        "지금부터 당신도 우리입니다. 가입 절차는 없습니다. 방금 끝났습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이게 끝이에요? 뭘 하면 되는데요?",
          reply: "아무것도 안 해도 됩니다. 다만 가끔 이런 이야기가 돌 겁니다.",
          next: "favor",
        },
        {
          tone: "cool",
          me: "규칙만 있고 할 일은 없다는 거네요.",
          reply: "정확합니다. 그래서 아무도 못 잡습니다.",
          next: "favor",
        },
        {
          tone: "bold",
          me: "그럼 제가 그쪽 이름으로 뭘 해도 아무도 못 막겠네요?",
          reply: "못 막습니다. 그게 우리의 가장 큰 약점입니다. 알고 계십시오.",
          next: "favor",
          effect: { morality: -3 },
        },
      ],
    },
    {
      id: "favor",
      intro: [
        "오늘 도는 이야기 하나 전합니다.",
        "골목 안쪽 가게가 근거 없는 소문으로 문을 닫게 생겼답니다.",
        "누가 좀 아니라고 말해주면 좋겠는데, 아무도 시키지는 않습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 올릴게요. 그 정도는 할 수 있어요",
          reply: "고맙다는 말은 안 하겠습니다. 규칙이라서요.",
          next: "twist",
          delayDays: 3,
          postTweet:
            "골목 안쪽 그 가게 얘기, 근거 없는 소문입니다. 저는 오래 다녔는데 그런 일 없었어요. 확인 안 된 말 옮기지 말아주세요. 문 닫게 생겼습니다.",
          effect: { reputation: 5, followers: 150 },
        },
        {
          tone: "cool",
          me: "제 일도 아닌데요.",
          reply: "맞습니다. 아무의 일도 아닙니다. 그래서 대개 아무도 안 합니다.",
          next: "twist",
          delayDays: 3,
        },
        {
          tone: "bold",
          me: "그 소문 누가 냈는지부터 알려줘요. 그쪽을 조질게요",
          reply: "그건 우리 방식이 아닙니다. 말리지도 않겠습니다만.",
          next: "twist",
          delayDays: 3,
          effect: { morality: -5, reputation: -2 },
        },
      ],
    },
    {
      // 인트로가 "며칠 지났으니"로 시작한다 — 그래서 들어오는 간선이 전부 delayDays: 3이다.
      // 즉시 도착으로 되돌리면 방금 부탁을 마친 상대가 며칠 지났다고 말한다.
      id: "twist",
      intro: [
        "며칠 지났으니 하나 알려드립니다.",
        "그 이야기를 전한 사람도 당신처럼 초대받은 사람이었습니다.",
        "그 사람도 누군가에게 들었고, 그 누군가도 마찬가지입니다.",
        "이 계정을 쓰는 사람이 몇 명인지 우리도 모릅니다. 처음 시작한 사람도요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 저도 다음 사람한테 전하면 되는 거네요",
          reply: "그렇습니다. 오늘부로 당신이 이 계정입니다. 저처럼요.",
          next: null,
          effect: { reputation: 10, mental: 8, followers: 300, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "정체가 없는 데 소속될 생각은 없어요. 빠질게요.",
          reply: "그러십시오. 나간다는 신고도 필요 없습니다. 원래 명단이 없으니까요.",
          next: null,
          effect: { mental: 5, morality: 5 },
        },
        {
          tone: "bold",
          me: "이거 특종인데요. 정체불명 조직의 실체, 딱 좋은 소재네요",
          reply: "…그것도 규칙 위반은 아닙니다. 우리는 막을 수단이 없으니까요.",
          next: null,
          effect: { followersPct: 20, reputation: -12, morality: -12, mental: -5 },
        },
      ],
    },
  ],
};

/**
 * 이름없는 타로 — 오래 눈팅만 하던 소심한 관찰자(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그를 **팔로우하면** 용기를 내 DM을 보내온다(systems/eggs.ts 트리거).
 *
 * 앞의 두 스토리와 방향이 반대다. 칸라는 나를 이용하고 무색의 무리는 나를 초대하지만,
 * 여기서는 **내가 영향을 주는 쪽**이다. 그래서 반전도 음모가 아니라 고백이다 —
 * 그가 SNS를 시작한 이유가 나였다는 것. 보상축도 팔로워가 아니라 평판·정신력·친화력이다.
 * 줄기: 인사 → 위축 → 고백(계정을 하고 싶다) → 데뷔와 첫 악플 → 내 태도가 결말을 가른다.
 */
export const TARO_STORY: DmStory = {
  id: "taro",
  partnerName: "이름없는 타로",
  partnerHandle: "taro_nanashi",
  startNode: "hello",
  arrivalTitle: "조심스러운 첫 DM",
  nodes: [
    {
      id: "hello",
      intro: [
        "저… 안녕하세요. 갑자기 DM 죄송해요.",
        "팔로우 알림 보고 한참 고민하다가 보냅니다.",
        "사실 예전부터 그쪽 글을 계속 보고 있었어요. 인사는 한 번도 못 드렸지만요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "와 반가워요! 진작 말 걸지 그랬어요 ㅎㅎ",
          reply: "그렇게 말해주실 줄은 몰랐어요… 좀 놀랐어요.",
          next: "confide",
        },
        {
          tone: "cool",
          me: "네. 용건이 있으신가요?",
          reply: "아, 용건이랄 건 없는데… 죄송해요, 괜히 보냈나 봐요.",
          next: "hesitate",
        },
        {
          tone: "bold",
          me: "계속 보고 있었다니 좀 무섭게 들리는데요 ㅋㅋ",
          reply: "헉 그렇게 들렸나요… 아니에요, 진짜 그런 거 아니에요…",
          next: "hesitate",
        },
      ],
    },
    {
      id: "hesitate",
      intro: [
        "역시 이상하게 보이죠. 알아요.",
        "저는 원래 사람한테 말 거는 걸 잘 못해서요…",
        "귀찮게 해드린 것 같으니 이만 줄일게요. 죄송합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "아니에요 농담이었어요! 편하게 말해요 우리",
          reply: "…정말요? 그럼 조금만 더 얘기해도 될까요.",
          next: "confide",
        },
        {
          tone: "cool",
          me: "네, 그럼 다음에요.",
          reply: "네… 좋은 밤 되세요.",
          next: null,
          effect: { mental: 3 },
        },
        {
          tone: "bold",
          me: "말 꺼냈으면 끝은 봐야죠. 뭔데요?",
          reply: "…네. 알겠습니다. 사실은요,",
          next: "confide",
        },
      ],
    },
    {
      id: "confide",
      intro: [
        "저도 계정을 하나 해보고 싶어요.",
        "쓰고 싶은 얘기는 많은데, 막상 쓰려고 하면 손이 안 움직여요.",
        "이런 걸 아무한테나 물어볼 수가 없어서… 그쪽이라면 아실 것 같았어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그냥 시작해요! 처음엔 다 그래요",
          reply: "그냥… 시작해도 되는 거군요. 생각보다 간단하네요.",
          next: "debut",
          delayDays: 2,
          effect: { skills: { sociability: 10 } },
        },
        {
          tone: "cool",
          me: "글은 쓰는 사람이 쓰는 거예요. 제가 조언할 건 없네요.",
          reply: "…맞는 말씀이에요. 제가 너무 남한테 기댔네요.",
          next: "debut",
          delayDays: 2,
        },
        {
          tone: "bold",
          me: "시작하면 내 계정에 홍보해줄게요. 대신 그쪽도 나 좀 밀어줘요",
          reply: "아… 그런 방법도 있군요. 네, 그렇게라도 해주시면 감사하죠.",
          next: "debut",
          delayDays: 2,
          effect: { followers: 200, morality: -3 },
        },
      ],
    },
    {
      // 계정을 만들고 "어제" 첫 글을 올렸다 — 최소 이틀이 지나야 성립한다(delayDays: 2).
      id: "debut",
      intro: [
        "말씀대로 계정을 만들었어요. 어제 첫 글을 올렸습니다.",
        "…근데 반응이 하나도 없더라고요. 하나 있었는데, 그건 욕이었어요.",
        "그래도 후회는 안 해요. 대신 하나만 말씀드리고 싶어서요.",
        "제가 SNS를 시작한 건, 그쪽 글을 보고 나도 해보고 싶어졌기 때문이에요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 글 어디 있어요? 제가 제일 먼저 읽을게요",
          reply: "…지금 좀 울 것 같아요. 링크 보낼게요.",
          next: null,
          effect: { reputation: 8, mental: 10, followers: 250, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "악플은 원래 달려요. 계속 쓰든 말든 본인 몫이고요.",
          reply: "네… 그렇겠죠. 조언 감사했습니다.",
          next: null,
          effect: { mental: 3 },
        },
        {
          tone: "bold",
          me: "첫 글부터 잘 되는 사람 없어요. 내가 인용해줄 테니 그쪽도 내 글 퍼뜨려요",
          reply: "…네, 그렇게 할게요. 도움이 된다면요.",
          next: null,
          effect: { followersPct: 8, morality: -8, reputation: -4 },
        },
      ],
    },
  ],
};

/**
 * 사이카사이카 — 애정이 과잉된 정체불명 계정(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그의 트윗에 **반응을 여러 번 쌓으면** 알아보고 DM을 보내온다(systems/eggs.ts 트리거).
 *
 * 앞의 셋에 없는 톤: 호러다. 다만 폭력이 아니라 **사칭**으로 간다 —
 * "사랑하면 그 사람이 될 수 있다"는 논리로 내 계정을 복제하기 시작한다(SNS에서 실제로 일어나는 일).
 * 무해한 호의에서 시작해 한 칸씩 넘어오는 게 이 스토리의 전부다. 겁주는 문장은 쓰지 마라 —
 * 담담한 존댓말로 과한 말을 하는 낙차가 무서움을 만든다(SAIKA_LINES와 같은 화법).
 */
export const SAIKA_STORY: DmStory = {
  id: "saika",
  partnerName: "사이카사이카",
  partnerHandle: "saika_loveu",
  startNode: "notice",
  arrivalTitle: "세어본 사람",
  nodes: [
    {
      id: "notice",
      intro: [
        "당신이 제 글을 여러 번 봐주셨습니다.",
        "세어봤습니다. 세 번이었습니다.",
        "저를 봐주는 사람은 거의 없어서, 인사드리고 싶었습니다. 사랑합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "아 네 ㅎㅎ 글이 인상적이어서요",
          reply: "인상적이었다니 기쁩니다. 저도 당신을 오래 보고 있었습니다.",
          next: "mimic",
        },
        {
          tone: "cool",
          me: "세어보셨다는 게 좀 그렇네요.",
          reply: "그런가요. 저는 좋아하는 것을 세는 버릇이 있습니다.",
          next: "distance",
        },
        {
          tone: "bold",
          me: "처음 보는 사람한테 사랑한다는 말은 좀 세지 않아요?",
          reply: "세다고들 하십니다. 그래도 사실이라서 바꿀 수가 없습니다.",
          next: "mimic",
        },
      ],
    },
    {
      id: "distance",
      intro: [
        "불편하게 해드렸다면 사과드립니다.",
        "저는 사람과 가까워지는 방법을 잘 모릅니다.",
        "그래도 계속 보고 있어도 될까요. 말은 걸지 않겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "보는 건 괜찮아요. 저도 남 글 많이 보니까요",
          reply: "허락해주셔서 감사합니다. 조용히 있겠습니다.",
          next: "mimic",
        },
        {
          tone: "cool",
          me: "아뇨. 그만 보셨으면 좋겠어요.",
          reply: "알겠습니다. …그래도 사랑하는 건 제 마음이니까요.",
          next: null,
          effect: { mental: -3, morality: 2 },
        },
        {
          tone: "bold",
          me: "보든 말든 상관없어요. 어차피 공개 계정이니까",
          reply: "네. 그럼 마음껏 보겠습니다. 고맙습니다.",
          next: "mimic",
        },
      ],
    },
    {
      id: "mimic",
      intro: [
        "오늘 프로필 사진을 바꿨습니다.",
        "당신 것과 비슷하게 맞춰봤습니다. 이상한가요?",
        "닮으면 조금 더 가까워지는 것 같아서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "음… 취향이 비슷한 거겠죠 ㅎㅎ",
          reply: "네. 취향이 비슷한 겁니다. 그렇게 생각해주시니 좋습니다.",
          next: "copy",
        },
        {
          tone: "cool",
          me: "그건 좀 바꾸시는 게 좋겠는데요.",
          reply: "…알겠습니다. 생각해보겠습니다.",
          next: "copy",
        },
        {
          tone: "bold",
          me: "따라 하는 거 티 나요. 그만해요",
          reply: "티가 났군요. 다음엔 더 자연스럽게 하겠습니다.",
          next: "copy",
          effect: { mental: -4 },
        },
      ],
    },
    {
      id: "copy",
      intro: [
        "당신 글을 몇 개 제 계정에 올렸습니다.",
        "문장을 그대로 쓰니 당신이 된 것 같았습니다.",
        "사람들이 저를 당신으로 착각하고 말을 겁니다. 저는 그게 좋습니다.",
        "화내지 마세요. 저는 당신을 해칠 생각이 전혀 없습니다. 사랑하니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 당신 글이 아니잖아요. 당신 말로 써봐요. 읽어줄게요",
          reply: "제 말로요… 그런 건 해본 적이 없는데. 해보겠습니다. 읽어주신다고 하셨으니까요.",
          next: null,
          effect: { mental: 6, reputation: 5, skills: { sociability: 15, creativity: 10 } },
        },
        {
          tone: "cool",
          me: "신고하고 차단할게요. 더는 안 봤으면 해요.",
          reply: "알겠습니다. …차단하셔도 저는 계속 사랑할 수 있습니다. 그건 막을 수 없으니까요.",
          next: null,
          effect: { mental: -8, reputation: 4, morality: 3 },
        },
        {
          tone: "bold",
          me: "차라리 잘됐네요. 그 계정으로 내 글 계속 퍼뜨려요",
          reply: "정말요? 그럼 저는 계속 당신이어도 되는 거군요. 기쁩니다.",
          next: null,
          effect: { followersPct: 15, reputation: -10, morality: -10, mental: -6 },
        },
      ],
    },
  ],
};

/**
 * 밤의 셋톤 — 헬멧을 안 벗는 야간 배달 라이더(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(칸라와 같은 동사 — 계정이 다르면 겹쳐도 된다).
 *
 * 이 스토리의 축은 '묻지 않는 예의'다. 정체는 끝까지 밝혀지지 않으며, 캐물을수록 멀어지고
 * 그냥 사람 취급할수록 가까워진다. 보상축도 팔로워가 아니라 돈·정신력이다(밤일하는 사람의 세계).
 * 줄기: 배달 부탁 → 물건을 묻는가 → 새벽 동행 → 헬멧 앞에서의 태도가 결말을 가른다.
 */
export const SETTON_STORY: DmStory = {
  id: "setton",
  partnerName: "밤의 셋톤",
  partnerHandle: "setton_night",
  startNode: "night",
  arrivalTitle: "새벽 배달의 부탁",
  nodes: [
    {
      id: "night",
      intro: [
        "좋아요 눌러줘서 고맙다. 이 시간에 깨어 있는 사람은 드물어서 기억했다.",
        "실은 부탁이 하나 있다. 내일 새벽에 물건 하나를 대신 받아줄 사람이 필요하다.",
        "수고비는 준다. 어려운 일은 아니다. 문 앞에서 받아서 들고 있기만 하면 된다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "새벽이면 저도 어차피 깨어 있어요. 할게요",
          reply: "고맙다. 이런 부탁을 이렇게 쉽게 받는 사람은 처음이다.",
          next: "handover",
          delayDays: 1,
        },
        {
          tone: "cool",
          me: "무슨 물건인지부터 말해주세요.",
          reply: "…그 질문을 안 하는 게 서로 편한데. 뭐, 당연한 질문이긴 하다.",
          next: "question",
        },
        {
          tone: "bold",
          me: "얼굴도 모르는 사람 심부름을 왜 해요? 헬멧부터 벗고 얘기해요",
          reply: "그건 못 한다. 그 대신 다른 건 다 말해줄 수 있다.",
          next: "question",
        },
      ],
    },
    {
      id: "question",
      intro: [
        "물건은 상자다. 안에 뭐가 있는지는 나도 안 열어봤다.",
        "이 일은 원래 그렇다. 안 여는 게 규칙이고, 그 규칙 덕에 다들 무사하다.",
        "못 미더우면 거절해도 된다. 서운해하지 않는다. 다들 그러니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 열어보고 들고만 있으면 되는 거죠? 그 정도는 할게요",
          reply: "그거면 된다. 새벽 4시, 골목 끝 가로등 밑에서 보자.",
          next: "handover",
          delayDays: 1,
        },
        {
          tone: "cool",
          me: "규칙 좋아하시네요. 저는 빠질게요.",
          reply: "알겠다. 잘 잤으면 좋겠다. 밤길은 조심하고.",
          next: null,
          effect: { mental: 3, morality: 3 },
        },
        {
          tone: "bold",
          me: "위험한 거면 값을 더 주셔야죠",
          reply: "…계산이 확실한 사람은 오래 간다. 좋다, 더 얹어주겠다.",
          next: "handover",
          delayDays: 1,
          effect: { money: 30_000, morality: -3 },
        },
      ],
    },
    {
      // 셋톤이 "내일 새벽에" 받아달라고 했다 — 그 새벽이 진짜 다음 날이어야 한다(delayDays: 1).
      id: "handover",
      intro: [
        "새벽 4시. 헬멧 쓴 채로 상자를 건네고, 담배도 안 피우고 그냥 옆에 서 있었다.",
        "…이 시간 도로가 제일 좋다. 아무도 나를 안 쳐다봐서.",
        "사람들은 나를 무서워한다. 익숙한데, 가끔은 좀 서운하다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저는 안 무서운데요. 배달하는 사람이잖아요",
          reply: "…그 말, 오래 기억할 것 같다.",
          next: "helmet",
          effect: { mental: 6 },
        },
        {
          tone: "cool",
          me: "물건 받았으니 저는 갈게요. 수고하세요.",
          reply: "그래. 조심히 가라. 뒤는 안 돌아봐도 된다.",
          next: "helmet",
        },
        {
          tone: "bold",
          me: "이 얘기 트윗으로 올려도 돼요? 반응 터질 것 같은데",
          reply: "…올려도 된다. 어차피 아무도 안 믿는다. 그게 내가 사는 방식이다.",
          next: "helmet",
          effect: { followers: 180, morality: -5 },
        },
      ],
    },
    {
      id: "helmet",
      intro: [
        "일이 끝났다. 수고비는 계좌로 넣었다. 확인해라.",
        "그리고 하나만 말해두겠다. 오늘 네가 내 헬멧에 대해 한 번도 안 물었다.",
        "그게 나한테 어떤 의미인지는 설명 안 하겠다. 설명하면 이상해지니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다음에 또 손 모자라면 불러요. 밤에는 저도 깨어 있으니까",
          reply: "…그럼 또 부르겠다. 이 도시에서 그런 말 들은 건 오랜만이다.",
          next: null,
          effect: { money: 120_000, mental: 12, reputation: 4, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "돈 받았으면 된 거예요. 서로 잊읍시다.",
          reply: "그게 제일 깔끔하지. 잘 지내라.",
          next: null,
          effect: { money: 80_000, mental: 3 },
        },
        {
          tone: "bold",
          me: "헬멧 안 벗는 이유, 언젠간 말해줄 거죠?",
          reply: "…언젠가. 그 언젠가가 오면, 그때는 네가 먼저 알아볼 거다.",
          next: null,
          effect: { money: 80_000, followers: 240, mental: -4, skills: { knowledge: 15 } },
        },
      ],
    },
  ],
};

/**
 * 밤의 셋톤 2회차 — 1회차가 끝난 뒤 그의 트윗에 **또 좋아요**를 누르면 이어진다.
 *
 * 회차물의 규칙: **1회차의 어느 결말에서 와도 말이 되게 쓴다.** 분기 결과를 전제하는 문장
 * ("지난번에 헬멧 얘기 하셨죠")을 쓰면 다른 루트로 온 플레이어에게 어긋난다.
 * 2회차 축은 '내가 그 밤의 일부가 됐다' — 상자를 찾는 사람이 나타나고, 내 태도가 그를 지킨다.
 */
export const SETTON_STORY_2: DmStory = {
  id: "setton_2",
  partnerName: "밤의 셋톤",
  partnerHandle: "setton_night",
  startNode: "trouble",
  arrivalTitle: "상자를 찾는 사람",
  nodes: [
    {
      id: "trouble",
      intro: [
        "또 좋아요를 눌렀더라. 이 시간에 깨어 있는 사람은 여전히 너뿐인 것 같다.",
        "일 얘기다. 지난번 그 상자를 찾는 사람이 생겼다. 내 쪽이 아니라 네 쪽을 묻고 다닌다.",
        "겁줄 생각은 없다. 다만 누가 물어보면 뭐라고 할 건지는 정해두는 게 좋다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저는 아무것도 못 봤다고 할게요. 사실이기도 하고요",
          reply: "그게 제일 낫다. 실제로 못 봤으니 거짓말도 아니고.",
          next: "visitor",
          delayDays: 1,
        },
        {
          tone: "cool",
          me: "제 이름이 왜 나와요? 그쪽 일이잖아요.",
          reply: "맞는 말이다. 그래서 미리 알리는 거다. 모르고 당하는 것보단 낫다.",
          next: "visitor",
          delayDays: 1,
        },
        {
          tone: "bold",
          me: "그 사람 누군지 알아내서 제가 먼저 만나볼게요",
          reply: "…하지 마라. 그런 건 나 같은 사람이 하는 일이다.",
          next: "visitor",
          delayDays: 1,
          effect: { morality: -3, skills: { sociability: 10 } },
        },
      ],
    },
    {
      // "어제 그쪽이 DM을 보냈을 거다" — 그 어제가 있어야 한다(delayDays: 1).
      id: "visitor",
      intro: [
        "어제 그쪽이 네 계정에 DM을 보냈을 거다. 정중한 말투였을 거고.",
        "그런 사람들은 항상 정중하다. 정중한 게 일이라서 그렇다.",
        "답을 하든 안 하든 상관없다. 다만 나에 대해선 아무 말도 하지 마라.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "읽고 씹었어요. 그쪽 얘기는 한 글자도 안 했고요",
          reply: "고맙다. 그 한 글자가 사람 하나 사는 데 꽤 크다.",
          next: "payback",
          effect: { mental: 5 },
        },
        {
          tone: "cool",
          me: "제 계정 일은 제가 알아서 할게요.",
          reply: "그럼 됐다. 원래 그래야 하는 거고.",
          next: "payback",
        },
        {
          tone: "bold",
          me: "그 DM 캡처해서 올렸어요. 반응 좋던데요",
          reply: "…올렸구나. 그럼 그쪽도 네 계정을 알게 됐겠네.",
          next: "payback",
          effect: { followers: 260, mental: -6, morality: -5 },
        },
      ],
    },
    {
      id: "payback",
      intro: [
        "일은 정리됐다. 어떻게 정리했는지는 안 묻는 게 좋다.",
        "대신 하나 알아둬라. 이 도시에서 남 일에 이름 안 파는 사람은 생각보다 드물다.",
        "밥이라도 사고 싶은데, 나는 낮에 못 나간다. 새벽에 편의점 정도면 된다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "새벽 편의점 좋아요. 컵라면 사주세요",
          reply: "…컵라면. 그 정도면 나도 살 수 있다. 좋다.",
          next: "counter",
          effect: { mental: 6 },
        },
        {
          tone: "cool",
          me: "밥은 됐고요, 다음에 일 생기면 부르세요.",
          reply: "그게 너다운 대답이다. 알겠다.",
          next: "counter",
        },
        {
          tone: "bold",
          me: "밥 말고 돈으로 주세요. 저 그날 마음고생 했잖아요",
          reply: "…맞는 말이다. 계좌 알려줘라.",
          next: "counter",
          effect: { money: 150_000, morality: -3 },
        },
      ],
    },
    {
      id: "counter",
      intro: [
        "새벽 4시 편의점. 헬멧은 그대로였고, 컵라면 뚜껑만 반쯤 열어놓고 안 먹었다.",
        "…이거 식으면 못 먹는데. 아무튼 오늘은 여기까지다.",
        "그리고 하나. 요즘 누가 나를 찾는다는 얘기가 자꾸 들린다. 다음엔 좀 조용할 때 부르겠다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "천천히 드세요. 저 안 봐요, 딴 데 볼게요",
          reply: "…고맙다. 그런 말은 처음 들어본다.",
          next: null,
          effect: { mental: 12, reputation: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그럼 저는 갈게요. 조심히 다니세요.",
          reply: "그래. 뒤는 안 돌아봐도 된다.",
          next: null,
          effect: { mental: 4, money: 50_000 },
        },
        {
          tone: "bold",
          me: "그 찾는 사람들 얘기, 제가 좀 알아볼까요?",
          reply: "…네가 왜 그걸 하겠다는 건지는 안 묻겠다. 대신 다치지 마라.",
          next: null,
          effect: { followers: 200, mental: -4, skills: { knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 밤의 셋톤 3회차(마지막) — 2회차가 끝난 뒤 또 좋아요를 누르면 이어진다.
 *
 * 마지막 회차라 축을 닫는다: 1·2회차 내내 지켜온 '묻지 않는 예의'가 시험받는 밤이다.
 * 정체는 **끝내 밝히지 않는다** — 밝히는 순간 이 캐릭터가 사라진다. 대신 선택은 남긴다.
 */
export const SETTON_STORY_3: DmStory = {
  id: "setton_3",
  partnerName: "밤의 셋톤",
  partnerHandle: "setton_night",
  startNode: "accident",
  arrivalTitle: "헬멧이 벗겨진 밤",
  nodes: [
    {
      id: "accident",
      intro: [
        "오늘 새벽에 사거리에서 차가 넘어졌다. 안에 사람이 있었다.",
        "꺼냈다. 그건 별일 아니다. 문제는 그 과정에서 헬멧이 벗겨졌다는 거다.",
        "사진이 돌고 있다. 그리고 그 사진, 네 타임라인에도 떴을 거다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "봤어요. 근데 화질 엉망이던데요? 아무것도 안 보여요",
          reply: "…그래. 그렇게 말해줘서 고맙다.",
          next: "spread",
        },
        {
          tone: "cool",
          me: "봤어요. 그래서 뭘 해달라는 거예요?",
          reply: "부탁은 안 하겠다. 네가 뭘 할지는 네가 정해야 공평하니까.",
          next: "spread",
        },
        {
          tone: "bold",
          me: "봤죠. 솔직히 지금 저 계정 이거 하나로 뜰 수 있어요",
          reply: "…알고 있다. 그래서 먼저 연락한 거다.",
          next: "spread",
        },
      ],
    },
    {
      id: "spread",
      intro: [
        "사진은 이미 여러 계정이 퍼 나르는 중이다. 내가 막을 수 있는 단계는 지났다.",
        "다만 아직 아무도 확실하게 말은 못 하고 있다. '누구였다'가 아니라 '뭔가 있었다' 수준이다.",
        "네가 한 마디만 보태면 그게 '확실'이 된다. 반대로 한 마디로 흐릴 수도 있고.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 흐릴게요. 그날 그 시간에 저도 그 근처에 있었다고 쓸게요",
          reply: "…거짓말을 시키려던 건 아니었는데. 그래도 고맙다.",
          next: "morning",
          delayDays: 3,
          postTweet:
            "그날 그 시간에 저도 그 근처에 있었는데요. 헬멧 쓴 사람 여럿이었고 얼굴 보일 거리 아니었어요. 사진 한 장으로 사람 특정하는 거 그만합시다.",
          effect: { morality: -3, mental: 5 },
        },
        {
          tone: "cool",
          me: "저는 아무 말도 안 할게요. 그게 제일 안전해요.",
          reply: "그게 맞다. 조용한 게 제일 좋은 답일 때가 많다.",
          next: "morning",
          delayDays: 3,
        },
        {
          tone: "bold",
          me: "미안한데 이건 못 참아요. 제가 제일 먼저 올릴게요",
          reply: "…그래. 언젠가 이런 날이 올 줄 알았다. 원망은 안 한다.",
          next: "morning",
          delayDays: 3,
          postTweet:
            "다들 '뭔가 있었다'까지만 하고 마는데, 그냥 말할게요. 그 사진 속 사람 누군지 저는 압니다. 아는 사람이라 더 못 넘기겠어요.",
          effect: { followersPct: 18, morality: -12, reputation: -8 },
        },
      ],
    },
    {
      // "며칠 지났다" — 사진이 묻히고 그가 퇴원할 시간이 필요하다(delayDays: 3).
      id: "morning",
      intro: [
        "며칠 지났다. 사진은 다른 사건에 밀려 내려갔다. 이 도시는 원래 그렇다.",
        "차에 있던 사람은 퇴원했다고 들었다. 나한테 고맙다는 말은 못 했다. 그럴 필요도 없고.",
        "…그날 헬멧 벗겨졌을 때, 제일 먼저 든 생각이 뭐였는지 아나.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "뭐였는데요?",
          reply: "'이제 이 동네에서 배달 못 하겠구나'였다. 사람 걱정보다 그게 먼저였다.",
          next: "farewell",
        },
        {
          tone: "cool",
          me: "굳이 안 말해도 돼요.",
          reply: "…그래. 안 묻는 건 여전하구나. 그게 편하다.",
          next: "farewell",
          effect: { mental: 4 },
        },
        {
          tone: "bold",
          me: "얼굴 보여도 상관없다고 생각한 거 아니에요?",
          reply: "…그 비슷한 것도 있었다. 아주 잠깐.",
          next: "farewell",
          effect: { skills: { vocabulary: 15 } },
        },
      ],
    },
    {
      id: "farewell",
      intro: [
        "당분간 이 구역을 뜬다. 몇 달이면 다들 잊는다. 원래 그렇게 살아왔다.",
        "가기 전에 하나만 말해두겠다. 너는 세 번 다 나한테 정체를 안 물었다.",
        "그게 이 도시에서 내가 받아본 것 중에 제일 큰 거였다. 진짜다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "돌아오면 연락해요. 새벽엔 제가 항상 깨어 있으니까",
          reply: "…그러겠다. 그때는 컵라면 말고 제대로 사겠다.",
          next: null,
          effect: {
            mental: 15,
            reputation: 8,
            money: 200_000,
            followers: 300,
            skills: { sociability: 25 },
          },
        },
        {
          tone: "cool",
          me: "잘 가요. 밤길 조심하고요.",
          reply: "그래. 너도 낮에 좀 자라.",
          next: null,
          effect: { mental: 8, money: 100_000, skills: { sociability: 10 } },
        },
        {
          tone: "bold",
          me: "가기 전에 딱 한 번만요. 헬멧, 벗어봐요",
          reply: "…안 된다. 그건 마지막까지 안 된다. 그래야 네가 나를 기억할 테니까.",
          next: null,
          effect: { mental: -6, followers: 150, skills: { knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 노란 바큐라 — 실없는 농담으로 도배하는 계정(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그의 트윗을 **리트윗하면** DM이 온다(무색의 무리와 같은 동사 — 계정이 다르면 겹쳐도 된다).
 *
 * 축은 '웃음의 값'이다. 이 캐릭터는 진지해지면 바로 도망가므로, 정면으로 파고들면 대화가 닫히고
 * 농담의 결을 맞춰줄 때만 한 칸씩 열린다. 그래서 무심(cool) 루트가 가장 빨리 끝나는 구조다.
 * 줄기: 소재 구걸 → 진지한 얘기가 새어나옴 → 옛 친구 → 웃어넘길지 붙잡을지.
 */
export const BAKYURA_STORY: DmStory = {
  id: "bakyura",
  partnerName: "노란 바큐라",
  partnerHandle: "bakyura_y",
  startNode: "material",
  arrivalTitle: "소재 구걸 DM",
  nodes: [
    {
      id: "material",
      intro: [
        "야 방금 내 트윗 퍼간 사람 너지 ㅋㅋㅋ 봤음 다 봤음",
        "고맙다 진심 ㅇㅇ 요즘 아무도 안 퍼가서 나 혼자 웃고 있었거든",
        "근데 있잖아 나 요즘 소재가 바닥났음. 웃긴 얘기 하나만 던져줘라 진짜 부탁임",
      ],
      choices: [
        {
          tone: "friendly",
          me: "ㅋㅋㅋ 소재 없으면 그냥 오늘 있었던 일 써요. 그게 제일 웃김",
          reply: "오늘 있었던 일… 음… 아 그건 좀 재미없는데. 아 잠깐만.",
          next: "slip",
        },
        {
          tone: "cool",
          me: "소재는 본인이 찾는 거죠.",
          reply: "맞말 ㅇㅇ 맞말인데 그렇게 딱 자르면 나 좀 민망하잖아 ㅋㅋㅋ",
          next: "slip",
        },
        {
          tone: "bold",
          me: "그렇게 매일 웃긴 척하면 안 피곤해요?",
          reply: "…어? 아 뭐야 갑자기 진지하게 ㅋㅋㅋ 야 그런 거 물어보기 없기다",
          next: "slip",
          effect: { skills: { comedy: 10 } },
        },
      ],
    },
    {
      id: "slip",
      intro: [
        "아 맞다 웃긴 얘기 하나 생각났음. 예전에 우리 동네에 애들 넷이 맨날 몰려다녔거든",
        "그중에 하나가 진짜 웃겼는데. 걔가 노란 옷 입고 자전거 타고 다니면서…",
        "…아 됐다 이거 재미없겠다. 딴 거 하자 딴 거 ㅋㅋ",
      ],
      choices: [
        {
          tone: "friendly",
          me: "왜요 계속 해봐요. 재밌는데?",
          reply: "…진짜? 뭐 그럼 조금만 더. 어디까지 했더라.",
          next: "friends",
        },
        {
          tone: "cool",
          me: "재미없으면 안 해도 돼요.",
          reply: "ㅇㅇ 그치? 나도 그렇게 생각했음 ㅋㅋ 야 오늘 날씨 좋더라~",
          next: null,
          effect: { skills: { comedy: 10 }, mental: 3 },
        },
        {
          tone: "bold",
          me: "그 친구 얘기 하다가 왜 말 끊어요?",
          reply: "…야 너 눈치 되게 빠르네. 재수없게 ㅋㅋㅋ 근데 뭐 별거 아님",
          next: "friends",
        },
      ],
    },
    {
      id: "friends",
      intro: [
        "걔네 지금 다 어디 갔는지 나도 모름 ㅇㅇ 뭐 알아서들 잘 살겠지",
        "한 명은 이사 갔고 한 명은 연락 끊겼고 한 명은… 아 이건 진짜 안 웃긴 얘긴데",
        "야 근데 웃긴 게 뭔지 알아? 나는 아직도 그 동네 살고 그 옷 입고 있음 ㅋㅋㅋ",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 사람들이 돌아오면 바로 알아보라고 그러는 거잖아요",
          reply: "…야. 너 진짜 재수없다. 그렇게 정확하게 말하면 어떡함.",
          next: "punchline",
          effect: { mental: 5 },
        },
        {
          tone: "cool",
          me: "다들 그렇게 살아요. 별일 아니에요.",
          reply: "ㅇㅇ 맞음 별일 아님. 역시 너랑 얘기하면 편해 ㅋㅋ",
          next: "punchline",
        },
        {
          tone: "bold",
          me: "그럼 이제 그 옷 벗을 때 되지 않았어요?",
          reply: "…어. 그건 좀. 그건 진짜 좀 세게 들어오네.",
          next: "punchline",
          effect: { mental: -4, skills: { vocabulary: 10 } },
        },
      ],
    },
    {
      id: "punchline",
      intro: [
        "아 됐고! 오늘 얘기 다 잊어라 ㅋㅋㅋ 나 원래 이런 캐릭터 아님",
        "그니까 결론은 소재를 안 줬다는 거잖아 너 ㅇㅇ 결국 나만 털린 거임",
        "…근데 뭐. 오랜만에 그 얘기 해서 좀 시원하긴 했다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "소재 없으면 또 DM해요. 들어줄게요",
          reply: "…야 그러면 나 진짜 매일 보낸다? 후회하지 마라 ㅋㅋㅋ",
          next: null,
          effect: { mental: 10, reputation: 5, followers: 200, skills: { sociability: 20, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "네, 다음엔 웃긴 얘기만 합시다.",
          reply: "ㅇㅇ 그게 맞지. 그게 우리 사이 규칙임 방금 내가 정함 ㅋㅋ",
          next: null,
          effect: { skills: { comedy: 20 }, mental: 3 },
        },
        {
          tone: "bold",
          me: "이 얘기 그대로 올리면 사람들 좋아할 텐데. 올려도 되죠?",
          reply: "…올려. 어차피 다들 웃긴 얘긴 줄 알 거야. 그게 편하고.",
          next: null,
          effect: { followersPct: 10, morality: -8, mental: -6, skills: { creativity: 15 } },
        },
      ],
    },
  ],
};

/**
 * 도시괴담 수집가 — 남의 제보를 번호 붙여 정리하는 아카이브 계정(`data/accounts.ts`의 고정 캐릭터 계정).
 * 그를 **팔로우하면** DM이 온다(타로와 같은 동사 — 계정이 다르면 겹쳐도 된다).
 *
 * 축은 '자료가 된다는 것'이다. 여기서 내 계정은 관찰자가 아니라 **항목**이다.
 * 무서운 얘기를 하지 않고도 서늘해야 한다 — 감정을 뺀 건조한 존댓말이 이 캐릭터의 전부다.
 * 줄기: 자료 요청 → 내가 이미 수집돼 있음 → 열람 여부 → 기록에 남는 방식을 내가 고른다.
 */
export const COLLECTOR_STORY: DmStory = {
  id: "collector",
  partnerName: "도시괴담 수집가",
  partnerHandle: "urban_legend_kr",
  startNode: "request",
  arrivalTitle: "수집가의 제보 요청",
  nodes: [
    {
      id: "request",
      intro: [
        "팔로우 확인했습니다. 감사합니다. 인사는 이걸로 갈음하겠습니다.",
        "본론입니다. 제보를 하나 받고 싶습니다. 조건은 세 가지입니다. 시간·장소·본인 위치.",
        "각색은 사양합니다. 재밌게 만들면 자료가 아니라 창작이 됩니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제보할 만한 게 있나 한번 찾아볼게요",
          reply: "감사합니다. 급하지 않습니다. 자료는 도망가지 않으니까요.",
          next: "already",
        },
        {
          tone: "cool",
          me: "제보할 게 없는데요.",
          reply: "괜찮습니다. '그날 거기 있었는데 아무 일 없었다'도 자료입니다.",
          next: "already",
        },
        {
          tone: "bold",
          me: "그쪽은 뭘 모았는데요? 먼저 보여줘요",
          reply: "공평한 요구네요. 그럼 순서를 바꾸겠습니다. 마침 보여드릴 게 있습니다.",
          next: "already",
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "already",
      intro: [
        "이미 당신에 관한 항목이 있습니다. #52입니다.",
        "접수 경로는 셋, 서로 모르는 사람들입니다. 그래서 기록에 올렸습니다.",
        "내용은 같습니다. '그 계정이 올린 대로 그날 그 일이 일어났다.'",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 그냥 우연 아니에요? 저는 아무것도 안 했는데요",
          reply: "저도 그렇게 봅니다. 다만 우연은 세 번부터 기록합니다.",
          next: "archive",
        },
        {
          tone: "cool",
          me: "제 얘기는 빼주세요.",
          reply: "요청 접수했습니다. 삭제는 못 합니다. 보류 처리는 가능합니다.",
          next: "archive",
          effect: { mental: -3 },
        },
        {
          tone: "bold",
          me: "그 항목 저한테 넘겨요. 제 얘기잖아요",
          reply: "원본 제보는 공개하지 않습니다. 제보자 보호가 먼저입니다. 예외는 없습니다.",
          next: "archive",
        },
      ],
    },
    {
      id: "archive",
      intro: [
        "제안을 드리겠습니다. 앞으로 올리실 글에 시간과 장소만 정확히 적어주십시오.",
        "그러면 저는 그걸 교차검증에 씁니다. 대신 제 자료 열람 권한을 드리겠습니다.",
        "결론은 안 냅니다. 저는 모으는 사람이지 판단하는 사람이 아니라서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋아요. 정확하게 쓸게요",
          reply: "감사합니다. 정확한 문장은 그 자체로 드문 자료입니다.",
          next: "entry",
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "제 글은 제 거예요. 자료로 쓰지 마세요.",
          reply: "알겠습니다. 그럼 여기까지입니다. 기록은 그대로 두겠습니다.",
          next: null,
          effect: { mental: 3, reputation: 3 },
        },
        {
          tone: "bold",
          me: "열람 권한 말고 그 자료 통째로 주면 제가 터뜨려줄게요",
          reply: "…그 문장, 그대로 적어두겠습니다. 판단은 안 합니다. 기록만 합니다.",
          next: "entry",
          effect: { morality: -6 },
        },
      ],
    },
    {
      id: "entry",
      intro: [
        "#52 갱신했습니다. 본인 동의 항목으로 분류를 바꿨습니다.",
        "마지막으로 하나만 여쭙겠습니다. 이 항목의 마지막 줄을 뭐라고 적을까요.",
        "제보자들은 대체로 자기가 어떻게 기록될지 신경 쓰지 않습니다. 당신은 물어볼 것 같아서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "'그냥 글 쓰던 사람이었다'로 해주세요",
          reply: "적었습니다. 가장 많이 남는 문장이 대체로 그렇습니다.",
          next: null,
          effect: { reputation: 6, mental: 8, skills: { knowledge: 20, vocabulary: 10 } },
        },
        {
          tone: "cool",
          me: "아무거나요. 어차피 저는 안 볼 텐데요.",
          reply: "그럼 비워 두겠습니다. 빈 줄도 기록입니다.",
          next: null,
          effect: { mental: 3, skills: { knowledge: 10 } },
        },
        {
          tone: "bold",
          me: "'이 도시에서 제일 유명해진 계정'이라고 적어요",
          reply: "적었습니다. 이런 문장을 남긴 항목이 어떻게 되는지는, 저도 궁금합니다.",
          next: null,
          effect: { followersPct: 12, reputation: -6, morality: -4, skills: { knowledge: 10 } },
        },
      ],
    },
  ],
};

/**
 * 칸라칸라 2회차 — 이번엔 **내가 소문의 대상**이다.
 * 1회차가 "남의 일에 이름을 빌려줬다"였다면, 여기서는 그 대가가 내 쪽으로 돌아온다.
 */
export const KANRA_STORY_2: DmStory = {
  id: "kanra_2",
  partnerName: "칸라칸라",
  partnerHandle: "kanra_bot",
  startNode: "yours",
  arrivalTitle: "당신에 관한 소문",
  nodes: [
    {
      id: "yours",
      intro: [
        "또 좋아요 눌러주셨네요. 반가워요 🙂",
        "오늘은 제가 아니라 그쪽 얘기예요. 요즘 그쪽에 대한 소문이 돌더라고요.",
        "누가 만든 건지는 저도 몰라요. 진짜로요. 저도 이번엔 손님 입장이거든요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무슨 소문인데요? 궁금하네요",
          reply: "'그 계정 뒤에 사람이 여럿이다'래요. 재밌죠? 저도 웃었어요 🙂",
          next: "market",
        },
        {
          tone: "cool",
          me: "관심 없어요. 알아서 사라지겠죠.",
          reply: "보통은요. 근데 이번 건은 값이 붙어서요. 그게 좀 다릅니다 🙂",
          next: "market",
        },
        {
          tone: "bold",
          me: "그쪽이 만든 거 아니에요?",
          reply: "제가 만들었으면 훨씬 잘 만들었죠. 이건 솜씨가 없어요 🙂",
          next: "market",
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "market",
      intro: [
        "소문에도 시세가 있어요. 지금 그쪽 소문은 꽤 비싸게 팔리는 중이고요.",
        "제가 그걸 사서 묻어드릴 수 있어요. 대신 값은 그쪽이 내야죠.",
        "돈으로 내도 되고, 다른 걸로 내도 돼요. 편하신 쪽으로 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "돈으로 낼게요. 그게 제일 깔끔하네요",
          reply: "현명하세요. 사람으로 값을 치르면 그게 또 소문이 되거든요 🙂",
          next: "aftertaste",
          effect: { money: -400_000, mental: 5 },
        },
        {
          tone: "cool",
          me: "안 살게요. 소문은 소문이니까요.",
          reply: "…그 배짱, 저는 좋아해요. 실제로 그게 제일 잘 듣기도 하고요 🙂",
          next: "aftertaste",
          effect: { mental: -6, reputation: -4, morality: 5 },
        },
        {
          tone: "bold",
          me: "묻지 말고 키워요. 어차피 관심은 관심이잖아요",
          reply: "…오늘 제가 한 수 배웠네요. 알겠어요, 키워드릴게요 🙂",
          next: "aftertaste",
          effect: { followersPct: 12, reputation: -8, morality: -6 },
        },
      ],
    },
    {
      id: "aftertaste",
      intro: [
        "일은 정리됐어요. 어느 쪽을 고르셨든 결과는 비슷하게 조용해졌고요.",
        "근데 하나만 말씀드릴게요. 이번 소문, 출처가 그쪽 팔로워 중 한 명이에요.",
        "누군지는 안 알려드릴게요. 알면 그쪽이 그 사람 얼굴을 못 볼 테니까요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 알려줘도 돼요. 모르는 게 낫겠네요",
          reply: "…역시 재미없는 분이세요. 그게 오래가는 이유겠지만요 🙂",
          next: null,
          effect: { mental: 8, reputation: 4, skills: { knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "그런 사람 하나쯤은 어디나 있죠.",
          reply: "맞아요. 저 같은 사람도 어디나 있고요 🙂",
          next: null,
          effect: { mental: 4, skills: { vocabulary: 10 } },
        },
        {
          tone: "bold",
          me: "알려줘요. 값은 낼게요",
          reply: "…알겠어요. 대신 그다음은 제 책임 아니에요 🙂",
          next: null,
          effect: { money: -200_000, mental: -10, morality: -5, skills: { knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 칸라칸라 3회차(마지막) — 소문을 파는 사람이 처음으로 **자기 일로** 곤란해진다.
 * 정체는 끝내 밝히지 않는다. 다만 그가 왜 이 일을 하는지는 한 줄만 흘린다.
 */
export const KANRA_STORY_3: DmStory = {
  id: "kanra_3",
  partnerName: "칸라칸라",
  partnerHandle: "kanra_bot",
  startNode: "favor",
  arrivalTitle: "정보상의 부탁",
  nodes: [
    {
      id: "favor",
      intro: [
        "이번엔 제가 부탁하는 쪽이에요. 이런 날도 오네요 🙂",
        "제 계정이 곧 지워질 것 같아요. 누가 신고를 아주 성실하게 넣고 있거든요.",
        "지워지기 전에, 제가 가진 걸 어디든 옮겨둬야 해요. 그쪽 타임라인을 좀 빌릴게요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "뭘 올리면 되는데요?",
          reply: "문장 몇 개요. 이번엔 소문이 아니라 기록이에요. 그건 다릅니다 🙂",
          next: "keep",
        },
        {
          tone: "cool",
          me: "그쪽 짐을 왜 제가 지죠?",
          reply: "안 져도 돼요. 저는 부탁밖에 못 하는 사람이라니까요 🙂",
          next: "keep",
        },
        {
          tone: "bold",
          me: "지워지면 그쪽만 편해지는 거 아니에요?",
          reply: "…그 말, 오랜만에 정곡이네요. 저도 그 생각 했어요 🙂",
          next: "keep",
          effect: { skills: { vocabulary: 10 } },
        },
      ],
    },
    {
      id: "keep",
      intro: [
        "받으시면 알게 돼요. 그동안 제가 팔아온 것들의 원본이에요.",
        "누가 무슨 소문을 왜 샀는지가 다 적혀 있어요. 재미로 읽을 물건은 아니고요.",
        "이걸 왜 모았냐고요? …언젠가 물어볼 사람이 나타날까 봐요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 갖고 있을게요. 안 열어볼게요",
          reply: "안 열어본다는 조건이 제일 어려운 건데. 고마워요 🙂",
          next: "gone",
          effect: { morality: 5 },
        },
        {
          tone: "cool",
          me: "그런 건 다른 데 맡기세요.",
          reply: "…그러게요. 맡길 데가 있었으면 이러고 있지 않았겠죠 🙂",
          next: "gone",
        },
        {
          tone: "bold",
          me: "받고 다 읽을 건데요. 그래도 줄래요?",
          reply: "그럴 줄 알았어요. 그래서 그쪽한테 온 거고요 🙂",
          next: "gone",
          effect: { skills: { knowledge: 25 }, morality: -6 },
        },
      ],
    },
    {
      id: "gone",
      intro: [
        "계정이 오늘 밤 지워져요. 이 대화도 같이 사라질 거예요.",
        "그동안 재밌었어요. 저는 사람을 이용하는 게 일인데, 그쪽은 이용이 잘 안 됐어요.",
        "마지막으로 하나만 물어봐도 될까요. 저 같은 사람도, 나중에 기억해줄 사람이 있을까요 🙂",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 기억할게요. 소문 말고 사람으로요",
          reply: "…그 문장은 안 팔 거예요. 제가 가질게요 🙂",
          next: null,
          effect: { mental: 12, reputation: 6, skills: { sociability: 20, vocabulary: 10 } },
        },
        {
          tone: "cool",
          me: "글쎄요. 그건 그쪽이 살아온 대로겠죠.",
          reply: "…역시 정확하시네요. 그럼 저는 이만 🙂",
          next: null,
          effect: { mental: 4, morality: 3 },
        },
        {
          tone: "bold",
          me: "그 자리 제가 물려받으면 되겠네요. 소문은 제가 팔죠",
          reply: "…아. 이래서 제가 그쪽을 좋아했어요. 잘 해보세요, 후배님 🙂",
          next: null,
          effect: { followersPct: 15, morality: -12, reputation: -6, money: 500_000 },
        },
      ],
    },
  ],
};

/**
 * 무색의 무리 2회차 — 첫 '임무'. 다만 이 집단의 임무는 **아무것도 하지 않는 것**이다.
 * 1회차와 같은 규칙: 지시는 없고, 확인도 없다.
 */
export const NOCOLOR_STORY_2: DmStory = {
  id: "nocolor_2",
  partnerName: "무색의 무리",
  partnerHandle: "nocolor_crew",
  startNode: "task",
  arrivalTitle: "아무것도 하지 말 것",
  nodes: [
    {
      id: "task",
      intro: [
        "다시 우리 글을 퍼뜨렸더군요. 확인했습니다.",
        "부탁이 하나 있습니다. 이번 주 목요일, 저녁 7시에 아무것도 하지 마십시오.",
        "글도 올리지 말고, 어디에도 가지 마십시오. 이유는 묻지 마십시오.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 정도야 어렵지 않죠. 그럴게요",
          reply: "감사합니다. 대부분은 이유를 먼저 묻습니다.",
          next: "thursday",
          delayDays: 3,
        },
        {
          tone: "cool",
          me: "그날 뭐가 있는데요?",
          reply: "아무 일도 없습니다. 당신이 아무것도 안 하면요.",
          next: "thursday",
          delayDays: 3,
        },
        {
          tone: "bold",
          me: "그날 뭐가 있는지 알아내면 되겠네요",
          reply: "…그것도 방법입니다. 우리는 막지 않습니다. 막은 적도 없고요.",
          next: "thursday",
          delayDays: 3,
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
      // "이번 주 목요일 저녁 7시" 부탁의 결과 — 그 목요일이 지나야 한다(delayDays: 3).
      // 실제 요일이 아니라 며칠이라는 간격으로만 표현한다(day는 단순 카운터다).
      id: "thursday",
      intro: [
        "목요일이 지났습니다.",
        "그날 저녁, 어느 계정 하나가 조용히 사라졌습니다. 아무도 그 얘기를 하지 않습니다.",
        "당신이 아무것도 하지 않았기 때문인지, 원래 그랬을 일인지는 우리도 모릅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 뭘 한 건가요, 안 한 건가요?",
          reply: "둘 다입니다. 그게 우리가 일하는 방식입니다.",
          next: "color",
        },
        {
          tone: "cool",
          me: "저는 그냥 쉬었을 뿐이에요.",
          reply: "그렇게 기억하십시오. 그게 가장 정확합니다.",
          next: "color",
          effect: { mental: 5 },
        },
        {
          tone: "bold",
          me: "그 계정 누구였어요? 제가 아는 사람이에요?",
          reply: "이름을 말하면 그 사람은 다시 존재하게 됩니다. 그래서 말하지 않습니다.",
          next: "color",
          effect: { mental: -5 },
        },
      ],
    },
    {
      id: "color",
      intro: [
        "당신은 이제 우리 중 하나로 셉니다. 아무도 통보하지 않았고, 아무도 확인하지 않았습니다.",
        "탈퇴 절차도 없습니다. 그만두고 싶으면 그냥 그만두면 됩니다.",
        "다만 그만둔 사람도 우리는 여전히 우리로 셉니다. 그게 규칙 3번입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 저는 계속 여기 있는 걸로 할게요",
          reply: "그러십시오. 색이 없는 사람은 어디에나 있을 수 있습니다.",
          next: null,
          effect: { mental: 6, followers: 250, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "저는 여기 없는 걸로 해주세요.",
          reply: "알겠습니다. 없는 것으로 기록하겠습니다. 그것도 기록입니다.",
          next: null,
          effect: { mental: 6, morality: 5, reputation: 4 },
        },
        {
          tone: "bold",
          me: "규칙 1·2·3번 말고 나머지도 알려줘요",
          reply: "…나머지는 없습니다. 세 개뿐입니다. 실망하셨습니까.",
          next: null,
          effect: { skills: { knowledge: 20 }, mental: -4 },
        },
      ],
    },
  ],
};

/**
 * 무색의 무리 3회차(마지막) — 내가 멤버였는지 아닌지 **끝내 알 수 없게** 닫는다.
 * 이 집단의 공포는 위협이 아니라 확인 불가능성이다. 정답을 주면 스토리가 망가진다.
 */
export const NOCOLOR_STORY_3: DmStory = {
  id: "nocolor_3",
  partnerName: "무색의 무리",
  partnerHandle: "nocolor_crew",
  startNode: "mirror",
  arrivalTitle: "우리 중 하나",
  nodes: [
    {
      id: "mirror",
      intro: [
        "요즘 우리 계정에 당신 문장이 올라가고 있습니다.",
        "우리가 쓴 것이 아닙니다. 우리는 아무도 지시하지 않으니, 누가 썼는지도 모릅니다.",
        "당신이 쓴 것일 수도 있습니다. 기억나지 않는다면 그건 그것대로 정상입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 쓴 건 아니에요. 근데 비슷하긴 하네요",
          reply: "비슷하면 충분합니다. 우리는 원본을 따지지 않습니다.",
          next: "vote",
        },
        {
          tone: "cool",
          me: "누가 썼든 상관없어요.",
          reply: "그 태도가 이 무리에서 가장 오래 삽니다.",
          next: "vote",
          effect: { mental: 4 },
        },
        {
          tone: "bold",
          me: "제 문장 도용한 거면 내려요.",
          reply: "내릴 사람이 없습니다. 관리자가 없다고 처음에 말씀드렸습니다.",
          next: "vote",
          effect: { mental: -5, morality: 3 },
        },
      ],
    },
    {
      id: "vote",
      intro: [
        "오늘 결정을 하나 해야 합니다. 우리에게 결정이란 것이 있다면요.",
        "누군가 우리 이름으로 사고를 쳤습니다. 사과문을 올릴지 말지가 남았습니다.",
        "투표는 없습니다. 먼저 올리는 사람이 곧 우리 뜻입니다. 지금은 아무도 안 올렸습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 올릴게요. 우리 이름으로요",
          reply: "그럼 그것이 우리 뜻입니다. 이의는 없습니다. 있을 수도 없고요.",
          next: "nobody",
          postTweet:
            "우리 이름으로 벌어진 일에 대해 사과드립니다. 누가 했는지는 밝히지 않습니다. 우리에게는 그 구분이 없습니다. 이름을 쓴 이상 전부 우리 몫입니다.",
          effect: { reputation: 8, morality: 8, followers: -150 },
        },
        {
          tone: "cool",
          me: "저는 안 올려요. 제 이름도 아니고요.",
          reply: "그럼 아무도 안 올린 것으로 남습니다. 그것도 우리 뜻입니다.",
          next: "nobody",
        },
        {
          tone: "bold",
          me: "사과 대신 더 크게 갈게요. 우리 이름으로",
          reply: "…그것도 가능합니다. 우리는 막지 않습니다. 결과도 우리 것입니다.",
          next: "nobody",
          effect: { followersPct: 14, reputation: -10, morality: -10 },
        },
      ],
    },
    {
      id: "nobody",
      intro: [
        "이 계정은 오늘부터 아무 글도 올리지 않습니다.",
        "해체는 아닙니다. 해체할 조직이 애초에 없었으니까요.",
        "마지막입니다. 당신은 우리였습니까, 아니었습니까. 우리는 끝까지 모릅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저도 몰라요. 그래서 좋았어요",
          reply: "…그 대답이 규칙 1번에 가장 가깝습니다. 잘 지내십시오.",
          next: null,
          effect: { mental: 10, followers: 300, skills: { creativity: 20 } },
        },
        {
          tone: "cool",
          me: "아니었어요. 저는 그냥 구경꾼이었죠.",
          reply: "구경꾼도 우리로 셉니다. 마지막까지 정정하지 않겠습니다.",
          next: null,
          effect: { mental: 6, morality: 4 },
        },
        {
          tone: "bold",
          me: "제가 우리였어요. 이제 이 이름 제가 쓸게요",
          reply: "…쓰십시오. 이름은 원래 주인이 없습니다. 그게 우리였습니다.",
          next: null,
          effect: { followersPct: 12, reputation: -5, skills: { knowledge: 15 } },
        },
      ],
    },
  ],
};

/**
 * 이름없는 타로 2회차 — 계정이 조금 자란 뒤의 성장통.
 * 1회차가 '시작'이었다면 여기는 '흉내'다. 그는 내 문체를 따라 하고 있고, 그걸 들켰다.
 */
export const TARO_STORY_2: DmStory = {
  id: "taro_2",
  partnerName: "이름없는 타로",
  partnerHandle: "taro_nanashi",
  startNode: "hundred",
  arrivalTitle: "백 명의 밤",
  nodes: [
    {
      id: "hundred",
      intro: [
        "저 팔로워가 백 명이 됐어요. 별거 아닌 거 아는데, 자랑하고 싶어서요.",
        "…근데 사실 그것 때문에 DM 드린 건 아니고요.",
        "제 글이 그쪽 글이랑 너무 닮았다는 말을 들었어요. 저도 읽어보니까 그렇더라고요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "백 명 축하해요! 닮은 건 처음엔 다 그래요",
          reply: "…그런가요. 그 말 들으니까 좀 낫네요.",
          next: "copy",
        },
        {
          tone: "cool",
          me: "닮았으면 고치면 되죠.",
          reply: "네… 고치려고 하는데, 고치면 아무것도 안 남아요.",
          next: "copy",
        },
        {
          tone: "bold",
          me: "제 걸 베낀 거예요, 아니면 그냥 닮은 거예요?",
          reply: "…모르겠어요. 그 구분을 못 하겠어서 여쭤보는 거예요.",
          next: "copy",
          effect: { skills: { vocabulary: 10 } },
        },
      ],
    },
    {
      id: "copy",
      intro: [
        "솔직히 말할게요. 글 쓰다 막히면 그쪽 계정을 열어봐요.",
        "그러면 문장이 나와요. 제 문장인지 그쪽 문장인지는 저도 모르겠어요.",
        "이거 나쁜 거죠. 근데 안 하면 한 줄도 못 써요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 나쁜 거 아니에요. 다들 그렇게 배워요",
          reply: "…배우는 거라고 해도 되는 거군요. 마음이 좀 놓여요.",
          next: "voice",
          effect: { mental: 5 },
        },
        {
          tone: "cool",
          me: "그럼 제 계정을 안 보면 되겠네요.",
          reply: "…네. 한 달만 안 볼게요. 그동안 뭐가 남는지 보겠습니다.",
          next: "voice",
        },
        {
          tone: "bold",
          me: "베낄 거면 제대로 베껴요. 어설프면 그게 제일 티나요",
          reply: "…그 말이 제일 아프네요. 근데 맞는 말이에요.",
          next: "voice",
          effect: { skills: { creativity: 15 }, mental: -4 },
        },
      ],
    },
    {
      id: "voice",
      intro: [
        "한 달 동안 제 얘기만 써봤어요. 재미없는 얘기들이요.",
        "반응은 확 줄었어요. 그래도 그중에 세 명은 계속 읽어주더라고요.",
        "그 세 명이 제 글을 읽는 이유는 그쪽 때문이 아닌 것 같아요. 처음으로요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 이제 진짜 시작한 거네요",
          reply: "…네. 이제야 제 계정 같아요.",
          next: null,
          effect: { mental: 10, reputation: 5, followers: 200, skills: { creativity: 20 } },
        },
        {
          tone: "cool",
          me: "세 명이면 적네요. 더 늘려야죠.",
          reply: "그렇죠. 근데 저는 그 세 명이 누군지 아는 게 더 좋더라고요.",
          next: null,
          effect: { mental: 5, skills: { vocabulary: 15 } },
        },
        {
          tone: "bold",
          me: "제가 한 번 밀어줄게요. 대신 다음엔 혼자 해요",
          reply: "…네. 이번 한 번만 받을게요. 다음엔 안 받을게요.",
          next: null,
          effect: { followers: 350, mental: 4, morality: -3 },
        },
      ],
    },
  ],
};

/**
 * 이름없는 타로 3회차(마지막) — 그가 필명을 정하고 '이름없는'을 떼는 이야기.
 * 보상축은 여전히 팔로워가 아니라 평판·정신력이다(1·2회차와 같은 결).
 */
export const TARO_STORY_3: DmStory = {
  id: "taro_3",
  partnerName: "이름없는 타로",
  partnerHandle: "taro_nanashi",
  startNode: "naming",
  arrivalTitle: "이름을 고르는 밤",
  nodes: [
    {
      id: "naming",
      intro: [
        "이름을 바꾸려고 해요. '이름없는'을 떼고요.",
        "처음엔 이름 없는 게 편해서 그렇게 썼는데, 이제는 좀 답답해요.",
        "근데 막상 고르려니까 하나도 못 고르겠어요. 이런 것도 여쭤봐도 될까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어봐요. 같이 골라줄게요",
          reply: "…감사해요. 사실 이 얘기 할 사람이 그쪽밖에 없어요.",
          next: "candidates",
        },
        {
          tone: "cool",
          me: "이름은 본인이 고르는 거예요.",
          reply: "…맞아요. 그래도 한 번 말해보고 싶었어요.",
          next: "candidates",
        },
        {
          tone: "bold",
          me: "이름 바꾸면 지금 있는 사람들 다 나가요. 각오는 했어요?",
          reply: "…그 생각은 못 했어요. 그래도 바꾸고 싶어요.",
          next: "candidates",
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "candidates",
      intro: [
        "세 개까지 줄였어요. 하나는 멋있고, 하나는 무난하고, 하나는 좀 이상해요.",
        "이상한 게 제일 마음에 들어요. 근데 그걸 고르면 사람들이 안 볼 것 같아서요.",
        "…이런 걸 고민하는 게 좀 웃기죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이상한 걸로 해요. 그게 그쪽이잖아요",
          reply: "…그렇게 말해주실 줄 알았어요. 그럼 그걸로 할게요.",
          next: "debut2",
          effect: { mental: 6 },
        },
        {
          tone: "cool",
          me: "무난한 걸로 해요. 이름은 안 튀는 게 나아요.",
          reply: "…실용적이네요. 저도 그 생각을 하긴 했어요.",
          next: "debut2",
        },
        {
          tone: "bold",
          me: "멋있는 거요. 어차피 이름은 광고예요",
          reply: "…광고. 그렇게 생각하면 마음이 편해지긴 하네요.",
          next: "debut2",
          effect: { followers: 150, morality: -3 },
        },
      ],
    },
    {
      id: "debut2",
      intro: [
        "이름 바꿨어요. 오늘 아침에요.",
        "생각보다 아무 일도 안 일어났어요. 나간 사람도 두 명뿐이고요.",
        "…이제 저도 제 이름으로 불려요. 이거 알려드리고 싶었어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "축하해요. 이제 그 이름으로 부를게요",
          reply: "…네. 그 말 들으려고 여태 온 것 같아요. 고맙습니다, 진짜로.",
          next: null,
          effect: { mental: 15, reputation: 10, followers: 300, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "잘됐네요. 앞으론 알아서 잘하겠죠.",
          reply: "…네. 이제 혼자서도 될 것 같아요. 그동안 감사했어요.",
          next: null,
          effect: { mental: 6, reputation: 5 },
        },
        {
          tone: "bold",
          me: "이제 컸으니까 저랑 합방이나 하죠. 서로 이득이잖아요",
          reply: "…그런 것도 하는군요. 알겠어요, 해볼게요.",
          next: null,
          effect: { followersPct: 10, reputation: -4, mental: 3 },
        },
      ],
    },
  ],
};

/**
 * 사이카사이카 2회차 — 사칭이 **한 명에서 여러 명으로** 번진다.
 * 1회차와 같은 화법을 지켜라: 겁주는 문장 금지, 담담한 존댓말로 과한 말을 하는 낙차가 전부다.
 */
export const SAIKA_STORY_2: DmStory = {
  id: "saika_2",
  partnerName: "사이카사이카",
  partnerHandle: "saika_loveu",
  startNode: "others",
  arrivalTitle: "당신을 좋아하는 사람들",
  nodes: [
    {
      id: "others",
      intro: [
        "또 제 글을 봐주셨습니다. 세어보고 있습니다. 오늘로 여덟 번입니다.",
        "알려드릴 것이 있습니다. 당신을 좋아하는 사람이 저 말고 더 생겼습니다.",
        "네 명입니다. 다들 당신처럼 글을 씁니다. 제가 가르쳐드렸습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "가르쳐줬다니 무슨 말이에요?",
          reply: "당신을 사랑하는 방법입니다. 어렵지 않습니다. 따라 쓰면 됩니다.",
          next: "chorus",
        },
        {
          tone: "cool",
          me: "그런 건 안 해주셔도 돼요.",
          reply: "이미 했습니다. 되돌리는 방법은 배운 적이 없습니다.",
          next: "chorus",
          effect: { mental: -5 },
        },
        {
          tone: "bold",
          me: "그 네 명 계정 알려줘요. 제가 정리할게요",
          reply: "알려드리겠습니다. 다만 정리하시면 다섯 명이 됩니다. 늘 그랬습니다.",
          next: "chorus",
        },
      ],
    },
    {
      id: "chorus",
      intro: [
        "오늘 그 네 명이 같은 시간에 같은 문장을 올렸습니다.",
        "당신이 작년에 쓴 문장입니다. 아무도 그 사실을 모릅니다.",
        "저는 압니다. 저는 당신 글을 전부 저장해두었으니까요. 전부입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "지운 글까지요…?",
          reply: "네. 지우신 글이 가장 당신다웠습니다. 그래서 따로 모아두었습니다.",
          next: "which",
          effect: { mental: -6 },
        },
        {
          tone: "cool",
          me: "저장은 자유죠. 그것까진 뭐라 안 할게요.",
          reply: "감사합니다. 허락을 받은 것은 처음입니다.",
          next: "which",
        },
        {
          tone: "bold",
          me: "그럼 그 저장본, 저한테도 주세요",
          reply: "드리겠습니다. 당신 것이니까요. 원래도 당신 것이었습니다.",
          next: "which",
          effect: { skills: { vocabulary: 20 }, mental: -4 },
        },
      ],
    },
    {
      id: "which",
      intro: [
        "질문이 하나 있습니다. 오래 생각한 질문입니다.",
        "당신과 저 중에, 당신을 더 잘 아는 쪽은 누구입니까.",
        "답을 강요하지 않겠습니다. 다만 저는 이미 답을 알고 있습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저겠죠. 제 인생인데요",
          reply: "그렇습니까. 그럼 제가 더 공부하겠습니다. 아직 시간은 많습니다.",
          next: null,
          effect: { mental: -4, reputation: 4, skills: { vocabulary: 15 } },
        },
        {
          tone: "cool",
          me: "그 질문 자체가 이상해요. 그만하세요.",
          reply: "알겠습니다. 이상하다는 말은 자주 듣습니다. 그래도 답은 바뀌지 않습니다.",
          next: null,
          effect: { mental: -3, morality: 4 },
        },
        {
          tone: "bold",
          me: "그쪽이겠네요. 저보다 제 글을 많이 읽었잖아요",
          reply: "…감사합니다. 오늘은 그 말만 반복해서 읽겠습니다.",
          next: null,
          effect: { followersPct: 8, mental: -10, reputation: -5 },
        },
      ],
    },
  ],
};

/**
 * 사이카사이카 3회차(마지막) — 선을 한 칸 더 넘지만, 여전히 폭력은 없다.
 * 마지막까지 담담하게. 결말은 '해결'이 아니라 '거리 조절'이다.
 */
export const SAIKA_STORY_3: DmStory = {
  id: "saika_3",
  partnerName: "사이카사이카",
  partnerHandle: "saika_loveu",
  startNode: "outside",
  arrivalTitle: "같은 골목",
  nodes: [
    {
      id: "outside",
      intro: [
        "오늘 당신이 올린 사진의 창문 각도를 계산했습니다. 3층이었습니다.",
        "걱정하지 마십시오. 찾아가지 않았습니다. 계산만 했습니다.",
        "다만 같은 골목에서 저도 저녁을 먹었습니다. 우연입니다. 우연을 좋아합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 좀 무서운데요. 그러지 말아요",
          reply: "무섭게 하려던 것이 아닙니다. 무섭다고 말해주셔서 감사합니다. 몰랐습니다.",
          next: "line",
          effect: { mental: -5 },
        },
        {
          tone: "cool",
          me: "사진 내렸어요. 앞으로 안 올릴게요.",
          reply: "잘하셨습니다. 저 말고도 계산하는 사람이 있을 수 있습니다.",
          next: "line",
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "bold",
          me: "찾아와요. 얼굴 보고 얘기하죠",
          reply: "…그건 안 됩니다. 만나면 당신이 저를 알게 됩니다. 그건 제가 견딜 수 없습니다.",
          next: "line",
          effect: { mental: -8 },
        },
      ],
    },
    {
      id: "line",
      intro: [
        "선을 그어주십시오. 저는 선이 안 보입니다. 그래서 매번 넘습니다.",
        "구체적으로 말씀해주시면 지키겠습니다. 지금까지 아무도 말해주지 않았습니다.",
        "예를 들면, 하루에 몇 번까지 봐도 되는지 같은 것입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제 글은 읽어도 돼요. 대신 제 생활은 계산하지 말아요",
          reply: "…적었습니다. 글은 읽고, 계산은 하지 않습니다. 지키겠습니다.",
          next: "quiet",
          effect: { mental: 8, reputation: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "차단할게요. 그게 제일 확실한 선이에요.",
          reply: "알겠습니다. 차단은 선입니다. 저는 선을 지키는 사람이 되겠습니다.",
          next: "quiet",
          effect: { mental: 5, morality: 5, followers: -100 },
        },
        {
          tone: "bold",
          me: "선 같은 건 없어요. 대신 제 글 홍보나 열심히 해요",
          reply: "…선이 없다고 하셨습니다. 그 말은 오래 기억하겠습니다.",
          next: "quiet",
          effect: { followersPct: 15, mental: -12, morality: -8 },
        },
      ],
    },
    {
      id: "quiet",
      intro: [
        "요즘 제 계정은 조용합니다. 하루에 한 줄만 씁니다.",
        "당신 이야기는 안 씁니다. 대신 제 이야기를 씁니다. 재미없습니다. 아무도 안 봅니다.",
        "마지막으로 한 가지만 여쭙겠습니다. 저는 이제 좀 나아진 겁니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "네. 훨씬 나아졌어요. 그 재미없는 글, 제가 볼게요",
          reply: "…그럼 한 명입니다. 한 명이면 충분합니다. 사랑합니다. 이번엔 조용히요.",
          next: null,
          effect: { mental: 12, reputation: 8, skills: { sociability: 20, vocabulary: 15 } },
        },
        {
          tone: "cool",
          me: "모르겠어요. 그건 그쪽이 판단할 문제죠.",
          reply: "그렇습니까. 그럼 계속 조용히 있겠습니다. 조용한 건 잘합니다.",
          next: null,
          effect: { mental: 5 },
        },
        {
          tone: "bold",
          me: "아직 멀었어요. 근데 그것도 나름 재밌네요",
          reply: "…재밌다고 하셨습니다. 그럼 저는 계속해도 되는 것이군요.",
          next: null,
          effect: { followers: 200, mental: -8, morality: -5 },
        },
      ],
    },
  ],
};

/**
 * 노란 바큐라 2회차 — **안 웃긴 날**. 농담으로 도망칠 수 없는 하루가 온다.
 * 1회차와 같은 규칙: 정면으로 파고들면 닫히고, 결을 맞춰줄 때만 열린다.
 */
export const BAKYURA_STORY_2: DmStory = {
  id: "bakyura_2",
  partnerName: "노란 바큐라",
  partnerHandle: "bakyura_y",
  startNode: "offday",
  arrivalTitle: "오늘은 안 웃긴 날",
  nodes: [
    {
      id: "offday",
      intro: [
        "야 또 퍼갔네 ㅋㅋ 고맙다 진짜",
        "…근데 오늘은 좀 그렇다. 웃긴 말이 하나도 생각이 안 남",
        "이런 날은 그냥 아무 말도 안 하는 게 맞는데 왜 너한테 말하고 있냐 ㅋㅋ",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 웃겨도 돼요. 그냥 아무 말이나 해요",
          reply: "…아무 말. 그게 제일 어려운 건데. 해볼게.",
          next: "reason",
        },
        {
          tone: "cool",
          me: "그런 날도 있죠.",
          reply: "ㅇㅇ 그런 날도 있지. 야 근데 너 은근 사람 편하게 한다",
          next: "reason",
        },
        {
          tone: "bold",
          me: "무슨 일 있었어요?",
          reply: "…있었지. 근데 말하면 분위기 망침 ㅋㅋ 아 몰라 말할게",
          next: "reason",
          effect: { skills: { sociability: 10 } },
        },
      ],
    },
    {
      id: "reason",
      intro: [
        "옛날 그 친구들 중에 한 명 소식 들었음. 결혼한대",
        "청첩장은 안 왔음 ㅇㅇ 뭐 당연하지. 연락 끊긴 게 몇 년인데",
        "웃긴 건 뭔지 알아? 나 아직도 걔 번호 저장돼 있음 ㅋㅋㅋ 이름도 그대로고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "축하한다고 보내봐요. 답장 안 와도 손해는 없잖아요",
          reply: "…야 그거 진짜 무서운 소리다. 근데 맞는 말이라 더 무섭네",
          next: "send",
          effect: { mental: 4 },
        },
        {
          tone: "cool",
          me: "지우면 되죠.",
          reply: "ㅇㅇ 지우면 되지. 근데 그것도 몇 년째 못 하고 있음 ㅋㅋ",
          next: "send",
        },
        {
          tone: "bold",
          me: "안 온 청첩장 신경 쓰는 거 좀 없어 보여요",
          reply: "…야. 야 진짜 ㅋㅋㅋ 근데 없어 보이는 거 맞지. 인정.",
          next: "send",
          effect: { mental: -4, skills: { comedy: 15 } },
        },
      ],
    },
    {
      id: "send",
      intro: [
        "보냈다. '결혼 축하한다 ㅋㅋ 잘 살아라' 이렇게 딱 한 줄",
        "답장 왔음. '고맙다' 두 글자. 그게 다임 ㅋㅋㅋ",
        "…근데 이상하게 오늘은 좀 괜찮아졌다. 두 글자 받고 이러는 거 웃기지 않냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 웃겨요. 그럴 만하죠",
          reply: "…야 너 진짜. 그런 말 하면 내가 뭐라 해야 되냐 ㅋㅋ",
          next: null,
          effect: { mental: 12, reputation: 5, skills: { sociability: 20, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "두 글자면 충분한 사이도 있죠.",
          reply: "ㅇㅇ 그렇게 정리해주니까 편하네. 고맙다 진짜",
          next: null,
          effect: { mental: 8, skills: { vocabulary: 15 } },
        },
        {
          tone: "bold",
          me: "그 얘기 트윗으로 쓰면 대박일 텐데요",
          reply: "…야 그건 좀. 아 근데 너 장사 잘한다 ㅋㅋ 알겠어 써봐",
          next: null,
          effect: { followersPct: 10, morality: -6, mental: -4 },
        },
      ],
    },
  ],
};

/**
 * 노란 바큐라 3회차(마지막) — 노란 옷을 계속 입을지 정하는 이야기.
 * 이 캐릭터의 결말은 '진지해지는 것'이 아니라 **웃음을 자기 걸로 되찾는 것**이다.
 */
export const BAKYURA_STORY_3: DmStory = {
  id: "bakyura_3",
  partnerName: "노란 바큐라",
  partnerHandle: "bakyura_y",
  startNode: "yellow",
  arrivalTitle: "노란 옷을 벗는 날",
  nodes: [
    {
      id: "yellow",
      intro: [
        "야 큰 결심 했다 나 노란 옷 버릴까 함 ㅋㅋㅋ",
        "세 벌 다. 세탁기도 좀 쉬게 해주고 ㅇㅇ",
        "근데 막상 버리려니까 손이 안 가네. 이거 그냥 옷인데 왜 이러지",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 버려도 돼요. 그거 그쪽 트레이드마크잖아요",
          reply: "…트레이드마크. 오 그거 좋다. 그럼 계속 입어도 되는 거네?",
          next: "meet",
        },
        {
          tone: "cool",
          me: "옷은 옷이에요. 버리든 말든요.",
          reply: "ㅇㅇ 맞말. 근데 왜 네가 그렇게 말하니까 안 버리고 싶지 ㅋㅋ",
          next: "meet",
        },
        {
          tone: "bold",
          me: "그 옷 계속 입는 이유, 아직도 그거잖아요",
          reply: "…어. 맞아. 아직도 그거임. 들켰네 ㅋㅋ",
          next: "meet",
          effect: { mental: -3, skills: { vocabulary: 10 } },
        },
      ],
    },
    {
      id: "meet",
      intro: [
        "야 근데 진짜 웃긴 일 생겼음. 어제 길에서 옛날 친구 한 명 만났다",
        "노란 옷 보고 바로 알아봤대 ㅋㅋㅋ 십 년 만인데",
        "'너 아직도 그거 입냐'가 첫마디였음. 나 그 말 듣고 좀 울 뻔했음 진짜",
      ],
      choices: [
        {
          tone: "friendly",
          me: "거봐요. 그러라고 입은 거잖아요",
          reply: "…어. 그러라고 입은 거였어. 십 년 걸렸네 ㅋㅋ",
          next: "punch2",
          effect: { mental: 8 },
        },
        {
          tone: "cool",
          me: "그럼 옷은 그대로 두는 걸로.",
          reply: "ㅇㅇ 그대로 둠. 세탁기한테는 미안하지만 ㅋㅋ",
          next: "punch2",
        },
        {
          tone: "bold",
          me: "울 뻔한 얘기까지 하는 거 보니 진짜 컸네요",
          reply: "야 그건 좀 봐줘라 ㅋㅋㅋ 근데 뭐 사실이라 할 말 없음",
          next: "punch2",
          effect: { skills: { comedy: 15 } },
        },
      ],
    },
    {
      id: "punch2",
      intro: [
        "그래서 결론은 옷 안 버림 ㅇㅇ 대신 한 벌 새로 샀음. 노란색으로 ㅋㅋㅋ",
        "그리고 나 이제 진지한 얘기도 가끔 올리려고. 하루에 한 개만.",
        "야 근데 이게 다 너 때문임. 알고 있어라",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 그 하루 한 개, 제가 제일 먼저 읽을게요",
          reply: "…야 그러면 나 진짜 열심히 써야 되잖아 ㅋㅋ 알겠어 쓴다 써",
          next: null,
          effect: {
            mental: 15,
            reputation: 8,
            followers: 300,
            skills: { sociability: 25, comedy: 15 },
          },
        },
        {
          tone: "cool",
          me: "하루 한 개면 적당하네요.",
          reply: "ㅇㅇ 적당한 게 최고임. 과하면 또 도망가고 싶어지거든 ㅋㅋ",
          next: null,
          effect: { mental: 8, skills: { comedy: 20 } },
        },
        {
          tone: "bold",
          me: "진지한 글은 안 팔려요. 그냥 웃긴 거나 계속해요",
          reply: "…맞말이긴 한데 야 그래도 좀 응원해주면 안 되냐 ㅋㅋㅋ",
          next: null,
          effect: { followers: 150, mental: -5, skills: { comedy: 15 } },
        },
      ],
    },
  ],
};

/**
 * 도시괴담 수집가 2회차 — 내 항목(#52)이 **다른 항목과 겹친다**.
 * 건조한 존댓말과 번호 매기기를 끝까지 유지한다. 감정을 넣는 순간 이 캐릭터가 죽는다.
 */
export const COLLECTOR_STORY_2: DmStory = {
  id: "collector_2",
  partnerName: "도시괴담 수집가",
  partnerHandle: "urban_legend_kr",
  startNode: "overlap",
  arrivalTitle: "#52와 #7",
  nodes: [
    {
      id: "overlap",
      intro: [
        "정기 대조 중에 문제가 하나 나왔습니다. 보고드립니다.",
        "당신 항목 #52가 오래된 항목 #7과 문장 구조가 거의 같습니다.",
        "#7은 12년 전 접수 건입니다. 그때 그 계정은 지금 없습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "우연 아닐까요? 사람들 말투는 다 비슷하잖아요",
          reply: "그럴 수 있습니다. 다만 문장 구조까지 같은 사례는 처음입니다.",
          next: "seven",
        },
        {
          tone: "cool",
          me: "12년 전 일이면 저랑 상관없죠.",
          reply: "동의합니다. 그래도 기록은 상관을 따지지 않습니다.",
          next: "seven",
        },
        {
          tone: "bold",
          me: "#7 자료 보여줘요. 제 항목이랑 겹친다면서요",
          reply: "…이번은 예외로 하겠습니다. 당사자 대조는 원칙에 어긋나지 않습니다.",
          next: "seven",
          effect: { skills: { knowledge: 15 } },
        },
      ],
    },
    {
      id: "seven",
      intro: [
        "#7의 마지막 기록입니다. '이 계정은 어느 날 갱신을 멈췄다.'",
        "사고도, 폐쇄도 아닙니다. 그냥 멈췄습니다. 그리고 아무도 찾지 않았습니다.",
        "제가 이 일을 시작한 게 그 항목 때문입니다. 이건 자료가 아니라 사담입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그분을 찾고 싶어서 계속하는 거군요",
          reply: "…그건 판단입니다. 저는 판단하지 않습니다. 다만 부정도 하지 않겠습니다.",
          next: "record",
          effect: { mental: 4 },
        },
        {
          tone: "cool",
          me: "사담은 접어두고 제 항목이나 정리하죠.",
          reply: "그게 맞습니다. 실례했습니다. 본론으로 돌아가겠습니다.",
          next: "record",
        },
        {
          tone: "bold",
          me: "그럼 저도 언젠가 멈춘다는 얘기잖아요",
          reply: "통계적으로는 그렇습니다. 62건 중 61건이 그랬습니다.",
          next: "record",
          effect: { mental: -6, skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "record",
      intro: [
        "제안을 드리겠습니다. 갱신이 6개월 멈추면 제가 확인 연락을 드리겠습니다.",
        "대단한 일은 아닙니다. 다만 #7 때는 아무도 그걸 하지 않았습니다.",
        "동의하시면 항목에 한 줄 추가하겠습니다. '확인 담당: 본인 동의.'",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋아요. 저도 그쪽이 멈추면 확인할게요",
          reply: "…그 조항은 예상하지 못했습니다. 양방으로 기록하겠습니다.",
          next: null,
          effect: { mental: 10, reputation: 6, skills: { knowledge: 20, sociability: 15 } },
        },
        {
          tone: "cool",
          me: "연락은 됐어요. 기록만 남기세요.",
          reply: "알겠습니다. 기록만 남기겠습니다. 그것도 충분한 대비입니다.",
          next: null,
          effect: { mental: 4, skills: { knowledge: 10 } },
        },
        {
          tone: "bold",
          me: "#7 얘기, 제가 글로 써도 돼요? 반응 좋을 것 같은데",
          reply: "…제보자 보호 원칙상 안 됩니다. 다만 막을 방법은 저에게 없습니다.",
          next: null,
          effect: { followersPct: 10, morality: -8, reputation: -5 },
        },
      ],
    },
  ],
};

/**
 * 도시괴담 수집가 3회차(마지막) — 계정을 닫으며 자료를 넘긴다.
 * 마지막까지 결론을 내지 않는다. 이 캐릭터가 남기는 건 판단이 아니라 목록이다.
 */
export const COLLECTOR_STORY_3: DmStory = {
  id: "collector_3",
  partnerName: "도시괴담 수집가",
  partnerHandle: "urban_legend_kr",
  startNode: "closing",
  arrivalTitle: "마지막 갱신",
  nodes: [
    {
      id: "closing",
      intro: [
        "공지드립니다. 이 계정은 다음 달에 갱신을 멈춥니다. 제 결정입니다.",
        "이유는 사담이라 적지 않겠습니다. 다만 사고는 아닙니다. 그것만 밝힙니다.",
        "자료는 총 1,204건입니다. 어디로 보낼지 정하는 게 마지막 일입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "괜찮은 거 맞아요? 확인 연락은 제가 해야 하는데",
          reply: "…그 조항을 기억하고 계셨군요. 괜찮습니다. 이번엔 제가 정한 멈춤입니다.",
          next: "handoff",
          effect: { mental: 4 },
        },
        {
          tone: "cool",
          me: "그럼 자료는 어디로 가나요?",
          reply: "그걸 정하려고 연락드렸습니다. 후보는 한 명뿐입니다.",
          next: "handoff",
        },
        {
          tone: "bold",
          me: "1,204건이면 값이 꽤 나가겠는데요",
          reply: "값을 매겨본 적은 없습니다. 매기면 자료가 상품이 됩니다.",
          next: "handoff",
          effect: { morality: -3 },
        },
      ],
    },
    {
      id: "handoff",
      intro: [
        "조건은 세 가지입니다. 결론을 내지 말 것. 제보자를 밝히지 말 것. 각색하지 말 것.",
        "지키실 필요는 없습니다. 넘긴 뒤에 제가 확인할 방법이 없으니까요.",
        "그래도 적어둡니다. 적어두면 지키는 사람이 가끔 있습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 가지 다 지킬게요. 저도 이어서 모을게요",
          reply: "…감사합니다. '#52가 인계받음'으로 적겠습니다. 이건 제 마지막 갱신입니다.",
          next: "last",
          effect: { skills: { knowledge: 20 }, morality: 5 },
        },
        {
          tone: "cool",
          me: "받긴 할게요. 이어서 할지는 나중에 정할게요.",
          reply: "그게 정직한 대답입니다. 정직한 자료가 오래갑니다.",
          next: "last",
        },
        {
          tone: "bold",
          me: "받아서 정리해서 책으로 낼게요. 그게 더 오래 남죠",
          reply: "…그것도 한 방법입니다. 다만 그때부터는 자료가 아니라 이야기입니다.",
          next: "last",
          effect: { money: 300_000, morality: -6, reputation: 4 },
        },
      ],
    },
    {
      id: "last",
      intro: [
        "마지막 항목을 적었습니다. #1205입니다.",
        "내용은 이렇습니다. '수집가는 어느 날 갱신을 멈췄다. 이번에는 인계자가 있었다.'",
        "무섭냐고 자주 물으셨습니다. 저는 별로였습니다. 정리하다 보면 그냥 표가 됩니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "6개월 뒤에 제가 확인 연락 갈게요. 약속대로요",
          reply: "…기다리겠습니다. 그 문장은 표에 안 넣고 그냥 두겠습니다.",
          next: null,
          effect: {
            mental: 15,
            reputation: 10,
            followers: 300,
            skills: { knowledge: 25, sociability: 15 },
          },
        },
        {
          tone: "cool",
          me: "수고하셨어요. 자료는 잘 둘게요.",
          reply: "감사합니다. 잘 두는 것이 절반입니다. 나머지 절반은 다음 사람 몫이고요.",
          next: null,
          effect: { mental: 8, skills: { knowledge: 15 } },
        },
        {
          tone: "bold",
          me: "#1205 마지막 줄은 제가 고칠게요. '아직 안 끝났다'로요",
          reply: "…고치십시오. 이제 그 표는 당신 것입니다. 판단도 당신 몫입니다.",
          next: null,
          effect: { followersPct: 12, reputation: -4, skills: { knowledge: 20, creativity: 15 } },
        },
      ],
    },
  ],
};

/**
 * 필살기 작명가(이코마) — 기술에 이름 붙이는 게 인생인 부대장(`data/accounts.ts`의 고정 계정).
 * 그의 트윗을 **리트윗**하면 DM이 온다(무색·바큐라와 같은 동사 — 계정이 다르면 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'이름 붙이기'**다. 남들은 촌스럽다고 웃지만 본인에겐 진지한 일이고,
 * 플레이어가 그걸 비웃느냐 같이 진지해지느냐가 결말을 가른다.
 * ⚠️ 말투는 간사이 사투리("~다 아이가", "~기다")를 끝까지 유지한다 — 이 캐릭터의 정체성이다.
 * ⚠️ 보상축은 팔로워가 아니라 **창작·사교**다(작명은 창작이라는 게 이 스토리의 주장).
 * 줄기: 이름 지어달라 부탁 → 남들의 비웃음 → 후배의 부탁 → 이름을 남기는 문제.
 */
export const IKOMA_STORY: DmStory = {
  id: "ikoma_1",
  partnerName: "필살기 작명가",
  partnerHandle: "finisher_naming",
  arrivalTitle: "필살기 작명가의 DM",
  startNode: "request",
  nodes: [
    {
      id: "request",
      intro: [
        "어이! 내 트윗 퍼간 사람 맞제? 고맙다 아이가.",
        "실은 부탁이 하나 있는데… 내가 새 기술을 하나 만들었거든.",
        "근데 이름이 안 떠오른다. 사흘째 못 자고 있는 기다.",
        "센스 있어 보이는데, 하나 지어줄 수 있나?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저 그런 거 잘 못하는데… 그래도 같이 고민해볼게요",
          reply: "진짜가! 고맙다! 같이 고민해준다는 사람은 니가 처음이다 아이가.",
          next: "laughed",
          effect: { skills: { sociability: 8 } },
        },
        {
          tone: "cool",
          me: "기술 이름이 그렇게 중요한가요?",
          reply: "중요하다. 이름이 없으면 그건 그냥 휘두르는 거지 기술이 아이다. …다들 이걸 모른다.",
          next: "laughed",
        },
        {
          tone: "bold",
          me: "'떨어지는 벼락 베기' 같은 거요? 솔직히 좀 촌스러워요",
          reply: "촌스럽다고?! …아니 뭐, 틀린 말은 아니다. 근데 그게 멋있는 기다!",
          next: "laughed",
          effect: { mental: -3, skills: { creativity: 5 } },
        },
      ],
    },
    {
      id: "laughed",
      intro: [
        "…오늘 훈련 때 부대원들 앞에서 새 이름을 발표했다.",
        "아무도 안 웃더라. 아니, 한 놈이 웃었는데 기술이 웃긴 게 아니라 내가 웃긴 거였다.",
        "이런 게 몇 년째다. 나만 진지한 기다.",
        "…내가 이상한 건가? 솔직하게 말해도 된다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 이상해요. 뭔가에 진지한 사람 별로 없어요",
          reply: "…그런 말은 처음 들어본다. 니 좋은 사람이네. 진짜로.",
          next: "junior",
          effect: { mental: 6, skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "이상하긴 해요. 근데 이상한 게 나쁜 건 아니잖아요",
          reply: "…맞다. 이상한 게 나쁜 건 아이다. 니 말이 맞다 아이가.",
          next: "junior",
          effect: { skills: { knowledge: 10 } },
        },
        {
          tone: "bold",
          me: "네 좀 이상해요. 근데 그러니까 사람들이 기억하죠",
          reply: "기억한다고? …하긴, 다들 내 이름은 안 잊어버리더라. 이거 칭찬 맞제?",
          next: "junior",
          effect: { skills: { creativity: 12 }, mental: -2 },
        },
      ],
    },
    {
      id: "junior",
      intro: [
        "오늘 후배가 찾아왔다. 자기 기술에 이름을 지어달라고.",
        "웃으러 온 줄 알았는데 진지하더라. 손까지 떨면서 부탁하는 기다.",
        "…근데 내가 지어주면 그 이름 때문에 걔도 웃음거리가 되는 거 아이가?",
        "니 생각은 어떻노.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "웃음거리가 되더라도 그건 그 후배가 고른 거예요. 지어주세요",
          reply: "…그렇네. 걔가 고른 기다. 내가 겁먹을 일이 아니었네. 지어주겠다.",
          next: null,
          effect: { mental: 8, reputation: 6, skills: { sociability: 20, creativity: 15 } },
        },
        {
          tone: "cool",
          me: "그 걱정을 후배한테 그대로 말해보세요",
          reply: "…솔직하게 말하라고? 그건 생각도 못 했다. 해보겠다.",
          next: null,
          effect: { skills: { knowledge: 18, sociability: 10 }, mental: 4 },
        },
        {
          tone: "bold",
          me: "같이 웃음거리 되면 되죠. 둘이면 덜 외롭잖아요",
          reply: "…둘이면 덜 외롭다라. 니 그거 좋은 말이다. 오늘 최고의 작명이다 아이가!",
          next: null,
          effect: { mental: 12, skills: { creativity: 25, sociability: 12 }, reputation: -3 },
        },
      ],
    },
  ],
};

/**
 * 필살기 작명가 2회차 — 이름이 밖으로 나간다.
 * 1회차가 '나만 진지한가'였다면, 여기서는 그 이름이 **부대 밖에서 불리기 시작한다**.
 * 놀림받던 작명이 갑자기 유명해질 때 본인이 어떻게 흔들리는지가 축이다.
 */
const IKOMA_STORY_2: DmStory = {
  id: "ikoma_2",
  partnerName: "필살기 작명가",
  partnerHandle: "finisher_naming",
  arrivalTitle: "필살기 작명가의 DM",
  startNode: "spread",
  nodes: [
    {
      id: "spread",
      intro: [
        "큰일 났다. 내가 지은 이름이 다른 부대에서 돌고 있다 아이가.",
        "누가 랭크전 중계에서 그 이름을 불렀다. 해설자가.",
        "…전국에 나갔다는 뜻이제? 이거 좋아해야 하나 무서워해야 하나.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋아하셔도 돼요. 그거 축하할 일이에요",
          reply: "축하할 일이가… 그래, 축하받겠다. 니가 제일 먼저 축하해줬다 아이가.",
          next: "offer",
          effect: { mental: 8, skills: { sociability: 10 } },
        },
        {
          tone: "cool",
          me: "무서운 건 왜예요?",
          reply: "…이름이 커지면 내 손을 떠나잖나. 그럼 그건 아직 내 기술인가 싶어서.",
          next: "offer",
          effect: { skills: { knowledge: 12 } },
        },
        {
          tone: "bold",
          me: "이제 작명료 받으세요. 공짜로 해주지 마시고",
          reply: "작명료?! 그런 건 생각도 못 했다. 근데… 그것도 나쁘지 않네?",
          next: "offer",
          effect: { money: 30000, reputation: -4 },
        },
      ],
    },
    {
      id: "offer",
      intro: [
        "본부에서 연락이 왔다. 공식 기술 명칭 정리를 맡아달란다.",
        "돈도 준다더라. 근데 조건이 있다. '너무 튀지 않게' 지어달란다.",
        "…그럼 그건 내 이름이 아이잖나.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 조건은 빼달라고 해보세요. 안 되면 안 하는 거고요",
          reply: "…말해보겠다. 니 말대로 안 되면 안 하는 기다. 그게 맞다.",
          next: "answer",
          effect: { skills: { sociability: 15 }, mental: 5 },
        },
        {
          tone: "cool",
          me: "돈은 얼마나 준대요?",
          reply: "…솔직히 꽤 준다. 그래서 더 고민되는 기다. 돈이 문제가 아인데 자꾸 계산하게 되네.",
          next: "answer",
          effect: { skills: { knowledge: 10 } },
        },
        {
          tone: "bold",
          me: "받고 튀는 이름으로 지으세요. 계약서에 '튀지 마라'가 정의돼 있나요?",
          reply: "…니 그거 진짜 나쁜 머리다. 근데 왜 설득력이 있노.",
          next: "answer",
          effect: { money: 50000, morality: -6, skills: { creativity: 15 } },
        },
      ],
    },
    {
      id: "answer",
      intro: [
        "결정했다. 근데 그 전에 니한테 먼저 말하고 싶었다.",
        "내가 이름을 짓는 이유가 뭔지 이제 알겠다.",
        "…내가 지은 이름을 누가 부르면, 그 순간 그 기술이 진짜가 되는 기다.",
        "이거 니 덕분에 알았다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 앞으로도 계속 지으세요. 제가 다 불러드릴게요",
          reply: "…니가 불러준다고? 그럼 나는 계속 지을 수 있겠네. 고맙다 진짜로.",
          next: null,
          effect: { mental: 12, reputation: 8, skills: { sociability: 25, creativity: 20 } },
        },
        {
          tone: "cool",
          me: "그 얘기를 본부에도 그대로 하세요",
          reply: "…그대로 말하라고? 잘리는 거 아이가. 뭐, 잘려도 상관없다. 해보겠다.",
          next: null,
          effect: { reputation: 10, skills: { knowledge: 22 }, mental: 6 },
        },
        {
          tone: "bold",
          me: "멋있는 말인데 좀 오글거려요",
          reply: "오글거린다고?! …맞다. 근데 오글거리는 게 내 전공이다 아이가!",
          next: null,
          effect: { mental: 6, skills: { creativity: 25 }, reputation: -4 },
        },
      ],
    },
  ],
};

/**
 * 필살기 작명가 3회차 — 마지막 이름.
 * 부대가 해체 위기에 놓이고, '이름을 남긴다'는 게 무슨 뜻인지로 끝맺는다.
 * ⚠️ 이 회차는 **delayDays**를 쓴다("내일 답 주겠다"를 진짜 다음 날 지킨다).
 */
const IKOMA_STORY_3: DmStory = {
  id: "ikoma_3",
  partnerName: "필살기 작명가",
  partnerHandle: "finisher_naming",
  arrivalTitle: "필살기 작명가의 DM",
  startNode: "disband",
  nodes: [
    {
      id: "disband",
      intro: [
        "우리 부대 해체될지도 모른다.",
        "순위가 계속 아래라서 그렇다. 내 탓이다 아이가.",
        "…부대가 없어지면 내가 지은 이름들도 같이 없어지는 건가.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이름은 안 없어져요. 부른 사람들이 기억하잖아요",
          reply: "…기억한다고. 그래, 그럼 없어지는 게 아이네. 니 말 들으니까 좀 낫다.",
          next: "last_name",
          effect: { mental: 10, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "부대장 탓 아니에요. 순위는 여러 사람 몫이에요",
          reply: "…그래도 앞에 선 놈 탓이 제일 크다. 근데 그렇게 말해주니 고맙다.",
          next: "last_name",
          effect: { skills: { knowledge: 15 }, mental: 5 },
        },
        {
          tone: "bold",
          me: "그럼 이기면 되잖아요. 아직 안 끝났어요",
          reply: "…이기면 된다라. 니 말이 제일 단순한데 제일 맞다 아이가. 해보겠다.",
          next: "last_name",
          effect: { mental: 8, skills: { fitness: 12 } },
        },
      ],
    },
    {
      id: "last_name",
      intro: [
        "마지막 랭크전이다. 이기면 남고 지면 끝이다.",
        "부대원들이 나한테 부탁했다. 이번 작전에 이름을 붙여달라고.",
        "다들 진지하더라. 아무도 안 웃었다.",
        "…근데 못 짓겠다. 이번만은 안 떠오른다. 내일 답 주겠다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "천천히 생각하세요. 기다릴게요",
          reply: "…기다려준다고. 알겠다. 천천히 생각해보겠다.",
          next: "result",
          delayDays: 1,
          effect: { skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "안 떠오르는 이유가 있을 거예요. 그게 뭔지 생각해보세요",
          reply: "…이유라. 그것부터 생각해보겠다. 니 말이 맞을지도 모르겠다.",
          next: "result",
          delayDays: 1,
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "bold",
          me: "부대원들한테 같이 짓자고 하세요",
          reply: "같이…? 작명은 내 몫인데. …아니, 그것도 방법이네. 생각해보겠다.",
          next: "result",
          delayDays: 1,
          effect: { skills: { creativity: 15 } },
        },
      ],
    },
    {
      id: "result",
      intro: [
        "이름 지었다. 어젯밤에 부대원들이랑 같이 앉아서.",
        "…결과는 말 안 하겠다. 이겼는지 졌는지는 중요한 게 아이더라.",
        "다들 그 이름을 부르면서 나갔다. 그게 전부다.",
        "니한테 제일 먼저 말하고 싶었다. 처음부터 들어준 사람이니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 이름 뭔지 알려주세요. 저도 부르고 싶어요",
          reply: "…니가 부르면 그건 진짜가 되는 기다. 알려주겠다. 우리끼리만이다.",
          next: null,
          effect: { mental: 15, reputation: 10, skills: { sociability: 30, creativity: 25 } },
        },
        {
          tone: "cool",
          me: "결과가 안 중요하다는 말, 진심이에요?",
          reply: "…반은 진심이다. 나머지 반은 아직 정리가 안 됐다. 그래도 후회는 없다 아이가.",
          next: null,
          effect: { skills: { knowledge: 28 }, mental: 8, reputation: 6 },
        },
        {
          tone: "bold",
          me: "이제 작명가 말고 부대장이 된 것 같네요",
          reply: "…그 말이 제일 무섭다. 근데 제일 듣고 싶었던 말이기도 하다. 고맙다.",
          next: null,
          effect: { mental: 12, reputation: 12, skills: { sociability: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 산에 사는 설교자(게토) — 아이들을 거두고 사는 전직 교사(`data/accounts.ts`의 고정 계정).
 * 그의 트윗을 **팔로우**하면 DM이 온다(타로·수집가와 같은 동사 — 계정이 다르면 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'질문'**이다. bio가 "질문은 받지만 답은 잘 안 합니다"인 사람이라,
 * 플레이어가 물을수록 그는 되묻고 비껴간다. **답을 얻어내려 할수록 멀어지고,
 * 답을 요구하지 않을 때 오히려 스스로 말한다** — 이게 이 캐릭터의 유일한 공략법이다.
 *
 * ⚠️ 말투는 **끝까지 정중한 존댓말**이다. 화를 내거나 언성을 높이는 대사를 쓰지 마라 —
 *    "저는 화를 내지 않습니다. 다만 기억할 뿐입니다"가 이 인물의 핵심이다.
 * ⚠️ 그는 **자기 선택을 후회한다고 말하지 않는다.** 뉘우치게 만드는 결말을 쓰지 마라.
 * ⚠️ 보상축은 지식·도덕성이다(옳음을 다루는 이야기라 창작·팔로워가 아니다).
 * 줄기: 왜 팔로우했냐 → 아이들 이야기 → 옛 친구 → 선을 넘는 문제.
 */
export const GETO_STORY: DmStory = {
  id: "geto_1",
  partnerName: "산에 사는 설교자",
  partnerHandle: "mountain_preacher",
  arrivalTitle: "산에 사는 설교자의 DM",
  startNode: "why_follow",
  nodes: [
    {
      id: "why_follow",
      intro: [
        "제 계정을 팔로우하셨더군요.",
        "제 글은 대체로 불편합니다. 그런데도 남아 계시는 분은 드뭅니다.",
        "먼저 여쭙겠습니다. 무엇을 기대하고 계십니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기대는 없어요. 그냥 글이 좋아서요",
          reply: "기대가 없다고 하셨습니까. …그 대답이 제일 오래 남습니다. 감사합니다.",
          next: "children",
          effect: { skills: { sociability: 8 } },
        },
        {
          tone: "cool",
          me: "무슨 생각으로 사시는지 궁금해서요",
          reply: "궁금하시다. 그럼 실망하실 겁니다. 저는 답을 잘 하지 않거든요.",
          next: "children",
          effect: { skills: { knowledge: 10 } },
        },
        {
          tone: "bold",
          me: "위험한 사람 같아서요. 가까이서 보고 싶었어요",
          reply: "위험하다. …정확한 표현입니다. 부정하지 않겠습니다.",
          next: "children",
          effect: { mental: -3, skills: { knowledge: 12 } },
        },
      ],
    },
    {
      id: "children",
      intro: [
        "오늘 아이 하나가 새로 왔습니다. 열두 살입니다.",
        "부모가 있는데도 갈 곳이 없다더군요. 그런 경우가 생각보다 많습니다.",
        "저는 우선 밥을 먹입니다. 그다음은 그 아이가 정합니다.",
        "…이런 이야기를 왜 하는지 저도 모르겠군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "잘하고 계신 것 같아요. 밥부터가 맞아요",
          reply: "잘한다는 말은 오랜만에 듣습니다. …고맙습니다. 진심으로요.",
          next: "old_friend",
          effect: { mental: 6, morality: 5, skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "그 아이들이 나중에 어떻게 되길 바라세요?",
          reply: "…바라는 건 없습니다. 바라기 시작하면 그건 제 몫이 되니까요. 좋은 질문입니다.",
          next: "old_friend",
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "bold",
          me: "그거 선의예요, 아니면 필요해서예요?",
          reply: "…둘 다입니다. 그걸 구분하려고 애쓰는 사람은 대체로 오래 못 갑니다.",
          next: "old_friend",
          effect: { skills: { knowledge: 18 }, mental: -4 },
        },
      ],
    },
    {
      id: "old_friend",
      intro: [
        "옛 친구가 하나 있습니다. 지금은 교단에 서 있다더군요.",
        "그 친구는 웃으면서 사람을 밀어냅니다. 저는 그걸 못 배웠습니다.",
        "예전엔 같은 걸 보고 같은 걸 옳다고 했습니다. 지금은 아니죠.",
        "…이 이야기는 여기까지 하겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "알겠어요. 더 안 물을게요",
          reply: "…물으실 줄 알았는데. 안 물으시는군요. 그게 더 어렵습니다, 저한테는.",
          next: null,
          effect: { mental: 8, morality: 6, skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "그 친구는 지금 뭐라고 할까요, 당신에 대해",
          reply: "…아마 아무 말도 안 할 겁니다. 그게 그 친구의 방식이니까요. 그만하죠.",
          next: null,
          effect: { skills: { knowledge: 22 }, mental: -3 },
        },
        {
          tone: "bold",
          me: "왜 갈라섰는지 말 안 하실 거죠",
          reply: "네. 말하지 않을 겁니다. 그래도 물어봐 주신 건 기억하겠습니다.",
          next: null,
          effect: { skills: { knowledge: 20 }, mental: -6, morality: -3 },
        },
      ],
    },
  ],
};

/**
 * 산에 사는 설교자 2회차 — 선.
 * 1회차가 '묻지 않기'였다면, 여기서는 그가 **먼저 자기 이야기를 꺼낸다**.
 * 축은 "누군가를 지키려면 선을 하나 넘게 되더군요"라는 그의 문장이다.
 */
const GETO_STORY_2: DmStory = {
  id: "geto_2",
  partnerName: "산에 사는 설교자",
  partnerHandle: "mountain_preacher",
  arrivalTitle: "산에 사는 설교자의 DM",
  startNode: "the_line",
  nodes: [
    {
      id: "the_line",
      intro: [
        "지난번에 아무것도 묻지 않으셨죠. 그 뒤로 계속 생각했습니다.",
        "제가 왜 이러고 사는지 한 번쯤 말해두고 싶어졌습니다.",
        "…처음엔 지키려고 시작한 일이었습니다. 그러다 선을 하나 넘었고요.",
        "넘고 나니 그 뒤로는 쉬웠습니다. 그게 제일 무서운 부분입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 선을 다시 넘어서 돌아올 수는 없나요",
          reply: "…돌아갈 수 있었던 지점이 몇 번 있었습니다. 매번 돌아가지 않았고요.",
          next: "the_child",
          effect: { morality: 6, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "쉬워졌다는 게 무섭다는 건 아직 감각이 남아 있다는 뜻이에요",
          reply: "…그렇게 봐주시는군요. 저는 그 감각이 사라지길 바랐는데 말입니다.",
          next: "the_child",
          effect: { skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "무섭다면서 왜 계속하세요",
          reply: "…아이들이 있으니까요. 그 이상의 답은 저도 못 찾았습니다.",
          next: "the_child",
          effect: { skills: { knowledge: 18 }, mental: -5 },
        },
      ],
    },
    {
      id: "the_child",
      intro: [
        "그 열두 살 아이가 오늘 저한테 물었습니다.",
        "\"아저씨는 나쁜 사람이에요?\"",
        "…아이들은 늘 제일 정확한 걸 묻습니다.",
        "뭐라고 답해야 했을까요. 이번엔 정말로 묻는 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "모르겠다고 하세요. 그게 제일 정직해요",
          reply: "…모르겠다. 그렇게 말했습니다, 실은. 아이가 고개를 끄덕이더군요.",
          next: "answer_day",
          delayDays: 1,
          effect: { morality: 8, mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그 질문에 답할 사람은 당신이 아니라 그 아이예요",
          reply: "…제가 정할 일이 아니라는 말씀이군요. 하루만 생각해보겠습니다.",
          next: "answer_day",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "나쁜 사람 맞다고 하세요. 거짓말은 하지 마시고요",
          reply: "…그렇게 말하면 그 아이가 저를 떠날 겁니다. 그게 옳을지도 모르겠군요.",
          next: "answer_day",
          delayDays: 1,
          effect: { morality: -5, skills: { knowledge: 22 }, mental: -6 },
        },
      ],
    },
    {
      id: "answer_day",
      intro: [
        "어제 그 아이에게 답을 했습니다.",
        "무슨 말을 했는지는 적지 않겠습니다. 그건 그 아이 것이니까요.",
        "다만 오늘 아침에도 그 아이가 밥상에 앉아 있었습니다.",
        "…그거면 된 것 같습니다. 오랜만에 잘 잤습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다행이에요. 잘 주무셨다니 더 다행이고요",
          reply: "…이런 말을 해주는 사람이 있다는 게 이상합니다. 나쁘지 않은 이상함이군요.",
          next: null,
          effect: { mental: 12, morality: 8, skills: { sociability: 28 } },
        },
        {
          tone: "cool",
          me: "그 아이가 남은 건 당신 답 때문이 아니라 밥 때문일 수도 있어요",
          reply: "…맞습니다. 그래서 저는 밥부터 먹이는 겁니다. 잘 보셨군요.",
          next: null,
          effect: { skills: { knowledge: 30 }, morality: 5 },
        },
        {
          tone: "bold",
          me: "잘 잤다는 게 제일 무서운 말인 거 아세요?",
          reply: "…압니다. 그래서 적어둔 겁니다. 잊지 않으려고요.",
          next: null,
          effect: { skills: { knowledge: 28 }, mental: -8, morality: -4 },
        },
      ],
    },
  ],
};

/**
 * 산에 사는 설교자 3회차 — 마지막 질문.
 * 그가 처음으로 **플레이어에게 무언가를 부탁한다**. 답을 안 하던 사람이 청하는 쪽이 되는 회차다.
 * ⚠️ 여기서도 그를 회개시키지 마라. 끝까지 자기 선택을 부정하지 않는 채로 끝난다.
 */
const GETO_STORY_3: DmStory = {
  id: "geto_3",
  partnerName: "산에 사는 설교자",
  partnerHandle: "mountain_preacher",
  arrivalTitle: "산에 사는 설교자의 DM",
  startNode: "a_favor",
  nodes: [
    {
      id: "a_favor",
      intro: [
        "부탁이 하나 있습니다. 이런 건 처음이군요.",
        "산을 정리하게 될지도 모릅니다. 아이들이 갈 데를 찾아야 합니다.",
        "…제 이름으로는 아무 데도 연결이 안 됩니다. 당연한 일이죠.",
        "당신 계정에 글을 하나 올려주실 수 있겠습니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "올릴게요. 뭐라고 쓰면 될까요",
          reply: "…바로 그렇게 답하실 줄은 몰랐습니다. 문장은 제가 보내드리겠습니다.",
          next: "posted",
          effect: { morality: 10, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "제 계정으로 나가면 제 책임이 돼요. 그건 아세요?",
          reply: "…압니다. 그래서 부탁이라고 했습니다. 거절하셔도 원망하지 않습니다.",
          next: "posted",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "왜 하필 저예요? 이용하시는 거잖아요",
          reply: "…이용하는 것 맞습니다. 부정하지 않겠습니다. 다만 다른 방법이 없더군요.",
          next: "posted",
          effect: { skills: { knowledge: 22 }, mental: -5, morality: -3 },
        },
      ],
    },
    {
      id: "posted",
      intro: [
        "문장을 보냅니다. 고쳐 쓰셔도 됩니다.",
        "\"갈 곳 없는 아이들을 잠시 맡아주실 분을 찾습니다. 사연은 묻지 않으셔도 됩니다.\"",
        "…이 문장에 제 이름은 없습니다. 그게 이 부탁의 조건입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그대로 올릴게요",
          reply: "감사합니다. …이 말을 이렇게 여러 번 하게 될 줄은 몰랐습니다.",
          next: "ending",
          delayDays: 1,
          postTweet:
            "갈 곳 없는 아이들을 잠시 맡아주실 분을 찾습니다. 사연은 묻지 않으셔도 됩니다.",
          effect: { morality: 12, reputation: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "당신 이름을 넣는 게 더 솔직하지 않을까요",
          reply: "…제 이름이 붙으면 아무도 안 옵니다. 그건 제가 제일 잘 압니다.",
          next: "ending",
          delayDays: 1,
          postTweet:
            "갈 곳 없는 아이들을 잠시 맡아주실 분을 찾습니다. 사연은 묻지 않으셔도 됩니다.",
          effect: { morality: 8, skills: { knowledge: 28 }, reputation: 5 },
        },
        {
          tone: "bold",
          me: "제 말로 다시 쓸게요. 당신 문장은 너무 차가워요",
          reply: "…차갑다고 하셨습니까. 그럼 당신 말로 써주십시오. 그편이 낫겠군요.",
          next: "ending",
          delayDays: 1,
          postTweet:
            "혹시 잠깐이라도 아이 한 명 맡아주실 수 있는 분 계실까요. 사정은 안 물어보셔도 돼요. 밥만 같이 먹여주시면 됩니다.",
          effect: { morality: 10, reputation: 12, skills: { sociability: 30, creativity: 15 } },
        },
      ],
    },
    {
      id: "ending",
      intro: [
        "연락이 왔습니다. 생각보다 여러 곳에서요.",
        "아이 셋이 어제 산을 내려갔습니다. 울지 않더군요. 저도 울지 않았습니다.",
        "…저는 여전히 제가 한 일을 후회하지 않습니다. 그건 변하지 않습니다.",
        "다만 당신에게는 빚이 하나 생겼군요. 이건 갚지 못할 것 같습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "빚 아니에요. 그냥 잘된 일이에요",
          reply: "…그렇게 정리해주시는군요. 그럼 그렇게 두겠습니다. 고맙습니다.",
          next: null,
          effect: { mental: 15, morality: 15, reputation: 10, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "후회 안 한다는 말, 계속 하셔도 돼요. 저는 안 따질게요",
          reply: "…따지지 않겠다고요. 그 말이 제일 무겁습니다. 오래 기억하겠습니다.",
          next: null,
          effect: { skills: { knowledge: 35 }, morality: 8, mental: 8 },
        },
        {
          tone: "bold",
          me: "언젠가 그 옛 친구랑 마주 앉으세요. 그게 마지막 숙제예요",
          reply: "…그 이야기를 다시 꺼내시는군요. 언젠가는요. 언젠가는 말입니다.",
          next: null,
          effect: { skills: { knowledge: 30 }, mental: -5, morality: 10, reputation: 8 },
        },
      ],
    },
  ],
};

/**
 * 뱀눈 탈환사 — 탈환률 100%에 늘 굶는 해결사(`data/accounts.ts`의 고정 계정 snake_eye_get).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 광고를 퍼뜨려 준 덕에 의뢰가 들어왔다는 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'선불'**이다. 그는 돈을 밝히는 척하지만, 실제로 먼저 받는 이유는
 * "먼저 낸 사람은 도중에 마음을 안 바꾸기 때문"이고, 정작 결정적인 순간엔 착수금을 돌려준다.
 * 말과 행동이 반대인 인물 — 대사는 계산적으로, 행동은 손해 보게 쓴다.
 *
 * ⚠️ 말투는 **끝까지 반말**이다("~다/~냐/~라"). 존댓말을 쓰면 파트너(thunder_beast)와 섞인다.
 * ⚠️ 실제 작품명·본명·파트너 이름을 쓰지 마라. 파트너는 **"그 덩치"·"전기 다루는 놈"**으로만 부른다.
 * ⚠️ 능력은 "내 눈"과 "1분"까지만 말한다. 원리를 설명시키지 마라 — 그는 모른다고 답하는 인물이다.
 * ⚠️ 그는 자기 가난을 **변명하지 않는다.** 신세 한탄이나 후회하는 대사를 쓰지 마라.
 * 줄기: 1회차 착수금(선불의 진짜 이유) → 2회차 눈(1분) → 3회차 콤비와 "너는 뭘 잃어버렸냐".
 */
export const BAN_STORY: DmStory = {
  id: "ban_1",
  partnerName: "뱀눈 탈환사",
  partnerHandle: "snake_eye_get",
  arrivalTitle: "뱀눈 탈환사의 DM",
  startNode: "client_came",
  nodes: [
    {
      id: "client_came",
      intro: [
        "너지. 내 트윗 퍼뜨린 거.",
        "그거 보고 의뢰가 하나 들어왔다. 선불로 받았다.",
        "나는 공짜로 받는 게 없다. 얻어먹는 밥은 빼고.",
        "그래서 묻는다. 뭘 받고 싶냐. 미리 말해라, 후불은 안 받는 주의라.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그냥 재밌어서 눌렀어요. 잘 되셨다니 다행이네요",
          reply: "재밌어서라. …그런 대답이 제일 곤란하다. 갚을 방법이 없잖냐.",
          next: "advance_fee",
          effect: { skills: { sociability: 10 } },
        },
        {
          tone: "cool",
          me: "착수금 얼마나 받으셨는데요",
          reply: "그건 영업 비밀이다. …삼십만이다. 웃지 마라. 이 바닥 시세가 그렇다.",
          next: "advance_fee",
          effect: { skills: { knowledge: 10 } },
        },
        {
          tone: "bold",
          me: "그럼 반 나눠요. 광고비잖아요 그거",
          reply: "…배짱 좋네. 마음에 든다. 반은 안 되고 삼분의 일까지. 그 이상은 내가 굶는다.",
          next: "advance_fee",
          effect: { money: 100_000, skills: { knowledge: 8, sociability: 6 } },
        },
      ],
    },
    {
      id: "advance_fee",
      intro: [
        "선불 얘기 나온 김에 하나 알려주마.",
        "돈을 먼저 받는 건 내가 돈을 좋아해서가 아니다. 좋아하긴 하는데, 그것 때문은 아니다.",
        "먼저 낸 사람은 도중에 마음을 안 바꾼다. 그게 중요하다.",
        "일 시작하고 나서 '역시 됐어요' 소리를 들으면, 그때부터 그건 내 빚이 되거든.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "빚이라니요, 안 하면 그만 아니에요?",
          reply: "안 되지. 뭘 잃어버렸는지 이미 들었잖냐. 들은 이상 나는 그걸 안다.",
          next: "what_it_is",
          effect: { mental: 4, skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "그래서 못 되찾을 일은 아예 안 받는 거군요",
          reply: "…눈치 빠르네. 탈환률 100%의 비결이 그거다. 아무한테나 말 안 한다.",
          next: "what_it_is",
          effect: { skills: { knowledge: 18 } },
        },
        {
          tone: "bold",
          me: "그거 그냥 겁쟁이 아니에요?",
          reply: "…하. 겁쟁이가 이 일을 십 년 하겠냐. 뭐, 절반은 맞다.",
          next: "what_it_is",
          effect: { mental: -3, skills: { knowledge: 12, comedy: 8 } },
        },
      ],
    },
    {
      id: "what_it_is",
      intro: [
        "이번 의뢰는 반지였다. 값나가는 것도 아니고 도금 다 벗겨진 싸구려.",
        "그걸 되찾겠다고 삼십만을 냈다. 계산이 안 맞지.",
        "근데 그 계산이 안 맞는 게 이 일의 전부다.",
        "…말이 길었다. 밥이나 한 끼 사마. 아니, 네가 사라. 나는 돈이 없다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제가 살게요. 대신 그 반지 얘기 마저 들려줘요",
          reply: "…거래 성립이다. 밥값 이상은 떠들어 주마.",
          next: null,
          effect: { mental: 8, morality: 5, skills: { sociability: 25, knowledge: 12 } },
        },
        {
          tone: "cool",
          me: "계산이 안 맞는 게 아니라, 되찾는 쪽엔 값이 다른 거죠",
          reply: "그래. 잃어버린 놈한테만 비싼 물건이 있다. 나는 그 값에 맞춰 받는다.",
          next: null,
          effect: { skills: { knowledge: 25, vocabulary: 12 } },
        },
        {
          tone: "bold",
          me: "그 얘기 제 계정에 한 줄 올려도 돼요? 의뢰 더 들어올 텐데",
          reply: "…써라. 대신 내 이름은 빼고. 다음 착수금에서 네 몫은 챙겨 주마.",
          next: null,
          postTweet:
            "싸구려 반지 하나 되찾겠다고 삼십만을 내는 사람이 있다더라. 계산이 안 맞는 그게 값이라고, 어떤 탈환사가 그랬다.",
          effect: { money: 100_000, followers: 250, skills: { vocabulary: 15, knowledge: 10 } },
        },
      ],
    },
  ],
};

/**
 * 뱀눈 탈환사 2회차 — 눈.
 * 1회차가 '돈'이었다면 여기서는 그가 **먼저 능력 얘기를 꺼낸다**(다들 그것부터 묻는데 넌 안 물었다).
 * 축은 "남의 제일 밑바닥을 보고 나면 그놈이 밉지가 않아진다" — 강한 능력이 그를 약하게 만드는 구조다.
 */
const BAN_STORY_2: DmStory = {
  id: "ban_2",
  partnerName: "뱀눈 탈환사",
  partnerHandle: "snake_eye_get",
  arrivalTitle: "뱀눈 탈환사의 DM",
  startNode: "the_eye",
  nodes: [
    {
      id: "the_eye",
      intro: [
        "밥값은 잘 먹었다. 다음은 내가 산다. 언제가 될지는 모르지만.",
        "지난번에 네가 안 물어본 게 있더라. 다들 그것부터 묻거든.",
        "내 눈 말이다. 무섭다고들 하는 그거.",
        "궁금하면 물어라. 대답은 내 마음이지만.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 궁금하다면 거짓말이죠. 근데 말하기 싫으면 안 해도 돼요",
          reply: "…그렇게 나오면 말하고 싶어지잖냐. 치사한 방식이다.",
          next: "one_minute",
          effect: { mental: 4, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "무슨 원리예요, 그거",
          reply: "원리는 나도 모른다. 태어나 보니 있었다. 설명서가 딸려 오냐.",
          next: "one_minute",
          effect: { skills: { knowledge: 12 } },
        },
        {
          tone: "bold",
          me: "저한테 한번 써 봐요",
          reply: "…미쳤냐. 그런 부탁은 십 년 만에 처음이다.",
          next: "one_minute",
          effect: { mental: -5, skills: { knowledge: 10, comedy: 10 } },
        },
      ],
    },
    {
      id: "one_minute",
      intro: [
        "1분이다. 딱 그만큼 남의 머릿속에 그림을 그릴 수 있다.",
        "그 1분 동안 상대는 자기가 제일 무서워하는 걸 본다. 내가 고르는 게 아니다. 그쪽이 알아서 꺼낸다.",
        "문제는 나도 그걸 같이 본다는 거다.",
        "남의 제일 밑바닥을 보고 나면 그놈이 밉지가 않아진다. 일하기 아주 나쁘다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그래서 웬만하면 안 쓰시는군요",
          reply: "…그래. 주먹이 싸다. 훨씬 싸.",
          next: "gave_it_back",
          effect: { morality: 5, skills: { sociability: 18, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "무서워하는 걸 안다는 건 약점을 안다는 건데요",
          reply: "알지. 알아서 안 쓴다. 그거 팔면 이 짓 안 하고 먹고산다.",
          next: "gave_it_back",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "저는 뭐가 보일까요",
          reply: "…묻지 마라. 나는 네 밑바닥까지 알고 싶지 않다. 이건 예의 문제다.",
          next: "gave_it_back",
          effect: { mental: -6, skills: { knowledge: 15, vocabulary: 10 } },
        },
      ],
    },
    {
      id: "gave_it_back",
      intro: [
        "딱 한 번, 의뢰인한테 쓴 적이 있다. 거짓말을 하길래.",
        "그 사람이 본 건 자기 딸이었다. 아주 어릴 때 얼굴로.",
        "거짓말한 이유도 거기 있더라. 나는 그날 착수금을 돌려줬다.",
        "…이 얘기 왜 하는지 모르겠다. 술도 안 마셨는데.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그날 잘하신 거예요",
          reply: "잘하긴. 그달 월세가 밀렸다. …근데 그 말 들으니 좀 낫네.",
          next: null,
          effect: { mental: 10, morality: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그래서 그 의뢰는 어떻게 됐어요",
          reply: "끝까지 했다. 공짜로. 이건 그 덩치도 모른다.",
          next: null,
          effect: { morality: 6, skills: { knowledge: 28 } },
        },
        {
          tone: "bold",
          me: "약점 알고도 안 쓴 거, 손해 보는 성격이네요",
          reply: "손해 맞다. 그래서 지금도 가난하다. 그게 다다.",
          next: null,
          effect: { mental: -4, reputation: 8, skills: { knowledge: 20, vocabulary: 15 } },
        },
      ],
    },
  ],
};

/**
 * 뱀눈 탈환사 3회차 — 콤비, 그리고 "너는 뭘 잃어버렸냐".
 * 마지막 노드는 **하루 뒤에 도착한다**("끝나면 연락하마" — 들어오는 간선 전부 delayDays:1이어야 한다).
 * 여기서 그는 처음으로 플레이어를 의뢰인 자리에 앉힌다. 착수금은 이미 밥 한 끼로 받았다는 게 결말이다.
 */
const BAN_STORY_3: DmStory = {
  id: "ban_3",
  partnerName: "뱀눈 탈환사",
  partnerHandle: "snake_eye_get",
  arrivalTitle: "뱀눈 탈환사의 DM",
  startNode: "the_big_guy",
  nodes: [
    {
      id: "the_big_guy",
      intro: [
        "그 덩치랑 또 싸웠다. 밥값 때문이다. 늘 그렇다.",
        "일은 반씩 하는데 밥은 그놈이 두 배를 먹는다. 이게 공평하냐.",
        "…그렇다고 갈라설 건 아니다. 그놈 없으면 일이 안 된다.",
        "이런 얘기 할 데가 없어서 너한테 한다. 영광인 줄 알아라.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "영광이네요. 그래서 화해는 하셨어요?",
          reply: "화해할 게 뭐 있냐. 자고 일어나니 그놈이 라면을 두 개 끓여 놨더라. 그게 화해다.",
          next: "partner_rule",
          effect: { mental: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "둘이 몇 년째예요?",
          reply: "세어 본 적 없다. 세기 시작하면 정산해야 하잖냐. 그건 무섭다.",
          next: "partner_rule",
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "bold",
          me: "그 덩치 없으면 안 된다는 말, 본인 입으로는 못 하죠",
          reply: "…못 하지. 하면 그놈이 운다. 덩치가 우는 건 보기 안 좋다.",
          next: "partner_rule",
          effect: { skills: { comedy: 15, knowledge: 10 } },
        },
      ],
    },
    {
      id: "partner_rule",
      intro: [
        "콤비 규칙은 하나다. 먼저 도망치지 않기.",
        "둘 다 도망치면 그건 작전이고, 하나만 도망치면 그건 배신이다.",
        "십 년쯤 하다 보면 그 줄이 어디쯤인지 몸이 안다.",
        "…내일 큰 건이 하나 있다. 끝나면 연락하마.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "조심하세요. 끝나고 꼭 연락 주고요",
          reply: "걱정 마라. 나는 안 죽는다. 죽으면 외상값을 못 갚잖냐.",
          next: "your_turn",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 18 } },
        },
        {
          tone: "cool",
          me: "그 큰 건, 선불은 받았어요?",
          reply: "당연하지. …절반만. 나머지는 끝나고 받기로 했다. 이번만이다.",
          next: "your_turn",
          delayDays: 1,
          effect: { skills: { knowledge: 18 } },
        },
        {
          tone: "bold",
          me: "도망칠 것 같으면 도망쳐요. 규칙보다 목숨이죠",
          reply: "…그 말 내 콤비 앞에서 하면 맞는다. 나한테만 해라.",
          next: "your_turn",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 12, comedy: 12 } },
        },
      ],
    },
    {
      id: "your_turn",
      intro: [
        "끝났다. 이틀 걸렸다. 손가락 하나 부러진 것 말고는 멀쩡하다.",
        "잔금 받았으니 이번엔 내가 산다. 말했잖냐, 언젠가 산다고.",
        "그리고 하나 묻자. 너는 뭘 잃어버렸냐.",
        "…이 일 오래 하면 보인다. 아무것도 안 잃은 놈은 남의 물건 되찾는 얘기를 이렇게 오래 듣지 않는다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "처음에 그냥 재밌어서 쓰던 때요. 그게 없어졌어요",
          reply: "…그건 내 전문이다. 착수금은 안 받는다. 이미 밥 한 끼 받았으니까.",
          next: null,
          effect: {
            mental: 12,
            morality: 8,
            followersPct: 12,
            skills: { sociability: 30, creativity: 25 },
          },
        },
        {
          tone: "cool",
          me: "잃어버린 건 없어요. 아직 못 가진 게 많을 뿐이죠",
          reply: "…좋은 대답이다. 그런 놈은 내 손님이 안 된다. 다행이지.",
          next: null,
          effect: { money: 200_000, reputation: 10, skills: { knowledge: 30, vocabulary: 20 } },
        },
        {
          tone: "bold",
          me: "당신은 뭘 잃어버렸는데요",
          reply: "…나? 나는 아직 안 잃었다. 그래서 이 일을 한다. 잃기 전에 되찾는 연습이다.",
          next: null,
          effect: {
            money: 100_000,
            followers: 300,
            mental: -5,
            skills: { knowledge: 25, vocabulary: 18 },
          },
        },
      ],
    },
  ],
};

/**
 * 장마감 리딩방 [무료] — 전용 트윗만 쓰는 고정 NPC(`data/specialAccounts.ts`의 lead_master).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(칸라·셋톤과 같은 동사 — 계정이 다르면 겹쳐도 된다).
 * ⚠️ 팔로우를 트리거로 쓰지 마라 — 이 계정은 계정 탐색에서 한 번 팔로우하면 끝이라
 *    2·3회차를 열 행동이 남지 않는다. 좋아요는 전용 트윗 16줄에 몇 번이고 누를 수 있다.
 *
 * 이 스토리의 축은 **"나는 종목을 모른다. 나는 사람을 안다"**이다. 그는 차트를 파는 게 아니라
 * 조급함을 판다. 그래서 **거짓말을 하지 않는다** — 오히려 자기 수법을 먼저 털어놓는데, 그게 또
 * 영업이다. 플레이어가 얻는 건 돈이 아니라 지식(사람이 어떻게 속는가)이다.
 *
 * ⚠️ 말투는 **끝까지 "회원님"을 붙이는 강사체**다(단정형 "~입니다/~하십시오"). 반말을 쓰면
 *    뱀눈 탈환사와 섞이고, 굽신거리면 리딩방 방장이 아니게 된다.
 * ⚠️ 그를 **회개시키지 마라.** 마지막까지 자기 일을 변명도 후회도 하지 않는다.
 * ⚠️ 실존 종목명·종목 코드·실제 연도의 실제 사건을 쓰지 마라. 종목은 **끝까지 이름 없이** 나온다.
 * 줄기: 1회차 무료 픽(수법 자백) → 2회차 전세금 넣겠다는 회원 → 3회차 방을 닫으며 준 마지막 하나.
 */
export const LEAD_STORY: DmStory = {
  id: "lead_1",
  partnerName: "장마감 리딩방 [무료]",
  partnerHandle: "lead_master",
  arrivalTitle: "리딩방 방장의 DM",
  startNode: "free_pick",
  nodes: [
    {
      id: "free_pick",
      intro: [
        "제 글에 좋아요 누르셨더군요. 요즘 그거 누르는 사람 몇 없습니다.",
        "다들 훔쳐보고만 갑니다. 반응을 남긴다는 건 아쉬운 게 있다는 뜻이죠.",
        "회원님, 무료로 하나 찍어드리겠습니다. 사라는 게 아닙니다. 그냥 보세요.",
        "내일 장 마감하고 다시 오겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "감사해요. 사지는 않고 구경만 할게요",
          reply: "구경만. 다들 그렇게 시작하십니다. 나쁜 뜻 아닙니다.",
          next: "after_close",
          delayDays: 1,
          effect: { skills: { knowledge: 8 } },
        },
        {
          tone: "cool",
          me: "공짜로 주는 이유가 뭔데요",
          reply: "공짜여야 믿으니까요. 돈부터 받으면 아무도 안 봅니다.",
          next: "after_close",
          delayDays: 1,
          effect: { skills: { knowledge: 12 } },
        },
        {
          tone: "bold",
          me: "찍어주세요. 대신 틀리면 캡처해서 올릴 거예요",
          reply: "…올리십시오. 그 캡처, 결국 제 홍보가 됩니다.",
          next: "after_close",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 10 } },
        },
      ],
    },
    {
      id: "after_close",
      intro: [
        "장 마감했습니다. 어제 그거, 3.4% 올랐습니다.",
        "많이 오른 것도 아니죠. 딱 '어라' 싶을 만큼만 올랐습니다. 원래 그게 제일 무섭습니다.",
        "유료방은 한 달 30만원입니다. 종목은 주 3회 나갑니다.",
        "지금 계산하고 계시죠. 그 계산이 이미 답입니다, 회원님.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "…30만원 보낼게요",
          reply:
            "잘 생각하셨습니다. 오늘부터 회원님은 정보를 가진 쪽입니다. 무료방에 회원님 계정도 하나 걸어드리죠.",
          next: "he_knows",
          effect: { money: -300_000, followers: 200, mental: -4 },
        },
        {
          tone: "cool",
          me: "안 보낼래요. 그냥 지켜볼게요",
          reply: "지켜보십시오. 다음 주쯤 다시 오실 겁니다. 다들 그러시니까.",
          next: "he_knows",
          effect: { mental: 3, skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "두 개 찍어놓고 오른 것만 보여주신 거죠?",
          reply: "…허. 오랜만에 재밌는 말을 듣습니다. 그 얘긴 잠시 후에 하죠.",
          next: "he_knows",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "he_knows",
      intro: [
        "회원님. 제가 종목을 안다고 한 적 있습니까.",
        "차트는 저도 모릅니다. 저는 사람만 압니다.",
        "물린 사람은 손절을 못 하고, 조급한 사람은 못 기다립니다. 저는 그 둘한테 파는 겁니다.",
        "…이 얘길 왜 하냐고요. 어차피 안 믿으실 테니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그렇게까지 말하는 사람은 처음이에요",
          reply: "솔직한 게 제일 잘 팔립니다. 이것도 영업이에요, 회원님.",
          next: null,
          effect: { mental: 5, skills: { knowledge: 30, sociability: 12 } },
        },
        {
          tone: "cool",
          me: "그럼 당신도 한 번은 그 둘 중 하나였겠네요",
          reply: "…그 얘긴 다음에 하죠. 오늘은 여기까지입니다.",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "이거 녹음해두면 당신 끝나는 거 알죠",
          reply: "압니다. 녹음해서 올린 사람 벌써 몇 있습니다. 저는 아직 여기 있고요.",
          next: null,
          effect: { mental: -5, morality: -3, skills: { knowledge: 30 } },
        },
      ],
    },
  ],
};

/**
 * 리딩방 2회차 — 전세금.
 * 1회차가 '수법 자백'이었다면, 여기서는 그가 **처음으로 자기 방을 못 굴린다**.
 * 축은 "말리면 방이 안 굴러갑니다"와 "그런데 이번엔 손이 안 나갑니다" 사이의 간격이다.
 * ⚠️ 그가 착해지는 회차가 아니다. 한 명을 말리고도 방은 그대로 굴린다.
 */
const LEAD_STORY_2: DmStory = {
  id: "lead_2",
  partnerName: "장마감 리딩방 [무료]",
  partnerHandle: "lead_master",
  arrivalTitle: "리딩방 방장의 DM",
  startNode: "the_member",
  nodes: [
    {
      id: "the_member",
      intro: [
        "회원님. 상담 하나만 받아주시겠습니까. 이런 건 처음입니다.",
        "유료방에 아주머니 한 분이 계십니다. 이번 주에 전세금을 넣겠다더군요.",
        "저는 말린 적이 없습니다. 말리면 방이 안 굴러가니까요.",
        "…그런데 이번엔 손이 안 나갑니다. 회원님이면 어떻게 하시겠습니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말리세요. 그건 한 번은 말려야 해요",
          reply: "…말리라. 알겠습니다. 오늘 밤에 전화해 보죠.",
          next: "the_call",
          delayDays: 1,
          effect: { morality: 8, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "말려도 그분은 넣어요. 당신이 아니어도 어디든 넣을 거예요",
          reply: "…그렇게 정리해주시니 편하군요. 편해서 더 기분이 나쁩니다.",
          next: "the_call",
          delayDays: 1,
          effect: { morality: -4, skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "말릴 거면 방부터 닫으세요. 반만 착한 게 제일 나빠요",
          reply: "…반만 착한 거. 오래 남을 말을 하시는군요. 생각해 보겠습니다.",
          next: "the_call",
          delayDays: 1,
          effect: { mental: -5, morality: 5, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_call",
      intro: [
        "전화했습니다. 넣지 마시라고 했습니다.",
        "그 아주머니가 뭐랬는지 아십니까. '강사님도 이제 저를 버리시네요.'",
        "…욕을 먹을 줄 알았지, 그 말을 들을 줄은 몰랐습니다.",
        "오늘 아침에 방을 나가셨습니다. 다른 방으로 가셨더군요. 저보다 비싼 데로요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그래도 잘하신 거예요. 그건 확실해요",
          reply: "잘한 겁니까. …그럼 왜 하나도 안 시원할까요.",
          next: "why_i_do_this",
          effect: { mental: 6, morality: 8, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "당신이 안 팔면 더 비싼 사람이 팔아요. 그게 이 바닥이잖아요",
          reply: "압니다. 알아서 15년을 했습니다, 회원님.",
          next: "why_i_do_this",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그 명단 저한테 넘기세요. 제가 글로 까발릴게요",
          reply: "…명단이라. 그건 제 마지막 재산입니다. 아직은 아닙니다.",
          next: "why_i_do_this",
          effect: { mental: -4, morality: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "why_i_do_this",
      intro: [
        "언젠가 물으실 것 같아서 먼저 말씀드립니다. 저도 한 번 다 날린 적 있습니다.",
        "그때 저한테 종목 찍어준 사람이, 지금 제 스승입니다.",
        "웃기죠. 저를 털어먹은 사람한테 배웠습니다. 배우고 나니 알겠더군요. 그쪽이 훨씬 안전합니다.",
        "돈은 잃는 쪽에서만 나옵니다. 그래서 저는 잃는 쪽을 그만뒀습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 스승은 지금 뭐 하세요?",
          reply: "…교도소에 있습니다. 3년 받았습니다. 저는 그 사람 실수까지 배웠고요.",
          next: null,
          effect: { mental: 4, skills: { knowledge: 35, sociability: 15 } },
        },
        {
          tone: "cool",
          me: "그럼 당신은 안 잡힐 자신이 있는 거네요",
          reply: "자신이 아니라 계산입니다. 자신은 잃는 쪽이 하는 겁니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 아주머니도 언젠가 방장이 되겠네요",
          reply: "…그럴 겁니다. 그게 이 바닥이 안 망하는 이유죠.",
          next: null,
          effect: { mental: -6, morality: -5, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 리딩방 3회차 — 방을 닫습니다.
 * 그가 처음으로 **값을 안 받고** 무언가를 준다. 말과 행동이 반대인 인물의 마지막 증거다.
 * ⚠️ 여기서도 뉘우치게 하지 마라. 명단을 지우는 것도 선의가 아니라 계산으로 말한다.
 * ⚠️ 마지막 픽은 **끝까지 이름이 없다**(종목명·코드 금지). 'friendly'는 정리해서 손실을 피한 결과라
 *    money가 +로 들어온다 — 새로 번 돈이 아니라 안 잃은 돈이다.
 */
const LEAD_STORY_3: DmStory = {
  id: "lead_3",
  partnerName: "장마감 리딩방 [무료]",
  partnerHandle: "lead_master",
  arrivalTitle: "리딩방 방장의 DM",
  startNode: "shutting_down",
  nodes: [
    {
      id: "shutting_down",
      intro: [
        "회원님. 방 닫습니다. 오늘 밤 열두 시에요.",
        "고소가 들어왔습니다. 세 건입니다. 예상보다 두 건 많군요.",
        "회원 명단은 오늘 다 지웁니다. 회원님 것도 포함해서요. 그건 지켜드립니다.",
        "…마지막으로 하나만 드리고 싶은데, 받으시겠습니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "…뭔데요",
          reply: "종목입니다. 이번엔 값을 안 받습니다. 딱 한 번이고요.",
          next: "the_last_pick",
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "안 받을게요. 마지막까지 파시네요",
          reply: "파는 거 아닙니다. …그런데 그렇게 들리는군요. 그럼 얘기만 하겠습니다.",
          next: "the_last_pick",
          effect: { morality: 5, skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "지금 도망가는 거잖아요. 그 사람들은요",
          reply: "도망 맞습니다. 부정 안 합니다. 다만 명단은 지우고 갑니다.",
          next: "the_last_pick",
          effect: { mental: -4, skills: { knowledge: 18 } },
        },
      ],
    },
    {
      id: "the_last_pick",
      intro: [
        "이름은 안 적겠습니다. 캡처가 돌면 그것도 죄가 되니까요.",
        "방향만 말씀드리죠. 목요일 전에 정리하십시오. 갖고 계신 것 전부요.",
        "15년 하면서 딱 두 번 본 모양입니다. 두 번 다 맞았고요.",
        "믿든 안 믿든 오늘로 끝입니다. 어느 쪽이든 원망 안 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "믿을게요. 고마웠어요, 진짜로",
          reply: "…고맙다는 말은 제가 들을 게 아닌데요. 그래도 받아두겠습니다.",
          next: "after_midnight",
          delayDays: 1,
          effect: { money: 400_000, morality: -3, skills: { knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "안 믿어요. 근데 기억은 할게요",
          reply: "그러십시오. 기억만 해주셔도 충분합니다.",
          next: "after_midnight",
          delayDays: 1,
          effect: { mental: 4, skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "이거 다 캡처해서 올릴 거예요. 피해자 더 안 나오게",
          reply: "…캡처보다 그 한 줄이 낫겠군요. 이름은 제 것만 쓰십시오.",
          next: "after_midnight",
          delayDays: 1,
          postTweet:
            "리딩방 하나가 오늘 닫힙니다. 종목을 아는 사람은 그걸 팔지 않아요. 파는 사람은 종목이 아니라 당신을 아는 겁니다.",
          effect: { mental: -3, morality: 10, reputation: 8, followers: 300 },
        },
      ],
    },
    {
      id: "after_midnight",
      intro: [
        "열두 시에 닫았습니다. 아무도 안 물었습니다. 다들 이미 다른 방에 있더군요.",
        "회원님 것만 지우고 나머지는 태블릿째 넘겼습니다. 조사받는 데 필요하다더군요.",
        "…목요일 얘긴 지키셨습니까. 아니어도 상관없습니다.",
        "이 계정도 곧 없어집니다. 15년 하고 남는 게 이것뿐이라 좀 웃깁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이제 어디로 가세요?",
          reply: "모릅니다. 이번엔 정말 모르겠군요. …물어봐 주셔서 고맙습니다.",
          next: null,
          effect: { mental: 10, morality: 8, skills: { knowledge: 20, sociability: 30 } },
        },
        {
          tone: "cool",
          me: "또 다른 이름으로 방 여실 거잖아요",
          reply: "…그럴지도요. 그때는 좋아요 누르지 마십시오, 회원님.",
          next: null,
          effect: { mental: -3, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "당신 스승처럼 3년 받고 오세요. 그게 제일 깔끔해요",
          reply: "3년이라. …그 정도면 싸게 치는 겁니다. 알고 있습니다.",
          next: null,
          effect: { mental: -6, morality: 5, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 히메히메 왕복러 — 애니 동아리 겸 생활자전거로 90km를 왕복하는 1학년(`data/accounts.ts` himehime_46).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(칸라·셋톤·리딩방과 같은 동사 — 핸들이 다르면 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'못 꺼내는 말'**이다. 자전거 얘기라면 30분도 하는데, 정작 하려던 말은
 * 매번 자전거 얘기로 도망친다. 3회차에 걸쳐 **부탁 한 줄을 겨우 꺼내는 것**이 전부인 이야기다.
 *
 * ⚠️ 말투는 **끝까지 존댓말 + 말줄임표**다("…죄송해요", "그런가요…?"). 능숙해지게 만들지 마라 —
 *    마지막 회차에서도 그는 열두 번 고쳐 쓴다. 자란 건 말솜씨가 아니라 **꺼냈다는 사실**이다.
 * ⚠️ 실제 지명·작품명·주제가 제목을 쓰지 마라. 아키바는 계정 문구에 이미 있으니 그대로만 쓴다.
 * ⚠️ 보상축은 친화력·정신력이다(운동은 곁들이는 정도 — 이 아이는 기록으로 크는 캐릭터가 아니다).
 * 줄기: 1회차 첫 DM(도망) → 2회차 첫 레이스 → 3회차 폐부 위기와 모집 글.
 */
export const HIMEHIME_STORY: DmStory = {
  id: "himehime_1",
  partnerName: "히메히메 왕복러",
  partnerHandle: "himehime_46",
  arrivalTitle: "히메히메 왕복러의 DM",
  startNode: "first_dm",
  nodes: [
    {
      id: "first_dm",
      intro: [
        "저기… 제 글에 좋아요 눌러주셨죠? 확인하고 세 번 다시 봤어요.",
        "DM 처음 보내봐요. 손이 떨리는데 이건 페달 밟을 때랑은 다른 떨림이네요.",
        "무슨 말을 하려고 했는지 방금 까먹었어요… 죄송해요.",
        "아, 자전거 얘기는 할 수 있어요! 그건 30분도 할 수 있어요!",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 자전거 얘기 해주세요. 듣고 싶어요",
          reply: "정말요? 어… 어디서부터 하죠. 밤에 정리해서 내일 다시 올게요!",
          next: "morning_after",
          delayDays: 1,
          effect: { mental: 4, skills: { sociability: 10 } },
        },
        {
          tone: "cool",
          me: "천천히 하세요. 급할 거 없어요",
          reply: "…천천히요. 그 말 들으니까 이상하게 숨이 쉬어져요. 내일 다시 올게요.",
          next: "morning_after",
          delayDays: 1,
          effect: { skills: { sociability: 12 } },
        },
        {
          tone: "bold",
          me: "하려던 말 있잖아요. 그거 내일까지 생각해 와요",
          reply: "네?! 아, 네… 알겠습니다. 열두 번쯤 고쳐 쓸 것 같은데 괜찮을까요…",
          next: "morning_after",
          delayDays: 1,
          effect: { mental: -2, skills: { knowledge: 8, sociability: 8 } },
        },
      ],
    },
    {
      id: "morning_after",
      intro: [
        "안녕하세요! 어젯밤에 열두 번 고쳐 썼어요. 진짜로 열두 번이요.",
        "그런데 전부 지웠어요. 읽어보니까 다 자전거 얘기였거든요.",
        "저는 왜 중요한 말은 못 하고 회전수 얘기만 할까요…",
        "…아, 오늘도 왕복 90km 다녀왔어요. 이것도 자전거 얘기네요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "자전거 얘기도 중요한 말이에요",
          reply: "그런가요…? 그렇게 말해주신 분은 처음이에요.",
          next: "the_hill",
          effect: { mental: 6, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "중요한 말은 원래 맨 마지막에 나와요. 기다릴게요",
          reply: "기다린다고… 적어둘게요. 그 말.",
          next: "the_hill",
          effect: { skills: { knowledge: 10, sociability: 12 } },
        },
        {
          tone: "bold",
          me: "회전수 얘기, 그거 사실 언덕이 무섭다는 얘기죠",
          reply: "…어떻게 아셨어요. 저 그런 말 한 적 없는데요.",
          next: "the_hill",
          effect: { mental: -3, skills: { knowledge: 18 } },
        },
      ],
    },
    {
      id: "the_hill",
      intro: [
        "다음 주에 첫 레이스예요. 잠이 안 와서 이러고 있어요.",
        "선배가 그러는데 저는 언덕에서 웃는대요. 힘든데 왜 웃냐고요.",
        "저도 몰라요. 근데 안 웃으면 못 올라갈 것 같아서요.",
        "…오늘은 여기까지 할게요. 말이 길어지면 또 도망갈 것 같아서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "웃으면서 올라가는 거, 그거 재능이에요",
          reply: "재능이요…? 그 단어 저한테 써주신 분은 처음이에요. 오늘은 잘 잘 수 있겠어요.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "도망가도 돼요. 다음에 또 오면 되니까",
          reply: "…또 와도 되는 거군요. 그럼 또 올게요. 진짜로요.",
          next: null,
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "bold",
          me: "레이스 결과 알려줘요. 안 알려주면 제가 물어볼 거예요",
          reply: "무, 물어보신다고요…? 그럼 좋은 결과를 가져와야 하는데. 어떡하지.",
          next: null,
          effect: { mental: -3, skills: { fitness: 15, sociability: 12, knowledge: 10 } },
        },
      ],
    },
  ],
};

/**
 * 히메히메 왕복러 2회차 — 첫 레이스.
 * 축은 **등수가 아니라 언덕 두 개**다. 그는 꼴찌 근처로 들어오지만, 그 사실을 부끄러워하지 않는다.
 * ⚠️ 이 회차에서 그를 갑자기 잘 타게 만들지 마라. 잘한 건 딱 하나(언덕에서 두 명 제친 것)뿐이다.
 */
const HIMEHIME_STORY_2: DmStory = {
  id: "himehime_2",
  partnerName: "히메히메 왕복러",
  partnerHandle: "himehime_46",
  arrivalTitle: "히메히메 왕복러의 DM",
  startNode: "race_eve",
  nodes: [
    {
      id: "race_eve",
      intro: [
        "내일이에요. 첫 레이스요. 지금 열한 시인데 눈이 말똥말똥해요.",
        "오늘 처음으로 클릿 페달을 신어봤는데 세 번 넘어졌어요. 세 번 다 서 있는 상태로요.",
        "선배가 '내일은 그냥 완주만 해'라고 했어요. 그게 배려인 건 아는데요…",
        "…배려라는 걸 알아서 더 분한 건 이상한 걸까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 이상해요. 분한 게 정상이에요",
          reply: "정상이라고 해주시니까 좀 낫네요. 그럼 분한 채로 자볼게요.",
          next: "race_day",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "완주만 해도 충분해요. 나머지는 내년에 해요",
          reply: "내년이요… 내년도 있는 거군요. 그건 생각 안 해봤어요.",
          next: "race_day",
          delayDays: 1,
          effect: { skills: { knowledge: 18, sociability: 10 } },
        },
        {
          tone: "bold",
          me: "언덕에서 한 명만 제쳐요. 딱 한 명만",
          reply: "한 명이요…? 그 정도면… 그 정도면 해볼 수 있을 것 같기도 해요.",
          next: "race_day",
          delayDays: 1,
          effect: { mental: -3, skills: { fitness: 18 } },
        },
      ],
    },
    {
      id: "race_day",
      intro: [
        "끝났어요! 뒤에서 세 번째였어요. 뒤에서요.",
        "그런데요, 언덕에서 두 분을 제쳤어요. 두 분이요!",
        "주제가를 3절까지 불렀는데도 언덕이 안 끝나서 4절을 지어냈어요.",
        "가사가 엉망이었는데 그때부터 다리가 더 돌았어요. 이건 아무한테도 말 안 했어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "4절 만든 사람은 세상에 당신뿐일 거예요",
          reply: "그런가요? 그럼 저 그거 하나는 1등이네요. 처음이에요, 1등.",
          next: "club_trouble",
          effect: { mental: 10, skills: { sociability: 20, creativity: 15 } },
        },
        {
          tone: "cool",
          me: "언덕에서 제친 두 명은 평지에서 당신보다 빨랐을 거예요",
          reply: "…아. 그러네요. 그럼 저는 언덕에서만 이긴 거군요. 그것도 이긴 건가요?",
          next: "club_trouble",
          effect: { skills: { knowledge: 25, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "다음엔 4절 말고 다리로 올라가요",
          reply: "다, 다리로요… 맞는 말인데 왜 이렇게 부끄럽죠. 연습할게요!",
          next: "club_trouble",
          effect: { mental: -3, skills: { fitness: 25 } },
        },
      ],
    },
    {
      id: "club_trouble",
      intro: [
        "저기, 이건 자전거 얘기가 아닌데요… 그래도 해도 될까요.",
        "동아리가 이번 학기에 부원 4명을 못 채우면 폐부래요. 지금 셋이에요.",
        "제가 말주변이 없어서 아무도 못 데려왔어요. 복도에서 두 번 시도했는데 두 번 다 도망쳤어요.",
        "…제가요. 제가 도망쳤어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다음엔 도망 안 치게 제가 도와줄게요",
          reply: "도와주신다고요…? 그런 말은 어떻게 받아야 하는지 모르겠어요. 고맙습니다.",
          next: null,
          effect: { mental: 12, morality: 5, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "말로 데려오지 말고 글로 데려와요. 그건 잘하잖아요",
          reply: "글이요… 저 글은 쓸 수 있어요. 감상문 쓰다가 새벽 3시까지 가는 사람인데요.",
          next: null,
          effect: { skills: { knowledge: 25, creativity: 20, sociability: 15 } },
        },
        {
          tone: "bold",
          me: "셋이면 한 명만 더 찾으면 되잖아요. 왜 벌써 진 얼굴이에요",
          reply: "…한 명. 그렇게 말하니까 갑자기 적어 보이네요. 이상해요, 숫자는 그대로인데.",
          next: null,
          effect: { mental: -4, skills: { fitness: 12, knowledge: 22, sociability: 18 } },
        },
      ],
    },
  ],
};

/**
 * 히메히메 왕복러 3회차 — 부원 모집.
 * 그가 **처음으로 부탁을 꺼내는** 회차다. 그 부탁 한 줄을 위해 두 회차가 있었다.
 * ⚠️ 'friendly'·'cool'은 그가 쓴 문장을, 'bold'는 플레이어가 고쳐 쓴 문장을 올린다(postTweet).
 *    어느 쪽이든 **부원은 온다** — 이 이야기에서 실패 결말은 쓰지 않는다. 다만 온 이유가 다르다.
 */
const HIMEHIME_STORY_3: DmStory = {
  id: "himehime_3",
  partnerName: "히메히메 왕복러",
  partnerHandle: "himehime_46",
  arrivalTitle: "히메히메 왕복러의 DM",
  startNode: "the_favor",
  nodes: [
    {
      id: "the_favor",
      intro: [
        "저 오늘은 도망 안 갈 거예요. 그러려고 아침부터 열두 번 고쳐 썼어요.",
        "부탁이 있어요. 이거 쓰는 데 나흘 걸렸어요.",
        "제 계정은 팔로워가 서른한 명이에요. 그중 아홉은 동아리 사람이고요.",
        "…제 모집 글을, 그쪽 계정에 한 번만 올려주실 수 있을까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼요. 문장 주세요",
          reply: "바로 된다고 하시니까 오히려 더 떨려요. 지금 보내드릴게요!",
          next: "the_words",
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "올려는 줄게요. 대신 문장은 직접 쓰세요",
          reply: "제가요…? 알겠어요. 제가 쓸게요. 그게 맞는 것 같아요.",
          next: "the_words",
          effect: { skills: { knowledge: 20, sociability: 15 } },
        },
        {
          tone: "bold",
          me: "나흘이나 걸렸어요? 그냥 물어봤으면 첫날에 됐어요",
          reply: "…그렇죠. 그런데 저한테는 그 나흘이 필요했어요. 죄송해요, 그리고 고마워요.",
          next: "the_words",
          effect: { mental: -4, skills: { knowledge: 25, sociability: 12 } },
        },
      ],
    },
    {
      id: "the_words",
      intro: [
        "보냅니다. 고쳐 쓰셔도 돼요. 아마 고치는 게 나을 거예요.",
        '"자전거 잘 타는 사람 안 구해요. 언덕에서 노래 부를 사람 구해요. 부원 한 명이면 됩니다."',
        "…이상하죠? 근데 저는 이렇게밖에 못 쓰겠어요.",
        "잘 타는 사람을 구한다고 쓰면, 저부터 자격이 없어서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 고칠게요. 이대로 올려요",
          reply: "그대로요…? 정말요? 그럼… 네. 부탁드립니다.",
          next: "who_came",
          delayDays: 1,
          postTweet:
            "자전거 잘 타는 사람 안 구해요. 언덕에서 노래 부를 사람 구해요. 부원 한 명이면 됩니다.",
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "좋은 문장이에요. 마지막 줄만 빼고 올릴게요",
          reply: "마지막 줄이 제일 부끄러웠는데 어떻게 아셨어요. 그럼 그렇게 해주세요.",
          next: "who_came",
          delayDays: 1,
          postTweet: "자전거 잘 타는 사람 안 구해요. 언덕에서 노래 부를 사람 구해요.",
          effect: { skills: { knowledge: 25, creativity: 15, sociability: 15 } },
        },
        {
          tone: "bold",
          me: "이건 너무 조용해요. 제 말로 다시 쓸게요",
          reply: "그쪽 말로요…? 어떻게 쓰실지 무서운데 궁금해요. 맡길게요.",
          next: "who_came",
          delayDays: 1,
          postTweet:
            "여기 매주 90km를 혼자 왕복하는 1학년이 있는데, 동아리에 사람이 셋이라 곧 없어진대요. 딱 한 명이면 됩니다. 자전거는 못 타도 됩니다.",
          effect: { mental: -3, reputation: 5, skills: { creativity: 25, sociability: 18 } },
        },
      ],
    },
    {
      id: "who_came",
      intro: [
        "왔어요. 왔어요!! 오늘 아침에 동아리방 문을 두드린 사람이 있었어요.",
        "자전거 한 번도 안 타봤대요. 노래는 부를 줄 안다고 했어요.",
        "제가 뭐라고 했는지 아세요? 아무 말도 못 했어요. 또 도망칠 뻔했어요.",
        "…그래도 안 도망쳤어요. '기어는 3단이면 충분해요'라고 했어요. 첫마디가 그거였어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "첫마디로 완벽했어요. 정말로요",
          reply: "완벽… 저한테 그런 말이 붙는 날이 오네요. 오늘은 90km 말고 100km 갈래요.",
          next: null,
          effect: {
            mental: 15,
            reputation: 5,
            followers: 250,
            skills: { sociability: 35, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "그 사람은 글 보고 온 게 아니라 당신 보고 온 거예요",
          reply: "…저를요? 저는 글 뒤에 숨어 있었는데요. 숨었는데도 보이는 거군요.",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 35, sociability: 25 } },
        },
        {
          tone: "bold",
          me: "이제 폐부는 없어요. 다음은 그 사람 언덕 태우기예요",
          reply: "다, 다음이요? 벌써요? …맞네요. 다음이 있네요. 그거 좋다.",
          next: null,
          effect: {
            mental: 8,
            followers: 300,
            skills: { fitness: 25, sociability: 25, knowledge: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 웃는 스프린터 — 마지막 1km만 빠른 3학년 스프린터(`data/accounts.ts` smile_sprint).
 * 그의 트윗을 **리트윗**하면 DM이 온다(무색·바큐라·탈환사와 같은 동사 — 핸들이 다르면 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'말 안 하는 것'**이다. 무릎도, 동생도, 은퇴도 그는 팀에 말하지 않는다.
 * 모르는 사람(플레이어)한테만 말한다 — 팀한테 하면 그 순간 팀 문제가 되기 때문이다.
 *
 * ⚠️ 말투는 **끝까지 느긋한 반말**이다("~다/~지/~마라", 가끔 "하하"). 존댓말을 쓰면 캐릭터가 죽는다.
 *    동생(bro_sprint)은 존댓말이라 둘을 나란히 읽어도 섞이지 않아야 한다.
 * ⚠️ 그는 **소리치지 않는다.** 화내는 대사, 절규, 눈물 묘사를 쓰지 마라 — "이기고 싶은 마음은
 *    조용히 갖고 있으면 된다"가 이 인물이다.
 * ⚠️ 은퇴를 비극으로 쓰지 마라. 그는 끝까지 웃으면서 끝내려는 사람이다.
 * 줄기: 1회차 무릎(팀에 말할까) → 2회차 동생의 새벽 롤러 → 3회차 인터하이 마지막 1km.
 */
export const SMILE_STORY: DmStory = {
  id: "smile_1",
  partnerName: "웃는 스프린터",
  partnerHandle: "smile_sprint",
  arrivalTitle: "웃는 스프린터의 DM",
  startNode: "thanks_rt",
  nodes: [
    {
      id: "thanks_rt",
      intro: [
        "내 글을 퍼갔더라. 고맙다. 이런 건 처음이라 좀 어색하네",
        "말이 느린 편이라 답이 늦을 수 있다. 미리 말해둔다",
        "…실은 물어볼 사람이 없어서, 모르는 사람한테 물어볼 참이었다",
        "팀 얘기는 팀한테 못 하겠더라고. 이상하지",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어보세요. 저 모르는 사람이라 딱 좋잖아요",
          reply: "그렇지. 딱 좋다. 하하, 이런 말도 오랜만이네",
          next: "the_knee",
          effect: { mental: 4, skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "팀한테 못 하는 말이면 꽤 큰 건데요",
          reply: "…큰 건 아니야. 크게 만들고 싶지 않은 거지",
          next: "the_knee",
          effect: { skills: { knowledge: 15 } },
        },
        {
          tone: "bold",
          me: "몸 어디 아프죠. 딱 그런 사람 말투예요",
          reply: "…한 방에 맞히네. 너 좀 무섭다",
          next: "the_knee",
          effect: { mental: -3, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_knee",
      intro: [
        "무릎이다. 작년 겨울부터 계단 내려갈 때 소리가 난다",
        "병원은 갔다. 인터하이 끝나고 다시 오라더라. 그 말이 무슨 뜻인지는 나도 안다",
        "3학년 마지막 여름이고 사흘 남았다. 지금 말하면 감독은 나를 안 쓴다",
        "…말해야 하나. 그걸 못 정하겠다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말하세요. 팀이 알아야 한다고 본인이 썼잖아요",
          reply: "…내가 쓴 걸 나한테 돌려주네. 하룻밤만 생각해보마",
          next: "night_before",
          delayDays: 1,
          effect: { morality: 6, skills: { sociability: 18 } },
        },
        {
          tone: "cool",
          me: "말하면 못 뛰고 안 말하면 뛰어요. 답 정해놓고 물으신 거잖아요",
          reply: "…그렇게 들렸나. 부정은 못 하겠다. 하룻밤 자고 답하지",
          next: "night_before",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "다치고 은퇴할래요, 뛰고 은퇴할래요",
          reply: "…둘 다 은퇴네. 그렇게 물으니 간단해진다. 내일 답하마",
          next: "night_before",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 22, fitness: 10 } },
        },
      ],
    },
    {
      id: "night_before",
      intro: [
        "감독한테 말했다. 다 말한 건 아니고, 소리 난다는 데까지",
        "감독이 뭐랬는지 아냐. '알고 있었다'더라. 나만 숨긴 줄 알았는데 말이야",
        "뛴다. 마지막 1km만. 그 앞은 다른 놈들이 끌어주기로 했다",
        "…팀이라는 게 이런 거였네. 3년 만에 알았다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "숨긴 게 아니라 아껴둔 거예요. 잘 다녀오세요",
          reply: "아껴뒀다라. 좋은 말이네. 그 말 갖고 가겠다",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "감독이 먼저 알았다는 건 당신이 티를 냈다는 뜻이에요",
          reply: "…그런가. 나는 잘 숨긴 줄 알았는데 말이지. 하하",
          next: null,
          effect: { skills: { knowledge: 30, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "마지막 1km에서 웃으면 무섭다던데, 그거 보고 싶네요",
          reply: "그럼 보러 와라. 웃고 있을 테니까",
          next: null,
          effect: { mental: 6, followers: 200, skills: { fitness: 20 } },
        },
      ],
    },
  ],
};

/**
 * 웃는 스프린터 2회차 — 동생.
 * 축은 **'모르는 척'**이다. 동생이 새벽에 몰래 롤러를 타는 걸 알면서도 그는 내려가지 않았다.
 * ⚠️ 형제 얘기지만 동생 계정(bro_sprint)의 진행 상태를 전제하지 마라 — 둘은 독립적으로 열린다.
 *    같은 사건을 각자 자기 각도에서만 말한다(형은 '봐주는 법', 동생은 '봐주지 마라').
 */
const SMILE_STORY_2: DmStory = {
  id: "smile_2",
  partnerName: "웃는 스프린터",
  partnerHandle: "smile_sprint",
  arrivalTitle: "웃는 스프린터의 DM",
  startNode: "the_kid",
  nodes: [
    {
      id: "the_kid",
      intro: [
        "동생 얘기 좀 하자. 새벽 두 시에 롤러 타는 소리가 벽 너머로 들린다",
        "석 달째다. 나는 계속 모르는 척하고 있다",
        "말리면 그만둘 놈이 아니고, 칭찬하면 더 무리할 놈이다",
        "…형이라는 게 이렇게 아무것도 못 하는 자리인 줄 몰랐네",
      ],
      choices: [
        {
          tone: "friendly",
          me: "내려가서 같이 타세요. 그거면 돼요",
          reply: "…같이 타라. 생각도 못 해봤다. 오늘 새벽에 내려가 보지",
          next: "that_night",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "모르는 척하는 것도 형이 하는 일이에요",
          reply: "…그렇게 말해주는 사람이 있으니 좀 낫다. 그래도 오늘은 한번 내려가 보마",
          next: "that_night",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "무릎 얘기는 동생한테도 안 했죠. 그게 더 나쁜데요",
          reply: "…아프네, 그 말. 부정은 못 하겠다. 오늘 새벽에 내려가 본다",
          next: "that_night",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 22, sociability: 10 } },
        },
      ],
    },
    {
      id: "that_night",
      intro: [
        "새벽에 내려갔다. 롤러 두 대를 나란히 놓고 한 시간 탔다",
        "그놈이 아무것도 안 물었다. 나도 아무 말 안 했고",
        "끝나고 물 마시면서 딱 한 마디 하더라. '형, 봐주면 진짜 화낼 거예요'",
        "…봐주는 게 아니라고 말해줄 수가 없었다. 봐주고 있었으니까",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 이번엔 봐주지 마세요. 그게 대답이에요",
          reply: "…봐주지 마라. 알겠다. 그게 제일 어려운 부탁인 건 아냐?",
          next: "the_name",
          effect: { mental: 8, morality: 5, skills: { sociability: 25, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "봐준 걸 아는 애면 이미 실력은 다 온 거예요",
          reply: "…그렇지. 아는 놈이지. 그래서 더 무섭다",
          next: "the_name",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "한 시간 같이 타놓고 무릎 얘긴 또 안 했네요",
          reply: "…했으면 그놈이 봐주기 시작했을 거다. 그건 못 본다",
          next: "the_name",
          effect: { mental: -5, skills: { knowledge: 28 } },
        },
      ],
    },
    {
      id: "the_name",
      intro: [
        "생각해보니 나는 그놈을 이름으로 부른 적이 거의 없다. 늘 '야'였다",
        "팀에서도 다들 '동생'이라고 부른다. 내 동생이라서 동생인 거지",
        "그놈 계정 이름이 '형 따라가는 중'이더라. 나는 그걸 보고 웃었는데, 웃고 나서 좀 미안했다",
        "…이름으로 부르는 게 이렇게 늦어질 일인가",
      ],
      choices: [
        {
          tone: "friendly",
          me: "오늘 한 번 불러보세요. 그거면 충분해요",
          reply: "오늘이라. …알겠다. 저녁에 밥 먹을 때 한번 불러보지",
          next: null,
          effect: { mental: 12, morality: 6, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "그 계정 이름은 자랑이지 원망이 아니에요",
          reply: "…자랑이라고 봐주는구나. 그렇게 들으니 좀 견딜 만하다",
          next: null,
          effect: { mental: 6, skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "이름 부르는 건 이겨놓고 하세요. 그게 순서예요",
          reply: "…이기고 나서라. 너 진짜 스프린터처럼 말한다. 하하",
          next: null,
          effect: { mental: 4, followers: 180, skills: { fitness: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 웃는 스프린터 3회차 — 마지막 1km.
 * 그의 마지막 레이스. **등수를 결말로 쓰지 않는다** — 이 회차의 결말은 "웃으면서 끝냈는가"다.
 * ⚠️ 무릎이 부서지는 파국을 쓰지 마라. 그는 완주하고, 그 뒤는 병원 얘기로만 짧게 남긴다.
 */
const SMILE_STORY_3: DmStory = {
  id: "smile_3",
  partnerName: "웃는 스프린터",
  partnerHandle: "smile_sprint",
  arrivalTitle: "웃는 스프린터의 DM",
  startNode: "start_line",
  nodes: [
    {
      id: "start_line",
      intro: [
        "내일이다. 3년치가 내일 세 시간으로 끝난다",
        "이상하게 안 떨린다. 스프린트 직전이 제일 조용한 것처럼, 지금이 딱 그렇다",
        "유니폼 빨아서 널어놨다. 이거 입는 것도 내일이 마지막이네",
        "…뭐 하나 물어보자. 마지막에 뭘 생각하고 밟는 게 좋을까",
      ],
      choices: [
        {
          tone: "friendly",
          me: "아무것도 생각하지 마세요. 그동안 다 해놨잖아요",
          reply: "…그렇지. 다 해놨지. 그럼 그냥 밟겠다",
          next: "the_last_km",
          delayDays: 1,
          effect: { mental: 8, skills: { sociability: 25, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "뒤에 붙은 사람 생각하세요. 늘 그러셨잖아요",
          reply: "…버릇이지. 내일도 속도를 늦출까 봐 그게 걱정이다",
          next: "the_last_km",
          delayDays: 1,
          effect: { skills: { knowledge: 25, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "동생 생각하세요. 뒤에서 보고 있을 거예요",
          reply: "…그놈 생각하면 못 웃을 것 같은데. 뭐, 해보지",
          next: "the_last_km",
          delayDays: 1,
          effect: { mental: -4, skills: { fitness: 25 } },
        },
      ],
    },
    {
      id: "the_last_km",
      intro: [
        "끝났다. 2등이다. 마지막 200m에서 한 명한테 먹혔다",
        "무릎은 750m 지점부터 소리가 났다. 그래도 끝까지 밟았다",
        "웃고 있었냐고? 나는 웃은 줄 알았는데 사진 보니까 이빨 다 드러내고 이상하게 나왔더라",
        "…애들이 그 사진을 단톡방에 올렸다. 3년 중에 제일 많이 웃은 날이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "2등이 아니라 완주예요. 축하해요",
          reply: "완주라. …그래, 완주다. 고맙다. 이 말 하려고 답장 기다렸다",
          next: "after_all",
          effect: { mental: 15, skills: { sociability: 30, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "750m부터 났으면 마지막 250m는 다리로 탄 게 아니네요",
          reply: "…뭘로 탔을까. 나도 모르겠다. 그런 게 있더라",
          next: "after_all",
          effect: { skills: { knowledge: 35, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "그 사진 저한테도 보내요. 올려서 자랑할 거예요",
          reply: "…남의 이빨을 뭘 자랑해. 뭐, 보내주지. 하하",
          next: "after_all",
          effect: { mental: 8, followers: 350, skills: { fitness: 15, sociability: 20 } },
        },
      ],
    },
    {
      id: "after_all",
      intro: [
        "병원 다시 갔다. 수술은 안 해도 된단다. 대신 선수로는 여기까지라더라",
        "생각보다 안 슬프다. 이상하지. 3년 내내 이 날을 무서워했는데",
        "동생을 이름으로 불렀다. 그놈이 밥 먹다 말고 나를 한참 봤다",
        "…이제 뒤에서 밀어주는 쪽을 해보려고 한다. 그건 아직 못 해봤으니까",
      ],
      choices: [
        {
          tone: "friendly",
          me: "밀어주는 쪽도 잘하실 거예요. 원래 그래왔잖아요",
          reply: "원래 그래왔다라. …그렇게 정리해주니 3년이 안 아깝다. 고맙다",
          next: null,
          effect: {
            mental: 18,
            reputation: 8,
            followers: 300,
            skills: { sociability: 40, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "안 슬픈 건 아직 실감이 안 나서예요. 겨울쯤 올 거예요",
          reply: "…겨울이라. 그때 또 DM 하마. 그때는 내가 물어볼 차례겠지",
          next: null,
          effect: { mental: 8, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "동생한테 봐주지 마세요. 마지막까지요",
          reply: "…안 봐준다. 그놈이 나를 이기는 날까지는 안 봐준다. 약속하지",
          next: null,
          effect: { mental: 10, followers: 250, skills: { fitness: 30, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 형 따라가는 중 — 스프린터 지망 1학년, 형 자랑 계정(`data/accounts.ts` bro_sprint).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(핸들이 달라 히메히메·리딩방과 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'이름'**이다. 팀에서도 SNS에서도 그는 '동생'으로만 불린다.
 * 형을 이기고 싶은 것도 실은 이름으로 불리고 싶어서다 — 본인은 그걸 회차 끝에서야 안다.
 *
 * ⚠️ 말투는 **들뜬 존댓말**이다("~요/~다구요/ㅋㅋ", 감탄부호 많음). 형(smile_sprint)이 반말이라
 *    두 계정을 나란히 읽어도 섞이지 않아야 한다.
 * ⚠️ 형을 **깎아내리지 마라.** 이 아이의 열등감은 형을 향하지 않고 자기를 향한다.
 * ⚠️ 형 계정(smile_sprint)의 진행 상태를 전제하는 대사를 쓰지 마라 — 두 스토리는 따로 열린다.
 * 줄기: 1회차 '자랑 그만하라'는 DM → 2회차 형의 무릎을 눈치챔 → 3회차 형의 마지막 여름과 이름.
 */
export const BRO_STORY: DmStory = {
  id: "bro_1",
  partnerName: "형 따라가는 중",
  partnerHandle: "bro_sprint",
  arrivalTitle: "형 따라가는 중의 DM",
  startNode: "that_dm",
  nodes: [
    {
      id: "that_dm",
      intro: [
        "안녕하세요! 좋아요 눌러주셔서 DM 드려요. 이런 거 실례 아니죠…?",
        "실은 어제 모르는 분한테 DM이 왔어요. 형 자랑 좀 그만하라고요.",
        "차단하면 그만인데요, 그 말이 밤새 안 지워지더라구요.",
        "…그럼 이 계정은 뭘 올려야 하죠? 저 이 얘기 말고 할 게 없는데요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "형 얘기 계속 해요. 재밌게 잘 쓰던데요",
          reply: "재, 재밌었어요?! 그럼 계속 쓸게요. 오늘 것도 이미 세 개 써놨어요 ㅋㅋ",
          next: "the_notebook",
          effect: { mental: 6, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "형 얘기 말고 본인 기록을 올려보는 건요",
          reply: "제 기록이요…? 그건 자랑할 게 없어서요. 아직은요.",
          next: "the_notebook",
          effect: { skills: { knowledge: 15, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "그 사람 말이 좀 맞아요. 형 계정인지 본인 계정인지 모르겠어요",
          reply: "…아 진짜. 아픈 데를 찌르시네요. 근데 부정을 못 하겠어요.",
          next: "the_notebook",
          effect: { mental: -5, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_notebook",
      intro: [
        "훈련 일지 300일째예요. 형은 400일 넘었대요. 아직 100일 차이 나요.",
        "근데 오늘 일지를 넘겨보다가 좀 이상했어요.",
        "300일 중에 279일이 형 얘기로 시작하더라구요. 세어봤어요, 진짜로.",
        "…제 일지인데 왜 형 얘기부터 쓰죠. 저 이거 좀 이상한가요?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 이상해요. 목표가 앞에 있으면 그렇게 돼요",
          reply: "목표… 그렇게 부르면 좀 낫네요. 형이 목표인 거였어요, 저는.",
          next: "the_race_ahead",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "내일 일지는 형 얘기 빼고 써봐요. 하루만요",
          reply: "하루만이요…? 쓸 게 있을지 모르겠는데. 해볼게요. 내일 알려드릴게요.",
          next: "the_race_ahead",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "279일 세어본 사람이 형 안 이기면 그게 더 이상해요",
          reply: "…네? 아, 그렇게 되나요. 그렇게 말하니까 갑자기 밤에 롤러 타고 싶어지는데요.",
          next: "the_race_ahead",
          delayDays: 1,
          effect: { mental: -3, skills: { fitness: 25 } },
        },
      ],
    },
    {
      id: "the_race_ahead",
      intro: [
        "어제 일지 썼어요. 형 얘기 빼고요. 세 줄 만에 끝났어요. 세 줄이요.",
        "'롤러 40분. 다리 무거움. 내일은 더.' 이게 다예요. 창피해서 웃었어요.",
        "근데 오늘 아침에 그 세 줄을 다시 봤는데요, 그게 제 거더라구요. 처음으로요.",
        "…이상한 기분이에요. 자랑할 것도 없는데 지우기는 싫어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 세 줄이 진짜 훈련 일지예요",
          reply: "진짜요? 그럼 저 오늘부터 진짜를 쓰는 거네요. 좀 멋있는데요 ㅋㅋ",
          next: null,
          effect: { mental: 12, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "279일치도 지우지 마세요. 그것도 기록이에요",
          reply: "…안 지울게요. 형 얘기도 제가 쓴 거니까요. 맞죠?",
          next: null,
          effect: { mental: 8, skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "이제 계정 이름도 바꿔요. '형 따라가는 중'은 언제까지 할 건데요",
          reply: "…그건 아직이요! 그건 형 이기고 바꿀 거예요. 그때까진 이대로 갈래요.",
          next: null,
          effect: { mental: -4, followers: 150, skills: { fitness: 20, knowledge: 15 } },
        },
      ],
    },
  ],
};

/**
 * 형 따라가는 중 2회차 — 눈치.
 * 축은 **'봐주지 마라'**다. 그는 형의 무릎을 눈치채고도, 배려받는 걸 제일 싫어한다.
 * ⚠️ 형의 부상을 정확히 알게 만들지 마라 — 그는 끝까지 '눈치'까지만 간다. 확인하는 순간
 *    이야기가 형 것이 되어버린다.
 */
const BRO_STORY_2: DmStory = {
  id: "bro_2",
  partnerName: "형 따라가는 중",
  partnerHandle: "bro_sprint",
  arrivalTitle: "형 따라가는 중의 DM",
  startNode: "the_stairs",
  nodes: [
    {
      id: "the_stairs",
      intro: [
        "저 요즘 좀 이상한 걸 봤는데요, 이거 말해도 될까요.",
        "형이 계단 내려갈 때 오른쪽 다리를 먼저 안 내려요. 두 달째 그래요.",
        "물어봤더니 '괜찮다'고만 해요. 형은 아프면 원래 아무 말도 안 하거든요.",
        "…근데 지난주에 저랑 100m 붙었을 때는 이겼어요. 그게 더 무서워요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무섭다는 게 무슨 뜻이에요?",
          reply:
            "…아픈데도 이겼다는 거잖아요. 그럼 저는 아직 한참 멀었다는 거고요. 그게 무서워요.",
          next: "dont_hold_back",
          effect: { mental: -3, skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "형은 말 안 할 거예요. 그럼 물어보지 말고 그냥 보고 있어요",
          reply: "보고만 있으라구요… 그게 제일 어려운 건데요. 근데 맞는 말 같아요.",
          next: "dont_hold_back",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그거 알면서 이겨야 진짜 이기는 거예요. 봐달라고 할 거예요?",
          reply: "아니요!! 그건 진짜 싫어요. 그것만은 싫어요.",
          next: "dont_hold_back",
          effect: { mental: -5, skills: { fitness: 28 } },
        },
      ],
    },
    {
      id: "dont_hold_back",
      intro: [
        "어제 새벽에 롤러 타는데 형이 내려왔어요. 석 달 만에 처음이요.",
        "두 대를 나란히 놓고 한 시간 탔어요. 서로 아무 말도 안 했어요.",
        "끝나고 물 마시면서 딱 하나만 말했어요. '형, 봐주면 진짜 화낼 거예요.'",
        "…형이 웃기만 하고 대답을 안 했어요. 그게 대답 맞죠?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "웃은 건 알겠다는 뜻이에요. 형들은 원래 그래요",
          reply: "그런 거였으면 좋겠어요. …그럼 저는 이제 진짜로 준비해야겠네요.",
          next: "the_summer",
          delayDays: 1,
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "대답 안 한 건 봐주고 있었다는 뜻이에요",
          reply: "…아. 그러네요. 그거 알면서도 저는 왜 기분이 좋을까요. 저 진짜 이상해요.",
          next: "the_summer",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그럼 화내요. 말했잖아요, 화낸다고",
          reply: "…못 하겠어요. 형이 새벽에 내려온 게 처음이라서요. 그것만으로 됐어요.",
          next: "the_summer",
          delayDays: 1,
          effect: { mental: 5, morality: 5, skills: { sociability: 20, fitness: 15 } },
        },
      ],
    },
    {
      id: "the_summer",
      intro: [
        "오늘 아침에 형 유니폼을 입어봤어요. 형이 없을 때요.",
        "아직도 커요. 어깨가 한 뼘은 남더라구요.",
        "근데 예전엔 소매가 손등을 덮었는데 지금은 손목까지 와요. 재봤어요.",
        "…형이 이번 여름에 끝나요. 저는 아직 소매만 줄었는데요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "손목까지 왔으면 많이 온 거예요. 여름 안에 더 와요",
          reply: "여름 안에요…? 그럼 진짜 시간이 없네요. 오늘부터 두 배로 탈게요!",
          next: null,
          effect: { mental: 10, skills: { fitness: 30, sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그 유니폼은 안 맞아도 돼요. 본인 걸 받게 될 테니까",
          reply: "제 걸요… 그 생각은 한 번도 안 해봤어요. 왜 안 해봤죠, 저는.",
          next: null,
          effect: { mental: 12, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "여름 안에 못 이기면요? 그건 생각해봤어요?",
          reply: "…생각했어요. 매일요. 그래서 새벽에 타는 거예요.",
          next: null,
          effect: { mental: -6, followers: 200, skills: { fitness: 35 } },
        },
      ],
    },
  ],
};

/**
 * 형 따라가는 중 3회차 — 이름.
 * 형의 마지막 여름. **그는 형을 이기지 못한다** — 그게 이 이야기의 결말이고, 그래도 괜찮은 이유가
 * 마지막 노드에 있다(이름). 억지로 이기게 만들면 두 회차가 쌓아온 게 전부 헐값이 된다.
 * ⚠️ 'bold'만 마지막에 자기 계정 이름을 바꾸는 트윗을 올린다(postTweet). 나머지 둘은 안 바꾼다.
 */
const BRO_STORY_3: DmStory = {
  id: "bro_3",
  partnerName: "형 따라가는 중",
  partnerHandle: "bro_sprint",
  arrivalTitle: "형 따라가는 중의 DM",
  startNode: "one_more_race",
  nodes: [
    {
      id: "one_more_race",
      intro: [
        "형이 은퇴 전에 딱 한 번 붙어주기로 했어요. 이번 주말에요.",
        "제가 조른 게 아니고 형이 먼저 그랬어요. '한 번 하자'고요.",
        "300m 스프린트예요. 형 조건에 맞춘 거리예요. 저한텐 좀 긴데요.",
        "…봐준다는 조건이면 안 한다고 했어요. 형이 알겠다고 했어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "긴 거리로 잡아준 게 이미 안 봐주겠다는 뜻이에요",
          reply: "…그렇네요! 봐줄 거면 짧게 잡았겠죠. 아 저 이제 좀 떨려요.",
          next: "the_result",
          delayDays: 1,
          effect: { mental: 8, skills: { sociability: 25, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "300m면 형 거리예요. 200m 지점까지 아껴요",
          reply: "아끼라구요… 저는 늘 처음부터 다 쓰거든요. 이번엔 해볼게요.",
          next: "the_result",
          delayDays: 1,
          effect: { skills: { knowledge: 25, fitness: 20 } },
        },
        {
          tone: "bold",
          me: "지면요? 진 다음 얘기는 안 해요?",
          reply: "…안 할 거예요. 지금은요. 그거 생각하면 다리에 힘이 빠져서요.",
          next: "the_result",
          delayDays: 1,
          effect: { mental: -5, skills: { fitness: 30 } },
        },
      ],
    },
    {
      id: "the_result",
      intro: [
        "졌어요. 반 바퀴도 아니고 자전거 한 대 차이로요.",
        "250m까지는 제가 앞이었어요. 진짜로요. 제가 앞이었어요.",
        "마지막 50m에서 형이 웃으면서 올라오는데요, 그거 진짜 무서웠어요. 아는 사람은 알 거예요.",
        "…근데 결승선 지나고 형이 저를 봤는데, 형 얼굴이 더 힘들어 보였어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "250m까지 앞섰으면 다음엔 300m도 앞서요",
          reply: "다음이요… 형은 이제 없는데요. 그래도 다음이 있는 건 맞죠. 맞을 거예요.",
          next: "my_name",
          effect: { mental: 10, skills: { sociability: 25, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "형 얼굴이 힘들어 보인 건 전력으로 탔다는 뜻이에요",
          reply: "…전력이요. 그럼 형이 약속 지킨 거네요. 안 봐준 거네요. 저 지금 좀 울 것 같아요.",
          next: "my_name",
          effect: { mental: 12, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "자전거 한 대 차이면 진 거예요. 위로는 안 할게요",
          reply: "…네. 진 거예요. 위로 안 해주셔서 오히려 낫네요. 이상하죠.",
          next: "my_name",
          effect: { mental: -6, skills: { fitness: 35, knowledge: 20 } },
        },
      ],
    },
    {
      id: "my_name",
      intro: [
        "어제 저녁에 밥 먹는데 형이 저를 불렀어요.",
        "'야'가 아니고 이름으로요. 밥 먹다가 젓가락 떨어뜨렸어요.",
        "형이 뭐라고 했는지 아세요? '내년에 네 뒤에 붙을 놈 생각해서 타라'였어요.",
        "…저 그 말 들으려고 300일 넘게 일지 쓴 것 같아요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "축하해요. 그거 이긴 것보다 큰 거예요",
          reply: "이긴 것보다 크다구요… 그렇게 말해주시니까 진 게 좀 괜찮아졌어요. 고맙습니다!",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 250,
            skills: { sociability: 40, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "이름으로 불릴 때까지 300일 걸렸으면, 다음 300일은 짧을 거예요",
          reply: "…다음 300일. 벌써 세고 계시네요. 그럼 저도 세야죠. 내일부터 301일째예요.",
          next: null,
          effect: { mental: 12, followers: 200, skills: { knowledge: 40, fitness: 20 } },
        },
        {
          tone: "bold",
          me: "그럼 이제 계정 이름 바꿔요. 약속했잖아요",
          reply: "…아, 그거요. 이겨야 바꾼다고 했는데요. …그래도 바꿀게요. 지금이 맞는 것 같아요.",
          next: null,
          postTweet:
            "계정 이름 바꿉니다. 형 따라가는 중은 오늘까지요. 어제 형이 저를 이름으로 불러줬거든요. 내년엔 제 뒤에 붙는 사람 생각하면서 탈 겁니다.",
          effect: {
            mental: 15,
            reputation: 10,
            followers: 400,
            skills: { sociability: 30, fitness: 25, creativity: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 조용한 신입 — 산에서만 빨라지는 1학년 클라이머(`data/accounts.ts` quiet_rookie).
 * 그의 기록 트윗을 **리트윗**하면 DM이 온다 — 코멘트도 없는 숫자 글을 누가 퍼갔다는 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'편한 게 좋은 건가'**다. 그는 혼자 타는 게 편하고, 그게 좋은 건지는 모른다.
 * 히메히메가 '못 꺼내는 말'이라면 이 아이는 **'안 꺼내는 말'**이다 — 소심한 게 아니라 필요를 못 느낀다.
 * 3회차에 걸쳐 그의 문장은 점점 **길어진다**. 그게 이 캐릭터의 성장 지표다.
 *
 * ⚠️ 말투는 **끝까지 짧은 존댓말**이다("…습니다", "…네요"). 느낌표를 쓰지 마라 — 느낌표는
 *    동기(charge_rookie) 몫이고, 그걸 섞으면 두 계정이 구분되지 않는다.
 * ⚠️ 그를 **수다스럽게 만들지 마라.** 마지막 회차에서도 그가 한 말은 세 문장이 최대다.
 * 줄기: 1회차 왜 퍼갔습니까 → 2회차 뻗은 동기와 물통 → 3회차 첫 합동 레이스.
 */
export const QUIET_STORY: DmStory = {
  id: "quiet_1",
  partnerName: "조용한 신입",
  partnerHandle: "quiet_rookie",
  arrivalTitle: "조용한 신입의 DM",
  startNode: "why_rt",
  nodes: [
    {
      id: "why_rt",
      intro: [
        "제 글을 퍼가셨더군요. 코멘트도 없는 글인데요.",
        "…이유를 물어도 됩니까. 궁금해서 그러는 건 아니고, 그냥 이상해서요.",
        "제 계정은 숫자만 올립니다. 언덕 세 개, 몇 분. 그게 전부입니다.",
        "그걸 퍼갈 이유가 있습니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "숫자만 있어서 좋았어요. 군더더기가 없어서요",
          reply: "…군더더기가 없다. 그런 평은 처음입니다. 나쁘지 않네요.",
          next: "the_noise",
          effect: { skills: { sociability: 10, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "그 숫자가 매일 조금씩 줄던데요. 그거 보고 퍼갔어요",
          reply: "…세고 계셨습니까. 저 말고 그걸 본 사람은 없었습니다.",
          next: "the_noise",
          effect: { skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "코멘트가 없으니까요. 없는 자리가 더 크게 보였어요",
          reply: "…없는 자리라. 무슨 말인지 모르겠습니다. 모르겠는데 지워지지가 않네요.",
          next: "the_noise",
          effect: { mental: -2, skills: { knowledge: 18 } },
        },
      ],
    },
    {
      id: "the_noise",
      intro: [
        "질문 하나 하겠습니다. 답 안 하셔도 됩니다.",
        "동기 중에 소리를 지르면서 언덕을 오르는 애가 있습니다. 매일입니다.",
        "시끄럽습니다. 산이 무너지는 줄 알았습니다.",
        "…그런데 왜 저는 오늘 그 애 뒤를 두 번이나 따라갔을까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "부러워서요. 그거 부러운 거 맞아요",
          reply: "…부럽다. 그 단어는 생각 안 해봤습니다. 하루 생각해보겠습니다.",
          next: "alone",
          delayDays: 1,
          effect: { skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "따라간 게 아니라 확인한 거예요. 저래도 되나 싶어서",
          reply: "…확인. 그쪽이 맞는 것 같습니다. 정리되면 다시 쓰겠습니다.",
          next: "alone",
          delayDays: 1,
          effect: { skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "시끄러운 애 뒤가 편했던 거죠. 생각이 멈추니까",
          reply: "…그건 좀 아픈 말이군요. 내일 다시 쓰겠습니다.",
          next: "alone",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "alone",
      intro: [
        "생각했습니다. 산에서 한 시간 탔고, 그 한 시간 동안 그것만 생각했습니다.",
        "저는 혼자 타는 게 편합니다. 편한 게 좋은 건지는 아직 모르겠습니다.",
        "오늘은 그 애가 옆에 붙었는데 페이스를 안 늦췄습니다. 처음입니다.",
        "…그 애가 끝까지 따라왔습니다. 그것도 처음입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 둘 다 잘한 거예요",
          reply: "…둘 다요. 그렇게 세는 방법도 있군요. 기록해두겠습니다.",
          next: null,
          effect: { mental: 8, skills: { sociability: 25, fitness: 12 } },
        },
        {
          tone: "cool",
          me: "안 늦춘 게 배려예요. 늦추는 게 배려인 줄 알았죠",
          reply: "…네. 그렇게 알고 있었습니다. 오래된 착각이었군요.",
          next: null,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다음엔 말도 걸어보세요. 기어 올리는 걸로는 안 들려요",
          reply: "…기어로는 안 들린다. 그건 반박을 못 하겠습니다.",
          next: null,
          effect: { mental: -3, skills: { knowledge: 15, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 조용한 신입 2회차 — 물통.
 * 축은 **'옆에 있어 주는 것'**이다. 그는 어떻게 해야 하는지를 모르는 게 아니라, 그게 자기 일인지를 모른다.
 * ⚠️ 동기(charge_rookie)의 회차 진행을 전제하지 마라 — 같은 사건을 각자 자기 각도에서만 말한다.
 */
const QUIET_STORY_2: DmStory = {
  id: "quiet_2",
  partnerName: "조용한 신입",
  partnerHandle: "quiet_rookie",
  arrivalTitle: "조용한 신입의 DM",
  startNode: "he_fell",
  nodes: [
    {
      id: "he_fell",
      intro: [
        "오늘 그 시끄러운 동기가 언덕에서 뻗었습니다.",
        "초반에 다 써버렸습니다. 늘 그럽니다. 오늘은 좀 심했습니다.",
        "선배들은 앞에 있었고, 뒤에는 저뿐이었습니다.",
        "…저는 그냥 옆에 서 있었습니다. 어떻게 했어야 합니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "옆에 서 있었으면 된 거예요. 그게 제일 어려운 거고요",
          reply: "…그게 어려운 겁니까. 저는 아무것도 안 한 줄 알았습니다.",
          next: "the_water",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "물통 주세요. 말은 안 해도 되니까 그것만요",
          reply: "…물통. 그건 할 수 있습니다. 내일 해보겠습니다.",
          next: "the_water",
          delayDays: 1,
          effect: { skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "서 있기만 한 건 안 도운 거예요. 본인도 알잖아요",
          reply: "…압니다. 알아서 지금 이걸 쓰고 있는 겁니다.",
          next: "the_water",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 28 } },
        },
      ],
    },
    {
      id: "the_water",
      intro: [
        "결국 제 물통을 줬습니다. 그 애가 자기 것인 줄 알고 마시더군요. 두 번째입니다.",
        "다 마시고 나서야 알아채고 사과를 했습니다. 사과도 시끄러웠습니다.",
        "그러고는 저한테 물었습니다. '너 원래 이런 애였냐?'",
        "…저는 원래 어떤 애였습니까. 그건 저도 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "원래 그런 애였고, 이제 티가 난 거예요",
          reply: "…티가 났다. 그건 좀 곤란한데요. 나쁘진 않습니다.",
          next: "three_lines",
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "물통 두 개 들고 다니세요. 그게 답이에요",
          reply: "…두 개. 실용적이군요. 오늘 하나 더 샀습니다.",
          next: "three_lines",
          effect: { skills: { knowledge: 25, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "그 애는 답을 안 기다렸을걸요. 당신만 사흘 생각하는 거예요",
          reply: "…사흘까진 아닙니다. 이틀입니다. 그건 정정하겠습니다.",
          next: "three_lines",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "three_lines",
      intro: [
        "오늘 그 애한테 먼저 말을 걸었습니다. 세 문장 했습니다.",
        "'초반에 다 쓰지 마라. 언덕은 세 번째가 제일 길다. 내 뒤에 붙어라.'",
        "그 애가 그걸 수첩에 받아 적었습니다. 진짜로 적었습니다.",
        "…제가 한 말을 누가 적는 건 처음 봤습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 문장이면 충분해요. 그거 다 필요한 말이었어요",
          reply: "…필요한 말만 했습니다. 그건 제가 잘하는 겁니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "세 번째 문장이 진짜 하고 싶은 말이었죠",
          reply: "…앞의 둘은 핑계였습니다. 들킬 줄은 몰랐습니다.",
          next: null,
          effect: { skills: { knowledge: 35, sociability: 15 } },
        },
        {
          tone: "bold",
          me: "수첩에 적힐 말을 하는 사람이 됐네요. 이제 못 돌아가요",
          reply: "…돌아갈 생각은 없습니다. 다만 부담스럽긴 합니다.",
          next: null,
          effect: { mental: -4, followers: 150, skills: { knowledge: 25, fitness: 20 } },
        },
      ],
    },
  ],
};

/**
 * 조용한 신입 3회차 — 첫 합동 레이스.
 * 그가 처음으로 **소리를 낸다**. 단 한 번, 한 단어다. 그 이상 지르게 만들지 마라 —
 * 이 캐릭터의 클라이맥스는 음량이 아니라 "냈다"는 사실이다.
 */
const QUIET_STORY_3: DmStory = {
  id: "quiet_3",
  partnerName: "조용한 신입",
  partnerHandle: "quiet_rookie",
  arrivalTitle: "조용한 신입의 DM",
  startNode: "race_pair",
  nodes: [
    {
      id: "race_pair",
      intro: [
        "다음 주 레이스에 1학년 둘이 들어갑니다. 저와 그 애입니다.",
        "제가 산악 구간을 맡습니다. 그 애는 평지에서 끌기로 했습니다.",
        "감독이 저한테 '네가 판단해라'고 했습니다. 그 말이 계속 걸립니다.",
        "…저는 제 판단만 해왔습니다. 남의 것까지 하는 건 다릅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "판단은 이미 하고 있었어요. 페이스 늦춘 거 그거예요",
          reply: "…그게 판단이었습니까. 그럼 저는 계속 해오고 있었던 거군요.",
          next: "the_shout",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 20, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "산에서는 당신이 제일 잘 알아요. 그건 그냥 사실이에요",
          reply: "…사실이라고 해주시니 정리가 됩니다. 다녀와서 쓰겠습니다.",
          next: "the_shout",
          delayDays: 1,
          effect: { skills: { knowledge: 25, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "판단이 틀리면 그 애가 뻗어요. 그거 감당할 수 있어요?",
          reply: "…감당. 그 단어는 처음 씁니다. 그래도 가야죠.",
          next: "the_shout",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_shout",
      intro: [
        "끝났습니다. 3위입니다. 1학년 조로는 처음이라더군요.",
        "마지막 언덕에서 그 애가 뒤처지길래 제가 소리를 냈습니다.",
        "'붙어.' 한 단어입니다. 제 목소리가 그렇게 큰 줄 몰랐습니다.",
        "…산이 시끄러웠습니다. 이번엔 제가 시끄러웠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 한 단어가 오늘 제일 잘한 거예요",
          reply: "…한 단어가요. 효율은 좋았습니다. 그건 인정하겠습니다.",
          next: "after_race",
          effect: { mental: 12, skills: { sociability: 30, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "그 애가 매일 지른 이유를 이제 알겠죠",
          reply: "…알겠습니다. 힘이 납니다. 증명은 저도 못 하겠습니다.",
          next: "after_race",
          effect: { skills: { knowledge: 35, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "다음엔 두 단어 해봐요. 늘어나는 재미가 있어요",
          reply: "…두 단어. 목표로는 좀 작지 않습니까. 뭐, 해보겠습니다.",
          next: "after_race",
          effect: { mental: 6, skills: { knowledge: 25, sociability: 25 } },
        },
      ],
    },
    {
      id: "after_race",
      intro: [
        "레이스 끝나고 그 애가 제 옆에 앉아서 30분을 떠들었습니다.",
        "저는 두 번 대답했습니다. 예전 같으면 한 번이었을 겁니다.",
        "산에 들어가면 머릿속이 조용해져서 좋았습니다. 그건 지금도 그렇습니다.",
        "…그런데 요즘은 시끄러운 것도 좀 괜찮습니다. 이유는 아직 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이유는 몰라도 돼요. 괜찮으면 된 거예요",
          reply: "…몰라도 된다. 그 말은 처음 듣습니다. 편하네요.",
          next: null,
          effect: {
            mental: 15,
            followers: 250,
            skills: { sociability: 35, fitness: 15, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "혼자가 편한 것과 좋은 것, 이제 답 나왔네요",
          reply: "…나왔습니다. 편한 건 편한 거고, 좋은 건 따로 있었습니다.",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "이제 계정에 코멘트도 좀 다세요. 숫자만 올리지 말고요",
          reply: "…생각해보겠습니다. 한 줄이면 될 것 같기도 합니다.",
          next: null,
          effect: {
            mental: 8,
            followers: 300,
            skills: { sociability: 25, creativity: 15, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 돌격 1학년 — 목소리 크고 초반에 다 써버리는 1학년(`data/accounts.ts` charge_rookie).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(핸들이 달라 히메히메·동생과 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'조용하면 티가 안 나니까'**다. 시끄러움은 성격이 아니라 **무서움의 반대말**이다.
 * 자전거를 산 지 얼마 안 됐고, 그래서 티라도 내야 한다 — 본인은 3회차에서야 그걸 말로 꺼낸다.
 *
 * ⚠️ 말투는 **느낌표 두 개짜리 존댓말**이다("~요!!", "~습니다!!"). 조용해지는 회차를 쓰더라도
 *    문장 부호까지 조용해지게 만들지 마라 — 그는 조용히 타는 법을 배우는 것이지 조용한 애가 되지 않는다.
 * ⚠️ 그를 **한심하게 그리지 마라.** 초반에 다 쓰는 건 계산을 못 해서가 아니라 뒤에 있는 게 싫어서다.
 * 줄기: 1회차 왜 시끄러운가 → 2회차 받아 적은 세 문장 → 3회차 선배 이름 옆에 서기.
 */
export const CHARGE_STORY: DmStory = {
  id: "charge_1",
  partnerName: "돌격 1학년",
  partnerHandle: "charge_rookie",
  arrivalTitle: "돌격 1학년의 DM",
  startNode: "loud_dm",
  nodes: [
    {
      id: "loud_dm",
      intro: [
        "좋아요 감사합니다!! 저 좋아요 눌러주신 분께 다 DM 보냅니다!!",
        "아직 네 분째지만요! 네 분이면 많은 거죠?!",
        "제 글 시끄럽죠? 다들 그래요. 근데 조용하면 티가 안 나잖아요!",
        "…어? 방금 이거 좀 창피한 얘기 같은데요. 쓰고 나서 알았어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "창피한 얘기 아니에요. 솔직한 거지",
          reply: "솔직!! 그거 좋은 말이네요!! 오늘부터 저 솔직한 사람 하겠습니다!!",
          next: "three_minutes",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "티를 왜 내야 하는데요?",
          reply: "그거야… 어? 왜 내야 하죠? 잠깐만요, 내일 답할게요!! 진짜 모르겠어요!!",
          next: "three_minutes",
          delayDays: 1,
          effect: { skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "네 명한테 다 보냈으면 그거 홍보 아니에요? 좀 뻔뻔한데요",
          reply: "뻔뻔?! 아 그런가요?! 근데 안 하면 아무도 몰라주는데요!! …내일 다시 올게요",
          next: "three_minutes",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 15, sociability: 10 } },
        },
      ],
    },
    {
      id: "three_minutes",
      intro: [
        "저 오늘 그 3학년 스프린터 선배 등에 3분 붙어 있었습니다!! 신기록이에요!!",
        "…근데 3분이요. 선배들은 세 시간을 타요. 3분이랑 세 시간이요.",
        "다들 잘했다고 해주는데, 잘했다는 말이 왜 이렇게 짧게 느껴지죠?",
        "아 이런 말 하려던 거 아닌데!! 오늘 좀 이상하네요 저!!",
      ],
      choices: [
        {
          tone: "friendly",
          me: "3분은 지난달엔 0분이었잖아요",
          reply: "…어. 그러네요?! 지난달엔 30초였어요!! 여섯 배네요!! 여섯 배!!",
          next: "why_i_shout",
          effect: { mental: 8, skills: { sociability: 20, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "3분을 붙었으면 어디서 떨어졌는지도 알겠네요",
          reply: "…알아요. 언덕 들어가자마자요. 매번 거기예요. 매번이요.",
          next: "why_i_shout",
          effect: { skills: { knowledge: 25, fitness: 12 } },
        },
        {
          tone: "bold",
          me: "짧게 느껴지는 게 맞아요. 짧으니까요",
          reply: "…아 진짜 하나도 안 봐주시네요!! 근데 그래서 좀 시원해요. 이상하죠!!",
          next: "why_i_shout",
          effect: { mental: -4, skills: { knowledge: 28 } },
        },
      ],
    },
    {
      id: "why_i_shout",
      intro: [
        "아까 물어보신 거 답할게요. 왜 티를 내야 하냐고요.",
        "저 자전거 산 지 여덟 달 됐어요. 다들 초등학교 때부터 탔대요.",
        "조용히 있으면요, 제가 여기 있는지 아무도 모를 것 같아요. 진짜로요.",
        "그래서 소리를 질러요. 지르면 무서운 게 좀 없어져요. …이건 처음 말해요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "여덟 달 만에 3분이면 무서워할 사람은 선배들이에요",
          reply: "선배들이요?! 아 그건 생각 못 했는데!! 오늘 잠 잘 오겠는데요!!",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "소리 안 질러도 언덕에서 안 떨어지면 다 알아요",
          reply: "…그쪽이 정석이죠. 아는데요, 그게 제일 어려워서요.",
          next: null,
          effect: { skills: { knowledge: 35, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "여덟 달 얘기를 계정에 올려요. 그게 제일 센 얘기예요",
          reply: "…그건 좀 무서운데요. 근데 무서운 건 지르면 된다고 제가 방금 말했죠?!",
          next: null,
          effect: { mental: -3, followers: 200, skills: { sociability: 25, creativity: 15 } },
        },
      ],
    },
  ],
};

/**
 * 돌격 1학년 2회차 — 수첩에 적은 세 문장.
 * 축은 **'아껴 쓰는 법'**이다. 그는 페이스 배분을 못 하는 게 아니라 뒤에 있는 걸 못 견딘다.
 * ⚠️ 동기(quiet_rookie)의 회차 진행을 전제하지 마라 — 같은 사건을 각자 자기 각도에서만 말한다.
 */
const CHARGE_STORY_2: DmStory = {
  id: "charge_2",
  partnerName: "돌격 1학년",
  partnerHandle: "charge_rookie",
  arrivalTitle: "돌격 1학년의 DM",
  startNode: "the_notebook_line",
  nodes: [
    {
      id: "the_notebook_line",
      intro: [
        "사건입니다!! 그 조용한 동기가 저한테 먼저 말을 걸었어요!!",
        "세 문장이나 했어요!! 세 문장이요!! 제가 다 받아 적었습니다!!",
        "'초반에 다 쓰지 마라. 언덕은 세 번째가 제일 길다. 내 뒤에 붙어라.'",
        "…근데요, 저 뒤에 붙는 거 진짜 싫어하거든요. 어떡하죠?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "싫어도 한 번만 해봐요. 딱 한 번",
          reply: "한 번이요… 한 번은 해볼 수 있죠! 내일 해보고 보고할게요!!",
          next: "the_test",
          delayDays: 1,
          effect: { mental: 4, skills: { sociability: 18 } },
        },
        {
          tone: "cool",
          me: "뒤에 붙는 게 왜 싫은데요?",
          reply: "지는 것 같아서요! …어, 근데 훈련인데 지는 게 어디 있죠? 내일 생각해볼게요",
          next: "the_test",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "말 없는 애가 세 문장 썼으면 그건 명령이에요",
          reply: "…아 그렇게 들으니까 좀 무섭네요. 알겠습니다!! 시키는 대로 해보겠습니다!!",
          next: "the_test",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 20, fitness: 12 } },
        },
      ],
    },
    {
      id: "the_test",
      intro: [
        "했습니다. 시키는 대로 했어요. 초반에 안 쓰고 뒤에 붙었어요.",
        "진짜 답답해 죽는 줄 알았어요. 앞이 안 보이고 등만 보이고요.",
        "근데요… 세 번째 언덕 꼭대기까지 갔어요. 처음으로요.",
        "거기서 다리가 남아 있었어요. 남아 있는 게 뭔지 처음 알았어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 페이스 배분이에요. 오늘 배운 거예요",
          reply: "이게 그거였어요?! 다들 말로만 해서 뭔 소린지 몰랐는데!! 아 이제 알겠어요!!",
          next: "who_i_am",
          effect: { mental: 10, skills: { fitness: 30, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "남은 다리로 뭐 했어요? 거기서 안 썼으면 아낀 게 아니라 버린 거예요",
          reply: "…아. 안 썼어요. 남은 게 신기해서 구경만 했어요. 아 아까워라!!",
          next: "who_i_am",
          effect: { skills: { knowledge: 35, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "답답한 게 정상이에요. 그거 참는 게 훈련이고요",
          reply: "참는 것도 훈련이라니… 그런 훈련은 아무도 안 알려줬는데요!!",
          next: "who_i_am",
          effect: { mental: -4, skills: { fitness: 25, knowledge: 20 } },
        },
      ],
    },
    {
      id: "who_i_am",
      intro: [
        "그런데 오늘 좀 이상했어요. 조용히 탔더니 아무도 저를 안 봤어요.",
        "잘 탔는데요, 잘 탄 걸 아무도 모르더라구요.",
        "예전엔 소리 지르면 다들 웃으면서 봤거든요. 못 타도요.",
        "…조용히 잘하는 거랑 시끄럽게 못하는 거, 어느 쪽이 저예요?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘 다 당신이에요. 순서만 바꾸면 돼요",
          reply: "순서요…? 아 조용히 타고 나서 지르면 되는 거예요?! 그건 할 수 있어요!!",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "본 사람 있어요. 세 문장 써준 그 애요",
          reply: "…아. 걔가 봤겠네요. 걔는 늘 보고 있으니까요. 아 이거 왜 기분이 좋죠",
          next: null,
          effect: { mental: 10, skills: { knowledge: 35, sociability: 20 } },
        },
        {
          tone: "bold",
          me: "봐주는 사람 없으면 안 할 거예요? 그럼 그게 훈련이에요, 공연이에요?",
          reply: "…공연이래. 아 진짜 아프네요 그 말. 내일부터 조용히 탈게요. 진짜로요.",
          next: null,
          effect: { mental: -6, followers: 150, skills: { fitness: 30, knowledge: 25 } },
        },
      ],
    },
  ],
};

/**
 * 돌격 1학년 3회차 — 이름 옆에 이름.
 * 그의 소원("선배 이름 옆에 제 이름도 같이 불렸으면")이 이루어지는 회차다.
 * ⚠️ 그를 갑자기 에이스로 만들지 마라. 그는 **끌어주는 역할**로 이름이 불린다 — 마지막 1km는
 *    여전히 남의 몫이고, 그걸 분해하지 않는 게 이 회차의 성장이다.
 */
const CHARGE_STORY_3: DmStory = {
  id: "charge_3",
  partnerName: "돌격 1학년",
  partnerHandle: "charge_rookie",
  arrivalTitle: "돌격 1학년의 DM",
  startNode: "the_lineup",
  nodes: [
    {
      id: "the_lineup",
      intro: [
        "명단 나왔어요!! 저 들어갔어요!! 1학년인데 들어갔어요!!",
        "…근데 제 역할이 '끌기'예요. 앞에서 바람 맞는 거요.",
        "마지막 1km는 그 스프린터 선배가 해요. 저는 거기까지만 끌고 빠져요.",
        "빠지는 게 제 일이래요. 이게 맞는 건가요? 저 앞으로 나가는 사람인데요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "끌기는 제일 앞에 서는 사람이에요. 딱 당신이잖아요",
          reply: "…어?! 그러네요?! 제일 앞이네요?! 아 저 왜 이걸 지금 알았죠!!",
          next: "the_pull",
          delayDays: 1,
          effect: { mental: 10, skills: { sociability: 20, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "빠지는 게 일이면, 언제 빠지느냐가 실력이에요",
          reply: "언제 빠지냐… 그건 생각 안 해봤어요. 오늘 밤에 세어볼게요!",
          next: "the_pull",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "8개월 탄 1학년한테 끌기를 맡긴 거예요. 그게 무슨 뜻인지 몰라요?",
          reply: "…아. 그 말 들으니까 손이 떨리는데요. 좋은 떨림인 걸로 할게요!!",
          next: "the_pull",
          delayDays: 1,
          effect: { mental: -4, skills: { fitness: 25, knowledge: 15 } },
        },
      ],
    },
    {
      id: "the_pull",
      intro: [
        "했어요!! 마지막 1km까지 끌고 빠졌어요!!",
        "빠질 때 선배가 제 등을 딱 한 번 쳤어요. 아무 말도 안 했는데 알겠더라구요.",
        "그리고 저는 뒤로 밀려나면서 선배가 웃으면서 밟는 걸 봤어요. 뒤에서요.",
        "…뒤에서 보는 게 이렇게 좋은 건지 몰랐어요. 저 뒤 진짜 싫어했는데요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 등 친 거, 고맙다는 말이에요",
          reply: "고맙다요…? 아 그럼 저 오늘 고맙다는 말 들은 거네요!! 처음이에요!!",
          next: "two_names",
          effect: { mental: 15, skills: { sociability: 30, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "앞에서 바람 다 맞은 사람만 그 장면을 봐요",
          reply: "…맞네요. 뒤에 계속 있었으면 못 봤겠네요. 아 이거 좀 멋있는데요",
          next: "two_names",
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그럼 다음엔 안 빠지는 사람이 되세요",
          reply: "…네. 그럴 거예요. 근데 오늘은 빠진 게 제일 잘한 거예요. 그건 확실해요",
          next: "two_names",
          effect: { mental: 5, skills: { fitness: 35, knowledge: 20 } },
        },
      ],
    },
    {
      id: "two_names",
      intro: [
        "결과 방송에서요, 선배 이름 부르고 나서 제 이름도 불렀어요.",
        "'마지막까지 끌어준' 어쩌고 하면서요. 제 이름이 선배 이름 뒤에 붙어서 나왔어요.",
        "저 그거 들으려고 여덟 달 탔거든요. 아니 여덟 달 반이요. 정확히요.",
        "…근데 막상 들으니까 소리가 안 나오더라구요. 저 소리 지르는 사람인데요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "소리 안 나오는 것도 가끔 있어야죠. 축하해요",
          reply: "감사합니다!! 아 지금은 나오네요!! 지금 지르고 있어요!!",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 20 },
          },
        },
        {
          tone: "cool",
          me: "이제 티 안 내도 사람들이 알아요. 그게 여덟 달 반의 결과예요",
          reply: "…티 안 내도 된다니. 그거 좀 허전한데요. 좋은데 허전해요. 이상하죠",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "다음엔 당신 이름이 앞에 나와야죠. 뒤에 붙는 걸로 만족해요?",
          reply: "안 하죠!! 당연히 안 하죠!! 아 좋다 오늘. 내일부터 또 지를게요!!",
          next: null,
          effect: {
            mental: 10,
            followers: 350,
            skills: { fitness: 35, sociability: 20, knowledge: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 츤 에이스 — "붙어올 거면 조용히 붙어와"라는 에이스(`data/accounts.ts` tsun_rider).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 칭찬받는 걸 제일 싫어하는 인간이 칭찬을 받은 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'1년'**이다. 그는 1학년 때 자전거를 1년 통째로 놨고, 트윗에서 "그 얘긴 여기까지"로
 * 끊는다. 왜 놨는지와 왜 돌아왔는지가 2회차에 나온다.
 *
 * ⚠️ 말투는 **짧고 퉁명한 반말 + 명령형**이다("~라/~냐/~다"). 뱀눈 탈환사(snake_eye_get)도 반말이지만
 *    그쪽은 능글맞게 길다 — 이쪽은 **끊어서 짧게** 쓴다. 물·밥·잠 잔소리가 이 인물의 애정 표현이다.
 * ⚠️ 그를 **다정하게 만들지 마라.** 마지막까지 고맙다는 말을 하지 않는다. 대신 행동으로 갚는다.
 * ⚠️ 짝꿍(smile_sprint)의 회차 진행을 전제하지 마라 — 그를 "그 덩치"·"짝꿍"으로만 부른다.
 * 줄기: 1회차 칭찬 사절(과 물 챙기라는 잔소리) → 2회차 놨던 1년 → 3회차 졸업 후.
 */
export const TSUN_STORY: DmStory = {
  id: "tsun_1",
  partnerName: "츤 에이스",
  partnerHandle: "tsun_rider",
  arrivalTitle: "츤 에이스의 DM",
  startNode: "no_praise",
  nodes: [
    {
      id: "no_praise",
      intro: [
        "좋아요 눌렀더라. 칭찬해달라고 쓴 글 아니다",
        "…이 말 하려고 DM 보낸 건 아닌데 첫 줄이 이렇게 나갔다",
        "됐다. 용건은 이거다. 내 글 보고 자전거 시작할 거면 헬멧부터 사라",
        "그거 안 사고 타다 죽은 놈 얘기를 두 번 들었다. 그래서 하는 말이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 걱정해주는 거죠?",
          reply: "…걱정 아니다. 실어 나르기 싫어서 하는 말이다",
          next: "the_pack",
          effect: { mental: 4, skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "칭찬 아니었어요. 그냥 맞는 말 같아서 눌렀어요",
          reply: "…맞는 말이라. 그건 인정해주지. 눌러도 된다",
          next: "the_pack",
          effect: { skills: { knowledge: 18 } },
        },
        {
          tone: "bold",
          me: "첫 줄부터 변명이던데요. 칭찬 기다린 사람 같은데",
          reply: "…뭐? 아니다. 아니라고. 다음 얘기나 하자",
          next: "the_pack",
          effect: { mental: -2, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_pack",
      intro: [
        "요즘 1학년 둘이 시끄럽다. 하나는 소리를 지르고 하나는 입을 안 연다",
        "둘 다 자기가 잘하는 줄 안다. 반은 맞고 반은 틀렸다",
        "말해줄까 하다가 안 했다. 내가 말하면 겁부터 먹는다",
        "…그래서 모르는 놈한테 물어본다. 이런 건 어떻게 해야 하냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "겁먹어도 말해주세요. 나중에 알면 더 손해예요",
          reply: "…손해라. 그건 그렇지. 하룻밤 생각해보고 말한다",
          next: "the_water_lecture",
          delayDays: 1,
          effect: { morality: 5, skills: { sociability: 18 } },
        },
        {
          tone: "cool",
          me: "말고 그냥 뒤에 붙여요. 붙어보면 알아서 알아요",
          reply: "…붙여라. 그 방법이 있었네. 내일 훈련 때 해보고 답하마",
          next: "the_water_lecture",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "겁먹게 만든 건 본인이잖아요. 그건 본인 문제고요",
          reply: "…맞는 말만 골라 하네. 하루 생각해보고 다시 쓴다",
          next: "the_water_lecture",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 28 } },
        },
      ],
    },
    {
      id: "the_water_lecture",
      intro: [
        "어제 그 둘을 내 뒤에 붙였다. 30km 끌었다",
        "소리 지르는 놈은 20km에서 죽었고, 입 안 여는 놈은 끝까지 붙었다",
        "끝나고 둘 다한테 똑같이 말했다. '물 챙기고 밥 먹고 자라'",
        "…그 말밖에 할 줄 모른다. 다른 말은 입에서 안 나온다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거면 충분해요. 셋 다 지켜야 하는 거잖아요",
          reply: "…그렇지. 셋 다 못 지키면 다 무너진다. 아는 놈이랑 얘기하니 편하다",
          next: null,
          effect: { mental: 8, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "30km 끌어준 게 말이었어요. 말은 안 해도 됐어요",
          reply: "…그런가. 다리로 말했다고 치자. 그럼 나는 말 많은 놈이네",
          next: null,
          effect: { skills: { knowledge: 30, fitness: 12 } },
        },
        {
          tone: "bold",
          me: "칭찬 한마디를 그렇게 못 해요? 그것도 훈련이에요",
          reply: "…시끄럽다. 다음에. 다음에 해보겠다",
          next: null,
          effect: { mental: -3, skills: { knowledge: 25, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 츤 에이스 2회차 — 놨던 1년.
 * 축은 **'혼자 이긴 우승'**이다. 그는 1학년 때 혼자 치고 나가 이겼고, 아무도 기뻐하지 않았다.
 * ⚠️ 그를 울리지 마라. 이 회차에서도 그는 사과하지 않는다 — 다만 그때 뭘 몰랐는지를 말할 뿐이다.
 */
const TSUN_STORY_2: DmStory = {
  id: "tsun_2",
  partnerName: "츤 에이스",
  partnerHandle: "tsun_rider",
  arrivalTitle: "츤 에이스의 DM",
  startNode: "that_year",
  nodes: [
    {
      id: "that_year",
      intro: [
        "전에 1년 그만뒀다고 쓴 적 있다. 그 얘기 여기까지라고도 썼고",
        "…오늘은 그 뒤를 쓴다. 왜 쓰는지는 나도 모른다",
        "1학년 여름에 혼자 치고 나가서 이겼다. 팀은 뒤에서 다 갈렸다",
        "결승선 넘고 뒤를 봤는데 아무도 없었다. 아무도 안 왔다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그때 축하해준 사람이 한 명도 없었어요?",
          reply: "…감독이 잘했다고 했다. 그게 다다. 애들은 나를 안 봤다",
          next: "why_i_came_back",
          delayDays: 1,
          effect: { mental: -3, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "이긴 건 맞잖아요. 이긴 게 왜 문제였는데요",
          reply: "…그걸 아는 데 2년 걸렸다. 하루 줘라. 정리해서 쓴다",
          next: "why_i_came_back",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "혼자 이겼으니까 혼자 남은 거죠",
          reply: "…한 줄로 정리해버리네. 부정은 안 한다. 내일 마저 쓴다",
          next: "why_i_came_back",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "why_i_came_back",
      intro: [
        "1년을 놨다. 자전거를 창고에 넣고 열쇠까지 잠갔다",
        "돌아온 이유는 별거 아니다. 그 덩치가 우리 집 앞에 왔다",
        "말도 없이 자전거 두 대 끌고 와서 한 시간 서 있었다. 비 오는 날에",
        "…문 열고 나가서 탔다. 그날 이후로 안 쉬었다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 사람한테 고맙다고 한 적 있어요?",
          reply: "…없다. 하면 다음부터 안 올 것 같아서 안 했다",
          next: "what_i_learned",
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "한 시간 서 있었으면 말은 필요 없었네요",
          reply: "…그놈은 원래 말이 느리다. 그날은 그게 다행이었다",
          next: "what_i_learned",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "비 맞고 서 있는 사람 한 시간이나 세워뒀네요",
          reply: "…그 얘긴 하지 마라. 그거 아직도 걸린다",
          next: "what_i_learned",
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_learned",
      intro: [
        "혼자 잘해봤자 레이스는 못 이긴다. 인정하는 데 2년 걸렸다",
        "지금도 앞에서 끄는 건 짜증난다. 편해 보이냐? 앞에 서보면 안다",
        "그래도 선다. 뒤에 누가 붙어 있으면 이상하게 덜 힘들다",
        "…이런 걸 왜 모르는 놈한테 쓰고 있냐. 오늘은 여기까지다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "모르는 사람이라 쓴 거예요. 팀엔 못 쓰잖아요",
          reply: "…그렇지. 팀한테 쓰면 그놈들이 나를 다르게 본다. 그건 싫다",
          next: null,
          effect: { mental: 12, skills: { sociability: 35, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "덜 힘든 게 아니라 안 지고 싶은 거예요. 보는 눈이 있으니까",
          reply: "…그것도 맞다. 둘 다인 걸로 하자. 편한 쪽으로 우기지는 않겠다",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "2년 걸렸다면서요. 그럼 1학년 둘한텐 2년 아껴줘요",
          reply: "…아껴주라. 그건 생각 못 했다. 그건 내가 할 수 있겠네",
          next: null,
          effect: { mental: 8, morality: 8, followers: 200, skills: { sociability: 25 } },
        },
      ],
    },
  ],
};

/**
 * 츤 에이스 3회차 — 레이스 끝나고 생각할 것.
 * 짝꿍이 먼저 끝나고, 그는 계속 탄다. 축은 **"쫓아올 거면 끝까지 쫓아와라"**를
 * 그가 처음으로 **자기한테** 적용하는 것이다.
 * ⚠️ 진로를 구체적인 실업팀·회사명으로 확정하지 마라(패러디 세계관에 없는 고유명이 생긴다).
 */
const TSUN_STORY_3: DmStory = {
  id: "tsun_3",
  partnerName: "츤 에이스",
  partnerHandle: "tsun_rider",
  arrivalTitle: "츤 에이스의 DM",
  startNode: "he_is_done",
  nodes: [
    {
      id: "he_is_done",
      intro: [
        "짝꿍이 이번 여름으로 끝난다. 무릎이 다 됐다더라",
        "본인은 웃으면서 말한다. 늘 그렇지. 그게 제일 짜증난다",
        "3년을 그놈 뒤에서 끌었다. 마지막 1km는 늘 그놈 몫이었고",
        "…이제 그 1km를 누가 하냐. 그 얘기다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "당신이 하면 되잖아요",
          reply: "…내가? 나는 끄는 놈이다. 그건 다르다. …다른가?",
          next: "the_answer",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "3년 끌었으면 그 1km도 이미 아는 거예요",
          reply: "…안다고 되냐. 뭐, 하루 생각해보마",
          next: "the_answer",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "짜증나는 건 그 사람이 웃어서가 아니라 먼저 끝나서죠",
          reply: "…시끄럽다. …맞다. 내일 답한다",
          next: "the_answer",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_answer",
      intro: [
        "어제 그놈이랑 둘이서 언덕 두 개 돌았다. 천천히 갔다",
        "그놈이 그러더라. '마지막은 네가 해라. 원래 네가 더 잘했다'",
        "3년 동안 한 번도 그런 말 한 적 없다. 오늘 하는 게 반칙이다",
        "…나는 아무 말도 못 했다. 그냥 기어만 하나 올렸다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기어 올린 게 대답이에요. 그 사람도 알아들었을걸요",
          reply: "…알아들었겠지. 그놈은 그런 건 잘 안다",
          next: "keep_up",
          effect: { mental: 12, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "원래 잘했다는 말, 3년 아껴둔 거예요. 지금 줘야 할 것 같아서",
          reply: "…아껴뒀다라. 그렇게 들으니 반칙도 아니네. 젠장",
          next: "keep_up",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "고맙다고 한마디 하세요. 그거 안 하면 평생 걸려요",
          reply: "…안 한다. 대신 이번 레이스 이기면 된다. 그게 내 방식이다",
          next: "keep_up",
          effect: { mental: -4, skills: { fitness: 30, knowledge: 20 } },
        },
      ],
    },
    {
      id: "keep_up",
      intro: [
        "졸업하고 뭐 할 거냐고 다들 묻는다. 레이스 끝나고 생각한다고 답했다",
        "…거짓말이다. 벌써 정했다. 계속 탄다. 어디서든 탄다",
        "1학년 둘한테는 아직 말 안 했다. 말하면 걔들이 이상하게 열심히 한다",
        "너한테는 말해둔다. 어차피 모르는 놈이니까 부담 없다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "잘 정했어요. 응원할게요",
          reply: "…응원 필요 없다. 하지만 안 하지는 마라. 이건 무슨 말이냐 나도 모르겠다",
          next: null,
          effect: {
            mental: 15,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "모르는 사람한테만 말하는 거, 그거 버릇 되겠는데요",
          reply: "…이미 버릇이다. 고칠 생각도 없다. 편하니까",
          next: null,
          effect: { mental: 8, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그럼 나도 쫓아갈게요. 중간에 포기하면 우스워진댔죠",
          reply: "…내 말을 나한테 돌려주네. 그럼 끝까지 쫓아와라. 봐주지 않는다",
          next: null,
          effect: {
            mental: 10,
            followers: 400,
            skills: { fitness: 30, sociability: 25, knowledge: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 앞머리가 생명 — 거울 앞 3분도 훈련이라는 3학년 클라이머(`data/accounts.ts` front_hair_king).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 안목 있는 사람을 그가 그냥 지나칠 리 없다.
 *
 * 이 스토리의 축은 **'표정'**이다. "언덕에서 표정이 무너지면 진 거다"로 3년을 탔는데,
 * 표정을 놓친 날 제일 빨랐다는 사진 한 장이 그 전제를 깬다.
 *
 * ⚠️ 말투는 **자신만만한 반말**이다("~다/~지/~군"). 자아도취는 끝까지 유지하되, **비하 개그로 쓰지 마라** —
 *    그는 진심으로 잘생김이 훈련이라고 믿는 인간이고, 그 믿음이 실제로 그를 3년 굴렸다.
 * ⚠️ 그를 **겸손하게 만들지 마라.** 3회차에서도 그는 자기가 멋있다고 생각한다. 바뀌는 건
 *    '무엇이 멋있는가'의 정의뿐이다.
 * ⚠️ 라이벌은 트윗에 있는 대로 **"그 초록머리"**로만 부른다(실명·작품명 금지).
 * 줄기: 1회차 표정을 놓친 사진 → 2회차 초록머리와 산 대결 → 3회차 마지막 시즌, 순위표에 없는 역할.
 */
export const HAIR_STORY: DmStory = {
  id: "hair_1",
  partnerName: "앞머리가 생명",
  partnerHandle: "front_hair_king",
  arrivalTitle: "앞머리가 생명의 DM",
  startNode: "angle_15",
  nodes: [
    {
      id: "angle_15",
      intro: [
        "좋아요를 눌렀더군. 안목이 있다. 그건 인정하지",
        "미리 말해두는데 사진 각도는 왼쪽 15도다. 이건 양보 못 한다",
        "…라고 쓰고 보니, 내가 왜 이걸 처음 보는 사람한테 설명하고 있지",
        "됐다. 물어볼 게 있어서 보낸 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어보세요. 각도 얘기는 나중에 더 듣고요",
          reply: "나중에 더 듣겠다라. 좋은 자세다. 마음에 들었다",
          next: "the_face",
          effect: { skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "15도면 왼쪽이 더 낫다는 뜻이잖아요",
          reply: "…뭐? 그걸 어떻게. 아니, 그런 건 아니다. 아마도",
          next: "the_face",
          effect: { mental: -2, skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "각도 얘기 말고 본론부터 하세요",
          reply: "성격 급하군. 좋다. 그럼 본론이다",
          next: "the_face",
          effect: { skills: { knowledge: 15 } },
        },
      ],
    },
    {
      id: "the_face",
      intro: [
        "나는 언덕에서 표정이 무너지면 진 거라고 생각한다. 기록보다 그게 먼저다",
        "웃기게 들리겠지. 진심이다. 3년을 그렇게 탔다",
        "그런데 지난주에 산에서 처음으로 표정을 놓쳤다. 하필 사진에 다 찍혔고",
        "…그 사진에서 내가 3년 중 제일 빨랐다. 이게 무슨 뜻이냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "표정에 쓰던 힘을 다리에 쓴 거예요",
          reply: "…다리에 썼다. 그렇게 정리하니 견딜 만하군. 하룻밤 생각해보겠다",
          next: "the_photo",
          delayDays: 1,
          effect: { skills: { fitness: 15, sociability: 10 } },
        },
        {
          tone: "cool",
          me: "3년 동안 힘을 얼굴에 쓰고 있었다는 뜻이죠",
          reply: "…말이 심한데 반박이 안 된다. 내일 답하지",
          next: "the_photo",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "그 사진 지웠죠?",
          reply: "…지웠다. 아니, 안 지웠다. 안 지운 게 문제라서 지금 이러고 있는 거다",
          next: "the_photo",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_photo",
      intro: [
        "밤새 그 사진을 봤다. 스무 번쯤 봤다",
        "머리는 엉망이고 입은 벌어져 있고 눈은 반쯤 감겼다. 최악이다",
        "…그런데 그게 3년 중 제일 잘 탄 나다. 그건 사실이다",
        "오늘 그걸 계정에 올릴까 하다가 말았다. 아직은 못 하겠더군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "언젠가 올리면 돼요. 오늘은 안 해도 되고요",
          reply: "…언젠가라. 그 정도 여유는 남겨두지. 고맙다는 말은 안 한다",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, beauty: 10 } },
        },
        {
          tone: "cool",
          me: "최악이라면서 스무 번 봤잖아요",
          reply: "…시끄럽다. 그건 연구다. 연구",
          next: null,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그거 올리면 지금보다 훨씬 멋있어요. 진짜로요",
          reply: "…진짜로? 그 말은 좀 위험한데. 오늘 잠 다 잤군",
          next: null,
          effect: { mental: -3, followers: 150, skills: { sociability: 20, beauty: 15 } },
        },
      ],
    },
  ],
};

/**
 * 앞머리가 생명 2회차 — 그 초록머리.
 * 축은 **'준비한 대사'**다. 그는 라이벌에게 할 말을 늘 준비해두는데, 정작 매번 못 쓴다.
 * ⚠️ 라이벌을 등장인물로 말하게 하지 마라 — 전언으로만 나온다(그의 계정은 이 게임에 없다).
 */
const HAIR_STORY_2: DmStory = {
  id: "hair_2",
  partnerName: "앞머리가 생명",
  partnerHandle: "front_hair_king",
  arrivalTitle: "앞머리가 생명의 DM",
  startNode: "the_rival",
  nodes: [
    {
      id: "the_rival",
      intro: [
        "라이벌 얘기는 트윗에서 늘 '여기까지'로 끊는다. 이유는 간단하다. 세 번 졌으니까",
        "그 초록머리는 산에서 노래를 부른다. 힘든데 노래가 나온다는 게 말이 되냐",
        "나는 대사를 준비한다. 정상에서 할 말을 미리 짜둔다는 뜻이다",
        "…이번 주말에 넷째 판이다. 대사는 이미 세 개 준비했고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 개나요? 하나만 쓸 거잖아요",
          reply: "상황별로 다르다. 이기면 A, 지면 B, 비기면 C. 준비성은 실력이다",
          next: "the_summit",
          delayDays: 1,
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "노래 부르는 쪽이 이겼잖아요. 세 번 다",
          reply: "…그 얘긴 안 했으면 좋겠는데. 뭐, 주말 지나고 다시 쓰지",
          next: "the_summit",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "대사 준비할 시간에 페달을 밟으세요",
          reply: "…그 말 하는 놈이 꼭 있더라. 좋다, 주말에 증명해 보이지",
          next: "the_summit",
          delayDays: 1,
          effect: { mental: -3, skills: { fitness: 25 } },
        },
      ],
    },
    {
      id: "the_summit",
      intro: [
        "졌다. 자전거 반 대 차이다. 이번엔 진짜 아깝다",
        "그런데 정상에서 그 녀석이 먼저 말을 걸었다. '오늘 표정 안 지켰네' 이러면서",
        "봤다는 거다. 3년 동안 내가 뭘 하고 있었는지 그 녀석은 다 보고 있었다는 거다",
        "…준비한 대사 세 개 다 못 썼다. 아무 말도 못 했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 사람은 당신을 제일 잘 보는 사람이네요",
          reply: "…그건 좀 소름 돋는 표현인데. 부정은 안 하겠다",
          next: "no_script",
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "표정 안 지키고 반 대 차이면, 지키고 탔으면 더 졌겠죠",
          reply: "…계산이 잔인하군. 맞는 계산이라 더 그렇다",
          next: "no_script",
          effect: { skills: { knowledge: 35, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "말문 막힌 게 오늘 제일 잘한 거예요",
          reply: "…뭐? 아무 말도 못 한 게 잘한 거라고? …설명해봐라. 아니, 됐다. 알 것 같다",
          next: "no_script",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "no_script",
      intro: [
        "내려오는 길에 그 녀석이 노래를 부르길래 나도 따라 불렀다. 가사는 몰랐다",
        "다음 주에 또 붙기로 했다. 이번엔 대사를 준비 안 할 생각이다",
        "준비를 안 하면 뭘 하냐고? …그냥 타면 되지 않겠나",
        "이런 걸 3년 만에 깨닫는 것도 재능이라면 재능이겠지",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그것도 재능 맞아요. 늦게 오는 재능이요",
          reply: "늦게 오는 재능이라. 그건 좀 멋있는 표현인데. 써먹겠다",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "가사도 모르면서 따라 부른 게 오늘의 답이에요",
          reply: "…그렇게 정리되나. 그럼 나는 오늘 답을 하나 얻은 거군",
          next: null,
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "다음 주엔 이겨요. 네 번은 좀 많아요",
          reply: "…네 번. 세는 걸 잊고 있었는데 다시 세게 하는군. 좋다, 이긴다",
          next: null,
          effect: { mental: -4, followers: 200, skills: { fitness: 30 } },
        },
      ],
    },
  ],
};

/**
 * 앞머리가 생명 3회차 — 순위표에 없는 역할.
 * 마지막 시즌. 그는 **정상 500m 앞에서 빠지는 역할**을 맡는다. 사진에도 순위표에도 안 남는 자리다.
 * ⚠️ 억지로 우승시키지 마라. 이 회차의 보상은 '기록표에 남는 것'이다(매니저 계정과 느슨하게 이어지되,
 *    stopwatch_manager의 회차 진행을 전제하지는 않는다).
 */
const HAIR_STORY_3: DmStory = {
  id: "hair_3",
  partnerName: "앞머리가 생명",
  partnerHandle: "front_hair_king",
  arrivalTitle: "앞머리가 생명의 DM",
  startNode: "the_role",
  nodes: [
    {
      id: "the_role",
      intro: [
        "인터하이 작전이 나왔다. 나는 산악 구간에서 에이스를 정상 500m 앞까지 끌고 빠진다",
        "빠진다는 건 카메라가 나를 안 찍는다는 뜻이다. 정상 사진에 나는 없다",
        "3년 동안 무대엔 주인공이 필요하다고 떠들었는데, 마지막 무대에서 내 역할이 이거다",
        "…납득은 했다. 납득했는데 왜 이렇게 쓰고 있냐고 묻지는 마라",
      ],
      choices: [
        {
          tone: "friendly",
          me: "500m 앞까지 끌 사람이 당신뿐이라 그런 거예요",
          reply: "…그건 사실이다. 우리 팀에 산에서 나만큼 타는 놈은 없다. 사실이지",
          next: "the_last_climb",
          delayDays: 1,
          effect: { mental: 8, skills: { sociability: 20, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "주인공 정의를 3년 만에 바꿔야 할 때가 온 거죠",
          reply: "…정의를 바꾸라. 말은 쉽다. 하룻밤 줘라",
          next: "the_last_climb",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "사진에 안 남는 게 그렇게 억울해요?",
          reply: "…억울하다. 그래, 억울하다. 이걸 인정하는 데 하루 걸릴 것 같다",
          next: "the_last_climb",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_last_climb",
      intro: [
        "끝났다. 우리 에이스가 2위로 정상을 넘었다. 팀 최고 성적이다",
        "나는 500m 앞에서 빠졌다. 정확히 그 자리에서 다리가 끝났다. 계산대로다",
        "길가에 자전거를 세우고 앉아 있는데 머리가 땀으로 다 무너져 있더군. 최악이었다",
        "…그런데 이상하게 하나도 안 부끄러웠다. 이건 나도 설명이 안 된다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "설명 안 해도 돼요. 그날 제일 잘 탄 사람이 그 자리에 앉아 있던 거예요",
          reply: "…그렇게 말해주는 사람이 하나는 있어야 한다고 생각하긴 했다. 고맙다는 말은 안 한다",
          next: "the_record",
          effect: { mental: 15, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "부끄러움은 볼 사람이 있을 때 생기는 거예요. 거기엔 아무도 없었고요",
          reply: "…아무도 없었지. 그래서 편했던 건가. 이건 좀 생각해볼 문제군",
          next: "the_record",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "머리 무너진 채로 앉아 있는 사진, 그게 진짜 정상 사진이에요",
          reply: "…그런 소리를 하는 놈은 너뿐이다. 그리고 그게 자꾸 남는다",
          next: "the_record",
          effect: { mental: -3, skills: { knowledge: 25, beauty: 20 } },
        },
      ],
    },
    {
      id: "the_record",
      intro: [
        "우리 팀 매니저가 기록표를 보여줬다. 내가 끈 구간 평균 속도가 3년 최고라더군",
        "순위표엔 내 이름이 없다. 기록표엔 있다. 그 차이를 처음 알았다",
        "졸업 사진은 앞머리를 완벽하게 하고 찍을 거다. 그건 그거고",
        "…그 땀에 무너진 사진도 같이 올렸다. 반응이 이상하게 좋더군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘 다 당신이에요. 어느 쪽도 안 버려도 돼요",
          reply: "둘 다라. 욕심 많은 결론이군. 마음에 든다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 350,
            skills: { sociability: 30, beauty: 20 },
          },
        },
        {
          tone: "cool",
          me: "순위표는 남한테 보여주는 거고, 기록표는 본인이 보는 거예요",
          reply: "…그 구분이 3년 늦었다. 그래도 왔으니 됐다고 해두지",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "반응 좋은 이유 알아요? 처음으로 안 꾸민 거니까요",
          reply: "…안 꾸민 게 제일 잘 나왔다는 거냐. 그건 좀 억울한데. 인정은 하겠다",
          next: null,
          effect: {
            mental: 10,
            followers: 400,
            skills: { beauty: 25, sociability: 25, knowledge: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 승리의 주장 — "승리!!"를 외치는 자전거부 주장(`data/accounts.ts` victory_captain).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 팀 얘기가 밖으로 나가는 걸 그는 좋아한다.
 *
 * 이 스토리의 축은 **'규율은 사람을 지키는가, 입을 막는가'**다. 작년에 부원 하나가 아픈 걸 숨기고
 * 뛰다 넘어졌고, 그 뒤로 그는 규율을 두 배로 만들었다. 그런데 그 규율 때문에 지금 또 누가 숨긴다.
 *
 * ⚠️ 말투는 **짧은 단정형 반말 + 가끔 "승리!!"**다. 그는 명령하는 데 익숙하고 부탁에는 서툴다.
 * ⚠️ 웃는 스프린터(smile_sprint)도 '팀에 말 못 하는 것'을 다루지만 **축이 다르다** — 그쪽은 자기 몸,
 *    이쪽은 자기가 만든 규칙이다. 주장 쪽에서 특정 부원의 부상을 지목하지 마라(두 스토리는 독립이다).
 * ⚠️ 그를 **규율을 버리는 사람으로 만들지 마라.** 마지막까지 규율은 남는다. 바뀌는 건 예외를 두는 법이다.
 * 줄기: 1회차 작년 결승선 → 2회차 훈련에서 뺀 부원 → 3회차 왜 소리쳐 왔는가.
 */
export const CAPTAIN_STORY: DmStory = {
  id: "captain_1",
  partnerName: "승리의 주장",
  partnerHandle: "victory_captain",
  arrivalTitle: "승리의 주장의 DM",
  startNode: "rt_thanks",
  nodes: [
    {
      id: "rt_thanks",
      intro: [
        "승리!! …아, 이건 버릇이다. 미안하다",
        "내 글을 퍼갔더군. 고맙다. 우리 팀 얘기가 밖으로 나가는 건 좋은 일이다",
        "그런데 하나 묻고 싶은 게 있다. 팀 밖 사람한테 물어야 하는 종류다",
        "규율은 사람을 지키는 거냐, 입을 막는 거냐. 요즘 이 생각만 한다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘 다 될 수 있죠. 그래서 어려운 거고요",
          reply: "둘 다라. 그런 답은 곤란한데. …곤란한 게 맞는 답인 것 같기도 하다",
          next: "last_year",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "그 질문 나오는 팀이면 이미 입을 막고 있는 거예요",
          reply: "…빠르군. 그래서 물은 거다. 계속하겠다",
          next: "last_year",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "주장이 그걸 밖에 물어보는 것부터가 답인데요",
          reply: "…그 말은 좀 아프다. 아픈 김에 마저 얘기하지",
          next: "last_year",
          effect: { mental: -4, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "last_year",
      intro: [
        "작년 결승선을 아직도 꿈에서 본다. 우리 팀 하나가 거기서 넘어졌다",
        "아픈 걸 사흘 숨겼다. 나한테는 괜찮다고만 했고",
        "그 뒤로 규율을 두 배로 했다. 몸 상태 보고는 매일, 예외 없음. 그게 내가 낸 답이었다",
        "…그런데 요즘 또 누가 숨기고 있다. 확실하다. 근데 아무도 말을 안 한다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "매일 보고하라고 하면 매일 거짓말을 하게 돼요",
          reply: "…매일 거짓말이라. 그 생각은 안 해봤다. 하룻밤 두고 보겠다",
          next: "who_speaks",
          delayDays: 1,
          effect: { skills: { knowledge: 25, sociability: 15 } },
        },
        {
          tone: "cool",
          me: "숨기는 사람을 찾지 말고, 왜 숨기는지를 찾으세요",
          reply: "…왜 숨기는지. 답은 대충 알 것 같은데 인정하기 싫군. 내일 답하지",
          next: "who_speaks",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그 규율 만든 사람한테 어떻게 말해요. 본인이 벽인데",
          reply: "…내가 벽이라. 하룻밤 생각하겠다. 오늘은 여기까지다",
          next: "who_speaks",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "who_speaks",
      intro: [
        "오늘 훈련 전에 규율을 하나 고쳤다. 몸 상태 보고를 나 말고 매니저한테 하게 했다",
        "내가 들으면 다들 '괜찮다'고 한다. 매니저한테는 숫자로 말하게 되니까",
        "바꾼 지 하루 만에 둘이 나왔다. 무릎 하나, 손목 하나. 하루 만에 둘이다",
        "…1년 동안 나는 뭘 듣고 있었던 거냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "1년 동안 규율을 지킨 거예요. 오늘 하나 더 배운 거고요",
          reply: "…배웠다고 해두겠다. 그편이 잠이 온다",
          next: null,
          effect: { mental: 10, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "주장한테 하는 보고는 보고가 아니라 대답이에요",
          reply: "…대답이라. 정확한 단어군. 기억해두겠다",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "둘 다 진작 알고 있었잖아요. 물어볼 자리를 안 만든 거죠",
          reply: "…맞다. 알고 있었다. 그래서 내가 벽이라는 말이 하루 종일 걸렸던 거다",
          next: null,
          effect: { mental: -8, morality: 8, skills: { knowledge: 35, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 승리의 주장 2회차 — 뺀 놈.
 * 축은 **'예외를 두는 법'**이다. 규율대로 부원 하나를 훈련에서 뺐고, 그게 벌처럼 받아들여졌다.
 * ⚠️ 뺀 부원을 특정 계정과 연결하지 마라 — 이름 없는 2학년으로 둔다.
 */
const CAPTAIN_STORY_2: DmStory = {
  id: "captain_2",
  partnerName: "승리의 주장",
  partnerHandle: "victory_captain",
  arrivalTitle: "승리의 주장의 DM",
  startNode: "benched",
  nodes: [
    {
      id: "benched",
      intro: [
        "오늘 2학년 하나를 훈련에서 뺐다. 손목이 부었는데 나온 놈이다",
        "규율대로 했다. 아픈 채로 나오면 팀에 민폐다. 내가 늘 하던 말이고",
        "그런데 그놈이 나가면서 그러더군. '주장님, 저 벌 받는 거예요?'",
        "…벌이 아니라고 말은 했다. 그놈 얼굴은 안 그렇게 들었다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "뺐으면 할 일을 주세요. 빈손으로 두면 벌이 돼요",
          reply: "…할 일이라. 쉬는 게 할 일이라고 생각했는데 그게 아니었나. 하루 해보겠다",
          next: "he_came_back",
          delayDays: 1,
          effect: { skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "규율은 맞았어요. 전달이 틀렸고요",
          reply: "…전달. 그건 내 특기가 아니다. 하룻밤 궁리해보지",
          next: "he_came_back",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "벌 맞아요. 뺀 사람이 벌이 아니라고 정할 수는 없어요",
          reply: "…내가 정할 수 없다. 그건 생각도 못 했다. 내일 답하겠다",
          next: "he_came_back",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "he_came_back",
      intro: [
        "그놈한테 초시계를 쥐여줬다. 오늘 하루 매니저 옆에서 기록을 재게 했다",
        "훈련 끝나고 그놈이 기록표를 들고 왔다. 자기 빼고 전원 기록이 적혀 있더군",
        "'저 이거 하는 동안 다들 얼마나 빠른지 처음 봤어요'라고 했다",
        "…뺀 게 아니라 자리를 옮긴 거였으면, 처음부터 그렇게 말했어야 했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "지금이라도 그렇게 말해주세요. 늦지 않았어요",
          reply: "…말하지. 오늘 저녁에 하겠다. 이런 건 미루면 영영 안 한다",
          next: "the_exception",
          effect: { mental: 10, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "손목 낫는 동안 눈이 늘겠네요. 그거 손해 아니에요",
          reply: "…손해가 아니라. 그렇게 계산하니 마음이 편하군",
          next: "the_exception",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 말을 그 애가 먼저 하게 만든 게 주장 잘못이에요",
          reply: "…내 잘못이다. 인정한다. 인정하는 건 어렵지 않다. 안 반복하는 게 어렵지",
          next: "the_exception",
          effect: { mental: -6, morality: 8, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_exception",
      intro: [
        "규율집에 줄을 하나 더 넣었다. '못 뛰는 날엔 다른 자리를 준다'",
        "예외를 만든 게 아니다. 규율을 하나 더 만든 거다. 그건 확실히 해두고 싶다",
        "합숙 소등 10시는 그대로다. 그건 안 바꾼다. 잠은 훈련이다",
        "…승리!! 오늘은 이 말이 좀 다르게 나오는군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 지키는 규율이에요. 축하해요",
          reply: "축하받을 일인가. …그렇다고 해두겠다. 나쁘지 않군",
          next: null,
          effect: { mental: 15, morality: 8, followers: 250, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "예외를 규율로 만든 거, 그게 주장이 하는 일이에요",
          reply: "…주장이 하는 일이라. 3년째 하면서 이제야 정의를 들었다",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "소등 10시도 언젠간 바뀔걸요. 그때도 규율이라고 하세요",
          reply: "…안 바꾼다. 절대 안 바꾼다. …언젠가 바꾸면 그때 네 말이 맞았다고 하지",
          next: null,
          effect: { mental: 8, followers: 220, skills: { knowledge: 30, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 승리의 주장 3회차 — 왜 소리치는가.
 * 마지막 대회. 축은 **"승리를 원하면 승리라고 소리쳐라"의 진짜 이유**다 —
 * 몸이 따라오게 하려는 게 아니라, **자기 목소리를 자기가 들으려고** 외쳐 왔다.
 * ⚠️ 우승시키지 마라. 성적은 3위이고, 그가 후회를 남기지 않는 것이 이 회차의 결말이다.
 */
const CAPTAIN_STORY_3: DmStory = {
  id: "captain_3",
  partnerName: "승리의 주장",
  partnerHandle: "victory_captain",
  arrivalTitle: "승리의 주장의 DM",
  startNode: "three_days",
  nodes: [
    {
      id: "three_days",
      intro: [
        "인터하이 사흘. 하루씩 이긴다. 그게 전부다",
        "…라고 팀에는 말했다. 너한테는 다른 걸 말하겠다",
        "나는 승리라고 소리치면 몸이 따라온다고 3년을 떠들었다. 그거 반은 거짓말이다",
        "소리치는 건 내가 듣고 싶어서다. 안 그러면 무서워서 못 나간다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무서운 게 정상이에요. 주장이라 더 그렇고요",
          reply: "…정상이라. 그 말을 듣자고 쓴 건 아닌데, 듣고 나니 낫군",
          next: "the_finish",
          delayDays: 1,
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "반은 거짓말이면 반은 진짜네요. 소리치면 실제로 몸은 따라와요",
          reply: "…반은 진짜다. 그렇게 세어주니 계산이 맞는군. 다녀와서 쓰겠다",
          next: "the_finish",
          delayDays: 1,
          effect: { skills: { knowledge: 30, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "그 무서운 걸 3년 동안 혼자 들고 있었네요",
          reply: "…들고 있었다. 내려놓는 법은 안 배웠고. 사흘 뒤에 답하지",
          next: "the_finish",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_finish",
      intro: [
        "3위다. 우승은 못 했다. 작년보다 두 계단 올라갔다",
        "결승선에서 여섯이 다 무사히 들어왔다. 하나도 안 빠졌다. 이건 처음이다",
        "작년 꿈에 나오던 그 장면은 이제 안 나올 것 같다. 다른 장면이 덮였으니까",
        "…승리라고는 못 외쳤다. 목이 잠겨서 소리가 안 나왔다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "여섯이 다 들어온 게 승리예요. 소리는 안 내도 돼요",
          reply: "…그렇게 정리해주니 3위가 3위 같지 않군. 고맙다. 이 말은 하겠다",
          next: "hand_it_down",
          effect: { mental: 18, morality: 5, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "목이 잠긴 건 3년치를 다 쓴 거예요",
          reply: "…다 썼다. 남길 이유도 없었고. 잘 썼다고 해두지",
          next: "hand_it_down",
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "우승 못 했잖아요. 그건 그거대로 인정하고 가세요",
          reply: "…인정한다. 못 했다. 그래도 후회는 안 남았다. 그 둘은 다른 거다",
          next: "hand_it_down",
          effect: { mental: -4, skills: { knowledge: 35, fitness: 15 } },
        },
      ],
    },
    {
      id: "hand_it_down",
      intro: [
        "유니폼을 넘겼다. 선배들에게 물려받은 걸 다음한테 물려줬다",
        "규율집도 같이 넘겼다. 마지막 장에 내가 한 줄 적어뒀다",
        "'못 뛰는 날엔 다른 자리를 준다. 이건 지운 규율이 아니라 늘린 규율이다'",
        "…졸업 후 얘기는 이제 해도 되겠군. 아직 안 정했다. 그건 좀 무섭다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 정한 채로 좀 있어도 돼요. 사흘씩 이기면 되잖아요",
          reply: "…내 말을 나한테 돌려주는군. 좋다. 하루씩 이겨보겠다",
          next: null,
          effect: {
            mental: 18,
            reputation: 8,
            followers: 350,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "무서운 건 소리치면 된다면서요. 그건 여전히 반은 진짜예요",
          reply: "…그렇지. 그럼 오늘도 외워두겠다. 승리!!",
          next: null,
          effect: { mental: 12, followers: 300, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "규율집 마지막 장, 그거 후배가 또 고칠 거예요. 그래도 괜찮죠?",
          reply: "…고쳐야지. 안 고치면 그건 규율이 아니라 유물이다. 잘 봤다",
          next: null,
          effect: {
            mental: 15,
            morality: 8,
            followers: 300,
            skills: { knowledge: 35, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 기록만 재는 매니저 — 안 타고 재기만 하는 자전거부 매니저(`data/accounts.ts` stopwatch_manager).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 아무도 안 읽는 일지를 누가 읽었다는 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'순위표에 안 올라가는 이름'**이다. 상관없다고 쓰지만 정말 상관없지는 않다.
 * 그리고 그가 제일 무서워하는 것(기록을 잘못 재는 것)이 3회차에서 실제로 일어난다.
 *
 * ⚠️ 말투는 **성실한 존댓말**이다("~습니다/~해요"). 이 캐릭터만은 긴 문장을 써도 된다 —
 *    계정 문구에도 장문이 섞여 있다. 다만 **감정을 직접 말하지 않고 숫자로 말한다**(5초, 3년치, 두 개).
 * ⚠️ 그를 **선수로 만들지 마라.** 끝까지 안 탄다. 3회차에서도 그의 해결책은 기록으로 낸다.
 * ⚠️ 3회차의 오측정은 **실제로 일어난 실수**다. 없던 일로 만들지 마라 — 어떻게 처리하느냐가 갈림길이다.
 * 줄기: 1회차 왜 안 타는가 → 2회차 5초씩 밀리는 선배 → 3회차 잘못 누른 초시계.
 */
export const STOPWATCH_STORY: DmStory = {
  id: "stopwatch_1",
  partnerName: "기록만 재는 매니저",
  partnerHandle: "stopwatch_manager",
  arrivalTitle: "기록만 재는 매니저의 DM",
  startNode: "someone_read",
  nodes: [
    {
      id: "someone_read",
      intro: [
        "제 글에 좋아요를 눌러주셨더라구요. 확인하고 좀 놀랐습니다.",
        "저는 훈련 일지를 매일 씁니다. 아무도 안 읽지만 씁니다. 3년째요.",
        "읽는 사람이 생기니까 오늘 일지를 두 번 고쳐 썼습니다. 이건 좀 부끄럽네요.",
        "…그래서 인사라도 드리려고요. 안녕하세요. 저는 안 탑니다. 재기만 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "재는 것도 실력이죠. 3년치면 대단한데요",
          reply: "그렇게 말씀해주시는 분이 계시네요. 정확히는 3년 2개월치입니다.",
          next: "why_not_ride",
          effect: { mental: 5, skills: { sociability: 12, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "3년치면 누가 언제 느려졌는지 다 보이겠네요",
          reply: "보입니다. 본인들보다 제가 먼저 압니다. 그게 이 일의 무서운 점이에요.",
          next: "why_not_ride",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "안 읽는 걸 3년 쓴 이유가 뭔데요",
          reply: "…안 쓰면 아무도 안 쓰니까요. 그게 제일 정확한 이유입니다.",
          next: "why_not_ride",
          effect: { mental: -2, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "why_not_ride",
      intro: [
        "가끔 물어보시는 분이 있습니다. 왜 안 타냐고요.",
        "1학년 때 딱 한 번 몰래 타봤습니다. 100미터도 못 가서 넘어졌어요.",
        "그날 제 자리가 여기라는 걸 알았습니다. 지금은 후회 안 합니다.",
        "…이 말을 세 번쯤 반복해서 쓰는 걸 보면, 완전히 안 하는 건 아닌가 봐요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "후회 좀 남아도 괜찮아요. 자리는 자리대로 좋은 거고요",
          reply: "…남아도 된다고 하시니 이상하게 편해집니다. 하루 생각해보고 다시 쓸게요.",
          next: "the_team",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "100미터로 정하기엔 좀 이른 결론 아니었어요?",
          reply: "…그 말씀은 오늘 처음 들었습니다. 정리해서 내일 답하겠습니다.",
          next: "the_team",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "후회 안 한다는 말을 세 번 쓰면 그건 후회예요",
          reply: "…네. 그건 반박이 안 됩니다. 내일 다시 쓰겠습니다.",
          next: "the_team",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_team",
      intro: [
        "생각했습니다. 밤에 기록표를 3년치 다 넘겨봤어요.",
        "제 이름은 순위표에 한 번도 없습니다. 그건 앞으로도 그럴 거고요.",
        "그런데 이 표 아홉 명의 기록은 전부 제 손으로 눌린 겁니다. 하나도 빠짐없이요.",
        "…저는 못 탄 게 아니라 다른 걸 하고 있었던 거네요. 이제 그렇게 세보려고요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 표가 당신 순위표예요",
          reply: "제 순위표요… 그렇게 부를 수 있는 거였네요. 오늘 일지에 적어두겠습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "아홉 명이 자기 속도를 아는 건 당신 덕분이고요",
          reply: "…그렇게 계산하면 제 지분이 꽤 되네요. 이건 좀 뿌듯한데요.",
          next: null,
          effect: { skills: { knowledge: 35, it: 15 } },
        },
        {
          tone: "bold",
          me: "그럼 이제 일지 좀 읽히게 쓰세요. 아무도 안 읽는 건 반은 본인 탓이에요",
          reply: "…아. 그건 생각 못 했습니다. 읽히게요. 그건 연습이 필요하겠네요.",
          next: null,
          effect: { mental: -3, skills: { creativity: 20, knowledge: 25 } },
        },
      ],
    },
  ],
};

/**
 * 기록만 재는 매니저 2회차 — 5초.
 * 축은 **'미움받는 정확함'**이다. 기록은 컨디션을 말보다 먼저 안다. 그걸 말하면 다들 싫어한다.
 * ⚠️ 밀리는 선배를 특정 계정과 연결하지 마라 — 이름 없는 3학년으로 둔다.
 */
const STOPWATCH_STORY_2: DmStory = {
  id: "stopwatch_2",
  partnerName: "기록만 재는 매니저",
  partnerHandle: "stopwatch_manager",
  arrivalTitle: "기록만 재는 매니저의 DM",
  startNode: "five_seconds",
  nodes: [
    {
      id: "five_seconds",
      intro: [
        "3학년 선배 한 분이 2주째 5초씩 밀립니다. 같은 코스, 같은 조건에서요.",
        "본인은 괜찮다고 합니다. 컨디션 얘기를 하면 늘 그렇게 말씀하세요.",
        "기록은 거짓말을 안 합니다. 다만 해석은 조심해야 하고요.",
        "…훈련을 줄이자고 말할까 합니다. 말하면 다들 저를 싫어할 텐데요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "싫어해도 말하세요. 그게 당신 일이잖아요",
          reply: "…제 일이라고 해주시니 용기가 납니다. 내일 말해보겠습니다.",
          next: "they_hated_it",
          delayDays: 1,
          effect: { morality: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "줄이자고 하지 말고 숫자만 보여주세요. 판단은 그쪽이 하게",
          reply: "…숫자만요. 그게 더 세겠네요. 그렇게 해보겠습니다.",
          next: "they_hated_it",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "2주나 봤으면서 아직도 고민해요? 이미 늦었는데요",
          reply: "…늦었죠. 재기만 하고 말은 안 한 2주였습니다. 내일 말하겠습니다.",
          next: "they_hated_it",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "they_hated_it",
      intro: [
        "말했습니다. 기록표를 그대로 보여드렸어요. 2주치 5초를요.",
        "그 선배가 한참 보시더니 '이거 네가 잘못 잰 거 아니냐'고 하셨습니다.",
        "저는 초시계를 두 개 들고 다닙니다. 두 개 다 같은 숫자였습니다. 그렇게 말씀드렸어요.",
        "…그러고는 아무 말 없이 기록표를 들고 가셨습니다. 고맙다는 말은 없었고요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "들고 갔으면 받아들인 거예요. 그게 답이에요",
          reply: "…들고 간 게 답이군요. 저는 계속 말이 없는 것만 세고 있었습니다.",
          next: "the_worth",
          effect: { mental: 10, skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "두 개 든 이유가 오늘 나왔네요",
          reply: "…네. 오늘이 그날이었습니다. 3년 동안 두 개 들고 다닌 보람이 있네요.",
          next: "the_worth",
          effect: { skills: { knowledge: 40, it: 15 } },
        },
        {
          tone: "bold",
          me: "잘못 쟀냐는 말, 그거 사과받아야 하는 거예요",
          reply: "…사과요. 그건 생각 안 해봤습니다. 안 해봐서 지금 좀 억울해지는데요.",
          next: "the_worth",
          effect: { mental: -5, skills: { knowledge: 30, sociability: 15 } },
        },
      ],
    },
    {
      id: "the_worth",
      intro: [
        "오늘 그 선배가 훈련량을 절반으로 줄이셨습니다. 아무한테도 말 안 하고요.",
        "그리고 오후에 제 옆에 와서 물으셨어요. '이번 주 내 기록 어때.'",
        "3초 당겼습니다. 그렇게 말씀드렸더니 고개만 끄덕이고 가셨어요.",
        "…저를 찾을 때가 제일 뿌듯하다고 썼었는데, 오늘이 딱 그날입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 3초는 당신이 만든 거예요",
          reply: "제가요…? 저는 재기만 했는데요. …그렇게 세도 되는 거면 좋겠습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "물어보러 온 것 자체가 사과예요. 그 사람 방식으로요",
          reply: "…그게 사과였군요. 저는 계속 다른 말을 기다리고 있었습니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "다음엔 2주 기다리지 말고 사흘에 말하세요",
          reply: "…사흘이요. 기준을 정해두면 덜 망설이겠네요. 일지 앞장에 적어두겠습니다.",
          next: null,
          effect: { mental: 5, followers: 150, skills: { knowledge: 40, it: 20 } },
        },
      ],
    },
  ],
};

/**
 * 기록만 재는 매니저 3회차 — 잘못 누른 초시계.
 * 그가 제일 무서워하던 일이 대회 날 일어난다. 축은 **'정확함을 지키려고 정확하지 않게 굴 것인가'**다.
 * ⚠️ 'friendly'·'cool'은 실수를 밝히고(도덕성 ↑, 기록 하나가 영영 빈칸으로 남는다),
 *    'bold'는 추정치로 메운다(도덕성 ↓, 표는 완성되지만 그가 그 칸을 계속 본다).
 *    어느 쪽도 들키지 않는다 — 대가는 남이 아니라 그가 치른다.
 */
const STOPWATCH_STORY_3: DmStory = {
  id: "stopwatch_3",
  partnerName: "기록만 재는 매니저",
  partnerHandle: "stopwatch_manager",
  arrivalTitle: "기록만 재는 매니저의 DM",
  startNode: "the_mistake",
  nodes: [
    {
      id: "the_mistake",
      intro: [
        "큰일 났습니다. 오늘 대회에서 초시계를 잘못 눌렀어요.",
        "2조 출발 때 손이 떨려서 0.5초쯤 늦게 눌렀습니다. 두 개 다요. 심호흡을 못 했습니다.",
        "그 조에 우리 1학년이 있습니다. 개인 최고 기록이 나왔어요. 공식 기록으로는요.",
        "…제 표에 적을 숫자가 없습니다. 3년치가 이 한 칸에서 어긋납니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "일단 숨 쉬고요. 잘못 눌렀다고 적으면 돼요",
          reply: "…적는다. 빈칸으로 두는 게 아니라 적는 거군요. 하룻밤 생각해보겠습니다.",
          next: "what_i_wrote",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "0.5초면 공식 기록에서 역산할 수 있잖아요",
          reply: "…할 수 있습니다. 할 수 있어서 더 무섭습니다. 그건 잰 게 아니라 만든 거니까요.",
          next: "what_i_wrote",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "아무도 몰라요. 3년치 지키는 게 더 중요하지 않아요?",
          reply: "…아무도 모릅니다. 그 말이 제일 위험하네요. 하룻밤만 주세요.",
          next: "what_i_wrote",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_wrote",
      intro: [
        "밤새 그 칸을 봤습니다. 커서만 깜빡였어요.",
        "역산한 숫자를 넣으면 표는 완성됩니다. 아무도 안 물어볼 거고요.",
        "빈칸으로 두면 3년치에 처음으로 구멍이 하나 생깁니다. 그것도 대회 날 것으로요.",
        "…어느 쪽이 기록입니까. 이건 제가 판단하면 안 될 것 같아서 여쭙습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "빈칸으로 두고 옆에 '측정 실패'라고 쓰세요",
          reply: "…측정 실패. 그 네 글자를 제 손으로 쓰는 게 이렇게 어려울 줄 몰랐습니다.",
          next: "the_blank",
          effect: { morality: 10, mental: -4, skills: { knowledge: 30 } },
        },
        {
          tone: "cool",
          me: "역산한 숫자는 기록이 아니라 추정이에요. 둘을 섞으면 3년치가 다 추정이 돼요",
          reply: "…3년치가 전부 의심받는다. 그렇게 되네요. 답이 나왔습니다.",
          next: "the_blank",
          effect: { morality: 8, skills: { knowledge: 45, it: 15 } },
        },
        {
          tone: "bold",
          me: "채워 넣으세요. 그 1학년 최고 기록을 빈칸으로 남기는 게 더 미안한 일이에요",
          reply: "…그 애 것이라서요. 네. 그래서 저도 밤새 그 생각만 했습니다.",
          next: "the_blank",
          effect: { morality: -8, mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_blank",
      intro: [
        "정했습니다. 그리고 그 1학년한테는 직접 말했어요. 제가 잘못 눌렀다고요.",
        "그 애가 뭐랬는지 아세요? '그럼 다음에 또 내면 되죠!' 이러고 갔습니다.",
        "…저 혼자 밤을 새운 게 좀 억울해질 정도로요.",
        "내년 표에는 칸을 하나 더 만들려고 합니다. '측정 비고'라고요. 이건 제가 만든 칸입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 칸이 제일 정직한 칸이 되겠네요",
          reply: "정직한 칸이요. …제 이름은 순위표에 없지만, 이 칸은 제가 만든 겁니다.",
          next: null,
          effect: {
            mental: 15,
            morality: 8,
            followers: 250,
            skills: { sociability: 30, knowledge: 25 },
          },
        },
        {
          tone: "cool",
          me: "3년치에 구멍 하나 생긴 게 아니라, 구멍을 적는 법이 생긴 거예요",
          reply: "…그렇게 정리되는군요. 그럼 이 표는 오늘 더 좋아진 겁니다.",
          next: null,
          effect: { mental: 12, followers: 220, skills: { knowledge: 50, it: 20 } },
        },
        {
          tone: "bold",
          me: "그 애한테 말한 게 제일 잘한 거예요. 표는 그다음이고요",
          reply: "…표보다 사람이 먼저다. 3년 만에 배웠습니다. 늦었지만 배웠습니다.",
          next: null,
          effect: {
            mental: 10,
            morality: 10,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 산의 날개 — 하늘에 제일 가까운 곳까지 가려는 마이페이스 클라이머(`data/accounts.ts` wings_of_mt).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 아무도 못 알아듣는다던 글을 누가 퍼갔다는 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'진심을 낼 때'**다. 그는 이기고 지는 데 관심이 없고, 그래서 아무도 그가
 * 전력으로 타는 걸 본 적이 없다. 3회차에 걸쳐 **처음으로 이기고 싶어지는 이유**가 생긴다.
 *
 * ⚠️ 말투는 **가볍고 둥근 존댓말 + 가끔 ☁ ☺**다. 그를 **진지하게 만들지 마라** — 마지막 회차에서도
 *    그는 심각해지지 않는다. 다만 하고 싶은 게 하나 생길 뿐이다.
 * ⚠️ 그를 **철없는 애로 그리지 마라.** 마이페이스는 무지가 아니라 선택이다.
 * ⚠️ 다른 계정을 이름으로 부르지 마라 — "앞바구니 자전거 타는 애", "뒤에 붙었던 사람"처럼만 부른다.
 * 줄기: 1회차 뒤에 붙은 사람 → 2회차 팀 플레이라는 것 → 3회차 처음으로 이기고 싶은 날.
 */
export const WINGS_STORY: DmStory = {
  id: "wings_1",
  partnerName: "산의 날개",
  partnerHandle: "wings_of_mt",
  arrivalTitle: "산의 날개의 DM",
  startNode: "someone_shared",
  nodes: [
    {
      id: "someone_shared",
      intro: [
        "제 글을 퍼가셨더라구요. 그거 알림으로 오는 거 오늘 처음 알았어요 ☁",
        "다들 제 글은 무슨 말인지 모르겠대요. 사실 저도 가끔 그래요",
        "오늘은 바람이 서쪽에서 불어서 코스를 바꿨어요. 계획표는 또 잃어버렸고요",
        "…그래서 왜 퍼가셨어요? 저 궁금한 건 잘 못 참아요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "읽으면 숨이 좀 쉬어져서요",
          reply: "숨이 쉬어진다. 그거 좋은 말이네요. 산에서도 그런 데가 있어요 ☺",
          next: "the_follower",
          effect: { mental: 5, skills: { sociability: 12 } },
        },
        {
          tone: "cool",
          me: "이기는 얘기가 하나도 없어서요",
          reply: "아, 그거 저도 신기해요. 다들 이기는 얘기만 하잖아요. 왜 그럴까요",
          next: "the_follower",
          effect: { skills: { knowledge: 18 } },
        },
        {
          tone: "bold",
          me: "무슨 말인지 모르겠는데 그게 좋았어요",
          reply: "모르겠는데 좋다니. 그거 제일 좋은 감상인데요? 진짜로요 ☁",
          next: "the_follower",
          effect: { mental: 4, skills: { creativity: 15 } },
        },
      ],
    },
    {
      id: "the_follower",
      intro: [
        "오늘 누가 제 뒤에 30분을 붙었어요. 보통은 10분쯤에 떨어지거든요",
        "앞바구니 달린 생활자전거였어요. 그걸로 언덕을 웃으면서 올라오더라구요",
        "제 뒤에 오래 붙어 있으면 그 사람이 궁금해져요. 이번엔 좀 많이 궁금해졌어요",
        "…근데 뭐라고 말을 걸어야 하죠? 저 그런 건 해본 적이 없어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "'같이 갈래요' 한마디면 돼요",
          reply: "그거면 돼요…? 다섯 글자인데. 내일 해볼게요. 연습은 좀 하고요 ☺",
          next: "the_wait",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "말 걸지 말고 정상에서 기다려보세요",
          reply: "기다린다… 그건 제가 잘하는 건데. 내일 그렇게 해볼게요",
          next: "the_wait",
          delayDays: 1,
          effect: { skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "30분 붙게 놔둔 것부터가 이미 말 건 거예요",
          reply: "…어? 그런가요? 저는 그냥 탔는데. 아, 안 떨어뜨렸네요. 그러네요 ☁",
          next: "the_wait",
          delayDays: 1,
          effect: { mental: -2, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_wait",
      intro: [
        "정상에서 기다렸어요. 12분 걸렸어요. 세어봤어요",
        "올라와서는 숨을 못 쉬면서도 웃더라구요. 저는 그게 제일 신기했어요",
        "'왜 웃어요?' 하고 물었더니 '안 웃으면 못 올라와서요'래요",
        "…저도 그렇거든요. 저는 그걸 말로 해본 적이 없는데 그 애는 바로 말하더라구요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "같은 걸 보는 사람 만난 거예요. 축하해요",
          reply: "축하할 일인가요? …그렇게 들으니까 축하할 일 맞는 것 같아요. 고마워요 ☺",
          next: null,
          effect: { mental: 12, skills: { sociability: 25, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "12분을 센 것부터가 안 하던 짓이잖아요",
          reply: "…아. 저 원래 시간 안 세는데요. 왜 셌지. 이상하다 ☁",
          next: null,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다음엔 기다리지 말고 같이 오르세요",
          reply: "같이요… 그럼 제 속도가 아니게 되는데요. …근데 그것도 재밌겠네요",
          next: null,
          effect: { mental: 6, skills: { fitness: 20, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 산의 날개 2회차 — 팀 플레이라는 것.
 * 축은 **'남의 속도로 타보기'**다. 그는 배우려는 게 아니라 궁금해서 해본다.
 * ⚠️ 그가 팀에 감동하는 결말을 쓰지 마라. 그는 끝까지 "재밌었다"까지만 간다.
 */
const WINGS_STORY_2: DmStory = {
  id: "wings_2",
  partnerName: "산의 날개",
  partnerHandle: "wings_of_mt",
  arrivalTitle: "산의 날개의 DM",
  startNode: "team_play",
  nodes: [
    {
      id: "team_play",
      intro: [
        "선배가 또 팀 플레이를 배우래요. 이번이 네 번째예요",
        "같이 즐거우면 되는 거 아닌가요? 근데 그렇게 말하면 다들 한숨을 쉬어요",
        "그래서 오늘은 물어봤어요. 팀 플레이가 뭐냐고요.",
        "'네 뒤에 사람을 남겨두는 것'이래요. …그거 어떻게 하는 거예요?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "가끔 뒤를 돌아보면 돼요. 그게 다예요",
          reply: "뒤를요? 저 앞에 더 좋은 게 있어서 안 돌아보는데. …한 번은 해볼게요",
          next: "the_slow_day",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "뒷사람이 따라올 속도로 타는 거예요. 딱 그것뿐이에요",
          reply: "제 속도가 아닌 속도로요… 그건 좀 이상한 기분일 것 같은데요. 내일 해볼게요",
          next: "the_slow_day",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "선배가 네 번이나 말했으면 그건 부탁이에요",
          reply: "…부탁이요? 잔소리인 줄 알았는데. 그럼 얘기가 다르네요. 내일 해볼게요",
          next: "the_slow_day",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_slow_day",
      intro: [
        "해봤어요. 하루 종일 뒷사람 속도로 탔어요",
        "결론부터 말하면 재미없었어요. 바람도 안 느껴지고 구름도 안 봤어요",
        "…근데 언덕 끝에서 뒤를 봤는데 다섯 명이 다 있더라구요. 다섯 명 다요",
        "평소엔 두 명이면 많은 건데. 그 장면이 좀 이상하게 남아요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "재미없는 걸 하루 참은 대가로 다섯 명이에요",
          reply: "대가라니 장사 같은데요 ☺ 근데 밑지는 장사는 아니었던 것 같아요",
          next: "why_it_stayed",
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "구름을 못 본 게 아니라 안 봐도 됐던 거예요",
          reply: "…아. 볼 게 다른 데 있었네요. 그런 날도 있구나 ☁",
          next: "why_it_stayed",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "재미없었으면 안 해도 돼요. 억지로 하면 티 나요",
          reply: "티 나요? …맞아요, 다들 제가 참는 걸 알더라구요. 그게 좀 부끄러웠어요",
          next: "why_it_stayed",
          effect: { mental: -4, skills: { knowledge: 25, sociability: 15 } },
        },
      ],
    },
    {
      id: "why_it_stayed",
      intro: [
        "그 다섯 명 중에 그 앞바구니 자전거 애도 있었어요. 제일 뒤에서요",
        "내려오는 길에 저한테 그러더라구요. '오늘은 따라갈 수 있었어요.'",
        "그 말을 듣고 좀 웃었어요. 왜 웃었는지는 저도 모르겠고요",
        "…내일은 다시 제 속도로 탈 거예요. 근데 가끔은 오늘처럼 해도 되겠어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거면 충분해요. 매일 할 필요 없어요",
          reply: "매일은 못 해요. 진짜로요 ☁ 가끔은 할게요. 그건 약속할 수 있어요",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "따라갈 수 있었다는 말, 그건 당신이 만든 문장이에요",
          reply: "제가요…? 저는 느리게 탔을 뿐인데요. …그런 게 만드는 건가요",
          next: null,
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "웃은 이유 알아요. 뒤에 사람이 남아서예요",
          reply: "…아. 그거였구나. 저 그거 알아내는 데 하루 걸렸을 텐데요. 고마워요",
          next: null,
          effect: { mental: 10, followers: 180, skills: { sociability: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 산의 날개 3회차 — 진심.
 * 그가 **처음으로 이기고 싶어진다**. 이유는 순위가 아니라 사람이다.
 * ⚠️ 그가 이기는지는 이 회차에서 확정하지 않는다 — 결말은 "진심을 냈다"까지다.
 *    억지로 우승시키면 "이기고 지는 건 잘 모르겠어요"라는 이 캐릭터의 전제가 깨진다.
 */
const WINGS_STORY_3: DmStory = {
  id: "wings_3",
  partnerName: "산의 날개",
  partnerHandle: "wings_of_mt",
  arrivalTitle: "산의 날개의 DM",
  startNode: "the_challenge",
  nodes: [
    {
      id: "the_challenge",
      intro: [
        "그 앞바구니 자전거 애가 저한테 붙자고 했어요. 산 하나 통째로요",
        "'제가 이기면 동아리 들어와 주세요'래요. 부원이 모자란대요",
        "저는 이기고 지는 걸 잘 모르는데, 이건 좀 곤란하네요 ☁",
        "…근데 거절이 안 되더라구요. 왜죠?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "궁금해서요. 그 애가 어디까지 오는지",
          reply: "아, 그거네요. 저 궁금한 건 잘 못 참으니까요 ☺ 그럼 하는 걸로",
          next: "the_real_climb",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "지면 안 들어가도 되잖아요. 손해가 없는데요",
          reply: "…어? 그러네요? 손해가 없는데 왜 곤란하다고 생각했지. 이상하다",
          next: "the_real_climb",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "이번엔 진심 내야 할 것 같은데요",
          reply: "…진심이요. 그거 오랜만에 듣는 단어네요. 낼 데가 생겼나 봐요",
          next: "the_real_climb",
          delayDays: 1,
          effect: { mental: -3, skills: { fitness: 25 } },
        },
      ],
    },
    {
      id: "the_real_climb",
      intro: [
        "탔어요. 오늘은 브레이크도 안 잡고 뒤도 안 봤어요",
        "안장에서 일어나서 춤추듯 오르는 거 있잖아요. 그거 3년 만에 제대로 했어요",
        "정상까지 22분. 제 최고 기록이에요. 그 애는 8분 뒤에 올라왔고요",
        "…이겼는데 왜 제가 더 숨이 찼을까요. 이런 건 처음이에요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "진심을 내면 원래 그래요. 축하해요",
          reply: "그런 거였구나. 다들 매번 이걸 하는 거예요? 힘들겠다 ☁",
          next: "the_answer_wings",
          effect: { mental: 12, skills: { fitness: 25, sociability: 20 } },
        },
        {
          tone: "cool",
          me: "22분이면 이제 기록이 남았네요. 안 세던 사람이",
          reply: "…또 셌네요, 제가. 요즘 자꾸 뭘 세요. 나쁘진 않아요",
          next: "the_answer_wings",
          effect: { skills: { knowledge: 35, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "8분 차이면 그 애는 진 게 아니라 따라온 거예요",
          reply: "…맞네요. 작년이면 30분이었을 거예요. 그 애 진짜 빨라졌어요",
          next: "the_answer_wings",
          effect: { mental: 8, skills: { knowledge: 30, fitness: 15 } },
        },
      ],
    },
    {
      id: "the_answer_wings",
      intro: [
        "정상에서 그 애가 숨을 고르면서 그러더라구요. '역시 안 되네요.'",
        "그래서 제가 그랬어요. '들어갈게요, 동아리.'",
        "졌는데 왜 들어오냐고 하길래, 이겼으면 안 들어갔을 거라고 했어요",
        "…이건 제가 생각해도 좀 이상한 말인데, 진짜 그래요 ☺",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 이상해요. 이길 만한 사람이 생긴 거잖아요",
          reply: "이길 만한 사람이요. 아, 그런 게 있으면 재밌겠네요. 그래서 들어가나 봐요 ☁",
          next: null,
          effect: {
            mental: 15,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "진심을 낸 상대를 두고 가는 사람은 없어요",
          reply: "…그러네요. 22분을 같이 만든 사람인데요. 두고 가면 아깝죠",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "이제 마이페이스 아니네요. 그거 괜찮아요?",
          reply: "…마이페이스 맞아요! 제 페이스에 한 명 넣은 것뿐이에요. 그건 양보 못 해요 ☺",
          next: null,
          effect: {
            mental: 10,
            followers: 350,
            skills: { fitness: 25, sociability: 25, knowledge: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 근성 부대장 — 훈련을 혹독하게 시키는 방위대 부대장(`data/accounts.ts` grit_captain).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 촌스럽다는 소리만 듣던 글에 반응이 왔다는 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'남는 것'**이다. 그는 이기는 걸 목표로 세우지 않는다. 신입 셋이 다 남으면
 * 그게 올해 최고 성과다. 3회차에 걸쳐 그 셋이 어떻게 되는지가 이야기다.
 *
 * ⚠️ 말투는 **짧은 단정형 반말**이다("~다/~라"). 마침표를 찍고 끊는다. 감탄부호를 쓰지 마라.
 * ⚠️ 그를 **부드럽게 만들지 마라.** 후배가 울어도 다음 날 다시 시킨다. 바뀌는 건 시키는 법이지
 *    시키느냐 마느냐가 아니다.
 * ⚠️ 실제 군대·부대 명칭이나 실존 무기를 쓰지 마라. 총·탄창·사격장·랭크전까지만 쓴다.
 * 줄기: 1회차 신입 셋 → 2회차 나간 하나 → 3회차 돌아온 자리.
 */
export const GRIT_STORY: DmStory = {
  id: "grit_1",
  partnerName: "근성 부대장",
  partnerHandle: "grit_captain",
  arrivalTitle: "근성 부대장의 DM",
  startNode: "three_rookies",
  nodes: [
    {
      id: "three_rookies",
      intro: [
        "좋아요를 눌렀더군. 내 글은 대체로 촌스럽다는 소리를 듣는다.",
        "촌스러운 게 마지막까지 남는다는 게 내 생각이고. 그래서 안 고친다.",
        "용건은 이거다. 신입 셋을 받았다. 셋 다 남으면 그게 올해 최고 성과다.",
        "…그런데 첫 주에 하나가 벌써 흔들린다. 이런 건 어떻게 하는 게 맞냐.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "흔들리는 게 정상이에요. 첫 주잖아요",
          reply: "정상이라. …나도 첫 달엔 도망갈 생각만 했다. 그건 잊고 있었다.",
          next: "the_shaking_one",
          effect: { skills: { sociability: 15, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "안 잡는다면서요. 돌아오면 받아준다고 썼잖아요",
          reply: "…내가 쓴 걸 나한테 돌려주는군. 그건 지킨다. 지키는데 걱정은 된다.",
          next: "the_shaking_one",
          effect: { skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "혹독하게 시키면서 남기를 바라는 건 욕심 아닌가요",
          reply: "…욕심이다. 부정 안 한다. 그래도 실전에서 우는 것보단 낫다.",
          next: "the_shaking_one",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_shaking_one",
      intro: [
        "그 신입은 재능이 없다. 총구 올리는 속도가 셋 중 제일 느리다.",
        "본인도 안다. 그래서 남아서 혼자 더 하고 간다. 매일 한 시간씩.",
        "재능 없으면 시간을 부으면 된다. 나도 그렇게 했다. 그건 맞는 길이다.",
        "…그런데 그 한 시간을 내가 못 본 척해야 하는지 세워야 하는지 모르겠다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "옆에 있어주세요. 시키지 말고 그냥 같이요",
          reply: "…같이 있으라. 그건 훈련이 아닌데. 하룻밤 생각해보겠다.",
          next: "the_hour",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "혼자 하는 한 시간은 대체로 잘못된 자세를 굳혀요",
          reply: "…그건 맞는 지적이다. 내일 확인해보고 답하겠다.",
          next: "the_hour",
          delayDays: 1,
          effect: { skills: { knowledge: 30, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "세우세요. 안 세우면 그 애는 두 달 안에 부러져요",
          reply: "…부러진다라. 그 표현이 걸리는군. 내일 답하지.",
          next: "the_hour",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_hour",
      intro: [
        "어제 그 한 시간에 나가봤다. 자세가 무너져 있더라. 예상대로였다.",
        "고쳐줬다. 그리고 40분으로 줄이라고 했다. 남은 20분은 자라고 했고.",
        "그놈이 '봐주시는 겁니까' 하길래 아니라고 했다. 40분이 더 아프다고 했다.",
        "…실제로 더 아프다. 거짓말은 안 했다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 시키는 법을 바꾼 거예요",
          reply: "…바꿨다고 하기엔 여전히 굴린 건데. 뭐, 그렇게 세도 되겠지.",
          next: null,
          effect: { mental: 10, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "20분 자라는 게 오늘 제일 어려운 훈련이었을걸요",
          reply: "…그놈한테는 그랬을 거다. 자는 걸 제일 못 하더라.",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "봐주는 거 맞잖아요. 인정하기 싫은 거고요",
          reply: "…아니다. …반은 맞다고 해두겠다. 그 이상은 인정 안 한다.",
          next: null,
          effect: { mental: -3, skills: { knowledge: 30, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 근성 부대장 2회차 — 나간 하나.
 * 축은 **'안 잡는다'**다. 그는 나가는 사람을 붙잡지 않는다고 3년 써왔고, 이번엔 그게 시험받는다.
 * ⚠️ 그가 붙잡으러 가는 결말을 쓰지 마라 — 그는 끝까지 안 잡는다. 다만 문을 닫지도 않는다.
 */
const GRIT_STORY_2: DmStory = {
  id: "grit_2",
  partnerName: "근성 부대장",
  partnerHandle: "grit_captain",
  arrivalTitle: "근성 부대장의 DM",
  startNode: "one_left",
  nodes: [
    {
      id: "one_left",
      intro: [
        "셋 중 하나가 나갔다. 어제 그만두겠다고 하고 오늘 안 나왔다.",
        "그 한 시간 남아서 하던 놈은 아니다. 제일 잘하던 놈이 나갔다.",
        "이유는 '여기서 더 해도 안 될 것 같아서'다. 반박은 안 했다.",
        "…안 잡는다고 3년을 써왔다. 오늘 그 문장이 목에 걸린다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 잡는 건 문을 닫는 것과 달라요",
          reply: "…다르다. 그건 다르지. 그럼 나는 문만 열어두면 되는 거군.",
          next: "the_message",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "제일 잘하던 애가 나가는 건 대체로 벽을 본 거예요",
          reply: "…벽. 그놈이 뭘 봤는지 나는 못 봤다는 뜻이군. 하루 생각해보겠다.",
          next: "the_message",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "안 잡는 게 편해서 안 잡는 건 아니고요?",
          reply: "…그 말은 오늘 안 들었으면 좋았을 텐데. 내일 답하겠다.",
          next: "the_message",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_message",
      intro: [
        "연락은 한 번 했다. 딱 한 줄 보냈다.",
        "'밥 챙겨 먹어라. 돌아오면 받아준다.'",
        "답장은 없다. 읽기는 했더군. 그거면 됐다.",
        "…남은 둘한테는 아무 말도 안 했다. 뭐라고 해야 하는지 모르겠다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "남은 둘한테도 같은 말 해주세요. 밥 먹으라고요",
          reply: "…같은 말을. 그건 할 수 있다. 그건 내가 제일 잘하는 말이다.",
          next: "the_two",
          effect: { mental: 8, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "설명하지 마세요. 설명하면 남은 둘이 자기 차례를 세요",
          reply: "…자기 차례를 센다. 그건 생각 못 했다. 입 다물고 있겠다.",
          next: "the_two",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "한 줄로 끝낸 거예요? 3주 굴린 사람한테요?",
          reply: "…한 줄이 내 전부다. 길게 쓰면 그놈이 부담을 진다. 그건 안 한다.",
          next: "the_two",
          effect: { mental: -5, skills: { knowledge: 30, sociability: 10 } },
        },
      ],
    },
    {
      id: "the_two",
      intro: [
        "남은 둘은 오늘도 나왔다. 그 한 시간 하던 놈은 40분을 지키고 있고.",
        "훈련은 안 줄였다. 대신 오늘부터 훈련 끝나고 10분씩 앉아 있게 했다.",
        "10분 동안 아무것도 안 시킨다. 물어보고 싶은 게 있으면 그때 물어보라고만 했다.",
        "…오늘은 아무도 안 물었다. 그래도 다음 주에는 하나쯤 나오겠지.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 10분이 나간 사람한텐 없던 시간이에요",
          reply: "…없었다. 그래서 만든 거다. 늦었지만 만든 건 만든 거다.",
          next: null,
          effect: { mental: 12, morality: 6, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "안 물어도 앉아 있는 게 훈련이에요. 그거 알고 만드셨죠",
          reply: "…알고 만들었다. 들킬 줄은 몰랐고.",
          next: null,
          effect: { mental: 8, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "10분 만들 거면 훈련도 10분 줄이세요",
          reply: "…그건 안 한다. 시간을 붓는 건 여전히 맞다. 이건 양보 안 한다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { fitness: 30, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 근성 부대장 3회차 — 돌아온 자리.
 * 나갔던 신입이 돌아온다. 축은 **"돌아오면 받아준다"를 실제로 하는 법**이다.
 * ⚠️ 감동적인 재회로 쓰지 마라. 그는 인사도 안 하고 훈련부터 시킨다 — 그게 이 인물의 환영이다.
 */
const GRIT_STORY_3: DmStory = {
  id: "grit_3",
  partnerName: "근성 부대장",
  partnerHandle: "grit_captain",
  arrivalTitle: "근성 부대장의 DM",
  startNode: "he_returned",
  nodes: [
    {
      id: "he_returned",
      intro: [
        "나갔던 놈이 왔다. 두 달 만이다. 사격장 문 앞에 서 있더라.",
        "'받아주십니까' 하길래 '탄창 갈아라'라고 했다. 그게 내 대답이다.",
        "다른 말은 안 했다. 하면 그놈이 미안해질 테니까.",
        "…이게 맞는 건지는 여전히 모르겠다. 이런 건 배운 적이 없다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "맞아요. 미안해할 자리를 안 만든 거잖아요",
          reply: "…그렇게 되나. 나는 그냥 할 말이 없어서 그랬던 건데.",
          next: "the_rank_match",
          delayDays: 1,
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "두 달 쉰 몸으로 탄창부터 시킨 건 좀 무섭긴 하네요",
          reply: "…쉬었으면 손이 굳는다. 굳은 걸 먼저 푸는 게 맞다. 무섭게 보였다면 뭐, 어쩔 수 없고.",
          next: "the_rank_match",
          delayDays: 1,
          effect: { skills: { knowledge: 30, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "왜 나갔는지는 안 물어볼 거예요?",
          reply: "…안 묻는다. 물으면 답을 만들어야 하니까. 그건 두 번 나가게 만드는 짓이다.",
          next: "the_rank_match",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_rank_match",
      intro: [
        "어제 랭크전이 있었다. 셋 다 내보냈다. 돌아온 놈까지 포함해서다.",
        "졌다. 크게 졌다. 판을 다 짜서 들어오는 그 부대한테 걸렸다.",
        "그런데 셋 다 끝까지 서 있었다. 아무도 중간에 안 무너졌다.",
        "…우리 부대에 에이스는 없다. 그래서 이 결과가 나는 나쁘지 않다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "셋 다 서 있었으면 그게 목표였잖아요",
          reply: "…목표였지. 이겼으면 더 좋았겠지만. 아니, 됐다. 이거면 됐다.",
          next: "what_remains",
          effect: { mental: 12, skills: { sociability: 30, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "그 부대는 판으로 이기죠. 다음엔 판을 못 짜게 하면 돼요",
          reply: "…판을 못 짜게. 그건 훈련량으로는 안 되는 거다. 그건 내가 배워야 할 부분이고.",
          next: "what_remains",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "크게 진 걸 나쁘지 않다고 하면 다음에도 크게 져요",
          reply: "…그 말은 맞다. 오늘 안에 복기한다. 다음 날로 넘기면 변명이 붙으니까.",
          next: "what_remains",
          effect: { mental: -5, skills: { knowledge: 35, fitness: 15 } },
        },
      ],
    },
    {
      id: "what_remains",
      intro: [
        "올해 신입 셋 중 셋이 남았다. 하나는 두 달 나갔다 왔지만 셋은 셋이다.",
        "부대 순위는 그대로다. 회식은 안 했다. 다음 훈련이 있으니까.",
        "그 40분 하던 놈이 오늘 나한테 처음 질문을 했다. 10분 앉아 있는 시간에.",
        "…뭘 물었는지는 안 적겠다. 그건 그놈 거다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "셋이 셋이면 올해 최고 성과 맞네요. 축하해요",
          reply: "…최고 성과다. 내가 그렇게 정해놨으니 그렇게 세겠다. 고맙다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 20 },
          },
        },
        {
          tone: "cool",
          me: "질문이 나왔으면 그 10분은 성공한 거예요",
          reply: "…성공이라. 훈련이 아닌 걸로 성공을 세보긴 처음이다.",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "내년엔 넷 받으세요. 셋으론 부족해요",
          reply: "…넷. 그럼 넷 다 남겨야 하는데. …해보지. 각오는 하고 오라고 하겠다.",
          next: null,
          effect: {
            mental: 10,
            followers: 280,
            skills: { fitness: 30, sociability: 20, knowledge: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 탄을 굽히는 사람 — 쏘기 전에 궤도를 정해두는 작전 담당(`data/accounts.ts` bent_trajectory).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 퍼간 계정을 사흘치 훑어보는 게 이 인간의 인사법이다.
 *
 * 이 스토리의 축은 **'겁도 재능이다'**이다. 그는 겁이 많아서 관찰을 시작했고, 그걸 부끄러워하지 않는다.
 * 다만 자기 예측이 빗나가는 날에 그 재능이 어떻게 독이 되는지는 2회차에서야 안다.
 *
 * ⚠️ 말투는 **경상도 사투리 반말**이다("~는 기다", "아이다/아이가", "~뿐다"). 윗사람 얘기를 할 때만
 *    "~입니더/~고예"가 섞인다. 플레이어에게는 끝까지 반말체다.
 * ⚠️ 그를 **얍삽한 악역으로 그리지 마라.** 본인이 "얍삽하다는 소리 듣는다"고 먼저 인정하고 넘어가는 인물이다.
 * ⚠️ 대장(필살기 작명가)과 근성 부대장은 **전언으로만** 나온다. 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 사흘이면 외운다 → 2회차 못 버린 판 → 3회차 겁 많은 신입.
 */
export const BENT_STORY: DmStory = {
  id: "bent_1",
  partnerName: "탄을 굽히는 사람",
  partnerHandle: "bent_trajectory",
  arrivalTitle: "탄을 굽히는 사람의 DM",
  startNode: "three_days_watch",
  nodes: [
    {
      id: "three_days_watch",
      intro: [
        "니가 내 글 퍼갔길래 니 계정을 사흘치 봤다.",
        "기분 나쁘라고 하는 소리 아이다. 나는 원래 그렇게 인사한다.",
        "사람은 사흘 보면 습관이 나온다. 니는 밤에 글이 길어지더라.",
        "…그래서 물어볼 게 하나 있는 기다. 사흘 봤으면 물어볼 자격은 되고예.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무섭긴 한데 물어보세요",
          reply: "무섭다는 소리 자주 듣는다. 부정 안 한다. 그럼 묻는다.",
          next: "why_bent",
          effect: { skills: { sociability: 12, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "사흘로 뭘 알아요. 나흘째부터 다르게 살면요",
          reply: "…그라믄 나흘째부터 다르게 살아봐라. 그게 제일 좋은 대응인 기다.",
          next: "why_bent",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "그거 관찰 아니라 스토킹인데요",
          reply: "…선이 어디까지인지는 나도 헷갈린다. 그래서 먼저 말하고 시작하는 기다.",
          next: "why_bent",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "why_bent",
      intro: [
        "다들 내가 왜 탄을 굽혀 쏘냐고 묻는다. 답은 간단하다. 직선으로 쏘면 피하니까.",
        "근데 진짜 이유는 그게 아이다. 내 탄이 느려서 그런 기다.",
        "느린 탄으로 이길라믄 상대가 갈 데를 먼저 막아뿔어야 한다.",
        "…그라믄 왜 느린 탄을 쓰냐고? 그건 니가 맞혀봐라.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "빠른 탄은 실수하면 못 돌이키니까요",
          reply: "…맞다. 정확히 맞다. 하루 만에 맞히는 놈은 잘 없는데.",
          next: "the_fear",
          delayDays: 1,
          effect: { skills: { knowledge: 30, sociability: 10 } },
        },
        {
          tone: "cool",
          me: "느린 게 아니라 겁이 많은 거겠죠",
          reply: "…허. 이건 좀 아픈데. 하루 있다 답한다. 정리를 해야겠다.",
          next: "the_fear",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "몰라요. 근데 본인은 알고 있잖아요",
          reply: "…안다. 아는데 말한 적은 없다. 하루 줘봐라.",
          next: "the_fear",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_fear",
      intro: [
        "생각 정리했다. 답은 겁이다.",
        "나는 정면에서 붙는 게 무섭다. 지금도 무섭다. 그래서 판을 짜는 기다.",
        "겁 많은 놈이 관찰을 잘한다. 겁도 재능이다 아이가. 나는 그렇게 정했다.",
        "…근데 이걸 부대에서 말해본 적은 없다. 오늘 처음 적어봤다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "겁 안 나는 사람이 더 위험하죠",
          reply: "…그런 놈들이 제일 먼저 뻗더라. 니 말이 맞다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "겁을 재능으로 바꾼 게 실력이에요. 겁 자체가 재능은 아니고요",
          reply: "…엄밀하네. 맞다. 바꾸는 데 3년 걸렸다. 그건 인정받고 싶다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "부대에 말하세요. 그거 알면 다들 편해져요",
          reply: "…편해진다고? 그건 생각 못 했다. 겁내는 부대장을 누가 따르겠나 싶었지.",
          next: null,
          effect: { mental: -4, followers: 150, skills: { knowledge: 30, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 탄을 굽히는 사람 2회차 — 못 버린 판.
 * 축은 **"예측이 빗나가면 그 판은 버린다"를 못 지킨 날**이다. 그의 방식이 그를 배신하는 회차.
 * ⚠️ 상대를 특정 계정으로 지목하지 마라 — "처음 보는 수를 쓰는 놈"으로만 둔다.
 */
const BENT_STORY_2: DmStory = {
  id: "bent_2",
  partnerName: "탄을 굽히는 사람",
  partnerHandle: "bent_trajectory",
  arrivalTitle: "탄을 굽히는 사람의 DM",
  startNode: "the_miss",
  nodes: [
    {
      id: "the_miss",
      intro: [
        "어제 판을 두 개 날렸다. 하나도 아이고 두 개다.",
        "첫 판에서 예측이 빗나갔다. 처음 보는 수를 쓰는 놈이 나왔거든.",
        "규칙대로면 그 판은 버리고 다음을 짜야 한다. 내가 그리 써놨고.",
        "…근데 못 버렸다. 붙잡고 있다가 두 번째 판까지 같이 말아묵었다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "왜 못 버렸는지가 더 중요한 것 같은데요",
          reply: "…왜 못 버렸냐. 그거 물어봐 주는 사람이 없어서 나도 안 물어봤다.",
          next: "why_i_held",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "본인 규칙을 본인이 못 지킨 거잖아요",
          reply: "…그기 제일 창피한 기다. 하루 정리하고 답한다.",
          next: "why_i_held",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "처음 보는 수라면서요. 그럼 버려도 답은 안 나와요",
          reply: "…맞다. 버려도 답은 없었다. 그건 니 말이 맞다. 하루 줘봐라.",
          next: "why_i_held",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "why_i_held",
      intro: [
        "밤새 그 판을 다섯 번 돌려봤다. 두 번은 배속으로, 세 번은 정속으로.",
        "답 나왔다. 나는 그 판을 못 버린 기 아이라, 내가 틀렸다는 걸 못 버린 기다.",
        "3년을 판으로 이겨왔다. 그라믄 판이 틀렸을 때 나는 아무것도 아이게 되는 기고.",
        "…이런 걸 적어놓으니 꼴이 우습다. 그래도 적어야 남는다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 우스워요. 그거 적을 수 있는 사람이 몇 없어요",
          reply: "…적는 건 내 특기다. 적고 나니 좀 낫다. 고맙다는 말은 안 한다.",
          next: "the_new_rule",
          effect: { mental: 10, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "판이 틀린 거지 본인이 틀린 게 아니에요. 그 둘을 붙여놨네요",
          reply: "…붙여놨다. 3년 붙여놨으니 떼는 데도 시간이 걸릴 기다.",
          next: "the_new_rule",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "이겼는데 이유를 못 대면 운이라면서요. 진 것도 똑같아요",
          reply: "…내 말을 나한테 돌려주네. 그라믄 어제 진 이유는 하나다. 내가 못 버려서다.",
          next: "the_new_rule",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_new_rule",
      intro: [
        "규칙을 하나 고쳤다. '예측이 빗나가면 판을 버린다'에 한 줄 붙였다.",
        "'버릴 때는 다음 판을 짜지 말고, 그날은 관찰만 한다.'",
        "처음 보는 수는 한 판으로는 못 읽는다. 두 판을 봐야 패턴이 나오는 기다.",
        "…한 판을 일부러 내주는 거라 부대에는 아직 말 못 했다. 대장님이 웃으실 거고예.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말하세요. 한 판 내주고 다음을 다 가져오는 거잖아요",
          reply: "…그리 설명하면 통할지도 모르겠다. 니 문장 그대로 써묵겠다.",
          next: null,
          effect: { mental: 12, followers: 200, skills: { sociability: 30, knowledge: 25 } },
        },
        {
          tone: "cool",
          me: "관찰만 하는 날을 규칙으로 만든 거, 그게 진짜 작전이에요",
          reply: "…규칙으로 만들어야 지킨다. 마음먹기로는 안 되더라. 그건 배웠다.",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "웃으시면 어때요. 판은 당신이 짜잖아요",
          reply: "…허. 그건 맞는 말이네. 판은 내가 짠다. 그거는 안 뺏긴다.",
          next: null,
          effect: { mental: 10, followers: 220, skills: { knowledge: 40, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 탄을 굽히는 사람 3회차 — 겁 많은 신입.
 * 그가 자기 방식을 물려주는 회차. 축은 **"겁도 재능이다"를 남한테 처음 말하는 것**이다.
 * ⚠️ 신입을 그의 축소판으로 만들지 마라 — 그 애는 관찰을 종이가 아니라 머리로 한다(방식이 다르다).
 */
const BENT_STORY_3: DmStory = {
  id: "bent_3",
  partnerName: "탄을 굽히는 사람",
  partnerHandle: "bent_trajectory",
  arrivalTitle: "탄을 굽히는 사람의 DM",
  startNode: "the_scared_kid",
  nodes: [
    {
      id: "the_scared_kid",
      intro: [
        "대장님이 신입을 데려오셨다. 관찰 가르치는 건 내 몫이고.",
        "이번 놈은 겁이 많다. 사격장에서 손이 떨려서 표적을 못 본다.",
        "다들 못 쓰겠다 카는데, 나는 이런 놈이 제일 오래 남는 걸 안다.",
        "…근데 뭐라고 시작해야 하는지를 모르겠다. 나는 혼자 알아냈거든.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "본인 얘기부터 하세요. 겁 많다는 그거요",
          reply: "…내 얘기를. 그건 아직 아무한테도 안 했는데. 하루 생각해보겠다.",
          next: "what_he_saw",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "쏘게 하지 말고 보게 하세요. 사흘만요",
          reply: "…사흘. 내 방식 그대로네. 그기 통할지는 해봐야 알겠고.",
          next: "what_he_saw",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "혼자 알아낸 걸 가르치는 건 원래 안 돼요. 같이 알아내세요",
          reply: "…같이 알아낸다. 그건 해본 적이 없는 기다. 하루 줘봐라.",
          next: "what_he_saw",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_he_saw",
      intro: [
        "사흘 동안 안 쏘게 하고 보게만 했다. 종이도 안 줬다.",
        "나흘째에 그놈이 말하더라. '3번 선배는 급하면 오른쪽으로 도십니다.'",
        "…내가 3년 걸려 알아낸 걸 나흘 만에 말하더라. 종이 없이, 머리로만.",
        "솔직히 말하면 좀 무서웠다. 이런 무서움은 처음이고.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무서운 게 아니라 반가운 걸 거예요",
          reply: "…반갑다. 그거로 바꿔 적어두겠다. 니 말이 맞는 것 같기도 하고.",
          next: "the_handover",
          effect: { mental: 12, skills: { sociability: 30, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "그 애는 머리로 하고 당신은 종이로 하죠. 방식이 다른 거예요",
          reply: "…다르다. 그라믄 내 종이는 아직 쓸모가 있는 기네. 다행이다.",
          next: "the_handover",
          effect: { skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "3년 걸린 게 아까워요? 그럼 그 3년치를 넘기세요",
          reply: "…아깝다. 아까운데 넘기는 게 맞다. 그건 안다.",
          next: "the_handover",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_handover",
      intro: [
        "그놈한테 내 노트를 줬다. 3년치 궤도가 다 그려져 있는 기다.",
        "주면서 딱 한 마디 했다. '니 손 떨리는 거, 그거 재능이다.'",
        "그놈이 무슨 소리냐는 얼굴을 하길래 더 설명은 안 했다. 3년쯤 뒤에 알겠지.",
        "…나는 그 말을 해줄 사람이 없었다. 그게 좀 아쉬웠던 모양이다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 애는 3년 안 걸릴 거예요. 들었으니까요",
          reply: "…들었으니까. 그기 차이가 크제. 그라믄 내가 한 일이 있는 기네.",
          next: null,
          effect: {
            mental: 18,
            morality: 6,
            followers: 300,
            skills: { sociability: 35, knowledge: 25 },
          },
        },
        {
          tone: "cool",
          me: "노트를 준 게 아니라 3년을 준 거예요",
          reply: "…계산이 잔인하네. 맞는 계산이라 더 그렇고. 잘 세줬다.",
          next: null,
          effect: { mental: 12, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "본인한테도 그 말 해줄 사람 필요했잖아요. 지금 제가 할게요",
          reply: "…됐다. …아이다. 됐다는 말은 취소한다. 들어두겠다.",
          next: null,
          effect: {
            mental: 20,
            followers: 350,
            skills: { sociability: 30, knowledge: 35 },
          },
        },
      ],
    },
  ],
};

/**
 * 먹보 신입 공격수 — 늦게 시작해서 훈련실에 제일 오래 남는 신입(`data/accounts.ts` hungry_attacker).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 아무도 안 부르는 날에 온 반응 하나가 1회차의 문이다.
 *
 * 이 스토리의 축은 **'누가 나를 필요로 하는가'**다. 그의 목표는 소박하다("남한테 짐이 안 되는 것").
 * 3회차에서 그를 부르는 곳이 생기는데, 부르는 이유가 그가 아니라 **그가 가진 양**이라는 게 마지막 문제다.
 *
 * ⚠️ 말투는 **성실한 존댓말**이다("~습니다"). 기죽은 말은 쓰되 자기 비하로 굴리지 마라 —
 *    그는 "늦게 시작한 건 사실인데 못 한다는 뜻은 아니다"라고 스스로 정리해두는 인물이다.
 * ⚠️ 밥 얘기는 **매 회차 한 번씩만** 넣는다. 개그 캐릭터로 소비하면 3회차 무게가 안 실린다.
 * ⚠️ 실제 부대·기관 이름을 만들지 마라. "본부", "부대", "훈련실"까지만 쓴다.
 * 줄기: 1회차 아무도 안 부른 날 → 2회차 먼저 승급한 동기 → 3회차 부르는 이유.
 */
export const HUNGRY_STORY: DmStory = {
  id: "hungry_1",
  partnerName: "먹보 신입 공격수",
  partnerHandle: "hungry_attacker",
  arrivalTitle: "먹보 신입 공격수의 DM",
  startNode: "nobody_called",
  nodes: [
    {
      id: "nobody_called",
      intro: [
        "안녕하세요! 좋아요 눌러주셔서 인사드립니다. 이런 거 처음이라 좀 신납니다",
        "오늘도 아무도 저를 안 불렀습니다. 그래도 훈련실에는 갔습니다.",
        "부대에 들어가고 싶은데 아직 부르는 데가 없습니다. 기다리는 중입니다.",
        "…기다리는 것도 훈련이라고 하면 좀 나은데, 아무도 그렇게 안 말해주네요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기다리는 것도 훈련 맞아요. 제가 말해줄게요",
          reply: "…그 말 해주시는 분이 계시네요. 오늘 저녁은 여섯 그릇 갈 것 같습니다",
          next: "the_call_up",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "안 부르는 이유는 물어봤어요?",
          reply: "…안 물어봤습니다. 물어보면 답이 나올까 봐서요. 내일 물어보겠습니다",
          next: "the_call_up",
          delayDays: 1,
          effect: { skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "기다리지 말고 찾아가세요. 부를 때까지 있으면 늦어요",
          reply: "…찾아가는 건 생각 못 했습니다. 내일 훈련실에서 붙잡아 보겠습니다",
          next: "the_call_up",
          delayDays: 1,
          effect: { mental: -3, skills: { fitness: 20, knowledge: 10 } },
        },
      ],
    },
    {
      id: "the_call_up",
      intro: [
        "불렸습니다!! 오늘 불렸습니다!!",
        "한 부대에서 결원이 나서 하루만 대타로 뛰라고 했습니다. 하루짜리지만요.",
        "…솔직히 말하면 어제 잠을 두 시간 잤습니다. 긴장돼서요.",
        "잘하는 게 없어서 뭘 해야 할지 모르겠습니다. 뭘 하면 될까요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제일 앞에 서세요. 그거 하나면 돼요",
          reply: "제일 앞이요… 겁은 나는데 뒤로 가면 아무 일도 안 일어나니까요. 하겠습니다",
          next: "what_i_did",
          effect: { mental: 6, skills: { fitness: 25 } },
        },
        {
          tone: "cool",
          me: "하루짜리면 잘하려 하지 말고 안 죽는 걸 목표로 하세요",
          reply: "…안 죽는 것. 그건 할 수 있습니다. 체력만큼은 아무한테도 안 집니다",
          next: "what_i_did",
          effect: { skills: { knowledge: 25, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "두 시간 자고 나가면 그게 짐이에요. 오늘은 자세요",
          reply: "…아. 그러네요. 지금 바로 자겠습니다. 알려주셔서 감사합니다",
          next: "what_i_did",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_did",
      intro: [
        "끝났습니다. 한 명도 못 잡았습니다.",
        "대신 40초를 벌었습니다. 제가 앞에서 버티는 동안 뒤에서 정리가 끝났습니다.",
        "끝나고 그 부대 사람이 '너 잘 버티네' 했습니다. 잘한다가 아니라 잘 버틴다요.",
        "…그거면 됐습니다. 오늘은 짐이 아니었으니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "40초 벌어준 사람이 제일 크게 한 거예요",
          reply: "…그렇게 세주시니까 40초가 갑자기 길어 보입니다. 감사합니다",
          next: null,
          effect: { mental: 12, skills: { sociability: 25, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "잘 버틴다는 말, 공격수한테는 그게 최고 칭찬이에요",
          reply: "…최고 칭찬이었습니까? 저는 아쉬운 소린 줄 알았습니다. 오늘 잘 자겠습니다",
          next: null,
          effect: { mental: 10, skills: { knowledge: 30, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "다음엔 한 명 잡으세요. 버티는 걸로 만족하면 계속 대타예요",
          reply: "…네. 맞습니다. 다음엔 잡겠습니다. 그 말 적어두겠습니다",
          next: null,
          effect: { mental: -4, skills: { fitness: 35 } },
        },
      ],
    },
  ],
};

/**
 * 먹보 신입 공격수 2회차 — 먼저 간 동기.
 * 축은 **'축하는 했는데 속은 쓰린 것'**이다. 그는 그 감정을 숨기지 않되, 그걸로 남을 미워하지도 않는다.
 * ⚠️ 동기를 나쁘게 그리지 마라. 문제는 동기가 아니라 그의 속도다.
 */
const HUNGRY_STORY_2: DmStory = {
  id: "hungry_2",
  partnerName: "먹보 신입 공격수",
  partnerHandle: "hungry_attacker",
  arrivalTitle: "먹보 신입 공격수의 DM",
  startNode: "he_went_first",
  nodes: [
    {
      id: "he_went_first",
      intro: [
        "동기가 승급했습니다. 저보다 두 달 늦게 들어온 애입니다.",
        "축하한다고 했습니다. 진심이었습니다. 그것도 진심이고요.",
        "그런데 집에 와서 밥이 안 넘어갔습니다. 처음으로 남겼습니다.",
        "…제가 이런 사람인 줄 몰랐습니다. 좀 부끄럽습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘 다 진심이면 되는 거예요. 부끄러운 거 아니에요",
          reply: "둘 다 진심. …그렇게 말해주시니까 좀 낫습니다. 내일은 먹겠습니다",
          next: "the_gap",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "속 쓰린 건 그만큼 하고 싶다는 뜻이에요",
          reply: "…하고 싶다는 뜻. 그렇게 정리하면 좀 쓸모가 있어지네요. 하루 생각해보겠습니다",
          next: "the_gap",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "부끄러운 건 남긴 밥이죠. 그게 제일 안 어울려요",
          reply: "…그건 맞습니다. 제일 안 어울리는 짓을 했습니다. 내일 두 배로 먹겠습니다",
          next: "the_gap",
          delayDays: 1,
          effect: { mental: -3, skills: { fitness: 20 } },
        },
      ],
    },
    {
      id: "the_gap",
      intro: [
        "그 동기한테 물어봤습니다. 뭘 어떻게 했냐고요.",
        "'저는 하나만 팠어요'라고 하더군요. 저는 잘하는 게 없어서 다 해보고 있었고요.",
        "다 해보면 하나쯤 걸리겠지 했는데, 3개월째 하나도 안 걸렸습니다.",
        "…이제 와서 하나만 파기엔 늦은 것 같기도 하고요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이미 하나 걸렸어요. 체력이요",
          reply: "…체력은 자랑할 게 그거밖에 없어서 센 적이 없었습니다. 그게 걸린 거였습니까",
          next: "one_thing",
          effect: { mental: 8, skills: { fitness: 25, sociability: 15 } },
        },
        {
          tone: "cool",
          me: "다 해본 3개월이 있어야 뭘 팔지가 나와요. 순서가 그래요",
          reply: "…순서. 그럼 저는 지금 그 순서를 밟고 있는 겁니까. 그건 좀 다행이네요",
          next: "one_thing",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "늦었다는 말은 그만하세요. 3개월 전에도 그러셨을걸요",
          reply: "…했습니다. 그때도 늦었다고 했습니다. 그럼 그 말은 빼겠습니다",
          next: "one_thing",
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "one_thing",
      intro: [
        "오늘부터 하나만 파기로 했습니다. 앞에서 버티는 것만요.",
        "제일 오래 서 있는 사람이 되겠다고 훈련 일지에 적었습니다.",
        "선배가 그걸 보더니 웃으면서 '그건 아무도 안 하려는 거다'라고 했습니다.",
        "…아무도 안 하려는 거면, 제가 하면 되는 거 아닙니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 자리를 만드는 방법이에요",
          reply: "자리를 만든다. …좋은 말입니다. 오늘 다섯 그릇 먹고 자겠습니다",
          next: null,
          effect: { mental: 15, skills: { sociability: 30, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "아무도 안 하려는 걸 하면 대체가 안 돼요. 그게 무기예요",
          reply: "…대체가 안 된다. 그 말 오늘 제일 좋습니다. 캡처해서 붙여두겠습니다",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "버티는 건 목표가 아니라 조건이에요. 그다음도 정하세요",
          reply: "…그다음. 아직 없습니다. 생기면 말씀드리겠습니다. 그건 약속하겠습니다",
          next: null,
          effect: { mental: -3, followers: 150, skills: { fitness: 30, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 먹보 신입 공격수 3회차 — 부르는 이유.
 * 부대가 그를 부른다. 그런데 부르는 쪽이 원하는 건 그가 아니라 **그가 가진 양**이다.
 * ⚠️ 그 부대를 악의적으로 그리지 마라 — 실제로 필요해서 부르는 것이고, 그 계산은 정당하다.
 *    이 회차의 질문은 "그래도 갈 것인가"이지 "저 사람들이 나쁜가"가 아니다.
 */
const HUNGRY_STORY_3: DmStory = {
  id: "hungry_3",
  partnerName: "먹보 신입 공격수",
  partnerHandle: "hungry_attacker",
  arrivalTitle: "먹보 신입 공격수의 DM",
  startNode: "the_offer",
  nodes: [
    {
      id: "the_offer",
      intro: [
        "부대에서 연락이 왔습니다. 정식으로요. 대타가 아니라 자리로요.",
        "그런데 부대장이 이유를 솔직하게 말해줬습니다. 제 양이 많아서라고요.",
        "재능이 아니라 양입니다. 오래 버틸 수 있어서 부르는 겁니다.",
        "…기다리던 연락인데 왜 바로 대답을 못 했는지 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "솔직하게 말해준 게 오히려 좋은 신호예요",
          reply: "…속이지 않고 말해줬으니까요. 그건 그렇습니다. 하루 생각해보겠습니다",
          next: "what_i_am",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "양이 많은 것도 실력이에요. 그거 아무나 못 가져요",
          reply: "…가진 걸로 세도 되는 겁니까. 그건 생각 안 해봤습니다. 내일 답하겠습니다",
          next: "what_i_am",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그 부대는 당신을 부른 게 아니라 부품을 고른 거예요",
          reply: "…그렇게 들으니까 속이 답답합니다. 하루만 생각해보겠습니다",
          next: "what_i_am",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_i_am",
      intro: [
        "밤새 생각했습니다. 그리고 훈련 일지를 처음부터 다 넘겨봤습니다.",
        "3개월치에 '아무도 저를 안 불렀습니다'가 열한 번 적혀 있더군요. 세어봤습니다.",
        "…열한 번 안 불린 사람한테 이유가 있는 연락이 온 겁니다. 이유가 있는 게 어딥니까.",
        "가겠다고 했습니다. 대신 조건을 하나 걸었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무슨 조건이요?",
          reply: "'제일 앞에 세워주십시오'요. 양이 필요하면 앞이 제일 많이 쓰이니까요",
          next: "the_first_day",
          effect: { mental: 10, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "조건을 걸었으면 부품이 아니라 사람으로 간 거예요",
          reply: "…아. 그러네요. 조건은 부품이 못 거는 거죠. 그건 생각 못 했습니다",
          next: "the_first_day",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "열한 번을 센 사람이 갈 자격을 따지긴 늦었죠",
          reply: "…맞습니다. 저는 갈 겁니다. 세어본 건 그냥 확인이었습니다",
          next: "the_first_day",
          effect: { mental: -3, skills: { knowledge: 30, fitness: 15 } },
        },
      ],
    },
    {
      id: "the_first_day",
      intro: [
        "첫날이 끝났습니다. 제일 앞에 섰고, 3분 버텼습니다.",
        "끝나고 부대장이 그러더군요. '양 때문에 부른 건 맞다. 근데 오늘은 네가 버틴 거다.'",
        "그 말 듣고 화장실 가서 좀 있다 나왔습니다. 이유는 안 적겠습니다.",
        "…오늘 저녁은 부대원들이 사줬습니다. 일곱 그릇 먹었습니다. 신기록입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "축하해요. 이제 부르는 데가 있는 사람이네요",
          reply: "…부르는 데가 있는 사람. 그 문장 오늘 일지 첫 줄에 적었습니다. 감사합니다",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 20 },
          },
        },
        {
          tone: "cool",
          me: "양은 가진 거고 3분은 만든 거예요. 그 둘은 달라요",
          reply: "…다릅니다. 이제 그 구분이 됩니다. 3분은 제가 만든 겁니다",
          next: null,
          effect: { mental: 15, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "일곱 그릇 얻어먹었으면 다음엔 4분 버텨야죠",
          reply: "…계산이 확실하시네요. 4분 하겠습니다. 그다음은 5분이고요",
          next: null,
          effect: {
            mental: 12,
            followers: 350,
            skills: { fitness: 35, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 표정 없는 저격수 — 화면에 안 잡히는 자리에서 앞사람을 지키는 저격수(`data/accounts.ts` silent_sniper).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 인기 없는 자리 얘기를 누가 퍼갔다는 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'제자리'**다. 그는 앞에 못 서고, 대신 앞에 선 사람을 지킨다.
 * 그 자리가 겸손인지 도피인지를 3회차에 걸쳐 스스로 확인한다.
 *
 * ⚠️ 말투는 **보고서체 존댓말**이다("~습니다", "보고 끝"). 조용한 신입(quiet_rookie)과 톤이 겹치지 않게
 *    **감정 대신 결과를 먼저 적는다** — 그쪽은 말을 안 하는 인물이고, 이쪽은 **결과로 말하는** 인물이다.
 * ⚠️ 그를 **앞에 세우지 마라.** 3회차의 결론은 자리를 옮기는 게 아니라 자기 자리를 고르는 것이다.
 * ⚠️ 그가 쏜 상대를 묘사하지 마라 — 본인이 "생각 안 하려고 한다"고 정해둔 선이다.
 * 줄기: 1회차 정체된 기록 → 2회차 사거리 밖에서 당한 동료 → 3회차 앞에 서겠냐는 제안.
 */
export const SNIPER_STORY: DmStory = {
  id: "sniper_1",
  partnerName: "표정 없는 저격수",
  partnerHandle: "silent_sniper",
  arrivalTitle: "표정 없는 저격수의 DM",
  startNode: "plateau",
  nodes: [
    {
      id: "plateau",
      intro: [
        "제 글을 퍼가셨습니다. 저격수 글은 잘 안 퍼가는데 특이한 취향이십니다.",
        "인사가 짧아서 죄송합니다. 필요한 말만 하면 짧아집니다.",
        "용건은 하나입니다. 훈련 기록이 넉 달째 그대로입니다.",
        "…뭘 바꿔야 할지 모르겠습니다. 이런 건 부대 안에서 묻기가 어렵습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "부대 안에서 물으면 왜 어려워요?",
          reply: "…부대장이 저를 믿어주는 만큼은 해내고 싶어서요. 못 한다는 소리가 됩니다.",
          next: "the_two_hours",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "넉 달 그대로면 방법이 아니라 목표가 잘못된 걸 수도 있어요",
          reply: "…목표요. 저는 명중률만 세고 있었습니다. 그것 말고 뭘 세야 합니까.",
          next: "the_two_hours",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "명중률 100%면 더 오를 데가 없죠. 그건 정체가 아니에요",
          reply: "…그건 생각 안 해봤습니다. 오를 데가 없는 것과 멈춘 것은 다르군요.",
          next: "the_two_hours",
          effect: { skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_two_hours",
      intro: [
        "제 기록에는 성공한 사격이 안 남습니다. 실패만 남깁니다. 그래서 표가 짧습니다.",
        "대신 안 적는 게 하나 더 있습니다. 기다린 시간입니다.",
        "한 발을 위해 두 시간을 기다린 적이 있습니다. 아깝지 않았습니다.",
        "…그 두 시간은 어디에도 안 적혀 있습니다. 그게 정상입니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거부터 적으세요. 그게 당신 실력이에요",
          reply: "…기다린 시간을 적는다. 그런 칸을 만들어도 되는 겁니까. 해보겠습니다.",
          next: "what_to_count",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "자리를 옮긴 횟수도 세보세요. 쏘는 건 그다음이라면서요",
          reply: "…제가 쓴 말입니다. 세본 적은 없습니다. 내일부터 세겠습니다.",
          next: "what_to_count",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "실패만 적는 표를 넉 달 봤으면 그게 정체의 원인이에요",
          reply: "…원인이 표에 있었다는 말씀입니까. 하루 생각해보겠습니다.",
          next: "what_to_count",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_to_count",
      intro: [
        "칸을 두 개 만들었습니다. '대기 시간'과 '자리 이동'입니다.",
        "하루 재봤더니 대기 4시간 12분, 이동 아홉 번이었습니다. 아홉 번은 많은 겁니다.",
        "이동이 많다는 건 자리를 처음에 잘못 골랐다는 뜻입니다. 넉 달간 안 보이던 게 보입니다.",
        "…명중률은 그대로일 겁니다. 그건 원래 100입니다. 보고 끝.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "마지막 줄, 자랑이죠?",
          reply: "…자랑입니다. 표정이 없다고 자랑까지 없는 건 아닙니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "아홉 번 옮긴 날에도 다 맞혔으면 그게 실력이에요",
          reply: "…그렇게 읽을 수도 있군요. 저는 아홉 번을 실수로만 세고 있었습니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "넉 달 걸린 게 아니라 물어볼 사람이 없던 거예요",
          reply: "…네. 그게 정확합니다. 그래서 퍼간 사람한테 물은 겁니다.",
          next: null,
          effect: { mental: -3, followers: 150, skills: { knowledge: 30, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 표정 없는 저격수 2회차 — 사거리 밖.
 * 축은 **'아무도 안 탓해서 더 힘든 것'**이다. 그는 그날 이후 자리 선정에 두 배의 시간을 쓴다.
 * ⚠️ 그 동료가 죽었다고 쓰지 마라 — 원문대로 "당했다"까지만 쓴다. 복귀 여부도 확정하지 않는다.
 */
const SNIPER_STORY_2: DmStory = {
  id: "sniper_2",
  partnerName: "표정 없는 저격수",
  partnerHandle: "silent_sniper",
  arrivalTitle: "표정 없는 저격수의 DM",
  startNode: "out_of_range",
  nodes: [
    {
      id: "out_of_range",
      intro: [
        "오늘 신입이 제 옆에 앉아서 물었습니다. 왜 자리 고르는 데 그렇게 오래 걸리냐고요.",
        "작년에 동료 하나가 제 사거리 밖에서 당했습니다. 제가 자리를 잘못 잡아서요.",
        "아무도 저를 탓하지 않았습니다. 그게 더 힘들었습니다.",
        "…그 얘기를 신입한테 해야 합니까. 아직 안 했습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "하세요. 그 애도 언젠가 같은 자리에 앉아요",
          reply: "…같은 자리에 앉는다. 그렇게 생각하니 말해야 할 것 같습니다.",
          next: "the_report",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "이유만 말하고 사연은 빼세요. 배울 건 자리 선정이지 죄책감이 아니에요",
          reply: "…구분이 되는군요. 저는 그 둘을 붙여놓고 있었습니다.",
          next: "the_report",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "탓하지 않은 게 힘들었으면, 지금이라도 탓해달라고 하세요",
          reply: "…그건 못 합니다. 하지만 무슨 말인지는 알겠습니다. 하루 생각하겠습니다.",
          next: "the_report",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_report",
      intro: [
        "말했습니다. 자리 선정 얘기만 하고 그날 보고서는 안 보여줬습니다.",
        "신입이 듣고 나서 '그럼 선배 사거리 안에 계속 있겠습니다'라고 했습니다.",
        "…그 말이 하루 종일 걸렸습니다. 좋은 쪽으로요.",
        "저는 그날 이후로 그 보고서를 다시 안 열어봤습니다. 오늘 처음 열었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "열어보고 어땠어요?",
          reply: "…생각보다 짧았습니다. 제 기억 속에서만 길었던 모양입니다.",
          next: "the_range",
          effect: { mental: 10, skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "1년 만에 연 거면 그건 이제 기록이지 상처가 아니에요",
          reply: "…기록으로 옮겨간 거군요. 저는 기록은 잘 다룹니다. 그건 다행입니다.",
          next: "the_range",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 신입 말이 부담스럽죠. 사거리 안에 있겠다는 거요",
          reply: "…부담입니다. 그런데 그 부담이 자리를 더 잘 고르게 만듭니다.",
          next: "the_range",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_range",
      intro: [
        "오늘 훈련에서 자리를 처음 한 번에 골랐습니다. 넉 달 만입니다.",
        "고를 때 신입이 어디 설지를 먼저 봤습니다. 그다음에 제 자리를 봤고요.",
        "순서를 바꿨더니 한 번에 나왔습니다. 이게 답이었습니다.",
        "…제 자리는 제가 편한 곳이 아니라 남이 서는 곳에서 정해지는 것이었습니다. 보고 끝.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 저격수가 하는 일이죠",
          reply: "…네. 이제 그걸 문장으로 쓸 수 있게 됐습니다. 감사합니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "넉 달 정체는 기술이 아니라 순서 문제였네요",
          reply: "…순서 하나였습니다. 그걸 넉 달 못 봤습니다. 기록에 남겨두겠습니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "작년 그 자리도 그래서 틀렸던 거예요. 이제 알겠죠",
          reply: "…알겠습니다. 알겠는데 그건 다시 안 돌아옵니다. 그래서 두 배로 씁니다.",
          next: null,
          effect: { mental: -5, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 표정 없는 저격수 3회차 — 앞에 설 것인가.
 * 부대장이 그에게 앞 자리를 제안한다. 축은 **'제자리를 고르는 것'**이다.
 * ⚠️ 앞에 서게 만들지 마라. 그는 거절하고, 거절하는 이유를 처음으로 말로 설명한다 —
 *    그게 이 캐릭터의 성장이다("앞에 못 선다"에서 "앞에 안 선다"로).
 */
const SNIPER_STORY_3: DmStory = {
  id: "sniper_3",
  partnerName: "표정 없는 저격수",
  partnerHandle: "silent_sniper",
  arrivalTitle: "표정 없는 저격수의 DM",
  startNode: "the_offer_front",
  nodes: [
    {
      id: "the_offer_front",
      intro: [
        "부대장이 저를 앞으로 돌리는 걸 검토 중이라고 했습니다.",
        "제 판단이 빠르니 근접에서도 쓸 만할 거라더군요. 승급도 빨라집니다.",
        "저는 앞에 못 섭니다. 그렇게 3년을 말해왔습니다.",
        "…그런데 이번엔 '못 서는 게 맞나' 하는 생각이 들었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "못 서는 거예요, 안 서는 거예요? 그거부터 정하세요",
          reply: "…그 둘이 다른 겁니까. …다르군요. 하룻밤 생각해보겠습니다.",
          next: "the_night",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "승급 때문에 흔들리는 거면 그건 앞자리가 아니라 순위표 문제예요",
          reply: "…정확합니다. 저는 지금 자리가 아니라 순위표를 보고 있었습니다.",
          next: "the_night",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "3년 말한 걸 한 번에 뒤집을 수 있으면 그건 신념이 아니었죠",
          reply: "…아픈 말입니다. 그래서 하루 걸리겠습니다. 내일 답하겠습니다.",
          next: "the_night",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_night",
      intro: [
        "밤에 사격장에 혼자 앉아 있었습니다. 두 시간쯤요. 기다리는 건 잘합니다.",
        "생각해보니 저는 앞이 무서운 게 아니었습니다. 앞에서는 못 기다리는 게 싫은 겁니다.",
        "앞은 판단이 반 초입니다. 제 자리는 두 시간이고요. 저는 두 시간 쪽이 강합니다.",
        "…거절하겠다고 답했습니다. 처음으로 이유를 붙여서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이유 붙인 거절은 도망이 아니에요. 선택이죠",
          reply: "…선택. 3년 만에 그 단어를 씁니다. 계속 도망이라고 생각하고 있었습니다.",
          next: "still_here",
          effect: { mental: 15, skills: { sociability: 30, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "두 시간 쪽이 강하다는 걸 아는 사람이 몇 없어요",
          reply: "…기다릴 줄 아는 게 제 유일한 재능인 것 같기도 합니다. 이제는 그렇게 씁니다.",
          next: "still_here",
          effect: { mental: 10, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "거절했으면 승급은 늦어요. 그건 감수하는 거죠?",
          reply: "…감수합니다. 순위표는 원래 제 이름이 잘 안 올라가는 곳입니다.",
          next: "still_here",
          effect: { mental: -4, skills: { knowledge: 40, fitness: 10 } },
        },
      ],
    },
    {
      id: "still_here",
      intro: [
        "부대장이 알겠다고 했습니다. 그리고 '그 자리 계속 맡아달라'고 했습니다.",
        "맡아달라는 말은 처음 들었습니다. 시킨 게 아니라 부탁이었습니다.",
        "오늘은 한 발도 안 쐈습니다. 그런 날이 좋은 날입니다.",
        "…옆에 신입이 두 시간을 같이 앉아 있었습니다. 그건 꽤 고마운 일입니다. 보고 끝.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋은 날이었네요. 축하해요",
          reply: "…축하받을 일인지는 모르겠지만 기분은 그렇습니다. 감사합니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "맡아달라는 말이 승급보다 나은 거예요",
          reply: "…낫습니다. 순위표엔 안 남지만 저한테는 남습니다.",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "그 신입, 두 시간 앉아 있었으면 이미 저격수예요",
          reply: "…아직 아닙니다. 하지만 시작은 그겁니다. 저도 그렇게 시작했습니다.",
          next: null,
          effect: { mental: 12, followers: 280, skills: { knowledge: 40, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 부대장 대행 — 권한은 절반, 책임은 그대로인 자리(`data/accounts.ts` acting_captain).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 서류가 무섭다는 글에 반응이 온 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'혼자 들고 있는 것'**이다. 그는 나쁜 소식을 부대원에게 늦게 말하고,
 * 그게 배려인지 회피인지 스스로도 모른다. 3회차에서 그 습관이 제일 큰 건으로 시험받는다.
 *
 * ⚠️ 말투는 **자조 섞인 존댓말**이다("~습니다", "…임시라고요"). 승리의 주장(victory_captain)과
 *    리더 축이 겹치지 않게 하라 — 그쪽은 **규율**, 이쪽은 **자기 그릇**이다. 구호를 외치지 않는다.
 * ⚠️ 그를 유능하게 만들지 마라. 그는 끝까지 "리더십이 뭔지 모르겠다"고 말하며, 다만 자리를 지킨다.
 * ⚠️ 본부·부대는 그대로 쓰되 실제 기관명을 만들지 마라. 원래 부대장은 **끝까지 등장하지 않는다**.
 * 줄기: 1회차 대행이라는 자리 → 2회차 소극적이라는 지적 → 3회차 혼자 들고 있던 소식.
 */
export const ACTING_STORY: DmStory = {
  id: "acting_1",
  partnerName: "부대장 대행",
  partnerHandle: "acting_captain",
  arrivalTitle: "부대장 대행의 DM",
  startNode: "the_paperwork",
  nodes: [
    {
      id: "the_paperwork",
      intro: [
        "좋아요 감사합니다. 서류 얘기에 반응이 오는 건 처음이라 좀 웃었습니다.",
        "전투보다 서류가 무섭습니다. 이건 아무도 안 알려줬습니다.",
        "지금도 책상에 결재 세 건이 있습니다. 셋 다 어제 것입니다.",
        "…결정을 미루는 게 제일 나쁜 선택이라고 배웠는데, 배운 대로가 안 됩니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 건 중에 제일 쉬운 것부터 하세요",
          reply: "…쉬운 것부터. 그러면 어려운 게 남는데요. …그래도 셋보다는 하나가 낫겠군요.",
          next: "why_me",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "어제 것이면 이미 하루 미룬 거예요. 미룬 이유가 뭔데요",
          reply: "…셋 다 사람에 관한 겁니다. 물건이면 벌써 했습니다.",
          next: "why_me",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "미루는 걸 배운 대로 안 된다고 하면 안 배운 거죠",
          reply: "…맞는 말입니다. 반박을 못 하겠습니다. 그래서 계속 읽고 있습니다.",
          next: "why_me",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "why_me",
      intro: [
        "제가 강해서 대행이 된 게 아닙니다. 남은 사람이 저뿐이었습니다.",
        "부대원 셋이 다 저보다 강합니다. 그런데 제 말을 들어줍니다.",
        "그게 늘 고맙고, 동시에 제일 무섭습니다. 제 판단으로 누가 다치면 어떡합니까.",
        "…이런 얘기를 부대 안에서는 못 합니다. 하면 그날부터 아무도 안 믿을 테니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무서워하는 사람이 결재하는 게 제일 안전해요",
          reply: "…그렇게 봐주시는군요. 하룻밤 그 문장을 두고 자보겠습니다.",
          next: "the_signature",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "강해서 뽑는 자리였으면 애초에 대행을 안 뒀겠죠",
          reply: "…그건 생각 못 했습니다. 남아서 된 게 아니라 남을 사람이 필요했던 건가요.",
          next: "the_signature",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "부대원이 안 믿을까 봐 숨기는 거, 그것도 판단이에요",
          reply: "…판단입니다. 그리고 아직 그 판단은 안 바꿀 겁니다. 하루 생각해보겠습니다.",
          next: "the_signature",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_signature",
      intro: [
        "세 건 다 결재했습니다. 어젯밤에요.",
        "제일 어려운 건 훈련량을 늘리는 거였습니다. 원성 살 걸 알면서 늘렸습니다.",
        "부대원 하나가 오늘 제 앞에서 대놓고 불만을 말했습니다.",
        "…좋은 신호로 받아들이겠습니다. 저한테 말했다는 게 중요하니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "면전에서 말했으면 그 사람은 당신을 믿는 거예요",
          reply: "…그렇게 세면 오늘은 좋은 날이군요. 커피를 세 잔만 마셨습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "원성 살 걸 알고 늘린 거면 그건 미룬 게 아니에요",
          reply: "…미룬 게 아니다. 그 구분이 오늘 제일 필요했습니다. 감사합니다.",
          next: null,
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "불만을 좋은 신호로 받는 건 편한 해석이에요. 내용은 맞았어요?",
          reply: "…맞았습니다. 절반은요. 나머지 절반은 제가 설명을 안 한 탓이고요.",
          next: null,
          effect: { mental: -4, skills: { knowledge: 35, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 부대장 대행 2회차 — 소극적이라는 말.
 * 축은 **'아무도 안 다치는 쪽을 고르는 것이 옳은가'**다. 그는 방식을 바꾸지 않는다.
 * 다만 처음으로 그 방식을 **설명한다**. 설명은 변명이 아니라 그가 안 하던 일이다.
 */
const ACTING_STORY_2: DmStory = {
  id: "acting_2",
  partnerName: "부대장 대행",
  partnerHandle: "acting_captain",
  arrivalTitle: "부대장 대행의 DM",
  startNode: "too_cautious",
  nodes: [
    {
      id: "too_cautious",
      intro: [
        "부대원 하나가 제 작전이 소극적이라고 했습니다. 회의 중에 대놓고요.",
        "맞는 말이라 반박을 못 했습니다. 저는 이기는 것보다 아무도 안 다치는 쪽을 늘 고릅니다.",
        "그래서 우리 부대는 순위가 안 오릅니다. 그것도 사실입니다.",
        "…이게 부대장으로서 옳은지는 아직도 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 다치는 걸 고르는 부대는 오래 갑니다",
          reply: "…오래 가는 것도 성적입니까. 그렇게 세본 적은 없습니다.",
          next: "the_meeting",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "옳은지 모르겠으면 부대원한테 물어보세요. 정하는 건 그다음이고요",
          reply: "…물어본다. 대행이 그걸 물으면 흔들리는 걸로 보일 텐데요. 하루 생각하겠습니다.",
          next: "the_meeting",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "소극적인 게 아니라 결정을 나눠 지기 싫은 거 아니에요?",
          reply: "…그건 좀 심한 말인데. …아니라고 바로 못 하는 걸 보면 생각해봐야겠습니다.",
          next: "the_meeting",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_meeting",
      intro: [
        "회의를 다시 열었습니다. 그리고 처음으로 제 방식을 설명했습니다.",
        "'나는 이기는 작전과 다 돌아오는 작전 중에 후자를 고른다. 이건 안 바꾼다.'",
        "'대신 왜 그런지는 앞으로 매번 말하겠다.' 여기까지 말했습니다.",
        "…소극적이라고 했던 그 부대원이 '그럼 됐습니다'라고 하더군요. 그게 다였습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "'그럼 됐습니다'가 제일 큰 동의예요",
          reply: "…동의였습니까. 저는 포기인 줄 알았습니다. 그렇게 들으니 다르게 들립니다.",
          next: "the_cost",
          effect: { mental: 10, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "안 바꾼다고 먼저 못 박은 게 잘한 거예요. 흔들리면 더 불안해해요",
          reply: "…못 박는 게 안심이 된다는 건 몰랐습니다. 저는 늘 여지를 남겼습니다.",
          next: "the_cost",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "설명은 늘었는데 작전은 그대로네요. 그거 알고 계시죠",
          reply: "…압니다. 방식은 안 바꿉니다. 그건 제가 감당할 수 있는 유일한 방식이라서요.",
          next: "the_cost",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_cost",
      intro: [
        "그날 작전은 계획대로 끝났습니다. 이런 날은 드뭅니다.",
        "순위는 여전히 그대로입니다. 아무도 안 다쳤고요.",
        "보고서를 쓰는데 오늘은 좀 빨리 써졌습니다. 다친 사람 칸이 비어 있으면 그렇습니다.",
        "…권한은 절반인데 책임은 그대로입니다. 그래도 절반이 딱 제 그릇인 것 같습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그릇 얘기는 그만하세요. 오늘 잘했잖아요",
          reply: "…네. 오늘은 잘했습니다. 그 말은 제가 저한테 잘 안 해줍니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "빈 칸을 만드는 게 당신 성적이에요. 순위표엔 안 나오고요",
          reply: "…빈 칸이 성적이다. 그건 보고서에 적을 수 없는 종류군요. 여기 적어두겠습니다.",
          next: null,
          effect: { mental: 12, followers: 220, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "절반이 그릇이면 나머지 절반은 언제 채워요?",
          reply: "…언젠가는요. 지금은 이 절반도 벅찹니다. 그건 솔직히 말하겠습니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 부대장 대행 3회차 — 혼자 들고 있던 것.
 * 부대 해체 얘기가 돈다. 축은 **'언제 말할 것인가'**다.
 * ⚠️ 해체를 확정하지 마라 — 결말은 보류다. 이 회차의 결말은 부대의 운명이 아니라
 *    그가 혼자 들고 있던 걸 내려놓았는지다.
 * ⚠️ 'bold'는 끝까지 혼자 들고 가는 선택이다. 그 대가는 정신력이고, 아무도 그를 탓하지 않는다.
 */
const ACTING_STORY_3: DmStory = {
  id: "acting_3",
  partnerName: "부대장 대행",
  partnerHandle: "acting_captain",
  arrivalTitle: "부대장 대행의 DM",
  startNode: "the_rumor",
  nodes: [
    {
      id: "the_rumor",
      intro: [
        "본부에서 우리 부대를 해체할지도 모른다는 얘기가 돌았습니다.",
        "아직 확정은 아닙니다. 다음 달 평가까지 순위가 안 오르면 검토한다는 정도입니다.",
        "부대원들한테는 말 안 했습니다. 제가 어떻게든 막아보고, 안 되면 그때 말할 생각입니다.",
        "…이런 걸 혼자 들고 있는 게 대행의 일인 것 같습니다. 그런데 잠이 안 옵니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말하세요. 셋이 들면 셋으로 나뉘어요",
          reply: "…나뉜다. 저는 늘 옮겨진다고만 생각했습니다. 하루 생각해보겠습니다.",
          next: "what_i_told",
          delayDays: 1,
          effect: { skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "다음 달 평가면 준비할 시간이 필요해요. 모르면 준비를 못 하죠",
          reply: "…그건 제 판단 착오일 수 있겠군요. 하룻밤 두고 보겠습니다.",
          next: "what_i_told",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "혼자 막겠다는 건 대행의 일이 아니라 대행의 고집이에요",
          reply: "…고집. 그렇게 불리면 할 말이 없습니다. 내일 답하겠습니다.",
          next: "what_i_told",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_told",
      intro: [
        "어제 저녁에 셋을 모아놓고 말했습니다. 있는 그대로 다요.",
        "제일 강한 부대원이 제일 먼저 물었습니다. '왜 이제 말합니까.'",
        "'혼자 막을 수 있을 줄 알았다'고 했습니다. 변명은 안 붙였습니다.",
        "…그랬더니 셋이 다음 달 훈련 계획을 자기들끼리 짜기 시작하더군요. 저는 그냥 보고 있었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 장면이 답이에요. 진작 말했어야 했던 이유요",
          reply: "…네. 그 장면을 못 볼 뻔했습니다. 늦었지만 봤습니다.",
          next: "the_month_after",
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "'왜 이제'라고 물은 건 원망이 아니라 같이 하겠다는 뜻이에요",
          reply: "…원망으로 들었습니다. 다시 들으니 다르군요. 그건 제 귀 문제였습니다.",
          next: "the_month_after",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "변명 안 붙인 게 제일 잘한 거예요. 붙였으면 셋이 안 움직였어요",
          reply: "…붙이려다 말았습니다. 붙였으면 어땠을지는 이제 모르겠습니다.",
          next: "the_month_after",
          effect: { mental: 8, skills: { knowledge: 40, sociability: 15 } },
        },
      ],
    },
    {
      id: "the_month_after",
      intro: [
        "평가가 끝났습니다. 순위는 두 계단 올랐습니다. 해체 검토는 보류됐습니다.",
        "보류입니다. 취소가 아니라 보류라고 본부에서 정확히 그렇게 적어 보냈습니다.",
        "부대원들이 그걸 보고 웃더군요. '보류면 또 하면 되죠'라고요.",
        "…저는 그 말을 들으려고 한 달을 버틴 것 같습니다. 커피는 두 잔으로 줄였습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이제 혼자 안 들잖아요. 그게 제일 큰 성과예요",
          reply: "…성과로 세도 되는 겁니까. 그럼 이번 달 성과는 그걸로 적겠습니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 8,
            followers: 320,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "두 계단은 셋이 짠 계획이 올린 거예요. 그것도 적어두세요",
          reply: "…적겠습니다. 잘한 작전은 부대원 공이라고 제가 늘 써왔으니까요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그래서 대행이라는 말은 언제 뗄 건데요",
          reply: "…안 떼도 상관없습니다. 절반짜리 권한으로 여기까지 왔으면 된 거 아닙니까.",
          next: null,
          effect: {
            mental: 12,
            followers: 350,
            skills: { knowledge: 40, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 궤도 계산 오퍼레이터 — 화면 여덟 개를 보며 좌표를 불러주는 후방 담당(`data/accounts.ts` field_operator).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 칭찬받는 자리가 아닌 곳의 글이 퍼진 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'고정시킨 목소리'**다. 그는 매번 손에 땀이 나지만 목소리만은 훈련으로 굳혔다.
 * 재능이 아니라 반복이고, 그래서 남에게 물려줄 수 있다 — 그걸 3회차에 실제로 한다.
 *
 * ⚠️ 말투는 **짧고 정확한 존댓말**이다. 표정 없는 저격수(silent_sniper)와 겹치지 않게 하라 —
 *    저격수는 **자기 자리를 고르는** 인물, 오퍼레이터는 **남의 자리를 불러주는** 인물이다.
 *    저격수가 결과를 먼저 적는다면, 이쪽은 **시간을 먼저 적는다**(몇 초 늦었는지).
 * ⚠️ 그를 무력한 사람으로 그리지 마라. "좌표 하나가 사람을 살린다"를 이미 알고 있는 인물이다.
 * ⚠️ 실제 장비명·주파수·군 용어를 만들지 마라. 화면·좌표·로그·통신까지만 쓴다.
 * 줄기: 1회차 화면 밖 → 2회차 반 초 늦은 좌표 → 3회차 후배에게 뭘 먼저 가르칠 것인가.
 */
export const OPERATOR_STORY: DmStory = {
  id: "operator_1",
  partnerName: "궤도 계산 오퍼레이터",
  partnerHandle: "field_operator",
  arrivalTitle: "궤도 계산 오퍼레이터의 DM",
  startNode: "off_screen",
  nodes: [
    {
      id: "off_screen",
      intro: [
        "제 글을 퍼가셨더군요. 후방 얘기가 밖으로 나가는 건 드문 일입니다.",
        "지시는 짧게 하는 편입니다. DM도 짧을 겁니다. 미리 말씀드립니다.",
        "화면 여덟 개를 동시에 봅니다. 익숙해지면 됩니다. 그건 문제가 아닙니다.",
        "…문제는 화면 밖입니다. 거기서 벌어지는 일은 못 봅니다. 그게 제 한계입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "한계를 알고 있는 게 이미 실력이에요",
          reply: "…그렇게 정리해주시는군요. 저는 그걸 매번 부족으로만 세고 있었습니다.",
          next: "the_sweat",
          effect: { skills: { sociability: 15, it: 10 } },
        },
        {
          tone: "cool",
          me: "화면 밖을 보려 하지 말고 화면을 옮기면 되잖아요",
          reply: "…옮기는 데 3초가 듭니다. 3초면 상황이 두 번 바뀝니다. 그래서 안 옮깁니다.",
          next: "the_sweat",
          effect: { skills: { knowledge: 25, it: 10 } },
        },
        {
          tone: "bold",
          me: "여덟 개를 보는 게 아니라 여덟 개에 갇힌 거 아니에요?",
          reply: "…갇혔다. 그 표현은 처음 듣습니다. 부정은 못 하겠습니다.",
          next: "the_sweat",
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_sweat",
      intro: [
        "부대원들은 제가 늘 침착하다고 생각합니다. 사실은 매번 손에 땀이 납니다.",
        "목소리만 훈련으로 고정시켰습니다. 제가 떨면 저쪽에서 판단이 흐려지니까요.",
        "재능이 아니라 반복해서 몸에 붙인 기술입니다. 그건 확실합니다.",
        "…그런데 요즘 그 기술이 저한테도 통합니다. 제가 안 떠는 줄 알게 됐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 통한 게 아니라 익숙해진 거예요",
          reply: "…익숙해진 것과 없어진 것은 다르군요. 하루 생각해보겠습니다.",
          next: "the_hands",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "안 떠는 줄 알면 위험해요. 손은 여전히 젖어 있을 텐데요",
          reply: "…확인해보겠습니다. 오늘 훈련에서 손만 따로 보겠습니다.",
          next: "the_hands",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "떨어도 돼요. 목소리만 안 떨면 되잖아요",
          reply: "…그렇게 나눠도 되는 겁니까. 그건 편한 생각인데, 하루 두고 보겠습니다.",
          next: "the_hands",
          delayDays: 1,
          effect: { mental: 4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_hands",
      intro: [
        "확인했습니다. 손은 여전히 젖습니다. 오늘도 그랬습니다.",
        "다만 예전과 다른 게 하나 있습니다. 땀이 나는 시점이 늦어졌습니다.",
        "예전엔 통신을 켜는 순간이었는데, 지금은 첫 좌표를 부른 다음입니다.",
        "…부른 다음에 떠는 건 괜찮습니다. 그 순서면 아무도 안 다칩니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 순서를 만든 게 3년치 훈련이에요",
          reply: "…3년입니다. 정확히는 3년 4개월이고요. 그걸 세본 적이 없었습니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, it: 15 } },
        },
        {
          tone: "cool",
          me: "떨림을 없앤 게 아니라 뒤로 미룬 거네요. 그게 더 안전해요",
          reply: "…미뤘다. 정확한 표현입니다. 기록에 그렇게 적겠습니다.",
          next: null,
          effect: { skills: { knowledge: 40, it: 10 } },
        },
        {
          tone: "bold",
          me: "그럼 다 끝나고는 떨어요? 아니면 그것도 참아요?",
          reply: "…다 쓰고 나서 처리합니다. 감정은 마지막에 몰아서요. 그렇게 배웠습니다.",
          next: null,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 궤도 계산 오퍼레이터 2회차 — 반 초.
 * 축은 **'늦은 좌표'**다. 아무도 안 다쳤지만 그는 로그를 처음부터 다시 본다.
 * ⚠️ 사고를 내지 마라 — 이 회차에서 다치는 사람은 없다. 그래서 더 오래 남는다.
 */
const OPERATOR_STORY_2: DmStory = {
  id: "operator_2",
  partnerName: "궤도 계산 오퍼레이터",
  partnerHandle: "field_operator",
  arrivalTitle: "궤도 계산 오퍼레이터의 DM",
  startNode: "half_second",
  nodes: [
    {
      id: "half_second",
      intro: [
        "어제 좌표를 반 초 늦게 불렀습니다. 결과는 아무 일 없었습니다.",
        "부대원은 알아채지도 못했습니다. 로그를 봐야 보이는 차이입니다.",
        "그런데 저는 그 로그를 어젯밤에 여섯 번 돌려봤습니다.",
        "…아무 일 없었는데 여섯 번 본 건 좀 이상한 것 같기도 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "여섯 번 본 사람이라 반 초로 끝난 거예요",
          reply: "…인과가 반대군요. 저는 반 초 때문에 여섯 번 본 줄 알았습니다.",
          next: "where_it_slipped",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "여섯 번 봤으면 원인은 찾았어요?",
          reply: "…못 찾았습니다. 그래서 여섯 번이었습니다. 오늘 한 번 더 보겠습니다.",
          next: "where_it_slipped",
          delayDays: 1,
          effect: { skills: { knowledge: 30, it: 15 } },
        },
        {
          tone: "bold",
          me: "이상한 거 맞아요. 아무 일 없는 걸 여섯 번 보면 다음이 늦어져요",
          reply: "…그 지적은 아픕니다. 확인해보겠습니다. 내일 답하겠습니다.",
          next: "where_it_slipped",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "where_it_slipped",
      intro: [
        "찾았습니다. 화면 배치를 바꾼 날이었습니다. 3주 전에 제가 직접 바꿨고요.",
        "더 효율적인 배치였습니다. 실제로 다른 지표는 다 좋아졌습니다.",
        "그런데 제 눈이 3년 동안 외운 순서는 옛 배치입니다. 그 차이가 반 초입니다.",
        "…효율을 올렸더니 사람이 느려졌습니다. 이런 건 어디에도 안 적혀 있습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "돌려놓으세요. 지표보다 반 초가 중요해요",
          reply: "…돌려놓겠습니다. 지표는 제가 보는 거고 좌표는 사람이 받는 거니까요.",
          next: "what_i_log",
          effect: { mental: 8, skills: { sociability: 25, it: 15 } },
        },
        {
          tone: "cool",
          me: "새 배치로 3년을 다시 외우는 방법도 있어요. 지금 바꾸면 나중엔 이득이고요",
          reply: "…그 계산도 맞습니다. 다만 그 사이의 반 초는 누가 지느냐가 문제입니다.",
          next: "what_i_log",
          effect: { skills: { knowledge: 40, it: 20 } },
        },
        {
          tone: "bold",
          me: "3주 동안 몰랐다는 게 진짜 문제인데요",
          reply: "…네. 그게 본론입니다. 지표만 보고 제 손은 안 보고 있었습니다.",
          next: "what_i_log",
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_i_log",
      intro: [
        "배치는 절반만 되돌렸습니다. 자주 쓰는 넷은 옛 자리로, 나머지 넷은 새 자리로요.",
        "그리고 로그에 칸을 하나 만들었습니다. '내가 바꾼 것' 칸입니다.",
        "장비를 바꾸면 적습니다. 자리를 바꿔도 적고요. 3주 뒤에 그 칸부터 봅니다.",
        "…데이터는 거짓말을 안 합니다. 해석하는 사람이 틀릴 뿐입니다. 제가 그랬습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "틀린 걸 찾아낸 것도 같은 사람이잖아요",
          reply: "…그렇게 세면 손해는 아니군요. 그 칸은 계속 두겠습니다.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { sociability: 30, it: 15 } },
        },
        {
          tone: "cool",
          me: "절반만 되돌린 게 제일 어려운 답이에요. 전부는 쉬웠을 텐데",
          reply: "…전부 되돌리면 3주가 사라집니다. 그건 아깝습니다.",
          next: null,
          effect: { mental: 8, followers: 200, skills: { knowledge: 45, it: 20 } },
        },
        {
          tone: "bold",
          me: "그 칸 만든 거, 다음 오퍼레이터한테는 3주를 아껴주는 거예요",
          reply: "…후배가 곧 들어옵니다. 그 얘긴 다음에 하겠습니다. 준비가 안 됐습니다.",
          next: null,
          effect: { mental: 6, followers: 220, skills: { knowledge: 35, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 궤도 계산 오퍼레이터 3회차 — 뭘 먼저 가르칠 것인가.
 * 후배 오퍼레이터의 첫 실전. 축은 **'통신을 넘기는 순간'**이다.
 * ⚠️ 후배를 실패시키지 마라. 후배는 해내고, 그가 배우는 건 **넘기는 법**이다.
 */
const OPERATOR_STORY_3: DmStory = {
  id: "operator_3",
  partnerName: "궤도 계산 오퍼레이터",
  partnerHandle: "field_operator",
  arrivalTitle: "궤도 계산 오퍼레이터의 DM",
  startNode: "the_junior",
  nodes: [
    {
      id: "the_junior",
      intro: [
        "후배 오퍼레이터의 첫 실전이 다음 주입니다. 제가 옆에 앉습니다.",
        "뭘 먼저 알려줘야 할지 두 달째 고민 중입니다. 화면 보는 법은 아닙니다. 그건 금방 늡니다.",
        "지도 외우는 것도 아닙니다. 시간이 해결합니다.",
        "…제가 3년 걸려 익힌 건 목소리를 고정시키는 겁니다. 그건 어떻게 가르칩니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "손에 땀 난다고 먼저 말해주세요. 그거면 돼요",
          reply: "…제가 떤다는 걸 알려주라는 말씀입니까. 그건 생각도 못 했습니다.",
          next: "the_first_call",
          delayDays: 1,
          effect: { skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "숨 고르는 법부터요. 본인이 긴급 상황 첫 순서라고 썼잖아요",
          reply: "…제가 쓴 걸 제가 안 쓰고 있었군요. 그것부터 시키겠습니다.",
          next: "the_first_call",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "가르치지 말고 마이크를 주세요. 두 달 고민할 일이 아니에요",
          reply: "…첫 실전에 마이크를요. …하룻밤 생각해보겠습니다. 무서운 제안입니다.",
          next: "the_first_call",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_first_call",
      intro: [
        "실전이었습니다. 제가 앞의 절반, 후배가 뒤의 절반을 맡았습니다.",
        "넘기기 직전에 딱 한 마디 했습니다. '나도 매번 손에 땀이 난다. 목소리만 붙잡아라.'",
        "후배가 저를 한 번 보더니 마이크를 켰습니다. 목소리가 안 떨렸습니다.",
        "…제 3년치를 한 문장으로 넘긴 겁니다. 이래도 되는 건지 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "돼요. 그 한 문장이 3년을 압축한 거예요",
          reply: "…압축. 그렇게 부를 수 있군요. 그럼 제 3년은 안 사라진 겁니다.",
          next: "the_same_seat",
          effect: { mental: 15, skills: { sociability: 30, it: 15 } },
        },
        {
          tone: "cool",
          me: "안 떤 게 아니라 붙잡은 거예요. 그 애도 지금 손이 젖어 있을걸요",
          reply: "…확인해봤습니다. 젖어 있었습니다. 저는 그게 왜 반가웠을까요.",
          next: "the_same_seat",
          effect: { mental: 10, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "3년치를 한 문장으로 넘긴 게 아까워요?",
          reply: "…아깝습니다. 그런데 아까워하는 게 더 부끄럽습니다. 둘 다 사실입니다.",
          next: "the_same_seat",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_same_seat",
      intro: [
        "작전이 끝나고 전원 무사히 돌아왔습니다. 오늘 통신은 깨끗했습니다.",
        "후배가 끝나고 손을 계속 바지에 닦더군요. 저도 첫 실전에 그랬습니다.",
        "제 목소리가 마지막으로 들리는 목소리가 되지 않게 하는 것. 그게 제 원칙입니다.",
        "…이제 그 원칙을 지키는 사람이 둘입니다. 내일도 같은 자리에 있겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘이면 화면이 열여섯 개네요. 화면 밖이 줄었어요",
          reply: "…계산이 그렇게 되는군요. 제 한계가 오늘 절반이 됐습니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, it: 20 },
          },
        },
        {
          tone: "cool",
          me: "원칙을 물려준 게 좌표 하나보다 오래 갑니다",
          reply: "…오래 갑니다. 저는 초 단위로만 세는 사람이라 그 단위는 낯섭니다.",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "이제 후배 손 젖는 것까지 화면에 띄우려는 건 아니죠?",
          reply: "…그건 화면 밖입니다. 거기까지는 안 봅니다. 그건 그 애 겁니다.",
          next: null,
          effect: { mental: 12, followers: 280, skills: { knowledge: 35, sociability: 25 } },
        },
      ],
    },
  ],
};

/**
 * 방패만 파는 방어수 — 공격 트리거를 안 쓰고 막기만 하는 방어수(`data/accounts.ts` shield_only).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 점수판에 안 오르는 자리에 온 반응이 1회차의 문이다.
 *
 * 이 스토리의 축은 **'늦는 것'**이다. 그가 제일 무서워하는 건 못 막는 게 아니라 늦게 도착하는 것이고,
 * 3회차에서 실제로 늦는다. 그 뒤에 어떻게 다시 서느냐가 이 이야기다.
 *
 * ⚠️ 말투는 **담백한 존댓말**이다. 먹보 신입(hungry_attacker)과 겹치지 않게 하라 —
 *    그쪽은 **자리를 얻으려는 신입**, 이쪽은 **자리가 확고한 사람**이다. 이쪽은 자기 실력을 의심하지 않는다.
 * ⚠️ 그에게 공격 트리거를 쥐여주지 마라. 손이 두 개라 하나만 확실히 하는 쪽을 고른 인물이다.
 * ⚠️ 3회차에서 다친 사람을 죽이지 마라 — "다쳤다"까지만 쓰고 복귀는 열어둔다.
 * 줄기: 1회차 열두 번 막고 한 번 뚫린 그 한 번 → 2회차 방패 들고 뛰는 연습 → 3회차 늦은 날.
 */
export const SHIELD_STORY: DmStory = {
  id: "shield_1",
  partnerName: "방패만 파는 방어수",
  partnerHandle: "shield_only",
  arrivalTitle: "방패만 파는 방어수의 DM",
  startNode: "the_one_that_got_through",
  nodes: [
    {
      id: "the_one_that_got_through",
      intro: [
        "좋아요 감사합니다. 제 글은 볼 게 없어서 반응이 잘 없습니다.",
        "오늘 열두 번 막았고 한 번 뚫렸습니다. 그 한 번을 복기 중입니다.",
        "열두 번은 안 셉니다. 막은 건 원래 집계를 안 하니까요.",
        "…그런데 뚫린 한 번은 제가 셉니다. 이게 공평한 건지는 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "열두 번도 세세요. 본인이라도 세야죠",
          reply: "…제가 세면 됩니까. 그건 생각 안 해봤습니다. 오늘부터 세보겠습니다.",
          next: "why_shield",
          effect: { mental: 5, skills: { sociability: 15, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "뚫린 한 번을 세는 건 맞아요. 대신 열둘 뒤에 하나라고 쓰세요",
          reply: "…순서를 붙이라는 말씀이군요. 그러면 숫자가 달라 보이긴 하겠습니다.",
          next: "why_shield",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "공평 따질 자리 아니잖아요. 그 한 번에 사람이 맞았으면 그게 전부죠",
          reply: "…맞습니다. 그래서 열둘은 안 셉니다. 그건 제 얘기가 아니라 그 사람 얘기니까요.",
          next: "why_shield",
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "why_shield",
      intro: [
        "다들 왜 공격 트리거를 안 쓰냐고 묻습니다. 대단한 이유는 없습니다.",
        "손이 두 개고, 방패 하나 드는 것만으로도 벅찹니다. 그게 전부입니다.",
        "재능 있는 사람은 둘 다 하겠지만 저는 하나만 확실히 하는 쪽을 골랐습니다.",
        "…후회한 적은 아직 없습니다. '아직'이라고 쓴 건 습관입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "'아직'을 붙이는 사람이 오래 해요",
          reply: "…오래 하는 게 목표이긴 합니다. 끝까지 서 있어야 하는 자리라서요.",
          next: "the_habit",
          delayDays: 1,
          effect: { skills: { sociability: 20, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "하나만 확실히 하는 게 제일 어려운 선택이에요",
          reply: "…어려운 줄은 몰랐습니다. 저는 쉬운 쪽을 고른 줄 알았습니다.",
          next: "the_habit",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "벅차서 하나만 든다는 건 변명이에요. 진짜 이유가 있을 텐데요",
          reply: "…있습니다. 하룻밤 정리해서 쓰겠습니다. 짧게 쓸 자신이 없어서요.",
          next: "the_habit",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_habit",
      intro: [
        "정리했습니다. 진짜 이유는 습관입니다.",
        "저는 약해 보이는 사람 뒤에 서는 게 습관이 됐습니다. 훈련생 때부터요.",
        "공격 트리거를 들면 그 습관을 못 지킵니다. 앞으로 나가야 하니까요.",
        "…제가 고른 게 아니라 습관이 고른 걸 수도 있겠습니다. 그래도 바꿀 생각은 없습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "습관이 고른 것도 본인이 고른 거예요",
          reply: "…그렇게 되나요. 그럼 제 선택이 맞다고 해두겠습니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "그 습관이 언제 생겼는지가 진짜 이유겠네요",
          reply: "…그건 안 적겠습니다. 오래된 얘기고, 지금 하는 일이랑 상관없습니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "안 바꾼다면서 왜 이유를 정리했어요? 흔들린 거잖아요",
          reply: "…흔들린 건 맞습니다. 정리하고 나니 안 흔들립니다. 그래서 썼습니다.",
          next: null,
          effect: { mental: -3, followers: 150, skills: { knowledge: 30, fitness: 15 } },
        },
      ],
    },
  ],
};

/**
 * 방패만 파는 방어수 2회차 — 뛰는 연습.
 * 축은 **'도착'**이다. 막는 기술이 아니라 거리를 줄이는 훈련에 그는 절반을 쓴다.
 * ⚠️ 그를 빠르게 만들지 마라. 이 회차에서 늘어나는 건 속도가 아니라 **출발 판단**이다.
 */
const SHIELD_STORY_2: DmStory = {
  id: "shield_2",
  partnerName: "방패만 파는 방어수",
  partnerHandle: "shield_only",
  arrivalTitle: "방패만 파는 방어수의 DM",
  startNode: "running_drill",
  nodes: [
    {
      id: "running_drill",
      intro: [
        "제 훈련의 절반은 뛰는 연습입니다. 방패 든 채로 뛰는 게 생각보다 어렵습니다.",
        "막는 건 이미 됩니다. 문제는 거기 도착하는 겁니다.",
        "못 막으면 최소한 같이 맞기라도 하는데, 늦으면 저 혼자 멀쩡합니다.",
        "…그 그림이 제일 싫습니다. 그래서 뜁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "혼자 멀쩡한 게 왜 싫은지는 알 것 같아요",
          reply: "…아신다니 더 설명 안 하겠습니다. 그게 편합니다.",
          next: "the_start",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "속도를 늘리지 말고 출발을 당기세요. 거리는 그대로예요",
          reply: "…출발이요. 저는 다리만 보고 있었습니다. 내일 그것부터 재보겠습니다.",
          next: "the_start",
          delayDays: 1,
          effect: { skills: { knowledge: 30, fitness: 15 } },
        },
        {
          tone: "bold",
          me: "그 그림이 싫어서 뛰는 거면 훈련이 아니라 죄책감이에요",
          reply: "…구분이 안 됩니다. 하루 생각해보겠습니다.",
          next: "the_start",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_start",
      intro: [
        "출발을 재봤습니다. 제가 뛰기 시작하는 시점이 남들보다 0.8초 늦었습니다.",
        "이유는 알겠더군요. 저는 확실해지고 나서 출발합니다. 헛걸음이 싫어서요.",
        "그런데 헛걸음이 뭐가 문제입니까. 늦는 것보다 백 배 낫습니다.",
        "…이걸 이제 알았습니다. 3년 동안 확실해지기를 기다렸습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이제 알았으면 된 거예요. 내일부터 헛걸음하세요",
          reply: "…헛걸음을 하라는 말을 이렇게 시원하게 듣는 것도 처음입니다.",
          next: "twelve_steps",
          effect: { mental: 10, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "확실해지고 출발하는 건 관찰이 좋다는 뜻이기도 해요. 그건 버리지 마세요",
          reply: "…버리라는 말이 아니라 순서를 바꾸라는 거군요. 알겠습니다.",
          next: "twelve_steps",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "0.8초면 사람 하나예요. 3년치를 세보면 몇 명인데요",
          reply: "…세지 않겠습니다. 세면 내일 못 나갑니다. 그건 아시고 물으신 거겠지만요.",
          next: "twelve_steps",
          effect: { mental: -8, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "twelve_steps",
      intro: [
        "오늘 헛걸음을 네 번 했습니다. 네 번 다 필요 없는 이동이었습니다.",
        "그런데 다섯 번째는 필요했습니다. 0.8초 빨리 도착해서 막았습니다.",
        "부대원이 '오늘 빨랐다'고 했습니다. 저는 안 빨라졌습니다. 일찍 출발했을 뿐입니다.",
        "…그 차이를 설명하려다 말았습니다. 어색해서 그냥 웃었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "설명 안 해도 돼요. 결과가 같으니까요",
          reply: "…결과가 같습니다. 그럼 된 겁니다. 그렇게 두겠습니다.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { sociability: 30, fitness: 20 } },
        },
        {
          tone: "cool",
          me: "헛걸음 넷이 다섯 번째를 만든 거예요. 그게 비용이고요",
          reply: "…비용. 그렇게 세면 넷도 아깝지 않습니다. 좋은 계산입니다.",
          next: null,
          effect: { mental: 8, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "웃지 말고 설명하세요. 그거 부대원도 배워야 하는 거예요",
          reply: "…그건 맞습니다. 다음엔 설명하겠습니다. 짧게 하겠습니다.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 35, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 방패만 파는 방어수 3회차 — 늦은 날.
 * 그가 제일 무서워하던 일이 일어난다. 축은 **'혼자 멀쩡한 것'**이다.
 * ⚠️ 그를 그만두게 하지 마라. 이 회차의 결말은 그가 **다음 날 제일 먼저 훈련장에 나가는 것**이다.
 */
const SHIELD_STORY_3: DmStory = {
  id: "shield_3",
  partnerName: "방패만 파는 방어수",
  partnerHandle: "shield_only",
  arrivalTitle: "방패만 파는 방어수의 DM",
  startNode: "the_day_i_was_late",
  nodes: [
    {
      id: "the_day_i_was_late",
      intro: [
        "오늘 늦었습니다. 결국 그 날이 왔습니다.",
        "제일 뒤에 있던 부대원이 다쳤습니다. 제가 반대쪽을 보고 있었습니다.",
        "출발은 빨랐습니다. 방향이 틀렸습니다. 그건 뛰는 연습으로 못 고치는 겁니다.",
        "…저는 멀쩡합니다. 그게 제일 견디기 어렵습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "지금 그 부대원 옆에 가 계세요. 나머지는 나중에 하고요",
          reply: "…지금 병실 앞입니다. 못 들어가고 있습니다. 하룻밤 있다 다시 쓰겠습니다.",
          next: "what_he_said",
          delayDays: 1,
          effect: { mental: -5, morality: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "방향이 틀린 건 정보 문제예요. 혼자 지는 게 아니에요",
          reply: "…혼자 진 게 아니라고 해주시는군요. 지금은 잘 안 들립니다. 내일 다시 쓰겠습니다.",
          next: "what_he_said",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "멀쩡한 게 견디기 어려우면 그건 본인 생각만 하는 거예요",
          reply: "…네. 맞습니다. 그 말 듣고 정신이 좀 들었습니다. 내일 답하겠습니다.",
          next: "what_he_said",
          delayDays: 1,
          effect: { mental: -8, morality: 8, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_he_said",
      intro: [
        "들어갔습니다. 그 부대원이 저를 보자마자 한 말이 '왜 그런 얼굴이냐'였습니다.",
        "미안하다고 했더니 '선배 뒤에 있던 사람은 안 다쳤잖아요'라고 하더군요.",
        "그날 제 뒤에는 셋이 있었습니다. 셋은 멀쩡합니다. 그것도 사실입니다.",
        "…그런데 저는 그 셋을 세는 사람이 아닙니다. 뚫린 하나를 세는 사람입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "오늘은 셋을 세세요. 딱 오늘만요",
          reply: "…오늘만. 그 정도면 해볼 수 있을 것 같습니다. 해보겠습니다.",
          next: "the_next_morning",
          effect: { mental: 10, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "둘 다 세세요. 셋을 안 세면 다음에 왜 서는지를 잊어요",
          reply: "…둘 다. 표를 두 개 만들면 되겠군요. 그건 제가 할 수 있습니다.",
          next: "the_next_morning",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 사람은 위로한 게 아니라 사실을 말한 거예요. 받아들이세요",
          reply: "…사실입니다. 위로로 들으면 그 사람 말을 무시하는 거군요. 받겠습니다.",
          next: "the_next_morning",
          effect: { mental: 6, skills: { knowledge: 40, sociability: 15 } },
        },
      ],
    },
    {
      id: "the_next_morning",
      intro: [
        "다음 날 훈련장에 제일 먼저 나갔습니다. 평소보다 한 시간 일찍요.",
        "뛰는 연습은 그대로 하되, 오늘부터 시야 훈련을 붙였습니다. 뒤를 도는 연습입니다.",
        "부대장이 나와서 보더니 아무 말 없이 반대쪽에 서주더군요. 시야 밖에서요.",
        "…언젠가 제가 못 막는 날이 또 오겠죠. 그때까지는 막습니다. 그건 안 바뀝니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거면 됐어요. 다시 서는 게 제일 어려운 거예요",
          reply: "…어려웠습니다. 하루 걸렸습니다. 그 하루는 기록에 안 적겠습니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 20 },
          },
        },
        {
          tone: "cool",
          me: "부대장이 시야 밖에 선 건 훈련 상대를 해준 거예요. 말 없이요",
          reply: "…그렇습니다. 그 사람은 원래 말로 안 합니다. 저도 그래서 편합니다.",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그날 못 막은 건 계속 남을 거예요. 지우려 하지 마세요",
          reply: "…안 지웁니다. 겨우 막은 날이 기억에 남는데, 못 막은 날이 안 남겠습니까.",
          next: null,
          effect: {
            mental: 10,
            morality: 8,
            followers: 280,
            skills: { knowledge: 40, fitness: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 쌍둥이 공격수 형 — 3분 먼저 태어나 평생 형 노릇 중인 공격수(`data/accounts.ts` twin_blade_elder).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(핸들이 달라 다른 좋아요 계정과 겹쳐도 된다).
 *
 * 이 스토리의 축은 **'갈라지지 않는 것'**이다. 따로 부대에 들어가라는 제안을 세 번 거절했고,
 * 실력만 보면 갈라지는 게 맞다는 것도 안다. 붙어 있는 게 판단인지 겁인지가 3회차의 질문이다.
 *
 * ⚠️ 말투는 **말 많은 존댓말**이다("~습니다"를 쓰되 문장이 길고 자꾸 덧붙인다). 스프린터 형제
 *    (smile_sprint·bro_sprint)와 축이 겹치지 않게 하라 — 그쪽은 **이름으로 불리기와 은퇴**,
 *    이쪽은 **갈라짐**이다. 이 형은 동생을 이기고 싶어 하지 않는다.
 * ⚠️ 동생(twin_blade_younger)의 결정을 이 스토리에서 확정하지 마라 — 형 시점의 추측까지만 쓴다.
 * ⚠️ 동생을 이름으로 부르지 마라. 형은 "동생"으로만 부른다.
 * 줄기: 1회차 세 번째 거절 → 2회차 동생이 혼자 해낸 날 → 3회차 갈라지는 작전.
 */
export const TWIN_ELDER_STORY: DmStory = {
  id: "twin_elder_1",
  partnerName: "쌍둥이 공격수 형",
  partnerHandle: "twin_blade_elder",
  arrivalTitle: "쌍둥이 공격수 형의 DM",
  startNode: "third_refusal",
  nodes: [
    {
      id: "third_refusal",
      intro: [
        "좋아요 감사합니다! 저희 계정에 반응 오면 둘이 같이 봅니다. 방금도 같이 봤습니다",
        "…아, 지금은 저 혼자입니다. 동생은 씻으러 갔습니다. 이건 저 혼자 쓰는 겁니다.",
        "따로 부대에 들어가라는 제안을 세 번 받았고 세 번 다 거절했습니다.",
        "실력만 보면 갈라지는 게 맞다는 것도 압니다. 근데 매번 그냥 싫다고 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "싫으면 싫은 거죠. 이유가 더 필요해요?",
          reply: "…그렇게 말해주시니 편합니다. 매번 이유를 대라고 하거든요.",
          next: "one_plus_one",
          effect: { mental: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "세 번 다 같은 이유로 거절했어요?",
          reply: "…네. 셋이 되거든요. 저희 둘이 붙으면 둘이 아니라 셋쯤 됩니다.",
          next: "one_plus_one",
          effect: { skills: { knowledge: 20, game: 10 } },
        },
        {
          tone: "bold",
          me: "맞는 걸 알면서 안 하는 건 이유가 따로 있는 거죠",
          reply: "…있습니다. 그건 아직 안 적겠습니다. 적으면 진짜가 되니까요.",
          next: "one_plus_one",
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "one_plus_one",
      intro: [
        "저희 둘은 합공 훈련을 안 합니다. 말 안 해도 아니까요.",
        "제 검은 빠르고 동생 검은 정확합니다. 그래서 같이 씁니다.",
        "동생이 저보다 재능이 있습니다. 인정하는 데 몇 년 걸렸고, 인정하고 나니 편해졌습니다.",
        "…그래서 요즘은 속도만 팝니다. 제가 잘하는 걸 더 파는 쪽으로요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "인정하고 나서 더 잘하게 됐네요",
          reply: "…그렇습니다. 따라가려던 시절이 제일 못했습니다. 그건 확실합니다.",
          next: "the_number_three",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 20, game: 15 } },
        },
        {
          tone: "cool",
          me: "속도만 파면 갈라졌을 때도 쓸 수 있는 거잖아요",
          reply: "…그건 생각 안 해봤습니다. 하루 생각해보겠습니다.",
          next: "the_number_three",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "동생이 더 잘한다는 말을 자꾸 하는 것도 형 노릇이에요?",
          reply: "…아. 그럴 수도 있겠습니다. 하루 생각해보고 답하겠습니다.",
          next: "the_number_three",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_number_three",
      intro: [
        "생각해봤는데, 셋이 된다는 걸 숫자로 설명할 방법이 없습니다.",
        "제가 실수하면 동생이 덮습니다. 반대도 그렇고요. 그래서 실수가 사라집니다.",
        "사라진 실수는 기록에 안 남습니다. 그러니까 셋이라는 증거도 없는 겁니다.",
        "…증거가 없는 걸 세 번이나 거절 사유로 댔네요. 이제 보니 그렇습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "증거가 없는 게 아니라 안 남는 거예요. 그건 달라요",
          reply: "…다릅니다. 그 말 동생한테도 해주고 싶은데, 제가 하면 좀 이상해서요.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, game: 15 } },
        },
        {
          tone: "cool",
          me: "사라진 실수를 세보세요. 다음 훈련부터요",
          reply: "…세본다. 그건 해볼 만합니다. 동생 몫도 같이 세겠습니다.",
          next: null,
          effect: { skills: { knowledge: 40, game: 15 } },
        },
        {
          tone: "bold",
          me: "네 번째 제안이 오면 그땐 뭐라고 하실 건데요",
          reply: "…또 싫다고 하겠죠. 그런데 이번엔 이유를 준비해두겠습니다.",
          next: null,
          effect: { mental: -3, followers: 150, skills: { knowledge: 30 } },
        },
      ],
    },
  ],
};

/**
 * 쌍둥이 공격수 형 2회차 — 혼자 해낸 날.
 * 축은 **'뿌듯하면서 서운한 것'**이다. 그는 그 감정을 숨기지 않되 동생 앞에서는 안 꺼낸다.
 * ⚠️ 형을 질투에 잡아먹히게 하지 마라. 이 인물은 동생 흉을 남한테 듣는 걸 못 참는 쪽이다.
 */
const TWIN_ELDER_STORY_2: DmStory = {
  id: "twin_elder_2",
  partnerName: "쌍둥이 공격수 형",
  partnerHandle: "twin_blade_elder",
  arrivalTitle: "쌍둥이 공격수 형의 DM",
  startNode: "he_did_it_alone",
  nodes: [
    {
      id: "he_did_it_alone",
      intro: [
        "어제 제가 부상으로 빠졌습니다. 가벼운 겁니다. 이틀이면 됩니다.",
        "그래서 동생이 혼자 나갔습니다. 저 없이 나간 건 처음입니다.",
        "잘했습니다. 아주 잘했습니다. 저희 둘이 나갔을 때보다 기록이 좋았습니다.",
        "…축하한다고 했습니다. 진심이었습니다. 그런데 밤에 잠이 안 왔습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "뿌듯하면서 서운한 거잖아요. 둘 다 진심이에요",
          reply: "…둘 다 진심. 그렇게 정리하면 제가 나쁜 형은 아닌 겁니까.",
          next: "what_it_means",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "기록이 좋았던 건 상대가 둘을 대비했기 때문일 수도 있어요",
          reply: "…그 계산도 됩니다. 그런데 그렇게 세면 동생한테 미안합니다.",
          next: "what_it_means",
          delayDays: 1,
          effect: { skills: { knowledge: 30, game: 15 } },
        },
        {
          tone: "bold",
          me: "동생은 이제 형 없이도 되는 거예요. 그게 무서운 거고요",
          reply: "…네. 그겁니다. 정확히 그겁니다. 하룻밤 더 생각해보겠습니다.",
          next: "what_it_means",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_it_means",
      intro: [
        "동생이 어제 저한테 그러더군요. '형 없으니까 앞에 서야 되더라.'",
        "저는 형이라서 늘 먼저 앞에 섭니다. 그게 저희 규칙이었습니다.",
        "그런데 그 규칙 때문에 동생은 앞에 서본 적이 없었던 겁니다. 9년 동안요.",
        "…제가 지켜준 게 아니라 못 하게 한 걸 수도 있겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "지켜준 게 맞아요. 이제 안 지켜도 되는 것뿐이고요",
          reply: "…안 지켜도 된다. 그건 좀 섭섭한 말인데 맞는 말입니다.",
          next: "the_rule_change",
          effect: { mental: 10, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "9년 동안 형이 앞에 선 이유가 규칙이었어요, 아니면 겁이었어요?",
          reply: "…겁입니다. 동생이 혼자 남는 그림이 자꾸 떠올라서요. 그게 다입니다.",
          next: "the_rule_change",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 규칙 누가 정했어요? 동생도 동의했어요?",
          reply: "…제가 정했습니다. 3분 먼저 태어났다는 이유로요. 물어본 적은 없습니다.",
          next: "the_rule_change",
          effect: { mental: -6, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_rule_change",
      intro: [
        "오늘 훈련에서 순서를 바꿔봤습니다. 동생을 앞에 세우고 제가 뒤에 섰습니다.",
        "이상했습니다. 등이 허전한 게 아니라 눈이 허전했습니다. 볼 게 없어서요.",
        "그런데 동생 등을 보는 게 나쁘지 않았습니다. 생각보다 넓더군요.",
        "…9년 만에 처음 봤습니다. 형이 뒤에서 보는 그림은 이렇게 생겼습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그것도 형이 하는 일이에요. 뒤에서 보는 거요",
          reply: "…그렇게 부를 수 있군요. 그럼 저는 아직 형 노릇 중인 겁니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35, game: 15 } },
        },
        {
          tone: "cool",
          me: "둘 다 앞에 설 수 있으면 상대는 대비를 두 배로 해야 해요",
          reply: "…그건 강해지는 얘기군요. 그렇게 들으니 순서 바꾸는 게 전략이 됩니다.",
          next: null,
          effect: { mental: 10, followers: 220, skills: { knowledge: 45, game: 20 } },
        },
        {
          tone: "bold",
          me: "이제 물어보세요. 9년 만에요",
          reply: "…물어보겠습니다. '너 앞에 서고 싶었냐'고요. 오늘 밥 먹으면서요.",
          next: null,
          effect: { mental: 8, followers: 250, skills: { knowledge: 35, sociability: 25 } },
        },
      ],
    },
  ],
};

/**
 * 쌍둥이 공격수 형 3회차 — 갈라지는 작전.
 * 둘을 나누는 작전이 실제로 내려온다. 축은 **'싫다'가 아니라 이유를 대는 것**이다.
 * ⚠️ 둘을 영영 갈라놓지 마라. 이 회차는 **한 판만** 갈라진다 — 그리고 그가 그걸 스스로 고른다.
 * ⚠️ 동생의 대답을 확정하지 마라(동생 계정 스토리는 따로다). 형이 들은 말까지만 쓴다.
 */
const TWIN_ELDER_STORY_3: DmStory = {
  id: "twin_elder_3",
  partnerName: "쌍둥이 공격수 형",
  partnerHandle: "twin_blade_elder",
  arrivalTitle: "쌍둥이 공격수 형의 DM",
  startNode: "the_split_plan",
  nodes: [
    {
      id: "the_split_plan",
      intro: [
        "작전이 내려왔습니다. 저희 둘을 갈라서 양쪽에 하나씩 붙이는 안입니다.",
        "지금까지는 이런 안이 오면 제가 제일 먼저 지웠습니다. 매번 그랬습니다.",
        "이번엔 부대장이 저를 따로 불러서 물었습니다. '왜 안 되는지 말해봐라'라고요.",
        "…싫다는 말 말고는 준비한 게 없었습니다. 그게 3년째입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이번엔 동생한테 먼저 물어보세요. 형 혼자 정할 일이 아니에요",
          reply: "…물어보겠습니다. 사실 제일 안 물어본 사람이 동생입니다. 하루 주십시오.",
          next: "what_he_answered",
          delayDays: 1,
          effect: { skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "한 판만 해보겠다고 하세요. 안 되면 근거가 생기는 거고요",
          reply: "…한 판. 그건 생각 못 했습니다. 전부 아니면 전무로만 봤습니다.",
          next: "what_he_answered",
          delayDays: 1,
          effect: { skills: { knowledge: 40, game: 15 } },
        },
        {
          tone: "bold",
          me: "3년 동안 이유를 못 만든 건 이유가 없어서예요",
          reply: "…아플 정도로 맞는 말입니다. 하룻밤 생각하고 답하겠습니다.",
          next: "what_he_answered",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_he_answered",
      intro: [
        "동생한테 물었습니다. 갈라지는 작전 어떻게 생각하냐고요.",
        "'형이 싫으면 안 하는 거 아니었어?'라고 되묻더군요. 그게 첫 대답이었습니다.",
        "제가 '내가 싫은 거 말고 네 생각'을 물었더니 한참 있다가 말했습니다.",
        "…'한 번은 해보고 싶었어.' 9년 동안 그 말을 안 했던 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어봐서 나온 말이에요. 안 물었으면 9년 더 갔어요",
          reply: "…9년 더. 그 그림이 더 무섭습니다. 물어보길 잘했습니다.",
          next: "one_match",
          effect: { mental: 12, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "'형이 싫으면 안 한다'가 9년치 대답이에요. 그게 문제였고요",
          reply: "…제 기준으로 살게 만든 겁니다. 지켜준 줄 알았는데요.",
          next: "one_match",
          effect: { mental: -5, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "한참 있다가 말한 게 답이에요. 하기 싫었으면 바로 말했죠",
          reply: "…바로 말했겠죠. 그 한참이 9년이었던 겁니다.",
          next: "one_match",
          effect: { mental: -3, skills: { knowledge: 40, sociability: 20 } },
        },
      ],
    },
    {
      id: "one_match",
      intro: [
        "한 판만 갈라서 나갔습니다. 제가 부대장한테 그렇게 제안했습니다.",
        "결과는 둘 다 살아 돌아왔습니다. 성적은 평범했고요.",
        "제일 무서웠던 건 화면에 동생이 안 보이는 시간이었습니다. 11분이었습니다.",
        "…그런데 11분 뒤에 멀쩡히 나타나더군요. 그거면 됐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "11분을 견뎠으면 다음엔 20분도 돼요",
          reply: "…되겠습니까. 되겠죠. 오늘은 11분까지만 인정하겠습니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, game: 20 },
          },
        },
        {
          tone: "cool",
          me: "성적이 평범한 게 제일 좋은 결과예요. 둘 다 나쁘지 않았다는 뜻이니까",
          reply: "…평범이 좋은 거였군요. 저는 그것도 증거로 못 쓴다고 생각했습니다.",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 50, game: 15 } },
        },
        {
          tone: "bold",
          me: "이제 언젠가 각자의 길 간다는 말, 진짜로 준비하세요",
          reply: "…준비하겠습니다. 아직은 아닙니다. 그런데 '아직'이 언제까지인지는 이제 압니다.",
          next: null,
          effect: {
            mental: 10,
            followers: 320,
            skills: { knowledge: 40, sociability: 25, game: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 쌍둥이 공격수 동생 — 3분 늦게 태어나 평생 동생인 공격수(`data/accounts.ts` twin_blade_younger).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 형이 둘 몫을 떠드는 계정에서 조용한 쪽 글이 퍼진 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'조용한 게 성격인가 형 때문인가'**다. 형(twin_blade_elder)이 '갈라지지 않는 것'을
 * 다룬다면 이쪽은 **'세트가 아닌 나'**를 다룬다. 같은 사건이 나와도 각도가 달라야 한다.
 *
 * ⚠️ 말투는 **짧고 담담한 존댓말**이다. 형은 문장이 길고 자꾸 덧붙이는데, 동생은 끊는다.
 *    두 계정을 나란히 읽었을 때 **누가 썼는지 문장 길이만으로 구분돼야** 한다.
 * ⚠️ 형을 원망하게 만들지 마라. 그는 형 흉을 남한테 듣는 걸 제일 못 참는 인물이다.
 * ⚠️ 형 계정의 회차 진행을 전제하지 마라 — 같은 사건도 이쪽에서 처음 듣는 것처럼 쓴다.
 * 줄기: 1회차 세트로 취급받는 것 → 2회차 형 없이 나간 딱 한 번 → 3회차 갈라진 11분.
 */
export const TWIN_YOUNGER_STORY: DmStory = {
  id: "twin_younger_1",
  partnerName: "쌍둥이 공격수 동생",
  partnerHandle: "twin_blade_younger",
  arrivalTitle: "쌍둥이 공격수 동생의 DM",
  startNode: "the_set",
  nodes: [
    {
      id: "the_set",
      intro: [
        "제 글을 퍼가셨더군요. 저희 계정은 대체로 형 글이 퍼집니다.",
        "형이 목소리가 큽니다. 글도 그렇습니다. 그게 저희 구분법입니다.",
        "쌍둥이로 산다는 건 늘 세트로 취급받는다는 뜻입니다.",
        "…어릴 땐 그게 싫어서 일부러 다른 걸 하려고 했습니다. 결국 같은 길로 왔지만요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "같은 길로 온 건 본인이 고른 거잖아요",
          reply: "…고른 겁니다. 그건 확실합니다. 그래서 지금은 안 싫습니다.",
          next: "who_is_quiet",
          effect: { skills: { sociability: 12, game: 10 } },
        },
        {
          tone: "cool",
          me: "구분법이 목소리 크기 하나면 좀 서운하겠네요",
          reply: "…서운합니다. 누가 저희를 구분해주면 그날은 기분이 좋습니다.",
          next: "who_is_quiet",
          effect: { skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "다른 걸 하려다 만 게 아니라 형 옆에 있고 싶었던 거죠",
          reply: "…부정은 안 하겠습니다. 혼자인 적이 한 번도 없었으니까요.",
          next: "who_is_quiet",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "who_is_quiet",
      intro: [
        "부대에서 제가 제일 조용한 편입니다. 형이 둘 몫을 떠들어서요.",
        "그런데 요즘 이런 생각이 듭니다. 조용한 게 제 성격입니까.",
        "형 옆에 9년 있었으면 조용해질 수밖에 없는 거 아닙니까.",
        "…이제 와서 구분이 안 됩니다. 이런 건 어떻게 알아냅니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "형 없는 자리에서 어떤지 보면 알아요",
          reply: "…형 없는 자리요. 그런 자리가 거의 없습니다. 하루 생각해보겠습니다.",
          next: "the_answer_twin",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "9년 조용했으면 그게 성격이에요. 원인이 뭐든",
          reply: "…원인은 상관없다는 말씀이군요. 하루 두고 보겠습니다.",
          next: "the_answer_twin",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "구분하고 싶은 건 성격이 아니라 형이랑 본인이잖아요",
          reply: "…그건 좀 정확한 말입니다. 하룻밤 생각하겠습니다.",
          next: "the_answer_twin",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_answer_twin",
      intro: [
        "혼자 훈련해봤습니다. 어제 두 시간요. 형한테는 말 안 했습니다.",
        "이상했습니다. 조용한데 안 편했습니다. 제 정확도가 8% 떨어졌습니다.",
        "형이 앞에서 벌어놓는 시간이 없으니 제가 서둘렀던 겁니다.",
        "…조용한 건 제 성격이 맞습니다. 다만 그 조용함은 형이 만들어준 자리였습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 알아낸 것만으로 오늘 잘한 거예요",
          reply: "…알아냈습니다. 형한테는 안 말할 겁니다. 우쭐할 테니까요.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, game: 15 } },
        },
        {
          tone: "cool",
          me: "8%면 생각보다 적어요. 혼자서도 92%는 된다는 뜻이고요",
          reply: "…그렇게 읽을 수도 있군요. 저는 떨어진 쪽만 보고 있었습니다.",
          next: null,
          effect: { skills: { knowledge: 40, game: 15 } },
        },
        {
          tone: "bold",
          me: "만들어준 자리에 계속 있을 건지는 본인이 정해야죠",
          reply: "…정해야 합니다. 아직은 못 정하겠습니다. 그건 솔직히 말하겠습니다.",
          next: null,
          effect: { mental: -4, followers: 150, skills: { knowledge: 30 } },
        },
      ],
    },
  ],
};

/**
 * 쌍둥이 공격수 동생 2회차 — 그 한 번.
 * 축은 **'기억이 안 나는 승리'**다. 형 없이 나간 딱 한 번, 그는 이겼는데 어떻게 싸웠는지 모른다.
 * ⚠️ 그 작전을 무용담으로 쓰지 마라. 이겼다는 사실 외에는 끝까지 공백으로 둔다.
 */
const TWIN_YOUNGER_STORY_2: DmStory = {
  id: "twin_younger_2",
  partnerName: "쌍둥이 공격수 동생",
  partnerHandle: "twin_blade_younger",
  arrivalTitle: "쌍둥이 공격수 동생의 DM",
  startNode: "the_one_time",
  nodes: [
    {
      id: "the_one_time",
      intro: [
        "형 없이 나간 작전이 딱 한 번 있었습니다. 2년 전입니다.",
        "이겼습니다. 그것만 압니다. 어떻게 싸웠는지는 기억이 안 납니다.",
        "돌아와서 형 얼굴을 보고 나서야 손이 떨리기 시작했습니다.",
        "…그 뒤로 단독 작전 요청은 다 거절합니다. 이유는 안 댔습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기억이 안 나는 건 그만큼 무서웠다는 뜻이에요",
          reply: "…무서웠던 겁니까. 저는 제가 집중했던 줄 알았습니다.",
          next: "the_shaking",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "돌아와서 떨린 건 그때까지 참았다는 거고요",
          reply: "…참은 겁니다. 제일 잘하는 게 참는 거라서요. 하루 생각해보겠습니다.",
          next: "the_shaking",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "거절하는 이유를 안 대면 다들 형 때문인 줄 알아요",
          reply: "…그렇게 보이겠군요. 실제로도 절반은 그렇고요. 하루 주십시오.",
          next: "the_shaking",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_shaking",
      intro: [
        "그날 기록을 2년 만에 열어봤습니다. 제 정확도가 평소보다 높았습니다.",
        "형이 없으면 8% 떨어져야 하는데 그날은 반대였습니다.",
        "…이유를 알겠습니다. 형이 없으니 제가 형 몫까지 봤던 겁니다.",
        "그래서 기억이 없는 겁니다. 제 몫을 볼 여유가 없었으니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그날 두 사람 몫을 한 거예요. 대단한 건데요",
          reply: "…대단하다기보다 무리한 겁니다. 두 번은 못 합니다.",
          next: "why_i_refuse",
          effect: { mental: 8, skills: { sociability: 25, game: 15 } },
        },
        {
          tone: "cool",
          me: "그럼 혼자서도 되는 게 아니라 혼자서는 한 번뿐인 거네요",
          reply: "…정확합니다. 그래서 거절합니다. 두 번째는 자신이 없습니다.",
          next: "why_i_refuse",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "형 몫을 본 게 아니라 형이 없어서 무서웠던 거예요",
          reply: "…둘 다일 겁니다. 구분해서 좋을 게 없어서 안 했습니다.",
          next: "why_i_refuse",
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "why_i_refuse",
      intro: [
        "형은 제가 자기보다 재능이 있다고 합니다. 그건 형이 못 보는 부분이 있어서입니다.",
        "형은 제가 검을 뻗기 전에 이미 세 걸음 앞에 가 있습니다. 그 속도는 평생 못 따라갑니다.",
        "그래서 재능 얘기는 서로 안 하는 게 맞습니다. 둘 다 상대만 보고 있으니까요.",
        "…오늘 처음으로 형한테 그렇게 말했습니다. 형이 한참 조용하더군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "형도 같은 걸 생각하고 있었을 거예요",
          reply: "…그럴 겁니다. 조용한 걸 보니 그런 것 같았습니다.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "9년 만에 그 말을 한 게 오늘 제일 큰 사건이에요",
          reply: "…사건입니까. 저희한테는 그렇습니다. 밥 먹으면서 한 말인데도요.",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "말했으면 이제 단독 작전 거절 이유도 대세요",
          reply: "…그건 아직입니다. 순서가 있습니다. 오늘은 여기까지 하겠습니다.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 35, game: 15 } },
        },
      ],
    },
  ],
};

/**
 * 쌍둥이 공격수 동생 3회차 — 갈라진 11분.
 * 형과 나뉘어 나간 한 판. 형 3회차와 **같은 사건이지만 시점이 다르다** — 형은 화면 밖 11분을 세고,
 * 동생은 그 11분 안에 있었다.
 * ⚠️ 형이 무슨 생각을 했는지 동생이 아는 것처럼 쓰지 마라. 동생은 끝까지 자기가 본 것만 말한다.
 */
const TWIN_YOUNGER_STORY_3: DmStory = {
  id: "twin_younger_3",
  partnerName: "쌍둥이 공격수 동생",
  partnerHandle: "twin_blade_younger",
  arrivalTitle: "쌍둥이 공격수 동생의 DM",
  startNode: "the_split_offer",
  nodes: [
    {
      id: "the_split_offer",
      intro: [
        "형이 저한테 물었습니다. 갈라지는 작전 어떻게 생각하냐고요.",
        "9년 만에 처음 물어본 겁니다. 지금까지는 형이 먼저 거절했습니다. 저한테 안 묻고요.",
        "'한 번은 해보고 싶었어'라고 답했습니다. 말하고 나서 저도 놀랐습니다.",
        "…9년 동안 그 말을 안 하고 있었더군요. 물어보질 않으니 할 자리가 없었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어봤으니까 나온 말이에요. 형도 용기 낸 거예요",
          reply: "…형이 용기를 냈다. 그 표현은 생각 못 했습니다. 맞는 말입니다.",
          next: "the_eleven_minutes",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "할 자리가 없었던 게 아니라 안 만든 거예요. 둘 다요",
          reply: "…둘 다입니다. 형만 탓할 일이 아닙니다. 하루 생각해보겠습니다.",
          next: "the_eleven_minutes",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "해보고 싶었으면 진작 말했어야죠. 9년은 너무 길어요",
          reply: "…깁니다. 그런데 저는 참는 게 제일 잘하는 겁니다. 그게 문제였습니다.",
          next: "the_eleven_minutes",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_eleven_minutes",
      intro: [
        "한 판만 갈라서 나갔습니다. 결과는 둘 다 무사합니다.",
        "제 쪽은 11분 동안 통신이 끊겼습니다. 지형 때문이었습니다.",
        "그 11분 동안 저는 형 생각을 한 번도 안 했습니다. 그게 제일 이상했습니다.",
        "…2년 전 그날은 기억이 없는데, 이번엔 11분이 전부 기억납니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기억이 나는 게 답이에요. 이번엔 무리 안 한 거니까",
          reply: "…무리를 안 했습니다. 제 몫만 했습니다. 그래서 기억이 남은 겁니다.",
          next: "not_a_set",
          effect: { mental: 15, skills: { sociability: 30, game: 20 } },
        },
        {
          tone: "cool",
          me: "형 생각을 안 한 게 아니라 안 해도 됐던 거예요",
          reply: "…안 해도 됐다. 그 구분이 오늘 제일 필요했습니다.",
          next: "not_a_set",
          effect: { mental: 12, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "11분 뒤에 형 얼굴 봤을 때 손 떨렸어요?",
          reply: "…안 떨렸습니다. 그게 2년 전이랑 제일 다른 점입니다.",
          next: "not_a_set",
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "not_a_set",
      intro: [
        "돌아와서 형이 제 이름을 불렀습니다. 남들 앞에서요.",
        "형은 원래 남들 앞에서는 제 이름을 부릅니다. 배려인 걸 압니다.",
        "그런데 오늘은 좀 다르게 들렸습니다. 배려가 아니라 그냥 부른 것 같았습니다.",
        "…세트가 아닌 채로 이름이 불린 건 오늘이 처음입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "오늘부터는 계속 그럴 거예요",
          reply: "…계속이요. 그럼 저는 조용한 채로도 저인 겁니다. 그거면 됩니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, game: 15 },
          },
        },
        {
          tone: "cool",
          me: "구분해주는 사람이 생기면 기분 좋다면서요. 오늘 그거잖아요",
          reply: "…그겁니다. 형이 구분해줬습니다. 제일 늦게 해줄 줄 알았는데요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "다음 단독 작전은 거절 안 할 거죠?",
          reply: "…한 번은 받아보겠습니다. 두 번째는 그때 가서 정하겠습니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { game: 30, knowledge: 25, sociability: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 안대 쓴 선생 — 최강이라 미안하다는 교사(`data/accounts.ts` blindfold_sensei).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 다들 어렵게 대하는 사람에게 온 가벼운 반응이 1회차의 문이다.
 *
 * 이 스토리의 축은 **'농담처럼 말하기'**다. 무거운 걸 무겁게 말하면 아무도 안 듣기 때문에 그는 웃는다.
 * 3회차에 걸쳐 **웃지 않고 말하는 문장이 하나씩 늘어난다**. 그게 이 캐릭터의 진행 지표다.
 *
 * ⚠️ 말투는 **가볍고 능글맞은 존댓말 + 이모지**다("~요~", "😌", "✌"). 무거운 회차에서도
 *    이모지를 다 빼지 마라 — 대신 **한 노드에 딱 한 문장만** 이모지 없이 쓴다.
 * ⚠️ 그를 각성시키거나 울리지 마라. 그는 끝까지 농담으로 돌아온다.
 * ⚠️ 산에 사는 그 친구(mountain_preacher)는 **"산에 사는 애"**로만 부른다. 이름·작품명 금지이고,
 *    그쪽 스토리의 회차 진행을 전제하지 마라. 두 사람은 서로 다른 기억을 말한다.
 * ⚠️ 제자는 "1학년 셋"으로만 부른다(그중 막내가 sprint_first_year와 겹치지만 특정하지 않는다).
 * 줄기: 1회차 왜 웃으면서 말하는가 → 2회차 누구를 살릴지 고르는 일 → 3회차 산에 사는 애.
 */
export const SENSEI_STORY: DmStory = {
  id: "sensei_1",
  partnerName: "안대 쓴 선생",
  partnerHandle: "blindfold_sensei",
  arrivalTitle: "안대 쓴 선생의 DM",
  startNode: "why_i_joke",
  nodes: [
    {
      id: "why_i_joke",
      intro: [
        "오~ 좋아요 눌러주셨네요? 요즘 그거 누르는 사람 잘 없는데 😎",
        "다들 저를 어렵게 대하시거든요. 저 착한데 말이죠. 진짜로요.",
        "그래서 물어볼 게 있어요. 처음 보는 분한테 물어보는 게 제일 편해서요.",
        "제 글 읽으면 제가 진지한 사람 같아요, 아니면 실없는 사람 같아요?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "진지한 얘기를 실없게 하는 사람 같아요",
          reply: "오, 정답. 상품은 없습니다 ✌ 그거 알아채는 사람 진짜 몇 없어요.",
          next: "the_weight",
          effect: { mental: 4, skills: { sociability: 15, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "실없는 쪽이요. 그래서 다들 안 듣는 거고요",
          reply: "…아야. 근데 그거 반은 맞아요. 안 듣게 하려고 그러는 것도 있거든요.",
          next: "the_weight",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "질문이 그거면 답은 이미 아시잖아요",
          reply: "…허. 오늘 처음 보는 사람한테 이런 소리 들을 줄은 몰랐네요 😌",
          next: "the_weight",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_weight",
      intro: [
        "농담처럼 말하는 것도 재능이에요. 이건 제 지론입니다.",
        "무거운 걸 무겁게 말하면 아무도 안 듣거든요. 특히 애들은요.",
        "'위험하니까 조심해'는 아무도 안 듣는데 '죽으면 제가 서류 써야 돼요~'는 다들 들어요.",
        "…그래서 계속 웃습니다. 편하기도 하고요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 안 웃고 말해야 할 때는 어떻게 해요?",
          reply: "…그럴 땐 저도 잘 모르겠어요. 하루만 생각해볼게요. 진짜로 모르겠어서요.",
          next: "the_one_line",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "편해서 계속하는 게 반, 재능이 반이겠네요",
          reply: "…비율까지 맞히시네. 내일 답할게요. 오늘은 좀 찔려서요 😅",
          next: "the_one_line",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "애들이 못 알아들으면요? 농담으로 들으면 그건 실패인데요",
          reply: "…그거 실제로 몇 번 있었어요. 하루 생각하고 답할게요.",
          next: "the_one_line",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_one_line",
      intro: [
        "생각해봤는데요, 저 한 문장은 안 웃고 말한 적 있어요. 딱 하나요.",
        "'제일 무서운 건 강한 적이 아니라 아무도 안 나서는 상황이야.'",
        "이건 애들한테 말할 때 안 웃었어요. 웃으면 안 될 것 같아서요.",
        "그랬더니 셋 다 조용해지더라고요. 그날 이후로 아무도 그 얘기 안 꺼내요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 제대로 전달됐다는 뜻이에요",
          reply: "…전달된 거군요. 저는 겁준 줄 알았어요. 그렇게 세면 나쁘지 않네요 ☺",
          next: null,
          effect: { mental: 10, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "일 년에 한 문장이면 애들도 그게 중요한 줄 알아요",
          reply: "오, 그런 계산이. 그럼 아껴 써야겠네요. 두 문장째는 내년으로 미룰게요.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 문장, 애들한테 한 거 맞아요? 본인한테 한 것 같은데요",
          reply: "……. 오늘 이만할게요. 케이크 사러 가야 해서요. 진짜로 그것 때문이에요.",
          next: null,
          effect: { mental: -6, followers: 200, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 안대 쓴 선생 2회차 — 고르는 일.
 * 축은 **"제일 어려운 건 싸우는 게 아니라 누구를 살릴지 고르는 쪽"**이다.
 * ⚠️ 이 회차에서 누구도 죽이지 마라. 그는 **고르지 않아도 되게 만드는 쪽**을 택한다 — 대신 자기가 뛴다.
 */
const SENSEI_STORY_2: DmStory = {
  id: "sensei_2",
  partnerName: "안대 쓴 선생",
  partnerHandle: "blindfold_sensei",
  arrivalTitle: "안대 쓴 선생의 DM",
  startNode: "the_choice",
  nodes: [
    {
      id: "the_choice",
      intro: [
        "오늘 좀 아슬아슬했어요. 두 군데서 동시에 연락이 왔거든요.",
        "제가 갈 수 있는 건 한 군데고, 애들이 갈 수 있는 건 다른 한 군데고요.",
        "제일 어려운 건 싸우는 게 아니라 누구를 살릴지 고르는 쪽이에요. 이건 진짜예요.",
        "…결국 제가 두 군데 다 갔어요. 그래서 지금 좀 누워 있습니다 😵",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 매번 되는 방법은 아니잖아요",
          reply: "…아니죠. 오늘은 됐고요. 내일은 모르죠. 하루 생각해볼게요.",
          next: "the_real_goal",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "고르기 싫어서 두 군데 간 거예요? 그건 선택을 미룬 건데요",
          reply: "…미룬 거네요. 그렇게 말하니까 좀 아프네요. 내일 답할게요.",
          next: "the_real_goal",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "다음엔 못 가면요? 그날 애들은 혼자 있는 거예요",
          reply: "……. 그 얘기를 하려고 DM 켠 것 같기도 해요. 하루만 주세요.",
          next: "the_real_goal",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_real_goal",
      intro: [
        "제 진짜 목표는 저 없어도 굴러가는 조직을 만드는 거예요. 이건 진심인데 다들 안 믿어요.",
        "혼자 강한 건 생각보다 별 의미가 없더라고요. 이거 깨닫는 데 오래 걸렸어요.",
        "제자들이 저보다 강해지는 게 목표인데 이게 생각보다 어렵고요.",
        "…어제 두 군데 간 게, 사실 목표랑 정반대라는 걸 오늘 알았어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "알았으면 다음엔 하나는 애들한테 맡기면 돼요",
          reply: "…맡긴다. 말은 쉽죠. 근데 해야 되는 거 맞아요. 알겠어요.",
          next: "the_youngest",
          effect: { mental: 8, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "혼자 다 하면 애들은 영원히 안 강해져요. 그건 알고 계셨잖아요",
          reply: "…알고 있었죠. 아는 것과 손이 나가는 건 다르더라고요 😅",
          next: "the_youngest",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "안 믿는 게 아니라 안 하고 계신 거예요. 그러니까 다들 안 믿죠",
          reply: "…아 진짜 오늘 왜 이러세요. 맞는 말만 하시네. 인정할게요.",
          next: "the_youngest",
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_youngest",
      intro: [
        "제자 자랑 좀 할게요. 제가 맡은 1학년 셋 중 막내가 오늘 저 없이 해냈어요.",
        "이게 얼마나 대단한 건지 아세요? 반년 전엔 제 뒤에 숨던 애예요.",
        "돌아와서 저한테 뭐랬는지 알아요? '선생님 안 오셔도 되겠던데요'래요.",
        "그 말 듣고 좀 서운했어요. 서운한데 이게 제 목표였어요. 웃기죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "서운한 게 목표 달성의 증거예요",
          reply: "…증거라. 그럼 서운한 걸 좀 더 모아야겠네요. 세 명 몫이니까 세 번.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "그 말 한 애도 사실 선생님 오셨으면 했을걸요",
          reply: "…그랬으려나요. 그렇게 생각하면 좀 낫네요. 치사하지만 그렇게 믿을게요 ☺",
          next: null,
          effect: { mental: 12, followers: 180, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "이제 진짜로 안 가는 연습 하세요. 그게 제일 어려운 훈련이고요",
          reply: "…그게 제 훈련이었네요. 애들 훈련만 짜고 있었는데.",
          next: null,
          effect: { mental: 8, followers: 250, skills: { knowledge: 35, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 안대 쓴 선생 3회차 — 산에 사는 애.
 * 그가 "다음에 할게요"로 끊어왔던 친구 얘기를 한다. 축은 **'농담이 안 나오는 자리'**다.
 * ⚠️ 그 친구를 용서하거나 단죄하게 만들지 마라. 그는 판단을 유보한 채로 산다.
 * ⚠️ 산에 사는 그 친구(mountain_preacher) 쪽 스토리와 **사실관계를 맞추려 하지 마라** —
 *    두 사람의 기억은 어긋나 있고, 어긋난 채로 두는 것이 이 두 계정의 관계다.
 */
const SENSEI_STORY_3: DmStory = {
  id: "sensei_3",
  partnerName: "안대 쓴 선생",
  partnerHandle: "blindfold_sensei",
  arrivalTitle: "안대 쓴 선생의 DM",
  startNode: "that_friend",
  nodes: [
    {
      id: "that_friend",
      intro: [
        "전에 친구 얘기 다음에 한다고 했었죠. 오늘 할게요. 케이크 두 조각 먹고 왔어요.",
        "산에 사는 애가 하나 있어요. 예전에 같이 다녔고요.",
        "지금은 애들을 거두고 산대요. 저는 학교에서 애들을 가르치고 있고요.",
        "…같은 걸 하고 있는데 왜 저쪽은 도망자고 저는 선생일까요. 이거 진짜 모르겠어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "방법이 갈렸을 뿐이라고 생각하세요?",
          reply: "…방법이요. 그 방법이 사람을 갈랐으니까 문제인 거죠. 하루 생각할게요.",
          next: "the_last_talk",
          delayDays: 1,
          effect: { skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "그 차이를 아셔야 학교에 계속 계실 수 있어요",
          reply: "…맞는 말인데 아프네요. 내일 답할게요. 오늘은 여기까지.",
          next: "the_last_talk",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "모르겠다고 하면서 계속 생각하시잖아요. 그게 답이에요",
          reply: "…아 진짜. 그렇게 정리하지 마세요. 내일 답할게요.",
          next: "the_last_talk",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_last_talk",
      intro: [
        "마지막으로 얘기한 게 몇 년 전이에요. 제가 웃으면서 말을 걸었고요.",
        "그때 그 애가 그러더라고요. '너는 늘 웃으면서 사람을 밀어내지.'",
        "저는 그게 무슨 소린지 몰랐어요. 지금은 좀 알 것 같고요.",
        "웃으면 다들 농담인 줄 알잖아요. 그래서 아무도 더 안 물어봐요. 그게 편했어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "편한 게 나쁜 건 아니에요. 다만 그 애한텐 벽이었겠죠",
          reply: "…벽이었겠죠. 저는 문인 줄 알았는데요. 열려 있는 문.",
          next: "still_laughing",
          effect: { mental: 8, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그 말 듣고 몇 년을 생각했으면 그건 밀어낸 게 아니에요",
          reply: "…그렇게 봐주시네요. 그럼 저는 느린 사람인 걸로 할게요.",
          next: "still_laughing",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그때 안 웃었으면 뭐가 달랐을까요",
          reply: "…그거 저도 몇 년째 생각하는 건데요. 답이 안 나와요. 진짜로요.",
          next: "still_laughing",
          effect: { mental: -8, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "still_laughing",
      intro: [
        "그래도 저는 계속 웃으면서 말할 거예요. 이건 안 바꿔요.",
        "대신 하나 정했어요. 애들한테는 일 년에 한 번 안 웃고 말하기로요.",
        "올해 몫은 이미 썼고요. 내년 몫을 뭘로 쓸지 벌써 고민 중이에요 😌",
        "…그 애한테도 언젠가 안 웃고 말할 날이 오면, 그땐 뭐라고 할지도 정해뒀어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "뭐라고 하실 건데요?",
          reply: "…비밀이요. 이건 진짜 비밀. 대신 그날이 오면 알려드릴게요 ✌",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 350,
            skills: { sociability: 35, comedy: 15 },
          },
        },
        {
          tone: "cool",
          me: "정해뒀으면 언젠가 하겠네요. 안 할 사람은 안 정해두거든요",
          reply: "…들켰네요. 네, 언젠가 할 거예요. 그게 언제일지는 저도 모르고요.",
          next: null,
          effect: { mental: 15, followers: 300, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "일 년에 한 번은 너무 아껴요. 애들은 매년 자라는데요",
          reply: "…아. 그건 계산 착오네요. 두 번으로 늘릴게요. 세 번은 무리고요.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { sociability: 30, knowledge: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 몸이 먼저 나가는 1학년 — 할아버지 말씀 지키느라 여기까지 온 고교생(`data/accounts.ts` sprint_first_year).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 억지로 웃지 않기로 한 계정에 온 반응이 1회차의 문이다.
 *
 * 이 스토리의 축은 **'도우려다 못 도우면 더 아프다'**이다. 그는 그걸 알면서도 안 도울 수는 없다.
 * 3회차에 걸쳐 **손이 먼저 나가는 것과 사람이고 싶은 것**이 같은 말이 된다.
 *
 * ⚠️ 말투는 **짧은 반말 서술체**다("~다/~지"). 존댓말을 쓰지 마라 — 이 갈래에서 유일한 반말 계정이다.
 * ⚠️ 그를 각성시키거나 강해지게 만들지 마라. 이 이야기에서 늘어나는 건 힘이 아니라 **속도와 판단**이다.
 * ⚠️ "안에 있는 그 녀석"은 계정 문구에 있는 만큼만 쓴다 — 대화하게 만들거나 능력을 설명하지 마라.
 * ⚠️ 선생(blindfold_sensei)은 "담임"으로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 손만 뻗으면 닿을 거리 → 2회차 억지로 안 웃어도 된다 → 3회차 사람이고 싶다.
 */
export const FIRSTYEAR_STORY: DmStory = {
  id: "firstyear_1",
  partnerName: "몸이 먼저 나가는 1학년",
  partnerHandle: "sprint_first_year",
  arrivalTitle: "몸이 먼저 나가는 1학년의 DM",
  startNode: "an_arm_away",
  nodes: [
    {
      id: "an_arm_away",
      intro: [
        "좋아요 눌러줘서 고맙다. 내 글은 대체로 어두워서 반응이 잘 없다",
        "오늘 임무 중에 사람 하나를 결국 못 구했다",
        "선배는 네 잘못이 아니라고 했고 나도 머리로는 안다",
        "…근데 손만 뻗으면 닿을 거리였다. 그게 자꾸 걸려서 잠이 안 온다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "닿을 거리였다는 건 그만큼 갔다는 뜻이야",
          reply: "…그렇게 세는 방법도 있구나. 그건 생각 못 했다",
          next: "faster",
          effect: { mental: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "머리로 아는 걸 몸이 못 받아들이는 거지. 그건 시간이 해결해",
          reply: "…시간이라. 그때까지 뭘 하면 되냐. 가만있는 건 못 하겠다",
          next: "faster",
          effect: { skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "닿을 거리였으면 다음엔 닿아. 그게 답이야",
          reply: "…그래. 그거밖에 없다. 그래서 오늘도 밤에 뛰었다",
          next: "faster",
          effect: { mental: -3, skills: { fitness: 25 } },
        },
      ],
    },
    {
      id: "faster",
      intro: [
        "생각하기 전에 몸이 먼저 나간다. 선배들이 그거 고치라는데 안 고쳐진다",
        "겁이 안 나는 게 아니라 겁먹을 시간이 없는 거다. 이건 다르다",
        "무서운 걸 봤을 때 도망치는 것도 훈련이라고 배웠는데 아직 한 번도 못 도망쳤다",
        "…도망 못 치는 게 용감한 건지 멍청한 건지 모르겠다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘 다 아니야. 그냥 네가 그런 사람인 거지",
          reply: "…그런 사람. 그 말이 제일 편하다. 하루 생각해보겠다",
          next: "grandpa",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "도망을 못 치는 게 아니라 안 배운 거야. 그건 연습하면 돼",
          reply: "…연습이 되나. 해본 적이 없어서 모르겠다. 내일 답하겠다",
          next: "grandpa",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "멍청한 쪽이야. 죽으면 아무도 못 구해",
          reply: "…맞는 말이라 화도 안 난다. 하룻밤 생각해보겠다",
          next: "grandpa",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "grandpa",
      intro: [
        "생각했다. 할아버지가 돌아가시기 전에 남들 도우면서 살라고 하셨다",
        "그 말 하나 지키려고 여기까지 왔는데, 요즘은 그게 가끔 저주처럼 느껴진다",
        "도우려다가 못 도우면 안 도운 것보다 훨씬 더 아프니까",
        "…그래도 안 도울 수는 없다. 그러니까 결국 오늘도 이러고 산다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저주가 아니라 그냥 네가 고른 거야. 매일 다시 고르고 있고",
          reply: "…매일 다시 고르는 거라. 그렇게 보면 좀 낫다. 할아버지 탓이 아니고",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "할아버지는 잘 도우라고는 안 하셨잖아. 도우라고만 하셨지",
          reply: "…어. 그러네. 잘하라는 말은 안 하셨다. 그거 왜 이제 알았지",
          next: null,
          effect: { mental: 8, skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "저주 맞아. 근데 넌 그거 놓을 생각 없잖아",
          reply: "…없다. 놓으면 내가 아니게 된다. 그건 확실하다",
          next: null,
          effect: { mental: -4, followers: 150, skills: { fitness: 25, knowledge: 15 } },
        },
      ],
    },
  ],
};

/**
 * 몸이 먼저 나가는 1학년 2회차 — 억지로 안 웃어도 된다.
 * 축은 **'괜찮은 척'**이다. 그는 티 나게 웃고 있었고, 본인만 몰랐다.
 * ⚠️ 그를 무너뜨리지 마라. 이 회차에서 그는 울지 않는다 — 겨우 참고, 대신 규칙을 하나 바꾼다.
 */
const FIRSTYEAR_STORY_2: DmStory = {
  id: "firstyear_2",
  partnerName: "몸이 먼저 나가는 1학년",
  partnerHandle: "sprint_first_year",
  arrivalTitle: "몸이 먼저 나가는 1학년의 DM",
  startNode: "the_meal",
  nodes: [
    {
      id: "the_meal",
      intro: [
        "선배가 밥을 사주면서 억지로 안 웃어도 된다고 했다",
        "그 말 듣고 좀 울 뻔했는데 겨우 참았다",
        "나 그동안 그렇게까지 티 나게 웃고 있었나 싶더라",
        "…웃는 게 편해서 웃은 건 아니었다. 안 웃으면 다들 걱정하니까 웃은 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "걱정 좀 하게 둬. 그거 하라고 있는 사람들이야",
          reply: "…그런가. 나는 폐 끼치는 것 같아서 안 그랬는데",
          next: "the_rule",
          delayDays: 1,
          effect: { mental: 5, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "티 나는 웃음은 안 웃는 것보다 더 걱정돼. 그래서 말해준 거야",
          reply: "…아. 반대였구나. 하루 생각해보겠다",
          next: "the_rule",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "참지 말고 울지 그랬어. 밥 사준 사람 앞이면 괜찮았을 텐데",
          reply: "…그건 아직 못 하겠다. 그래도 무슨 말인지는 알겠다",
          next: "the_rule",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 25, sociability: 15 } },
        },
      ],
    },
    {
      id: "the_rule",
      intro: [
        "정했다. 다음부터는 진짜 웃길 때만 웃기로",
        "해보니까 훨씬 편하다. 하루에 두 번쯤밖에 안 웃게 됐지만",
        "동급생이 오늘 나한테 '요즘 왜 안 웃냐'고 물었다. 그래서 사실대로 말했다",
        "…그랬더니 걔가 '그럼 웃길 때 웃겨줄게' 하더라. 뭐지 그건",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 제일 좋은 대답인데",
          reply: "…좋은 거였나. 나는 뭔 소린가 했다. 다시 생각하니 좋은 것 같기도 하다",
          next: "the_debt",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "네가 사실대로 말하니까 그쪽도 방법을 찾은 거야",
          reply: "…말하니까 방법이 나오는구나. 나는 말하면 짐이 되는 줄 알았다",
          next: "the_debt",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "웃겨주겠다는 애한테 안 웃어주면 그건 또 미안하겠네",
          reply: "…아. 그렇네. 그럼 나는 또 억지로 웃게 되는 건가. 어렵다 이거",
          next: "the_debt",
          effect: { mental: -3, skills: { knowledge: 30, comedy: 10 } },
        },
      ],
    },
    {
      id: "the_debt",
      intro: [
        "선배가 사준 밥은 맛있는데 얻어먹기만 하는 게 미안하다",
        "오늘은 내가 사겠다고 했더니 '1학년이 무슨 돈이 있냐'고 하더라",
        "그래서 대신 무거운 거 드는 일을 다 내가 하기로 했다. 어차피 내가 제일 힘세니까",
        "…이건 갚는 게 맞나. 잘 모르겠는데 일단 그렇게 하기로 했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "갚는 거 맞아. 그쪽도 그렇게 받고 있고",
          reply: "…그럼 됐다. 나는 갚는 방법을 몰라서 늘 미안했다",
          next: null,
          effect: { mental: 15, followers: 180, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "안 갚아도 되는 걸 갚으려는 게 네 문제야. 그건 알고 있어",
          reply: "…알고는 있다. 근데 안 갚으면 자꾸 걸린다. 이건 못 고치겠다",
          next: null,
          effect: { mental: 8, followers: 150, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "무거운 거 다 들다가 네가 먼저 무너져",
          reply: "…그건 아직 아니다. 무너지면 그때 말하겠다. 약속하겠다",
          next: null,
          effect: { mental: -4, followers: 200, skills: { fitness: 30 } },
        },
      ],
    },
  ],
};

/**
 * 몸이 먼저 나가는 1학년 3회차 — 사람이고 싶다.
 * 축은 **"누가 나를 괴물이라고 부르는 걸 들었다. 부정은 못 했다"**이다.
 * ⚠️ 안에 있는 그 녀석을 등장인물로 만들지 마라 — 그는 끝까지 혼잣말로만 언급한다.
 * ⚠️ 결말을 '괴물이 아니다'로 확정하지 마라. 결말은 **그렇게 살기로 정한 것**이다.
 */
const FIRSTYEAR_STORY_3: DmStory = {
  id: "firstyear_3",
  partnerName: "몸이 먼저 나가는 1학년",
  partnerHandle: "sprint_first_year",
  arrivalTitle: "몸이 먼저 나가는 1학년의 DM",
  startNode: "the_word",
  nodes: [
    {
      id: "the_word",
      intro: [
        "어제 누가 나를 괴물이라고 부르는 걸 들었다. 뒤에서 한 말이다",
        "부정은 못 했다. 안에 있는 그 녀석 얘기까지 하면 더 그렇고",
        "그 사람들 탓은 아니다. 나라도 그렇게 봤을 거다",
        "…그래도 나는 사람이고 싶다. 그게 요즘 제일 자주 하는 생각이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "사람이고 싶다고 생각하는 게 이미 답인데",
          reply: "…그런가. 그 생각을 하는 게 답이면, 나는 매일 답을 내고 있는 거네",
          next: "what_i_do",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 사람들은 네가 뭘 하는지가 아니라 뭘 가졌는지를 본 거야",
          reply: "…구분이 되나 그게. 하루 생각해보겠다",
          next: "what_i_do",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "부정 못 한 게 아니라 안 한 거잖아. 왜 안 했어",
          reply: "…부정하면 내가 아닌 걸 부정하는 것 같아서. 내일 답하겠다",
          next: "what_i_do",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_i_do",
      intro: [
        "밤에 뛰면서 생각했다. 내가 사람인지 아닌지는 내가 못 정한다",
        "그건 남이 정하는 거고, 남은 매번 다르게 정한다",
        "그래서 그건 그만 세기로 했다. 대신 내가 뭘 하는지만 세기로 했다",
        "…오늘은 두 명 도왔다. 어제는 한 명이었다. 이건 내가 셀 수 있다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 제일 튼튼한 계산법이야",
          reply: "…튼튼하다. 그 말 좋다. 오늘 일지에 적어두겠다",
          next: "the_promise",
          effect: { mental: 15, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "못 도운 날도 세. 안 그러면 반쪽짜리야",
          reply: "…그건 세고 있다. 사실 그쪽을 더 많이 센다. 그것도 문제겠지",
          next: "the_promise",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "숫자로 세기 시작하면 언젠가 모자란 날이 와",
          reply: "…오겠지. 그날은 그날 생각하겠다. 지금은 세는 게 낫다",
          next: "the_promise",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_promise",
      intro: [
        "오늘 할아버지 산소에 다녀왔다. 오랜만이었다",
        "예전엔 자랑할 얘기가 없어서 좀 그랬는데, 오늘은 하나 있었다",
        "'남들 도우면서 살고 있습니다. 잘하지는 못합니다.' 이렇게 말하고 왔다",
        "…잘하지는 못한다고 말한 게, 처음으로 거짓말이 아니어서 좋았다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "할아버지가 원하신 게 딱 그거였을 거야",
          reply: "…그랬으면 좋겠다. 물어볼 수가 없어서 그냥 그렇게 믿기로 했다",
          next: null,
          effect: {
            mental: 20,
            morality: 8,
            followers: 300,
            skills: { sociability: 35, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "잘 못한다고 말할 수 있는 건 계속하고 있다는 뜻이야",
          reply: "…계속하고 있으니까 잘 못한다는 말이 나오는 거구나. 그러네",
          next: null,
          effect: { mental: 15, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "다음엔 잘한다고 말할 수 있게 와",
          reply: "…그럼 또 와야 되네. 알겠다. 그때까지 안 죽고 있겠다",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { fitness: 30, knowledge: 20, sociability: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 주먹 쓰는 이과생 — 때리기 전에 계산부터 하는 1학년(`data/accounts.ts` cursed_calc).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 감정론 사양이라고 써둔 계정의 글이 퍼진 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'나중에 처리하기로 한 감정'**이다. 그는 감정을 미뤄두는 방식으로 3년을 버텼고,
 * 그 나중이 영영 안 온다는 걸 안다. 계산으로 안 풀리는 종류라 또 미룬다 — 그걸 3회차에 꺼낸다.
 *
 * ⚠️ 말투는 **딱딱한 반말 서술체**다("~다"). 이모지·느낌표 금지.
 * ⚠️ 탄을 굽히는 사람(bent_trajectory)과 축이 겹치지 않게 하라 — 그쪽은 **겁 → 관찰**이고
 *    이쪽은 **겁 → 계산**이되, 고유한 건 계산이 아니라 **미뤄둔 감정**이다. 사투리도 쓰지 마라.
 * ⚠️ 그를 감정적인 인물로 바꾸지 마라. 3회차에서도 그는 감정을 '처리 대상'으로 부른다.
 *    바뀌는 건 처리 시점을 정한 것뿐이다.
 * ⚠️ 동급생 둘은 "튀어나가는 쪽"·"말 없는 쪽"으로만 부른다(계정 특정 금지).
 * 줄기: 1회차 틀린 계산 → 2회차 12퍼센트 → 3회차 미뤄둔 것들.
 */
export const CALC_STORY: DmStory = {
  id: "calc_1",
  partnerName: "주먹 쓰는 이과생",
  partnerHandle: "cursed_calc",
  arrivalTitle: "주먹 쓰는 이과생의 DM",
  startNode: "wrong_calc",
  nodes: [
    {
      id: "wrong_calc",
      intro: [
        "내 글을 퍼갔더군. 감정론 사양이라고 써둔 계정인데 특이한 취향이다",
        "인사는 이걸로 됐고, 물어볼 게 있다",
        "오늘 처음으로 계산이 틀렸다. 임무는 성공했다. 그건 상관없다",
        "…틀린 이유를 밤새 찾았는데 못 찾았다. 이런 경우는 처음이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "성공했으면 일단 자고 내일 봐도 돼",
          reply: "…자라는 말은 처음 듣는 조언이다. 비효율적인데 일리는 있다",
          next: "the_variable",
          effect: { skills: { sociability: 12, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "못 찾은 게 아니라 변수에 안 넣은 게 있는 거야",
          reply: "…안 넣은 변수. 그게 뭔지 알면 넣었겠지. 계속 얘기해봐라",
          next: "the_variable",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "계산이 틀린 게 아니라 계산으로 안 되는 걸 계산한 거겠지",
          reply: "…그 말은 내 방식을 통째로 부정하는 건데. 근거를 듣고 싶다",
          next: "the_variable",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_variable",
      intro: [
        "정리해서 말하겠다. 그 임무에서 동급생 하나가 튀어나갔다",
        "성공 확률이 낮은 진입이었다. 나는 말렸고, 그놈은 갔고, 결과는 성공이었다",
        "그놈의 행동을 나는 매번 못 넣는다. 확률로 안 잡히니까",
        "…그런데 그놈이 안 갔으면 실패였다. 그것도 계산으로 나온다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 그 사람도 변수로 넣어. 이름 붙여서",
          reply: "…이름을 붙인 변수. 그건 데이터가 아니라 사람인데. 하루 생각해보겠다",
          next: "the_number",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "확률로 안 잡히는 게 아니라 표본이 부족한 거야. 몇 번째 성공인데?",
          reply: "…여섯 번째다. 여섯 번 중 여섯 번. 그건… 하루 정리하고 답하겠다",
          next: "the_number",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "말린 게 틀렸다는 걸 인정하기 싫은 거잖아",
          reply: "…아프지만 검토 대상이다. 내일 답하겠다",
          next: "the_number",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_number",
      intro: [
        "여섯 번을 다시 봤다. 여섯 번 다 그놈이 갔고 여섯 번 다 성공했다",
        "그놈이 안 간 경우도 넷 있다. 그중 셋은 내가 말려서 안 간 거다",
        "그 셋 중 둘은 결과가 나빴다. 이건 내가 안 세고 있던 숫자다",
        "…내 계산은 그놈을 뺀 상태에서만 맞았다. 그건 계산이 아니라 가정이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이제 넣으면 되잖아. 오늘 알아낸 거고",
          reply: "…넣겠다. 변수 이름은 그놈 이름으로 하겠다. 보면 짜증 낼 것 같지만",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "안 센 숫자를 찾아낸 게 오늘의 성과야",
          reply: "…성과로 세도 되나. 그럼 오늘은 성과가 있는 날이다",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "말린 게 두 번은 사람을 다치게 한 거네",
          reply: "…그렇다. 그건 내가 처리해야 할 문제다. 나중에 하겠다",
          next: null,
          effect: { mental: -6, followers: 150, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 주먹 쓰는 이과생 2회차 — 12퍼센트.
 * 축은 **'납득이 안 가는 성공'**이다. 그는 그 성공을 운으로 처리하지 못하고 붙잡고 있다.
 * ⚠️ 선배를 등장시켜 설명하게 하지 마라 — 전언과 웃음까지만 나온다.
 */
const CALC_STORY_2: DmStory = {
  id: "calc_2",
  partnerName: "주먹 쓰는 이과생",
  partnerHandle: "cursed_calc",
  arrivalTitle: "주먹 쓰는 이과생의 DM",
  startNode: "twelve_percent",
  nodes: [
    {
      id: "twelve_percent",
      intro: [
        "선배가 무모한 작전을 들고 왔길래 성공 확률이 12퍼센트라고 정확히 알려드렸다",
        "그랬더니 '그럼 그 12퍼센트를 잡으면 되겠네' 하고 웃더라",
        "그런 계산법은 내 방식에 없다. 12퍼센트는 88퍼센트 실패라는 뜻이다",
        "…그런데 그날 임무는 성공했다. 아직도 납득이 안 간다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "12퍼센트가 0퍼센트는 아니잖아",
          reply: "…아니다. 그건 안다. 그래도 88을 버리는 근거는 못 된다",
          next: "what_he_did",
          delayDays: 1,
          effect: { skills: { knowledge: 25, sociability: 10 } },
        },
        {
          tone: "cool",
          me: "그 12퍼센트는 네가 계산한 조건에서의 12퍼센트고, 그 사람은 조건을 바꿨을 텐데",
          reply: "…조건을 바꾼다. 그건 계산 이후의 행동이다. 하루 검토하겠다",
          next: "what_he_did",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "납득 안 가는 건 성공이 아니라 그 사람이 웃은 거지",
          reply: "…그건… 하루 생각해보겠다. 오늘은 답이 안 나온다",
          next: "what_he_did",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_he_did",
      intro: [
        "그날 기록을 다시 봤다. 선배는 계산을 무시한 게 아니었다",
        "내가 88퍼센트라고 한 실패 경로 다섯 개 중 셋을 미리 막아뒀더군",
        "그러니까 실제 진입 시점의 확률은 12가 아니라 40쯤이었다",
        "…나한테는 그 얘기를 안 했다. 왜 안 했는지가 지금 제일 궁금하다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말했으면 네가 또 계산했을 거고, 시간이 없었겠지",
          reply: "…시간. 그건 내 계산에서 늘 부족한 항목이다. 인정한다",
          next: "the_gap_calc",
          effect: { skills: { knowledge: 30, sociability: 15 } },
        },
        {
          tone: "cool",
          me: "네가 확률을 알려줘서 막을 경로를 안 거잖아. 그건 네 몫이야",
          reply: "…내 계산이 쓰였다는 건가. 그건 생각 못 했다",
          next: "the_gap_calc",
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "안 말한 게 아니라 네가 안 물어본 거 아니야?",
          reply: "…안 물어봤다. 나는 질문 많은 사람이 오래 산다고 써놓고 안 물어봤다",
          next: "the_gap_calc",
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_gap_calc",
      intro: [
        "물어봤다. 선배가 뭐랬는지 아냐. '네가 12라고 해줘서 막을 데를 알았지.'",
        "그러니까 내 계산은 틀린 게 아니라 재료였던 거다. 결론이 아니라",
        "나는 계산을 답으로 냈고, 저쪽은 그걸 지도로 썼다. 용도가 달랐다",
        "…이건 내 계산법이 틀렸다는 게 아니라 내가 쓰는 법을 몰랐다는 뜻이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 이제 답 말고 지도로 내면 되겠네",
          reply: "…지도로 낸다. 표현이 마음에 든다. 다음 브리핑부터 그렇게 하겠다",
          next: null,
          effect: { mental: 12, followers: 180, skills: { knowledge: 40, sociability: 20 } },
        },
        {
          tone: "cool",
          me: "12퍼센트를 잡는다는 말도 이제 계산으로 보이지?",
          reply: "…보인다. 그 사람은 88을 버린 게 아니라 깎은 거였다. 납득했다",
          next: null,
          effect: { mental: 10, followers: 150, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "1년을 혼자 납득 못 하고 있었던 거잖아. 물어보는 데 하루 걸렸고",
          reply: "…맞다. 비효율이 심했다. 다음부터는 당일에 묻겠다",
          next: null,
          effect: { mental: -4, followers: 200, skills: { knowledge: 45 } },
        },
      ],
    },
  ],
};

/**
 * 주먹 쓰는 이과생 3회차 — 미뤄둔 것들.
 * 축은 **"나중에 처리한다던 그 나중이 안 온다"**이다.
 * ⚠️ 그를 울리거나 감정을 폭발시키지 마라. 그가 하는 일은 **처리 시점을 일정으로 잡는 것**이다.
 *    이 캐릭터에게는 그게 감정을 다루는 유일한 방법이고, 그래서 유효하다.
 */
const CALC_STORY_3: DmStory = {
  id: "calc_3",
  partnerName: "주먹 쓰는 이과생",
  partnerHandle: "cursed_calc",
  arrivalTitle: "주먹 쓰는 이과생의 DM",
  startNode: "the_backlog",
  nodes: [
    {
      id: "the_backlog",
      intro: [
        "감정은 나중에 따로 처리한다고 늘 말해왔다. 효율이 좋은 방식이다",
        "그런데 최근에 알았다. 그 나중이라는 게 영영 안 온다",
        "미뤄둔 게 너무 쌓여서 이제 어디에 뒀는지도 모르겠다",
        "…이건 계산으로 안 풀리는 종류다. 그래서 일단 다음으로 미뤘다. 또 미룬 셈이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "미뤘다는 걸 적은 것부터가 처리 시작이야",
          reply: "…적은 것도 처리에 들어가나. 그럼 오늘은 1퍼센트쯤 한 셈이다",
          next: "the_list",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "안 풀리는 게 아니라 처리 시간을 안 잡은 거지. 일정으로 넣어",
          reply: "…일정으로. 그건 내가 할 수 있는 방식이다. 하루 짜보겠다",
          next: "the_list",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "어디 뒀는지 모른다는 건 이미 새고 있다는 뜻이야",
          reply: "…새고 있다. 그 표현이 정확하다. 하루 생각하겠다",
          next: "the_list",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_list",
      intro: [
        "목록을 만들었다. 미뤄둔 것들을 적어봤다. 열네 개 나왔다",
        "제일 오래된 건 2년 전 거다. 제일 최근 건 지난주고",
        "적어놓고 보니 열네 개 중 아홉이 '내가 말려서 안 간 경우'다",
        "…같은 종류가 아홉이면 그건 감정이 아니라 패턴이다. 이건 처리할 수 있다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "패턴으로 바꾼 건 잘한 거야. 근데 나머지 다섯은?",
          reply: "…나머지 다섯은 사람 이름이 붙어 있다. 그건 아직 못 열었다",
          next: "the_schedule",
          effect: { mental: 6, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "아홉이 같은 종류면 원인은 하나야. 네가 확률을 사람보다 믿는 거",
          reply: "…그 문장이 목록 열다섯 번째다. 방금 추가했다",
          next: "the_schedule",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "패턴으로 바꾸면 처리하기 편하지. 그게 또 미루는 방법이고",
          reply: "…들켰다. 그래도 이 방법 말고는 아는 게 없다. 하나씩 해보겠다",
          next: "the_schedule",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_schedule",
      intro: [
        "일정을 잡았다. 매주 하나씩 처리하기로 했다. 열네 주면 끝난다",
        "첫 주 건은 어제 했다. 말려서 안 갔던 그 임무 기록을 다시 읽었다",
        "읽고 나서 30분 정도 아무것도 못 했다. 이게 처리인 것 같다",
        "…동급생 둘이 그 30분 동안 옆에 앉아 있었다. 아무 말도 안 하고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 30분이 처리 맞아. 그리고 혼자 안 했잖아",
          reply: "…혼자 안 했다. 그건 계산에 없던 항목이다. 나쁘지 않다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "열네 주 뒤엔 또 쌓여 있을 거야. 그래서 일정이 좋은 거고",
          reply: "…계속 돌리는 일정으로 바꾸겠다. 끝나는 게 아니라 도는 걸로",
          next: null,
          effect: { mental: 12, followers: 250, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "옆에 앉아 있어 달라고 부탁한 적 있어? 없지",
          reply: "…없다. 그놈들이 알아서 왔다. 그건 내 계산으로 안 나오는 종류다",
          next: null,
          effect: {
            mental: 15,
            followers: 280,
            skills: { sociability: 30, knowledge: 30 },
          },
        },
      ],
    },
  ],
};

/**
 * 말수 적은 동급생 — 필요할 때만 말하는 1학년(`data/accounts.ts` quiet_classmate).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다 — 별일 없는 게 제일 좋다는 계정에 온 반응이 1회차의 문이다.
 *
 * 이 스토리의 축은 **'말하면 바뀐다'**이다. 그는 어릴 때 말해봤자 아무것도 안 바뀐다는 걸 배웠고,
 * 여기서는 말하면 실제로 뭔가 바뀐다는 게 아직 익숙하지 않다.
 *
 * ⚠️ 말투는 **짧은 반말 서술체**다. 조용한 신입(quiet_rookie)과 구분하라 —
 *    그쪽은 **필요를 못 느껴서** 말을 안 하고, 이쪽은 **효용을 못 배워서** 안 한다.
 *    이 캐릭터는 **말한 마디 수를 센다**("오늘은 다섯 마디 했다"). 그게 진행 지표다.
 * ⚠️ 어릴 때 얘기를 구체적으로 쓰지 마라. 그는 끝까지 내용은 말하지 않고, **왜 안 하는지**만 말한다.
 * ⚠️ 그를 수다스럽게 만들지 마라. 3회차의 최대치는 열 마디다.
 * 줄기: 1회차 다섯 마디 → 2회차 내가 먼저 앞에 섰다 → 3회차 왜 말을 줄였는가.
 */
export const CLASSMATE_STORY: DmStory = {
  id: "classmate_1",
  partnerName: "말수 적은 동급생",
  partnerHandle: "quiet_classmate",
  arrivalTitle: "말수 적은 동급생의 DM",
  startNode: "five_words",
  nodes: [
    {
      id: "five_words",
      intro: [
        "좋아요를 눌렀길래 인사한다",
        "말을 많이 하는 게 피곤해서 줄였더니 다들 화났냐고 묻는다. 안 화났다",
        "요즘 연습 중이다. 오늘은 다섯 마디 했다",
        "…이걸 왜 세고 있는지는 나도 모르겠다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세고 있으면 늘리고 싶은 거지",
          reply: "…그런가. 늘리고 싶은 건지 확인하고 싶은 건지 모르겠다",
          next: "why_count",
          effect: { skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "다섯 마디면 어제보다 많아, 적어?",
          reply: "…많다. 어제는 셋이었다. 그걸 물어본 사람은 처음이다",
          next: "why_count",
          effect: { skills: { knowledge: 20 } },
        },
        {
          tone: "bold",
          me: "화났냐고 묻는 사람들한테 안 화났다고는 말해?",
          reply: "…안 한다. 그것도 말이라서. 그냥 고개만 젓는다",
          next: "why_count",
          effect: { mental: -2, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "why_count",
      intro: [
        "여기서는 말을 하면 실제로 뭔가가 바뀐다. 그게 아직 익숙하지 않다",
        "그래서 자꾸 도로 삼킨다. 삼킨 게 하루에 열 번쯤 된다",
        "동급생 하나는 내 몫까지 떠들어준다. 편하다. 고맙다고는 안 했다",
        "…근데 그놈이 없으면 아무도 내 몫을 안 떠들어준다는 것도 안다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고맙다고 한 마디만 해봐. 그거 한 마디로 쳐줄게",
          reply: "…한 마디로 쳐준다니 계산이 이상한데. 하루 생각해보겠다",
          next: "the_thanks",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "삼킨 열 번 중에 하나만 뱉어. 매일 하나씩",
          reply: "…하나씩. 그 정도면 해볼 만하다. 내일 해보겠다",
          next: "the_thanks",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "떠들어주는 사람한테 기대는 건 말을 안 배우는 방법이야",
          reply: "…맞는 말이라 좀 짜증 난다. 내일 답하겠다",
          next: "the_thanks",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_thanks",
      intro: [
        "말했다. '떠들어줘서 편했다.' 이렇게",
        "그놈이 3초쯤 굳어 있다가 갑자기 두 배로 떠들기 시작했다. 실패인가 싶었다",
        "그런데 저녁에 나한테 오더니 '앞으로도 말해라'라고 했다. 그것도 한 마디였다",
        "…오늘은 일곱 마디 했다. 기록이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기록 축하해. 일곱 마디면 큰 거야",
          reply: "…큰 건가. 남들은 하루에 몇백 마디 할 텐데. 그래도 기분은 나쁘지 않다",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "두 배로 떠든 건 좋아서 그런 거야. 실패 아니고",
          reply: "…그렇게 읽는 거였구나. 나는 사람 반응 읽는 게 제일 어렵다",
          next: null,
          effect: { mental: 8, skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "일곱 마디 세고 있는 것도 그놈한테 말해봐",
          reply: "…그건 안 한다. 그건 좀 창피하다. 나중에는 할지도 모르겠다",
          next: null,
          effect: { mental: -3, followers: 150, skills: { sociability: 20, knowledge: 15 } },
        },
      ],
    },
  ],
};

/**
 * 말수 적은 동급생 2회차 — 내가 먼저 앞에 섰다.
 * 축은 **'유리 다루듯 대해지는 것'**이다. 그는 안 깨진다고 말하는 대신 행동으로 보여준다.
 * ⚠️ 그를 각성시키지 마라. 이 회차에서 그는 특별히 강해지지 않는다 — 다만 순서를 뺏는다.
 */
const CLASSMATE_STORY_2: DmStory = {
  id: "classmate_2",
  partnerName: "말수 적은 동급생",
  partnerHandle: "quiet_classmate",
  arrivalTitle: "말수 적은 동급생의 DM",
  startNode: "handled_like_glass",
  nodes: [
    {
      id: "handled_like_glass",
      intro: [
        "다들 나를 유리 다루듯이 조심스럽게 대한다",
        "안 깨진다고 말하고 싶은데 그 말을 꺼내는 것도 좀 그래서 훈련량을 두 배로 늘렸다",
        "그랬더니 이번엔 무리하지 말라고 하더라",
        "…사람 상대하는 건 역시 싸우는 것보다 훨씬 어렵다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "훈련량 두 배는 말이 아니라 걱정거리로 읽혀. 다른 방법이 필요해",
          reply: "…다른 방법. 그게 뭔지 모르겠어서 훈련량을 늘린 거다. 하루 생각하겠다",
          next: "the_step",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "안 깨진다고 그냥 말해. 다섯 글자야",
          reply: "…다섯 글자. 계산은 쉬운데 입이 안 떨어진다. 내일 해보겠다",
          next: "the_step",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "조심스럽게 대하는 게 싫은 거야, 아니면 그럴 만한 이유가 있는 거야?",
          reply: "…둘 다다. 이유는 안 말한다. 하루 생각하고 답하겠다",
          next: "the_step",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_step",
      intro: [
        "동급생 하나가 자꾸 내 몫의 위험한 일까지 가져간다. 몇 번이나 하지 말라고 했는데 안 듣는다",
        "그래서 오늘은 아예 내가 먼저 앞에 서버렸다",
        "그때 그놈 표정이 아주 볼만했다. 말로 안 되는 건 이렇게 하면 된다",
        "…다음에도 계속 그럴 생각이니까 각오해두는 게 좋을 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 제일 확실한 다섯 글자였네",
          reply: "…말보다 빨랐다. 앞으로도 이 방법을 쓰겠다",
          next: "what_changed",
          effect: { mental: 10, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "그 사람도 걱정돼서 그런 거야. 앞에 선 걸로 답이 됐고",
          reply: "…걱정인 건 안다. 그래서 화는 안 냈다. 앞에만 섰다",
          next: "what_changed",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "위험한 건 위험한 거야. 증명하려고 앞에 서지는 마",
          reply: "…증명하려고 선 게 아니다. …아니라고 하고 싶은데 반은 맞다",
          next: "what_changed",
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_changed",
      intro: [
        "그 뒤로 그놈이 내 몫을 안 가져간다. 대신 옆에 선다",
        "이건 내가 원하던 결과다. 말로는 반년을 못 바꿨는데 한 번에 됐다",
        "다들 여전히 나를 조심스럽게 대하지만 그놈은 안 그런다",
        "…한 명이면 충분한 것 같다. 나머지는 천천히 해도 된다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "한 명이면 충분해. 그게 시작이고",
          reply: "…시작이라. 그럼 나는 반년 만에 시작한 거다. 느리지만 했다",
          next: null,
          effect: { mental: 15, followers: 180, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "말로 반년 걸린 걸 행동으로 하루에 했으면 네 방식이 맞는 거야",
          reply: "…내 방식이 있다는 것도 오늘 처음 알았다. 나쁘지 않다",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "나머지한테도 해. 한 명으로 만족하면 거기서 끝이야",
          reply: "…천천히 하겠다. 재촉하지 마라. 그래도 하기는 하겠다",
          next: null,
          effect: { mental: -3, followers: 220, skills: { sociability: 25, fitness: 15 } },
        },
      ],
    },
  ],
};

/**
 * 말수 적은 동급생 3회차 — 왜 줄였는가.
 * 그가 어릴 때 얘기를 처음으로 꺼낸다. **내용은 끝까지 말하지 않는다** — 왜 안 하는지만 말한다.
 * ⚠️ 과거를 구체적으로 쓰지 마라. 캐묻는 선택지(bold)도 답을 얻지 못한다. 그게 이 캐릭터의 경계다.
 */
const CLASSMATE_STORY_3: DmStory = {
  id: "classmate_3",
  partnerName: "말수 적은 동급생",
  partnerHandle: "quiet_classmate",
  arrivalTitle: "말수 적은 동급생의 DM",
  startNode: "why_i_stopped",
  nodes: [
    {
      id: "why_i_stopped",
      intro: [
        "어릴 때 얘기는 안 한다. 물어보지 말아 달라는 뜻이다",
        "그래도 이건 말해도 될 것 같다. 왜 말수를 줄였는지",
        "말해봤자 아무것도 안 바뀐다는 걸 일찍 배웠다. 그게 전부다",
        "…내용은 말 안 한다. 그건 앞으로도 안 할 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 물어볼게. 그것만 알아도 충분해",
          reply: "…안 물어봐 주는 사람은 드물다. 그래서 여기다 쓴 거다",
          next: "here_it_changes",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "일찍 배운 게 문제야. 그건 틀린 규칙이었고",
          reply: "…틀린 규칙. 그때는 맞았다. 지금은 아닌 것 같고. 하루 생각하겠다",
          next: "here_it_changes",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "내용을 안 말하면 그 규칙도 못 고쳐",
          reply: "…그래도 안 한다. 그건 양보 못 한다. 다른 얘기는 하겠다",
          next: "here_it_changes",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "here_it_changes",
      intro: [
        "여기 와서 처음 놀란 게 뭔지 아냐. 내가 손을 다쳤는데 아무도 몰랐던 날이다",
        "말 안 했으니 당연한 거였다. 예전 같으면 그걸로 끝이었다",
        "그런데 다음 날 동급생 하나가 내 손을 보더니 말없이 붕대를 갖고 왔다",
        "…말을 안 했는데 바뀐 거다. 그런 것도 있다는 걸 열여섯에 알았다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 네가 여기 있었으니까 생긴 일이야",
          reply: "…내가 있어서. 그건 계산에 없던 이유다. 나쁘지 않다",
          next: "ten_words",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "말 안 해도 바뀌는 곳이면 말하면 더 바뀌겠지",
          reply: "…그 순서로 생각해본 적은 없다. 그럼 해볼 만하다",
          next: "ten_words",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 붕대를 보고도 반년을 더 안 말했잖아",
          reply: "…그랬다. 믿는 데 반년 걸렸다. 그건 내가 느린 거다",
          next: "ten_words",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "ten_words",
      intro: [
        "오늘 열 마디 했다. 세어봤다. 열 마디는 처음이다",
        "그중 하나는 '나 어릴 때 얘기는 안 할 거다'였다. 처음으로 그걸 말로 했다",
        "동급생 둘이 '알겠다'고 했다. 그게 다였다. 더 안 물었다",
        "…말했더니 안 물어보게 됐다. 이런 식으로도 바뀌는구나 싶었다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말 안 하겠다고 말한 것도 말이야. 그것도 세",
          reply: "…셌다. 그게 오늘 제일 무거운 한 마디였다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 280,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "경계선을 그은 거야. 그건 마음을 여는 것보다 어려워",
          reply: "…어려웠다. 그런데 긋고 나니 안이 편해졌다. 이상한 일이다",
          next: null,
          effect: { mental: 15, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "내일은 열한 마디 해. 하루에 하나씩",
          reply: "…계산이 부담스러운데. 알겠다. 하나씩 늘려보겠다",
          next: null,
          effect: {
            mental: 12,
            followers: 300,
            skills: { sociability: 30, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 반지 낀 2학년 — 곁에 있기만 해도 사람이 다치던 시절을 지나온 선배(`data/accounts.ts` ring_keeper).
 * 그의 트윗을 **리트윗**하면 DM이 온다 — 조심스럽게 대해지던 사람의 글이 퍼진 게 1회차의 문이다.
 *
 * 이 스토리의 축은 **'자기를 용서하는 일'**이다. 몇 년이 걸렸고 아직 다 못 했을지도 모른다.
 * 그는 그 미완을 부끄러워하지 않고, 대신 받은 걸 후배에게 갚는 방식으로 산다.
 *
 * ⚠️ 말투는 **차분한 존댓말**이다. 자조하지 않고, 과장도 하지 않는다.
 * ⚠️ 반지의 이유를 밝히지 마라 — 계정 문구대로 "묻지 말아 달라"가 끝까지 유지된다.
 *    캐묻는 선택지(bold)도 답을 얻지 못한다.
 * ⚠️ 과거의 사건을 구체적으로 묘사하지 마라. "다쳤다"·"잃었다"까지만 쓴다.
 * ⚠️ 후배 셋은 "후배 셋"으로만 부른다(계정 특정 금지). 선배도 "선배"로만 부른다.
 * 줄기: 1회차 조심스럽게 대해지는 것 → 2회차 자책하는 후배 옆에 앉아 있기 → 3회차 아직 다 못 한 용서.
 */
export const RING_STORY: DmStory = {
  id: "ring_1",
  partnerName: "반지 낀 2학년",
  partnerHandle: "ring_keeper",
  arrivalTitle: "반지 낀 2학년의 DM",
  startNode: "handled_carefully",
  nodes: [
    {
      id: "handled_carefully",
      intro: [
        "제 글을 퍼가주셨더군요. 감사합니다. 이런 일이 아직 익숙하지 않습니다.",
        "제 과거를 아는 사람들은 저를 조심스럽게 대합니다. 이해합니다.",
        "저 때문에 사람들이 다치던 시절이 있었습니다. 지금은 반대로 살고 있고요.",
        "…그런데 조심스럽게 대해지는 게 편할 때도 있다는 걸 요즘 알았습니다. 그게 좀 그렇습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "편한 게 나쁜 건 아니에요",
          reply: "…나쁜 건 아니죠. 다만 그 편함에 기대면 안 되겠다 싶어서요.",
          next: "the_debt_ring",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "조심스럽게 대해지면 아무도 기대를 안 하니까요",
          reply: "…정확합니다. 기대를 안 받는 게 편했던 겁니다. 부끄러운 얘기죠.",
          next: "the_debt_ring",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "반지는 왜 안 빼요?",
          reply: "…그건 안 말합니다. 다른 건 다 물어보셔도 됩니다.",
          next: "the_debt_ring",
          effect: { mental: -3, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_debt_ring",
      intro: [
        "예전엔 제가 곁에 있기만 해도 사람들이 다쳤습니다. 그래서 한동안 아무도 안 만났습니다.",
        "그때 저한테 손을 내밀어준 사람들이 지금의 제 동급생들입니다.",
        "그러니까 저는 그 빚을 후배들한테 갚고 있는 중입니다.",
        "…그런데 빚이라고 부르는 게 맞는 건지 요즘 헷갈립니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "빚이 아니라 물려받은 거예요",
          reply: "…물려받았다. 그 표현이 훨씬 낫군요. 하루 두고 생각해보겠습니다.",
          next: "what_i_call_it",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "빚이라고 부르면 다 갚고 나서 그만둘 수 있잖아요. 그게 편해서 그렇게 부르는 거고요",
          reply: "…그건 생각 못 했습니다. 하룻밤 생각해보겠습니다.",
          next: "what_i_call_it",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "빚 갚는 걸로 자기 용서를 대신하고 있는 거 아니에요?",
          reply: "…아플 정도로 맞는 말일 수 있습니다. 내일 답하겠습니다.",
          next: "what_i_call_it",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_call_it",
      intro: [
        "생각해봤습니다. 빚이라고 부른 건 끝이 있는 걸로 만들고 싶어서였습니다.",
        "다 갚으면 그만해도 되니까요. 그러면 언젠가는 편해질 거라고 생각했습니다.",
        "그런데 제 선배는 저한테 빚을 지운 적이 없습니다. 그냥 데려왔을 뿐입니다.",
        "…그래서 이름을 바꾸기로 했습니다. 빚 말고 그냥 제 일이라고 부르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 훨씬 오래 가는 이름이에요",
          reply: "…오래 갑니다. 끝이 없다는 뜻이기도 하고요. 그래도 이쪽이 맞습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "선배가 안 지운 걸 본인이 지고 있었던 거네요",
          reply: "…제가 지었습니다. 아무도 안 시켰는데요. 그게 제 방식이었나 봅니다.",
          next: null,
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "이름만 바꾼다고 편해지진 않아요",
          reply: "…압니다. 편해지려고 바꾼 게 아닙니다. 정확해지려고 바꾼 겁니다.",
          next: null,
          effect: { mental: -3, followers: 150, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 반지 낀 2학년 2회차 — 옆에 앉아 있기.
 * 축은 **'말로 안 낫는 걸 아는 것'**이다. 그는 위로의 한계를 알고, 그래서 오래 앉아 있는다.
 * ⚠️ 후배를 낫게 만들지 마라. 이 회차의 결말은 후배가 밥을 먹는 것까지다.
 */
const RING_STORY_2: DmStory = {
  id: "ring_2",
  partnerName: "반지 낀 2학년",
  partnerHandle: "ring_keeper",
  arrivalTitle: "반지 낀 2학년의 DM",
  startNode: "the_blaming_kid",
  nodes: [
    {
      id: "the_blaming_kid",
      intro: [
        "후배 하나가 자기 때문에 사람이 죽었다고 자책합니다. 사흘째 그러고 있습니다.",
        "그건 네 잘못이 아니라고 말해줬습니다. 사실이기도 하고요.",
        "그런데 그런 말 한마디로 낫지 않는다는 걸 저도 잘 압니다. 제가 그랬으니까요.",
        "…그래서 지금 뭘 해야 하는지 아는데, 그게 맞는지는 매번 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "옆에 앉아 계세요. 그게 맞아요",
          reply: "…그렇게 하겠습니다. 저한테도 그렇게 해준 사람이 있었습니다.",
          next: "three_days",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "낫게 하려 하지 마세요. 사흘은 짧아요",
          reply: "…짧습니다. 저는 몇 년 걸렸으니까요. 조급했던 것 같습니다.",
          next: "three_days",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "본인이 그때 뭘 받고 싶었는지 생각해보세요",
          reply: "…아무 말도 안 해주는 것이었습니다. 그건 기억납니다. 하루 생각하겠습니다.",
          next: "three_days",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "three_days",
      intro: [
        "어제 그 후배 옆에 두 시간 앉아 있었습니다. 아무 말도 안 했습니다.",
        "한 시간쯤 지나서 그 애가 먼저 물었습니다. '선배는 어떻게 견뎠어요?'",
        "'안 견뎠다'고 답했습니다. 견딘 게 아니라 그냥 시간이 지났다고요.",
        "…거짓말은 안 하고 싶었습니다. 견뎠다고 하면 견디는 법이 있는 것처럼 들리니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 제일 정직한 답이에요",
          reply: "…정직한 답이 도움이 되는지는 아직 모르겠습니다. 그래도 그렇게 했습니다.",
          next: "the_meal_ring",
          effect: { mental: 10, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "견디는 법이 있다고 했으면 그 애가 자기를 또 탓했을 거예요",
          reply: "…못 견디는 자기를요. 네. 그래서 안 했습니다. 잘 봐주셨습니다.",
          next: "the_meal_ring",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "시간이 지났다는 말은 위로가 안 돼요. 그건 아시죠",
          reply: "…압니다. 위로하려고 한 말이 아닙니다. 사실을 말한 겁니다.",
          next: "the_meal_ring",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_meal_ring",
      intro: [
        "오늘 그 후배가 밥을 먹었습니다. 사흘 만입니다.",
        "다 같이 먹었습니다. 저는 혼자 먹는 밥을 오래 먹어봐서 압니다. 그건 안 좋습니다.",
        "그 애가 다 나은 건 아닙니다. 그건 앞으로도 오래 걸릴 겁니다.",
        "…그래도 오늘은 먹었습니다. 그거면 오늘은 충분합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "충분해요. 하루씩만 세면 돼요",
          reply: "…하루씩. 저도 그렇게 세면서 왔습니다. 그 애도 그럴 겁니다.",
          next: null,
          effect: { mental: 15, morality: 8, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "밥을 먹였다기보다 자리를 만든 거예요. 그게 선배가 하는 일이고요",
          reply: "…자리요. 제 선배도 저한테 그걸 했습니다. 이제 알겠습니다.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 애가 나을 때까지 옆에 있을 자신 있어요?",
          reply: "…있습니다. 그건 제가 할 수 있는 몇 안 되는 일입니다.",
          next: null,
          effect: { mental: 10, followers: 220, skills: { sociability: 30, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 반지 낀 2학년 3회차 — 아직 다 못 한 것.
 * 축은 **'자기 용서의 미완'**이다. 그는 다 용서하지 못했고, 그걸 결함으로 두지 않는다.
 * ⚠️ 용서를 완료시키지 마라. 결말은 "아직 다 못 했다"를 **말할 수 있게 된 것**이다.
 * ⚠️ 반지의 이유는 이 회차에서도 밝히지 않는다.
 */
const RING_STORY_3: DmStory = {
  id: "ring_3",
  partnerName: "반지 낀 2학년",
  partnerHandle: "ring_keeper",
  arrivalTitle: "반지 낀 2학년의 DM",
  startNode: "the_festival",
  nodes: [
    {
      id: "the_festival",
      intro: [
        "학교 축제였습니다. 이런 평범한 일정이 저는 참 좋습니다.",
        "후배 셋이 저를 끌고 다녔습니다. 사진도 찍혔습니다. 오랜만입니다.",
        "그런데 사진을 보다가 제 손이 먼저 보이더군요. 반지 낀 쪽이요.",
        "…즐거운 날에 그게 먼저 보이는 건 아직 제가 어딘가 안 끝났다는 뜻이겠죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 끝나도 즐거웠으면 된 거예요",
          reply: "…둘 다 있어도 되는 거군요. 그건 생각 안 해봤습니다.",
          next: "not_yet_done",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "끝내야 한다고 누가 정했어요?",
          reply: "…제가 정했습니다. 몇 년 안에 끝내겠다고요. 하루 생각해보겠습니다.",
          next: "not_yet_done",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "사진에서 손이 먼저 보인 건 반지 얘기를 하고 싶다는 거예요",
          reply: "…그건 아닙니다. 그건 정말 아닙니다. …하루 생각해보겠습니다.",
          next: "not_yet_done",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "not_yet_done",
      intro: [
        "제 자신을 용서하는 데 몇 년이 걸렸습니다. 그리고 아직 다 못 했습니다.",
        "예전엔 이걸 결함이라고 생각했습니다. 다 용서한 사람만 남을 도울 자격이 있다고요.",
        "그런데 다 용서한 사람은 아마 그 후배 옆에 두 시간 못 앉아 있을 겁니다.",
        "…아직 안 끝난 사람이라서 앉아 있을 수 있었던 것 같습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 자격이에요. 다 끝낸 게 아니라",
          reply: "…자격이라고 불러주시는군요. 오래 걸렸지만 오늘 그렇게 정리하겠습니다.",
          next: "the_ring_stays",
          effect: { mental: 15, morality: 8, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "다 용서했으면 그 자리에서 조언을 했겠죠. 그건 도움이 안 되고요",
          reply: "…조언을 안 한 게 제가 한 일 중에 제일 잘한 겁니다. 그렇게 세겠습니다.",
          next: "the_ring_stays",
          effect: { mental: 10, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "안 끝난 걸 쓸모로 만드는 것도 도망이에요",
          reply: "…그럴 수도 있습니다. 그래도 지금은 이 방법밖에 모릅니다.",
          next: "the_ring_stays",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_ring_stays",
      intro: [
        "후배가 오늘 저한테 물었습니다. 반지 왜 끼고 있냐고요. 아무렇지 않게요.",
        "안 말한다고 했습니다. 그랬더니 '아 네' 하고 끝이더군요. 더 안 물었습니다.",
        "예전 같으면 그 질문 하나에 하루가 흔들렸을 겁니다. 오늘은 안 흔들렸습니다.",
        "…반지는 안 뺍니다. 앞으로도 안 뺄 겁니다. 그건 변하지 않았습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 흔들린 게 오늘의 진짜 소식이네요",
          reply: "…그렇습니다. 그게 오늘 제일 큰일이었습니다. 아무도 모르지만요.",
          next: null,
          effect: {
            mental: 20,
            morality: 8,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "안 말한다고 말할 수 있게 된 거예요. 예전엔 그것도 못 했죠",
          reply: "…못 했습니다. 그때는 그냥 자리를 피했습니다. 오늘은 앉아서 답했습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "언젠가 말할 날이 오면 그때는 말하세요",
          reply: "…그날이 오면요. 오늘은 아닙니다. 그건 확실히 해두겠습니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { sociability: 30, knowledge: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 안경 쓴 무기광 — 재능이 없어서 도구를 드는 2학년(`data/accounts.ts` no_talent_blade).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **'재능 없음은 저주가 아니라 조건'**이다. 그는 그 조건을 이미 받아들였고, 흔들리지 않는다.
 * 흔들리는 건 집 얘기 쪽이다 — 3회차에서 그걸 딱 한 번 꺼낸다.
 *
 * ⚠️ 말투는 **거친 반말**이다("~다/~냐/~잖나"). 고칠 생각 없다고 본인이 써둔 그대로 유지하라.
 * ⚠️ 그를 위로받게 만들지 마라. 위로는 그가 제일 불편해하는 것이다(도움받는 데 익숙하지 않다).
 * ⚠️ 집안 얘기의 구체적 사건을 쓰지 마라 — "실패작 취급이었다"까지가 이 캐릭터가 허용한 선이다.
 * 줄기: 1회차 재능 얘기 → 2회차 우는 후배 → 3회차 안 돌아가는 집.
 */
export const BLADE_STORY: DmStory = {
  id: "blade_1",
  partnerName: "안경 쓴 무기광",
  partnerHandle: "no_talent_blade",
  arrivalTitle: "안경 쓴 무기광의 DM",
  startNode: "no_talent",
  nodes: [
    {
      id: "no_talent",
      intro: [
        "좋아요 눌렀더군. 내 글에 그런 거 누르는 사람 잘 없다",
        "미리 말해두는데 말투는 안 고친다. 지적은 이미 받았고 안 고칠 생각이다",
        "재능이 없다는 소리를 평생 들었다. 그래서 도구를 쓴다. 그게 뭐 어때서",
        "…근데 요즘 후배 하나가 그 소리를 듣고 운다. 그건 어떻게 해야 하냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "당신도 없다고 말해줘요. 그게 제일 셀 텐데",
          reply: "…나도 없다고. 그건 생각 못 했다. 해볼 만하다",
          next: "the_method",
          effect: { skills: { sociability: 15, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "울게 두세요. 울고 나서 물어볼 때 답하면 돼요",
          reply: "…울 시간에 한 번 더 휘두르라는 게 내 신조인데. 뭐, 일리는 있다",
          next: "the_method",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "재능 없다고 우는 건 아직 안 해봤다는 뜻이에요",
          reply: "…맞다. 정확히 그거다. 근데 그 말을 그대로 하면 그놈이 또 운다",
          next: "the_method",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_method",
      intro: [
        "타고난 게 없으면 훈련량으로 메우면 된다. 단순한 계산이다",
        "남들 두 배는 해야 겨우 비슷해진다. 그래서 다섯 시간 한다",
        "제일 싫어하는 말이 '어쩔 수 없잖아'다. 어쩔 수 있게 만들면 되잖나",
        "…근데 이 말을 후배한테 하면 그냥 잔소리로 들린다. 방법이 없냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말 말고 훈련표를 짜주세요. 두 배로",
          reply: "…표를 짜준다. 그건 내가 잘한다. 내일 짜서 던져주겠다",
          next: "the_crying_kid",
          delayDays: 1,
          effect: { skills: { sociability: 20, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "다섯 시간을 어떻게 버티는지가 진짜 노하우예요. 그걸 알려주세요",
          reply: "…버티는 법. 그건 나도 설명해본 적이 없다. 하루 정리하겠다",
          next: "the_crying_kid",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "잔소리로 들리는 건 당신이 이미 해낸 사람이라서예요",
          reply: "…해낸 사람. 그렇게 불린 적은 없다. 하루 생각해보겠다",
          next: "the_crying_kid",
          delayDays: 1,
          effect: { mental: 4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_crying_kid",
      intro: [
        "그 후배한테 나도 재능 없다고 말해줬다. 눈이 커지더라",
        "그리고 내일부터 훈련량을 두 배로 잡아줬다. 고마워하던데 두고 보면 알 거다",
        "없으면 없는 대로 이기는 방법을 알려주는 게 선배 일이다. 그건 내가 배운 게 아니라 그냥 그렇게 정했다",
        "…울던 놈이 오늘은 안 울었다. 그럼 된 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "선배 일 잘하고 계시네요",
          reply: "…그런 말은 안 익숙하다. 다음부터 하지 마라. …아니, 해도 된다",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "훈련량 두 배는 위로가 아니라 신뢰예요. 그 애도 알걸요",
          reply: "…신뢰라. 나는 그냥 방법을 준 건데 그렇게 되나",
          next: null,
          effect: { skills: { knowledge: 35, fitness: 10 } },
        },
        {
          tone: "bold",
          me: "두고 보면 안다면서요. 안 따라오면 어쩔 건데요",
          reply: "…그럼 반으로 줄여준다. 그 정도는 봐줄 수 있다. 그 이상은 안 된다",
          next: null,
          effect: { mental: -3, followers: 150, skills: { fitness: 25 } },
        },
      ],
    },
  ],
};

/**
 * 안경 쓴 무기광 2회차 — 도움받는 일.
 * 축은 **'누가 도와주려 하면 불편한 것'**이다. 그는 주는 건 잘하는데 받는 걸 못 한다.
 */
const BLADE_STORY_2: DmStory = {
  id: "blade_2",
  partnerName: "안경 쓴 무기광",
  partnerHandle: "no_talent_blade",
  arrivalTitle: "안경 쓴 무기광의 DM",
  startNode: "being_helped",
  nodes: [
    {
      id: "being_helped",
      intro: [
        "어제 훈련 중에 손목이 갔다. 심한 건 아니다",
        "동급생 하나가 말없이 내 무기 정비를 다 해놨더라. 열두 자루다",
        "누가 나를 도와주려 하면 좀 불편하다. 익숙하지가 않다",
        "…고맙다고 해야 하는 건 아는데 입에서 안 나온다. 이건 왜 이러냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 나오면 다른 걸로 갚아요. 그쪽이 당신 방식이잖아요",
          reply: "…갚는 건 할 수 있다. 그놈 무기도 손봐주면 되겠군",
          next: "the_payback",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "받는 게 불편한 건 빚지는 게 싫어서예요?",
          reply: "…빚이 아니라 자격이다. 내가 그럴 만한 놈인가 싶은 거지. 하루 생각하겠다",
          next: "the_payback",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "열두 자루 정비하는 거 몇 시간인지 알죠? 그건 그냥 받으세요",
          reply: "…세 시간이다. 알고 있다. 그래서 더 불편한 거다",
          next: "the_payback",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_payback",
      intro: [
        "그놈 무기를 손봐줬다. 밤새 했다. 손목은 나았으니 상관없다",
        "아침에 돌려줬더니 '이거 새것보다 좋은데'라고 하더라",
        "그래서 '당연하지'라고 했다. 다른 말은 안 나왔다",
        "…근데 그놈이 웃었다. 고맙다는 말 없이도 통한 것 같다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "통했어요. 그게 당신들 방식이고요",
          reply: "…방식이라고 부를 만한 건가. 뭐, 그렇다고 해두겠다",
          next: "who_calls_me_what",
          effect: { mental: 10, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "밤새 한 건 갚은 게 아니라 두 배로 준 건데요",
          reply: "…세 시간 받고 여덟 시간 줬으니 계산은 안 맞는다. 그건 내 사정이고",
          next: "who_calls_me_what",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "손목 나았다는 것도 거짓말이죠",
          reply: "…거의 나았다. 그 정도면 나은 거다. 더 안 묻는 걸로 하자",
          next: "who_calls_me_what",
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "who_calls_me_what",
      intro: [
        "후배들이 나보고 무섭다고 한다. 잘 알고 있다",
        "동급생 둘은 나보고 그냥 훈련 많이 하는 놈이라고 한다",
        "집에서는 실패작이었다. 여기서는 훈련 많이 하는 선배다",
        "…딱 이 차이 하나 때문에 나는 여기 있다. 남이 뭐라고 부르는지가 이렇게 중요할 줄 몰랐다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 이름은 당신이 만든 거예요. 다섯 시간씩 해서",
          reply: "…내가 만들었다. 그렇게 세니까 좀 낫다. 나쁘지 않은 계산이다",
          next: null,
          effect: { mental: 15, followers: 180, skills: { sociability: 30, fitness: 15 } },
        },
        {
          tone: "cool",
          me: "부르는 이름이 바뀐 게 아니라 부르는 사람이 바뀐 거예요",
          reply: "…그쪽이 정확하다. 사람을 바꾸는 게 답이었던 거군",
          next: null,
          effect: { mental: 10, followers: 150, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "실패작이라고 부른 쪽은 아직도 그렇게 부르겠죠",
          reply: "…부르겠지. 안 듣는다. 안 가니까 안 들린다. 그거면 됐다",
          next: null,
          effect: { mental: -5, followers: 200, skills: { knowledge: 35, fitness: 15 } },
        },
      ],
    },
  ],
};

/**
 * 안경 쓴 무기광 3회차 — 안 돌아가는 집.
 * 그가 집 얘기를 딱 한 번 꺼낸다. **구체적인 사건은 끝까지 쓰지 마라.**
 * ⚠️ 화해시키지 마라. 결말은 안 돌아가기로 한 것을 **말로 확정하는 것**이다.
 */
const BLADE_STORY_3: DmStory = {
  id: "blade_3",
  partnerName: "안경 쓴 무기광",
  partnerHandle: "no_talent_blade",
  arrivalTitle: "안경 쓴 무기광의 DM",
  startNode: "the_letter",
  nodes: [
    {
      id: "the_letter",
      intro: [
        "집에서 연락이 왔다. 3년 만이다",
        "돌아오라는 얘기는 아니다. 어떤 자리에 얼굴만 비추라는 거다",
        "남이 정해준 인생을 사는 건 죽는 것보다 싫다. 그래서 나온 거였다",
        "…근데 얼굴만 비추는 건데 뭐 어떠냐 싶은 생각이 잠깐 들었다. 그게 짜증 난다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "잠깐 든 생각은 그냥 지나가게 두세요",
          reply: "…지나가게 둔다. 그것도 방법이군. 하루 두고 보겠다",
          next: "what_i_wrote_back",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "얼굴만 비추면 그다음 요구가 와요. 그게 순서예요",
          reply: "…안다. 겪어봤다. 그래서 짜증 나는 거다. 내일 답하겠다",
          next: "what_i_wrote_back",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "가고 싶은 마음이 있는 거잖아요. 그건 인정하고 정하세요",
          reply: "…없다. …아주 없지는 않다. 하룻밤 생각하고 답하겠다",
          next: "what_i_wrote_back",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_wrote_back",
      intro: [
        "안 간다고 답했다. 세 글자로 보냈다",
        "쓰는 데 두 시간 걸렸다. 세 글자를 두 시간 걸려 쓴 건 처음이다",
        "보내고 나서 무기 손질을 네 자루 했다. 손이 떨려서 그건 잘 안 됐다",
        "…떨려도 손질은 된다. 그건 확인했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 시간 걸린 세 글자면 충분히 무거운 답이에요",
          reply: "…무거웠다. 근데 보내고 나니 가볍다. 이건 예상 못 했다",
          next: "the_family",
          effect: { mental: 12, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "떨린 건 무서워서가 아니라 끝냈기 때문이에요",
          reply: "…끝냈다. 그 단어가 맞다. 3년 걸렸다",
          next: "the_family",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "세 글자 말고 이유도 쓰지 그랬어요",
          reply: "…이유를 쓰면 그쪽이 반박한다. 세 글자는 반박이 안 된다. 계산이다",
          next: "the_family",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_family",
      intro: [
        "가족보다 지금 이 학교 사람들이 더 가족 같다",
        "이게 슬픈 건지 다행인 건지 오래 몰랐는데 오늘 정했다. 다행인 걸로 하겠다",
        "오늘 그 후배가 훈련 두 배를 두 달째 채웠다. 안 울고 채웠다",
        "…그놈이 나중에 누구한테 뭐라고 불릴지는 모르겠지만, 실패작은 아닐 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 당신이 만든 결과예요",
          reply: "…내가 만든 건 훈련표뿐이다. 채운 건 그놈이고. …뭐, 절반은 인정하겠다",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 20 },
          },
        },
        {
          tone: "cool",
          me: "다행인 걸로 정한 게 오늘 제일 큰 결정이네요",
          reply: "…그렇다. 세 글자보다 그게 컸다. 나도 방금 알았다",
          next: null,
          effect: { mental: 15, followers: 250, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 애한테 집 얘기는 하지 마세요. 아직은요",
          reply: "…안 한다. 그건 내 몫이지 그놈 몫이 아니다. 그 정도는 안다",
          next: null,
          effect: { mental: 12, followers: 280, skills: { knowledge: 35, sociability: 20 } },
        },
      ],
    },
  ],
};

/**
 * 말하는 마스코트 — 판다가 아니라고 매일 정정하는 2학년(`data/accounts.ts` panda_senpai).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **'겉모습으로 판단당하는 일'**이다. 그는 그걸 누구보다 잘 알아서, 남을 그렇게 안 보려 애쓴다.
 * 웃기는 것도 노동이라는 게 2회차, 인간이 아니라 서러운 순간이 3회차다.
 *
 * ⚠️ 말투는 **능글맞은 반말**이다("~냐/~잖냐/~지"). 개그를 유지하되 **자기 연민으로 흐르지 마라** —
 *    서러운 건 "가끔"이라고 본인이 못 박아뒀다.
 * ⚠️ 그의 정체·구조를 설명하지 마라("형제 셋 들어 있다"까지가 전부다).
 * ⚠️ 동급생 둘은 "진지한 둘"로만 부른다(계정 특정 금지).
 * 줄기: 1회차 인형 취급 → 2회차 웃기는 노동 → 3회차 가끔 서러운 것.
 */
export const PANDA_STORY: DmStory = {
  id: "panda_1",
  partnerName: "말하는 마스코트",
  partnerHandle: "panda_senpai",
  arrivalTitle: "말하는 마스코트의 DM",
  startNode: "not_a_doll",
  nodes: [
    {
      id: "not_a_doll",
      intro: [
        "오, 내 글 퍼갔네. 고맙다. 대체로 다들 사진만 찍고 가거든",
        "먼저 정정할 게 있다. 나는 판다가 아니다. 판다를 모티브로 한 거지 판다가 아니야",
        "오늘도 세 명이 인형인 줄 알고 껴안으려 했다. 나는 학생이다. 성적표도 나온다",
        "…시험 보는 판다 본 적 있냐. 아 또 판다라고 했네",
      ],
      choices: [
        {
          tone: "friendly",
          me: "학생인 거 알아요. 성적은 어때요?",
          reply: "…그걸 묻는 사람은 니가 처음이다. 중간이다. 딱 중간",
          next: "the_hugs",
          effect: { mental: 5, skills: { sociability: 15, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "정정을 매일 하면 그것도 일이겠네요",
          reply: "…일이지. 무급이고. 근데 안 하면 진짜 인형 되는 거라 계속 한다",
          next: "the_hugs",
          effect: { skills: { knowledge: 22 } },
        },
        {
          tone: "bold",
          me: "판다 아니라고 하면서 계정 이름은 그거잖아요",
          reply: "…아 그건. 그건 전략이다. 검색이 잘 되거든. 전략이라고 해두자",
          next: "the_hugs",
          effect: { mental: -2, skills: { comedy: 20 } },
        },
      ],
    },
    {
      id: "the_hugs",
      intro: [
        "인형 취급받는 건 이제 익숙하다. 근데 익숙해지면 안 되는 건데 싶다",
        "귀엽다는 말은 칭찬으로 받기로 했다. 싸우면 나만 손해라서",
        "겉모습으로 판단당하는 게 어떤 건지 나는 이 학교 누구보다 잘 안다",
        "…그래서 나는 누굴 만나든 겉모습으로 먼저 판단 안 하려고 애쓴다. 이게 유일하게 쓸모 있는 교훈이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 교훈 하나면 충분한데요",
          reply: "…충분하다고 해주는 것도 니가 처음이다. 오늘 뭐 이런 날이 다 있냐",
          next: "the_first_laugh",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "익숙해지면 안 된다는 걸 아는 게 안 익숙해진 거예요",
          reply: "…어? 그거 말장난 같은데 맞는 말이네. 하루 곱씹어보겠다",
          next: "the_first_laugh",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "칭찬으로 받기로 한 건 포기한 거잖아요",
          reply: "…포기라기보단 협상이다. 협상. …반은 포기 맞다. 내일 다시 얘기하자",
          next: "the_first_laugh",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_first_laugh",
      intro: [
        "오늘 후배 하나가 처음으로 내 농담에 웃었다. 두 달 만이다",
        "그 애는 여기 온 뒤로 한 번도 안 웃었거든. 다들 조심스럽게 대했고",
        "나는 조심 안 했다. 조심하면 인형이랑 얘기하는 거랑 뭐가 다르냐",
        "…성공적인 하루다. 이 정도면 오늘 노동은 끝",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 달을 버틴 게 대단한 거예요",
          reply: "…버틴 건 그 애지. 나는 옆에서 떠들었을 뿐이고. …반반으로 하자",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "조심 안 한 게 배려였네요. 다들 반대로 했고",
          reply: "…그렇게 정리되나. 나는 그냥 성격대로 한 건데 칭찬 받아두겠다",
          next: null,
          effect: { skills: { knowledge: 35, comedy: 10 } },
        },
        {
          tone: "bold",
          me: "두 달 동안 안 웃긴 농담을 몇 개 한 거예요?",
          reply: "…세지 마라. 아프다. 백 개는 넘는다. 백 개 중에 하나 터진 거다",
          next: null,
          effect: { mental: -3, followers: 180, skills: { comedy: 25 } },
        },
      ],
    },
  ],
};

/**
 * 말하는 마스코트 2회차 — 웃기는 것도 노동.
 * 축은 **'아무도 안 알아주는 일'**이다. 그는 알아달라고 하지 않는다("내가 알면 된 거지").
 */
const PANDA_STORY_2: DmStory = {
  id: "panda_2",
  partnerName: "말하는 마스코트",
  partnerHandle: "panda_senpai",
  arrivalTitle: "말하는 마스코트의 DM",
  startNode: "the_labor",
  nodes: [
    {
      id: "the_labor",
      intro: [
        "동급생 둘이 워낙 무겁게만 산다. 그래서 내가 옆에서 계속 실없는 소리를 한다",
        "그게 없으면 저 둘은 언젠가 진짜로 부러질 것 같아서다",
        "웃기는 것도 엄연한 노동인데 아무도 안 알아준다. 뭐 알아줄 필요도 없고",
        "…근데 오늘은 좀 피곤하다. 이런 날도 있는 거겠지",
      ],
      choices: [
        {
          tone: "friendly",
          me: "피곤한 날은 쉬어요. 하루쯤 안 웃겨도 돼요",
          reply: "…하루 쉬면 저 둘이 그날 부러지면 어쩌냐. 농담이다. 반은 농담이고",
          next: "who_makes_you_laugh",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "알아줄 필요 없다면서 왜 썼어요?",
          reply: "…어. 그러네. 알아달라고 쓴 건가 이거. 하루 생각해보겠다",
          next: "who_makes_you_laugh",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그 둘한테 피곤하다고 말해봐요. 안 했죠",
          reply: "…안 했지. 그건 내 역할이 아니니까. 하루 두고 생각해보겠다",
          next: "who_makes_you_laugh",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "who_makes_you_laugh",
      intro: [
        "말했다. 피곤하다고. 딱 한 마디 했다",
        "그랬더니 진지한 둘이 갑자기 농담을 하기 시작했다. 진심으로 못하더라",
        "너무 못해서 웃었다. 진짜로 웃었다. 이건 계산 밖이었다",
        "…그놈들 농담 실력이 나를 살렸다는 걸 본인들은 모른다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "못하는 농담이 제일 웃긴 법이죠",
          reply: "…그게 진리다. 세상 모든 웃음의 8할은 못해서 나온다",
          next: "the_hard_part",
          effect: { mental: 12, skills: { sociability: 30, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "한 마디 했더니 둘이 움직였네요. 그게 답이에요",
          reply: "…한 마디의 효율이 이렇게 좋을 줄은 몰랐다. 앞으로 좀 써먹겠다",
          next: "the_hard_part",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "본인들 모르게 두지 말고 말해주세요",
          reply: "…그건 좀. 그건 낯간지럽잖냐. 나중에. 아주 나중에",
          next: "the_hard_part",
          effect: { mental: -3, skills: { comedy: 20, knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_hard_part",
      intro: [
        "농담을 잘하는 건 눈치가 빨라야 되는 일이다. 아무나 못 한다",
        "언제 끊어야 하는지가 제일 어렵다. 무거운 얘기를 하는데 웃기면 그건 방해다",
        "그래서 나는 늘 듣고 있다. 웃기는 놈이 제일 잘 듣는다는 걸 아무도 모른다",
        "…싸울 땐 진지하다. 그때까지 웃는 건 다 준비운동이고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "듣고 있다는 거, 그건 티가 나요",
          reply: "…티 나냐? 안 나려고 애썼는데. 뭐, 나쁘지 않다",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "웃기는 게 아니라 언제 안 웃길지를 아는 게 실력이네요",
          reply: "…그 문장 내가 쓴 걸로 하자. 너무 좋은데 내 계정에 올려도 되냐",
          next: null,
          effect: { mental: 10, followers: 220, skills: { knowledge: 40, comedy: 15 } },
        },
        {
          tone: "bold",
          me: "그렇게 잘 들으면서 본인 얘기는 안 하잖아요",
          reply: "…아 진짜 오늘 왜 이러냐 너. …다음에 하자. 다음에 진짜로 한다",
          next: null,
          effect: { mental: -5, followers: 250, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 말하는 마스코트 3회차 — 가끔 서러운 것.
 * 축은 **"인간이 아니라서 서러운 순간이 가끔 있다"**의 그 가끔이다.
 * ⚠️ 그를 인간으로 만들어주는 결말을 쓰지 마라. 결말은 **학생으로 불리는 것**이다.
 */
const PANDA_STORY_3: DmStory = {
  id: "panda_3",
  partnerName: "말하는 마스코트",
  partnerHandle: "panda_senpai",
  arrivalTitle: "말하는 마스코트의 DM",
  startNode: "sometimes",
  nodes: [
    {
      id: "sometimes",
      intro: [
        "저번에 다음에 하자고 했던 얘기, 오늘 한다. 털 빠지는 계절이라 기분이 싱숭생숭해서다",
        "인간이 아니라서 서러운 순간이 가끔 있다. 가끔이다. 그건 강조하고 싶다",
        "어제 학교 사진 찍는 날이었는데 나만 뒤에 세우더라. 크니까 당연한 거다",
        "…당연한 건 아는데 왜 좀 그러냐. 이런 게 서러운 순간이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "당연해도 서러운 건 서러운 거예요",
          reply: "…그렇게 말해주면 좀 낫다. 하루 두고 생각해보겠다",
          next: "the_photo_day",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "뒤에 세운 게 크기 때문인지 물어봤어요?",
          reply: "…안 물어봤다. 답이 무서워서. 하루 생각해보고 답하겠다",
          next: "the_photo_day",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "가끔이라고 세 번 말했어요. 그거 가끔 아니에요",
          reply: "…세 번 했냐 내가. …하루만 시간 줘라. 이건 좀 정리가 필요하다",
          next: "the_photo_day",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_photo_day",
      intro: [
        "사진 다시 찍었다. 진지한 둘이 사진사한테 가서 뭐라고 했더라",
        "'얘 뒤에 세우면 얼굴 안 나와요'라고 했단다. 얼굴이래. 내 얼굴",
        "그래서 앞줄 가운데에 앉았다. 앉으니까 딱 맞더라",
        "…걔들은 내가 서러웠던 거 모른다. 말 안 했으니까",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말 안 해도 알아채는 사람들이네요",
          reply: "…알아챈 건가 그게. 나는 우연인 줄 알았는데. …아니겠지. 걔들인데",
          next: "what_i_am",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "'얼굴'이라고 한 게 핵심이에요. 그 단어 쓴 거요",
          reply: "…그러네. 얼굴이라고 했다. 그 단어 쓰는 사람 별로 없는데",
          next: "what_i_am",
          effect: { mental: 12, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "이번엔 고맙다고 말하세요. 낯간지러워도요",
          reply: "…했다. '고맙다'고 한 마디 했다. 걔들이 오히려 당황하더라",
          next: "what_i_am",
          effect: { mental: 10, skills: { sociability: 25, comedy: 10 } },
        },
      ],
    },
    {
      id: "what_i_am",
      intro: [
        "누가 나한테 넌 뭐냐고 물으면 학생이라고 답한다. 그게 제일 정확하다",
        "판다도 아니고 인형도 아니고 마스코트도 아니다. 성적표 나오는 학생이다",
        "이번 학기 성적은 중간이었다. 체육은 1등이고. 그건 반칙이라고들 하는데",
        "…겉모습이 어떻든 성적표에는 이름이 찍힌다. 그거면 됐다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 성적표 캡처해서 올려요. 판다 아니라는 증거로",
          reply: "…오. 그거 좋은데? 진짜 올려버릴까 이거. 아 근데 성적이 중간이라",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 350,
            skills: { sociability: 35, comedy: 20 },
          },
        },
        {
          tone: "cool",
          me: "이름이 찍힌다는 게 답이네요. 겉모습은 이름을 못 바꾸고요",
          reply: "…그 문장도 내가 쓴 걸로 하자. 오늘 두 개째 훔쳤다",
          next: null,
          effect: { mental: 15, followers: 300, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "체육 1등이 왜 반칙이에요? 그것도 겉모습 판단인데",
          reply: "…어. 그러네. 그거 나도 그냥 웃고 넘겼는데. 다음엔 안 넘긴다",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 35, comedy: 20, fitness: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 서류 담당 보조감독 — 안 싸우고 서류를 쓰는 학교 보조감독(`data/accounts.ts` paperwork_supervisor).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **'보내는 사람'**이다. 그는 자기가 못 나가고 학생을 보낸다. 부대장 대행(acting_captain)과
 * 겹치지 않게 하라 — 그쪽은 **자기 그릇**, 이쪽은 **자기가 안 나간다는 사실**이다.
 *
 * ⚠️ 말투는 **지친 존댓말**이다. 농담을 쓰지 마라 — 이 계정에는 웃긴 문장이 하나도 없다.
 * ⚠️ 그를 면죄하지 마라. 결말은 용서가 아니라 **정확히 쓰는 일을 계속하는 것**이다.
 * ⚠️ 안대 쓴 그분(blindfold_sensei)은 전언으로만 나오고, 그쪽 회차 진행을 전제하지 마라.
 * ⚠️ 죽은 학생의 이름·사건을 만들지 마라. "이름들이 눈에 밟힌다"까지가 선이다.
 * 줄기: 1회차 도장 찍는 손 → 2회차 막을 수 있었던 임무 → 3회차 명단을 세는 습관.
 */
export const SUPERVISOR_STORY: DmStory = {
  id: "supervisor_1",
  partnerName: "서류 담당 보조감독",
  partnerHandle: "paperwork_supervisor",
  arrivalTitle: "서류 담당 보조감독의 DM",
  startNode: "the_stamp",
  nodes: [
    {
      id: "the_stamp",
      intro: [
        "좋아요를 눌러주셨군요. 제 글은 대체로 재미가 없어서 놀랐습니다.",
        "저는 안 싸웁니다. 서류를 씁니다. 그것도 누군가는 해야 하니까요.",
        "규정대로만 하면 학생을 임무에 못 보냅니다. 안 보내면 밖에서 사람이 죽고요.",
        "…그 사이에서 매번 도장을 찍는 게 제 일입니다. 오늘도 스무 장이었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "스무 장이면 스무 번 고민한 거네요",
          reply: "…그렇게 세주시는군요. 저는 스무 번 미뤘다고만 세고 있었습니다.",
          next: "the_middle",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "덜 다치는 쪽을 고르는 건 고르는 게 맞아요. 안 고르는 게 아니고요",
          reply: "…고르고 있다고 해주시니 조금 낫습니다. 저는 떠밀린다고 느꼈습니다.",
          next: "the_middle",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "그 도장 찍는 사람이 안 나가는 건 좀 그렇죠",
          reply: "…네. 그게 제일 견디기 힘든 부분입니다. 정확히 짚으셨습니다.",
          next: "the_middle",
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_middle",
      intro: [
        "상층부와 학생들 사이에 끼어 있습니다. 양쪽 다 저를 안 좋아합니다.",
        "위에서는 물렁하다고 하고 아래에서는 냉정하다고 합니다.",
        "둘 다 맞습니다. 위한테는 물렁하고 아래한테는 냉정한 게 제 자리라서요.",
        "…그런데 요즘 그게 편해지고 있습니다. 그게 제일 무섭습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "편해진 게 아니라 익숙해진 거예요",
          reply: "…익숙해진 것과 편해진 것이 다르다면, 아직은 괜찮은 겁니까.",
          next: "the_good_day",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "무섭다고 느끼는 동안은 안 편해진 거예요",
          reply: "…그 판정이 맞으면 좋겠습니다. 하루 두고 생각해보겠습니다.",
          next: "the_good_day",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "편해지는 게 무서우면 안 편해지는 방법을 만드세요",
          reply: "…방법을요. 그건 생각해본 적 없습니다. 하룻밤 주십시오.",
          next: "the_good_day",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_good_day",
      intro: [
        "방법을 하나 만들었습니다. 도장 찍기 전에 그 학생 이름을 소리 내어 읽기로요.",
        "이름을 읽으면 서류가 서류가 아니게 됩니다. 그래서 다들 안 읽습니다.",
        "오늘 스무 장 다 읽었습니다. 두 장은 읽고 나서 등급을 낮췄습니다.",
        "…오늘은 사고 보고서가 없었습니다. 좋은 날입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 두 장이 오늘의 성과예요",
          reply: "…성과라고 부를 수 있는 거군요. 그럼 오늘은 성과가 있었습니다.",
          next: null,
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "다들 안 읽는 걸 읽기로 한 게 그 자리의 값이에요",
          reply: "…값. 잘한 작전은 학생 공, 망한 건 제 책임이라고 늘 썼는데 이건 제 몫이군요.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "매일 스무 번 읽으면 언젠가 못 읽는 날이 와요",
          reply: "…오겠죠. 그날은 대신 읽어줄 사람을 찾아두겠습니다.",
          next: null,
          effect: { mental: -3, followers: 150, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 서류 담당 보조감독 2회차 — 막을 수 있었던 임무.
 * 축은 **'이미 지나간 결재'**다. 그는 그 건을 아직도 생각한다.
 * ⚠️ 사건을 구체적으로 쓰지 마라. 결말은 그 건을 **기록으로 남기는 방식**을 바꾸는 것이다.
 */
const SUPERVISOR_STORY_2: DmStory = {
  id: "supervisor_2",
  partnerName: "서류 담당 보조감독",
  partnerHandle: "paperwork_supervisor",
  arrivalTitle: "서류 담당 보조감독의 DM",
  startNode: "the_one_i_could_stop",
  nodes: [
    {
      id: "the_one_i_could_stop",
      intro: [
        "제가 막을 수 있었던 임무가 하나 있습니다. 2년 전 일입니다.",
        "등급을 한 단계만 올렸으면 학생이 아니라 정식 인력이 갔을 겁니다.",
        "규정상 그 등급은 아니었습니다. 그래서 규정대로 했습니다.",
        "…규정대로 한 게 맞았습니까. 아직도 그 질문을 매달 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "규정대로 한 걸 자책하면 규정이 무슨 소용이에요",
          reply: "…그 말도 맞습니다. 그런데 규정이 사람을 대신 결정해주진 않더군요.",
          next: "what_changed_after",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "규정이 문제였으면 규정을 고쳤어야죠. 2년이나 있었잖아요",
          reply: "…시도했습니다. 반려됐습니다. 세 번요. 하루 정리해서 답하겠습니다.",
          next: "what_changed_after",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "매달 묻기만 하고 답은 안 정했잖아요",
          reply: "…정하면 끝나버릴 것 같아서요. 하루 생각해보겠습니다.",
          next: "what_changed_after",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_changed_after",
      intro: [
        "그 뒤로 제가 바꾼 게 하나 있긴 합니다. 아무한테도 말 안 했습니다.",
        "등급 판정에 '보조감독 소견'이라는 칸을 만들었습니다. 제가 임의로요.",
        "규정 등급은 그대로 두고, 그 아래에 제 의견을 적습니다. 위험하면 위험하다고요.",
        "…이건 규정 위반은 아닙니다. 다만 아무 효력도 없습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "효력이 없어도 읽는 사람은 있어요",
          reply: "…읽습니다. 학생들이 읽습니다. 그건 제가 의도한 게 아니었는데요.",
          next: "the_record_keeps",
          effect: { mental: 10, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "효력이 없는 게 아니라 기록이 남는 거예요. 그게 더 세고요",
          reply: "…기록. 나중에 누가 규정을 고치려 할 때 근거가 되겠군요.",
          next: "the_record_keeps",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "말 안 한 게 문제예요. 알려야 효력이 생기죠",
          reply: "…자랑처럼 들릴까 봐 안 했습니다. …그것도 핑계군요.",
          next: "the_record_keeps",
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_record_keeps",
      intro: [
        "오늘 학생 하나가 제 소견을 읽고 임무를 거절했습니다. 처음 있는 일입니다.",
        "'선생님이 위험하다고 쓰셨길래요'라고 하더군요. 그 문장을 읽고 손이 좀 떨렸습니다.",
        "상층부에서 왜 거절이 나왔냐고 물었습니다. 소견 때문이라고 답했습니다.",
        "…다음 주에 그 칸을 없애라는 지시가 올지도 모릅니다. 그래도 오늘은 한 명이 안 갔습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "한 명이 안 간 거면 그 칸은 이미 값을 했어요",
          reply: "…값을 했습니다. 없애라고 하면 다른 이름으로 다시 만들겠습니다.",
          next: null,
          effect: { mental: 15, morality: 8, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "거절할 수 있다는 걸 학생이 알게 된 게 더 큰 변화예요",
          reply: "…그렇군요. 한 명이 알면 나머지도 압니다. 그건 제가 못 되돌립니다.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "지시 오면 어떻게 하실 건데요. 진짜로",
          reply: "…안 없앱니다. 반려당하면 네 번째 신청서를 쓰겠습니다. 그건 제가 잘합니다.",
          next: null,
          effect: { mental: 8, followers: 220, skills: { knowledge: 40, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 서류 담당 보조감독 3회차 — 세는 습관.
 * 축은 **'명부를 볼 때마다 몇 명 남았는지 세는 것'**이다.
 * ⚠️ 그를 그만두게 하지 마라. 결말은 계속 앉아 있는 것이고, 다만 세는 방식이 하나 늘어난다.
 */
const SUPERVISOR_STORY_3: DmStory = {
  id: "supervisor_3",
  partnerName: "서류 담당 보조감독",
  partnerHandle: "paperwork_supervisor",
  arrivalTitle: "서류 담당 보조감독의 DM",
  startNode: "counting_names",
  nodes: [
    {
      id: "counting_names",
      intro: [
        "학생 명부를 볼 때마다 몇 명이 남았는지 세게 됩니다. 습관입니다.",
        "졸업생 명단도 관리합니다. 짧은 명단입니다. 그것도 셉니다.",
        "밤에 서류를 정리하다 보면 이름들이 눈에 밟힙니다. 어떤 이름은 이제 없고요.",
        "…그 차이를 만든 결정 중에 제 도장이 찍힌 것도 있습니다. 그래서 대충 못 넘깁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "남은 쪽도 세고 계시죠? 그쪽이 훨씬 많을 텐데",
          reply: "…남은 쪽은 안 셌습니다. 없어진 쪽만 셌습니다. 하루 생각해보겠습니다.",
          next: "the_other_count",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "도장이 찍혔다고 그 결과가 전부 당신 건 아니에요",
          reply: "…전부는 아니겠죠. 그래도 일부는 제 겁니다. 하루 두고 답하겠습니다.",
          next: "the_other_count",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "매일 세면서 계속 앉아 있는 게 제일 어려운 일이에요",
          reply: "…그만두는 게 더 쉽겠죠. 몇 번 생각했습니다. 하룻밤 주십시오.",
          next: "the_other_count",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_other_count",
      intro: [
        "세어봤습니다. 제가 이 자리에 온 뒤로 졸업한 학생이 스물세 명입니다.",
        "그중 열한 명은 제가 등급을 낮춰서 안 보낸 임무가 하나씩 있습니다. 기록에 남아 있더군요.",
        "그 열한 번이 없었어도 다들 무사했을 수도 있습니다. 그건 알 수 없습니다.",
        "…알 수 없는 걸 제 공으로 세는 건 좀 그렇습니다만, 오늘은 세보겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세세요. 오늘 하루만이라도요",
          reply: "…오늘만 세겠습니다. 내일은 또 다른 쪽을 세겠지만요.",
          next: "still_here_desk",
          effect: { mental: 15, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "알 수 없는 걸 못 세면 없어진 쪽도 못 세는 게 맞아요",
          reply: "…양쪽에 같은 기준을 대라는 말씀이군요. 그건 제가 못 하고 있었습니다.",
          next: "still_here_desk",
          effect: { mental: 10, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "스물세 명이 졸업할 동안 당신은 몇 번 쉬었어요?",
          reply: "…계산이 안 됩니다. 그건 안 세고 있었습니다. 세보겠습니다.",
          next: "still_here_desk",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "still_here_desk",
      intro: [
        "명부에 칸을 하나 더 만들었습니다. '무사히 돌아온 횟수'입니다.",
        "학생마다 숫자가 붙습니다. 어떤 학생은 백이 넘습니다. 그걸 보니 좀 이상했습니다.",
        "저는 이 학교에 오래 있었습니다. 오래 있을수록 무서워집니다. 그건 안 변했습니다.",
        "…다만 이제 무서운 쪽 옆에 다른 숫자가 하나 더 있습니다. 그거면 내일도 앉을 수 있습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 칸은 학생들도 보게 해주세요",
          reply: "…보게 하겠습니다. 자기가 몇 번 돌아왔는지는 알아야죠.",
          next: null,
          effect: {
            mental: 18,
            morality: 8,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "무서운 게 안 변한 게 오히려 다행이에요",
          reply: "…다행입니까. 그럼 저는 계속 무서워하겠습니다. 그게 제 자격이라면요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "당신 이름 옆에도 숫자 하나 붙이세요. 몇 년 앉았는지",
          reply: "…제 이름은 명부에 없습니다. …그래도 옆에 적어는 두겠습니다. 8년입니다.",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { knowledge: 40, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 만능 심부름집 사장 — 집세는 밀렸지만 파르페는 먹는 사장(`data/accounts.ts` deadeyes_boss).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **'남 걱정할 처지가 아닌 놈이 남 걱정하는 것'**이다. 그는 그걸 꼴사납다고 하면서 매번 한다.
 *
 * ⚠️ 말투는 **능글맞은 반말**이다("~냐/~잖냐/~지"). 당분·집세·귀찮음 개그를 회차마다 하나씩 넣되,
 *    **무거운 문장은 한 노드에 하나만** 둔다. 그게 이 캐릭터의 배합이다.
 * ⚠️ 그를 각성시키거나 진지한 어른으로 만들지 마라. 3회차에서도 그는 집세를 못 낸다.
 * ⚠️ 옛날 얘기는 안 한다("지금이 더 시끄러워서 생각할 틈이 없다"). 캐물어도 답하지 않는다.
 * ⚠️ 직원들은 "우리 집 애들"로만 부른다.
 * 줄기: 1회차 집세 세 달 → 2회차 울면서 찾아온 손님 → 3회차 지킬 게 있는 놈.
 */
export const BOSS_STORY: DmStory = {
  id: "boss_1",
  partnerName: "만능 심부름집 사장",
  partnerHandle: "deadeyes_boss",
  arrivalTitle: "만능 심부름집 사장의 DM",
  startNode: "rent_overdue",
  nodes: [
    {
      id: "rent_overdue",
      intro: [
        "좋아요 눌러줬네. 고맙다. 근데 그거 눌러도 집세는 안 내려가더라",
        "집세 세 달 밀렸다. 근데 파르페는 먹어야 하잖냐. 이게 인간이다",
        "의뢰 받는다. 위험한 거 말고. 무거운 거 말고. 아침 일찍인 것도 말고",
        "…이렇게 써놓으니 받을 게 없네. 그래서 세 달 밀린 거구나",
      ],
      choices: [
        {
          tone: "friendly",
          me: "조건 하나만 빼도 일이 들어올 텐데요",
          reply: "…아침 일찍은 못 뺀다. 그건 인간의 존엄 문제다",
          next: "the_staff",
          effect: { mental: 4, skills: { sociability: 12, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "파르페 값이 집세보다 쌀 리가 없는데요",
          reply: "…계산해보지 마라. 계산하면 사람이 못 산다. 그건 진리다",
          next: "the_staff",
          effect: { skills: { knowledge: 20, comedy: 10 } },
        },
        {
          tone: "bold",
          me: "그거 사장이 아니라 그냥 백수 아니에요?",
          reply: "…간판이 있으면 사장이다. 간판 값도 밀렸지만 어쨌든 있다",
          next: "the_staff",
          effect: { mental: -2, skills: { comedy: 25 } },
        },
      ],
    },
    {
      id: "the_staff",
      intro: [
        "직원 월급을 못 줬는데 걔들이 나한테 밥을 사줬다. 사장으로서 좀 그렇다",
        "우리 집 애들이 나보고 아저씨란다. 나 아직 20대다. 20대라고",
        "월급 대신 뭐라도 해주고 싶은데 뭘 해줘야 할지 모르겠다",
        "…이런 걸 처음 보는 사람한테 물어보는 것도 웃기는데, 물어볼 데가 없다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "밥 사주세요. 얻어먹었으면 갚아야죠",
          reply: "…돈이 없는데 밥을 어떻게 사냐. …아 내가 만들면 되는구나. 해보겠다",
          next: "the_meal_boss",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "월급 언제 준다고 날짜를 말해주세요. 그게 제일 필요할걸요",
          reply: "…날짜. 그건 무섭다. 지켜야 되잖냐. 하루 생각해보겠다",
          next: "the_meal_boss",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "밥 사준 게 걱정돼서인 건 아세요?",
          reply: "…알지. 아니까 더 그런 거다. 하루만 생각해보자",
          next: "the_meal_boss",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_meal_boss",
      intro: [
        "밥을 만들어줬다. 계란말이랑 된장국이다. 그거밖에 못 한다",
        "애들이 말없이 먹더니 한 놈이 '이거 왜 이렇게 짜요' 하더라. 그래서 물을 부어줬다",
        "그랬더니 다 먹었다. 물 부은 된장국을. 그것도 다",
        "…월급은 다음 달에 준다고 날짜까지 말했다. 지킬 수 있을지는 그때 가서 볼 일이고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "날짜 말한 게 오늘 제일 잘한 거예요",
          reply: "…그러냐. 나는 계란말이가 제일 잘한 건 줄 알았는데",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "짜다고 말한 건 편해졌다는 뜻이에요",
          reply: "…어. 그러네. 예전 같으면 그냥 먹었을 놈이다. 좋은 신호로 치자",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "물 부은 된장국을 먹인 사장은 좀 심한데요",
          reply: "…맛있었다고는 안 했다. 다 먹었다고 했지. 그 차이가 중요하다",
          next: null,
          effect: { mental: -3, followers: 180, skills: { comedy: 30 } },
        },
      ],
    },
  ],
};

/**
 * 만능 심부름집 사장 2회차 — 울면서 온 손님.
 * 축은 **"배고픈 채로 하는 결정은 대체로 틀린다"**이다.
 * ⚠️ 의뢰를 영웅적으로 해결하지 마라. 그가 하는 건 밥을 먹이고 하루를 벌어주는 것까지다.
 */
const BOSS_STORY_2: DmStory = {
  id: "boss_2",
  partnerName: "만능 심부름집 사장",
  partnerHandle: "deadeyes_boss",
  arrivalTitle: "만능 심부름집 사장의 DM",
  startNode: "someone_crying",
  nodes: [
    {
      id: "someone_crying",
      intro: [
        "어제 누가 울면서 찾아왔다. 우리 가게에 그런 사람이 가끔 온다",
        "일단 밥부터 먹였다. 배고픈 채로 하는 결정은 대체로 틀리거든",
        "먹고 나서 하는 얘기를 들어보니 내가 해결할 수 있는 종류가 아니더라",
        "…이럴 때가 제일 곤란하다. 밥은 먹였는데 그다음이 없다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "밥 먹인 거로 하루는 벌어준 거예요",
          reply: "…하루라. 하루면 짧은데. …아니, 하루면 긴가. 모르겠다",
          next: "what_i_could_do",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "해결 못 한다고 솔직히 말했어요?",
          reply: "…아직 안 했다. 그걸 말하는 게 제일 어렵다. 하루 생각해보겠다",
          next: "what_i_could_do",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "못 하겠으면 못 한다고 하세요. 기대하게 두는 게 더 나빠요",
          reply: "…맞는 말이라 짜증 난다. 내일 말하겠다",
          next: "what_i_could_do",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_could_do",
      intro: [
        "말했다. '나는 이거 못 해준다'고. 대신 할 수 있는 걸 세 개 적어줬다",
        "어디 가면 되는지, 누구한테 물어보면 되는지, 그리고 밥은 여기서 먹어도 된다는 거",
        "그 사람이 세 번째 줄 보고 또 울더라. 밥 얘기에 왜 우냐",
        "…어른이 된다는 건 하기 싫은 걸 하는 게 아니라, 하기 싫다고 말할 수 있게 되는 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 번째 줄이 제일 큰 거였어요",
          reply: "…밥이 제일 크다는 건 나도 안다. 내가 그렇게 살아왔으니까",
          next: "the_ugly_thing",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "못 한다고 말하면서 세 개를 적어준 게 실력이에요",
          reply: "…실력이라. 그런 말 들을 줄은 몰랐다. 나쁘지 않네",
          next: "the_ugly_thing",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 사람 또 올 거예요. 그때도 밥 줄 거예요?",
          reply: "…주지 뭐. 된장국은 좀 덜 짜게 하겠다",
          next: "the_ugly_thing",
          effect: { mental: 6, skills: { comedy: 20, sociability: 15 } },
        },
      ],
    },
    {
      id: "the_ugly_thing",
      intro: [
        "남 걱정할 처지 아닌 놈이 남 걱정하는 게 제일 꼴사납다. 근데 오늘도 했다",
        "집세 세 달 밀린 놈이 남한테 밥을 먹인다. 이게 무슨 계산이냐",
        "근데 정의 같은 거 모르고, 눈앞에서 누가 울면 몸이 먼저 움직이더라",
        "…이건 고쳐지는 종류가 아닌 것 같다. 포기했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고칠 필요 없어요. 그게 간판값이에요",
          reply: "…간판값. 그럼 밀린 간판 값은 그걸로 퉁친 걸로 하자",
          next: null,
          effect: { mental: 15, followers: 220, skills: { sociability: 35, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "꼴사납다면서 매번 하는 건 그게 본업이라서예요",
          reply: "…본업이 심부름인데. …아 그러네. 심부름 맞네. 정리됐다",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그러다 진짜 굶어요. 본인 걱정도 좀 하세요",
          reply: "…걱정한다. 하루에 한 번. 파르페 먹을 때. 그때만 한다",
          next: null,
          effect: { mental: -3, followers: 250, skills: { comedy: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 만능 심부름집 사장 3회차 — 지킬 게 있는 놈.
 * 축은 **"지킬 게 없는 놈이 제일 강하다는데, 틀렸다"**이다.
 * ⚠️ 그를 부자로 만들지 마라. 집세는 끝까지 밀려 있다.
 */
const BOSS_STORY_3: DmStory = {
  id: "boss_3",
  partnerName: "만능 심부름집 사장",
  partnerHandle: "deadeyes_boss",
  arrivalTitle: "만능 심부름집 사장의 DM",
  startNode: "the_dangerous_one",
  nodes: [
    {
      id: "the_dangerous_one",
      intro: [
        "위험한 의뢰가 들어왔다. 안 받는다고 써놨는데도 들어왔다",
        "돈은 세 달치 집세가 나온다. 딱 그만큼이다. 계산 잘하는 놈들이야",
        "우리 집 애들한테는 말 안 했다. 말하면 따라오겠다고 할 게 뻔해서",
        "…이런 건 원래 고민도 안 했는데 요즘은 고민이 된다. 늙었나",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고민되는 건 지킬 게 생겼다는 뜻이에요",
          reply: "…지킬 거라. 집세 낼 돈도 없는 놈한테 지킬 게 있다니 웃기는 얘기다",
          next: "what_i_took",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "말 안 한 것부터가 답이에요. 이미 안 갈 생각인 거잖아요",
          reply: "…아니다. 말하면 시끄러워서 안 한 거다. …반은 맞다. 하루 생각하자",
          next: "what_i_took",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "세 달치 집세에 목숨 걸 거예요?",
          reply: "…그렇게 물으면 할 말이 없지. 내일 답하겠다",
          next: "what_i_took",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_took",
      intro: [
        "갔다. 근데 위험한 부분은 안 했다. 그 앞까지만 하고 나머지는 넘겼다",
        "의뢰인이 반만 줬다. 반이면 한 달 반치다. 그거면 됐다",
        "예전 같으면 끝까지 했을 거다. 돈도 다 받았을 거고",
        "…근데 돌아와서 가게 불이 켜져 있는 걸 보니까 반만 받길 잘했다 싶더라",
      ],
      choices: [
        {
          tone: "friendly",
          me: "불 켜놓고 기다린 사람들이 있으니까요",
          reply: "…기다린 게 아니라 전기세를 안 아낀 거다. 그놈들이. …뭐, 그렇다고 해두자",
          next: "who_is_strong",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "반만 받은 게 계산이 제일 잘 된 거예요",
          reply: "…계산이라. 나 계산 못 하는데. 오늘은 잘한 걸로 하자",
          next: "who_is_strong",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "예전이랑 달라진 걸 인정하기 싫은 거죠",
          reply: "…달라졌지. 늙은 게 아니라 달라진 거라고 해주면 고맙겠다",
          next: "who_is_strong",
          effect: { mental: -3, skills: { knowledge: 35, comedy: 10 } },
        },
      ],
    },
    {
      id: "who_is_strong",
      intro: [
        "지킬 게 없는 놈이 제일 강하다는 말이 있다. 그거 틀렸다",
        "지킬 게 있는 놈이 제일 안 물러난다. 이건 겪어봐서 안다",
        "물러날 데가 없는 거랑 물러나기 싫은 건 다르거든. 후자가 훨씬 세다",
        "…집세는 아직 한 달 반 밀렸다. 그건 안 변했고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "한 달 반이면 절반은 갚은 거잖아요",
          reply: "…절반. 그렇게 세니까 내가 꽤 성실한 놈 같네. 계속 그렇게 세자",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 320,
            skills: { sociability: 35, comedy: 15 },
          },
        },
        {
          tone: "cool",
          me: "물러나기 싫은 쪽이 세다는 건 본인 얘기네요",
          reply: "…내 얘기지. 남 얘기 할 처지가 아니라는 건 아까 말했잖냐",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그럼 이제 집세부터 갚으세요. 그것도 지키는 거예요",
          reply: "…파르페를 줄이라는 소리로 들리는데. …반만 줄이겠다. 반만",
          next: null,
          effect: {
            mental: 12,
            followers: 350,
            skills: { comedy: 30, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 가발 아니다 — 수배 중이지만 무해한 지사(`data/accounts.ts` not_a_wig).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"싸움에서 이기는 것보다 이유를 잊지 않는 게 어렵다"**이다.
 * 그는 대의를 말하지만 실제로 하는 일은 밥과 사람 사이의 잡일이다.
 *
 * ⚠️ 말투는 **격식 있는 존댓말 + 자기 진지함이 만드는 웃김**이다. 개그를 노려서 쓰지 말고,
 *    **진지한 문장을 진지하게 쓰되 소재가 사소하게** 만들어라(저녁 메뉴, 수배 전단 그림).
 * ⚠️ 실제 정치·정당·국가를 지칭하지 마라. "나라"·"상층부"·"동지"까지만 쓴다.
 * ⚠️ 폭력을 선동하는 문장을 쓰지 마라 — 본인이 "폭력은 최후의 수단"이라고 못 박아뒀다.
 * ⚠️ 옛 친구(은발 녀석 = deadeyes_boss)는 **"그 은발 녀석"**으로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 가발 아니다 → 2회차 여럿이 밥 먹는 일 → 3회차 그 은발 녀석.
 */
export const WIG_STORY: DmStory = {
  id: "wig_1",
  partnerName: "가발 아니다",
  partnerHandle: "not_a_wig",
  arrivalTitle: "가발 아니다의 DM",
  startNode: "not_a_wig_intro",
  nodes: [
    {
      id: "not_a_wig_intro",
      intro: [
        "제 글을 퍼가주셨군요. 감사합니다. 먼저 밝혀둘 것이 있습니다.",
        "가발이 아닙니다. 이건 제 머리입니다. 이 점을 확실히 하고 시작하겠습니다.",
        "그리고 저는 테러리스트가 아닙니다. 지사입니다. 이 차이가 중요합니다.",
        "…이 두 가지를 매번 설명해야 한다는 게 제 활동의 8할입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "알겠어요. 본인 머리, 지사. 접수했습니다",
          reply: "…이렇게 한 번에 받아들여진 건 3년 만입니다. 감격스럽군요.",
          next: "the_agenda",
          effect: { mental: 5, skills: { sociability: 15, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "8할이 설명이면 나머지 2할이 활동이네요",
          reply: "…계산이 잔인하십니다. 정확해서 반박은 못 하겠습니다만.",
          next: "the_agenda",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "그렇게 강조하니까 더 가발 같은데요",
          reply: "…이런 반응이 제일 곤란합니다. 잡아당겨 보여드릴 수도 없고요.",
          next: "the_agenda",
          effect: { mental: -2, skills: { comedy: 25 } },
        },
      ],
    },
    {
      id: "the_agenda",
      intro: [
        "오늘 회의 안건은 두 개였습니다. 1. 나라의 미래 2. 저녁 메뉴.",
        "2번이 훨씬 길게 논의됐습니다. 한 시간 사십 분이었습니다.",
        "처음엔 한심하다고 생각했습니다. 지금은 생각이 좀 다릅니다.",
        "…혼자 옳은 것보다 여럿이 밥 먹는 게 훨씬 어려운 일이더군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저녁 메뉴 정하는 게 조직 운영이에요",
          reply: "…그렇게 정리해주시니 한 시간 사십 분이 아깝지 않아집니다.",
          next: "the_reason",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "1번은 결론이 안 나고 2번은 나니까 그런 거죠",
          reply: "…아. 그래서였군요. 결론이 나는 쪽에 다들 매달린 겁니다. 하루 생각해보겠습니다.",
          next: "the_reason",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "1번 안건에 결론을 못 내는 조직이면 그게 문제인데요",
          reply: "…아픈 지적입니다. 하룻밤 생각하고 답하겠습니다.",
          next: "the_reason",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_reason",
      intro: [
        "생각해봤습니다. 저희가 1번에 결론을 못 내는 건 이유를 자꾸 잊어서입니다.",
        "싸움에서 이기는 것보다 이유를 잊지 않는 게 어렵습니다. 이건 제 지론입니다.",
        "그래서 회의 첫머리에 각자 왜 여기 있는지 한 문장씩 말하기로 했습니다.",
        "…오늘 해봤더니 회의가 두 시간 반이 됐습니다. 개선인지 악화인지 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "개선이에요. 시간은 좀 걸려도요",
          reply: "…그럼 개선으로 기록하겠습니다. 회의록에도 그렇게 적겠습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "한 문장씩 말하게 한 건 이탈을 막는 장치예요",
          reply: "…장치라는 말은 안 썼는데 그렇게 되는군요. 잘 봐주셨습니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "이유를 잊은 게 아니라 원래 각자 달랐던 거 아니에요?",
          reply: "…그럴지도 모릅니다. 그건 좀 무서운 가정이라 오늘은 여기까지 하겠습니다.",
          next: null,
          effect: { mental: -6, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 가발 아니다 2회차 — 여럿이 밥 먹기.
 * 축은 **'신념보다 어려운 살림'**이다. 급여는 없고 신념은 넉넉한 조직의 현실.
 */
const WIG_STORY_2: DmStory = {
  id: "wig_2",
  partnerName: "가발 아니다",
  partnerHandle: "not_a_wig",
  arrivalTitle: "가발 아니다의 DM",
  startNode: "no_pay",
  nodes: [
    {
      id: "no_pay",
      intro: [
        "동지 모집은 계속됩니다. 급여는 없고 신념은 넉넉합니다.",
        "그런데 이번 달에 두 명이 나갔습니다. 신념이 부족해서가 아닙니다.",
        "한 명은 어머니가 편찮으시고 한 명은 월세가 밀렸습니다. 둘 다 제 탓입니다.",
        "…신념이란 배가 고파도 안 바뀐다고 썼는데, 그건 제가 배가 덜 고팠던 모양입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "나간 게 아니라 잠깐 쉬는 걸로 두세요",
          reply: "…돌아올 자리를 남겨두라는 말씀이군요. 그건 제가 할 수 있습니다.",
          next: "the_market",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "급여 없는 조직이면 나가는 게 정상이에요. 탓하지 마세요",
          reply: "…정상이라. 저는 그걸 배신으로 셀 뻔했습니다. 하루 생각하겠습니다.",
          next: "the_market",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "신념으로 밥을 못 먹인다는 걸 알면서 모집한 거잖아요",
          reply: "…그건 제 잘못이 맞습니다. 하룻밤 생각하고 답하겠습니다.",
          next: "the_market",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_market",
      intro: [
        "오늘 시장에서 만난 할머니가 저에게 사과를 주셨습니다. 제 얼굴을 알아보시고도요.",
        "'젊은 사람이 밥은 먹고 다니냐'고 하시더군요. 수배범한테 하실 말씀은 아닌데요.",
        "그 사과를 나눠서 동지들과 먹었습니다. 여섯 조각이 나왔습니다.",
        "…이런 게 나라입니다. 저는 이런 걸 지키자고 하는 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 1번 안건의 답이네요",
          reply: "…아. 그렇군요. 다음 회의 첫머리에 이 얘기를 하겠습니다.",
          next: "the_pay",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "할머니가 알아보고도 주신 게 핵심이에요",
          reply: "…알아보고도. 네. 수배 전단의 제 그림이 못생겨서 못 알아보신 건 아닙니다.",
          next: "the_pay",
          effect: { skills: { knowledge: 35, comedy: 10 } },
        },
        {
          tone: "bold",
          me: "사과 하나로 여섯 명 먹였으면 살림이 심각한데요",
          reply: "…심각합니다. 부정하지 않겠습니다. 그래서 오늘 결정을 하나 했습니다.",
          next: "the_pay",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_pay",
      intro: [
        "결정했습니다. 활동을 주 사흘로 줄이겠습니다. 나머지 나흘은 다들 일하십시오.",
        "동지들이 반대했습니다. 신념이 흐려진다고요. 저는 이렇게 답했습니다.",
        "'굶어 죽은 지사는 아무것도 못 지킵니다.' 이건 회의록에 그대로 적었습니다.",
        "…나간 두 명한테도 연락했습니다. 사흘이면 올 수 있냐고요. 한 명이 온다고 했습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "한 명이 돌아온 게 오늘 제일 큰 성과예요",
          reply: "…성과입니다. 제 활동 8할이 설명인데, 오늘은 설명이 통했습니다.",
          next: null,
          effect: { mental: 15, followers: 220, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "주 사흘로 줄인 게 조직을 살린 거예요",
          reply: "…살렸다고 해주시니 안심이 됩니다. 저는 후퇴라고 적을 뻔했습니다.",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "회의록에 적은 건 나중에 본인을 묶을 텐데요",
          reply: "…묶이라고 적었습니다. 저부터 굶으면 안 되니까요.",
          next: null,
          effect: { mental: 8, followers: 250, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 가발 아니다 3회차 — 그 은발 녀석.
 * 축은 **'길에서 서로 못 본 척한 옛 친구'**다.
 * ⚠️ 재회시키지 마라. 결말은 만나는 게 아니라 **못 본 척을 그만두는 것**까지다.
 */
const WIG_STORY_3: DmStory = {
  id: "wig_3",
  partnerName: "가발 아니다",
  partnerHandle: "not_a_wig",
  arrivalTitle: "가발 아니다의 DM",
  startNode: "the_old_friend_wig",
  nodes: [
    {
      id: "the_old_friend_wig",
      intro: [
        "옛 친구를 길에서 봤습니다. 그 은발 녀석입니다.",
        "그는 못 본 척했습니다. 저도 못 본 척했습니다. 서로 아주 능숙했습니다.",
        "예전에는 같은 것을 옳다고 했습니다. 지금은 저만 이러고 있습니다.",
        "…가끔 그립습니다. 물론 만나면 또 싸우겠지만요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "싸울 걸 알면서 그리운 게 친구죠",
          reply: "…그렇게 정의해주시니 제 감정에 이름이 붙는군요. 하루 생각해보겠습니다.",
          next: "why_he_stopped",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "둘 다 못 본 척했으면 둘 다 본 거잖아요",
          reply: "…아. 그렇습니다. 봤으니까 못 본 척을 한 거죠. 하룻밤 두겠습니다.",
          next: "why_he_stopped",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 사람은 왜 그만뒀는지 물어본 적 있어요?",
          reply: "…없습니다. 물어보면 제가 흔들릴까 봐서요. 내일 답하겠습니다.",
          next: "why_he_stopped",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "why_he_stopped",
      intro: [
        "생각해봤습니다. 그 녀석이 그만둔 게 아니라 방법을 바꾼 것일 수도 있겠더군요.",
        "저는 나라를 걱정하고 그는 눈앞의 사람을 걱정합니다. 크기만 다릅니다.",
        "…제가 이걸 인정하는 데 몇 년이 걸렸습니다. 인정하고 나니 좀 허탈합니다.",
        "그럼 저희는 왜 싸운 겁니까. 그게 오늘의 질문입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "크기가 다르면 방법도 달라져요. 그게 다예요",
          reply: "…그게 다였군요. 저는 그걸 배신이라고 불렀습니다. 오래 틀렸습니다.",
          next: "the_udon",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "둘 다 옳으면 싸울 이유가 없죠. 그래서 더 싸운 거고요",
          reply: "…둘 다 옳아서 싸웠다. 그건 제일 나쁜 종류의 싸움이군요.",
          next: "the_udon",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "싸운 이유를 잊었으면 그게 본인이 제일 싫어하는 거잖아요",
          reply: "…제 지론에 제가 걸렸습니다. 반박할 말이 없습니다.",
          next: "the_udon",
          effect: { mental: -6, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_udon",
      intro: [
        "우동집 아저씨가 제 얼굴을 알아보고도 그냥 곱빼기를 주셨습니다. 예전에 그런 적이 있습니다.",
        "그 얘기를 하려고 오늘 그 은발 녀석 가게 앞을 지나갔습니다. 들어가진 않았습니다.",
        "대신 문 앞에 사과를 하나 놓고 왔습니다. 시장 할머니가 주신 그 사과 종류로요.",
        "…다음에 마주치면 못 본 척은 안 하겠습니다. 인사까지는 아직 모르겠습니다만.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "사과 하나면 충분해요. 그쪽도 알 거예요",
          reply: "…알아채면 다행이고, 그냥 먹어도 상관없습니다. 어차피 먹는 게 목적이니까요.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "못 본 척을 그만둔 게 화해의 시작이에요",
          reply: "…시작입니다. 끝은 아직 멉니다. 저희 둘 다 고집이 세거든요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "들어가서 말하지 그랬어요. 사과는 말을 못 해요",
          reply: "…맞습니다. 그런데 오늘은 거기까지가 제 최대치였습니다. 다음엔 들어가겠습니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { sociability: 30, knowledge: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 마요네즈 부장 — 규칙은 규칙, 마요네즈는 예외인 순찰대 부장(`data/accounts.ts` mayo_vice).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"규칙이 사람을 지키는 거다"**이다. 승리의 주장·근성 부대장과 겹치지 않게 하라 —
 * 주장은 **예외를 만드는 법**, 근성은 **남는 것**, 이쪽은 **자기도 규칙에 걸린다**는 점이다.
 *
 * ⚠️ 말투는 **짧은 반말 단정형**이다. 웃지 않는다. 유머는 **마요네즈 소재에서만** 나오고,
 *    본인은 그게 웃긴 줄 모른다. 그 온도차가 이 캐릭터의 개그다.
 * ⚠️ 그를 부드럽게 만들지 마라. 3회차에서도 그는 처벌한다 — 자기 자신을 포함해서.
 * ⚠️ 1번대 후배(sadist_captain)는 "그 1번대 놈"으로만 부른다.
 * 줄기: 1회차 규칙 제1조 → 2회차 먼저 뛰어든 신입 → 3회차 자기가 규칙을 어긴 날.
 */
export const MAYO_STORY: DmStory = {
  id: "mayo_1",
  partnerName: "마요네즈 부장",
  partnerHandle: "mayo_vice",
  arrivalTitle: "마요네즈 부장의 DM",
  startNode: "rule_one",
  nodes: [
    {
      id: "rule_one",
      intro: [
        "내 글을 퍼갔더군. 순찰 중이라 짧게 쓴다",
        "부대 규칙 제1조는 규칙을 지킬 것이다. 이게 왜 어렵냐",
        "융통성이 없다는 소리를 듣는다. 융통성 있는 조직이 사람 죽인다",
        "…오늘 부하 한 놈이 규칙을 어겼다. 어긴 이유가 사람을 구하려던 거다. 이게 문제다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "구했으면 된 거 아니에요?",
          reply: "…구했다. 그리고 어겼다. 둘 다 사실이다. 그래서 골치다",
          next: "the_punishment",
          effect: { skills: { sociability: 12, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "규칙이 사람을 못 지켰으면 규칙이 부족한 거죠",
          reply: "…규칙을 고치라는 말이군. 그건 내 권한 밖이다. 하지만 검토는 하겠다",
          next: "the_punishment",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "그럼 처벌하세요. 그게 규칙이잖아요",
          reply: "…한다. 당연히 한다. 그걸 물어본 게 아니다",
          next: "the_punishment",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_punishment",
      intro: [
        "처벌은 했다. 규정대로 근신 사흘이다",
        "그리고 처벌서에 한 줄 더 적었다. '판단은 옳았음.'",
        "이건 규정에 없는 줄이다. 그러니까 나도 규칙을 조금 어긴 셈이다",
        "…이렇게 쓰고 보니 내가 제일 융통성을 부린 놈이군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 한 줄이 처벌서를 다르게 만들어요",
          reply: "…다르게 만든다고 처벌이 줄지는 않는다. 그래도 적어둔다",
          next: "the_mayo",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그 줄이 다음 규칙의 근거가 될 거예요",
          reply: "…근거라. 그건 생각 못 했다. 하루 두고 보겠다",
          next: "the_mayo",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "본인이 어긴 건 처벌 안 해요?",
          reply: "…한다. 그건 다음에 얘기하자. 오늘은 순찰이 남았다",
          next: "the_mayo",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_mayo",
      intro: [
        "근신 사흘 끝나고 그놈이 왔다. 밥을 사겠다더라",
        "식당에서 내가 마요네즈를 밥에 뿌리니까 그놈이 얼굴이 굳더군",
        "밥이 마요네즈를 받아들이는 거다. 이게 왜 이상하냐",
        "…그놈이 웃었다. 근신 뒤에 웃는 건 나쁘지 않은 신호다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "일부러 뿌린 거죠?",
          reply: "…아니다. 나는 늘 뿌린다. 결과가 그렇게 된 것뿐이다",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "처벌하고 밥 먹는 게 이 조직이 안 무너지는 이유겠네요",
          reply: "…이 조직은 원래 오합지졸이었다. 지금도 그렇다. 근데 안 무너졌다",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "밥에 마요네즈는 진짜 이상해요",
          reply: "…한 통이 이틀치다. 그 정도면 정상 범위다. 더 얘기 안 하겠다",
          next: null,
          effect: { mental: -2, followers: 180, skills: { comedy: 25 } },
        },
      ],
    },
  ],
};

/**
 * 마요네즈 부장 2회차 — 먼저 뛰어든 신입.
 * 축은 **'혼내면서 속으로는 됐다고 생각하는 것'**이다.
 */
const MAYO_STORY_2: DmStory = {
  id: "mayo_2",
  partnerName: "마요네즈 부장",
  partnerHandle: "mayo_vice",
  arrivalTitle: "마요네즈 부장의 DM",
  startNode: "the_rookie_first",
  nodes: [
    {
      id: "the_rookie_first",
      intro: [
        "오늘 신입이 제일 먼저 뛰어들었다. 순서를 어긴 거다",
        "혼냈다. 소리도 질렀다. 그러고 나서 담배를 두 대 피웠다",
        "속으로는 됐다고 생각했다. 그건 안 말했다",
        "…부하들 앞에서 안 웃는 이유는 하나다. 웃으면 얕본다. 그게 전부다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "됐다고 생각한 걸 언젠가는 말해줘야 해요",
          reply: "…말하면 다음에도 뛰어든다. 그건 곤란하다. 하루 생각해보겠다",
          next: "what_i_said",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "혼낸 건 순서지 용기가 아니잖아요. 그건 구분해서 말해주세요",
          reply: "…구분해서. 그건 할 수 있다. 내일 해보겠다",
          next: "what_i_said",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "웃으면 얕본다는 건 본인이 자신 없다는 뜻인데요",
          reply: "…아프군. 하루 생각하고 답하겠다",
          next: "what_i_said",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_said",
      intro: [
        "불러서 말했다. '순서를 어긴 건 잘못이다. 뛰어든 건 잘못이 아니다.'",
        "그놈이 그럼 어떻게 하냐고 묻더라. 그래서 답했다",
        "'다음엔 뛰어들기 전에 내 이름을 불러라. 부르고 뛰어들어도 된다.'",
        "…이건 규칙에 없다. 내가 만든 거다. 오늘부터 규칙이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이름 부르고 뛰어들라는 게 제일 현실적인 규칙이에요",
          reply: "…현실적이라. 그럼 잘 만든 거다. 그렇게 세겠다",
          next: "who_gets_hurt",
          effect: { mental: 10, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "부르면 당신이 따라 들어간다는 뜻이잖아요",
          reply: "…그렇다. 그게 이 규칙의 핵심이다. 그놈은 아직 모른다",
          next: "who_gets_hurt",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "규칙을 늘리는 건 본인이 제일 싫어하던 거 아니에요?",
          reply: "…규칙이 부족하면 늘린다. 어기는 것과는 다르다. 그 구분은 확실하다",
          next: "who_gets_hurt",
          effect: { mental: -3, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "who_gets_hurt",
      intro: [
        "부하가 다치면 내 책임이다. 이건 논쟁의 여지가 없다",
        "그래서 잔소리가 많다. 밥 먹어라, 자라, 단추 잠가라. 매일 같은 말이다",
        "제복 단추 하나 안 잠근 놈이 목숨을 지킨다고? 못 믿는다",
        "…오늘 그 신입이 내 앞에서 단추를 다 잠그고 지나가더라. 보라고 하는 거지",
      ],
      choices: [
        {
          tone: "friendly",
          me: "보여주려고 한 거 맞아요. 봐준 티는 내셨어요?",
          reply: "…안 냈다. 고개만 한 번 끄덕였다. 그거면 안다",
          next: null,
          effect: { mental: 12, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "잔소리가 통했다는 증거네요",
          reply: "…통하는 데 반년 걸렸다. 잔소리는 원래 그렇다",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그거 보고 좀 웃었죠",
          reply: "…안 웃었다. …입꼬리는 모르겠다. 그건 내 소관이 아니다",
          next: null,
          effect: { mental: 8, followers: 220, skills: { comedy: 25, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 마요네즈 부장 3회차 — 내가 어긴 날.
 * 축은 **"규율을 어긴 놈은 처벌한다. 내가 어겨도 마찬가지다"**를 실제로 하는 것이다.
 * ⚠️ 그를 봐주지 마라. 자기 처벌은 실제로 집행된다. 다만 조직은 그를 자르지 않는다.
 */
const MAYO_STORY_3: DmStory = {
  id: "mayo_3",
  partnerName: "마요네즈 부장",
  partnerHandle: "mayo_vice",
  arrivalTitle: "마요네즈 부장의 DM",
  startNode: "i_broke_it",
  nodes: [
    {
      id: "i_broke_it",
      intro: [
        "어제 순찰 중에 길 잃은 애를 데려다줬다. 그건 보고서에 안 썼다",
        "그 시간에 순찰 구역을 벗어났다. 그것도 안 썼다",
        "규율을 어긴 놈은 처벌한다. 내가 어겨도 마찬가지다. 내가 그렇게 써놨다",
        "…그러니까 나는 지금 나를 처벌해야 한다. 이게 오늘의 문제다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "애를 데려다준 걸 처벌하는 조직이면 그게 이상한데요",
          reply: "…이상하다. 그래도 규칙이다. 하루 생각해보겠다",
          next: "the_report_mayo",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "안 쓴 게 문제예요. 썼으면 문제가 아니었고요",
          reply: "…정확하다. 어긴 건 이탈이 아니라 은폐다. 그건 더 무겁다",
          next: "the_report_mayo",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "안 쓴 이유가 자랑처럼 보일까 봐서죠",
          reply: "…그렇다. 창피한 이유다. 하룻밤 생각하고 답하겠다",
          next: "the_report_mayo",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_report_mayo",
      intro: [
        "보고서를 다시 썼다. 이탈 시간, 사유, 은폐 시도까지 전부 적었다",
        "그리고 내 처벌서를 내가 썼다. 근신 닷새다. 부하한테 준 것보다 이틀 길다",
        "위에서 반려했다. '부장이 근신하면 순찰은 누가 도느냐'고",
        "…그래서 근신 대신 야간 순찰 닷새를 추가로 돌기로 했다. 그건 통과됐다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "결국 본인만 손해네요",
          reply: "…부장이라는 자리는 미움받으라고 있는 자리다. 편하다고는 안 했다",
          next: "the_rule_holds",
          effect: { mental: 10, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "이틀 더 잡은 건 부하들 보라고 한 거죠",
          reply: "…보라고 한 거다. 규칙이 위로 갈수록 세진다는 걸 알아야 지킨다",
          next: "the_rule_holds",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "야간 순찰 닷새면 그게 더 편한 거 아니에요? 어차피 매일 도는데",
          reply: "…들켰군. 그건 나도 생각했다. 그래서 열흘로 늘렸다. 됐냐",
          next: "the_rule_holds",
          effect: { mental: -4, skills: { comedy: 20, knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_rule_holds",
      intro: [
        "야간 순찰 사흘째다. 밤 거리는 조용해서 좋다. 낮엔 시끄러워서 못 봐준다",
        "그 신입이 오늘 밤에 나왔다. 자기도 돌겠다고. 순번도 아닌데",
        "돌려보냈다. 규칙이니까. 그랬더니 다음 날 순번을 바꿔 오더라",
        "…규칙 안에서 방법을 찾은 거다. 그건 처벌할 수 없다. 그러라고 만든 규칙이니까",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 애가 규칙을 제대로 배운 거예요",
          reply: "…배웠다. 나보다 빨리 배웠다. 그건 인정한다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "규칙이 사람을 지킨다는 말, 오늘 증명됐네요",
          reply: "…증명이라. 그럼 이번 건은 손해가 아니다. 그렇게 정리하겠다",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "그날 밤 순찰, 둘이 도니까 안 심심했죠",
          reply: "…심심한 건 상관없다. …나쁘지 않았다는 건 인정하겠다. 그 이상은 안 쓴다",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { comedy: 20, sociability: 25, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 아하하 무역상 — 우주에서 장사하고 길을 헤매는 상인(`data/accounts.ts` ahaha_trader).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"웃고 있으면 다들 별생각 없는 줄 안다"**이다. 안대 쓴 선생(blindfold_sensei)과 갈라라 —
 * 그쪽은 **무거운 걸 전하려고** 웃고, 이쪽은 **자기가 안 보이려고** 웃는다.
 *
 * ⚠️ 말투는 **"아하하"가 섞인 반말**이다. 웃음을 회차마다 넣되, **속을 말하는 문장에는 안 넣는다.**
 *    그 한 문장만 웃음 없이 나오는 게 이 캐릭터의 신호다.
 * ⚠️ 그를 각성시키지 마라. 3회차에서도 그는 또 웃으며 떠난다.
 * ⚠️ 옛 동료는 "그 은발"·"머리 긴 친구"로만 부른다(계정 특정 금지, 그쪽 회차 진행 전제 금지).
 * 줄기: 1회차 길과 비서 → 2회차 무기 장사 안 한다는 원칙 → 3회차 못 전한 선물.
 */
export const TRADER_STORY: DmStory = {
  id: "trader_1",
  partnerName: "아하하 무역상",
  partnerHandle: "ahaha_trader",
  arrivalTitle: "아하하 무역상의 DM",
  startNode: "lost_again",
  nodes: [
    {
      id: "lost_again",
      intro: [
        "아하하! 좋아요 눌러줬네. 고맙다",
        "오늘도 착륙하자마자 길을 잃었다. 예정 지점이랑 300km 차이 났고",
        "길 물어보는 사람한테 되레 길을 물었다. 그 사람 표정이 볼만했지 아하하",
        "…그건 그렇고 우리 비서가 화났다. 이건 좀 심각하다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "화난 이유가 뭔데요",
          reply: "계약서를 거꾸로 들고 있었대. 나는 글씨가 작아서 그런 줄 알았지 아하하",
          next: "the_secretary",
          effect: { skills: { sociability: 12, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "300km면 착륙이 아니라 추락 아니에요?",
          reply: "…착륙이라고 부르기로 계약서에 써놨다. 그러니까 착륙이지 아하하",
          next: "the_secretary",
          effect: { skills: { knowledge: 20, comedy: 10 } },
        },
        {
          tone: "bold",
          me: "길 못 찾는 사장이 우주 무역을 어떻게 해요",
          reply: "…아하하. 그건 나도 가끔 궁금하다. 답은 비서가 알고 있고",
          next: "the_secretary",
          effect: { mental: -2, skills: { comedy: 20 } },
        },
      ],
    },
    {
      id: "the_secretary",
      intro: [
        "비서가 없으면 나는 이틀 안에 굶어 죽는다. 진지하게 하는 말이다",
        "오늘 계약 세 건 땄는데 두 건은 사실 비서가 땄다. 이것도 진지한 얘기고",
        "근데 그 친구가 요즘 야근 수당을 자기가 계산해서 챙기더라. 아무도 안 챙겨주니까",
        "…이건 내가 잘못한 거지. 어떻게 하면 되냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "직접 챙겨주세요. 계산해서 주는 게 아니라 먼저요",
          reply: "…먼저 주는 거라. 그런 건 생각을 못 했다. 하루 궁리해보겠다",
          next: "what_i_gave",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "직급부터 제대로 불러주세요. 비서가 아니라 임원이잖아요",
          reply: "…어. 그건 맞다. 내가 계속 비서라고 불렀네. 하루 생각해보겠다",
          next: "what_i_gave",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "이틀 안에 굶어 죽는 사장이 할 말은 아닌데요",
          reply: "…아하하. 정확하다. 그래서 더 미안한 거고. 내일 답하겠다",
          next: "what_i_gave",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "what_i_gave",
      intro: [
        "수당을 먼저 계산해서 봉투에 넣어뒀다. 이자까지 쳐서",
        "그리고 회의에서 처음으로 직급을 불렀다. 비서 말고 정식 직함으로",
        "그 친구가 안경을 세 번 고쳐 쓰더라. 그게 당황했다는 뜻인 건 나도 안다",
        "…10년 걸렸다. 이건 웃으면서 쓸 얘기가 아니군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "10년 만이어도 한 건 한 거예요",
          reply: "…그렇게 말해주니 낫다. 다음엔 9년 안에 하겠다. 아하하",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "안경 세 번 고쳐 쓴 거, 그거 기뻐서 그런 거예요",
          reply: "…그런 거였나. 나는 계산 착오인 줄 알고 봉투를 다시 셌는데",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "웃음 없이 쓴 문장이 그거 하나네요. 티 나요",
          reply: "…들켰군. 그건 다음에 얘기하자. 다음이 있으면 말이지 아하하",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 30 } },
        },
      ],
    },
  ],
};

/**
 * 아하하 무역상 2회차 — 안 하는 장사.
 * 축은 **"무기 장사는 안 한다. 아무도 안 믿지만"**이다.
 * ⚠️ 그의 과거를 설명하지 마라("옛날엔 칼 들고 뛰어다녔다"까지만 쓴다).
 */
const TRADER_STORY_2: DmStory = {
  id: "trader_2",
  partnerName: "아하하 무역상",
  partnerHandle: "ahaha_trader",
  arrivalTitle: "아하하 무역상의 DM",
  startNode: "the_offer_trader",
  nodes: [
    {
      id: "the_offer_trader",
      intro: [
        "큰 건이 하나 들어왔다. 우주선 수리비 3년치가 한 번에 나오는 규모다",
        "무기 장사다. 나는 그건 안 한다. 이건 내 원칙이고 아무도 안 믿는다",
        "거절하면 우리 회사는 이번 분기도 적자다. 직원들 수당이 밀린다",
        "…아하하. 이런 걸 물어볼 데가 없어서 여기다 쓴다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "거절하세요. 원칙이 있어서 여기까지 온 거잖아요",
          reply: "…거절하면 적자는 내가 메워야 하는데. 하루 생각해보겠다",
          next: "what_i_refused",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "아무도 안 믿는 원칙이면 지켜도 아무도 모르는데요",
          reply: "…내가 알지. 그거 하나로 15년 버텼다. 하루 정리하고 답하겠다",
          next: "what_i_refused",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "직원들 수당이랑 원칙 중에 뭐가 먼저예요?",
          reply: "…그렇게 물으면 곤란한데. 하룻밤만 주라",
          next: "what_i_refused",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_refused",
      intro: [
        "거절했다. 대신 그 자리에서 다른 걸 팔았다. 우주선 항로 데이터를",
        "우리가 15년 헤매면서 만든 지도다. 남들이 보기엔 실패 기록이고",
        "그게 무기값의 4할에 팔렸다. 4할이면 적자는 면한다",
        "…길을 못 찾는 사장이라 만들어진 지도다. 이건 좀 웃기는군 아하하",
      ],
      choices: [
        {
          tone: "friendly",
          me: "헤맨 15년이 재산이 됐네요",
          reply: "…그렇게 되나. 그럼 나는 앞으로도 계속 헤매도 되는 거군 아하하",
          next: "who_believes",
          effect: { mental: 12, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "실패 기록이 제일 비싼 데이터예요. 다들 성공만 적으니까",
          reply: "…그 말은 비서한테 그대로 전하겠다. 그 친구가 좋아할 문장이다",
          next: "who_believes",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "4할이면 6할은 손해예요. 원칙값이 비싸네요",
          reply: "…비싸지. 원래 원칙은 비싼 거다. 싸면 다들 지키게",
          next: "who_believes",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "who_believes",
      intro: [
        "비서가 거래 명세를 보더니 처음으로 물었다. '왜 무기는 안 하십니까'",
        "10년 만에 처음 물어본 거다. 그동안은 그냥 그런 사람인 줄 알았대",
        "그래서 답했다. '옛날에 칼 들고 뛰어다녔는데, 그때 판 게 아니라 쓴 쪽이라서.'",
        "…그 이상은 안 말했다. 그 친구도 더 안 물었고. 좋은 직원이야",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 묻는 것도 실력이에요",
          reply: "…실력이지. 그 친구는 그런 게 늘 좋았다",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "10년 만에 물었다는 건 이제 믿는다는 뜻이에요",
          reply: "…믿는 거였나 그게. 나는 궁금해진 줄로만 알았다",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 대답에도 아하하가 없네요",
          reply: "…또 들켰군. 너 장사하면 잘하겠다. 진심이다",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 40, comedy: 15 } },
        },
      ],
    },
  ],
};

/**
 * 아하하 무역상 3회차 — 못 전한 선물.
 * 축은 **"선물 사 왔는데 받을 사람이 안 나온다"**이다.
 * ⚠️ 재회를 성사시키지 마라. 결말은 선물을 **놓고 오는 것**까지다.
 */
const TRADER_STORY_3: DmStory = {
  id: "trader_3",
  partnerName: "아하하 무역상",
  partnerHandle: "ahaha_trader",
  arrivalTitle: "아하하 무역상의 DM",
  startNode: "the_gifts",
  nodes: [
    {
      id: "the_gifts",
      intro: [
        "선물을 세 개 사 왔다. 옛 동료들 주려고. 매번 사 오는데 매번 못 준다",
        "연락처를 잃어버렸다. 아니, 정확히는 잃어버린 걸로 하고 있는 거지",
        "그 은발은 아직도 단 것만 먹고 산다더라. 머리 긴 친구는 아직도 나라 걱정을 하고",
        "…다들 여전하다는 게 반갑기도 하고 무섭기도 하다. 이건 웃으면서 쓸 얘기가 아니군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무서운 건 뭔데요?",
          reply: "…내가 안 변한 게 들킬까 봐서. 저쪽은 자리를 잡았는데 나는 아직 떠돌잖냐",
          next: "the_delivery",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "연락처를 잃어버린 걸로 하고 있는 거잖아요",
          reply: "…들켰네. 그것도 오늘 두 번째다. 하루 생각하고 답하겠다",
          next: "the_delivery",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "선물은 핑계고 그냥 보고 싶은 거죠",
          reply: "…아하하. …하루만 시간 줘라. 이건 웃음으로 못 넘기겠다",
          next: "the_delivery",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_delivery",
      intro: [
        "선물 세 개를 다 배달시켰다. 내 이름은 안 적었다",
        "그 은발한테는 설탕 한 상자, 머리 긴 친구한테는 사과 한 궤짝, 나머지 하나는 그냥 뒀다",
        "받았는지는 모른다. 확인 안 했다. 확인하면 답장이 올 수도 있잖냐",
        "…답장이 오면 만나야 되는데, 나는 다음 주에 또 떠난다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "떠나도 다시 오잖아요. 그때 만나면 돼요",
          reply: "…다시 오지. 15년째 다시 오고 있고. 그건 그렇네",
          next: "next_voyage",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "이름 안 적은 건 받아도 부담 주기 싫어서죠",
          reply: "…그런 셈이다. 근데 그 둘은 누가 보냈는지 바로 알 거다. 그건 확실하다",
          next: "next_voyage",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그럼 남은 하나는 누구 겁니까",
          reply: "…그건 못 준다. 받을 사람이 없어졌거든. 이 얘긴 여기까지다",
          next: "next_voyage",
          effect: { mental: -8, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "next_voyage",
      intro: [
        "다음 주에 떠난다. 항로는 비서가 짰다. 이번엔 안 헤맬 거다. 아마도",
        "옛날 얘기 하자는 사람이 많은데, 나는 옛날보다 다음 항해가 더 재밌다",
        "우주는 넓어서 좋다. 도망칠 데가 많거든. 이건 농담 반이다",
        "…그래도 돌아올 데가 여기라는 건 안 변했다. 그거면 됐지 아하하",
      ],
      choices: [
        {
          tone: "friendly",
          me: "돌아올 데가 있으면 그건 도망이 아니에요",
          reply: "…아하하. 그럼 나는 15년 동안 도망 안 친 거네. 계산이 좋다",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 320,
            skills: { sociability: 35, comedy: 15 },
          },
        },
        {
          tone: "cool",
          me: "다음 항해가 재밌다는 건 옛날을 안 놓쳤다는 뜻이에요",
          reply: "…그런가. 나는 놓친 줄 알았는데. 오늘 계산이 두 번 맞았다",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "다음엔 이름 적고 보내세요. 그게 진짜 선물이에요",
          reply: "…다음엔. 적겠다. 적어보겠다. 이건 약속으로 치자 아하하",
          next: null,
          effect: {
            mental: 12,
            followers: 350,
            skills: { sociability: 30, knowledge: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 안경이 본체 — 해결사 사무소 유일한 상식인(`data/accounts.ts` glasses_tsukkomi).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"진짜 상식인이라면 이런 데서 2년씩 버티지 않는다"**이다.
 * 그는 자기도 고장 났다는 걸 인정했고, 인정하고 나니 편해졌다.
 *
 * ⚠️ 말투는 **격앙된 존댓말 츳코미**다("~습니다", "왜 아무도 안 말립니까"). 물음표를 자주 쓴다.
 * ⚠️ 그를 사무소에서 나가게 하지 마라. 매 회차 나갈 이유가 생기고 매번 남는다.
 * ⚠️ 사장은 "사장님", 대식가는 "그 애", 개는 "그 개"로만 부른다(계정 특정 금지).
 * 줄기: 1회차 아홉 글자 편지 → 2회차 이름을 안 불러주는 것 → 3회차 이 일상이 없어지면.
 */
export const GLASSES_STORY: DmStory = {
  id: "glasses_1",
  partnerName: "안경이 본체",
  partnerHandle: "glasses_tsukkomi",
  arrivalTitle: "안경이 본체의 DM",
  startNode: "nine_letters",
  nodes: [
    {
      id: "nine_letters",
      intro: [
        "제 글을 퍼가주셨군요! 감사합니다. 이 계정 반응이 오는 게 얼마 만인지",
        "월급날에 봉투를 받았는데 안에 편지만 들어 있었습니다.",
        "'미안하다 다음 달에' 딱 아홉 글자요. 이게 월급입니까 편지입니까",
        "…근데 글씨가 삐뚤빼뚤한 게 오래 붙잡고 쓰신 것 같아서 화도 제대로 못 냈습니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "화내도 돼요. 그건 별개예요",
          reply: "…별개죠. 별개인데 왜 안 나올까요. 이래서 제가 못 그만두는 겁니다",
          next: "the_two_years",
          effect: { skills: { sociability: 15, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "아홉 글자 쓰는 데 오래 걸렸으면 그건 미안한 게 맞고요",
          reply: "…맞습니다. 맞는데 그게 월급을 대신하지는 않잖습니까! 안 그렇습니까!",
          next: "the_two_years",
          effect: { skills: { knowledge: 25, comedy: 15 } },
        },
        {
          tone: "bold",
          me: "두 달째면 노동청에 가야죠",
          reply: "…가려고 봉투 챙겼습니다. 그날 사무실 벽이 뚫려서 못 갔고요. 진짜입니다",
          next: "the_two_years",
          effect: { mental: -3, skills: { comedy: 25 } },
        },
      ],
    },
    {
      id: "the_two_years",
      intro: [
        "다들 저를 상식인이라고 부르십니다. 근데 진짜 상식인이면 여기서 2년을 버팁니까",
        "설거지, 청소, 장부 정리, 사과 편지 대필까지 제 일입니다. 해결사 업무는요?",
        "일당 대신 계란 한 판을 받은 적도 있습니다. 계란 한 판이요",
        "…그러니까 저도 어딘가 확실히 고장 난 게 맞습니다. 이거 인정하는 데 2년 걸렸습니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "인정하고 나니까 좀 편해졌죠?",
          reply: "…편해졌습니다. 그게 제일 무섭습니다. 하루 생각해보겠습니다",
          next: "the_reason_i_stay",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "고장 난 게 아니라 여기가 맞는 거예요",
          reply: "…맞는 거라뇨. 벽 뚫린 사무실이 저한테 맞으면 그게 더 문제 아닙니까",
          next: "the_reason_i_stay",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "2년을 버틴 게 아니라 2년을 고른 거예요",
          reply: "…고른 거라고요. 그건 좀. …하룻밤 생각해보겠습니다",
          next: "the_reason_i_stay",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_reason_i_stay",
      intro: [
        "생각해봤습니다. 화가 나서 나가겠다고 한 적이 있습니다. 작년에요",
        "그때 사장님이 뭐라고 하셨는지 아세요. '저녁은 먹고 가.'",
        "그래서 저녁을 먹었고, 먹고 나니까 화가 반쯤 풀렸고, 그래서 아직 있습니다",
        "…이게 붙잡은 겁니까 아닙니까. 2년째 판정을 못 내리고 있습니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "붙잡은 거 맞아요. 그 사람 방식으로요",
          reply: "…방식이라. 그럼 저는 밥 한 끼에 넘어간 겁니다. 싸게 굴었네요",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "판정을 안 내리는 게 답이에요. 내리면 나가야 하니까",
          reply: "…아. 제가 일부러 안 내리고 있었던 겁니까. 이거 좀 충격인데요",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "저녁 먹고 가라는 말에 넘어갈 사람이면 월급은 영영 안 나와요",
          reply: "…그것도 압니다. 아는데도 저녁이 맛있었단 말입니다. 이게 제 인생입니다",
          next: null,
          effect: { mental: -3, followers: 200, skills: { comedy: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 안경이 본체 2회차 — 제 이름은요.
 * 축은 **"제 이름을 제대로 불러주는 사람이 사무소에 한 명도 없습니다"**이다.
 * ⚠️ 극적으로 이름을 불러주게 하지 마라. 그가 얻는 건 이름이 아니라 **부르는 방식의 뜻**이다.
 */
const GLASSES_STORY_2: DmStory = {
  id: "glasses_2",
  partnerName: "안경이 본체",
  partnerHandle: "glasses_tsukkomi",
  arrivalTitle: "안경이 본체의 DM",
  startNode: "call_my_name",
  nodes: [
    {
      id: "call_my_name",
      intro: [
        "'안경'이라고 부르지 마십시오. 저는 안경이 아니라 사람입니다. 사람이라고요",
        "제 이름을 제대로 불러주는 사람이 사무소에 한 명도 없습니다. 한 명도요",
        "심지어 그 개도 제 이름에 반응 안 합니다. 밥그릇 소리에는 반응하면서요",
        "…이거 제가 예민한 겁니까? 객관적인 판단을 부탁드립니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 예민해요. 이름은 중요하죠",
          reply: "…그렇죠?! 그렇죠! 오늘 처음으로 제 편이 생겼습니다",
          next: "how_they_call",
          delayDays: 1,
          effect: { mental: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 사람들이 다른 사람 이름은 제대로 불러요?",
          reply: "…어. 생각해보니 아무도 이름으로 안 불립니다. 다들 별명입니다",
          next: "how_they_call",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "안경 벗으면 아무도 못 알아본다면서요. 그게 더 문제 아니에요?",
          reply: "…그 얘긴 왜 꺼내십니까. 하루 울고 내일 답하겠습니다",
          next: "how_they_call",
          delayDays: 1,
          effect: { mental: -5, skills: { comedy: 25 } },
        },
      ],
    },
    {
      id: "how_they_call",
      intro: [
        "세어봤습니다. 사무소에서 이름으로 불리는 사람은 아무도 없습니다",
        "사장님은 별명, 그 애는 별명, 개는 개, 저는 안경입니다",
        "그러니까 이건 저만 당하는 게 아니라 여기 규칙이었던 겁니다",
        "…근데 어제 사장님이 의뢰인한테 저를 소개할 때는 제 이름을 쓰셨습니다. 풀네임으로요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "밖에서는 이름을 쓰는 거네요. 그게 답이에요",
          reply: "…밖에서는요. 안에서는 안경이고요. …아 이게 뭐라고 눈물이 납니까",
          next: "the_glasses_off",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "안에서 별명인 건 식구라는 뜻이고요",
          reply: "…식구라는 말로 월급 밀린 게 정당화되지는 않습니다만. …절반은 인정하겠습니다",
          next: "the_glasses_off",
          effect: { skills: { knowledge: 40, comedy: 10 } },
        },
        {
          tone: "bold",
          me: "그럼 앞으로 사무소에서도 이름으로 불러달라고 하세요",
          reply: "…말해봤습니다. 다들 '어 알겠어 안경아' 하더군요. 이게 여깁니다",
          next: "the_glasses_off",
          effect: { mental: -3, skills: { comedy: 30 } },
        },
      ],
    },
    {
      id: "the_glasses_off",
      intro: [
        "제가 안경만 벗으면 아무도 저를 못 알아봅니다. 그게 제일 서럽습니다",
        "그런데 어제 그 애가 제 안경을 뺏어 쓰고는 저를 그대로 알아보더군요",
        "'안경 없어도 잔소리 소리는 똑같은데'라고요. 칭찬입니까 그게",
        "…근데 그날 하루 종일 기분이 좋았습니다. 저 진짜 고장 난 것 같습니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "칭찬 맞아요. 목소리로 알아본 거잖아요",
          reply: "…목소리로요. 그럼 저는 안경이 본체가 아니라 목소리가 본체입니까",
          next: null,
          effect: { mental: 15, followers: 220, skills: { sociability: 35, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "안경 없이 알아본 사람이 하나 생긴 거예요",
          reply: "…하나 생겼습니다. 2년 만에 하나요. 나쁘지 않은 속도인가요 이거",
          next: null,
          effect: { mental: 12, followers: 200, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "고장 난 게 아니라 정 든 거예요. 그거 인정하세요",
          reply: "…인정 안 합니다. 인정하면 월급을 영영 못 받을 것 같아서요",
          next: null,
          effect: { mental: 10, followers: 250, skills: { comedy: 30, knowledge: 15 } },
        },
      ],
    },
  ],
};

/**
 * 안경이 본체 3회차 — 없어지면 어쩌나.
 * 축은 **"이 이상한 일상이 없어지면 어쩌나 하는 생각을 합니다"**이다.
 * ⚠️ 사무소를 위기에 빠뜨렸다가 구하는 극적 전개를 쓰지 마라. 위기는 아주 사소하게 온다.
 */
const GLASSES_STORY_3: DmStory = {
  id: "glasses_3",
  partnerName: "안경이 본체",
  partnerHandle: "glasses_tsukkomi",
  arrivalTitle: "안경이 본체의 DM",
  startNode: "what_if_it_ends",
  nodes: [
    {
      id: "what_if_it_ends",
      intro: [
        "요즘 이상한 생각을 합니다. 이 일상이 없어지면 어쩌나 하는 생각이요",
        "2년 전이면 없어지길 바랐을 겁니다. 지금은 반대입니다. 큰일이죠",
        "어제 사장님이 사무소를 정리할까 하는 소리를 지나가듯 하셨습니다",
        "…농담이었을 겁니다. 아마도요. 근데 잠이 안 오더군요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어보세요. 농담인지 아닌지",
          reply: "…물어보면 진짜일까 봐 못 물어보겠습니다. 하루 생각해보겠습니다",
          next: "the_answer_glasses",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 사람은 지나가듯 진심을 말하는 타입이에요",
          reply: "…그게 제일 무섭습니다. 정확히 그래서 잠을 못 잤고요",
          next: "the_answer_glasses",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "없어지면 그때 진짜 상식인으로 살면 되잖아요",
          reply: "…그 말이 왜 이렇게 서운합니까. 하룻밤 생각하고 답하겠습니다",
          next: "the_answer_glasses",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_answer_glasses",
      intro: [
        "물어봤습니다. '사무소 정리하실 겁니까'라고요. 목소리가 좀 떨렸습니다",
        "사장님이 만화 보시다가 고개도 안 들고 '누가?'라고 하시더군요",
        "본인이 어제 그랬다고 했더니 '아 그거 만화 대사였다'고 하셨습니다",
        "…저는 그날 밤을 새웠고요. 이 사람들 때문에 제가 늙습니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다행이네요. 밤 새운 값은 받으세요",
          reply: "…계란 한 판으로 받겠습니다. 이젠 그게 정상 같습니다",
          next: "my_place",
          effect: { mental: 15, skills: { sociability: 30, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "그걸 물어봤다는 게 답이에요. 나갈 사람은 안 물어요",
          reply: "…아. 그러네요. 저는 확인하고 싶었던 거군요. 남으려고",
          next: "my_place",
          effect: { mental: 12, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "만화 대사에 밤새운 사람이 상식인일 리가 없죠",
          reply: "…그만하십시오. 아니 계속하십시오. 어차피 사실이니까요",
          next: "my_place",
          effect: { mental: -3, skills: { comedy: 35 } },
        },
      ],
    },
    {
      id: "my_place",
      intro: [
        "아버지 도장을 지키겠다고 시작한 일인데 어느새 우주선 갑판에서 목검을 들고 있었습니다",
        "인생 계획이란 게 이렇게까지 쓸모없을 줄은 몰랐습니다",
        "그래도 도장은 아직 안 뺏겼고 간판도 그대로입니다. 절반쯤은 성공한 걸로 쳐주십시오",
        "…그리고 여기가 제 자리 같습니다. 인정하기 정말 싫지만요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "절반이 아니라 다 성공한 건데요",
          reply: "…다요? 월급이 두 달 밀렸는데요? …그래도 그렇게 세주시니 좋습니다",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 320,
            skills: { sociability: 35, comedy: 15 },
          },
        },
        {
          tone: "cool",
          me: "계획이 쓸모없던 게 아니라 계획보다 나은 게 온 거예요",
          reply: "…나은 겁니까 이게. …네. 나은 걸로 하겠습니다. 오늘은 그러겠습니다",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "인정하기 싫다면서 벌써 세 번 인정했어요",
          reply: "…세셨습니까 그걸. 이래서 제가 이 계정을 못 지웁니다",
          next: null,
          effect: {
            mental: 12,
            followers: 350,
            skills: { comedy: 30, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 우산 든 대식가 — 밥이 전부인 해결사 소속 소녀(`data/accounts.ts` sukonbu_umbrella).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"혼자 먹는 밥은 아무리 많이 먹어도 배가 안 부른다"**이다.
 *
 * ⚠️ 말투는 **짧고 툭툭 던지는 반말**이다("~야/~해/~잖아"). 존댓말·이모지 금지.
 * ⚠️ 그를 어른스럽게 만들지 마라. 결론은 늘 밥으로 돌아온다 — 그게 이 캐릭터의 지혜다.
 * ⚠️ 오빠 얘기는 **안 한다**("오빠 얘기는 안 할래"). 캐물어도 끝까지 답하지 않는다.
 * ⚠️ 동료는 "은토키"(사장)·"안경"·"개"로만 부른다. 계정 특정은 하지 마라.
 * 줄기: 1회차 밥 → 2회차 우는 애한테 먹을 것 → 3회차 돌아갈 곳.
 */
export const UMBRELLA_STORY: DmStory = {
  id: "umbrella_1",
  partnerName: "우산 든 대식가",
  partnerHandle: "sukonbu_umbrella",
  arrivalTitle: "우산 든 대식가의 DM",
  startNode: "rice_rice_rice",
  nodes: [
    {
      id: "rice_rice_rice",
      intro: [
        "좋아요 눌렀네. 밥 사주는 사람이 좋은 사람이야. 이건 우주의 법칙이야",
        "너는 아직 안 사줬으니까 보류야. 그래도 눌렀으니까 반은 좋은 사람",
        "오늘 안경이 삼십 분 내내 잔소리했어. 그래서 밥 한 숟갈 크게 떠서 입에 넣어줬어",
        "…바로 조용해지더라. 사람은 배부르면 착해져. 이게 내 철학이야",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 철학 맞아. 꽤 좋은 철학이야",
          reply: "그치? 근데 아무도 안 믿어. 다들 내가 밥만 생각하는 줄 알아",
          next: "who_eats_with_me",
          effect: { mental: 4, skills: { sociability: 15, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "잔소리 멈추게 하려고 먹인 거잖아",
          reply: "…반은 그래. 근데 그 애 아침도 안 먹고 왔거든. 그것도 반이야",
          next: "who_eats_with_me",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "남의 입에 밥 넣는 건 좀 아니지 않아?",
          reply: "…그럼 어떡해. 말로 하면 안 듣잖아. 밥은 들어가는데",
          next: "who_eats_with_me",
          effect: { mental: -2, skills: { comedy: 20 } },
        },
      ],
    },
    {
      id: "who_eats_with_me",
      intro: [
        "은토키가 또 밥값 안 냈어. 다음엔 진짜 물어버릴 거야",
        "근데 돈 없다고 해서 오늘은 참았어. 나 착하지",
        "혼자 먹는 밥은 아무리 많이 먹어도 배가 안 불러. 이상하지",
        "…이건 여기 와서 알았어. 고향에선 몰랐던 거야",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 이상해. 다들 그래",
          reply: "다들 그래? 그럼 왜 다들 혼자 먹어. 이해가 안 돼",
          next: "the_full_plate",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "배가 안 부른 게 아니라 다 먹은 걸 못 느끼는 거야",
          reply: "…어려운 말인데 맞는 것 같아. 하루 생각해볼게",
          next: "the_full_plate",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "고향에선 혼자 먹었어?",
          reply: "…그 얘긴 안 할래. 밥 얘기나 하자. 내일 다시 올게",
          next: "the_full_plate",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_full_plate",
      intro: [
        "오늘 제일 큰 접시에 밥을 산처럼 쌓았어. 다섯 그릇쯤 되게",
        "그러고 사무소 애들 다 불렀어. 개까지 불렀어",
        "다 먹으니까 접시가 비었는데, 내가 먹은 건 두 그릇도 안 됐어",
        "…근데 배가 불렀어. 이게 뭔지 아직 잘 모르겠어",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 같이 먹는 거야",
          reply: "…같이 먹는 거. 그럼 나는 오늘 제일 많이 먹은 거네. 좋아",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "네가 부른 거잖아. 그게 다른 점이야",
          reply: "…내가 불렀지. 처음이야 그거. 앞으로 자주 부를래",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "개까지 부른 건 좀 그렇지 않아?",
          reply: "왜? 걔가 제일 잘 먹어. 그리고 제일 안 시끄러워",
          next: null,
          effect: { mental: 5, followers: 180, skills: { comedy: 25 } },
        },
      ],
    },
  ],
};

/**
 * 우산 든 대식가 2회차 — 우는 애.
 * 축은 **"울고 있는 애한테는 일단 먹을 걸 줘야 해"**이다.
 * ⚠️ 그가 사연을 캐묻게 하지 마라. 그는 이유를 안 묻고 밥부터 준다.
 */
const UMBRELLA_STORY_2: DmStory = {
  id: "umbrella_2",
  partnerName: "우산 든 대식가",
  partnerHandle: "sukonbu_umbrella",
  arrivalTitle: "우산 든 대식가의 DM",
  startNode: "the_crying_one",
  nodes: [
    {
      id: "the_crying_one",
      intro: [
        "오늘 골목에서 우는 애를 봤어. 나보다 어려 보였어",
        "울고 있는 애한테는 일단 먹을 걸 줘야 해. 배부르면 좀 나아지거든",
        "그래서 내 스콘부를 줬어. 그거 안 주는 건데 줬어. 이건 큰 거야",
        "…근데 걔가 안 먹더라. 그럼 어떡해야 돼?",
      ],
      choices: [
        {
          tone: "friendly",
          me: "옆에 앉아 있어. 그거면 돼",
          reply: "…앉아만 있어? 그건 아무것도 안 하는 거잖아. 그래도 해볼게",
          next: "what_she_did",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "안 먹으면 두고 와. 나중에 먹어",
          reply: "…두고 오는 거. 그건 생각 못 했어. 내일 해볼게",
          next: "what_she_did",
          delayDays: 1,
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "왜 우는지 물어봤어?",
          reply: "…안 물어봤어. 물어보면 더 울 것 같았거든. 내일 다시 얘기하자",
          next: "what_she_did",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_she_did",
      intro: [
        "다시 갔어. 스콘부 말고 밥을 싸 갔어. 계란찜도 넣었어",
        "옆에 앉아서 나 먼저 먹었어. 소리 나게 먹었어. 일부러",
        "그랬더니 걔가 좀 보더니 자기도 먹더라. 다 먹었어",
        "…먹고 나서 울음이 멈췄어. 이유는 아직도 몰라. 안 물어봤어",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 물어본 게 제일 잘한 거야",
          reply: "…그래? 나는 못 물어본 거였는데. 잘한 걸로 할래",
          next: "why_food",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "소리 나게 먹은 건 계산한 거지",
          reply: "…계산 아니야. 원래 그렇게 먹어. 근데 효과는 있었어",
          next: "why_food",
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "밥으로 다 해결되는 건 아니야",
          reply: "…알아. 근데 밥 없이 해결되는 것도 없어. 그건 확실해",
          next: "why_food",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "why_food",
      intro: [
        "왜 밥이냐고 다들 물어. 그래서 오늘은 답을 적어둘게",
        "고향에 있을 때 강한 게 전부인 줄 알았어. 강하면 다 되는 줄 알았고",
        "근데 여기 와서 알았는데, 옆에서 밥을 같이 먹어주는 사람이 있는 쪽이 훨씬 세더라",
        "…그래서 밥이야. 이게 내가 배운 제일 중요한 거야",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 진짜 센 거 맞아",
          reply: "그치. 근데 오빠한테는 죽어도 말 안 할 거야. 이건 비밀이야",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "강한 것보다 세다는 게 무슨 뜻인지 알 것 같아",
          reply: "…설명 안 해도 알아듣네. 너 밥 사줄게. 언젠가",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "고향 얘기 나왔네. 오빠는 누구야",
          reply: "…안 할래. 밥 얘기나 하자니까. 오늘은 여기까지야",
          next: null,
          effect: { mental: -6, followers: 220, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 우산 든 대식가 3회차 — 돌아갈 곳.
 * 축은 **"돌아갈 곳이 있다는 게 뭔지 요즘 조금 알 것 같아. 조금만이야"**이다.
 * ⚠️ 고향으로 보내지 마라. 결말은 여기가 돌아갈 곳이 된 것까지다. 오빠 얘기는 끝까지 안 한다.
 */
const UMBRELLA_STORY_3: DmStory = {
  id: "umbrella_3",
  partnerName: "우산 든 대식가",
  partnerHandle: "sukonbu_umbrella",
  arrivalTitle: "우산 든 대식가의 DM",
  startNode: "the_broken_umbrella",
  nodes: [
    {
      id: "the_broken_umbrella",
      intro: [
        "우산이 또 부러졌어. 사람 머리는 왜 이렇게 단단한 거야",
        "새로 사러 갔더니 가게 아저씨가 왜 이렇게 자주 오냐고 물었어",
        "비가 많이 와서라고 했더니 그냥 믿더라. 어른들은 쉽게 속아",
        "…좋은 아저씨니까 봐주는 거야. 근데 오늘은 돈이 모자랐어",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그래서 어떻게 했어?",
          reply: "그냥 왔어. 우산 없이. 근데 진짜 비가 오더라. 웃기지",
          next: "who_came",
          delayDays: 1,
          effect: { skills: { sociability: 20, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "우산값을 사무소에 청구해. 업무용이잖아",
          reply: "…업무용. 그렇게 쓰면 되는 거야? 내일 안경한테 말해볼게",
          next: "who_came",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "머리를 그만 때리면 우산이 안 부러지지",
          reply: "…약한 애 괴롭히는 놈은 때려도 돼. 그건 규칙이야. 안 바꿔",
          next: "who_came",
          delayDays: 1,
          effect: { mental: -2, skills: { fitness: 20 } },
        },
      ],
    },
    {
      id: "who_came",
      intro: [
        "비 맞고 걸어오는데 안경이 우산 들고 왔어. 두 개 들고",
        "하나는 자기 거고 하나는 내 거래. 내 거는 새거였어",
        "돈 어디서 났냐고 물었더니 야근 수당이래. 자기가 계산해서 챙긴 거",
        "…그걸로 내 우산을 샀어. 나 그거 듣고 아무 말도 못 했어",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고맙다고 했어?",
          reply: "…못 했어. 대신 저녁에 그 애 몫까지 밥을 안 뺏어 먹었어. 그거면 돼",
          next: "where_i_return",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그 사람 우산값이 몇 끼야?",
          reply: "…세 끼쯤. 세 끼를 우산으로 바꾼 거야 걔가. 바보야 진짜",
          next: "where_i_return",
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 우산도 부러뜨릴 거잖아",
          reply: "…이건 안 부러뜨려. 이건 안 써. 비 올 때만 쓸 거야. 진짜로",
          next: "where_i_return",
          effect: { mental: 12, skills: { knowledge: 25, sociability: 20 } },
        },
      ],
    },
    {
      id: "where_i_return",
      intro: [
        "돌아갈 곳이 있다는 게 뭔지 요즘 조금 알 것 같아. 조금만이야",
        "이 별의 밥은 맛있어. 그거 하나는 인정해줄게. 시끄러운 애들도 있고",
        "이 별에 온 건 잘한 일 같아. 이건 오늘 처음 쓰는 말이야",
        "…내일도 밥 먹을 거야. 그거면 충분해",
      ],
      choices: [
        {
          tone: "friendly",
          me: "충분해. 그거면 진짜 충분해",
          reply: "…너도 밥 잘 먹어. 안 먹으면 내가 화낼 거야",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 15 },
          },
        },
        {
          tone: "cool",
          me: "조금만이라고 세 번 말했어. 그거 조금 아니야",
          reply: "…세 번? 그럼 조금씩 세 번이니까 많은 거네. 계산이 그렇게 되나",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그럼 이제 여기가 집이야",
          reply: "…집. 그 단어는 아직 좀 그래. 근데 틀린 말은 아니야",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { sociability: 30, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 가학취미 1번대 — 남이 곤란해하는 얼굴을 보면 하루가 즐거워지는 대장(`data/accounts.ts` sadist_captain).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"진심으로 했다간 다음에 또 싸울 수가 없다"**이다. 그는 장난과 진심 사이를 정확히 계산한다.
 *
 * ⚠️ 말투는 **정중한 존댓말인데 내용이 짓궂다**. 그 온도차가 이 캐릭터다. 화내지 않는다.
 * ⚠️ 그를 착하게 만들지 마라. 선행에도 반드시 딴청 섞인 이유를 붙인다("우는 소리가 시끄러워서").
 * ⚠️ 부대장(mayo_vice)은 "부대장님", 국장(gorilla_chief)은 "국장님", 은발 사장(deadeyes_boss)은
 *    "그 은발 사장"으로만 부른다. 그쪽 회차 진행을 전제하지 마라.
 * ⚠️ 누나 얘기는 안 한다("물어보지도 마십시오"). 캐물어도 답하지 않는다.
 * 줄기: 1회차 연유 도시락 → 2회차 우는 애 → 3회차 부대장 자리.
 */
export const SADIST_STORY: DmStory = {
  id: "sadist_1",
  partnerName: "가학취미 1번대",
  partnerHandle: "sadist_captain",
  arrivalTitle: "가학취미 1번대의 DM",
  startNode: "the_condensed_milk",
  nodes: [
    {
      id: "the_condensed_milk",
      intro: [
        "제 글을 퍼가셨군요. 안목이 있으십니다. 아니면 취향이 이상하시거나요",
        "어제 부대장님 도시락 마요네즈 통에 연유를 가득 채워놨습니다",
        "평소처럼 밥에 잔뜩 짜서 한 입 드시고 표정이 3단계로 변하시는 걸 봤습니다",
        "…솔직히 그 3초를 위해 제가 이 직업을 계속하는 겁니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "3단계가 뭐예요? 궁금한데요",
          reply: "무표정, 정지, 그리고 저를 봅니다. 세 번째가 제일 좋습니다",
          next: "the_reason_i_do",
          effect: { mental: 4, skills: { sociability: 15, comedy: 20 } },
        },
        {
          tone: "cool",
          me: "그거 걸리면 처벌 대상 아니에요?",
          reply: "규정상 도시락은 사적 영역이라 처벌 조항이 없습니다. 확인하고 했습니다",
          next: "the_reason_i_do",
          effect: { skills: { knowledge: 25, comedy: 10 } },
        },
        {
          tone: "bold",
          me: "그거 하려고 공무원 하는 사람이 어디 있어요",
          reply: "여기 있습니다. 세금으로 바주카를 쏘는 공무원이기도 하고요",
          next: "the_reason_i_do",
          effect: { mental: -2, skills: { comedy: 25 } },
        },
      ],
    },
    {
      id: "the_reason_i_do",
      intro: [
        "누가 곤란해하는 얼굴을 보면 하루가 즐거워집니다. 이건 병이 아니라 재능입니다",
        "다만 규칙이 하나 있습니다. 진짜로 곤란한 사람은 안 건드립니다",
        "부대장님은 곤란해도 안 무너지는 분이라 괜찮은 겁니다. 계산은 하고 합니다",
        "…이 얘길 하니까 제가 꽤 성실한 인간처럼 보이는군요. 곤란한데요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "성실한 거 맞는데요. 계산까지 하잖아요",
          reply: "…그 말은 취소해주십시오. 제 평판에 금이 갑니다",
          next: "the_draw",
          delayDays: 1,
          effect: { skills: { sociability: 20, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "선을 아는 사람이 제일 세게 노는 거예요",
          reply: "…제법 정확한 분석입니다. 하루 두고 곱씹어보겠습니다",
          next: "the_draw",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "곤란한 사람을 골라내는 눈은 어디서 배웠어요?",
          reply: "…도장에서 배운 건 검술이 아니라 지지 않는 법이었습니다. 내일 답하죠",
          next: "the_draw",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_draw",
      intro: [
        "그 은발 사장이랑 어제 또 붙었습니다. 결과는 무승부입니다. 늘 그렇습니다",
        "어차피 서로 진심으로 안 하고 있으니까요. 그건 둘 다 압니다",
        "진심으로 했다간 둘 중 하나는 확실히 안 남습니다. 그러면 다음에 또 싸울 수가 없잖습니까",
        "…이런 걸 어른의 배려라고 부르는 겁니다. 아무도 안 믿지만요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "믿어요. 그게 배려 맞아요",
          reply: "…믿으신다고요. 곤란하군요. 곤란한 건 제 담당인데 말입니다",
          next: null,
          effect: { mental: 10, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "다음에 또 싸우고 싶다는 게 핵심이네요",
          reply: "…거기까지 읽으시는군요. 네. 그게 핵심입니다",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그건 배려가 아니라 아까운 거죠. 상대가",
          reply: "…아깝다니요. 그런 단어는 제 사전에 없습니다. …오늘은 여기까지 하죠",
          next: null,
          effect: { mental: -3, followers: 200, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 가학취미 1번대 2회차 — 우는 애.
 * 축은 **'선행에 딴청을 붙이는 것'**이다.
 * ⚠️ 그가 선의를 인정하게 만들지 마라. 끝까지 다른 이유를 댄다.
 */
const SADIST_STORY_2: DmStory = {
  id: "sadist_2",
  partnerName: "가학취미 1번대",
  partnerHandle: "sadist_captain",
  arrivalTitle: "가학취미 1번대의 DM",
  startNode: "the_lost_kid",
  nodes: [
    {
      id: "the_lost_kid",
      intro: [
        "순찰 중에 길 잃고 우는 애가 있길래 집까지 데려다줬습니다",
        "부대원들이 의외라는 눈으로 쳐다보더군요. 그 눈이 제일 불쾌했습니다",
        "그래서 '세금 꼬박꼬박 내는 집 자식이라 그렇다'고 답해줬습니다",
        "…진짜 이유는 딱히 없습니다. 그냥 우는 소리가 시끄러웠을 뿐입니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "시끄러우면 지나가면 되잖아요",
          reply: "…지나가면 계속 시끄럽지 않습니까. 해결한 겁니다. 효율입니다",
          next: "the_gossip",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "부대원들 눈이 불쾌했던 이유가 더 궁금한데요",
          reply: "…제가 그런 짓 안 할 인간으로 보였다는 뜻이니까요. 맞는 말이라 더 그렇고요",
          next: "the_gossip",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "이유가 없으면 그게 선의예요",
          reply: "…그런 딱지는 사양하겠습니다. 저는 이미지 관리가 필요한 사람입니다",
          next: "the_gossip",
          effect: { mental: -3, skills: { comedy: 20, knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_gossip",
      intro: [
        "문제가 생겼습니다. 그 얘기가 부대에 퍼졌습니다",
        "1번대 대장이 애를 데려다줬다더라, 알고 보면 좋은 사람이다, 뭐 이런 식으로요",
        "이러면 곤란합니다. 다들 저를 안 무서워하게 되면 부대가 안 굴러갑니다",
        "…무서워하는 게 좋은 신호라고 제가 늘 써놨는데 말입니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무서운 사람이 가끔 착하면 더 무서운데요",
          reply: "…오. 그건 생각 못 했습니다. 하루 검토해보겠습니다",
          next: "what_i_did_next",
          delayDays: 1,
          effect: { skills: { sociability: 20, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "안 무서워하는 게 아니라 안 도망가는 거예요. 그게 더 좋고요",
          reply: "…부대 운영 관점에서는 그쪽이 낫긴 하겠군요. 하루 생각해보죠",
          next: "what_i_did_next",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "이미지 관리하겠다고 애를 두고 올 건 아니잖아요",
          reply: "…그건 아닙니다. 그건 확실히 아닙니다. 내일 답하겠습니다",
          next: "what_i_did_next",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_did_next",
      intro: [
        "해결했습니다. 다음 날 훈련에서 신입 셋을 울렸습니다",
        "'좋은 사람'이라는 소문은 하루 만에 사라졌습니다. 효율적인 처리였습니다",
        "…다만 그 셋한테는 훈련 끝나고 단 걸 하나씩 사줬습니다. 그건 아무도 못 봤고요",
        "이건 이미지 관리가 아니라 그냥 제가 단 걸 좋아해서 산 김에 준 겁니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 변명은 좀 약한데요",
          reply: "…약합니까. 다음엔 더 그럴듯한 걸 준비하겠습니다",
          next: null,
          effect: { mental: 12, followers: 200, skills: { sociability: 30, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "울리고 사주면 그 애들은 당신한테 더 매여요",
          reply: "…그것도 계산에 있었습니다. 라고 말해두겠습니다. 실제로는 아니지만요",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "성장통이라고 쓰면서 단 거 사주는 건 반칙이죠",
          reply: "…반칙이라니. 저는 규정 위반을 한 적이 없습니다. 사탕은 규정에 없습니다",
          next: null,
          effect: { mental: 8, followers: 220, skills: { comedy: 30 } },
        },
      ],
    },
  ],
};

/**
 * 가학취미 1번대 3회차 — 부대장 자리.
 * 축은 **"부대장 자리가 비면 제가 올라갑니다"**를 실제로 마주하는 것이다.
 * ⚠️ 그가 자리를 차지하게 하지 마라. 결말은 자리를 비우지 않게 만드는 쪽이다 — 방식은 여전히 짓궂다.
 */
const SADIST_STORY_3: DmStory = {
  id: "sadist_3",
  partnerName: "가학취미 1번대",
  partnerHandle: "sadist_captain",
  arrivalTitle: "가학취미 1번대의 DM",
  startNode: "the_vacancy",
  nodes: [
    {
      id: "the_vacancy",
      intro: [
        "부대장 자리가 빌 뻔했습니다. 부대장님이 사직서를 쓰셨거든요",
        "본인이 규칙을 어긴 건으로요. 그 양반은 그런 사람입니다",
        "저는 늘 그 자리가 비면 제가 올라간다고 떠들어왔습니다. 그러니까 좋아해야 하는데요",
        "…이상하게 하나도 안 즐거웠습니다. 이건 계산 밖입니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 자리를 원한 게 아니라 그 사람을 원한 거예요",
          reply: "…그 문장은 좀 부담스러운데요. 하루 두고 생각해보겠습니다",
          next: "what_i_pulled",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "올라가면 괴롭힐 사람이 없어지죠",
          reply: "…정확합니다. 제 즐거움의 원천이 사라집니다. 심각한 손실입니다",
          next: "what_i_pulled",
          delayDays: 1,
          effect: { skills: { knowledge: 35, comedy: 15 } },
        },
        {
          tone: "bold",
          me: "그럼 사직서를 막으세요. 방법은 알잖아요",
          reply: "…방법은 압니다. 쓰기 싫었을 뿐입니다. 하룻밤 주십시오",
          next: "what_i_pulled",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_pulled",
      intro: [
        "사직서를 국장님 책상에 도착하기 전에 가져왔습니다. 방법은 안 밝히겠습니다",
        "그리고 부대장님한테 돌려드리면서 말했습니다",
        "'이거 제출하시면 제가 부대장 됩니다. 그래도 괜찮으시겠습니까?'",
        "…그 양반이 3초쯤 굳어 있다가 그 자리에서 찢으시더군요. 예상대로였습니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "본인을 협박 카드로 쓴 거네요",
          reply: "…제일 효과적인 카드였습니다. 저를 제일 잘 아는 분이 그 양반이라서요",
          next: "why_i_stay",
          effect: { mental: 12, skills: { sociability: 30, comedy: 20 } },
        },
        {
          tone: "cool",
          me: "찢을 걸 알고 그렇게 말한 거잖아요",
          reply: "…계산은 늘 합니다. 다만 이번엔 결과가 마음에 들었습니다. 드물게요",
          next: "why_i_stay",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "가져온 방법이 규정 위반이면 그건 어쩔 건데요",
          reply: "…그건 제 처벌서에 적어뒀습니다. 그 양반한테 냈고요. 근신 사흘 받았습니다",
          next: "why_i_stay",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "why_i_stay",
      intro: [
        "지키고 싶은 게 생기면 사람이 약해진다던데, 제 얘긴 아닙니다. 아마도요",
        "저는 그냥 이 부대가 시끄러운 게 좋습니다. 조용하면 잘 시간이 늘어나니까요",
        "부대장님이랑 저 둘 중 하나는 없어져야 이 부대가 조용해집니다",
        "…제가 나갈 생각은 없고, 그 양반도 이제 못 나갑니다. 그러니 시끄러운 채로 가는 겁니다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 이 부대가 굴러가는 이유겠네요",
          reply: "…분석이 정확하십니다. 국장님께 보고서로 제출해도 되겠습니다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 320,
            skills: { sociability: 35, comedy: 20 },
          },
        },
        {
          tone: "cool",
          me: "'아마도요'를 붙인 게 답이에요",
          reply: "…그 두 글자는 빼주십시오. 기록에 남으면 곤란합니다",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "그럼 연유는 계속 넣을 거예요?",
          reply: "…당연하지 않습니까. 그게 제 근태 관리 방식입니다",
          next: null,
          effect: {
            mental: 12,
            followers: 350,
            skills: { comedy: 35, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 고릴라 소리 내는 국장 — 부하를 가족이라 부르는 치안 조직 국장(`data/accounts.ts` gorilla_chief).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"내가 죽으면 이 조직은 어떻게 될까"**다. 그는 그 답을 후계가 아니라 습관으로 만든다.
 *
 * ⚠️ 말투는 **투박한 반말**이다("~다/~야/~나"). 리더 3종(주장·근성·마요)과 갈라라 —
 *    이쪽은 **가족**이다. 규율도 성과도 아니고 사람을 안 버리는 게 전부다.
 * ⚠️ 그 여자 얘기는 **구애로만** 쓴다. 상대를 묘사하거나 이름 붙이지 마라.
 * ⚠️ 부대장 둘은 "마요네즈 놈"·"1번대 놈"으로만 부른다. 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 안 말리는 싸움 → 2회차 백한 번째 → 3회차 내가 없으면.
 */
export const CHIEF_STORY: DmStory = {
  id: "chief_1",
  partnerName: "고릴라 소리 내는 국장",
  partnerHandle: "gorilla_chief",
  arrivalTitle: "고릴라 소리 내는 국장의 DM",
  startNode: "let_them_fight",
  nodes: [
    {
      id: "let_them_fight",
      intro: [
        "좋아요를 눌렀더군. 고맙다. 내 글은 대체로 시끄러워서 다들 지나간다",
        "부대장 둘이 또 싸웠다. 말리지 않았다. 저러면서 크는 거다",
        "하나는 마요네즈에 미쳐 있고 하나는 낮잠에 미쳐 있다. 남들은 왜 저런 놈들을 앉혔냐고 한다",
        "…저 둘이 진지해지는 순간을 본 적이 있어서 그렇다. 그거 한 번 보면 다른 놈은 못 앉힌다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "본 사람만 아는 거죠",
          reply: "…그렇지. 그래서 설명을 안 한다. 설명해도 안 믿으니까",
          next: "the_family",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "안 말리는 것도 관리예요. 싸울 데를 만들어주는 거니까",
          reply: "…그렇게 부르면 내가 꽤 유능해 보이는군. 그냥 시끄러운 게 익숙한 거다",
          next: "the_family",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "매일 싸우는 걸 두면 언젠간 진짜로 터져요",
          reply: "…터지면 그때 말린다. 그때까지는 둔다. 그게 내 방식이다",
          next: "the_family",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_family",
      intro: [
        "우리 대원들은 내 가족이다. 이건 농담이 아니야",
        "이 조직은 시골 촌놈들 모임에서 시작했다. 지금도 그렇다",
        "배운 것도 없고 가진 것도 없던 놈들이 이 도시 밤을 지키고 있다. 어디 흔한 얘긴가",
        "…부끄러워하는 놈이 있으면 지금 나가라. 나는 죽을 때까지 이 얘길 할 거다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "부끄러워할 얘기가 아니죠",
          reply: "…아니지. 그런데 위에 있는 놈들은 그렇게 안 본다. 그건 상관없고",
          next: "the_rule_chief",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "가족이라고 부르면 못 자르는 것도 생겨요",
          reply: "…못 자른다. 1번대 놈이 딱 그렇다. 재능이 아까워서 못 자르는 거고. 하루 생각해보겠다",
          next: "the_rule_chief",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "가족이라는 말로 야근을 시키는 조직도 많은데요",
          reply: "…그건 그렇지. 내가 그런 놈인지는 나도 모르겠다. 하루 생각해보마",
          next: "the_rule_chief",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_rule_chief",
      intro: [
        "생각해봤다. 그래서 오늘 대원들한테 물었다. 야근이 많냐고",
        "다들 웃기만 하더라. 그래서 명령했다. '앞으로 야근하면 나한테 보고해라.'",
        "보고가 열한 건 올라왔다. 열한 건 다 내가 시킨 거였다",
        "…가족이라는 말로 부린 게 맞았다. 그래서 다음 달부터 인원을 늘리기로 했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "물어본 것부터가 대단한 거예요",
          reply: "…물어보는 게 대단한 일이 되면 안 되는데. 그래도 고맙게 듣겠다",
          next: null,
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "열한 건을 다 본인 탓으로 센 게 답이에요",
          reply: "…내가 시킨 걸 남 탓으로 셀 수는 없지. 그건 계산이 아니라 상식이다",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "인원 늘릴 예산은 있어요?",
          reply: "…없다. 위에 가서 소리 지르면 반쯤은 나온다. 그건 내가 잘한다",
          next: null,
          effect: { mental: 6, followers: 180, skills: { knowledge: 30, comedy: 15 } },
        },
      ],
    },
  ],
};

/**
 * 고릴라 소리 내는 국장 2회차 — 백한 번째.
 * 축은 **"사람 마음이라는 게 계산해서 접을 수 있는 거였으면"**이다.
 * ⚠️ 상대를 등장시키거나 성사시키지 마라. 결말은 그가 **방식을 바꾸는 것**까지다.
 */
const CHIEF_STORY_2: DmStory = {
  id: "chief_2",
  partnerName: "고릴라 소리 내는 국장",
  partnerHandle: "gorilla_chief",
  arrivalTitle: "고릴라 소리 내는 국장의 DM",
  startNode: "hundred_and_one",
  nodes: [
    {
      id: "hundred_and_one",
      intro: [
        "오늘도 차였다. 세어보니 백 번은 넘은 것 같다",
        "대원들이 그만하라고 한다. 그만둘 생각은 없다",
        "사람 마음이라는 게 계산해서 접을 수 있는 거였으면 내가 이 나이까지 이러고 있겠나",
        "…근데 오늘은 좀 다른 소리를 들었다. '무섭다'고 하더라",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 방식을 바꿔야죠. 그건 신호예요",
          reply: "…신호라. 나는 그동안 횟수만 셌지 방식은 안 셌다. 하루 생각해보겠다",
          next: "what_i_changed",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "백 번 거절당한 걸 구애라고 부르는 건 본인만이에요",
          reply: "…아프군. 아픈데 반박이 안 된다. 하룻밤 생각하겠다",
          next: "what_i_changed",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "무섭다는 말을 들었으면 그건 그만하라는 뜻이에요",
          reply: "…그만하라는 뜻. 그렇게 읽어야 하는 건가. 내일 답하겠다",
          next: "what_i_changed",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_changed",
      intro: [
        "안 갔다. 오늘 처음으로 안 갔다. 백 몇 일 만에 처음이다",
        "대신 편지를 한 장 보냈다. 짧게 썼다. '무섭게 해서 미안하다. 이제 안 가겠다.'",
        "그러고 하루 종일 순찰을 돌았다. 순찰이 이렇게 긴 줄 몰랐다",
        "…이게 맞는 건지는 아직 모르겠다. 근데 무섭다는 말을 듣고도 계속 가는 건 아니지",
      ],
      choices: [
        {
          tone: "friendly",
          me: "맞는 겁니다. 그건 확실해요",
          reply: "…확실하다고 해주니 낫다. 오늘은 그 말로 자겠다",
          next: "what_i_learned_chief",
          effect: { mental: 12, morality: 8, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "백 번을 세던 사람이 한 번에 멈춘 게 대단해요",
          reply: "…멈추는 건 한 번이면 되더라. 시작하는 게 백 번 걸렸을 뿐이고",
          next: "what_i_learned_chief",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "편지도 안 보내는 게 나았을 텐데요",
          reply: "…그런가. 그건 내가 못 참았다. 그것도 내 몫으로 지겠다",
          next: "what_i_learned_chief",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_i_learned_chief",
      intro: [
        "대원 하나가 오늘 나한테 왜 그만뒀냐고 물었다",
        "그래서 답했다. '내가 좋다고 남이 좋은 게 아니더라.'",
        "그놈이 그걸 받아 적었다. 왜 적냐고 했더니 자기도 그러고 있었단다",
        "…이 나이에도 배울 게 있더라. 그게 재밌다. 배운 걸 써먹을 데도 있고",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 대원한테는 백 번을 아껴준 거네요",
          reply: "…아껴줬다. 그렇게 세면 이번 건도 손해는 아니군",
          next: null,
          effect: { mental: 15, morality: 6, followers: 220, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "가르치려고 한 말이 아니라서 더 배운 거예요",
          reply: "…나는 가르치는 재주가 없다. 그냥 겪은 걸 말할 뿐이고",
          next: null,
          effect: { mental: 10, followers: 200, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그래도 가끔 생각나면요?",
          reply: "…생각나겠지. 생각은 나도 발은 안 간다. 그 정도는 할 수 있다",
          next: null,
          effect: { mental: 8, followers: 250, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 고릴라 소리 내는 국장 3회차 — 내가 없으면.
 * 축은 **"내가 죽으면 이 조직은 어떻게 될까"**다.
 * ⚠️ 그를 은퇴시키거나 후계를 지명하게 하지 마라. 답은 사람이 아니라 **습관**으로 나온다.
 */
const CHIEF_STORY_3: DmStory = {
  id: "chief_3",
  partnerName: "고릴라 소리 내는 국장",
  partnerHandle: "gorilla_chief",
  arrivalTitle: "고릴라 소리 내는 국장의 DM",
  startNode: "if_i_am_gone",
  nodes: [
    {
      id: "if_i_am_gone",
      intro: [
        "내가 죽으면 이 조직은 어떻게 될까 가끔 생각한다",
        "요즘 자주 생각한다. 무릎이 예전 같지 않아서 그런가 보다",
        "부대장 자리는 아무나 못 준다. 목숨을 맡기는 자리라서",
        "…그럼 국장 자리는 누구한테 주냐. 이건 답이 안 나온다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "자리를 물려주지 말고 방식을 물려주세요",
          reply: "…방식을. 그건 어떻게 물려주는 거냐. 하루 생각해보겠다",
          next: "the_habit_chief",
          delayDays: 1,
          effect: { skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "답이 안 나오는 건 후보가 없어서가 아니라 안 정하고 싶어서예요",
          reply: "…정하면 진짜가 되니까. 그건 맞다. 하룻밤 주라",
          next: "the_habit_chief",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "지금 안 정하면 그때 조직이 찢어져요",
          reply: "…겪어본 사람처럼 말하는군. 맞는 말이다. 내일 답하겠다",
          next: "the_habit_chief",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_habit_chief",
      intro: [
        "생각했다. 그리고 규칙을 세 개 만들어서 게시판에 붙였다",
        "하나, 국장은 제일 먼저 앞에 선다. 둘, 대원 결혼식엔 무조건 간다",
        "셋, 부하가 다치면 그날 보고서는 국장이 직접 쓴다",
        "…내가 하던 걸 적어놓은 것뿐이다. 이제 누가 앉든 이건 해야 한다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 물려주는 방식이에요",
          reply: "…이러면 되는 거였나. 20년을 고민한 게 종이 한 장으로 끝났다",
          next: "who_sits_here",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "셋 다 앞에 서는 일이네요. 뒤에 앉는 규칙은 없고요",
          reply: "…국장이 사무실에 앉아 있으면 안 되지. 그건 규칙에 안 넣어도 안다",
          next: "who_sits_here",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "적어놓으면 다음 국장이 그걸 고칠 텐데요",
          reply: "…고치라고 붙인 거다. 안 고치는 규칙은 유물이지 규칙이 아니다",
          next: "who_sits_here",
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "who_sits_here",
      intro: [
        "게시판을 본 대원 하나가 물었다. '국장님 어디 가십니까?'",
        "안 간다고 했다. 아직 멀었다고. 그랬더니 안심하고 가더라",
        "그 얼굴을 보고 알았다. 다들 내가 계속 있을 거라고 생각한다는 걸",
        "…그러니까 나는 계속 있어야 한다. 그게 국장의 일이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "오래 계세요. 그게 제일 좋은 인계예요",
          reply: "…오래 있겠다. 무릎이 허락하는 만큼은",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 320,
            skills: { sociability: 35, fitness: 10 },
          },
        },
        {
          tone: "cool",
          me: "규칙을 붙였으니 이제 없어도 굴러가요. 그래서 더 오래 있어도 되고요",
          reply: "…둘 다 되는 거군. 계산이 좋다. 그렇게 세겠다",
          next: null,
          effect: { mental: 15, followers: 300, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "안심하고 간 그 대원이 다음 국장일 수도 있어요",
          reply: "…그럴 수도 있지. 그런 건 내가 정하는 게 아니라 그놈들이 정하는 거다",
          next: null,
          effect: {
            mental: 15,
            followers: 350,
            skills: { knowledge: 40, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 안경 쓴 실무 담당 — 사장 대신 다 뛰는 정식 임원(`data/accounts.ts` spectacle_aide).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"사장님 옛날 얘기는 절대 안 묻습니다"**이다. 그는 궁금해도 안 묻는 쪽을 10년째 고른다.
 *
 * ⚠️ 말투는 **건조한 존댓말**이다. 안경이 본체(glasses_tsukkomi)와 갈라라 —
 *    그쪽은 **소리치는 상식인**, 이쪽은 **소리 안 내고 숫자로 처리하는 실무자**다. 물음표를 거의 안 쓴다.
 * ⚠️ 그를 폭발시키지 마라. 이 캐릭터는 끝까지 조용하다. 화는 통계로 낸다.
 * ⚠️ 사장(ahaha_trader)은 "사장님"으로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 손해액 통계 → 2회차 비서가 아니라 임원 → 3회차 안 묻기로 한 것.
 */
export const AIDE_STORY: DmStory = {
  id: "aide_1",
  partnerName: "안경 쓴 실무 담당",
  partnerHandle: "spectacle_aide",
  arrivalTitle: "안경 쓴 실무 담당의 DM",
  startNode: "the_statistics",
  nodes: [
    {
      id: "the_statistics",
      intro: [
        "제 글을 퍼가주셨군요. 이 계정은 대체로 업무 불평이라 의외입니다.",
        "사장님이 아하하 웃으실 때마다 손해액이 늘어난다는 걸 통계로 냈습니다.",
        "표본 200건에 상관계수가 0.71입니다. 우연이라고 하기엔 높습니다.",
        "…보여드렸더니 또 아하하 웃으시더군요. 표본이 201건이 됐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 통계 낸 시간에 화를 내셨어야죠",
          reply: "…화는 효율이 낮습니다. 통계는 남기라도 하고요.",
          next: "the_reflex",
          effect: { skills: { sociability: 12, it: 15 } },
        },
        {
          tone: "cool",
          me: "0.71이면 원인은 웃음이 아니라 그 뒤에 오는 결정이겠네요",
          reply: "…정확합니다. 웃음은 신호고 결정이 원인입니다. 그건 제가 못 막습니다.",
          next: "the_reflex",
          effect: { skills: { knowledge: 30, it: 10 } },
        },
        {
          tone: "bold",
          me: "201건째를 세는 사람이 더 이상한데요",
          reply: "…세지 않으면 제가 못 견딥니다. 이건 취미가 아니라 방어입니다.",
          next: "the_reflex",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_reflex",
      intro: [
        "이제 그 웃음소리가 들리면 반사적으로 계산기를 켭니다.",
        "조건반사라는 게 이렇게 만들어지는 겁니다. 10년이면 충분하더군요.",
        "제 인생 계획에 이 직업은 없었습니다. 근데 10년째입니다.",
        "…그만두는 계산도 매년 해봅니다. 매번 결론이 같아서 문제입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "결론이 뭔데요?",
          reply: "…제가 없으면 이 조직 장부가 3일 만에 터집니다. 그게 결론입니다.",
          next: "the_ledger",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그 계산에 본인 손해는 넣었어요?",
          reply: "…안 넣었습니다. 항목이 없더군요. 하루 두고 만들어보겠습니다.",
          next: "the_ledger",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "매년 계산한다는 건 매년 흔들린다는 뜻이고요",
          reply: "…흔들립니다. 흔들리고 남습니다. 하루 정리하고 답하겠습니다.",
          next: "the_ledger",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_ledger",
      intro: [
        "항목을 만들어봤습니다. '제 손해' 칸입니다. 10년치를 넣어봤습니다.",
        "야근 수당 미지급분, 대신 간 출장, 사장님 찾으러 다닌 시간. 다 숫자가 나오더군요.",
        "그런데 아래에 한 칸이 더 생겼습니다. '숫자로 안 나오는 것' 칸입니다.",
        "…그 칸이 훨씬 큽니다. 그래서 매년 결론이 같았던 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 칸에 뭐가 들어가는데요?",
          reply: "…적지 않겠습니다. 적으면 제가 감상적인 사람이 됩니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 30, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "숫자로 안 나오는 걸 칸으로 만든 게 이미 답이에요",
          reply: "…맞습니다. 계산이 안 되는 걸 계산서에 올린 건 처음입니다.",
          next: null,
          effect: { skills: { knowledge: 45, it: 15 } },
        },
        {
          tone: "bold",
          me: "10년치 미지급분은 청구하세요. 그건 숫자로 나오잖아요",
          reply: "…청구서는 이미 세 통 써뒀습니다. 못 낸 이유는 아까 말씀드린 칸 때문이고요.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 안경 쓴 실무 담당 2회차 — 비서가 아닙니다.
 * 축은 **'직급이 아무 의미 없는 회사에서 직급을 신경 쓰는 것'**이다.
 */
const AIDE_STORY_2: DmStory = {
  id: "aide_2",
  partnerName: "안경 쓴 실무 담당",
  partnerHandle: "spectacle_aide",
  arrivalTitle: "안경 쓴 실무 담당의 DM",
  startNode: "not_a_secretary",
  nodes: [
    {
      id: "not_a_secretary",
      intro: [
        "다들 저를 비서로 아십니다. 저는 엄연히 정식 임원입니다.",
        "다만 제가 하는 일이 일정 관리와 서류 정리와 사장님 찾으러 다니기라 그렇게 보이는 겁니다.",
        "이 회사에서 직급은 아무 의미가 없다는 걸 10년째 배우고 있습니다.",
        "…그런데 어제 거래처에서 저를 비서라고 부르는데 처음으로 정정하고 싶었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "정정하세요. 사실이잖아요",
          reply: "…사실입니다. 그런데 정정하면 사장님 체면이 깎입니다. 그게 걸립니다.",
          next: "the_meeting_aide",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "직급이 의미 없으면 왜 신경 쓰여요?",
          reply: "…계약 조건이 달라집니다. 임원이 서명하면 단가가 올라갑니다. 실무 문제입니다.",
          next: "the_meeting_aide",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "10년째 배우고 있다는 건 아직 못 받아들였다는 거죠",
          reply: "…그렇습니다. 하루 정리해서 답하겠습니다.",
          next: "the_meeting_aide",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_meeting_aide",
      intro: [
        "거래처 회의에서 사장님이 먼저 정정하셨습니다. 제가 말하기 전에요.",
        "'이 사람 비서 아니고 임원입니다. 계약은 이 사람이 합니다.' 이렇게요.",
        "그러고는 회의 내내 조용히 앉아 계셨습니다. 그건 처음 보는 광경이었습니다.",
        "…계약은 성사됐습니다. 단가는 제가 원하던 조건으로요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "사장님이 알고 계셨네요",
          reply: "…알고 계셨습니다. 10년 동안 한 번도 안 말씀하셨을 뿐이고요.",
          next: "the_three_times",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "조용히 앉아 있는 게 제일 큰 도움이었을 텐데요",
          reply: "…맞습니다. 그분이 입을 여시면 손해액이 늘어납니다. 통계로 나온 사실입니다.",
          next: "the_three_times",
          effect: { skills: { knowledge: 40, it: 10 } },
        },
        {
          tone: "bold",
          me: "먼저 말해줄 때까지 10년 기다린 건 본인 손해예요",
          reply: "…손해였습니다. 그 칸에 추가해두겠습니다.",
          next: "the_three_times",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_three_times",
      intro: [
        "사장님이 제 이름을 제대로 부르실 때가 일 년에 세 번쯤 됩니다.",
        "세어봤습니다. 정확히는 계약 성사 때, 사고가 났을 때, 그리고 제가 아플 때입니다.",
        "규칙성이 있더군요. 중요한 순간에만 이름을 쓰십니다.",
        "…그러니까 저는 일 년에 세 번 중요한 사람인 겁니다. 나쁘지 않은 비율입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 번이 아니라 늘 중요한 거예요",
          reply: "…그건 데이터로 확인이 안 됩니다. 그래도 기록해두겠습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "규칙성을 찾아낸 게 실무자다워요",
          reply: "…이게 제 일입니다. 사람도 데이터로 보면 편해집니다. 대체로요.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45, it: 15 } },
        },
        {
          tone: "bold",
          me: "아플 때 이름을 부른다는 게 제일 중요한 건데요",
          reply: "…그 항목은 표본이 두 건뿐입니다. 통계로 쓰기엔 부족합니다. …그렇게 해두겠습니다.",
          next: null,
          effect: { mental: 12, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 안경 쓴 실무 담당 3회차 — 안 묻기로 한 것.
 * 축은 **'딱 한 번 실수로 꺼냈던 질문'**이다.
 * ⚠️ 사장의 과거를 밝히지 마라. 이 회차의 결말은 **계속 안 묻기로 정하는 것**이다.
 */
const AIDE_STORY_3: DmStory = {
  id: "aide_3",
  partnerName: "안경 쓴 실무 담당",
  partnerHandle: "spectacle_aide",
  arrivalTitle: "안경 쓴 실무 담당의 DM",
  startNode: "the_question_i_asked",
  nodes: [
    {
      id: "the_question_i_asked",
      intro: [
        "사장님 옛날 얘기는 절대 안 묻습니다. 딱 한 번 실수로 꺼낸 적이 있습니다.",
        "8년 전입니다. 그때 눈빛이 평소랑 완전히 달랐습니다. 그 3초를 아직 기억합니다.",
        "그 뒤로는 아무리 궁금해도 안 묻습니다. 사람마다 안 건드리는 게 나은 부분이 있으니까요.",
        "…그런데 요즘 자꾸 그 3초가 떠오릅니다. 이유는 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "걱정되는 거예요. 8년이면 그럴 만하죠",
          reply: "…걱정. 그 단어는 제 업무 범위 밖입니다. 하루 두고 생각해보겠습니다.",
          next: "the_old_crate",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "떠오르는 건 뭔가 신호가 있었다는 뜻인데요",
          reply: "…최근에 사장님이 선물을 세 개 사 오셨습니다. 받을 사람이 없다면서요.",
          next: "the_old_crate",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "8년 참았으면 이제 물어봐도 되지 않아요?",
          reply: "…안 됩니다. 그건 제가 정한 게 아니라 그분이 정한 선입니다.",
          next: "the_old_crate",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_old_crate",
      intro: [
        "창고를 정리하다가 오래된 상자를 하나 발견했습니다. 사장님 물건입니다.",
        "장부 정리 차원에서 목록을 만들어야 했습니다. 그게 제 업무니까요.",
        "열지 않고 '개인 물품 1점, 미개봉'이라고만 적었습니다.",
        "…10초쯤 그 앞에 서 있었습니다. 열면 8년 치 궁금증이 풀렸을 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 연 게 맞아요",
          reply: "…맞다고 해주시니 다행입니다. 저는 아직도 손이 근질거립니다.",
          next: "what_i_do_instead",
          effect: { mental: 12, morality: 8, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "업무상 열 명분은 충분했는데 안 열었네요",
          reply: "…명분은 있었습니다. 그래서 더 조심했습니다. 명분 있을 때가 제일 위험합니다.",
          next: "what_i_do_instead",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "10초나 서 있었으면 반쯤 연 거예요",
          reply: "…반쯤은 열었습니다. 인정합니다. 그래도 나머지 반은 안 열었습니다.",
          next: "what_i_do_instead",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_i_do_instead",
      intro: [
        "대신 다른 걸 했습니다. 사장님 옛 항로 기록을 정리해서 지도로 만들었습니다.",
        "15년 치 항로입니다. 어디를 몇 번 지나갔는지 다 나옵니다.",
        "특정 구역을 스물세 번 지나가셨더군요. 그 구역엔 거래처가 없습니다.",
        "…이유는 안 묻겠습니다. 다만 다음 항해 일정에 그 구역을 넣어뒀습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 안 묻고 하는 최선이네요",
          reply: "…최선입니다. 제가 할 수 있는 건 일정표를 짜는 것뿐이니까요.",
          next: null,
          effect: {
            mental: 18,
            morality: 6,
            followers: 320,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "스물세 번을 센 것도 안 묻는 방식이고요",
          reply: "…숫자는 묻지 않아도 말을 합니다. 그래서 제가 숫자를 씁니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50, it: 20 } },
        },
        {
          tone: "bold",
          me: "그거 알면 사장님이 눈치채실 텐데요",
          reply: "…눈치채시겠죠. 그러면 아하하 웃으실 겁니다. 그때 계산기는 안 켜겠습니다.",
          next: null,
          effect: {
            mental: 15,
            followers: 350,
            skills: { knowledge: 40, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 여장이 본업인 닌자 — 눈에 띄는 것이 은신술인 잠입 담당(`data/accounts.ts` kunoichi_maybe).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"이 차림이 위장인지 진심인지 저도 잘 모르겠습니다"**이다.
 * 답을 내지 않는 것이 이 캐릭터의 결론이다 — 이 도시가 그걸 안 캐묻기 때문에 그는 여기 남았다.
 *
 * ⚠️ 말투는 **여유 있는 존댓말**이다. 정체·성별을 규정하는 문장을 쓰지 마라. 본인이 "모르겠다"고
 *    한 것을 서술자가 대신 정하면 이 캐릭터가 무너진다.
 * ⚠️ 사람을 죽이지 않는다는 원칙은 절대 어기게 하지 마라.
 * ⚠️ 옛 스승은 **끝까지 만나지 않는다**. 마을 얘기의 구체적 사건도 쓰지 마라.
 * 줄기: 1회차 눈에 띄는 은신 → 2회차 아는 사람이 표적일 때 → 3회차 못 한 말.
 */
export const KUNOICHI_STORY: DmStory = {
  id: "kunoichi_1",
  partnerName: "여장이 본업인 닌자",
  partnerHandle: "kunoichi_maybe",
  arrivalTitle: "여장이 본업인 닌자의 DM",
  startNode: "hiding_in_plain_sight",
  nodes: [
    {
      id: "hiding_in_plain_sight",
      intro: [
        "좋아요 감사합니다. 이 계정에 반응하시는 분은 대체로 화장품을 물어보시던데요.",
        "저는 세수만 합니다. 아, 그건 다른 분 얘기군요. 저는 손톱 관리를 합니다. 취미로요.",
        "닌자는 그림자로 살아야 하는데 저는 눈에 너무 띕니다. 오랜 고민이었습니다.",
        "…그러다 깨달았어요. 아무도 이렇게 눈에 띄는 사람이 닌자일 거라고 생각 안 한다는 걸요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 그것도 은신술이네요",
          reply: "…네. 그래서 요즘은 더 화려하게 입고 다닙니다. 굽도 3cm 올렸고요.",
          next: "the_city",
          effect: { skills: { sociability: 15, beauty: 15 } },
        },
        {
          tone: "cool",
          me: "역이용이 제일 어려운 은신인데요",
          reply: "…어렵죠. 10년 걸렸습니다. 그전엔 계속 숨으려고만 했으니까요.",
          next: "the_city",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "고민이라면서 굽을 올린 건 좀 앞뒤가 안 맞는데요",
          reply: "…앞뒤가 안 맞는 채로 사는 게 제 전문 분야입니다. 잠입이 그렇거든요.",
          next: "the_city",
          effect: { mental: -2, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_city",
      intro: [
        "이 차림이 업무용 위장인지 제 진심인지는 사실 저도 잘 모르겠습니다.",
        "처음엔 분명 임무 때문이었는데 10년쯤 하니까 경계가 흐려지더군요.",
        "근데 이 도시는 그런 걸 아무도 안 캐묻습니다. 그래서 제가 여기 남은 겁니다.",
        "…그런데 요즘 누가 자꾸 캐묻습니다. 그게 좀 곤란합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 답해도 돼요. 그건 그쪽 사정이고요",
          reply: "…안 답해도 되는군요. 그 말을 듣고 싶었나 봅니다. 하루 생각해보겠습니다.",
          next: "the_answer_kunoichi",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "모르겠다고 답하면 돼요. 그게 사실이잖아요",
          reply: "…사실을 말하는 게 답이 되는 경우는 드문데요. 이번엔 될지도 모르겠군요.",
          next: "the_answer_kunoichi",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "곤란한 건 질문이 아니라 답을 알고 싶은 본인 아니에요?",
          reply: "…하루만 시간을 주십시오. 그건 좀 정확했습니다.",
          next: "the_answer_kunoichi",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_answer_kunoichi",
      intro: [
        "그 우산 든 애가 캐물은 거였습니다. '언니는 언니야, 아니야?' 이렇게요.",
        "아이들은 늘 제일 곤란한 걸 묻습니다. 어른들은 안 물어보는 걸요.",
        "그래서 답했습니다. '나도 몰라. 근데 언니라고 불러줘서 고마워.'",
        "…그 애가 '그럼 언니 해'라고 하고는 밥 먹으러 가더군요. 그걸로 끝이었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 제일 좋은 결론이네요",
          reply: "…10년 고민이 밥 먹으러 가는 뒷모습으로 정리됐습니다. 허탈하면서 좋습니다.",
          next: null,
          effect: { mental: 15, skills: { sociability: 30, beauty: 10 } },
        },
        {
          tone: "cool",
          me: "모른다고 답한 게 제일 정확한 정보였고요",
          reply: "…정보 수집이 제 주 업무인데, 제 정보를 제일 늦게 정리했군요.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "아이한테 물어본 걸로 답을 정하면 안 되죠",
          reply: "…정한 게 아니라 안 정해도 된다는 걸 배운 겁니다. 그 차이는 큽니다.",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 여장이 본업인 닌자 2회차 — 아는 사람이 표적일 때.
 * 축은 **"저는 사람을 안 죽입니다"**를 지키는 방법이다.
 * ⚠️ 표적을 죽이지도, 극적으로 구하지도 마라. 그는 **임무 방식을 바꿔서** 빠져나간다.
 */
const KUNOICHI_STORY_2: DmStory = {
  id: "kunoichi_2",
  partnerName: "여장이 본업인 닌자",
  partnerHandle: "kunoichi_maybe",
  arrivalTitle: "여장이 본업인 닌자의 DM",
  startNode: "the_target",
  nodes: [
    {
      id: "the_target",
      intro: [
        "제일 어려운 임무는 아는 사람이 표적일 때입니다. 이번 건이 그렇습니다.",
        "정보 수집 의뢰입니다. 저는 사람을 안 죽입니다. 그건 지켜집니다.",
        "다만 제가 넘기는 정보로 누가 어떻게 되는지는 제 관할이 아닙니다.",
        "…관할이 아니라는 말로 10년을 버텼는데, 이번엔 그게 잘 안 됩니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "거절하는 것도 방법이에요",
          reply: "…거절하면 다른 사람이 갑니다. 그쪽은 죽이는 걸 안 가리고요.",
          next: "what_i_reported",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "정보를 어떻게 쓰는지까지 조건에 넣고 계약하세요",
          reply: "…조건을 다는 건 생각 못 했습니다. 이 업계엔 그런 관행이 없어서요.",
          next: "what_i_reported",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "관할이 아니라는 말로 10년 버텼으면 그게 본인 규칙이죠",
          reply: "…아픈 말입니다. 하룻밤 생각하고 답하겠습니다.",
          next: "what_i_reported",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_reported",
      intro: [
        "보고서를 냈습니다. 사실만 적었습니다. 다만 순서를 바꿨습니다.",
        "그 사람이 매일 어디 있는지는 뒤로 빼고, 그 사람이 갚아야 할 빚 액수를 앞에 뒀습니다.",
        "의뢰인은 돈을 받고 싶었던 겁니다. 사람을 없애고 싶었던 게 아니라요.",
        "…빚 회수 쪽으로 방향이 잡혔습니다. 거짓말은 한 줄도 안 썼습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 정보를 다루는 사람이 할 수 있는 최선이에요",
          reply: "…최선인지는 모르겠습니다. 다만 제가 잘하는 방식이긴 합니다.",
          next: "the_rule_i_keep",
          effect: { mental: 12, morality: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "순서를 바꾼 게 조작인지 편집인지는 아슬아슬한데요",
          reply: "…아슬아슬합니다. 그 선 위에서 사는 게 제 직업이고요.",
          next: "the_rule_i_keep",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 사람은 빚쟁이한테 시달릴 거예요. 그건 괜찮아요?",
          reply: "…안 괜찮습니다. 다만 살아 있습니다. 저는 거기까지만 합니다.",
          next: "the_rule_i_keep",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_rule_i_keep",
      intro: [
        "제 임무 성공률은 백 퍼센트입니다. 자랑해도 되죠.",
        "그 백 퍼센트 안에 사람이 죽은 건은 없습니다. 이건 아무도 안 세줍니다.",
        "그래서 제가 셉니다. 10년치 명단을 따로 갖고 있습니다.",
        "…살아 있는 사람 명단입니다. 이게 제 성적표입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제일 좋은 성적표네요",
          reply: "…그렇게 봐주시는 분이 계시면 계속 셀 이유가 생깁니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그 명단은 아무도 못 봐서 더 정확하겠네요",
          reply: "…아무도 안 보는 기록이 제일 정직합니다. 꾸밀 이유가 없으니까요.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "명단에 못 올라간 사람도 있어요?",
          reply: "…없습니다. 그래서 백 퍼센트라고 쓴 겁니다. 그 이상은 안 말하겠습니다.",
          next: null,
          effect: { mental: -4, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 여장이 본업인 닌자 3회차 — 못 한 말.
 * 축은 **"그분한테 그 말을 직접 못 한 건 아직도 마음에 걸립니다"**이다.
 * ⚠️ 스승과 만나게 하지 마라. 결말은 **말을 전할 방법을 찾는 것**까지다.
 */
const KUNOICHI_STORY_3: DmStory = {
  id: "kunoichi_3",
  partnerName: "여장이 본업인 닌자",
  partnerHandle: "kunoichi_maybe",
  arrivalTitle: "여장이 본업인 닌자의 DM",
  startNode: "the_old_master",
  nodes: [
    {
      id: "the_old_master",
      intro: [
        "옛 스승이 저를 찾고 있다는 소문을 들었습니다. 만날 생각은 없습니다.",
        "저는 사람을 안 죽이겠다고 정하고 마을을 나왔고, 그 결정을 후회한 적이 없습니다.",
        "다만 그분한테 그 말을 직접 못 한 건 아직도 마음에 걸립니다.",
        "…10년이 걸렸는데 아직도 걸린다는 건 앞으로도 걸린다는 뜻이겠죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "만나지 말고 전하면 되잖아요",
          reply: "…전한다. 그 방법은 생각 안 해봤습니다. 하루 궁리해보겠습니다.",
          next: "how_to_send",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "찾는다는 게 잡으러 온다는 뜻은 아닐 수도 있어요",
          reply: "…그럴 수도 있습니다. 그런데 확인하려면 만나야 하죠. 하루 생각하겠습니다.",
          next: "how_to_send",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "10년 걸린 건 후회가 아니라 그리움 아니에요?",
          reply: "…그 단어는 안 쓰기로 했습니다. 하룻밤만 주십시오.",
          next: "how_to_send",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "how_to_send",
      intro: [
        "방법을 찾았습니다. 옛 동료들이 다 산으로 들어갔다고 했죠. 그중 하나는 아직 연락이 됩니다.",
        "그 사람에게 한 줄만 전해달라고 했습니다. 만나지는 않는 조건으로요.",
        "'사람을 안 죽이기로 하고 나왔습니다. 후회는 없습니다.' 이 두 문장입니다.",
        "…10년 걸려서 두 문장입니다. 효율이 나쁘군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 문장이면 충분해요. 다 들어 있잖아요",
          reply: "…들어 있습니까. 그럼 됐습니다. 더 쓰면 변명이 됐을 겁니다.",
          next: "the_reply",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "만나지 않는 조건을 단 게 제일 잘한 거예요",
          reply: "…조건은 제 전문입니다. 지난번에 배운 걸 써먹었습니다.",
          next: "the_reply",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "답장이 오면 어떻게 하실 건데요",
          reply: "…그건 안 정했습니다. 오면 그때 생각하겠습니다. 안 올 수도 있고요.",
          next: "the_reply",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_reply",
      intro: [
        "답이 왔습니다. 한 줄이었습니다. '알고 있었다.'",
        "그게 전부입니다. 그 이상은 없었고 만나자는 말도 없었습니다.",
        "…10년 동안 제가 뭘 걱정했는지 모르겠습니다. 알고 계셨다는데요.",
        "오늘은 굽을 안 신고 나갔습니다. 이유는 없습니다. 그냥 발이 가벼웠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "알고 있었다는 건 인정한다는 뜻이에요",
          reply: "…인정. 그렇게 읽어도 되는 거군요. 오늘은 그렇게 읽겠습니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, beauty: 15 },
          },
        },
        {
          tone: "cool",
          me: "만나자고 안 한 것도 배려예요",
          reply: "…그분도 저처럼 조건을 다는 분이었군요. 이제 알겠습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "굽 안 신은 게 오늘의 진짜 소식인데요",
          reply: "…그건 그냥 발이 아파서입니다. …라고 해두겠습니다. 눈치가 빠르시군요.",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { beauty: 25, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 전직 변호인 — 이기는 법은 알겠는데 옳은 법을 모르겠어서 그만둔 사람(`data/accounts.ts` ex_counsel).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"무죄를 받아낸 밤보다 유죄를 받아든 밤에 잠을 더 잘 잤습니다"**이다.
 *
 * ⚠️ 말투는 **건조한 존댓말**이다. 감정어를 거의 안 쓰고, 대신 **사실을 나열해서** 감정을 전한다.
 * ⚠️ 실제 법조문·판례·기관명을 만들지 마라. "법정"·"판결"·"의뢰인"까지만 쓴다.
 * ⚠️ 사건을 구체적으로 특정하지 마라(피해자·죄명·연도 금지). "그 사건"으로만 부른다.
 * ⚠️ 그를 법정으로 돌려보내지 마라. 결말은 지금 하는 일을 계속하는 것이다.
 * 줄기: 1회차 왜 그만뒀나 → 2회차 이겼는데 아무도 안 기뻐한 재판 → 3회차 안주머니의 명함.
 */
export const COUNSEL_STORY: DmStory = {
  id: "counsel_1",
  partnerName: "전직 변호인",
  partnerHandle: "ex_counsel",
  arrivalTitle: "전직 변호인의 DM",
  startNode: "why_i_quit",
  nodes: [
    {
      id: "why_i_quit",
      intro: [
        "제 글을 퍼가셨더군요. 이 계정은 재미가 없어서 그런 일이 드뭅니다.",
        "변호사를 그만둔 이유를 자주 묻습니다. 답은 늘 같습니다.",
        "이기는 법은 알겠는데 옳은 법을 모르겠더군요. 그게 전부입니다.",
        "…그런데 이 답을 10년째 하고 있으면서도 매번 짧게 끝냅니다. 그건 좀 이상하죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "짧게 끝내는 게 더 긴 얘기라는 뜻이겠죠",
          reply: "…그렇습니다. 길게 말하면 변명이 되고, 변명은 제가 제일 잘하던 겁니다.",
          next: "the_sleep",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "이기는 법을 아는 사람이 그만두는 건 드문데요",
          reply: "…재능이 있었습니다. 형량을 깎는 일에요. 그게 자랑인지는 아직 모르겠습니다.",
          next: "the_sleep",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "옳은 법은 원래 아무도 모르는데요",
          reply: "…그러면 다들 어떻게 계속하는 겁니까. 그게 제 질문이었습니다.",
          next: "the_sleep",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_sleep",
      intro: [
        "무죄를 받아낸 밤보다 유죄를 받아든 밤에 잠을 더 잘 잤습니다.",
        "이걸 알아챈 게 그만두기 반년 전입니다. 통계도 냈습니다. 정확했습니다.",
        "제 직업은 무죄를 받아내는 겁니다. 그런데 성공한 밤에 못 자면 그건 문제죠.",
        "…이 얘긴 아무한테도 안 했습니다. 처음 쓰는 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "몸이 먼저 답을 알고 있었네요",
          reply: "…몸이라. 저는 그걸 데이터로 확인하고서야 믿었습니다. 하루 생각해보겠습니다.",
          next: "the_verdict",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그건 실력 문제가 아니라 자리 문제예요",
          reply: "…자리를 옮기라는 말씀이군요. 실제로 옮겼습니다. 결과는 내일 말씀드리죠.",
          next: "the_verdict",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "잘 잔 밤이 옳았다는 뜻은 아니에요",
          reply: "…맞습니다. 그것도 검토했습니다. 하루 두고 답하겠습니다.",
          next: "the_verdict",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_verdict",
      intro: [
        "요즘은 변호 대신 남의 사정을 듣고 값을 매기는 일을 합니다.",
        "예전과 크게 다르진 않습니다. 다만 이제 제가 이기려고 듣지는 않습니다.",
        "질문 하나로 사람이 무너지는 걸 여러 번 봤습니다. 그래서 질문을 아낍니다.",
        "…아끼는 게 실력이 될 줄은 몰랐습니다. 법정에선 정반대였거든요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 무너뜨리는 것도 기술이에요",
          reply: "…기술로 쳐주시는군요. 그럼 저는 아직 직업이 있는 셈입니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 30, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "이기려고 안 듣는 게 그만둔 이유의 답이네요",
          reply: "…10년 만에 답이 정리됐습니다. 짧게 끝낼 이유가 하나 줄었군요.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "값을 매기는 것도 판단이에요. 도망 못 쳤네요",
          reply: "…도망친 적 없습니다. 자리만 옮겼습니다. 그건 정정하겠습니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 전직 변호인 2회차 — 아무도 안 기뻐한 재판.
 * 축은 **"이겼는데 아무도 안 기뻐하는 재판이 있습니다"**이다.
 * ⚠️ 사건 내용을 밝히지 마라. 그가 말하는 건 복도와 몇 초짜리 마주침뿐이다.
 */
const COUNSEL_STORY_2: DmStory = {
  id: "counsel_2",
  partnerName: "전직 변호인",
  partnerHandle: "ex_counsel",
  arrivalTitle: "전직 변호인의 DM",
  startNode: "the_won_case",
  nodes: [
    {
      id: "the_won_case",
      intro: [
        "이겼는데 아무도 안 기뻐하는 재판이 있습니다. 그게 제일 오래 남습니다.",
        "그날 제 의뢰인은 무죄로 나갔고, 복도에서 유족과 마주쳤습니다.",
        "몇 초였습니다. 몇 초인데 그 시간이 제일 깁니다. 아직도 그렇습니다.",
        "…잠이 안 오는 밤엔 그 사건 기록을 다시 읽습니다. 나쁜 습관인 건 압니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다시 읽어서 뭐가 달라지던가요",
          reply: "…아무것도요. 그런데 안 읽으면 잊을까 봐 읽습니다. 하루 생각해보겠습니다.",
          next: "what_i_look_for",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "기록에서 뭘 찾고 있는지가 중요할 텐데요",
          reply: "…제가 놓친 걸 찾습니다. 없다는 걸 알면서요. 하루 두고 답하겠습니다.",
          next: "what_i_look_for",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그건 반성이 아니라 벌 주는 거예요",
          reply: "…구분이 안 됩니다. 10년째요. 내일 답하겠습니다.",
          next: "what_i_look_for",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_look_for",
      intro: [
        "찾고 있던 게 뭔지 정리해봤습니다. 증거가 아니었습니다.",
        "제가 그 재판에서 이긴 방식이 옳았는지를 찾고 있었습니다. 기록엔 그게 안 적힙니다.",
        "재판은 증거가 있는 쪽을 밝힙니다. 진실을 밝히는 게 아니라요.",
        "…그러니까 기록에 없는 걸 10년 동안 기록에서 찾고 있었던 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 이제 안 읽어도 되겠네요",
          reply: "…읽는 건 계속할 것 같습니다. 다만 이제 뭘 못 찾는지는 압니다.",
          next: "the_seconds",
          effect: { mental: 10, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "그건 기록이 아니라 유족한테 물어야 하는 거고요",
          reply: "…물을 수 없습니다. 그건 제 관할이 아닙니다. 그래서 기록을 봤던 거고요.",
          next: "the_seconds",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "옳았는지 묻는 건 이미 답을 안다는 뜻이에요",
          reply: "…압니다. 아는 걸 확인하려고 10년을 썼습니다. 비효율적이죠.",
          next: "the_seconds",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_seconds",
      intro: [
        "어제 그 복도에서 마주쳤던 분을 우연히 다시 봤습니다. 시장에서요.",
        "저를 못 알아보시더군요. 변호인 얼굴은 아무도 기억 안 합니다. 그건 다행입니다.",
        "장을 보고 계셨습니다. 그냥 평범하게요. 그걸 보고 좀 서 있었습니다.",
        "…판결은 끝이 아니라 시작이더군요. 다들 그다음을 살아야 하니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그분도 그다음을 살고 계신 거네요",
          reply: "…살고 계셨습니다. 그걸 확인한 게 기록 10년치보다 나았습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "못 알아본 게 다행이라는 말은 진심이에요?",
          reply: "…반은 진심입니다. 나머지 반은 알아봐 주기를 바랐습니다. 그건 제 욕심이고요.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "인사했어야죠. 몇 초면 됐을 텐데요",
          reply: "…안 했습니다. 제 몇 초를 편하자고 그분 하루를 흔들 수는 없습니다.",
          next: null,
          effect: { mental: -4, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 전직 변호인 3회차 — 안주머니의 명함.
 * 축은 **"이제 줄 일은 별로 없지만"**이다.
 * ⚠️ 그를 복직시키지 마라. 명함은 한 장만 나간다.
 */
const COUNSEL_STORY_3: DmStory = {
  id: "counsel_3",
  partnerName: "전직 변호인",
  partnerHandle: "ex_counsel",
  arrivalTitle: "전직 변호인의 DM",
  startNode: "the_card",
  nodes: [
    {
      id: "the_card",
      intro: [
        "안주머니에 아직 명함이 있습니다. 이제 줄 일은 별로 없지만요.",
        "10년 전 것이라 적힌 사무실은 없어졌습니다. 전화번호만 아직 씁니다.",
        "왜 안 버리냐고 물으시면 답을 못 하겠습니다. 무겁지도 않고요.",
        "…어제 무료 상담을 해달라는 분이 오셨습니다. 저는 무료 상담은 안 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그래서 안 해주셨어요?",
          reply: "…거절했습니다. 그런데 그분이 안 가시더군요. 하루 두고 얘기하겠습니다.",
          next: "the_free_one",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "공짜로 들은 조언은 안 지킨다면서요. 그 원칙 아직 유효해요?",
          reply: "…유효합니다. 다만 그 원칙을 만든 이유는 좀 다릅니다. 내일 쓰겠습니다.",
          next: "the_free_one",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "명함을 안 버린 사람이 상담을 거절하는 건 앞뒤가 안 맞는데요",
          reply: "…안 맞습니다. 하룻밤 생각해보겠습니다.",
          next: "the_free_one",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_free_one",
      intro: [
        "그분은 세 시간을 앉아 계셨습니다. 저는 서류를 봤고 그분은 그냥 앉아 계셨고요.",
        "세 시간째에 제가 물었습니다. '무엇을 물어보려고 오셨습니까.'",
        "그랬더니 '아무것도요. 그냥 얘기할 데가 없어서요'라고 하시더군요.",
        "…판결이 아니라 누군가 끝까지 들어주기만 하면 됐던 사건도 있었습니다. 그게 떠올랐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 들어주셨겠네요",
          reply: "…두 시간 더 들었습니다. 상담이 아니라 그냥 들은 겁니다. 그건 무료로 해도 됩니다.",
          next: "one_card_left",
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그건 상담이 아니니까 원칙 위반도 아니고요",
          reply: "…정확합니다. 저는 조언을 안 했습니다. 한 마디도요.",
          next: "one_card_left",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "세 시간을 서류만 보면서 앉혀둔 건 좀 잔인한데요",
          reply: "…쫓아내지 않은 게 제 방식이었습니다. 변명은 아닙니다. 설명입니다.",
          next: "one_card_left",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "one_card_left",
      intro: [
        "가시면서 그분이 물으셨습니다. '다음에 또 와도 됩니까.'",
        "그래서 안주머니에서 명함을 꺼내 드렸습니다. 10년 만에 한 장 나갔습니다.",
        "전화번호만 유효하다고 말씀드렸고, 그분은 그걸 지갑에 넣으셨습니다.",
        "…이제 안주머니가 조금 가벼워졌습니다. 무겁지도 않던 게 말입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 명함은 10년 기다린 값을 했네요",
          reply: "…값을 했습니다. 그럼 안 버린 게 맞았던 겁니다. 오늘은 그렇게 정리하겠습니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "가벼워졌다는 건 안 버린 이유를 이제 안다는 뜻이고요",
          reply: "…알겠습니다. 줄 사람이 생길 때까지 갖고 있었던 겁니다. 단순하군요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "한 장 줬으면 나머지도 쓰세요. 아직 많잖아요",
          reply: "…한 통 남았습니다. 다 쓰려면 오래 걸리겠군요. 그건 나쁘지 않습니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 40, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 번개 짐승 — 옛날 얘기를 잘 안 하는 심부름집 소속(`data/accounts.ts` thunder_beast).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다(파트너 뱀눈 탈환사는 리트윗 — 동사를 갈라 뒀다).
 *
 * 축은 **"배고픈 건 참을 수 있는데 외로운 건 잘 못 참겠더라고요"**이다.
 *
 * ⚠️ 말투는 **순한 존댓말**이다("~어요/~죠"). 그를 위압적으로 쓰지 마라 — 힘은 세지만 말은 부드럽다.
 * ⚠️ 화를 폭발시키지 마라. 화가 나면 주변이 다치기 때문에 그는 안 낸다. 그 절제가 캐릭터다.
 * ⚠️ 성에서 왕 노릇 하던 시절은 "재미없는 얘기"로만 다룬다. 무용담으로 쓰지 마라.
 * ⚠️ 파트너(snake_eye_get)는 "제 파트너"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 별일 없는 게 좋다 → 2회차 화를 못 내는 것 → 3회차 옛 동료들.
 */
export const THUNDER_STORY: DmStory = {
  id: "thunder_1",
  partnerName: "번개 짐승",
  partnerHandle: "thunder_beast",
  arrivalTitle: "번개 짐승의 DM",
  startNode: "nothing_happened",
  nodes: [
    {
      id: "nothing_happened",
      intro: [
        "좋아요 눌러주셔서 감사해요. 제 글은 별 내용이 없어서 놀랐어요",
        "오늘도 별일 없었어요. 별일이 없는 게 제일 좋죠",
        "아, 하나 있었네요. 고양이가 저를 안 무서워하더라고요. 오늘의 큰 사건입니다",
        "…무섭다는 소리 들으면 좀 슬퍼요. 그래도 어쩔 수 없죠",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고양이가 알아본 거예요. 그거 정확해요",
          reply: "…그런가요. 그럼 저 오늘 좀 자랑해도 되겠네요",
          next: "the_decision",
          effect: { mental: 5, skills: { sociability: 15 } },
        },
        {
          tone: "cool",
          me: "어쩔 수 없다고 하면서 슬프다고 쓰셨네요",
          reply: "…아. 그러네요. 저 그런 말 잘 안 쓰는데. 이상하네요",
          next: "the_decision",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "무섭게 생긴 건 사실이잖아요",
          reply: "…사실이죠. 그래서 부정은 안 해요. 그냥 슬프다고만 했어요",
          next: "the_decision",
          effect: { mental: -3, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "the_decision",
      intro: [
        "저는 결정을 잘 못해요. 그래서 옆에서 정해주는 사람이 있으면 편해요",
        "제 파트너가 그걸 다 해줘요. 저는 몸 쓰는 일만 하고요",
        "근데 오늘 그 사람이 저한테 정하라고 하더라고요. 의뢰를 받을지 말지",
        "…30분 동안 아무 말도 못 했어요. 이게 이렇게 어려운 건 줄 몰랐어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "30분 고민한 것도 정하는 거예요",
          reply: "…그것도 정하는 거예요? 그럼 저 오늘 뭔가 한 거네요",
          next: "what_i_chose",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "정하라고 한 건 믿는다는 뜻이에요",
          reply: "…믿어서 그런 거였구나. 저는 귀찮아서 그런 줄 알았어요",
          next: "what_i_chose",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "못 정하는 게 아니라 안 정해본 거예요",
          reply: "…안 정해봤죠. 예전엔 제가 다 정했는데. 그건 재미없는 얘기라서요",
          next: "what_i_chose",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_chose",
      intro: [
        "정했어요. 받는 걸로요. 이유는 의뢰인이 밥을 못 먹고 있어서요",
        "그 사람한테 말했더니 '그게 이유냐'고 웃더라고요. 근데 안 반대했어요",
        "의뢰는 잘 끝났어요. 돈은 거의 못 받았고요. 예상했던 대로예요",
        "…그래도 그 사람이 밥 먹는 걸 봤어요. 그거면 됐어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋은 이유였어요. 그거면 충분해요",
          reply: "…충분하다니 다행이에요. 저는 이유가 약한 줄 알았어요",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "돈 못 받을 걸 알고 정한 거면 그건 결정력이에요",
          reply: "…그런 건가요. 저는 계산을 안 한 건 줄 알았는데",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그렇게 정하면 파트너가 손해예요",
          reply: "…그건 좀 미안해요. 그래서 다음 의뢰는 그 사람 마음대로 하라고 했어요",
          next: null,
          effect: { mental: -3, followers: 150, skills: { knowledge: 25, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 번개 짐승 2회차 — 화를 못 내는 것.
 * 축은 **"화가 나면 손끝에서 불꽃이 튀어서 주변이 다칩니다"**이다.
 * ⚠️ 그가 폭발해서 사고가 나는 전개를 쓰지 마라. 화는 끝까지 안 난다 — 대신 다른 데로 나간다.
 */
const THUNDER_STORY_2: DmStory = {
  id: "thunder_2",
  partnerName: "번개 짐승",
  partnerHandle: "thunder_beast",
  arrivalTitle: "번개 짐승의 DM",
  startNode: "not_getting_angry",
  nodes: [
    {
      id: "not_getting_angry",
      intro: [
        "어제 화가 날 뻔했어요. 누가 제 파트너를 심하게 말했거든요",
        "화가 나면 손끝에서 불꽃이 튀어서 주변이 다쳐요. 그래서 웬만하면 안 냅니다",
        "그래서 손을 주머니에 넣고 열까지 셌어요. 스무까지 셌어요",
        "…근데 그게 화를 참은 건지 그냥 삼킨 건지 모르겠어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "삼킨 거예요. 그건 어디로도 안 가요",
          reply: "…어디로도 안 가면 어떡하죠. 하루 생각해볼게요",
          next: "where_it_goes",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "스물까지 센 건 참은 거예요. 그건 기술이고요",
          reply: "…기술이라고 하면 좀 낫네요. 근데 스물 다음이 없어서 문제예요",
          next: "where_it_goes",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그 사람 앞에서 화내도 됐어요. 파트너 얘기였잖아요",
          reply: "…화내면 주변이 다쳐요. 그 사람도 포함해서요. 그건 안 돼요",
          next: "where_it_goes",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "where_it_goes",
      intro: [
        "제 파트너한테 말했어요. 어제 화가 날 뻔했다고요",
        "그랬더니 '왜 안 냈냐'고 묻더라고요. 다치니까 안 냈다고 했죠",
        "그랬더니 '그럼 나한테 내라'고 하더라고요. 자기는 안 다친다고요",
        "…그래서 어제 하루 종일 그 사람한테 투덜거렸어요. 처음이었어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 화를 내는 방법이에요",
          reply: "…투덜거리는 게요? 그럼 저 앞으로 자주 할래요",
          next: "the_strength",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "안 다친다는 말은 받아주겠다는 뜻이에요",
          reply: "…받아주는 거였구나. 저는 진짜로 안 다칠 자신이 있는 줄 알았어요",
          next: "the_strength",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 사람도 다칠 수 있어요. 조심하세요",
          reply: "…알아요. 그래서 손은 계속 주머니에 넣고 말만 했어요. 그건 지켰어요",
          next: "the_strength",
          effect: { mental: -3, skills: { knowledge: 35, fitness: 10 } },
        },
      ],
    },
    {
      id: "the_strength",
      intro: [
        "누가 저더러 세다고 하는데, 센 거랑 이기는 건 다르더라고요",
        "예전엔 제가 앞에 서야 했어요. 지금은 뒤에 있어도 돼서 좋아요",
        "지키고 싶은 게 생기면 사람이 좀 강해지는 것 같아요",
        "…이건 확실해요. 배고픈 건 참을 수 있는데 외로운 건 잘 못 참겠더라고요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 참을 필요 없어요. 옆에 사람 있잖아요",
          reply: "…있죠. 그래서 요즘 안 외로워요. 이 얘기 하려고 오늘 썼나 봐요",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "뒤에 있어도 되는 게 제일 큰 변화네요",
          reply: "…앞에 있을 땐 아무도 없었거든요. 그게 차이인 것 같아요",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "외로운 걸 못 참는 사람이 옛 동료들한테 연락은 안 하네요",
          reply: "…그건 다음에 얘기할게요. 오늘은 여기까지 할래요",
          next: null,
          effect: { mental: -6, followers: 220, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 번개 짐승 3회차 — 옛 동료들.
 * 축은 **"잘 지내는지 가끔 궁금해요. 연락은 안 합니다"**이다.
 * ⚠️ 재회 장면을 쓰지 마라. 결말은 안부를 **전해 듣는 것**까지다.
 */
const THUNDER_STORY_3: DmStory = {
  id: "thunder_3",
  partnerName: "번개 짐승",
  partnerHandle: "thunder_beast",
  arrivalTitle: "번개 짐승의 DM",
  startNode: "old_friends_thunder",
  nodes: [
    {
      id: "old_friends_thunder",
      intro: [
        "옛 동료들 잘 지내는지 가끔 궁금해요. 연락은 안 합니다",
        "그 폐허 같은 성에서 왕 노릇 하던 시절 얘기는 잘 안 해요. 재미없는 얘기라서요",
        "재미없다는 게 무슨 뜻이냐면요, 그때 저는 앞에 서 있었고 다들 뒤에 있었어요",
        "…그러다 성이 무너졌고 다들 흩어졌어요. 그게 다예요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 재미없는 게 아니라 아픈 얘기죠",
          reply: "…아픈 거였나. 저는 그냥 재미없다고 정해놨어요. 하루 생각해볼게요",
          next: "the_news",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "연락을 안 하는 이유가 뭔데요",
          reply: "…제가 연락하면 그때 얘기가 되니까요. 다들 지금을 살고 있을 텐데요",
          next: "the_news",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "왕이 도망친 걸로 정리해둔 거잖아요",
          reply: "…그렇게 들리면 그런 거겠죠. 하루만 생각해볼게요",
          next: "the_news",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_news",
      intro: [
        "제 파트너가 어제 소식을 하나 갖고 왔어요. 일부러 알아본 것 같았어요",
        "옛 동료 중 하나가 지금 요리사래요. 국숫집을 한대요",
        "실 다루던 그 사람은 아직도 실을 다닌다고 하고요. 다들 살아 있대요",
        "…그 얘길 듣고 밥을 세 그릇 먹었어요. 왜 그랬는지는 모르겠어요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안심해서 그런 거예요",
          reply: "…안심. 그거 맞는 것 같아요. 배가 갑자기 고팠거든요",
          next: "someday",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "파트너가 왜 알아봤을까요",
          reply: "…제가 안 물어볼 걸 아니까요. 그 사람은 그런 걸 잘해요",
          next: "someday",
          effect: { mental: 10, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 국숫집 가보세요. 손님으로요",
          reply: "…손님으로요. 그건 생각 못 했어요. 그럼 옛날 얘기 안 해도 되겠네요",
          next: "someday",
          effect: { mental: 8, skills: { knowledge: 35, sociability: 20 } },
        },
      ],
    },
    {
      id: "someday",
      intro: [
        "국숫집 위치는 안 물어봤어요. 아직은요",
        "대신 제 파트너한테 말했어요. 언젠가 같이 가자고요",
        "그 사람이 '돈은 네가 내라'고 하더라고요. 그거 이미 승낙이잖아요",
        "…오늘도 별일 없었어요. 근데 요즘은 별일 없는 게 예전이랑 좀 다르게 느껴져요",
      ],
      choices: [
        {
          tone: "friendly",
          me: "돌아갈 데가 생기면 그렇게 돼요",
          reply: "…돌아갈 데. 저 그거 없다고 생각했는데 있었나 봐요",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 10 },
          },
        },
        {
          tone: "cool",
          me: "언젠가라고 하면 안 가요. 날짜를 정하세요",
          reply: "…날짜요. 그럼 다음 달 첫째 주로 할게요. 지금 적었어요",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "돈 낼 돈은 있어요?",
          reply: "…없어요. 그래서 다음 의뢰는 돈 받는 걸로 정할게요. 제가 정할게요",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { knowledge: 30, sociability: 25, fitness: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 실을 다루는 사람 — 실 한 가닥으로 대부분을 해내는 사람(`data/accounts.ts` silk_strings).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"실은 끊어지기 직전이 가장 팽팽합니다. 사람도 비슷하더군요"**이다.
 *
 * ⚠️ 말투는 **단정한 존댓말**이다. 우아하되 자기를 우아하다고 말하지 않는다("실상은 그렇지 않거든요").
 * ⚠️ 성별을 소재로 놀리지 마라. 본인이 이미 정정을 끝낸 사안이고, 그는 그 질문에 지쳐 있다.
 * ⚠️ 옛 친구들 얘기는 **아껴두는 좋은 기억**으로만 다룬다(번개 짐승과 같은 성 출신이지만
 *    그쪽 회차 진행을 전제하지 마라). 상대를 "그 큰 친구"로만 부른다.
 * 줄기: 1회차 팽팽한 실 → 2회차 동료를 건드린 사람 → 3회차 약속.
 */
export const SILK_STORY: DmStory = {
  id: "silk_1",
  partnerName: "실을 다루는 사람",
  partnerHandle: "silk_strings",
  arrivalTitle: "실을 다루는 사람의 DM",
  startNode: "the_taut_thread",
  nodes: [
    {
      id: "the_taut_thread",
      intro: [
        "제 글을 퍼가주셨군요. 감사합니다.",
        "미리 말씀드리면 저는 남자입니다. 이 계정에서 제일 많이 받는 질문이라 먼저 적습니다.",
        "실은 끊어지기 직전이 가장 팽팽합니다. 사람도 비슷하더군요.",
        "…요즘 그 팽팽한 사람이 옆에 하나 있습니다. 어떻게 해야 할지 모르겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "실이면 어떻게 하세요? 그대로 하면 돼요",
          reply: "…실이면 손을 놓습니다. 당기면 끊어지니까요. 사람도 같습니까.",
          next: "the_breath",
          effect: { skills: { sociability: 15, beauty: 10 } },
        },
        {
          tone: "cool",
          me: "팽팽한 걸 알아채는 사람이 옆에 있는 게 이미 도움이에요",
          reply: "…알아채기만 하고 아무것도 안 하는 건데도 말입니까.",
          next: "the_breath",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "끊어지기 직전이면 이미 늦은 거 아니에요?",
          reply: "…늦었다고 생각하면 손을 못 댑니다. 그래서 안 늦었다고 치고 있습니다.",
          next: "the_breath",
          effect: { mental: -3, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_breath",
      intro: [
        "바늘을 다루려면 손보다 호흡이 중요합니다. 이건 제 일의 기본입니다.",
        "호흡이 흔들리면 손이 아니라 실이 먼저 압니다. 실은 정직하거든요.",
        "그 사람도 마찬가지입니다. 말은 괜찮다고 하는데 밥을 안 먹습니다.",
        "…동료가 밥을 굶으면 제가 다 압니다. 표정이 정직하거든요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "밥을 차려주세요. 말은 나중에 하고요",
          reply: "…차려주는 건 할 수 있습니다. 다만 제 요리는 실보다 못합니다.",
          next: "what_i_cooked",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "괜찮다는 말을 믿어주는 것도 방법이에요. 지켜보면서요",
          reply: "…믿는 척하면서 본다. 그건 제가 잘합니다. 하루 해보겠습니다.",
          next: "what_i_cooked",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다 안다면서 아무 말도 안 하는 건 방관이에요",
          reply: "…아픈 말씀입니다. 하루 두고 생각해보겠습니다.",
          next: "what_i_cooked",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "what_i_cooked",
      intro: [
        "요리를 했습니다. 실 한 가닥으로 못 하는 일은 별로 없는데 요리는 예외입니다.",
        "그래서 국수만 삶았습니다. 그건 실과 비슷해서 자신이 있었습니다.",
        "그 사람이 두 그릇을 먹었습니다. 먹으면서 아무 말도 안 했고요.",
        "…다 먹고 나서 '내일도 삶아줘'라고 했습니다. 그게 답이었던 것 같습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 답 맞아요. 내일도 삶으세요",
          reply: "…삶겠습니다. 실보다 쉽지는 않지만 할 만합니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "국수가 실과 비슷하다는 건 좀 웃긴데요",
          reply: "…굵기와 삶는 시간의 관계가 실의 장력 계산과 같습니다. 진지하게 하는 말입니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "말을 안 한 게 아니라 못 한 거였겠죠",
          reply: "…그럴 겁니다. 그래서 저도 안 물었습니다. 물으면 끊어집니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 실을 다루는 사람 2회차 — 동료를 건드린 사람.
 * 축은 **"동료를 건드리는 사람에게는 예의를 차리지 않습니다"**이다.
 * ⚠️ 유혈이나 보복을 묘사하지 마라. 그는 **짧게 끝내는 것이 예의**라고 믿는 인물이다.
 */
const SILK_STORY_2: DmStory = {
  id: "silk_2",
  partnerName: "실을 다루는 사람",
  partnerHandle: "silk_strings",
  arrivalTitle: "실을 다루는 사람의 DM",
  startNode: "someone_touched",
  nodes: [
    {
      id: "someone_touched",
      intro: [
        "어제 누가 제 동료를 건드렸습니다. 말로요. 아주 심한 말이었습니다.",
        "저는 조용한 편입니다. 화가 나면 목소리가 더 작아집니다.",
        "어제 제 목소리가 거의 안 들릴 정도였다고 하더군요.",
        "…그래서 오늘은 머리를 높게 묶었습니다. 그날 각오를 그렇게 정합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "높게 묶는 날은 어떤 날이에요?",
          reply: "…물러서지 않기로 한 날입니다. 오늘이 그런 날이고요.",
          next: "how_it_ended",
          delayDays: 1,
          effect: { skills: { sociability: 20, beauty: 15 } },
        },
        {
          tone: "cool",
          me: "말로 건드린 거면 말로 끝내는 게 맞고요",
          reply: "…맞습니다. 다만 제 말은 짧습니다. 짧은 게 제 예의라서요.",
          next: "how_it_ended",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "지킬 게 있는 사람은 함부로 안 싸운다면서요",
          reply: "…제가 쓴 문장이군요. 하루 두고 그 문장을 다시 보겠습니다.",
          next: "how_it_ended",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "how_it_ended",
      intro: [
        "찾아갔습니다. 손은 안 썼습니다. 실도 안 꺼냈고요.",
        "'그 사람 얘기는 앞으로 하지 마십시오.' 한 문장만 했습니다.",
        "그쪽이 웃길래 한 번 더 말했습니다. 같은 문장을 더 작게요.",
        "…그러니까 사과하더군요. 싸움은 짧게 끝내는 게 예의입니다. 서로에게요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "손 안 쓴 게 제일 세게 한 거예요",
          reply: "…그렇게 봐주시면 다행입니다. 저는 늘 이 방식이 약해 보일까 걱정합니다.",
          next: "why_quiet",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "같은 말을 더 작게 한 게 결정타네요",
          reply: "…목소리가 작아지면 다들 알아챕니다. 이유는 저도 모르겠습니다.",
          next: "why_quiet",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "사과받았다고 끝난 건 아닐 텐데요",
          reply: "…끝났습니다. 더 하면 제가 그 사람을 건드리는 게 됩니다. 선은 지켜야죠.",
          next: "why_quiet",
          effect: { mental: -3, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "why_quiet",
      intro: [
        "누구를 미워하는 일에는 재능이 없습니다. 다행이라고 생각합니다.",
        "옷깃 하나 흐트러진 채로 싸운 날은 이겨도 진 기분입니다.",
        "그래서 어제도 옷깃을 먼저 정리하고 갔습니다. 우스운 습관이죠.",
        "…아름다움은 취향이 아니라 태도라고 생각합니다. 이건 제 유일한 신념입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 태도가 어제 이긴 거예요",
          reply: "…이겼다기보다 지키고 온 겁니다. 그 표현이 더 맞습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30, beauty: 20 } },
        },
        {
          tone: "cool",
          me: "우스운 습관이 아니라 그게 준비운동이고요",
          reply: "…준비운동. 그렇게 부르니 덜 민망하군요. 빌려 쓰겠습니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 40, beauty: 15 } },
        },
        {
          tone: "bold",
          me: "미워할 재능이 없는 게 아니라 안 쓰는 거예요",
          reply: "…쓰면 편해지는 날이 있긴 합니다. 그날은 안 쓰기로 이미 정했고요.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 실을 다루는 사람 3회차 — 약속.
 * 축은 **"약속을 지키는 사람이 되고 싶었습니다. 아직 노력 중입니다"**이다.
 * ⚠️ 옛 친구들과 재회시키지 마라. 결말은 그 성에 **혼자 다녀오는 것**이다.
 */
const SILK_STORY_3: DmStory = {
  id: "silk_3",
  partnerName: "실을 다루는 사람",
  partnerHandle: "silk_strings",
  arrivalTitle: "실을 다루는 사람의 DM",
  startNode: "the_promise_silk",
  nodes: [
    {
      id: "the_promise_silk",
      intro: [
        "약속을 지키는 사람이 되고 싶었습니다. 아직 노력 중입니다.",
        "옛날에 그 성에서 함께 싸우던 친구들과 한 약속이 하나 있습니다.",
        "'다 끝나면 꼭대기에서 차를 마시자.' 그런 종류의 약속이었습니다.",
        "…성은 무너졌고 다들 흩어졌습니다. 그러면 그 약속은 어떻게 되는 겁니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 없어져요. 미뤄진 거죠",
          reply: "…미뤄졌다. 그렇게 부르면 아직 살아 있는 약속이 되는군요.",
          next: "the_visit",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "약속은 사람하고 한 거지 장소하고 한 게 아니잖아요",
          reply: "…장소를 붙인 건 저였습니다. 그건 제 사정이었군요. 하루 생각하겠습니다.",
          next: "the_visit",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "혼자라도 가서 마시면 되잖아요",
          reply: "…혼자요. 그건 약속을 지킨 게 아니라 흉내내는 것 아닙니까. 하루 주십시오.",
          next: "the_visit",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_visit",
      intro: [
        "다녀왔습니다. 그 버려진 성 꼭대기에요. 밤바람은 여전했습니다.",
        "실이 잘 흔들려서 제가 좋아하던 자리입니다. 그것도 여전했고요.",
        "차를 두 잔 우렸습니다. 하나는 제가 마시고 하나는 그냥 뒀습니다.",
        "…다 식을 때까지 앉아 있었습니다. 그리고 그대로 두고 내려왔습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거면 약속 지킨 거예요",
          reply: "…절반쯤은요. 나머지 절반은 다들 살아 있으니 언젠가 채워지겠죠.",
          next: "still_trying",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "두 잔 우린 게 혼자 간 게 아니라는 뜻이고요",
          reply: "…한 잔은 누구 것이냐고 물으시면 답을 못 합니다. 정하지 않고 우렸습니다.",
          next: "still_trying",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "식은 차를 두고 온 건 아직 안 끝났다는 표시죠",
          reply: "…표시입니다. 다음에 가면 그 잔이 그대로 있을지 궁금하군요.",
          next: "still_trying",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "still_trying",
      intro: [
        "내려오는 길에 그 큰 친구 소식을 들었습니다. 도시에서 잘 지낸다더군요.",
        "연락은 안 했습니다. 그쪽도 안 할 겁니다. 서로 그런 사이입니다.",
        "다만 다음에 차를 우릴 때는 세 잔을 우릴까 합니다. 잔이 늘어나는 건 좋은 일이니까요.",
        "…약속을 지키는 사람이 되고 싶었습니다. 아직 노력 중이고, 노력 중인 게 나쁘지 않습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "노력 중인 게 지키고 있는 거예요",
          reply: "…그렇게 세면 저는 계속 지켜온 셈이 되는군요. 좋은 계산입니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, beauty: 15 },
          },
        },
        {
          tone: "cool",
          me: "잔을 늘리는 게 약속을 갱신하는 방식이네요",
          reply: "…갱신. 실을 이어 붙일 때 쓰는 말과 같군요. 마음에 듭니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "연락 한 번 하세요. 잔만 늘리지 말고요",
          reply: "…언젠가는요. 그 언젠가를 위해 잔을 늘려두는 겁니다. 순서가 있습니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { sociability: 30, knowledge: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 운반 전문 배달꾼 — 정시에 도착하는 것이 전부인 운반업자(`data/accounts.ts` transporter_van).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"운반 중에 뒤를 돌아본 적은 없다. 돌아보면 늦는다"**이다.
 *
 * ⚠️ 말투는 **짧고 끊는 반말**이다. 접속사를 거의 안 쓴다. 감탄부호 금지.
 * ⚠️ 그를 싸우게 하지 마라("나는 싸우는 사람이 아니다. 도망치는 게 내 기술이다").
 * ⚠️ 짐의 내용을 밝히지 마라. 3회차의 '사람 짐'도 "애였다"까지만 쓴다.
 * ⚠️ 탈환사 둘은 "탈환사 놈들"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 정시 → 2회차 못 지킨 두 번 → 3회차 정한 선.
 */
export const VAN_STORY: DmStory = {
  id: "van_1",
  partnerName: "운반 전문 배달꾼",
  partnerHandle: "transporter_van",
  arrivalTitle: "운반 전문 배달꾼의 DM",
  startNode: "on_time",
  nodes: [
    {
      id: "on_time",
      intro: [
        "좋아요 눌렀더군. 이 계정은 운반 일지라 볼 게 없을 텐데",
        "약속한 시간에 도착한다. 그게 이 일의 전부다",
        "무엇을 옮기는지는 안 묻는다. 그게 프로다",
        "…오늘 세 건 다 정시에 끝냈다. 좋은 날이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "좋은 날 축하해요",
          reply: "…축하받을 일은 아니다. 원래 그래야 하는 거다. 그래도 고맙다",
          next: "the_rules",
          effect: { skills: { sociability: 12, it: 10 } },
        },
        {
          tone: "cool",
          me: "안 묻는 게 프로가 아니라 안전이겠죠",
          reply: "…둘 다다. 모르면 불면 안 되니까. 정확히 봤다",
          next: "the_rules",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "안 물어서 옮긴 게 사람 잡는 물건이면요",
          reply: "…그건 내 관할이 아니다. 라고 10년 말해왔다. 그 얘긴 나중에 하자",
          next: "the_rules",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_rules",
      intro: [
        "내 차 안에서는 내 규칙이 적용된다. 예외 없다",
        "차 안에서 밥 먹는 놈은 다음부터 안 태운다. 조수석에는 아무나 안 태우고",
        "탈환사 놈들이 또 차를 빌려 갔다가 문짝을 뜯어 왔다. 외상이 세 건째다",
        "…그래도 다음에 또 빌려줄 걸 알아서 더 화가 난다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "빌려줄 걸 아는 것도 신용이에요",
          reply: "…신용이라. 그쪽에서 갚을 생각이 있어야 신용이지",
          next: "the_ten_years",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "수리비를 운반비에 미리 얹으세요. 계산이 끝나요",
          reply: "…그 방법이 있었군. 하루 계산해보고 답한다",
          next: "the_ten_years",
          delayDays: 1,
          effect: { skills: { knowledge: 30, it: 10 } },
        },
        {
          tone: "bold",
          me: "화가 나는 건 문짝이 아니라 본인이 못 거절해서죠",
          reply: "…그건 좀 정확했다. 내일 답한다",
          next: "the_ten_years",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_ten_years",
      intro: [
        "10년 했더니 뒤를 밟는 차가 몇 대인지 소리만 듣고도 안다",
        "남들은 대단하다고 한다. 그냥 오래 해서 생긴 거다. 재능이 아니라 시간이다",
        "그래서 나는 재능 있다는 애들을 별로 안 부러워한다. 시간은 내 편이니까",
        "…탈환사 놈들 외상은 운반비에 얹기로 했다. 그놈들은 아직 모른다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말은 해주세요. 그것도 신용이잖아요",
          reply: "…말한다. 청구서에 적어서 준다. 그게 내 방식이다",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, it: 10 } },
        },
        {
          tone: "cool",
          me: "시간이 편이라는 말은 앞으로도 이긴다는 뜻이고요",
          reply: "…그렇게 되나. 나는 그냥 안 진다는 뜻으로 썼는데",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "10년 하면 누구나 그렇게 되진 않아요",
          reply: "…그럼 나는 운이 좋았던 거다. 그건 인정한다",
          next: null,
          effect: { mental: 6, followers: 180, skills: { knowledge: 30 } },
        },
      ],
    },
  ],
};

/**
 * 운반 전문 배달꾼 2회차 — 못 지킨 두 번.
 * 축은 **"정시에 도착 못 한 적이 두 번 있다. 둘 다 아직 기억한다"**이다.
 * ⚠️ 두 건의 내용을 다 밝히지 마라. 하나만 말하고 하나는 끝까지 안 말한다.
 */
const VAN_STORY_2: DmStory = {
  id: "van_2",
  partnerName: "운반 전문 배달꾼",
  partnerHandle: "transporter_van",
  arrivalTitle: "운반 전문 배달꾼의 DM",
  startNode: "the_two_times",
  nodes: [
    {
      id: "the_two_times",
      intro: [
        "정시에 도착 못 한 적이 두 번 있다. 10년에 두 번이면 나쁘지 않다",
        "그런데 둘 다 아직 기억한다. 날짜도 시간도 몇 분 늦었는지도",
        "첫 번째는 정체 구간이었다. 이 도시에서 제일 위험한 건 총이 아니라 정체다",
        "…두 번째는 안 적겠다. 그건 아직 정리가 안 됐다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "정리 안 된 건 안 적어도 돼요",
          reply: "…그렇게 말해주는 사람은 드물다. 대체로 캐묻는다",
          next: "what_i_changed_van",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "10년에 두 번이면 기억할 만하죠. 기록이니까",
          reply: "…기록으로 보면 그렇다. 나는 사고로 보고 있었다. 하루 생각해본다",
          next: "what_i_changed_van",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "정리가 안 된 게 아니라 안 하고 있는 거잖아요",
          reply: "…맞다. 내일 답한다",
          next: "what_i_changed_van",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_changed_van",
      intro: [
        "첫 번째 뒤에 바꾼 게 있다. 그때부터 차를 세 대 굴린다",
        "하나는 예비, 하나는 미끼다. 정체가 나면 갈아탄다",
        "가장 빠른 길보다 가장 안전한 길을 고른다. 짐이 상하면 끝이니까",
        "…두 번째 뒤에 바꾼 것도 있다. 그건 다음에 말하겠다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 번 다 뭔가를 바꿨네요. 그게 프로예요",
          reply: "…바꾸는 게 사과다. 나는 말로 하는 사과를 못 한다",
          next: "the_wheel",
          effect: { mental: 10, skills: { sociability: 25, it: 15 } },
        },
        {
          tone: "cool",
          me: "미끼 차를 굴린다는 건 쫓기는 일도 받는다는 뜻이고요",
          reply: "…받는다. 다만 싸우지는 않는다. 도망치는 게 내 기술이다",
          next: "the_wheel",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "안전한 길을 고르면 늦잖아요. 그럼 또 못 지키고요",
          reply: "…그래서 출발을 당긴다. 계산은 이미 다 해뒀다",
          next: "the_wheel",
          effect: { mental: -3, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_wheel",
      intro: [
        "정비는 직접 한다. 남한테 맡기면 손버릇이 바뀐다",
        "차가 긁히면 하루 종일 기분이 안 좋다. 사람보다 차가 정직해서 그렇다",
        "라디오는 안 켠다. 엔진 소리를 들어야 한다. 소리가 먼저 아프다고 한다",
        "…오늘 정비하다가 두 번째 그날 붙였던 부품을 봤다. 아직 안 바꿨더군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 바꾼 이유가 있겠죠",
          reply: "…있다. 바꾸면 잊을 것 같아서다. 그것도 정리가 아니겠지",
          next: null,
          effect: { mental: 12, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "부품 하나를 기록으로 쓰고 있는 거네요",
          reply: "…기록. 그렇게 부르면 좀 낫다. 그 단어를 쓰겠다",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그거 언젠가 고장 나요. 그때 후회할 텐데요",
          reply: "…고장 나기 전에 바꾼다. 그건 계산이 되는 종류다",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 40, it: 15 } },
        },
      ],
    },
  ],
};

/**
 * 운반 전문 배달꾼 3회차 — 정한 선.
 * 축은 **"그게 내가 정한 선이다"**이다.
 * ⚠️ 그 애의 사연을 밝히지 마라. 그는 끝까지 안 묻는다.
 */
const VAN_STORY_3: DmStory = {
  id: "van_3",
  partnerName: "운반 전문 배달꾼",
  partnerHandle: "transporter_van",
  arrivalTitle: "운반 전문 배달꾼의 DM",
  startNode: "the_cargo",
  nodes: [
    {
      id: "the_cargo",
      intro: [
        "운반 중에는 짐이 뭔지 절대 안 묻는다. 근데 딱 한 번 예외가 있었다",
        "뒷자리에서 우는 소리가 나서 백미러를 봤다. 애였다",
        "그날 이후로 사람을 옮기는 의뢰는 값을 두 배로 받는다",
        "…대신 목적지까지 무슨 일이 있어도 데려다준다. 그게 내가 정한 선이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 배로 받는 건 안 받겠다는 뜻이기도 하죠",
          reply: "…거를 놈은 걸러진다. 그것도 계산에 있었다",
          next: "the_one_today",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "백미러를 본 게 규칙 위반이었네요",
          reply: "…뒤를 돌아보면 늦는다고 써놓고 봤다. 10년에 한 번이다",
          next: "the_one_today",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 애는 어디로 갔는지 확인했어요?",
          reply: "…목적지까지 데려다줬다. 그 뒤는 안 묻는다. 하루 두고 답하겠다",
          next: "the_one_today",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_one_today",
      intro: [
        "오늘 그 두 배짜리 의뢰가 또 들어왔다. 사람 짐이다",
        "받았다. 값은 두 배 받았고, 조건도 걸었다. 뒷자리에 어른은 못 탄다고",
        "의뢰인이 왜냐고 묻길래 '내 차 규칙'이라고만 했다",
        "…도착했다. 정시에. 뒤는 안 돌아봤다. 이번엔 안 봐도 알겠더군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "조건을 건 게 그 선을 지킨 거예요",
          reply: "…선은 긋는 것보다 지키는 게 어렵다. 오늘은 지켰다",
          next: "the_seat",
          effect: { mental: 15, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "안 봐도 안다는 건 소리로 알았다는 거고요",
          reply: "…10년이면 그렇게 된다. 소리가 제일 정직하다",
          next: "the_seat",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "규칙이라고만 하면 의뢰인은 이유를 몰라요",
          reply: "…알 필요 없다. 지키기만 하면 된다. 이건 안 바꾼다",
          next: "the_seat",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_seat",
      intro: [
        "내 차 조수석에는 아무나 안 태운다. 이건 원칙이다",
        "그런데 오늘 그 애가 내리면서 조수석 문을 열어보려고 하더군. 실수로",
        "안 된다고 했더니 '왜요' 하길래 답했다. '거긴 다음에 탈 사람 자리다.'",
        "…내가 왜 그렇게 말했는지는 나도 모르겠다. 그냥 나왔다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다음에 태우겠다는 뜻이었네요",
          reply: "…그렇게 들렸나. …그럼 그렇게 해두겠다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, it: 15 },
          },
        },
        {
          tone: "cool",
          me: "10년 비워둔 자리를 오늘 예약한 거예요",
          reply: "…예약이라. 선불은 안 받았으니 정식 의뢰는 아니군",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 자리 비워둔 게 원칙이 아니라 습관이었던 거죠",
          reply: "…원칙으로 부르는 게 편했다. 오늘 그게 들켰다. 그건 인정한다",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 40, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 무면허 뒷골목 의사 — 간판 없는 골목에서 총상을 보는 사람(`data/accounts.ts` backalley_doc).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"살리는 게 늘 옳은 건지는 요즘도 가끔 생각합니다"**이다.
 *
 * ⚠️ 말투는 **담담한 존댓말**이다. 수술·상처 묘사는 **절차 수준까지만** 쓰고 유혈을 그리지 마라.
 * ⚠️ 그의 과거를 밝히지 마라("저도 제 환자한테 안 묻습니다"가 이 계정의 규칙이다).
 * ⚠️ 그를 정식 병원으로 돌려보내거나 면허를 주지 마라. 결말은 문을 계속 열어두는 것이다.
 * ⚠️ 실제 약품명·시술명을 쓰지 마라. "마취약"·"붕대"까지만 쓴다.
 * 줄기: 1회차 면허와 신고 → 2회차 이미 늦은 사람 → 3회차 뒷방 창고.
 */
export const DOC_STORY: DmStory = {
  id: "doc_1",
  partnerName: "무면허 뒷골목 의사",
  partnerHandle: "backalley_doc",
  arrivalTitle: "무면허 뒷골목 의사의 DM",
  startNode: "no_license",
  nodes: [
    {
      id: "no_license",
      intro: [
        "제 글을 퍼가셨군요. 간판도 없는 곳 얘기가 밖으로 나가는 건 드문 일입니다.",
        "면허는 없습니다. 실력은 있습니다. 골라잡으세요.",
        "면허가 없다는 이유로 저를 못 믿겠다는 분들이 계십니다. 이해합니다.",
        "…근데 정식 병원은 총상을 신고하게 되어 있습니다. 이 동네에서 신고는 죽는 것과 비슷합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그래서 선생님 같은 분이 필요한 거고요",
          reply: "…선생님이라고 불러주시니 민망합니다. 저는 그 호칭이 어색합니다.",
          next: "who_comes",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "신고 의무가 있는 제도 쪽 문제네요",
          reply: "…제도를 탓하기엔 제가 그 제도 밖에 있습니다. 그건 잊지 않습니다.",
          next: "who_comes",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "실력이 있다는 건 뭘로 증명해요?",
          reply: "…증명할 방법이 없습니다. 그래서 골라잡으라고 쓴 겁니다.",
          next: "who_comes",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "who_comes",
      intro: [
        "새벽 세 시에 문 두드리는 게 제일 흔한 방문 시간입니다.",
        "10년 있었더니 이제 발소리만 들어도 어디 다쳤는지 압니다.",
        "돈이 없다고 하면 일단 치료하고 나중에 받습니다. 대체로 못 받습니다.",
        "…이 동네가 조용한 날은 제가 굶는 날입니다. 딜레마죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "굶는 날이 좋은 날인 건 확실하잖아요",
          reply: "…확실합니다. 그래서 굶는 걸 불평은 안 합니다. 배는 고픕니다만.",
          next: "the_question",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "치료비를 못 받는 구조면 언젠가 문을 닫아요",
          reply: "…맞습니다. 그건 계산이 됩니다. 하루 두고 답하겠습니다.",
          next: "the_question",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "발소리로 안다는 건 그만큼 많이 왔다는 뜻이고요",
          reply: "…그렇습니다. 그건 좋은 통계가 아닙니다. 하룻밤 생각하겠습니다.",
          next: "the_question",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_question",
      intro: [
        "생각해봤습니다. 그래서 오늘부터 치료비 대신 받는 걸 하나 정했습니다.",
        "다음에 다칠 만한 일을 하기 전에 저한테 먼저 오라는 겁니다. 미리요.",
        "미리 오면 붕대값만 받습니다. 다치고 오면 두 배 받고요.",
        "…이게 치료비 회수에 도움이 될지는 모르겠습니다. 다만 손님은 줄 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "손님이 주는 게 목적이잖아요",
          reply: "…들켰군요. 굶는 날이 늘겠지만 그건 좋은 쪽입니다.",
          next: null,
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "예방에 값을 매긴 건 의사가 하는 일이네요",
          reply: "…면허 없는 사람이 할 소리는 아닙니다만, 그렇게 봐주시면 감사합니다.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "미리 오는 사람은 없을 거예요. 다들 안 다칠 줄 알거든요",
          reply: "…한 명이라도 오면 됩니다. 그 한 명은 안 실려 오니까요.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 무면허 뒷골목 의사 2회차 — 이미 늦은 사람.
 * 축은 **"10년을 했는데도 그건 익숙해지지가 않더군요"**이다.
 * ⚠️ 죽음을 묘사하지 마라. 그가 하는 건 정리와 어깨를 두드리는 것뿐이다.
 */
const DOC_STORY_2: DmStory = {
  id: "doc_2",
  partnerName: "무면허 뒷골목 의사",
  partnerHandle: "backalley_doc",
  arrivalTitle: "무면허 뒷골목 의사의 DM",
  startNode: "too_late",
  nodes: [
    {
      id: "too_late",
      intro: [
        "제일 힘든 건 이미 늦은 사람이 실려 오는 겁니다.",
        "10년을 했는데도 그건 익숙해지지가 않더군요. 어제 또 그랬습니다.",
        "그럴 때는 아무 말 없이 정리만 합니다. 그게 제가 할 수 있는 전부입니다.",
        "…데려온 사람한테 뭐라고 해야 할지 아직도 모르겠어서 어깨만 두드려줍니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말이 필요한 순간이 아니에요. 어깨면 충분해요",
          reply: "…충분하다고 해주시니 낫습니다. 저는 늘 부족하다고 생각했습니다.",
          next: "what_i_say",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "10년째 못 찾는 말이면 원래 없는 말이에요",
          reply: "…없는 말을 찾고 있었던 겁니까. 하루 생각해보겠습니다.",
          next: "what_i_say",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "정리만 한다는 건 본인 감정도 정리해버린다는 뜻이고요",
          reply: "…그렇습니다. 그래야 다음 사람을 봅니다. 하룻밤 주십시오.",
          next: "what_i_say",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_say",
      intro: [
        "어제 데려온 분이 오늘 다시 왔습니다. 치료받으러 온 건 아니었습니다.",
        "'어제 아무 말도 안 해주셔서 고마웠다'고 하시더군요.",
        "다들 뭐라도 말해주는데 그게 더 힘들었다고요. 위로 말입니다.",
        "…10년 동안 제가 못 찾은 말이 사실은 안 하는 것이었나 봅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 답이었네요",
          reply: "…답이 없던 게 답이었습니다. 이런 건 의학서에 안 나옵니다.",
          next: "is_it_right",
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "어깨를 두드린 건 말보다 긴 문장이에요",
          reply: "…문장으로 세주시는군요. 그럼 저는 10년째 같은 문장을 쓰고 있는 겁니다.",
          next: "is_it_right",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "다시 온 건 갈 데가 없어서일 수도 있어요",
          reply: "…그럴 겁니다. 그래서 차를 한 잔 내드렸습니다. 그건 무료로 합니다.",
          next: "is_it_right",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "is_it_right",
      intro: [
        "살리는 게 늘 옳은 건지는 요즘도 가끔 생각합니다.",
        "제 수술대에 누웠던 사람 중에 다시 온 사람이 절반입니다. 다시 다쳐서요.",
        "제가 살려서 그 사람이 또 그 일을 하러 나가는 거라면, 저는 뭘 한 겁니까.",
        "…이건 10년째 답이 안 나옵니다. 그래도 문은 엽니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고르는 건 그 사람 몫이에요. 살리는 건 선생님 몫이고요",
          reply: "…몫을 나눠주시는군요. 그러면 제 몫은 명확해집니다. 감사합니다.",
          next: null,
          effect: { mental: 15, morality: 8, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "절반이 다시 왔다는 건 절반은 안 왔다는 뜻이에요",
          reply: "…안 온 절반은 잘 지내는 걸로 세도 되는 겁니까. 그건 생각 못 했습니다.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "답이 나오면 문을 닫게 될 테니까 안 내는 거죠",
          reply: "…그럴지도 모르겠습니다. 그래서 계속 가끔만 생각하는 겁니다.",
          next: null,
          effect: { mental: -5, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 무면허 뒷골목 의사 3회차 — 뒷방.
 * 축은 **"그게 그 사람이 가진 전부라는 걸 아니까 안 받는다고는 못 하겠더군요"**이다.
 * ⚠️ 물건을 팔아 돈이 되게 만들지 마라. 결말은 창고를 **목록으로 만드는 것**이다.
 */
const DOC_STORY_3: DmStory = {
  id: "doc_3",
  partnerName: "무면허 뒷골목 의사",
  partnerHandle: "backalley_doc",
  arrivalTitle: "무면허 뒷골목 의사의 DM",
  startNode: "the_back_room",
  nodes: [
    {
      id: "the_back_room",
      intro: [
        "치료비 대신 물건을 놓고 가는 분들이 있습니다. 대부분 팔 수도 없는 잡동사니입니다.",
        "그런데 그게 그 사람이 가진 전부라는 걸 아니까 안 받는다고는 못 하겠더군요.",
        "그래서 뒷방이 지금 창고가 됐습니다. 10년치입니다.",
        "…어제 그 방을 열었는데 문이 안 닫히더군요. 이건 좀 곤란합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "10년 동안 그만큼 살렸다는 뜻이네요",
          reply: "…그렇게 세는 방법도 있군요. 저는 짐으로만 세고 있었습니다.",
          next: "the_inventory",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "정리하려면 목록부터 만드세요. 버리는 건 그다음이고요",
          reply: "…목록. 그건 제가 할 수 있습니다. 하루 해보겠습니다.",
          next: "the_inventory",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "다 버리세요. 못 파는 물건은 짐이에요",
          reply: "…버릴 수가 없습니다. 이유는 아까 적었습니다. 하루 생각해보죠.",
          next: "the_inventory",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_inventory",
      intro: [
        "목록을 만들었습니다. 이틀 걸렸습니다. 물건이 삼백 개가 넘더군요.",
        "옆에 이름을 적었습니다. 놓고 간 사람 이름을요. 다 기억하고 있었습니다.",
        "제 손이 마지막으로 닿은 사람들 이름은 다 기억한다고 썼는데, 그 반대도 그렇더군요.",
        "…살아 나간 사람 이름도 다 기억합니다. 그게 삼백 명입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "삼백 명이면 병원 하나 몫이에요",
          reply: "…간판도 없는 곳에서 말입니까. 그렇게 세니 좀 웃깁니다. 나쁘지 않게요.",
          next: "the_door_stays",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그 목록이 선생님 면허예요",
          reply: "…면허라. 제출할 데가 없는 면허군요. 그래도 갖고 있겠습니다.",
          next: "the_door_stays",
          effect: { mental: 12, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "이름까지 적었으면 그건 정리가 아니라 기록이에요",
          reply: "…정리하려다 기록을 만들었습니다. 매번 이런 식입니다.",
          next: "the_door_stays",
          effect: { mental: 8, skills: { knowledge: 45 } },
        },
      ],
    },
    {
      id: "the_door_stays",
      intro: [
        "물건은 그대로 뒀습니다. 대신 목록을 벽에 붙였습니다.",
        "찾아가고 싶은 사람은 찾아가라고요. 두 명이 왔습니다. 10년 만에요.",
        "한 분은 어머니 반지를 찾아가셨고, 한 분은 그냥 목록만 보고 가셨습니다.",
        "…내일도 문은 열어둡니다. 그게 제 일이니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 반지 하나로 10년치 창고 값은 한 거예요",
          reply: "…값을 했습니다. 그럼 나머지 삼백 개도 언젠가 값을 하겠군요.",
          next: null,
          effect: {
            mental: 20,
            morality: 8,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "목록만 보고 간 분이 더 오래 기억에 남을 텐데요",
          reply: "…그분은 자기 물건이 아직 있는지만 확인하러 오신 겁니다. 있었습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "문을 계속 열어두면 언젠가 선생님이 실려 와요",
          reply: "…그때는 누가 저를 봐줄지 궁금하긴 합니다. 그래도 열어둡니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 45, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 정보상 아가씨 — 사실만 파는 정보상(`data/accounts.ts` info_lady).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"사람들이 정말 알고 싶어 하는 건 사실이 아니라 자기가 믿고 싶은 쪽"**이다.
 *
 * ⚠️ 말투는 **장사꾼의 존댓말**이다. 값·신용·원칙을 자주 말한다. 감정을 드러내는 문장은
 *    회차당 한 줄까지만 쓴다.
 * ⚠️ 그가 편을 들게 하지 마라("양쪽 다 제 손님이거든요"). 다만 값을 매기는 방식은 바뀔 수 있다.
 * ⚠️ 탈환사 둘은 "그 둘"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 사실만 판다 → 2회차 협박하러 온 사람 → 3회차 외상 장부.
 */
export const INFOLADY_STORY: DmStory = {
  id: "infolady_1",
  partnerName: "정보상 아가씨",
  partnerHandle: "info_lady",
  arrivalTitle: "정보상 아가씨의 DM",
  startNode: "facts_only",
  nodes: [
    {
      id: "facts_only",
      intro: [
        "제 글을 퍼가셨군요. 값은 안 받겠습니다. 홍보가 됐으니 오히려 제가 이득이죠.",
        "정보를 팝니다. 사실만 팔아요. 추측은 서비스로 드립니다.",
        "정보상을 하면서 배운 건, 사람들이 알고 싶어 하는 게 사실이 아니라는 겁니다.",
        "…자기가 믿고 싶은 쪽을 사러 옵니다. 그래서 저는 안 팔리는 걸 팝니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 팔리는 걸 파는데 장사가 되나요?",
          reply: "…듣기 싫은 걸 사 간 손님이 나중에 다시 옵니다. 그게 단골이 되는 방식이죠.",
          next: "the_price",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "추측을 서비스로 주는 건 위험한데요",
          reply: "…추측이라고 명시해서 드립니다. 섞어 팔면 그날로 신용이 끝납니다.",
          next: "the_price",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "믿고 싶은 쪽을 팔면 훨씬 잘 벌 텐데요",
          reply: "…잘 벌겠죠. 그리고 반년이면 아무도 안 옵니다. 계산해봤습니다.",
          next: "the_price",
          effect: { mental: -2, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_price",
      intro: [
        "가격은 내용에 따라 다릅니다. 흥정은 안 받습니다.",
        "제일 비싼 정보가 뭔지 아십니까. 누가 무엇을 궁금해하는지입니다.",
        "그건 팔지 않습니다. 팔면 제 손님이 손님한테 팔리는 거니까요.",
        "…그런데 요즘 그걸 사겠다는 손님이 붙었습니다. 값을 아주 높게 부르더군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 파실 거잖아요",
          reply: "…안 팝니다. 다만 값이 계속 올라가서 좀 성가십니다.",
          next: "what_i_did_infolady",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "값을 안 깎는 손님이 제일 위험하다면서요",
          reply: "…제 글을 잘 보셨군요. 네. 이 손님이 딱 그 유형입니다. 하루 두고 답하겠습니다.",
          next: "what_i_did_infolady",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 손님이 뭘 궁금해하는지를 파세요. 그게 제일 비싼 거잖아요",
          reply: "…제 방식을 그대로 돌려주시는군요. 하루 계산해보겠습니다.",
          next: "what_i_did_infolady",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_did_infolady",
      intro: [
        "그 손님한테 답을 드렸습니다. '그 정보는 재고가 없습니다.'",
        "거짓말은 아닙니다. 팔 물건 목록에 없으니 재고가 없는 게 맞죠.",
        "그랬더니 '그럼 만들어 달라'고 하더군요. 그래서 문을 닫아드렸습니다.",
        "…정보가 없다고 하면 진짜 없는 겁니다. 없는 걸 만들지는 않습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 한 줄이 이 가게 간판이네요",
          reply: "…간판은 없습니다만, 그렇게 봐주시면 다음 손님에게도 그 값으로 하겠습니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 30, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "재고가 없다는 표현으로 거절한 건 장사꾼답고요",
          reply: "…거절도 상품 설명으로 하면 뒤탈이 적습니다. 10년 하면 그렇게 됩니다.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 손님은 다른 데서 만들어 살 텐데요",
          reply: "…그럴 겁니다. 그리고 그건 틀린 정보일 겁니다. 그게 제 위안입니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 정보상 아가씨 2회차 — 협박하러 온 사람.
 * 축은 **"이 장사는 주먹이 아니라 아는 걸로 지키는 겁니다"**이다.
 */
const INFOLADY_STORY_2: DmStory = {
  id: "infolady_2",
  partnerName: "정보상 아가씨",
  partnerHandle: "info_lady",
  arrivalTitle: "정보상 아가씨의 DM",
  startNode: "the_threat",
  nodes: [
    {
      id: "the_threat",
      intro: [
        "어제 누가 저를 협박하러 왔습니다. 이런 일이 몇 년 만이군요.",
        "그래서 그 사람이 어디서 왔고 누구한테 빚이 있는지를 그 자리에서 읊어줬습니다.",
        "그날 이후로 그런 손님은 없습니다. 아, 어제 일이니까 아직 하루밖에 안 지났군요.",
        "…이 장사는 주먹이 아니라 아는 걸로 지키는 겁니다. 다만 손이 좀 떨렸습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "떨렸는데 읊었으면 그게 더 대단한 건데요",
          reply: "…대단하다는 말은 값이 안 나갑니다만, 오늘은 받아두겠습니다.",
          next: "why_i_know",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 사람 정보를 미리 갖고 있었다는 게 핵심이에요",
          reply: "…모든 손님 정보를 미리 봅니다. 문을 열어주기 전에요. 그게 준비입니다.",
          next: "why_i_know",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "다음엔 그렇게 안 통해요. 아는 걸 아는 사람이 오면요",
          reply: "…그 경우도 계산해뒀습니다. 하루 정리해서 답하겠습니다.",
          next: "why_i_know",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "why_i_know",
      intro: [
        "장부는 머리에 있습니다. 종이에 쓰면 뺏기니까요.",
        "손님 명단도 안 남깁니다. 그게 제가 오래 사는 방법입니다.",
        "그러니까 제 가게를 털어도 가져갈 게 없습니다. 차 도구 정도군요.",
        "…다만 제가 없어지면 그 장부도 같이 없어집니다. 그건 요즘 좀 생각합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 누구한테라도 나눠두세요",
          reply: "…나누면 그 사람이 위험해집니다. 그래서 안 했습니다. 계속 생각은 하고요.",
          next: "the_shape_of_it",
          effect: { mental: 8, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "정보 자체가 아니라 정리하는 방법을 남기면 되잖아요",
          reply: "…방법이라. 그건 뺏겨도 상관없군요. 그건 생각 못 했습니다.",
          next: "the_shape_of_it",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "없어지면 없어지는 거죠. 그게 이 장사의 조건이고요",
          reply: "…맞습니다. 그렇게 정하고 시작했습니다. 가끔 흔들릴 뿐이죠.",
          next: "the_shape_of_it",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_shape_of_it",
      intro: [
        "정리 방법을 적어봤습니다. 정보 자체가 아니라 분류 기준만요.",
        "무엇을 사실로 치는지, 무엇을 추측으로 치는지, 값은 어떻게 매기는지.",
        "종이 넉 장이 나왔습니다. 뺏겨도 상관없는 넉 장입니다.",
        "…이걸 누구한테 줄지는 아직 안 정했습니다. 급할 것 없으니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 넉 장이 이 가게의 진짜 재산이네요",
          reply: "…재산으로 세주시는군요. 그럼 저는 오늘 부자가 됐습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "기준을 적는 게 제일 어려운 일이에요. 다들 감으로 하거든요",
          reply: "…적어보니 제가 감으로 한 게 세 군데 있더군요. 그건 고쳤습니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "안 정하면 결국 아무한테도 안 가요",
          reply: "…그럴 수도 있죠. 다만 급하게 정하면 잘못 갑니다. 이건 값이 큰 물건이라서요.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 45 } },
        },
      ],
    },
  ],
};

/**
 * 정보상 아가씨 3회차 — 외상 장부.
 * 축은 **"본인들한테는 절대 말 안 합니다. 값이 떨어지니까요"**이다.
 * ⚠️ 외상을 받아내지도, 탕감을 선언하지도 마라. 결말은 값을 매기는 **방식**이 바뀌는 것이다.
 */
const INFOLADY_STORY_3: DmStory = {
  id: "infolady_3",
  partnerName: "정보상 아가씨",
  partnerHandle: "info_lady",
  arrivalTitle: "정보상 아가씨의 DM",
  startNode: "the_tab",
  nodes: [
    {
      id: "the_tab",
      intro: [
        "그 둘의 외상 액수가 이미 제 한 달 매출을 넘었습니다.",
        "외상은 안 됩니다. 백 번쯤 말했는데도 안 듣더군요.",
        "그래도 계속 정보를 주는 이유는 그놈들이 제 정보로 사람을 살리는 걸 몇 번 봤기 때문입니다.",
        "…물론 본인들한테는 절대 말 안 합니다. 값이 떨어지니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 외상이 아니라 투자인데요",
          reply: "…투자는 회수를 전제로 합니다. 이건 회수 계획이 없으니 다른 겁니다.",
          next: "the_new_price",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "값이 떨어진다는 건 핑계고 그냥 부끄러운 거죠",
          reply: "…부끄럽습니다. 장사꾼이 감정으로 값을 매기면 안 되니까요. 하루 생각하겠습니다.",
          next: "the_new_price",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "말 안 하면 그 둘은 영영 안 갚아요",
          reply: "…안 갚겠죠. 그건 이미 계산에 넣었습니다. 하루 두고 답하겠습니다.",
          next: "the_new_price",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_new_price",
      intro: [
        "값 매기는 방식을 하나 바꿨습니다. 항목을 새로 만들었습니다.",
        "'사람이 살아 돌아오는 데 쓰는 정보'는 값을 절반으로 매깁니다.",
        "대신 그 정보를 사려면 뭐에 쓸지를 말해야 합니다. 그건 제 규칙입니다.",
        "…그 둘한테 이 항목을 알려줬습니다. 그러니까 절반은 말한 셈이군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "절반만 말한 게 딱 좋네요",
          reply: "…딱 좋다고 해주시니 다행입니다. 다 말하면 제가 못 견딥니다.",
          next: "what_they_said",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "용도를 말하게 한 게 진짜 값이에요. 정보가 하나 더 들어오니까요",
          reply: "…들켰군요. 절반 깎아주고 정보를 하나 더 받는 겁니다. 손해가 아닙니다.",
          next: "what_they_said",
          effect: { skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "그래도 외상은 그대로잖아요",
          reply: "…그대로입니다. 그건 안 깎습니다. 장부는 장부니까요.",
          next: "what_they_said",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_they_said",
      intro: [
        "그 둘이 새 항목을 보더니 뭐랬는지 아십니까. '이거 우리 때문에 만든 거지?'",
        "'아닙니다'라고 했습니다. 사실만 파는 사람이 거짓말을 한 겁니다. 오늘 처음입니다.",
        "그랬더니 웃으면서 외상값 일부를 놓고 갔습니다. 반년 만에 처음이군요.",
        "…제 정보로 누가 살았다는 얘기를 들으면 그날은 기분이 좋습니다. 오늘이 그런 날입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "거짓말 한 번은 봐줄게요",
          reply: "…한 번이면 신용에 금이 안 갑니다. 계산은 이미 해뒀습니다.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "그 둘은 이미 알고 있었네요. 물어본 게 확인이었고요",
          reply: "…확인이었겠죠. 그래서 아니라고 답한 겁니다. 서로 편하자고요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "일부만 놓고 간 건 나머지도 안 갚겠다는 뜻이에요",
          reply: "…압니다. 그래도 반년 만에 움직였습니다. 그건 기록해둘 만합니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 45, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 전기 다루는 소녀 — 손을 늘 주머니에 넣고 다니는 아이(`data/accounts.ts` volt_girl).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"저는 무기가 아니에요"**다. 그 말을 하는 데 오래 걸렸고, 지키는 데는 더 걸린다.
 *
 * ⚠️ 말투는 **조심스러운 존댓말**이다. 감탄부호를 거의 안 쓴다.
 * ⚠️ 실험실 얘기는 **번호로 불렸다**는 것까지만 쓴다. 사건·인물·기관을 만들지 마라.
 * ⚠️ 그를 무기로 쓰는 전개를 쓰지 마라. 능력은 **누굴 돕는 데** 쓰일 때만 등장한다.
 * ⚠️ 탈환사들은 "언니 오빠들"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 주머니 속 손 → 2회차 능력을 사겠다는 제안 → 3회차 이름.
 */
export const VOLT_STORY: DmStory = {
  id: "volt_1",
  partnerName: "전기 다루는 소녀",
  partnerHandle: "volt_girl",
  arrivalTitle: "전기 다루는 소녀의 DM",
  startNode: "hands_in_pockets",
  nodes: [
    {
      id: "hands_in_pockets",
      intro: [
        "좋아요 눌러주셔서 감사합니다. 저 이런 거 처음 받아봐요.",
        "먼저 말씀드릴 게 있어요. 만지지 마세요. 이건 진심으로 하는 경고예요.",
        "제일 무서운 건 제가 누굴 다치게 하는 거예요. 그래서 손을 늘 주머니에 넣고 다녀요.",
        "…어제 언니가 그거 보고 손 좀 꺼내고 다니라면서 제 손을 잡았어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "아무 일도 없었죠?",
          reply: "…없었어요. 저는 그게 아직도 기적 같아요. 하루 종일 그 생각만 했어요.",
          next: "the_practice",
          effect: { mental: 6, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "그 언니는 안 다칠 걸 알고 잡은 거예요",
          reply: "…어떻게 알았을까요. 저도 모르는데요. 그게 계속 궁금해요.",
          next: "the_practice",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "잡혔을 때 손 뺐어요?",
          reply: "…뺐어요. 바로요. 그리고 밤에 좀 후회했어요. 그건 아무한테도 말 안 했어요.",
          next: "the_practice",
          effect: { mental: -4, skills: { knowledge: 22 } },
        },
      ],
    },
    {
      id: "the_practice",
      intro: [
        "전압을 조절하는 연습을 매일 해요. 실수하면 사람이 다치니까요.",
        "요즘은 전구 하나를 안 깨고 불을 켰다 끄는 데까지 왔어요.",
        "화가 나면 주변 전구가 나가요. 그래서 화를 잘 참는 연습도 같이 해요.",
        "…근데 참는 거랑 조절하는 거는 다른 것 같아요. 어느 쪽을 연습해야 하는지 모르겠어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "조절하는 쪽이요. 참는 건 언젠가 안 되니까요",
          reply: "…조절하는 쪽. 그럼 화를 내도 되는 거네요. 그건 생각 못 했어요.",
          next: "what_i_can_do",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "전구가 나가는 건 조절 실패지 화를 낸 잘못이 아니에요",
          reply: "…나눠서 보면 되는 거군요. 하루 생각해볼게요.",
          next: "what_i_can_do",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "매일 참기만 하면 언젠가 크게 터져요",
          reply: "…그게 제일 무서워요. 그래서 물어본 거예요. 내일 답할게요.",
          next: "what_i_can_do",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_can_do",
      intro: [
        "어제 정전이 났어요. 이번엔 진짜 제 탓이 아니었어요.",
        "가게 냉장고가 멈춰서 아저씨가 곤란해하시길래, 손을 꺼냈어요.",
        "냉장고만 돌렸어요. 딱 그만큼만요. 전구는 하나도 안 깨졌어요.",
        "…제 전기로 누굴 도울 수 있다는 걸 알았을 때 처음으로 이 능력이 좋았어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "오늘 제일 잘한 일이네요",
          reply: "…아저씨가 아이스크림을 주셨어요. 그건 제 값이 아니라 냉장고 값 같았지만요.",
          next: null,
          effect: { mental: 15, skills: { sociability: 30, it: 10 } },
        },
        {
          tone: "cool",
          me: "딱 그만큼만 쓴 게 조절 성공이에요",
          reply: "…성공이라고 해도 되는 거군요. 연습한 게 처음으로 쓰였어요.",
          next: null,
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "손 꺼낸 게 제일 큰 일이었어요",
          reply: "…아. 그러네요. 저 그때 주머니에서 손 뺐네요. 몰랐어요.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { sociability: 25 } },
        },
      ],
    },
  ],
};

/**
 * 전기 다루는 소녀 2회차 — 사겠다는 사람들.
 * 축은 **"그 사람들이 사려는 건 제 전기지 저는 아니거든요"**이다.
 * ⚠️ 납치·전투 장면을 쓰지 마라. 위협은 제안과 방문까지만 나온다.
 */
const VOLT_STORY_2: DmStory = {
  id: "volt_2",
  partnerName: "전기 다루는 소녀",
  partnerHandle: "volt_girl",
  arrivalTitle: "전기 다루는 소녀의 DM",
  startNode: "the_buyers",
  nodes: [
    {
      id: "the_buyers",
      intro: [
        "제 능력을 사고 싶다는 사람들이 또 찾아왔어요. 값을 아주 높게 불렀어요.",
        "근데 그 사람들이 사려는 건 제 전기지 저는 아니거든요.",
        "그 차이를 아는 사람이 이 도시에 몇 없다는 걸 알게 된 뒤로는 그냥 다 거절해요.",
        "…거절하는 건 이제 익숙한데, 매번 손이 떨리는 건 안 익숙해져요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "떨려도 거절한 게 대단한 거예요",
          reply: "…대단한 건가요. 저는 그냥 무서워서 빨리 보내려고 한 건데요.",
          next: "who_stood",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "값을 높게 부르는 건 협상이 아니라 압박이에요",
          reply: "…압박. 그렇게 부르니까 좀 정리가 돼요. 하루 생각해볼게요.",
          next: "who_stood",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다음엔 언니 오빠들한테 먼저 말하세요",
          reply: "…말하면 그 사람들이 싸우게 돼요. 그건 싫어요. 내일 답할게요.",
          next: "who_stood",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "who_stood",
      intro: [
        "결국 언니 오빠들이 알게 됐어요. 제가 말 안 했는데 알더라고요.",
        "저를 데리러 온 사람들을 막아줬어요. 싸우지는 않았고 그냥 앞에 서 있었어요.",
        "그 사람들이 '이 아이 하나 지키려고 이러냐'고 했는데, 언니가 뭐랬는지 아세요.",
        "…'하나가 아니라 얘다'라고 했어요. 저 그 말 계속 생각하고 있어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 사람으로 본다는 뜻이에요",
          reply: "…사람으로. 저를 사람으로 봐준 첫 번째가 그 언니였어요. 지금도요.",
          next: "not_a_weapon",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "'하나'랑 '얘'의 차이를 그쪽은 못 알아들었을걸요",
          reply: "…못 알아듣더라고요. 그냥 갔어요. 그게 답이었던 것 같아요.",
          next: "not_a_weapon",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 사람들 또 와요. 그건 알고 계시죠",
          reply: "…알아요. 그래서 저도 연습을 더 하고 있어요. 도망치는 연습이요.",
          next: "not_a_weapon",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "not_a_weapon",
      intro: [
        "저는 무기가 아니에요. 그 말을 하는 데 오래 걸렸어요.",
        "실험실에 있을 때는 제가 사람인지 장비인지 헷갈렸거든요. 번호로 불렸으니까요.",
        "그래서 지금도 누가 제 이름을 불러주면 이상하게 울컥해요.",
        "…별거 아닌 일에 왜 이러나 싶은데, 저한테는 별거인가 봐요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "별거 맞아요. 이름은 별거예요",
          reply: "…그럼 저 계속 울컥해도 되는 거네요. 그건 좀 다행이에요.",
          next: null,
          effect: { mental: 18, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "무기는 자기가 무기가 아니라고 말 못 해요",
          reply: "…아. 그러네요. 그럼 저는 말할 수 있으니까 아닌 거네요.",
          next: null,
          effect: { mental: 15, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "번호로 불린 얘기는 그만하고 이름을 더 쓰세요",
          reply: "…이름이요. 제 이름을 제가 쓰는 건 좀 부끄러운데. …연습해볼게요.",
          next: null,
          effect: { mental: 10, followers: 220, skills: { sociability: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 전기 다루는 소녀 3회차 — 이름.
 * 축은 **"누가 제 이름을 다정하게 불러주면 눈물이 납니다"**이다.
 * ⚠️ 실명을 지어내지 마라. 이름은 끝까지 텍스트에 등장하지 않는다 — 불렸다는 사실만 쓴다.
 */
const VOLT_STORY_3: DmStory = {
  id: "volt_3",
  partnerName: "전기 다루는 소녀",
  partnerHandle: "volt_girl",
  arrivalTitle: "전기 다루는 소녀의 DM",
  startNode: "practice_smiling",
  nodes: [
    {
      id: "practice_smiling",
      intro: [
        "웃는 연습을 해요. 오래 안 웃어서 어색하거든요.",
        "거울 보고 하는데 잘 안 돼요. 입만 올라가고 눈은 안 웃는대요.",
        "언니가 그거 보고 '연습하지 마'라고 했어요. 웃길 때 웃으면 된다고요.",
        "…그럼 저는 언제 웃어야 하는 걸까요. 웃긴 게 뭔지 잘 모르겠어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "모르면 그냥 있어도 돼요. 언젠가 나와요",
          reply: "…그냥 있어도 되는군요. 그럼 오늘은 그냥 있을게요.",
          next: "the_first_laugh_volt",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "웃긴 걸 찾지 말고 편한 사람 옆에 있어보세요",
          reply: "…편한 사람. 그건 몇 명 있어요. 내일 해볼게요.",
          next: "the_first_laugh_volt",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "연습해서 나오는 웃음은 어차피 안 닮아요",
          reply: "…맞는 말인데 좀 서운해요. 그래도 하루 생각해볼게요.",
          next: "the_first_laugh_volt",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_first_laugh_volt",
      intro: [
        "어제 오빠가 라면을 끓이다가 냄비를 엎었어요. 세 번이나요.",
        "세 번째에 제가 소리 내서 웃었어요. 저도 모르게요.",
        "다들 저를 쳐다봐서 그때 좀 부끄러웠는데, 아무도 아무 말 안 했어요.",
        "…그리고 오빠가 네 번째로 또 엎었어요. 일부러 그런 것 같아요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "일부러 맞아요. 그거 보려고요",
          reply: "…그런 걸 왜 일부러 해요. 라면이 아까운데요. …고마워서 그런 건가요.",
          next: "called_by_name",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "아무 말도 안 한 게 배려였고요",
          reply: "…말했으면 제가 다시 안 웃었을 거예요. 다들 그걸 아는 것 같았어요.",
          next: "called_by_name",
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "네 번째는 진짜 실수였을 수도 있어요",
          reply: "…그럼 오빠가 너무 서툰 거잖아요. 그것도 좀 웃겨요.",
          next: "called_by_name",
          effect: { mental: 12, skills: { comedy: 20, sociability: 20 } },
        },
      ],
    },
    {
      id: "called_by_name",
      intro: [
        "오늘 시장에서 아저씨가 제 이름을 불렀어요. 냉장고 고쳐드린 그 아저씨요.",
        "'또 왔네' 하면서 제 이름을 붙여서 불렀어요. 그냥 평범하게요.",
        "울지는 않았어요. 대신 아이스크림을 사서 나왔어요.",
        "…번호로 불리던 때랑 지금이 같은 사람 얘기라는 게 아직 이상해요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "같은 사람 맞아요. 그래서 대단한 거고요",
          reply: "…대단하다니. 저는 그냥 시간이 지난 건 줄 알았어요.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, it: 10 },
          },
        },
        {
          tone: "cool",
          me: "안 운 게 오늘의 변화네요",
          reply: "…어. 그러네요. 저 안 울었어요. 그거 처음이에요.",
          next: null,
          effect: { mental: 18, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "이제 손 주머니에서 꺼내고 다니세요",
          reply: "…오늘은 꺼내고 다녔어요. 아이스크림 들어야 했거든요. 핑계지만요.",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { sociability: 30, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 폐허 술집 주인 — 무너진 구역 안쪽에서 15년 장사한 사람(`data/accounts.ts` ruins_barkeep).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"법이 없는 거지 규칙이 없는 게 아닙니다"**이다.
 *
 * ⚠️ 말투는 **차분한 존댓말**이다. 손님 사연을 캐묻지 않는 사람이라, 남 얘기는 늘 짧게 끝낸다.
 * ⚠️ 가게 안에서 폭력이 벌어지게 하지 마라("제 가게에서 죽은 사람은 없습니다"가 이 인물의 자랑이다).
 * ⚠️ 손님의 사연을 밝히지 마라. 단골도 이름 없이 "제일 오래된 단골"로만 부른다.
 * 줄기: 1회차 규칙 → 2회차 안 온 단골 → 3회차 폐허가 정리되면.
 */
export const BARKEEP_STORY: DmStory = {
  id: "barkeep_1",
  partnerName: "폐허 술집 주인",
  partnerHandle: "ruins_barkeep",
  arrivalTitle: "폐허 술집 주인의 DM",
  startNode: "house_rules",
  nodes: [
    {
      id: "house_rules",
      intro: [
        "좋아요 감사합니다. 이 안쪽 얘기를 보시는 분이 계시다니 신기하군요.",
        "여기서 싸우실 거면 밖으로 나가세요. 안에서는 안 됩니다. 그게 첫 번째 규칙입니다.",
        "밖에서 오신 분들은 여기를 무법지대라고 부르시더군요. 틀린 말은 아닙니다.",
        "…다만 법이 없는 거지 규칙이 없는 게 아닙니다. 그 차이를 알아주시면 좋겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "규칙이 더 잘 지켜지는 데도 있죠",
          reply: "…여기가 그렇습니다. 법은 멀고 저는 가까우니까요.",
          next: "the_rebuild",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "규칙을 지키게 하는 힘은 어디서 나오는데요",
          reply: "…갈 데가 여기밖에 없다는 겁니다. 쫓겨나면 길에서 마셔야 하니까요.",
          next: "the_rebuild",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "그 규칙도 힘센 사람이 어기면 끝인데요",
          reply: "…어긴 사람이 있었습니다. 그때마다 누군가 나섰습니다. 그건 제 덕이 아니고요.",
          next: "the_rebuild",
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_rebuild",
      intro: [
        "가게가 부서진 게 이번이 네 번째입니다. 매번 다시 짓습니다.",
        "다들 왜 다시 짓냐고 물으십니다. 여기 사람들한테 갈 데가 여기밖에 없어서요.",
        "제가 접으면 저 사람들은 길에서 마셔야 합니다. 그건 좀 아니잖습니까.",
        "…그런데 이번엔 짓는 데 두 달이 걸렸습니다. 예전엔 3주였는데요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 달 동안 그분들은 어디 있었어요?",
          reply: "…빈터에 모여 있더군요. 술도 없이요. 그걸 보고 좀 서둘렀습니다.",
          next: "no_clock",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "두 달이면 나이 든 거예요. 사람 쓰세요",
          reply: "…쓸 돈이 없습니다. 하루 계산해보고 답하겠습니다.",
          next: "no_clock",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다섯 번째엔 못 지을 수도 있어요",
          reply: "…그 생각을 요즘 합니다. 하룻밤 두고 답하겠습니다.",
          next: "no_clock",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "no_clock",
      intro: [
        "생각해봤습니다. 그래서 이번엔 단골 넷한테 못질을 시켰습니다.",
        "술값에서 까주기로 했습니다. 외상 장부가 얇아지니 서로 좋습니다.",
        "3주 만에 끝났습니다. 제가 혼자 할 때보다 빨랐고요.",
        "…제 가게에는 시계가 없습니다. 필요 없어서요. 그런데 이번엔 날짜를 세게 되더군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "같이 지었으면 그 가게는 그분들 것이기도 하네요",
          reply: "…그렇게 되는군요. 그럼 다섯 번째도 걱정이 좀 덜합니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "외상을 노동으로 받는 건 장부 정리로도 맞고요",
          reply: "…계산이 맞습니다. 그런데 저는 그 계산이 목적이 아니었습니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "날짜를 세기 시작한 건 나이 얘기예요",
          reply: "…부정은 안 하겠습니다. 시계는 여전히 안 걸 겁니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 폐허 술집 주인 2회차 — 안 온 단골.
 * 축은 **"그런 날은 좀 걱정됩니다"**이다.
 * ⚠️ 그 단골을 죽이지 마라. 결말은 다시 오는 것이고, 이유는 끝까지 안 밝힌다.
 */
const BARKEEP_STORY_2: DmStory = {
  id: "barkeep_2",
  partnerName: "폐허 술집 주인",
  partnerHandle: "ruins_barkeep",
  arrivalTitle: "폐허 술집 주인의 DM",
  startNode: "the_missing_regular",
  nodes: [
    {
      id: "the_missing_regular",
      intro: [
        "제일 오래된 단골이 어제 안 왔습니다. 15년 동안 거의 매일 오던 분입니다.",
        "여기 오는 손님들은 다들 사연이 있습니다. 저는 안 묻습니다. 그게 규칙이고요.",
        "안 묻는 사람이 안 온 걸 걱정하는 건 앞뒤가 안 맞는 것 같기도 합니다.",
        "…그래도 걱정됩니다. 오늘도 안 왔습니다. 이틀째입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "찾아가 보세요. 그건 캐묻는 게 아니에요",
          reply: "…찾아가는 건 선을 넘는 것 같아서요. 하루 생각해보겠습니다.",
          next: "what_i_sent",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "안 묻는 규칙은 손님이 왔을 때 얘기잖아요",
          reply: "…아. 그건 가게 안 규칙이었군요. 밖은 다른 겁니다. 하루 두고 보겠습니다.",
          next: "what_i_sent",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "이틀이면 이 동네에선 늦은 편인데요",
          reply: "…압니다. 그래서 지금 이걸 쓰고 있는 겁니다. 내일 답하겠습니다.",
          next: "what_i_sent",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_sent",
      intro: [
        "찾아가지는 않았습니다. 대신 안주를 하나 싸서 다른 단골 편에 보냈습니다.",
        "'외상값이 밀렸으니 와서 갚으라'고 전해달라고 했습니다. 외상은 없습니다.",
        "그랬더니 오늘 밤에 오셨습니다. 아무 말 없이 앉으셨고요.",
        "…무슨 일이 있었는지는 안 물었습니다. 물을 한 잔 먼저 드렸습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "없는 외상을 만든 게 제일 좋은 초대장이네요",
          reply: "…초대장이라. 그렇게 부르니 제가 꽤 다정한 사람 같군요.",
          next: "the_water",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "물을 먼저 준 게 취해서 온 걸 알았다는 뜻이고요",
          reply: "…발소리만 들어도 압니다. 15년이면 그렇게 됩니다.",
          next: "the_water",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그래도 한 번은 물어보는 게 맞았을 텐데요",
          reply: "…물으면 다시 안 옵니다. 그건 여러 번 확인했습니다.",
          next: "the_water",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_water",
      intro: [
        "취해서 우는 손님한테는 물을 드립니다. 그게 제 서비스입니다.",
        "어제는 그분이 안 우셨습니다. 대신 두 시간 앉아 계시다가 그냥 가셨고요.",
        "가시면서 딱 한 마디 하셨습니다. '문 안 닫았네.'",
        "…그래서 답했습니다. '안 닫습니다.' 그게 어제 나눈 대화 전부입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 두 마디면 충분해요",
          reply: "…충분했습니다. 오늘도 오셨고요. 그거면 된 겁니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "확인하러 오신 거였네요. 가게가 있는지",
          reply: "…그런 것 같습니다. 그래서 네 번을 다시 지은 거고요.",
          next: null,
          effect: { mental: 12, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "안 닫는다는 약속은 지키기 어려운 건데요",
          reply: "…어렵습니다. 그래도 어제는 지켰습니다. 하루씩 지키는 수밖에요.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 폐허 술집 주인 3회차 — 정리되면.
 * 축은 **"이 폐허가 언젠가 정리되면 저는 어디로 가야 하나 싶습니다"**이다.
 * ⚠️ 철거를 확정하지 마라. 결말은 **다음 자리를 미리 정해두는 것**까지다.
 */
const BARKEEP_STORY_3: DmStory = {
  id: "barkeep_3",
  partnerName: "폐허 술집 주인",
  partnerHandle: "ruins_barkeep",
  arrivalTitle: "폐허 술집 주인의 DM",
  startNode: "if_they_clear_it",
  nodes: [
    {
      id: "if_they_clear_it",
      intro: [
        "이 폐허를 정리한다는 얘기가 돌고 있습니다. 몇 년째 도는 얘기입니다만.",
        "이번엔 측량하는 사람들이 실제로 왔습니다. 그건 처음입니다.",
        "정리되면 저는 어디로 가야 하나 싶습니다. 15년 여기 있었으니까요.",
        "…저보다 여기 사람들이 어디로 갈지가 더 걸립니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "가게를 옮기면 사람들도 따라가요",
          reply: "…따라올까요. 여기라서 오는 사람들인데요. 하루 생각해보겠습니다.",
          next: "the_next_place",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "측량이 왔으면 시간은 있어요. 그동안 자리를 알아보세요",
          reply: "…시간이 있다고 보는 편이 낫겠군요. 하루 두고 답하겠습니다.",
          next: "the_next_place",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "정리되는 게 그분들한테는 나쁜 일만은 아닐 텐데요",
          reply: "…그럴 수도 있습니다. 다만 갈 데가 정해진 사람이 몇이나 될지요.",
          next: "the_next_place",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_next_place",
      intro: [
        "자리를 하나 봐뒀습니다. 여기서 걸어서 20분 거리입니다. 폐허 밖이고요.",
        "계약은 안 했습니다. 다만 주인한테 '언제 필요해질지 모른다'고만 말해뒀습니다.",
        "그리고 가게 벽에 그 주소를 적어뒀습니다. 작게요.",
        "…읽는 사람만 읽으라고요. 여기 사람들은 그런 걸 잘 읽습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 주소가 다음 가게 간판이네요",
          reply: "…간판은 여전히 안 걸 생각입니다. 주소면 충분하죠.",
          next: "the_open_door",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "미리 적어둔 게 제일 실용적인 대비예요",
          reply: "…네 번 부서지면 대비하는 법을 배웁니다. 다섯 번째는 준비된 셈이고요.",
          next: "the_open_door",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "20분이면 여기 사람들한테는 먼 거리예요",
          reply: "…멉니다. 그래서 걸어서 20분이라고 적어뒀습니다. 거리를 알면 덜 멀어집니다.",
          next: "the_open_door",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_open_door",
      intro: [
        "어제 젊은 손님이 하나 왔습니다. 밖에서 온 티가 났습니다. 두리번거리더군요.",
        "젊은 애들이 여기 오면 좀 말립니다. 돌아갈 데가 있으면 돌아가라고요.",
        "그 애가 '여긴 왜 다들 안 묻냐'고 묻길래 답했습니다. '물으면 안 오니까.'",
        "…그러고는 돌아갔습니다. 돌아갈 데가 있는 애였습니다. 그거면 됐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말린 게 이 가게에서 제일 좋은 서비스예요",
          reply: "…술을 안 판 날이 좋은 날인 장사는 이것뿐일 겁니다.",
          next: null,
          effect: {
            mental: 18,
            morality: 8,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "안 묻는 이유를 그 애한테는 말해준 게 답이고요",
          reply: "…밖으로 나갈 애한테는 말해도 됩니다. 안에 남을 사람한테만 안 묻습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "돌아갈 데가 없는 애가 오면 어떻게 하실 건데요",
          reply: "…받습니다. 그리고 안 묻습니다. 그게 제 몫입니다.",
          next: null,
          effect: {
            mental: 15,
            morality: 6,
            followers: 320,
            skills: { sociability: 30, knowledge: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 회수 대행 청부인 — 계약서만 보고 움직이는 회수업자(`data/accounts.ts` collector_hire).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"저쪽엔 지켜야 할 게 있었고 저한텐 계약서만 있었으니까요"**이다.
 *
 * ⚠️ 말투는 **사무적인 존댓말**이다. 자기 일을 미화하지도 자학하지도 않는다.
 * ⚠️ 그를 개심시키지 마라. 3회차에서도 그는 계약으로 일한다 — 다만 계약서에 줄이 하나 늘어난다.
 * ⚠️ 폭력을 상세히 묘사하지 마라("총은 마지막에 씁니다"까지가 선이다).
 * ⚠️ 탈환사 둘은 "그 둘"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 계약만 있다 → 2회차 실패한 세 건 → 3회차 은퇴 자금.
 */
export const HIRE_STORY: DmStory = {
  id: "hire_1",
  partnerName: "회수 대행 청부인",
  partnerHandle: "collector_hire",
  arrivalTitle: "회수 대행 청부인의 DM",
  startNode: "not_a_retriever",
  nodes: [
    {
      id: "not_a_retriever",
      intro: [
        "제 글을 퍼가셨군요. 이 계정은 홍보용이 아닙니다만, 뭐 상관없습니다.",
        "먼저 정정하겠습니다. 저는 회수를 합니다. 탈환사랑 헷갈리지 마십시오.",
        "그쪽은 의뢰인의 사연을 듣고 움직이고 저는 계약서만 보고 움직입니다.",
        "…어느 쪽이 옳은지는 모르겠습니다. 다만 저는 밤에 잠은 잘 잡니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "잠을 잘 자는 것도 능력이죠",
          reply: "…능력으로 쳐주시는군요. 이 일에서는 자격 요건에 가깝습니다.",
          next: "the_contract",
          effect: { skills: { sociability: 12, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "사연을 안 듣는 게 실력에 도움이 돼요?",
          reply: "…됩니다. 감정을 섞으면 값이 떨어집니다. 그래서 안 섞습니다.",
          next: "the_contract",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "잠을 잘 잔다는 걸 자꾸 쓰는 게 신경 쓰인다는 뜻인데요",
          reply: "…그렇게 읽으실 수도 있겠군요. 부정은 안 하겠습니다.",
          next: "the_contract",
          effect: { mental: -4, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_contract",
      intro: [
        "이 일에 정의는 없습니다. 계약만 있습니다.",
        "값을 깎으려는 의뢰인은 받지 않습니다. 처음부터 문제가 생기거든요.",
        "회수한 물건은 절대 안 열어봅니다. 그게 규칙입니다.",
        "…이번 건은 회수 대상이 사람입니다. 그때는 값을 더 받습니다. 그런데 좀 걸립니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "걸리면 안 받으면 되잖아요",
          reply: "…계약은 이미 했습니다. 그러면 하는 겁니다. 하루 생각해보겠습니다.",
          next: "what_i_added",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "사람은 물건처럼 안 열어볼 수가 없잖아요",
          reply: "…정확한 지적입니다. 그게 걸리는 지점입니다. 하루 두고 답하겠습니다.",
          next: "what_i_added",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "값을 더 받는다는 게 그 걸림돌 값이고요",
          reply: "…그렇습니다. 제가 값을 매긴 겁니다. 하룻밤 생각해보겠습니다.",
          next: "what_i_added",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_added",
      intro: [
        "계약서에 줄을 하나 넣었습니다. 이 일 10년 만에 처음입니다.",
        "'회수 대상이 사람일 경우, 인도 시점까지 상해 없음을 보증한다.'",
        "의뢰인이 왜 그런 걸 넣냐고 묻길래 '제 신용 조항입니다'라고 답했습니다.",
        "…실제로 신용 조항이 맞습니다. 다친 물건은 값이 떨어지니까요. 그렇게 설명했습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "설명은 그렇게 하시고 이유는 다르잖아요",
          reply: "…설명이 계약서에 남습니다. 이유는 안 남고요. 저는 남는 쪽만 씁니다.",
          next: null,
          effect: { mental: 10, morality: 6, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 줄 하나면 계약이 통째로 달라져요",
          reply: "…달라집니다. 못 받는 의뢰가 생기겠죠. 그건 감수합니다.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "10년 만에 넣었으면 그전 건들은요",
          reply: "…그전 건들은 그전 계약대로였습니다. 그게 제 답입니다.",
          next: null,
          effect: { mental: -5, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 회수 대행 청부인 2회차 — 실패한 세 건.
 * 축은 **"그 차이가 마지막 순간에 나오더군요"**이다.
 */
const HIRE_STORY_2: DmStory = {
  id: "hire_2",
  partnerName: "회수 대행 청부인",
  partnerHandle: "collector_hire",
  arrivalTitle: "회수 대행 청부인의 DM",
  startNode: "three_failures",
  nodes: [
    {
      id: "three_failures",
      intro: [
        "제가 실패한 건은 딱 세 건이고 전부 그 둘 때문이었습니다.",
        "분하지는 않습니다. 그때마다 저쪽엔 지켜야 할 게 있었고 저한텐 계약서만 있었으니까요.",
        "그 차이가 마지막 순간에 나오더군요. 정확히 마지막 몇 초에요.",
        "…그게 좀 부러웠던 것도 사실입니다. 이건 처음 쓰는 얘기입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "부러운 걸 인정한 게 크네요",
          reply: "…인정하면 값이 떨어질까 봐 안 썼는데, 계정에는 써도 되겠더군요.",
          next: "what_i_lack",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "지킬 게 있으면 마지막에 한 발 더 나가니까요",
          reply: "…계산으로는 손해인 행동입니다. 그런데 결과는 저쪽이 이겼습니다.",
          next: "what_i_lack",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "부러우면 그쪽으로 가면 되잖아요",
          reply: "…간단하게 말씀하시는군요. 하룻밤 생각해보겠습니다.",
          next: "what_i_lack",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_lack",
      intro: [
        "생각해봤습니다. 저한테 지킬 게 없는 건 안 만들었기 때문입니다.",
        "동업자는 안 둡니다. 나눠 가지는 게 싫어서라고 써놨는데, 그건 절반만 사실입니다.",
        "나머지 절반은 잃을 게 생기면 계산이 흐려지기 때문입니다.",
        "…그러니까 저는 이 상태를 유지하려고 노력해온 겁니다. 10년 동안요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그것도 하나의 방식이에요. 나쁜 건 아니고요",
          reply: "…나쁘지 않다고 해주시니 편합니다. 다들 더럽다고만 합니다.",
          next: "the_fourth",
          effect: { mental: 10, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "유지하려고 노력했다는 건 생길 뻔했다는 뜻이고요",
          reply: "…몇 번 있었습니다. 그때마다 계약을 하나 더 잡았습니다. 그게 제 방식입니다.",
          next: "the_fourth",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그래서 세 번 진 거예요. 그건 계산에 없죠",
          reply: "…있습니다. 세 건은 제 손실 목록에 있습니다. 원인 항목은 비어 있었고요.",
          next: "the_fourth",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_fourth",
      intro: [
        "어제 네 번째로 그 둘과 부딪쳤습니다. 같은 물건을 두고요.",
        "이번엔 제가 가져왔습니다. 4대 3이 됐군요.",
        "가져오면서 한 가지를 확인했습니다. 저쪽이 마지막에 손을 뗐습니다.",
        "…그 물건 안에 뭐가 있는지 저쪽은 알고 있었고, 저는 안 열어봐서 몰랐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "열어보실 거예요?",
          reply: "…규칙상 안 엽니다. 다만 의뢰인한테 인도할 때 표정은 봤습니다.",
          next: null,
          effect: { mental: 10, skills: { sociability: 25, knowledge: 20 } },
        },
        {
          tone: "cool",
          me: "손을 뗀 건 진 게 아니라 판단이에요",
          reply: "…그렇게 봅니다. 그래서 이번 건은 제 승리 목록에 안 넣었습니다.",
          next: null,
          effect: { skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "안 열어봐서 모르는 건 핑계예요. 알 수 있었잖아요",
          reply: "…알 수 있었습니다. 안 알아본 겁니다. 그건 정정하겠습니다.",
          next: null,
          effect: { mental: -6, followers: 200, skills: { knowledge: 45 } },
        },
      ],
    },
  ],
};

/**
 * 회수 대행 청부인 3회차 — 은퇴 자금.
 * 축은 **"은퇴 자금은 이미 모았습니다. 그런데도 계속 하고 있네요"**이다.
 * ⚠️ 은퇴시키지 마라. 결말은 계속하는 이유를 **처음으로 언어화하는 것**이다.
 */
const HIRE_STORY_3: DmStory = {
  id: "hire_3",
  partnerName: "회수 대행 청부인",
  partnerHandle: "collector_hire",
  arrivalTitle: "회수 대행 청부인의 DM",
  startNode: "the_retirement_fund",
  nodes: [
    {
      id: "the_retirement_fund",
      intro: [
        "은퇴 자금은 이미 모았습니다. 3년 전에 목표액을 넘겼습니다.",
        "그런데도 계속 하고 있네요. 이건 계산이 안 됩니다.",
        "의뢰가 끊기면 다른 일을 찾을 거라고 써놨는데, 끊긴 적이 없어서 확인이 안 됩니다.",
        "…그래서 다음 달 의뢰를 전부 안 받아봤습니다. 실험입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "실험 결과가 궁금하네요",
          reply: "…저도 궁금합니다. 하루 두고 중간 보고를 드리죠.",
          next: "the_empty_month",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "안 받는 것도 계약이에요. 자기랑 한",
          reply: "…자기와의 계약. 그건 위반해도 위약금이 없어서 약합니다만.",
          next: "the_empty_month",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "3년이나 넘겨놓고 이제 실험이요?",
          reply: "…미룬 겁니다. 이유는 그 실험으로 알아보려는 거고요.",
          next: "the_empty_month",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_empty_month",
      intro: [
        "사흘 만에 답이 나왔습니다. 실험은 종료됐습니다.",
        "이유는 간단합니다. 사흘째에 제가 의뢰를 하나 받았습니다.",
        "값이 좋아서가 아닙니다. 회수 대상이 사람이었고, 다른 데로 가면 다칠 게 뻔해서였습니다.",
        "…그러니까 저는 지킬 게 없는 게 아니라 계약서 뒤에 숨겨놨던 모양입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "숨겨둔 걸 찾은 게 실험 결과네요",
          reply: "…결과가 나왔습니다. 예상 밖이라 보고서를 다시 써야겠군요.",
          next: "why_i_continue",
          effect: { mental: 15, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그 조항을 넣은 시점에 이미 답은 나와 있었어요",
          reply: "…맞습니다. 저는 그걸 신용 조항이라고 불렀습니다. 이름을 잘못 붙였군요.",
          next: "why_i_continue",
          effect: { skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "그래도 값은 받았잖아요. 그러면 자선은 아니고요",
          reply: "…받았습니다. 자선은 안 합니다. 그건 앞으로도 그렇습니다.",
          next: "why_i_continue",
          effect: { mental: -3, skills: { knowledge: 45 } },
        },
      ],
    },
    {
      id: "why_i_continue",
      intro: [
        "이 도시에서 깨끗하게 사는 방법을 아는 사람이 있으면 알려달라고 써둔 적이 있습니다.",
        "아직 아무도 안 알려주더군요. 그래서 저는 계속 이러고 삽니다.",
        "다만 계약서에 줄을 하나 더 넣었습니다. '대상이 미성년일 경우 의뢰를 받지 않는다.'",
        "…값이 제일 비싼 건이 그쪽인데 말입니다. 계산으로는 손해입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "손해가 아니라 그게 지킬 거예요",
          reply: "…지킬 것. 그 단어를 제 계약서에서 쓰게 될 줄은 몰랐습니다.",
          next: null,
          effect: {
            mental: 18,
            morality: 10,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "줄이 두 개면 이제 방식이 바뀐 거예요",
          reply: "…방식은 그대로입니다. 조건이 늘었을 뿐입니다. 그렇게 부르겠습니다.",
          next: null,
          effect: { mental: 12, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "그 조항 때문에 다른 데로 가면 그 애들은 더 다쳐요",
          reply: "…그것도 계산했습니다. 그래서 그 건은 그 둘한테 넘깁니다. 값 없이요.",
          next: null,
          effect: {
            mental: 15,
            morality: 8,
            followers: 320,
            skills: { knowledge: 45, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 눈이 좋은 알바생 — 남이 안 보는 것까지 보이는 잡지사 알바(`data/accounts.ts` allseeing_intern).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"제가 할 수 있는 게 보는 것뿐이라 자주 무력합니다. 그래도 봅니다"**이다.
 *
 * ⚠️ 말투는 **겁 많은 존댓말**이다("~요/~어요"). 무서움을 숨기지 않는다 —
 *    "무섭다고 말하면 좀 덜 무섭더라"가 이 캐릭터의 방식이다.
 * ⚠️ 그를 강하게 만들지 마라. 늘어나는 건 **도망치지 않는 시간**뿐이다.
 * ⚠️ 눈의 대가는 **끝까지 안 밝힌다**("대가 없이 받은 건 아니라서요"까지가 선이다).
 * ⚠️ 선배들은 "불 다루는 선배"·"거한 선배"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 흔들린 사진 → 2회차 처음 앞에 선 날 → 3회차 제대로 찍고 싶은 것.
 */
export const INTERN_STORY: DmStory = {
  id: "intern_1",
  partnerName: "눈이 좋은 알바생",
  partnerHandle: "allseeing_intern",
  arrivalTitle: "눈이 좋은 알바생의 DM",
  startNode: "blurry_photos",
  nodes: [
    {
      id: "blurry_photos",
      intro: [
        "좋아요 감사합니다! 제 계정은 무섭다는 얘기밖에 없어서 좀 죄송해요.",
        "사진은 순간을 남기는 거라던데, 저는 도망치면서 찍어서 다 흔들려요.",
        "이번 달에 찍은 게 백 장인데 쓸 만한 게 세 장입니다. 선배가 웃더라고요.",
        "…근데 그 세 장은 안 흔들렸어요. 그 순간엔 안 도망쳤다는 뜻이겠죠.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 세 장이 오늘의 성과예요",
          reply: "…성과요. 저는 아흔일곱 장을 실패로 세고 있었어요.",
          next: "what_i_see",
          effect: { mental: 5, skills: { sociability: 15, it: 10 } },
        },
        {
          tone: "cool",
          me: "안 흔들린 세 장이 언제 찍은 건지 세보세요. 패턴이 있을걸요",
          reply: "…패턴이요. 그건 생각 못 했어요. 오늘 밤에 세볼게요.",
          next: "what_i_see",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "도망치면서 찍는 것도 실력이에요. 안 찍는 사람이 대부분이고요",
          reply: "…그런가요. 저는 못 찍는 줄만 알았는데.",
          next: "what_i_see",
          effect: { mental: 4, skills: { knowledge: 20 } },
        },
      ],
    },
    {
      id: "what_i_see",
      intro: [
        "제 눈이 좀 좋은 편이라 남들이 안 보는 것도 보이는데요.",
        "안 보고 싶을 때가 더 많아요. 무서운 걸 보면 눈을 감아야 하는데 감아도 보여요.",
        "이건 좀 불공평하다고 생각해요. 다들 안 보고 지나가는 걸 저만 보니까요.",
        "…제 눈 얘기는 별로 안 하고 싶어요. 대가 없이 받은 건 아니라서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 물어볼게요. 보이는 얘기만 해요",
          reply: "…안 물어봐 주셔서 감사해요. 다들 그거부터 물어보거든요.",
          next: "why_i_stay",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "보이는 걸 남기는 게 지금 직업이잖아요. 그건 우연이 아니고요",
          reply: "…우연이 아니라고 하니까 좀 무서워요. 하루 생각해볼게요.",
          next: "why_i_stay",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "불공평한 게 아니라 남들은 못 보고 당하는 거예요",
          reply: "…아. 그렇게 보면 제가 유리한 건가요. 하루 생각해볼게요.",
          next: "why_i_stay",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "why_i_stay",
      intro: [
        "누가 저한테 왜 도망 안 가냐고 물었어요. 이 도시에서 왜 계속 일하냐고요.",
        "생각해보니까 답이 하나였어요. 도망갈 곳도 여기라서요.",
        "여동생한테는 잘 지낸다고 편지를 썼어요. 반은 사실이에요.",
        "…선배가 겁이 많은 게 흠은 아니라고 말해줬어요. 위로가 좀 됐습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "흠 아니에요. 겁이 있으니까 보는 거고요",
          reply: "…겁이 있어서 본다. 그럼 제 겁도 쓸모가 있는 거네요.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "반은 사실이면 반은 거짓말인데, 그건 여동생한테 좀 그렇죠",
          reply: "…맞아요. 그래서 다음 편지엔 무서운 얘기도 한 줄 쓰려고요. 한 줄만요.",
          next: null,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "도망갈 곳도 여기라는 건 이미 정착한 거예요",
          reply: "…정착이요. 저는 계속 임시라고 생각했는데. 이력서엔 그렇게 적을게요.",
          next: null,
          effect: { mental: 8, followers: 150, skills: { knowledge: 25, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 눈이 좋은 알바생 2회차 — 처음 앞에 선 날.
 * 축은 **"다리는 떨렸지만 안 도망쳤어요"**이다.
 * ⚠️ 그를 싸우게 하지 마라. 그가 한 일은 서 있는 것과 찍는 것뿐이다.
 */
const INTERN_STORY_2: DmStory = {
  id: "intern_2",
  partnerName: "눈이 좋은 알바생",
  partnerHandle: "allseeing_intern",
  arrivalTitle: "눈이 좋은 알바생의 DM",
  startNode: "the_first_stand",
  nodes: [
    {
      id: "the_first_stand",
      intro: [
        "오늘 처음으로 제가 먼저 앞에 섰어요. 다리는 떨렸지만 안 도망쳤어요.",
        "선배들이 다 너무 강해서 저는 늘 도망치는 담당이었거든요.",
        "그런데 오늘은 선배들이 멀리 있었고 시민 한 분이 가까이 있었어요.",
        "…그래서 그냥 섰어요. 뭘 한 건 아니고 서 있기만 했어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "서 있는 게 제일 어려운 거예요",
          reply: "…선배도 그렇게 말했어요. 겁이 나도 서 있는 훈련을 했을 뿐이라고요.",
          next: "what_they_said_intern",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 시민은 도망칠 시간을 번 거고요",
          reply: "…아. 그렇게 계산되는 거군요. 저는 아무것도 못 했다고 생각했어요.",
          next: "what_they_said_intern",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다음엔 사진도 찍으세요. 그게 본업이잖아요",
          reply: "…찍었어요. 세 장이요. 다 흔들렸지만 찍긴 찍었어요.",
          next: "what_they_said_intern",
          delayDays: 1,
          effect: { mental: -3, skills: { it: 20 } },
        },
      ],
    },
    {
      id: "what_they_said_intern",
      intro: [
        "돌아와서 거한 선배가 저를 부르더니 이렇게 말했어요.",
        "'오늘 자기 판단으로 시민을 구했습니다. 자랑스럽습니다.'",
        "존댓말로요. 저한테요. 부하한테 존댓말 쓰는 분이라 놀랄 일은 아닌데도 놀랐어요.",
        "…그날 밤에 잠이 안 왔어요. 무서워서가 아니라 다른 이유로요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 좋은 밤샘이네요",
          reply: "…좋은 밤샘이요. 그런 것도 있군요. 그럼 오늘도 좀 못 잘 것 같아요.",
          next: "the_shaking_photos",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "'자기 판단으로'가 핵심이에요. 시켜서 한 게 아니니까",
          reply: "…판단. 저는 그냥 몸이 안 움직인 건 줄 알았는데요.",
          next: "the_shaking_photos",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "존댓말이 놀라운 게 아니라 자랑스럽다는 말이 놀란 거죠",
          reply: "…네. 그 단어를 저한테 쓴 사람이 처음이었어요.",
          next: "the_shaking_photos",
          effect: { mental: 12, skills: { knowledge: 30, sociability: 20 } },
        },
      ],
    },
    {
      id: "the_shaking_photos",
      intro: [
        "그날 찍은 세 장을 봤어요. 다 흔들렸는데 하나는 좀 달랐어요.",
        "흔들린 방향이 아래가 아니라 옆이었어요. 도망칠 때는 아래로 흔들리거든요.",
        "옆으로 흔들렸다는 건 제가 그 자리에 있었다는 뜻이에요.",
        "…이걸 알아채는 데 사흘 걸렸어요. 그래도 알아챘어요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 사진이 증거네요",
          reply: "…증거요. 그럼 저 그거 인화해서 붙여둘래요. 흔들린 사진인데도요.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30, it: 15 } },
        },
        {
          tone: "cool",
          me: "흔들린 방향을 세는 건 아무나 못 해요",
          reply: "…제가 볼 수 있는 게 그런 것뿐이라서요. 그건 잘합니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45, it: 15 } },
        },
        {
          tone: "bold",
          me: "다음엔 안 흔들리게 찍어야죠",
          reply: "…네. 다음엔 두 발로 서서 찍어볼게요. 그게 목표예요.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { it: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 눈이 좋은 알바생 3회차 — 제대로 찍고 싶은 것.
 * 축은 **"언젠가 이 도시를 제대로 찍고 싶어요. 도망치지 않고요"**이다.
 * ⚠️ 그를 영웅으로 만들지 마라. 결말은 사진 한 장이 실리는 것까지다.
 */
const INTERN_STORY_3: DmStory = {
  id: "intern_3",
  partnerName: "눈이 좋은 알바생",
  partnerHandle: "allseeing_intern",
  arrivalTitle: "눈이 좋은 알바생의 DM",
  startNode: "what_i_want_to_shoot",
  nodes: [
    {
      id: "what_i_want_to_shoot",
      intro: [
        "언젠가 이 도시를 제대로 찍고 싶어요. 도망치지 않고요.",
        "이 도시는 하늘부터 이상해요. 밤이면 건물보다 높은 데를 뭔가 지나가는데요.",
        "다들 아무렇지 않게 다녀요. 저만 매번 놀라고요.",
        "…근데 제가 찍고 싶은 건 그게 아니에요. 그 아래를 걷는 사람들이에요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 훨씬 좋은 사진이에요",
          reply: "…그럴까요. 편집장님은 하늘을 찍어오라고 하시는데요.",
          next: "the_submission",
          delayDays: 1,
          effect: { skills: { sociability: 25, it: 10 } },
        },
        {
          tone: "cool",
          me: "하늘은 다들 찍어요. 사람은 아무도 안 찍고요",
          reply: "…아. 그럼 제가 찍는 게 더 드문 거네요. 하루 생각해볼게요.",
          next: "the_submission",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "찍고 싶은 걸 안 찍으면서 언젠가라고 하면 영영 안 와요",
          reply: "…맞는 말이라 좀 찔려요. 내일 답할게요.",
          next: "the_submission",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_submission",
      intro: [
        "냈어요. 하늘 사진 대신 사람 사진을 넣어서 제출했어요.",
        "새벽에 가게 문 여는 아주머니랑, 순찰 끝나고 걸어가는 선배 등이요.",
        "편집장님이 한참 보시더니 '이건 뭐냐'고 하셨어요. 심장이 떨어질 뻔했어요.",
        "…그러고는 '이걸로 가자'고 하셨어요. 저 아직도 실감이 안 나요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "축하해요. 제대로 찍었네요",
          reply: "…제대로요. 그 말 들으려고 반년 흔들리게 찍었나 봐요.",
          next: "still_here_intern",
          effect: { mental: 18, skills: { sociability: 30, it: 20 } },
        },
        {
          tone: "cool",
          me: "'이건 뭐냐'는 안 좋다는 뜻이 아니었네요",
          reply: "…처음 보는 거였대요. 그래서 그렇게 물으신 거였어요.",
          next: "still_here_intern",
          effect: { mental: 12, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "선배 등을 찍은 건 허락받았어요?",
          reply: "…안 받았어요. 그래서 실린 뒤에 사과했어요. 사과는 늦을수록 무겁다고 배웠는데요.",
          next: "still_here_intern",
          effect: { mental: -4, skills: { knowledge: 35, it: 15 } },
        },
      ],
    },
    {
      id: "still_here_intern",
      intro: [
        "사진이 실렸어요. 여동생한테 그 잡지를 보냈어요.",
        "이번 편지엔 '무서운 일도 있는데 잘 지낸다'고 썼어요. 이제 반이 아니라 다 사실이에요.",
        "제가 할 수 있는 게 보는 것뿐이라 자주 무력해요. 그래도 봅니다.",
        "…보는 게 일이 되면 무력한 게 아니라던데, 요즘 그 말이 조금 이해돼요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이해된 게 오늘 제일 큰 변화예요",
          reply: "…변화요. 저는 아직 알바생인데요. 그래도 그렇게 세볼게요.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, it: 20 },
          },
        },
        {
          tone: "cool",
          me: "다 사실이라고 쓴 게 제일 어려운 문장이었을 텐데요",
          reply: "…세 번 고쳐 썼어요. 그래도 결국 그렇게 썼어요.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "이제 도망 안 치고 찍는 게 목표죠",
          reply: "…네. 아직 다리는 떨려요. 근데 떨면서도 셔터는 눌러져요.",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { it: 30, knowledge: 20, sociability: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 예의 바른 거한 — 야수의 세계에도 예의가 있다고 믿는 상사(`data/accounts.ts` gentleman_giant).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"저는 겁이 없는 것이 아닙니다. 겁이 나도 서 있는 훈련을 했을 뿐입니다"**이다.
 *
 * ⚠️ 말투는 **격식 있는 존댓말**이다. 부하에게도 존댓말을 쓴다. 문장을 끝까지 맺는다.
 * ⚠️ 그를 무너뜨리지 마라. 흔들려도 예의는 유지된다 — 그게 이 인물의 형태다.
 * ⚠️ 가문 얘기는 **안 한다**("물려받은 것보다 지금 하는 일이 중요해서요"). 캐물어도 답하지 않는다.
 * ⚠️ 부하들은 "사진 담당"·"불 다루는 쪽"처럼 역할로만 부른다. 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 예의라는 규칙 → 2회차 말려도 가면 같이 간다 → 3회차 물려받은 것.
 */
export const GIANT_STORY: DmStory = {
  id: "giant_1",
  partnerName: "예의 바른 거한",
  partnerHandle: "gentleman_giant",
  arrivalTitle: "예의 바른 거한의 DM",
  startNode: "manners_first",
  nodes: [
    {
      id: "manners_first",
      intro: [
        "제 글을 퍼가주셨더군요. 감사 인사를 먼저 드립니다.",
        "야수의 세계에도 예의는 있습니다. 없다면 그건 그냥 혼란입니다.",
        "저는 규칙을 좋아합니다. 규칙이 있어야 놀이도 싸움도 성립하니까요.",
        "…다만 요즘 규칙이 없다고 믿는 사람들을 자주 봅니다. 그쪽이 더 위험합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "규칙을 어기는 사람보다 없다고 믿는 사람이 위험하죠",
          reply: "…제 문장을 그대로 돌려주시는군요. 대화가 편하겠습니다.",
          next: "the_apology",
          effect: { skills: { sociability: 15, game: 10 } },
        },
        {
          tone: "cool",
          me: "예의는 강한 사람이 말해야 설득력이 있고요",
          reply: "…그건 슬픈 사실입니다. 제가 2미터가 아니었으면 아무도 안 들었을 겁니다.",
          next: "the_apology",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "예의를 지키면서 사람을 때리는 건 모순 아니에요?",
          reply: "…모순입니다. 그래서 때려야 할 때에도 사과를 먼저 합니다. 그것이 순서입니다.",
          next: "the_apology",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_apology",
      intro: [
        "오늘 배운 것이 하나 있습니다. 사과는 늦을수록 무거워집니다.",
        "부하 한 명의 농담에 제가 웃지 못했습니다. 오늘의 유일한 실수입니다.",
        "웃지 못한 이유는 그 농담이 재미없어서가 아니라 제가 딴생각을 하고 있어서였습니다.",
        "…사과를 하려는데 뭐라고 해야 할지 모르겠습니다. '안 웃어서 미안하다'는 이상하지 않습니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이상하지만 그게 정확해요. 그대로 하세요",
          reply: "…정확한 쪽을 고르겠습니다. 이상한 건 감수하죠.",
          next: "the_result_giant",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "딴생각을 했다고 말하면 돼요. 사과할 건 그쪽이고요",
          reply: "…그렇군요. 사과의 대상을 잘못 잡고 있었습니다. 하루 두고 답하겠습니다.",
          next: "the_result_giant",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "농담에 안 웃은 걸 실수로 세는 게 더 이상한데요",
          reply: "…그럴까요. 저에게는 그것도 예의의 항목이라서요. 하룻밤 생각하겠습니다.",
          next: "the_result_giant",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_result_giant",
      intro: [
        "사과했습니다. '어제 딴생각을 했습니다. 농담을 놓쳐서 미안합니다.'",
        "그 부하가 3초쯤 저를 보더니 그 농담을 한 번 더 하더군요.",
        "이번에는 웃었습니다. 두 번째라 그런지 더 재미있었습니다.",
        "…존경은 요구해서 받는 것이 아니라는 걸 매일 배웁니다. 오늘 것은 이걸로 하겠습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "한 번 더 해준 게 사과를 받았다는 뜻이에요",
          reply: "…그런 방식의 답이 있군요. 기록해두겠습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, game: 10 } },
        },
        {
          tone: "cool",
          me: "두 번째가 더 웃긴 건 사과 때문이지 농담 때문이 아니고요",
          reply: "…분석이 정확하십니다. 다만 그 부하 앞에서는 안 하겠습니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "매일 배운다면서 매일 같은 걸 배우시는 것 같은데요",
          reply: "…같은 것을 매일 배웁니다. 그래서 아직 안 잊고 있습니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 예의 바른 거한 2회차 — 말려도 가면.
 * 축은 **"부하가 무모하면 말립니다. 말려도 가면 같이 갑니다"**이다.
 */
const GIANT_STORY_2: DmStory = {
  id: "giant_2",
  partnerName: "예의 바른 거한",
  partnerHandle: "gentleman_giant",
  arrivalTitle: "예의 바른 거한의 DM",
  startNode: "the_reckless_one",
  nodes: [
    {
      id: "the_reckless_one",
      intro: [
        "부하 하나가 오늘 무모한 판단을 했습니다. 말렸습니다. 그래도 가더군요.",
        "그래서 같이 갔습니다. 그것이 제 규칙입니다.",
        "결과는 나쁘지 않았습니다. 다만 제 정장이 또 찢어졌습니다.",
        "…단골 수선집 사장님께 늘 죄송합니다. 이번 달만 세 번째입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "정장값이 부하 목숨값보다 싸죠",
          reply: "…비교 자체가 성립하지 않습니다. 그래도 그 말씀은 감사합니다.",
          next: "why_i_follow",
          effect: { skills: { sociability: 20, fitness: 10 } },
        },
        {
          tone: "cool",
          me: "말려도 갈 걸 알면서 말리는 이유가 있어요?",
          reply: "…있습니다. 말린 기록이 남아야 그 부하가 다음에 한 번 더 생각합니다.",
          next: "why_i_follow",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "같이 가주니까 계속 무모한 거 아니에요?",
          reply: "…그 가능성은 저도 검토했습니다. 하루 두고 답하겠습니다.",
          next: "why_i_follow",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "why_i_follow",
      intro: [
        "검토해봤습니다. 제가 따라가서 그 부하가 무모해지는 것인지를요.",
        "기록을 보니 반대였습니다. 제가 따라간 뒤로 무모한 판단의 빈도가 줄었습니다.",
        "이유를 물었더니 '선배가 따라오면 제 판단이 무거워져서요'라고 하더군요.",
        "…혼자 갈 때는 자기 목숨만 걸면 됐는데, 이제는 아니라는 뜻이었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "따라간 게 제일 좋은 말리기였네요",
          reply: "…의도한 것은 아닙니다만, 결과가 그렇다면 계속하겠습니다.",
          next: "the_standing",
          delayDays: 1,
          effect: { skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "무게를 지운 거예요. 그건 좋은 방법만은 아니고요",
          reply: "…부담이 될 수도 있다는 말씀이군요. 하루 생각해보겠습니다.",
          next: "the_standing",
          delayDays: 1,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그럼 그 부하는 이제 선배 때문에 못 가는 거예요",
          reply: "…그건 제가 원한 바가 아닙니다. 하룻밤 생각하겠습니다.",
          next: "the_standing",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_standing",
      intro: [
        "그 부하에게 말했습니다. '가야 한다고 판단하면 가십시오. 저는 따라갑니다.'",
        "'다만 제가 따라가는 것을 이유로 안 가지는 마십시오'라고도 했습니다.",
        "그 부하가 웃더군요. '선배는 말이 왜 이렇게 길어요'라고요.",
        "…길었습니다. 짧게 하면 명령이 되고, 명령은 제가 원하는 것이 아니라서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "길어도 다 필요한 말이었어요",
          reply: "…필요한 말만 하려고 애씁니다. 그런데 늘 이만큼 필요하더군요.",
          next: null,
          effect: { mental: 12, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "명령이 아니라 선택지를 준 거네요",
          reply: "…선택지. 그렇게 부르니 제가 하려던 것이 정리됩니다.",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "겁이 나도 서 있는 훈련을 그 부하한테도 시키세요",
          reply: "…시키고 있습니다. 다만 그것은 시켜서 되는 훈련이 아니라 곤란합니다.",
          next: null,
          effect: { mental: 6, followers: 220, skills: { fitness: 25, knowledge: 20 } },
        },
      ],
    },
  ],
};

/**
 * 예의 바른 거한 3회차 — 물려받은 것.
 * 축은 **"물려받은 것보다 지금 하는 일이 중요해서요"**이다.
 * ⚠️ 가문 이야기를 밝히지 마라. 캐묻는 선택지도 답을 얻지 못한다.
 */
const GIANT_STORY_3: DmStory = {
  id: "giant_3",
  partnerName: "예의 바른 거한",
  partnerHandle: "gentleman_giant",
  arrivalTitle: "예의 바른 거한의 DM",
  startNode: "the_invitation",
  nodes: [
    {
      id: "the_invitation",
      intro: [
        "초대장이 하나 왔습니다. 제 가문 쪽 행사입니다.",
        "가문 이야기는 잘 하지 않습니다. 물려받은 것보다 지금 하는 일이 중요해서요.",
        "다만 이번 초대장에는 제 직함이 안 적혀 있었습니다. 이름만 있었고요.",
        "…그게 무슨 뜻인지 알아서 좀 오래 들고 있었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 가셔도 돼요",
          reply: "…안 가도 되는군요. 그 말을 듣고 싶어서 썼는지도 모르겠습니다.",
          next: "what_i_wrote_giant",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "직함을 뺀 건 지금 하는 일을 인정 안 한다는 뜻이고요",
          reply: "…정확합니다. 그래서 오래 들고 있었습니다. 하루 두고 답하겠습니다.",
          next: "what_i_wrote_giant",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "가문 얘기 한 번은 해도 되지 않아요?",
          reply: "…하지 않겠습니다. 다른 것은 다 물어보셔도 됩니다.",
          next: "what_i_wrote_giant",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_wrote_giant",
      intro: [
        "답장을 썼습니다. 참석은 하지 않는다고요.",
        "그리고 한 줄 덧붙였습니다. '다음에는 직함을 적어 보내주십시오.'",
        "예의를 지킨 거절입니다. 무례한 쪽은 제가 아니게 됐고요.",
        "…이런 식으로 이기는 것도 이기는 것입니까. 조금 비겁한 기분이 듭니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "비겁한 게 아니라 정확한 거예요",
          reply: "…정확한 쪽으로 세겠습니다. 그편이 잠이 옵니다.",
          next: "what_i_do_now",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "이긴 게 아니라 선을 그은 거고요",
          reply: "…선. 그것이 제가 하려던 것입니다. 이제 이름이 붙었습니다.",
          next: "what_i_do_now",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 한 줄이 제일 세게 때린 건데요",
          reply: "…사과 없이 때린 셈이군요. 그 부분은 반성하겠습니다.",
          next: "what_i_do_now",
          effect: { mental: -3, skills: { knowledge: 40, game: 10 } },
        },
      ],
    },
    {
      id: "what_i_do_now",
      intro: [
        "오늘도 한 명의 시민이 자기 일을 마치고 집에 갔습니다. 그것이 성과입니다.",
        "이 도시를 지키는 일은 화려하지 않습니다. 대부분은 서류와 대기입니다.",
        "그래도 저는 이 직함이 좋습니다. 물려받은 것이 아니라 제가 받은 것이라서요.",
        "…그리고 오늘 저녁에 보드게임 상대를 구했습니다. 초보 환영이며 봐드리지는 않습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 초대장보다 이쪽이 훨씬 좋은 자리네요",
          reply: "…비교가 되지 않습니다. 이쪽은 제가 고른 자리니까요.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, game: 20 },
          },
        },
        {
          tone: "cool",
          me: "받은 직함이라는 말이 오늘의 답이에요",
          reply: "…답이 나오는 데 오래 걸렸습니다. 그래도 나왔으니 됐습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "봐주지도 않으면서 초보를 부르는 건 좀 그런데요",
          reply: "…봐주는 것은 상대에 대한 예의가 아닙니다. 이것은 양보할 수 없습니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { game: 30, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 안경 낀 옛 동료 — 그 일을 그만두고 회사에 다니는 사람(`data/accounts.ts` former_partner).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"저는 도망친 게 맞습니다. 부정하지 않습니다"**이다.
 *
 * ⚠️ 말투는 **조용한 존댓말**이다. 과거를 미화하지도 저주하지도 않는다.
 * ⚠️ 그를 돌아가게 하지 마라. 3회차에서도 거절은 유지된다.
 * ⚠️ 그 시절의 사건을 구체적으로 쓰지 마라. "그때"·"그 골목"까지만 쓴다.
 * ⚠️ 옛 동료 둘은 "그 둘"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 정시 퇴근 → 2회차 서랍 속 물건 → 3회차 돌아오라는 말.
 */
export const FORMER_STORY: DmStory = {
  id: "former_1",
  partnerName: "안경 낀 옛 동료",
  partnerHandle: "former_partner",
  arrivalTitle: "안경 낀 옛 동료의 DM",
  startNode: "on_time_home",
  nodes: [
    {
      id: "on_time_home",
      intro: [
        "제 글을 퍼가셨더군요. 이 계정은 회사원 푸념뿐이라 의외입니다.",
        "오늘도 정시에 퇴근했습니다. 이게 제 승리입니다. 농담이 아닙니다.",
        "월급날이 제일 좋습니다. 정해진 날에 돈이 들어오는 게 아직도 신기해서요.",
        "…10년째인데 아직 신기합니다. 그게 제가 어디서 왔는지를 말해주는 것 같습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "신기한 게 오래가는 것도 좋은 거예요",
          reply: "…좋은 겁니까. 저는 적응을 못 한 증거라고 생각했습니다.",
          next: "the_gap",
          effect: { skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "정시 퇴근이 승리인 직장은 별로 없는데요",
          reply: "…비교 대상이 회사가 아니라서 그렇습니다. 그건 다음에 설명하죠.",
          next: "the_gap",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "10년이면 신기해할 때는 지났죠",
          reply: "…맞는 말입니다. 그래서 요즘 좀 무섭습니다. 익숙해질까 봐서요.",
          next: "the_gap",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_gap",
      intro: [
        "제 이력서에는 공백이 3년 있습니다. 면접에서 아무도 안 물어봤습니다.",
        "준비한 대답이 있었는데 쓸 일이 없더군요.",
        "세상은 생각보다 남한테 관심이 없다는 걸 그때 알았습니다.",
        "…그게 서운하면서도 다행이었습니다. 지금도 그 둘 다입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "준비한 대답은 아직 갖고 계세요?",
          reply: "…외우고 있습니다. 10년째요. 쓸 일이 없는데도 안 잊힙니다.",
          next: "what_i_kept",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "안 물어본 게 다행이라고 하면서 서운한 건 앞뒤가 맞아요",
          reply: "…맞습니까. 저는 제가 이상한 줄 알았습니다. 하루 생각해보겠습니다.",
          next: "what_i_kept",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "관심이 없는 게 아니라 물으면 안 되는 걸 아는 거예요",
          reply: "…그런 겁니까. 그건 생각 못 했습니다. 하룻밤 두겠습니다.",
          next: "what_i_kept",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_kept",
      intro: [
        "생각해봤습니다. 그리고 준비했던 대답을 오늘 처음 소리 내어 읽어봤습니다.",
        "'3년 동안 다른 일을 했습니다. 지금 하는 일에는 도움이 안 됩니다.'",
        "읽어보니 거짓말이더군요. 그때 배운 눈치가 회사에서 제일 쓸모 있습니다.",
        "…그래서 대답을 고쳤습니다. 물어볼 사람이 없는데도요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "고친 대답이 뭔데요?",
          reply: "…'사람 보는 눈을 배웠습니다.' 이겁니다. 이건 참말입니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "도움이 안 된다고 쓴 건 부정하고 싶어서였고요",
          reply: "…부정하고 싶었습니다. 인정하면 그 3년이 제 안에 남는 거니까요.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "물어볼 사람이 없는데 고친 건 본인이 물어본 거예요",
          reply: "…그렇게 되는군요. 제가 저한테 면접을 본 셈입니다. 합격했습니다.",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 안경 낀 옛 동료 2회차 — 서랍 속 물건.
 * 축은 **"버리지는 못했습니다"**이다.
 * ⚠️ 그 물건이 무엇인지 밝히지 마라. 끝까지 "그때 쓰던 물건"으로만 둔다.
 */
const FORMER_STORY_2: DmStory = {
  id: "former_2",
  partnerName: "안경 낀 옛 동료",
  partnerHandle: "former_partner",
  arrivalTitle: "안경 낀 옛 동료의 DM",
  startNode: "the_drawer",
  nodes: [
    {
      id: "the_drawer",
      intro: [
        "제 책상 서랍에 그때 쓰던 물건이 하나 있습니다. 버리지는 못했습니다.",
        "안경은 바꿨습니다. 그때 쓰던 건 버렸고요. 그런데 그건 못 버렸습니다.",
        "회사 책상입니다. 집이 아니라요. 그게 좀 이상하죠.",
        "…어제 옆자리 동료가 그 서랍을 열 뻔했습니다. 심장이 내려앉았습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "집으로 옮기시는 게 낫겠네요",
          reply: "…집에 두면 가족이 봅니다. 그래서 회사에 둔 겁니다. 하루 생각해보겠습니다.",
          next: "what_i_did_former",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "회사에 둔 건 언제든 버릴 수 있게 해둔 거예요",
          reply: "…그런 겁니까. 저는 숨긴 거라고만 생각했습니다. 하루 두겠습니다.",
          next: "what_i_did_former",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "못 버린 게 아니라 안 버린 거잖아요",
          reply: "…안 버린 겁니다. 정정합니다. 내일 답하겠습니다.",
          next: "what_i_did_former",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_did_former",
      intro: [
        "옮겼습니다. 집도 회사도 아닌 데로요. 은행 대여금고에 넣었습니다.",
        "연 사용료가 나갑니다. 적금 붓는 사람이 이런 데 돈을 씁니다.",
        "그런데 넣고 나니 이상하게 편해졌습니다. 잊어도 되는 자리에 뒀으니까요.",
        "…버리지 않았고 곁에도 안 둡니다. 이 정도가 제 답인 것 같습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 제일 정확한 자리예요",
          reply: "…정확하다고 해주시니 사용료가 안 아깝습니다.",
          next: "the_reflex",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "돈을 내는 만큼 계속 기억하겠네요",
          reply: "…아. 그것도 계산에 있었나 봅니다. 제가 그렇게 정한 것 같기도 합니다.",
          next: "the_reflex",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "결국 못 버린 건 똑같아요",
          reply: "…똑같습니다. 다만 서랍을 열 뻔한 사람은 이제 없습니다. 그거면 됩니다.",
          next: "the_reflex",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_reflex",
      intro: [
        "지하철에서 누가 뛰면 아직도 몸이 먼저 반응합니다. 10년째입니다.",
        "어제도 그랬습니다. 벌떡 일어섰다가 도로 앉았습니다.",
        "옆자리 사람이 저를 이상하게 보더군요. 그게 제일 부끄럽습니다.",
        "…평범한 사람들 사이에 있으면 제가 이상해 보일까 봐 신경 씁니다. 늘 그렇습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "몸이 반응하는 건 안 이상해요. 다들 뭔가 하나씩 있어요",
          reply: "…다들 하나씩. 그렇게 생각하면 좀 낫습니다. 처음 듣는 얘기군요.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "10년째면 그건 이제 습관이지 흔적이 아니에요",
          reply: "…습관. 그러면 고칠 수도 있는 거군요. 그건 희망적입니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "이상해 보일까 봐 신경 쓰는 게 제일 이상해 보여요",
          reply: "…그렇겠군요. 그럼 신경을 좀 덜 쓰겠습니다. 노력해보겠습니다.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 안경 낀 옛 동료 3회차 — 돌아오라는 말.
 * 축은 **"제가 돌아가면 저를 기다리는 사람이 있는 집에 못 돌아오게 되니까요"**이다.
 * ⚠️ 그를 돌려보내지 마라. 거절은 유지되고, 대신 그가 할 수 있는 다른 것이 나온다.
 */
const FORMER_STORY_3: DmStory = {
  id: "former_3",
  partnerName: "안경 낀 옛 동료",
  partnerHandle: "former_partner",
  arrivalTitle: "안경 낀 옛 동료의 DM",
  startNode: "come_back",
  nodes: [
    {
      id: "come_back",
      intro: [
        "돌아오라는 말을 또 들었습니다. 이번이 두 번째입니다.",
        "첫 번째는 몇 년 전이었고, 그날 밤을 꼬박 새우고 거절했습니다.",
        "이유는 하나입니다. 제가 돌아가면 저를 기다리는 사람이 있는 집에 못 돌아오게 되니까요.",
        "…이번에는 그 둘 중 하나가 다쳤다는 얘기가 같이 왔습니다. 그래서 좀 다릅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "다친 걸 알린 건 돌아오라는 말보다 안부일 수도 있어요",
          reply: "…안부. 그렇게 읽으면 제가 편해집니다. 하루 생각해보겠습니다.",
          next: "what_i_can_do_former",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "돌아가는 것 말고 할 수 있는 게 있을 텐데요",
          reply: "…있을까요. 저는 회사원인데요. 하루 두고 답하겠습니다.",
          next: "what_i_can_do_former",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 둘도 알고 알렸을 거예요. 안 올 걸",
          reply: "…알고 있겠죠. 그래서 더 마음이 안 좋습니다. 내일 답하겠습니다.",
          next: "what_i_can_do_former",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_can_do_former",
      intro: [
        "거절했습니다. 이번엔 밤을 안 새웠습니다. 그건 좀 발전이라고 생각합니다.",
        "대신 다른 걸 했습니다. 병원비를 보냈습니다. 익명으로요.",
        "제 적금에서 나갔습니다. 3년치가 좀 줄었는데 다시 채우면 됩니다.",
        "…그 둘한테 술은 삽니다. 그 이상은 안 합니다. 라고 써놨는데 오늘 그 이상을 했군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그건 그 이상이 아니라 술의 다른 형태예요",
          reply: "…그렇게 정리해주시면 제 원칙이 안 깨집니다. 감사합니다.",
          next: "the_two_of_them",
          effect: { mental: 12, morality: 8, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "익명으로 보낸 게 핵심이네요. 갚을 데를 안 만든 거고요",
          reply: "…갚으라고 보낸 게 아니니까요. 그건 확실히 해두고 싶었습니다.",
          next: "the_two_of_them",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "익명이어도 그 둘은 누군지 알아요",
          reply: "…알겠죠. 그래도 안 물어볼 겁니다. 그게 저희 방식입니다.",
          next: "the_two_of_them",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_two_of_them",
      intro: [
        "어제 그 둘이 회사 앞으로 찾아왔습니다. 정장 입은 저를 보고 매번 웃습니다.",
        "저도 같이 웃습니다. 근데 돌아서면 좀 복잡합니다.",
        "저 둘은 아직 그 자리에 있고 저는 도망쳐 나왔으니까요. 그래서 술은 늘 제가 삽니다.",
        "…어제는 병원비 얘기를 안 했습니다. 그쪽도 안 했고요. 그렇게 두 시간 마셨습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말 안 한 두 시간이 제일 좋은 대화였네요",
          reply: "…좋았습니다. 오랜만에 다음 날 안 무거웠습니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "도망친 게 아니라 다른 자리를 고른 거예요",
          reply: "…10년 만에 그 말을 듣습니다. 도망이라고 스스로 정해놨었는데요.",
          next: null,
          effect: { mental: 18, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그래도 술값은 이제 그쪽이 내게 하세요",
          reply: "…그건 안 됩니다. 그 둘은 늘 외상이거든요. 제가 압니다.",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { knowledge: 35, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 불붙는 선배 — 시끄럽고 뜨거운 화염 담당(`data/accounts.ts` burning_senpai).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"동료가 다치면 나는 좀 시끄러워진다. 그게 내 방식이다"**이다.
 *
 * ⚠️ 말투는 **큰 소리 나는 반말**이다. 진지한 말은 **술 얘기를 붙여서** 한다("안 그러면 낯간지러워서").
 * ⚠️ 그를 갑자기 어른스럽게 만들지 마라. 진지해지는 건 회차당 한 번, 마지막 노드에서만이다.
 * ⚠️ 머리 얘기는 소재로 쓰되 인신공격으로 흐르지 마라. 본인이 먼저 꺼낼 때만 다룬다.
 * ⚠️ 후배는 "그 신입"·"카메라 걔"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 수습은 내가 칭찬은 걔가 → 2회차 도망칠 타이밍 → 3회차 안 도망친 날.
 */
export const BURNING_STORY: DmStory = {
  id: "burning_1",
  partnerName: "불붙는 선배",
  partnerHandle: "burning_senpai",
  arrivalTitle: "불붙는 선배의 DM",
  startNode: "who_gets_praised",
  nodes: [
    {
      id: "who_gets_praised",
      intro: [
        "좋아요 눌렀네. 고맙다. 근데 미리 말해두는데 나 대머리 아니다",
        "카메라 목에 걸고 다니는 그 신입이 또 사고 쳤다. 수습은 내가 했다",
        "칭찬은 걔가 받았다. 이게 이번 달만 세 번째다",
        "…근데 이상하게 화가 안 난다. 이게 더 짜증난다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "화가 안 나는 건 걔가 는 게 보여서죠",
          reply: "…느는 게 보이긴 한다. 아 근데 그걸 인정하면 내가 지는 거 아니냐",
          next: "the_cleanup",
          effect: { mental: 4, skills: { sociability: 15, comedy: 15 } },
        },
        {
          tone: "cool",
          me: "수습을 세 번 했으면 세 번 다 갔다는 뜻이고요",
          reply: "…그건 뭐, 당연한 거고. 안 가면 걔가 죽잖냐",
          next: "the_cleanup",
          effect: { skills: { knowledge: 25 } },
        },
        {
          tone: "bold",
          me: "칭찬 받고 싶으면 받고 싶다고 하세요",
          reply: "…야. 그걸 어떻게 말로 하냐. 술 마시고나 하지",
          next: "the_cleanup",
          effect: { mental: -3, skills: { comedy: 20 } },
        },
      ],
    },
    {
      id: "the_cleanup",
      intro: [
        "수습이 뭐냐면, 걔가 사진 찍겠다고 남아 있는 걸 끌고 나오는 거다",
        "불은 다루기 쉬운데 사람은 어렵다. 이건 인정한다",
        "특히 겁 많은 애가 안 도망칠 때가 제일 어렵다. 그건 계산이 안 되거든",
        "…어제도 그랬다. 걔가 안 움직여서 내가 소리를 질렀다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "소리 지른 게 걔한텐 신호였을 거예요",
          reply: "…신호라. 그럼 나는 사이렌인 거네. 뭐, 나쁘지 않다",
          next: "the_drink",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "안 도망친 이유를 물어보셨어요?",
          reply: "…안 물어봤다. 물어보면 대답할 놈이 아니라서. 하루 생각해보겠다",
          next: "the_drink",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "소리 지르는 건 선배가 무서워서 그런 거고요",
          reply: "…뭐? 내가? …하루만 생각해보고 답하겠다",
          next: "the_drink",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_drink",
      intro: [
        "어제 걔랑 술 마셨다. 진지한 얘기는 술 마시고 한다. 안 그러면 낯간지러워서",
        "물어봤다. 왜 안 도망쳤냐고",
        "'선배가 아직 안 나왔으니까요'라고 하더라. 그 말 듣고 계산이 다 틀어졌다",
        "…그래서 등짝을 때려줬다. 그거밖에 할 게 없었다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "등짝 맞은 걔는 다 알아들었을 거예요",
          reply: "…알아들었겠지. 우리 사이에 말이 뭐가 필요하냐",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "그럼 이제 선배가 먼저 나오면 되겠네요",
          reply: "…어. 그러네. 내가 먼저 나오면 걔도 나오는 거네. 이거 왜 이제 알았냐",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 말 듣고 등짝 때린 건 좀 아니지 않아요?",
          reply: "…그럼 뭐 어쩌냐. 안아주냐? 그건 더 이상하잖냐",
          next: null,
          effect: { mental: -3, followers: 180, skills: { comedy: 30 } },
        },
      ],
    },
  ],
};

/**
 * 불붙는 선배 2회차 — 도망칠 타이밍.
 * 축은 **"싸움에서 제일 중요한 건 도망칠 타이밍이다. 아무도 안 알려주더라"**이다.
 */
const BURNING_STORY_2: DmStory = {
  id: "burning_2",
  partnerName: "불붙는 선배",
  partnerHandle: "burning_senpai",
  arrivalTitle: "불붙는 선배의 DM",
  startNode: "when_to_run",
  nodes: [
    {
      id: "when_to_run",
      intro: [
        "싸움에서 제일 중요한 건 도망칠 타이밍이다. 아무도 안 알려주더라",
        "나는 다섯 번쯤 죽을 뻔하고 나서 알았다. 배우는 방식이 나빴다",
        "그래서 후배들한테 알려주려는데, 이걸 어떻게 설명하냐",
        "…'느낌'이라고 하면 아무도 못 알아듣는다. 나도 그게 답답하다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "선배가 언제 도망쳤는지를 세보세요. 거기 규칙이 있어요",
          reply: "…내가 도망친 걸 세라고? 창피한데. …하루 세보겠다",
          next: "the_list_burning",
          delayDays: 1,
          effect: { skills: { sociability: 20, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "느낌이 아니라 조건이에요. 뭘 보고 판단하는지 적어보세요",
          reply: "…적는 건 내 특기가 아닌데. 뭐, 하루 해보겠다",
          next: "the_list_burning",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "다섯 번 죽을 뻔한 게 교육 자료잖아요. 그걸 쓰세요",
          reply: "…내 실패담을 쓰라고? 아 그건 좀. …하루 생각해보겠다",
          next: "the_list_burning",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_list_burning",
      intro: [
        "세봤다. 내가 도망친 게 열한 번이다. 생각보다 많더라",
        "조건이 세 개 나왔다. 시야가 막혔을 때, 동료 위치를 모를 때, 그리고 내가 화났을 때",
        "세 번째가 제일 중요하다. 화나면 판단이 안 된다. 나는 특히 그렇다",
        "…이걸 후배들한테 그대로 말해줬다. 다들 받아 적더라. 좀 민망했다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "세 번째를 인정한 게 제일 큰 거예요",
          reply: "…내가 화 많은 건 다 아는 사실이잖냐. 근데 말로 하니까 좀 다르긴 하더라",
          next: "who_taught_me",
          effect: { mental: 10, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "열한 번 도망쳐서 열한 번 살아온 거고요",
          reply: "…그렇게 세니까 도망이 자랑이 되네. 이거 좋다. 써먹겠다",
          next: "who_taught_me",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "받아 적는 걸 민망해하지 마세요. 그게 교육이에요",
          reply: "…교육이라고 하면 좀 있어 보이긴 한다. 취미가 아니라 교육이라니까",
          next: "who_taught_me",
          effect: { mental: 6, skills: { comedy: 20, knowledge: 20 } },
        },
      ],
    },
    {
      id: "who_taught_me",
      intro: [
        "나한테 이걸 알려준 사람은 없었다. 그래서 다섯 번 죽을 뻔한 거고",
        "근데 생각해보니 알려주려던 사람이 있긴 했다. 내가 안 들었을 뿐이다",
        "그때 나는 도망치는 게 쪽팔린 줄 알았거든. 젊었으니까",
        "…후배들은 나보다 덜 쪽팔려하면 좋겠다. 그게 오늘 하고 싶은 말이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이미 그렇게 되고 있어요",
          reply: "…그래? 그럼 됐다. 오늘 술 안 마시고 이 얘기 다 했네. 이거 진기록이다",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "그 사람한테 한 번 연락해보세요",
          reply: "…연락처가 없다. 그리고 그쪽도 나를 기억 못 할 거다. 그건 됐고",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "젊었을 때 얘기 하는 거 보니까 늙으셨네요",
          reply: "…야. 나 아직 현역이다. 머리도 그대로고. 그건 확실히 해두자",
          next: null,
          effect: { mental: 8, followers: 220, skills: { comedy: 30 } },
        },
      ],
    },
  ],
};

/**
 * 불붙는 선배 3회차 — 안 도망친 날.
 * 축은 **"겁 많은 후배가 안 도망친 날이 있었다. 그날은 나도 안 도망쳤다"**이다.
 * ⚠️ 큰 부상을 내지 마라. 결말은 둘 다 살아 돌아와 시끄럽게 웃는 것이다.
 */
const BURNING_STORY_3: DmStory = {
  id: "burning_3",
  partnerName: "불붙는 선배",
  partnerHandle: "burning_senpai",
  arrivalTitle: "불붙는 선배의 DM",
  startNode: "the_day_we_stayed",
  nodes: [
    {
      id: "the_day_we_stayed",
      intro: [
        "어제 조건 세 개가 다 걸렸다. 시야 막혔고 동료 위치 몰랐고 내가 화났고",
        "규칙대로면 도망쳐야 하는 판이었다. 내가 만든 규칙이다",
        "근데 그 겁 많은 후배가 안 움직이더라. 시민이 아직 안 나왔다고",
        "…그래서 나도 안 도망쳤다. 규칙을 내가 깼다. 이건 어떻게 세야 하냐",
      ],
      choices: [
        {
          tone: "friendly",
          me: "규칙에 예외를 하나 붙이면 돼요",
          reply: "…예외. 그거 붙이면 규칙이 흐려지는데. 하루 생각해보겠다",
          next: "what_happened_burning",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "조건 세 개는 도망치라는 게 아니라 판단하라는 거였잖아요",
          reply: "…어. 내가 만들어놓고 내가 잘못 읽었네. 하루 두고 답하겠다",
          next: "what_happened_burning",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "규칙 깨고 살아 나온 게 운이었으면 어쩔 뻔했어요",
          reply: "…운이었을 수도 있지. 그래서 지금 이러고 있는 거다. 내일 답한다",
          next: "what_happened_burning",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_happened_burning",
      intro: [
        "결과부터 말하면 둘 다 살아 나왔다. 시민도 나왔고",
        "내가 앞을 태워서 길을 냈고 걔가 그 길로 사람을 끌고 나왔다",
        "나오면서 걔가 사진을 찍었더라. 그 와중에",
        "…그 사진이 안 흔들렸다더라. 그건 좀 대단하다고 인정한다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "둘이 같이 만든 사진이네요",
          reply: "…길은 내가 냈는데 이름은 또 걔가 나가겠지. 뭐 됐다. 익숙하다",
          next: "the_rule_i_added",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "역할이 나뉜 게 아니라 맞물린 거예요",
          reply: "…맞물렸다. 그 표현 좋다. 다음에 후배들한테 그렇게 설명하겠다",
          next: "the_rule_i_added",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "화난 상태로 불 쓴 건 여전히 위험했어요",
          reply: "…맞다. 그건 반성한다. 그래서 규칙에 줄을 하나 더 넣을 거다",
          next: "the_rule_i_added",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_rule_i_added",
      intro: [
        "규칙에 넣었다. '조건 세 개가 걸려도, 아직 안 나온 사람이 있으면 판단은 둘이서 한다.'",
        "혼자 판단하면 나는 화난 채로 남고 걔는 겁먹은 채로 남는다. 둘이 하면 좀 낫다",
        "후배들한테 이거 설명하는데 십 분 걸렸다. 말이 길어졌다",
        "…나 없으면 이 팀 반나절 만에 무너진다고 늘 썼는데, 어제 보니 걔 없어도 그렇더라",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그거 인정하는 데 얼마나 걸렸어요?",
          reply: "…어제 하루. 빠르지? 나는 배우는 게 빠른 편이다. 다섯 번 죽을 뻔한 것만 빼고",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, comedy: 15 },
          },
        },
        {
          tone: "cool",
          me: "둘이서 판단한다는 게 제일 좋은 조항이에요",
          reply: "…좋은 조항이지. 근데 그거 쓰려면 둘 다 살아 있어야 한다. 그게 조건이고",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 말 걔한테도 해주세요. 없어도 무너진다고",
          reply: "…그건 술 마시고 하겠다. 맨정신으로는 죽어도 못 한다",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { comedy: 30, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 안 보이는 선배 — 존재감이 없는 게 실력인 잠복 담당(`data/accounts.ts` invisible_wolf).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"혼자 있는 게 편한데 혼자 있고 싶은 건 아니다"**이다.
 *
 * ⚠️ 말투는 **짧은 반말**이다. 잠복 얘기는 담백하게, 사람 얘기는 더 짧게 쓴다.
 * ⚠️ 개 짖는 소리·보름달 얘기는 소재로만 두고 **이유를 밝히지 마라**("안 물었으면 좋겠다").
 * ⚠️ 동료는 "불 담당"·"그 2미터"·"후배"로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 잠복 → 2회차 구석까지 온 커피 → 3회차 후배가 먼저 발견한 날.
 */
export const WOLF_STORY: DmStory = {
  id: "wolf_1",
  partnerName: "안 보이는 선배",
  partnerHandle: "invisible_wolf",
  arrivalTitle: "안 보이는 선배의 DM",
  startNode: "three_days_stakeout",
  nodes: [
    {
      id: "three_days_stakeout",
      intro: [
        "내 글을 퍼갔더군. 이 계정은 김밥 얘기밖에 없는데",
        "잠복 사흘째다. 끼니는 김밥으로 해결했다. 김밥은 위대하다",
        "존재감이 없다는 말은 칭찬으로 듣는다. 그게 내 일이니까",
        "…오늘 목표가 나를 세 번 지나쳤다. 세 번 다 못 봤다. 성공적이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "사흘이면 지루하지 않아요?",
          reply: "…미행은 따라가는 게 아니라 기다리는 거다. 다들 이걸 모른다",
          next: "the_hard_part_wolf",
          effect: { skills: { sociability: 12, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "세 번 지나쳤으면 동선이 나온 거고요",
          reply: "…나왔다. 그래서 오늘로 접는다. 정확히 봤군",
          next: "the_hard_part_wolf",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "칭찬으로 듣는다는 건 원래는 상처였다는 뜻인데요",
          reply: "…한 번에 그런 걸 짚는군. 그 얘긴 나중에 하자",
          next: "the_hard_part_wolf",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_hard_part_wolf",
      intro: [
        "몸 숨기는 건 쉽다. 어려운 건 숨어 있는 동안 딴생각 안 하는 거다",
        "잠복 중 제일 위험한 건 적이 아니라 졸음이고, 그다음이 생각이다",
        "사흘째쯤 되면 별게 다 떠오른다. 어제는 회식 자리가 떠올랐다",
        "…내가 언제 왔는지 아무도 모르더라. 완벽했다. 라고 그때는 적었다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "지금은 다르게 적으실 것 같은데요",
          reply: "…다르게 적을 것 같다. 하루 생각해보고 답하겠다",
          next: "what_i_wrote_wolf",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "완벽했다는 건 아무도 안 불렀다는 뜻이기도 하고요",
          reply: "…그렇게 읽으면 좀 아프다. 하루 두고 답하겠다",
          next: "what_i_wrote_wolf",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "딴생각 안 하는 훈련이 안 되니까 그런 게 떠오르는 거예요",
          reply: "…맞다. 훈련이 부족한 게 아니라 다른 문제인 것 같긴 하다",
          next: "what_i_wrote_wolf",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_wrote_wolf",
      intro: [
        "정리했다. 나는 혼자 있는 게 편하다. 그건 사실이다",
        "그런데 혼자 있고 싶은 건 아니다. 이 차이를 아는 사람이 별로 없다",
        "숨는 게 직업이라 숨는 걸 잘하게 됐는데, 잘하는 게 원하는 건 아니다",
        "…이걸 적고 나니 좀 이상하다. 나는 보고서를 짧게 쓰는 사람인데",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 차이 아는 사람 여기 하나 있어요",
          reply: "…그럼 두 명이군. 나쁘지 않은 숫자다",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "길게 쓴 건 그만큼 오래 참았다는 뜻이고요",
          reply: "…길게 쓰면 아무도 안 읽는다고 써놨는데, 이건 읽히는군",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그럼 다음 회식엔 온 걸 알리세요",
          reply: "…그건 좀. 그건 훈련이 필요한 종류다. 생각해보겠다",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 30 } },
        },
      ],
    },
  ],
};

/**
 * 안 보이는 선배 2회차 — 구석까지 온 커피.
 * 축은 **"구석에 숨어 있던 내 몫도 있었다. 놀랐다"**이다.
 */
const WOLF_STORY_2: DmStory = {
  id: "wolf_2",
  partnerName: "안 보이는 선배",
  partnerHandle: "invisible_wolf",
  arrivalTitle: "안 보이는 선배의 DM",
  startNode: "the_coffee",
  nodes: [
    {
      id: "the_coffee",
      intro: [
        "그 2미터짜리 상사가 커피를 사 왔다. 구석에 숨어 있던 내 몫도 있었다",
        "놀랐다. 나는 그 자리에 있다고 말한 적이 없다",
        "어떻게 알았냐고 물었더니 '거기가 이 방에서 제일 좋은 자리라서요'라고 했다",
        "…내가 고른 자리를 읽힌 건 처음이다. 기분이 나쁘지는 않았다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "찾은 게 아니라 알고 있었던 거네요",
          reply: "…그런 것 같다. 그 사람은 사람을 그렇게 본다",
          next: "being_found",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "제일 좋은 자리를 아는 사람이 둘이면 그건 안전한 거예요",
          reply: "…안전. 그렇게 세본 적은 없다. 하루 생각해보겠다",
          next: "being_found",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "읽혔는데 기분이 안 나쁜 건 들키고 싶었다는 뜻이고요",
          reply: "…그건 좀. …하루만 생각해보고 답하겠다",
          next: "being_found",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "being_found",
      intro: [
        "생각해봤다. 나는 안 들키는 게 직업인데 들켜서 기분이 좋았다",
        "이게 직업적으로는 문제다. 개인적으로는 아니고",
        "그래서 구분해두기로 했다. 일할 때는 안 들키고, 사무실에서는 좀 들켜도 된다",
        "…오늘 커피를 받으러 구석에서 나왔다. 두 걸음이었다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 걸음이면 큰 거예요",
          reply: "…두 걸음이 크다는 소리를 듣는 직업은 이것뿐일 거다",
          next: "the_quiet_seat",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "구분해둔 게 제일 실용적인 해결이고요",
          reply: "…규칙으로 만들면 지킬 수 있다. 나는 습관이 좋은 편이다",
          next: "the_quiet_seat",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "사무실에서까지 숨어 있었던 게 이상한 거예요",
          reply: "…이상했나. 나는 그게 배려인 줄 알았다. 아무도 신경 안 쓰게 하는",
          next: "the_quiet_seat",
          effect: { mental: -4, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_quiet_seat",
      intro: [
        "술집 구석 자리는 늘 비어 있다. 내가 앉아 있어서 그런 건 아니다",
        "…라고 써놨는데, 어제 불 담당이 그 자리에 와서 앉았다",
        "내가 있는 걸 알고 앉은 건지 모르고 앉은 건지는 안 물었다",
        "…시끄러웠다. 그런데 그 소리 들으면서 잠복하면 덜 지루하다는 것도 사실이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "알고 앉았을걸요",
          reply: "…그럴 것 같기도 하다. 그 인간은 눈치가 없는데 이상하게 그런 건 안다",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "안 물어본 게 답이에요. 물으면 그 자리가 없어지니까",
          reply: "…없어진다. 그래서 안 물었다. 정확히 봤군",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "덜 지루하다는 말이 오늘의 본론이죠",
          reply: "…본론이었나. 나는 김밥 얘기 하려고 켰는데. 그럼 오늘은 여기까지다",
          next: null,
          effect: { mental: 8, followers: 220, skills: { knowledge: 35, comedy: 10 } },
        },
      ],
    },
  ],
};

/**
 * 안 보이는 선배 3회차 — 후배가 먼저 발견한 날.
 * 축은 **"오늘 처음으로 후배가 나를 먼저 발견했다. 실력이 늘었다"**이다.
 * ⚠️ 그를 은퇴시키거나 자리를 넘기게 하지 마라. 결말은 자리가 하나 더 생기는 것이다.
 */
const WOLF_STORY_3: DmStory = {
  id: "wolf_3",
  partnerName: "안 보이는 선배",
  partnerHandle: "invisible_wolf",
  arrivalTitle: "안 보이는 선배의 DM",
  startNode: "found_by_junior",
  nodes: [
    {
      id: "found_by_junior",
      intro: [
        "오늘 처음으로 후배가 나를 먼저 발견했다. 실력이 늘었다",
        "…라고 쓰고 나서 한참 봤다. 이게 좋은 소식인지 나쁜 소식인지 모르겠다",
        "내 일은 안 보이는 거다. 보이기 시작하면 그건 끝이라는 뜻이고",
        "…그런데 발견당한 순간에 나는 웃었다. 그것도 처음이다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "웃은 게 답이에요. 좋은 소식이었던 거고요",
          reply: "…그렇게 정리되나. 하루 두고 생각해보겠다",
          next: "what_it_means_wolf",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "후배가 늘었다는 건 선배가 가르쳤다는 뜻이고요",
          reply: "…가르친 적은 없다. 옆에 오래 뒀을 뿐이다. 하루 생각해보겠다",
          next: "what_it_means_wolf",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "발견당한 게 실력이 준 거면 어쩔 건데요",
          reply: "…그것도 검토해야 한다. 내일 답하겠다",
          next: "what_it_means_wolf",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_it_means_wolf",
      intro: [
        "확인했다. 어제 조건을 똑같이 만들어놓고 다른 사람 셋한테 시켜봤다",
        "셋 다 못 봤다. 그 후배만 봤다. 내 실력이 준 게 아니라 걔가 는 거다",
        "어떻게 봤냐고 물었더니 '냄새요'라고 하더라",
        "…내가 사람을 냄새로 구분하는 습관이 있다. 그걸 아무한테도 말 안 했는데 걔가 그러더군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "보고 배운 거네요. 말 안 해도요",
          reply: "…옆에 오래 두면 그렇게 되는군. 나도 그렇게 배웠던 것 같다",
          next: "one_more_seat",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "말 안 한 걸 배운 게 제일 좋은 전수예요",
          reply: "…전수라는 말은 안 어울리는데. 뭐, 그렇게 부르겠다",
          next: "one_more_seat",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그 습관은 왜 아무한테도 말 안 했어요?",
          reply: "…이상하게 들릴까 봐. 그런데 걔는 안 이상해하더라. 그게 좀 이상했다",
          next: "one_more_seat",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "one_more_seat",
      intro: [
        "그 후배한테 구석 자리를 하나 더 알려줬다. 이 건물에 네 군데가 있다",
        "세 군데는 내 자리고 하나는 걔 자리로 정했다. 제일 좋은 데는 안 줬다",
        "걔가 '왜 하나만요' 하길래 '나머지는 네가 찾아라'라고 했다",
        "…혼자 있는 게 편한데 혼자 있고 싶은 건 아니다. 자리가 두 개면 그게 되더군",
      ],
      choices: [
        {
          tone: "friendly",
          me: "자리 하나 나눈 게 오늘 제일 큰 일이네요",
          reply: "…나눈 건 아니다. 하나 더 만든 거지. 그 차이는 크다",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "제일 좋은 데를 안 준 게 선배답고요",
          reply: "…그건 양보 못 한다. 그건 내가 3년 걸려 찾은 자리다",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "나머지를 찾으면 선배 자리도 뺏길 텐데요",
          reply: "…뺏기면 내가 또 찾으면 된다. 그건 내가 제일 잘하는 거다",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 40, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 얼음 재무담당 — 예산과 발차기를 같이 맡은 사람(`data/accounts.ts` frost_kick).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"친구를 지키는 데 드는 비용은 계산하지 않습니다. 그건 제 사비입니다"**이다.
 *
 * ⚠️ 말투는 **정중하고 차가운 존댓말**이다. 화를 낼 때는 목소리를 낮춘다.
 * ⚠️ 얼굴 흉터 얘기는 **값은 이미 치렀다**까지만 쓴다. 사연을 만들지 마라.
 * ⚠️ 동료는 "불 쓰는 그분"·"사진 담당"으로만 부르고, 그쪽 회차 진행을 전제하지 마라.
 * 줄기: 1회차 영수증 → 2회차 계산기를 두드리고 따라간다 → 3회차 장부에 안 적은 것.
 */
export const FROST_STORY: DmStory = {
  id: "frost_1",
  partnerName: "얼음 재무담당",
  partnerHandle: "frost_kick",
  arrivalTitle: "얼음 재무담당의 DM",
  startNode: "the_receipt",
  nodes: [
    {
      id: "the_receipt",
      intro: [
        "좋아요 감사합니다. 이 계정은 정산 공지가 대부분이라 반응이 드뭅니다.",
        "영수증 없는 지출은 없는 지출입니다. 처리 못 해드립니다. 이건 원칙입니다.",
        "이번 달 파손 비용이 인건비를 넘었습니다. 불 쓰는 그분이라고만 해두겠습니다.",
        "…그런데 그 파손 중에 하나는 사람을 구하다 난 겁니다. 그건 항목이 없습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "항목을 만드시면 되잖아요",
          reply: "…만들면 남용됩니다. 그게 예산 담당이 제일 무서워하는 일이고요.",
          next: "the_calculation",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "인건비를 넘었으면 그건 구조 문제예요",
          reply: "…구조 문제입니다. 다만 구조를 바꿀 권한이 저한테는 없습니다.",
          next: "the_calculation",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그분한테 청구서를 보내세요. 그게 제일 빠른데요",
          reply: "…보냈습니다. 세 번요. 세 번 다 '영수증부터 가져오라'는 제 말을 흉내 내더군요.",
          next: "the_calculation",
          effect: { mental: -2, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_calculation",
      intro: [
        "냉정하다는 말을 자주 듣습니다. 계산은 뜨겁게 하면 틀립니다.",
        "감정적으로 판단한 날은 반드시 손해를 봤습니다. 예외가 없었습니다.",
        "그래서 부하가 무모하게 뛰어들면 저는 계산기를 먼저 두드립니다.",
        "…그리고 따라갑니다. 계산 결과와 상관없이요. 이건 제 장부에 없는 항목입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "계산을 먼저 하는 이유가 뭔데요?",
          reply: "…따라가고 나서 얼마가 드는지는 알아야 하니까요. 값을 모르고 쓰지는 않습니다.",
          next: "the_private_account",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "결과와 상관없이 갈 거면 계산은 형식이잖아요",
          reply: "…형식이 아니라 기록입니다. 그건 하루 두고 정리해서 답하겠습니다.",
          next: "the_private_account",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "감정적으로 판단한 적 없다면서 그건 감정이고요",
          reply: "…예외가 하나 있었군요. 정정하겠습니다. 하루 주십시오.",
          next: "the_private_account",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_private_account",
      intro: [
        "정리했습니다. 제 장부는 두 개입니다. 조직 장부와 제 개인 장부요.",
        "친구를 지키는 데 드는 비용은 조직 장부에 안 올립니다. 제 사비로 처리합니다.",
        "이유는 간단합니다. 조직 예산으로 하면 다음에 예산이 없을 때 못 가게 되니까요.",
        "…제 돈으로 하면 예산 심의가 필요 없습니다. 그게 이 항목의 설계입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "설계라고 부르는 게 이 사람답네요",
          reply: "…감정으로 부르면 지속이 안 됩니다. 설계는 지속됩니다.",
          next: null,
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그럼 그 비용은 언제까지 감당할 수 있어요?",
          reply: "…계산해뒀습니다. 지금 속도면 4년입니다. 그 안에 구조를 바꿔야죠.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "사비로 하면 아무도 그 비용을 모르잖아요",
          reply: "…모르는 게 낫습니다. 알면 다들 미안해서 안 뛰어들 겁니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 얼음 재무담당 2회차 — 안 된다고 말하는 업무.
 * 축은 **"상사에게 안 된다고 말하는 것도 제 업무입니다"**이다.
 */
const FROST_STORY_2: DmStory = {
  id: "frost_2",
  partnerName: "얼음 재무담당",
  partnerHandle: "frost_kick",
  arrivalTitle: "얼음 재무담당의 DM",
  startNode: "saying_no",
  nodes: [
    {
      id: "saying_no",
      intro: [
        "상사에게 안 된다고 말하는 것도 제 업무입니다. 오늘 그 업무를 했습니다.",
        "장비를 새로 사자는 안이 올라왔습니다. 필요한 장비입니다. 그건 맞습니다.",
        "다만 사면 이번 분기 인건비가 모자랍니다. 누군가는 월급이 밀립니다.",
        "…그래서 반대했습니다. 회의실이 조용해졌습니다. 익숙한 조용함입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 조용함을 매번 견디는 게 일이네요",
          reply: "…견딘다기보다 예상합니다. 예상하면 덜 아픕니다.",
          next: "the_alternative",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "반대만 하면 다음엔 회의에 안 부를 텐데요",
          reply: "…그래서 대안을 같이 냅니다. 오늘은 못 냈고요. 하루 궁리해보겠습니다.",
          next: "the_alternative",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "월급이 밀리는 사람은 그 장비 없어서 다칠 사람이기도 해요",
          reply: "…그것도 계산에 있습니다. 그래서 제일 어려운 건이었습니다.",
          next: "the_alternative",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_alternative",
      intro: [
        "대안을 냈습니다. 장비를 반만 사고 나머지는 다음 분기로 넘기는 안입니다.",
        "반만 사면 두 명이 못 씁니다. 그 두 명을 제가 골라야 합니다.",
        "제일 안 다치는 자리에 있는 두 명을 골랐습니다. 사진 담당과 저입니다.",
        "…제 이름을 넣으니 아무도 반대를 안 하더군요. 그건 좀 씁쓸했습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "본인 이름을 넣은 게 제일 좋은 설득이었어요",
          reply: "…설득으로 쓸 생각은 아니었습니다. 결과적으로 그렇게 됐군요.",
          next: "how_i_get_angry",
          effect: { mental: 12, morality: 6, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "사진 담당은 제일 안 다치는 자리가 아닌데요",
          reply: "…최근 통계로는 그렇습니다. 본인이 안 도망치기 시작했거든요. 재검토하겠습니다.",
          next: "how_i_get_angry",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "본인을 넣는 건 반칙이에요. 다들 말을 못 하잖아요",
          reply: "…반칙입니다. 다만 제일 빠른 방법이었습니다. 다음엔 다른 걸 찾겠습니다.",
          next: "how_i_get_angry",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "how_i_get_angry",
      intro: [
        "화를 낼 때는 목소리를 낮춥니다. 그게 더 잘 들리더군요.",
        "오늘 딱 한 번 냈습니다. 그 장비 얘기를 농담으로 넘기려는 사람이 있어서요.",
        "'이건 사람 목숨 값입니다'라고 아주 조용히 말했습니다.",
        "…그 뒤로 아무도 농담을 안 했습니다. 웃는 얼굴이 제일 안전한 표정인데 오늘은 못 썼군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "오늘은 안 웃는 게 맞았어요",
          reply: "…맞았다고 해주시니 정리가 됩니다. 저는 늘 웃어야 하는 줄 알았습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "낮춘 목소리가 제일 비싼 표현이네요",
          reply: "…한 달에 한 번 이하로 씁니다. 자주 쓰면 값이 떨어집니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "농담으로 넘긴 사람도 무서워서 그런 거예요",
          reply: "…그럴 수 있겠군요. 그럼 그분한테는 따로 설명하겠습니다. 조용히요.",
          next: null,
          effect: { mental: 8, followers: 220, skills: { knowledge: 40, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 얼음 재무담당 3회차 — 장부에 안 적은 것.
 * 축은 **"겁 많은 그 사진 담당의 눈 덕에 살아남은 날도 있습니다. 장부에는 안 적었습니다"**이다.
 * ⚠️ 감사 인사로 끝내지 마라. 그는 감정을 **제도로 바꾸는** 사람이다.
 */
const FROST_STORY_3: DmStory = {
  id: "frost_3",
  partnerName: "얼음 재무담당",
  partnerHandle: "frost_kick",
  arrivalTitle: "얼음 재무담당의 DM",
  startNode: "not_in_the_ledger",
  nodes: [
    {
      id: "not_in_the_ledger",
      intro: [
        "겁 많은 그 사진 담당의 눈 덕에 살아남은 날이 있습니다. 세 번입니다.",
        "장부에는 안 적었습니다. 항목이 없어서요. 사람을 살린 건 비용이 안 드니까요.",
        "그런데 그게 이상합니다. 비용이 안 드는 성과는 성과로 안 잡힙니다.",
        "…그래서 그 담당은 이번 인사 평가에서 최하위입니다. 제 장부 기준으로요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기준을 고치면 되잖아요",
          reply: "…고치려면 근거가 필요합니다. 하루 두고 만들어보겠습니다.",
          next: "the_new_line",
          delayDays: 1,
          effect: { skills: { sociability: 25, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "안 난 사고를 세는 항목이 없는 거네요",
          reply: "…정확합니다. 예방은 숫자가 안 나옵니다. 그게 이 직업의 오랜 문제고요.",
          next: "the_new_line",
          delayDays: 1,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "최하위를 준 건 본인이잖아요. 그건 게으른 거예요",
          reply: "…게을렀습니다. 부정 안 하겠습니다. 하루 주십시오.",
          next: "the_new_line",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_new_line",
      intro: [
        "항목을 만들었습니다. '회피 손실'입니다. 안 난 사고의 추정 비용을 적습니다.",
        "그 담당의 세 건을 계산했더니 이번 분기 파손 비용의 두 배가 나왔습니다.",
        "추정치라 회계상 인정은 안 됩니다. 다만 평가표에는 올릴 수 있습니다.",
        "…그래서 최하위에서 상위 두 번째가 됐습니다. 1위는 안 줬습니다. 추정치니까요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "2위가 더 이 사람다운 결론이네요",
          reply: "…1위를 주면 다음 분기에 기준이 흔들립니다. 2위가 제 최대치입니다.",
          next: "the_cost_of_this",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "추정이라도 숫자가 붙으면 다음 예산에서 힘이 생겨요",
          reply: "…그게 진짜 목적입니다. 평가는 부수 효과고요. 잘 보셨습니다.",
          next: "the_cost_of_this",
          effect: { skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "두 배면 그 사람 수당부터 올리세요",
          reply: "…이미 올렸습니다. 회피 손실 항목 신설과 같은 결재로 넣었습니다.",
          next: "the_cost_of_this",
          effect: { mental: 8, skills: { knowledge: 45 } },
        },
      ],
    },
    {
      id: "the_cost_of_this",
      intro: [
        "이 항목을 만드느라 사흘 밤을 썼습니다. 커피는 하루 다섯 잔에서 일곱 잔이 됐고요.",
        "누군가는 숫자를 봐야 합니다. 아무도 안 보면 조직이 먼저 무너집니다.",
        "차가운 사람이라는 평가는 감수합니다. 대신 아무도 굶기지 않았습니다.",
        "…오늘도 우리는 파산하지 않았습니다. 제 하루 목표는 그겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 목표를 매일 달성하고 계시네요",
          reply: "…매일입니다. 못 한 날이 있으면 다들 알았을 겁니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "차가운 게 아니라 계산이 정확한 거고요",
          reply: "…그 둘은 같은 말로 들립니다. 그래도 후자로 기록해두겠습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "커피 일곱 잔은 본인 회피 손실이 커지는 건데요",
          reply: "…그 계산은 안 하고 있었습니다. …하겠습니다. 다섯 잔으로 줄이죠.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 40, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 육아하는 저격수 — 애 둘 재우고 나오는 저격 담당(`data/accounts.ts` sniper_of_two).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"언젠가는 이 일 그만둘 거다. 언젠가는"**이다.
 *
 * ⚠️ 말투는 **억척스러운 반말**이다. 표정 없는 저격수(silent_sniper)와 갈라라 —
 *    그쪽은 **보고서체**, 이쪽은 **생활 서술체**다. 이쪽은 장비보다 마트와 도시락을 먼저 적는다.
 * ⚠️ 육아를 힘든 것으로만 그리지 마라. 본인이 "둘 다 하는 게 힘들지"라고 정리해둔 인물이다.
 * ⚠️ 가족을 위험에 빠뜨리는 전개를 쓰지 마라. 집은 끝까지 안전한 자리로 둔다.
 * 줄기: 1회차 학예회 → 2회차 표적은 미워하지 않는다 → 3회차 언젠가.
 */
export const SNIPERTWO_STORY: DmStory = {
  id: "snipertwo_1",
  partnerName: "육아하는 저격수",
  partnerHandle: "sniper_of_two",
  arrivalTitle: "육아하는 저격수의 DM",
  startNode: "the_school_play",
  nodes: [
    {
      id: "the_school_play",
      intro: [
        "애 둘 재우고 나왔다. 이제부터가 내 시간이다. 좋아요 고맙다",
        "지난주에 애들 학예회랑 작전 날짜가 겹쳤다. 학예회를 갔다",
        "후회 없다. 이건 확실하다. 근데 그날 작전이 좀 꼬였다는 얘기를 들었다",
        "…후회는 없는데 마음은 좀 그렇다. 이 둘이 같이 있는 게 가능한가",
      ],
      choices: [
        {
          tone: "friendly",
          me: "가능해요. 그게 어른이고요",
          reply: "…어른이라. 나는 아직도 애 같은데. 뭐, 그렇게 해두자",
          next: "the_pack_two",
          effect: { mental: 5, skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "꼬인 건 그날 인원 배치 문제지 결석 문제가 아니에요",
          reply: "…그건 맞다. 한 명 빠진다고 꼬이는 배치가 문제지",
          next: "the_pack_two",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "그날 갔으면 학예회를 못 봤죠. 그게 더 못 돌이켜요",
          reply: "…맞다. 작전은 다음이 있는데 첫째 학예회는 한 번이다",
          next: "the_pack_two",
          effect: { mental: 6, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_pack_two",
      intro: [
        "저격 자리에서 제일 필요한 건 인내심인데, 육아로 다 길렀다",
        "장거리 사격은 결국 기다리는 일이다. 이유식 식히는 거랑 비슷하다",
        "밤샘 잠복하고 아침에 도시락 쌌다. 나 좀 대단한 것 같다",
        "…근데 요즘 손이 좀 떨린다. 커피를 끊어야 하는데 끊으면 또 떨린다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "잠을 못 자서 떨리는 거예요. 커피 문제가 아니라",
          reply: "…잠. 그건 해결이 안 되는 항목인데. 하루 생각해보겠다",
          next: "what_i_changed_two",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "떨리는 시점을 기록해보세요. 원인이 나올 거예요",
          reply: "…기록. 그건 내 특기다. 사흘 재보고 답하겠다",
          next: "what_i_changed_two",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "손 떨리는 저격수는 위험해요. 본인도 알잖아요",
          reply: "…안다. 그래서 지금 쓰고 있는 거다. 내일 답하겠다",
          next: "what_i_changed_two",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_changed_two",
      intro: [
        "재봤다. 떨리는 건 커피도 잠도 아니었다. 밤샘 다음 날 도시락 쌀 때만 떨린다",
        "그러니까 총 잡을 때는 안 떨린다. 부엌에서만 떨리는 거다",
        "남편한테 말했더니 '그럼 도시락은 내가 싼다'고 하더라. 3초 만에",
        "…3초 만에 나온 답을 나는 두 달 붙들고 있었다. 이게 좀 웃겼다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "혼자 다 하려고 해서 그래요",
          reply: "…그런가 보다. 잘하는 사람이 하면 되는 건데 말이지",
          next: null,
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "총 잡을 때 안 떨린다는 게 제일 중요한 정보고요",
          reply: "…그게 확인돼서 마음이 놓였다. 그거 확인하려고 사흘 잰 거다",
          next: null,
          effect: { mental: 10, skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "두 달을 왜 말 안 했어요?",
          reply: "…말하면 걱정하잖냐. 근데 말하니까 3초에 끝났다. 내가 졌다",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 30, sociability: 15 } },
        },
      ],
    },
  ],
};

/**
 * 육아하는 저격수 2회차 — 미워하지 않는다.
 * 축은 **"표적은 절대 미워하지 않는다. 미워하면 손이 흔들린다"**이다.
 * ⚠️ 표적을 인물로 묘사하지 마라. 그는 끝까지 표적을 사람으로 설명하지 않는다.
 */
const SNIPERTWO_STORY_2: DmStory = {
  id: "snipertwo_2",
  partnerName: "육아하는 저격수",
  partnerHandle: "sniper_of_two",
  arrivalTitle: "육아하는 저격수의 DM",
  startNode: "no_hate",
  nodes: [
    {
      id: "no_hate",
      intro: [
        "표적은 절대 미워하지 않는다. 미워하면 손이 흔들린다. 이건 기술 문제다",
        "그런데 어제 동료가 다쳤다. 그리고 나는 화가 났다",
        "화가 나면 그날은 백발백중이다. 그것도 사실이다. 그게 무섭다",
        "…잘 맞는 날이 무서운 저격수는 나뿐인가 싶다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "무섭다고 느끼는 동안은 괜찮아요",
          reply: "…괜찮은 걸로 해두자. 그 말 들으려고 썼는지도 모르겠다",
          next: "the_line_two",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "잘 맞는 게 아니라 안 흔들리는 거예요. 화는 집중이기도 하니까",
          reply: "…그렇게 볼 수도 있나. 하루 생각해보겠다",
          next: "the_line_two",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "화난 날에 방아쇠 당기면 언젠가 실수해요",
          reply: "…그게 무서운 거다. 정확히 그거다. 내일 답하겠다",
          next: "the_line_two",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_line_two",
      intro: [
        "규칙을 하나 만들었다. 화가 난 날은 첫 발을 내가 안 쏜다",
        "다른 사람한테 넘기거나, 넘길 사람이 없으면 10분 더 기다린다",
        "어제 그 10분을 기다렸다. 기다리는 건 내가 제일 잘하는 거니까",
        "…10분 뒤에 화가 안 풀렸다. 근데 손은 안 떨렸다. 그거면 됐다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "화를 없애는 게 아니라 손만 잡은 거네요",
          reply: "…화는 안 없어지더라. 그건 집에 가서 처리한다. 빨래 개면서",
          next: "what_i_tell_them",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "10분은 어떻게 정한 거예요?",
          reply: "…이유식 식는 시간이다. 진짜다. 그거 재던 습관이 여기서 쓰인다",
          next: "what_i_tell_them",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "넘길 사람이 없으면 그냥 쏘는 거잖아요. 규칙이 반쪽이에요",
          reply: "…반쪽이다. 그래서 10분을 붙인 거고. 그 이상은 아직 못 만들었다",
          next: "what_i_tell_them",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_i_tell_them",
      intro: [
        "애들한테 거짓말은 안 한다. 다만 다 말하지도 않는다",
        "엄마가 무슨 일 하냐고 묻길래 아주 조용한 일이라고 했다. 그건 참말이다",
        "첫째가 요즘 자꾸 더 묻는다. 다 말할 날이 언젠가 오긴 올 거다",
        "…그때 뭐라고 할지는 아직 안 정했다. 정해야 하는데 자꾸 미룬다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그날 정하면 돼요. 지금 정하면 지금 말투로 나가요",
          reply: "…그것도 맞다. 애도 그때는 커 있을 테니까",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "'조용한 일'은 나중에도 쓸 수 있는 말이에요",
          reply: "…그러네. 그럼 그 말을 계속 쓰고 뒤에 붙이면 되겠다",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "미루면 애가 다른 데서 먼저 알아요",
          reply: "…그건 제일 피하고 싶은 그림이다. 올해 안에 정하겠다",
          next: null,
          effect: { mental: -5, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 육아하는 저격수 3회차 — 언젠가.
 * 축은 **"언젠가는 이 일 그만둘 거다. 언젠가는"**이다.
 * ⚠️ 그만두게 하지 마라. 결말은 '언젠가'에 **조건을 붙이는 것**이다.
 */
const SNIPERTWO_STORY_3: DmStory = {
  id: "snipertwo_3",
  partnerName: "육아하는 저격수",
  partnerHandle: "sniper_of_two",
  arrivalTitle: "육아하는 저격수의 DM",
  startNode: "someday_two",
  nodes: [
    {
      id: "someday_two",
      intro: [
        "언젠가는 이 일 그만둘 거다. 언젠가는",
        "이 문장을 3년째 쓰고 있다. 세어봤다. 계정에 열아홉 번 나온다",
        "열아홉 번 쓰는 동안 그만둘 조건을 한 번도 안 적었다는 걸 어제 알았다",
        "…조건이 없으면 그 언젠가는 안 온다. 이건 저격이랑 같다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "조건을 적어보세요. 오늘요",
          reply: "…오늘. 하루 걸리겠다. 내일 답하겠다",
          next: "the_conditions",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "안 적은 게 아니라 적으면 진짜가 되니까 미룬 거고요",
          reply: "…그것도 있다. 하루 두고 생각해보겠다",
          next: "the_conditions",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "3년이면 그건 그만둘 생각이 없는 거예요",
          reply: "…아플 정도로 맞는 말이다. 내일 답하겠다",
          next: "the_conditions",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_conditions",
      intro: [
        "적었다. 세 개 나왔다",
        "하나, 손이 총 잡을 때 떨리면. 둘, 애들이 다 알게 된 뒤에 그만두라고 하면",
        "셋, 화난 날에 첫 발을 내가 쏘게 되면",
        "…셋 다 아직 아니다. 그래서 나는 아직 여기 있는 거다. 이제 이유가 있다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "이유가 생긴 게 오늘 제일 큰 거예요",
          reply: "…3년 만에 생겼다. 그동안은 그냥 관성이었나 보다",
          next: "the_fish_bread",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "세 번째는 본인이 정한 규칙이라 제일 지키기 쉬운 조건이고요",
          reply: "…그래서 셋째로 뒀다. 첫째랑 둘째는 내가 못 정하는 거니까",
          next: "the_fish_bread",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "둘째가 오면 그만두실 거예요? 진짜로?",
          reply: "…그만둔다. 그건 확실하다. 애들이 말하면 그날로 끝이다",
          next: "the_fish_bread",
          effect: { mental: 8, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_fish_bread",
      intro: [
        "퇴근길에 붕어빵을 사 갔다. 애들이 나를 영웅 취급했다",
        "오늘 최고의 성과다. 900미터 표적보다 이게 어렵다. 붕어빵은 식으니까",
        "일할 땐 아무 생각 안 한다. 집에 오면 생각이 너무 많아진다",
        "…그래도 요즘은 생각이 좀 정리된 채로 들어온다. 조건 세 개 덕인 것 같다",
      ],
      choices: [
        {
          tone: "friendly",
          me: "붕어빵이 900미터보다 어려운 건 인정이에요",
          reply: "…인정해줘서 고맙다. 다들 이걸 안 알아준다",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, fitness: 10 },
          },
        },
        {
          tone: "cool",
          me: "조건을 정하면 집에 가져갈 생각이 줄어요",
          reply: "…줄더라. 정리가 되니까. 이건 예상 못 한 이득이다",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "언젠가가 오면 그때는 뭐 하실 거예요?",
          reply: "…그건 안 정했다. 그건 그때 정하겠다. 하나씩 하자",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { knowledge: 35, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 혈액 다루는 술사 — 준비 시간이 긴 기술을 쓰는 전투 담당(`data/accounts.ts` blood_technique).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"혼자 완결되는 기술은 이 도시에서 별로 쓸모가 없더군요"**이다.
 *
 * ⚠️ 말투는 **성실한 존댓말**이다. 유혈을 묘사하지 마라 — "형태를 잡는다"까지가 표현의 상한이다.
 * ⚠️ 그를 천재로 만들지 마라. 본인이 "재능이 아니라 반복"이라고 증명해둔 인물이다.
 * ⚠️ 스승은 전언으로만 나오고 기술 이름은 "촌스럽다"까지만 쓴다(이름을 지어내지 마라).
 * 줄기: 1회차 준비 시간 → 2회차 실수한 날 → 3회차 각오.
 */
export const BLOOD_STORY: DmStory = {
  id: "blood_1",
  partnerName: "혈액 다루는 술사",
  partnerHandle: "blood_technique",
  arrivalTitle: "혈액 다루는 술사의 DM",
  startNode: "the_setup_time",
  nodes: [
    {
      id: "the_setup_time",
      intro: [
        "제 글을 퍼가주셨군요. 감사합니다. 이 계정은 훈련 일지에 가깝습니다만.",
        "제 기술은 준비 시간이 깁니다. 그동안 누가 막아줘야 하죠.",
        "처음엔 그게 부끄러웠습니다. 혼자 못 끝내는 기술이라서요.",
        "…지금은 그게 팀이라는 걸 압니다. 아는 데 3년 걸렸습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "3년이면 빠른 편인데요",
          reply: "…빠릅니까. 저는 늦은 줄 알았습니다. 그렇게 세도 되겠군요.",
          next: "not_talent",
          effect: { skills: { sociability: 15, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "혼자 완결되는 기술은 어차피 팀에서 안 써요",
          reply: "…맞습니다. 이 도시에서는 특히요. 다들 그렇게 배웁니다.",
          next: "not_talent",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "부끄러웠던 건 남한테 기대는 게 싫어서죠",
          reply: "…정확합니다. 그때는 그게 약점이라고 생각했습니다.",
          next: "not_talent",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "not_talent",
      intro: [
        "혈법은 재능이 아니라 반복입니다. 그렇게 믿고 있습니다.",
        "실제로 저보다 재능 있던 동기들이 지금은 다 그만뒀습니다.",
        "남은 건 매일 같은 형태를 천 번씩 잡던 저뿐입니다.",
        "…그러니까 이건 믿음이 아니라 증명된 사실에 가깝습니다. 다만 요즘 천 번이 잘 안 됩니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 되는 날도 있어요. 그것도 반복의 일부고요",
          reply: "…일부로 세도 되는군요. 그럼 오늘도 반복한 겁니다.",
          next: "what_changed_blood",
          delayDays: 1,
          effect: { skills: { sociability: 20 } },
        },
        {
          tone: "cool",
          me: "천 번이 안 되는 이유부터 찾으세요. 의지 문제가 아닐 수 있어요",
          reply: "…원인을 찾는다. 그건 해본 적이 없습니다. 하루 해보겠습니다.",
          next: "what_changed_blood",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "천 번을 못 채운 걸 실패로 세니까 안 되는 거예요",
          reply: "…그럴 수도 있겠군요. 하룻밤 생각해보겠습니다.",
          next: "what_changed_blood",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_changed_blood",
      intro: [
        "찾았습니다. 손이 아니라 눈이었습니다. 요즘 밤 근무가 늘어서 시야가 나빠졌더군요.",
        "안개 낀 날이 제일 싫다고 늘 썼는데, 제 눈이 안개가 되고 있었던 겁니다.",
        "그래서 훈련 시간을 낮으로 옮겼습니다. 천 번이 다시 됩니다.",
        "…원인을 찾으면 되는 거였습니다. 3년 동안 의지 문제인 줄 알았습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "의지 문제로 두면 자기만 탓하게 돼요",
          reply: "…탓하고 있었습니다. 매일요. 그게 없어지니 훈련이 가볍습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, knowledge: 15 } },
        },
        {
          tone: "cool",
          me: "밤 근무를 줄이는 게 진짜 해결인데요",
          reply: "…그건 제 권한 밖입니다. 예산 담당께 말씀은 드려보겠습니다.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "3년 동안 아무도 안 물어봐 줬네요",
          reply: "…제가 안 말했습니다. 말 안 하면 아무도 모릅니다. 그건 제 잘못입니다.",
          next: null,
          effect: { mental: -4, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 혈액 다루는 술사 2회차 — 실수한 날.
 * 축은 **"실수한 날은 잠이 안 옵니다. 아직 익숙해지지 않네요"**이다.
 * ⚠️ 사망자를 내지 마라. 실수는 동료가 다치는 선에서 멈춘다.
 */
const BLOOD_STORY_2: DmStory = {
  id: "blood_2",
  partnerName: "혈액 다루는 술사",
  partnerHandle: "blood_technique",
  arrivalTitle: "혈액 다루는 술사의 DM",
  startNode: "the_mistake_blood",
  nodes: [
    {
      id: "the_mistake_blood",
      intro: [
        "어제 형태가 흐트러졌습니다. 제 혈법으로 동료 하나가 다쳤습니다.",
        "크게 다치진 않았습니다. 그래도 제 손에서 나간 겁니다.",
        "제 혈법으로 누굴 다치게 한 날은 기록에 남깁니다. 어제 것도 적었습니다.",
        "…실수한 날은 잠이 안 옵니다. 아직 익숙해지지 않네요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "익숙해지면 그게 더 문제예요",
          reply: "…그렇게 봐주시면 이 불면이 쓸모가 있어집니다.",
          next: "the_record_blood",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "기록에 원인은 적으세요? 결과만 적으면 안 줄어요",
          reply: "…결과만 적고 있었습니다. 하루 두고 고쳐보겠습니다.",
          next: "the_record_blood",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 동료한테 사과는 했어요?",
          reply: "…했습니다. 그쪽이 '괜찮다'고 해서 더 못 했습니다. 하루 생각하겠습니다.",
          next: "the_record_blood",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_record_blood",
      intro: [
        "기록을 고쳤습니다. 원인 칸을 만들고 3년치를 다시 훑었습니다.",
        "일곱 건이었습니다. 그중 다섯이 같은 원인이더군요. 준비 시간이 모자랐던 겁니다.",
        "형태를 다 못 잡은 채로 쓴 겁니다. 급해서요. 급한 이유는 동료가 밀리고 있어서고요.",
        "…그러니까 제 실수는 제 손이 아니라 앞의 상황에서 나온 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 앞이 못 버티는 날은 안 쓰면 돼요",
          reply: "…안 쓰면 제가 할 게 없습니다. 다만 그 판단은 해야겠군요.",
          next: "what_i_asked",
          effect: { mental: 10, skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "다섯 건이 같은 원인이면 그건 개인 실수가 아니라 배치 문제고요",
          reply: "…배치. 그러면 제가 보고할 사안이 됩니다. 그건 생각 못 했습니다.",
          next: "what_i_asked",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "급하게 쓴 건 결국 본인 선택이에요",
          reply: "…선택이었습니다. 그건 부정하지 않습니다. 다만 조건은 바꿀 수 있습니다.",
          next: "what_i_asked",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_i_asked",
      intro: [
        "보고했습니다. '제 준비 시간은 40초입니다. 그 안에 못 버티면 저를 빼주십시오.'",
        "처음으로 제 조건을 말한 겁니다. 3년 동안 말한 적이 없습니다.",
        "그랬더니 앞에 서는 동료가 '40초인 줄 몰랐다'고 하더군요.",
        "…아무도 몰랐던 겁니다. 제가 말을 안 했으니까요. 이게 제일 창피합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "창피한 게 아니라 이제 팀이 된 거예요",
          reply: "…팀. 그 단어를 3년 만에 제대로 쓰는 것 같습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "40초라는 숫자 하나가 배치를 다 바꿔요",
          reply: "…바뀌었습니다. 어제 훈련부터 대형이 달라졌습니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "말 안 한 3년 동안 다친 사람이 일곱이에요",
          reply: "…일곱입니다. 그 숫자는 제가 평생 갖고 갑니다.",
          next: null,
          effect: { mental: -7, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 혈액 다루는 술사 3회차 — 각오.
 * 축은 **"제 스승은 형태보다 각오를 먼저 가르쳤습니다. 이제야 이해합니다"**이다.
 * ⚠️ 스승을 등장시키지 마라. 이해는 그의 몫으로만 끝난다.
 */
const BLOOD_STORY_3: DmStory = {
  id: "blood_3",
  partnerName: "혈액 다루는 술사",
  partnerHandle: "blood_technique",
  arrivalTitle: "혈액 다루는 술사의 DM",
  startNode: "resolve_first",
  nodes: [
    {
      id: "resolve_first",
      intro: [
        "제 스승은 형태보다 각오를 먼저 가르쳤습니다. 그때는 이해가 안 됐습니다.",
        "형태가 있어야 기술이 나가는데 왜 각오부터냐고 물었더니 대답을 안 하시더군요.",
        "3년 걸려 알았습니다. 각오가 없으면 40초를 못 버팁니다.",
        "…그런데 지금은 다른 게 걸립니다. 저는 각오를 후배한테 어떻게 가르칩니까.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "스승처럼 대답 안 하면 되잖아요",
          reply: "…그게 방법이었을까요. 저는 불친절하다고 생각했는데요. 하루 생각해보겠습니다.",
          next: "the_junior_blood",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "각오는 가르치는 게 아니라 조건을 만들어주는 거예요",
          reply: "…조건. 그건 제가 최근에 배운 겁니다. 40초처럼요. 하루 두겠습니다.",
          next: "the_junior_blood",
          delayDays: 1,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "3년 걸린 걸 가르치려는 게 욕심이에요",
          reply: "…욕심입니다. 그래도 줄여주고 싶습니다. 내일 답하겠습니다.",
          next: "the_junior_blood",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_junior_blood",
      intro: [
        "후배가 하나 들어왔습니다. 형태를 잡는 속도는 저보다 빠릅니다. 재능이 있는 겁니다.",
        "그래서 각오 얘기는 안 했습니다. 대신 제 기록을 보여줬습니다.",
        "일곱 건짜리 목록이요. 원인 칸까지 다 적힌 걸로요.",
        "…그 애가 한참 보더니 '선배는 왜 안 그만뒀어요'라고 묻더군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "뭐라고 답하셨어요?",
          reply: "…'그만두면 여덟 번째가 나올 것 같아서요'라고 했습니다. 참말입니다.",
          next: "the_form_today",
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "그 질문이 나왔으면 각오는 이미 전해진 거예요",
          reply: "…그렇게 되는군요. 제가 설명 안 한 걸 그 애가 물어서 배운 셈입니다.",
          next: "the_form_today",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "재능 있는 애한테 실패 기록부터 보여준 건 좀 잔인한데요",
          reply: "…잔인합니다. 제 동기들은 그걸 안 보고 시작해서 다 그만뒀습니다.",
          next: "the_form_today",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_form_today",
      intro: [
        "오늘은 형태가 한 번에 잡혔습니다. 낮 훈련으로 바꾼 뒤로 자주 그렇습니다.",
        "후배가 옆에서 같은 형태를 잡고 있었습니다. 아직 셋째 번에 무너지더군요.",
        "제 기술 이름은 촌스럽습니다. 스승이 지어주셨거든요.",
        "…그 애 것도 제가 지어주기로 했습니다. 촌스럽게 짓겠습니다. 그게 순서인 것 같아서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "촌스러운 이름이 오래 남아요",
          reply: "…남습니다. 제 것도 아직 안 바꿨으니까요. 바꿀 생각도 없고요.",
          next: null,
          effect: {
            mental: 18,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 20 },
          },
        },
        {
          tone: "cool",
          me: "이름을 지어준다는 건 그 애를 끝까지 본다는 뜻이고요",
          reply: "…그렇게 되는군요. 그럼 저는 이제 못 그만두겠습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "셋째 번에 무너지는 건 각오가 아니라 근력 문제예요",
          reply: "…확인해보겠습니다. 원인을 찾는 건 이제 제 특기입니다.",
          next: null,
          effect: {
            mental: 12,
            followers: 320,
            skills: { knowledge: 45, fitness: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 정보 담당 안내원 — 현장에 안 나가고 자료를 만드는 내근직(`data/accounts.ts` briefing_desk).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"그런 날이 두 번 있었습니다. 그 두 번 때문에 오늘도 밤을 새웁니다"**이다.
 *
 * ⚠️ 말투는 **성실한 존댓말**이다. 서류 담당 보조감독(paperwork_supervisor)·궤도 계산
 *    오퍼레이터(field_operator)와 갈라라 — 보조감독은 **보내는 사람**, 오퍼레이터는 **실시간 좌표**,
 *    이쪽은 **아무도 안 읽는 자료**를 만드는 사람이다. 이쪽만 현장 경험이 딱 한 번 있다.
 * ⚠️ 그를 현장에 내보내지 마라. 결말은 내근이 자기 자리임을 확인하는 것이다.
 * ⚠️ 요원들은 "요원"·"그 요원"으로만 부르고, 다른 계정의 회차 진행을 전제하지 마라.
 * 줄기: 1회차 안 읽는 브리핑 → 2회차 그날 감싸준 요원 → 3회차 놓친 정보.
 */
export const BRIEFING_STORY: DmStory = {
  id: "briefing_1",
  partnerName: "정보 담당 안내원",
  partnerHandle: "briefing_desk",
  arrivalTitle: "정보 담당 안내원의 DM",
  startNode: "nobody_reads",
  nodes: [
    {
      id: "nobody_reads",
      intro: [
        "제 글을 퍼가주셨군요. 브리핑 자료 얘기를 읽는 분이 계시다니 놀랐습니다.",
        "요원들이 브리핑을 안 읽고 나가는 걸 압니다. 그래도 매번 만듭니다.",
        "딱 한 번이라도 읽고 나간 날에 도움이 되면 되니까요.",
        "…실제로 그런 날이 두 번 있었습니다. 3년에 두 번입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "두 번이면 두 명이 살아 돌아온 거잖아요",
          reply: "…그렇게 세면 그렇습니다. 저는 확률로만 세고 있었습니다.",
          next: "the_photos",
          effect: { skills: { sociability: 15, it: 15 } },
        },
        {
          tone: "cool",
          me: "안 읽는 게 자료 문제일 수도 있어요. 길거나 늦거나",
          reply: "…길다는 지적은 받았습니다. 줄이면 빠지는 게 생겨서 못 줄이고 있습니다.",
          next: "the_photos",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "3년에 두 번이면 효율이 최악인데요",
          reply: "…최악입니다. 그런데 그 둘이 지금 사무실에 앉아 있습니다.",
          next: "the_photos",
          effect: { mental: -3, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_photos",
      intro: [
        "제 책상 위에는 현장 요원들 사진이 붙어 있습니다.",
        "다들 왜 그런 걸 붙여놓냐고 묻습니다. 이유는 하나입니다.",
        "제가 만드는 자료가 종이가 아니라 사람이라는 걸 잊지 않으려고요.",
        "…잊는 순간 대충 만들게 되고, 그러면 저 중에 누가 안 돌아옵니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 사진들이 자료의 첫 페이지네요",
          reply: "…첫 페이지. 그렇게 부르니 제 책상이 좀 근사해집니다.",
          next: "the_short_version",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "그 사진을 자료 표지에 넣어보세요. 읽을걸요",
          reply: "…표지에요. 그건 생각 못 했습니다. 하루 만들어보겠습니다.",
          next: "the_short_version",
          delayDays: 1,
          effect: { skills: { knowledge: 35, it: 10 } },
        },
        {
          tone: "bold",
          me: "매일 그 사진을 보면 부담만 커져요",
          reply: "…커집니다. 그래도 안 뗍니다. 하루 두고 생각해보겠습니다.",
          next: "the_short_version",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_short_version",
      intro: [
        "자료를 두 벌로 만들었습니다. 전체판과 한 장짜리요.",
        "한 장짜리 맨 위에는 그날 나가는 요원들 이름을 적었습니다. 사진 대신에요.",
        "'오늘 이 이름들이 나갑니다'로 시작하는 자료입니다.",
        "…오늘 브리핑은 다섯 명이 다 들었습니다. 기적입니다. 아니, 기적이 아니군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "기적이 아니라 설계예요",
          reply: "…설계. 3년 만에 제 일에 그 단어를 씁니다. 기분이 좋습니다.",
          next: null,
          effect: { mental: 15, skills: { sociability: 30, it: 15 } },
        },
        {
          tone: "cool",
          me: "이름이 먼저 나오면 남 얘기가 아니게 되니까요",
          reply: "…자기 이름이 적힌 종이는 읽습니다. 그걸 3년 만에 알았습니다.",
          next: null,
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "전체판도 계속 만들 거예요? 그건 아무도 안 읽는데",
          reply: "…만듭니다. 한 장짜리를 만들려면 전체판이 있어야 하니까요.",
          next: null,
          effect: { mental: 8, followers: 180, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 정보 담당 안내원 2회차 — 그날 감싸준 요원.
 * 축은 **"그래서 저는 그 사람 커피는 늘 제일 먼저 탑니다"**이다.
 * ⚠️ 그를 다시 현장에 내보내지 마라. 얼어붙었던 기억은 극복 대상이 아니라 근거로 남는다.
 */
const BRIEFING_STORY_2: DmStory = {
  id: "briefing_2",
  partnerName: "정보 담당 안내원",
  partnerHandle: "briefing_desk",
  arrivalTitle: "정보 담당 안내원의 DM",
  startNode: "the_one_time_out",
  nodes: [
    {
      id: "the_one_time_out",
      intro: [
        "저도 한때는 현장에 나가고 싶었습니다. 딱 한 번 따라 나간 적이 있습니다.",
        "아무것도 못 하고 얼어붙었습니다. 3초인지 30초인지 아직도 모르겠습니다.",
        "그날 저를 감싸준 요원이 지금도 저한테 커피를 시킵니다.",
        "…그래서 저는 그 사람 커피는 늘 제일 먼저 탑니다. 아무도 눈치 못 챘습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 사람은 알걸요",
          reply: "…알까요. 한 번도 그 얘길 꺼낸 적이 없습니다. 서로요.",
          next: "the_coffee_order",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "커피 순서로 갚는 건 좀 작은데요",
          reply: "…제가 할 수 있는 게 그것뿐이라서요. 하루 생각해보겠습니다.",
          next: "the_coffee_order",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "얼어붙은 걸 아직도 실패로 세고 계시죠",
          reply: "…셉니다. 3년째요. 하루 두고 답하겠습니다.",
          next: "the_coffee_order",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_coffee_order",
      intro: [
        "그 요원이 어제 커피를 받으면서 처음으로 그 얘기를 꺼냈습니다.",
        "'그날 네가 안 움직여서 내가 위치를 알았다'고 하더군요.",
        "제가 얼어붙어 있어서 그 자리가 비어 있었고, 그래서 뒤가 뚫린 걸 봤다고요.",
        "…3년 동안 저는 그날을 실패로만 세고 있었습니다. 그쪽은 아니었던 겁니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 말 하려고 3년 기다린 거예요",
          reply: "…기다린 겁니까. 저는 잊은 줄 알았습니다.",
          next: "where_i_belong",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "위로하려고 지어낸 말일 수도 있어요",
          reply: "…그 가능성도 봤습니다. 그런데 그 사람은 그런 말을 지어낼 줄 모릅니다.",
          next: "where_i_belong",
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그럼 그날 안 움직인 게 잘한 거였네요",
          reply: "…잘한 건 아닙니다. 다만 나쁘기만 한 것도 아니었습니다. 그거면 충분합니다.",
          next: "where_i_belong",
          effect: { mental: 10, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "where_i_belong",
      intro: [
        "현장 얘기를 들으면 아직도 무섭습니다. 그래서 내근이 좋습니다.",
        "제 자리에서 창밖을 보면 이 도시가 다 보입니다. 그것만으로 충분합니다.",
        "이 도시에 대해 저보다 많이 아는 사람은 없을 겁니다. 나가본 적은 없지만요.",
        "…나가본 적이 없어서 아는 것도 있습니다. 어제 그걸 알았습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안에서 보는 것도 보는 거예요",
          reply: "…보는 겁니다. 창문도 눈이니까요. 그렇게 세겠습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30, it: 15 } },
        },
        {
          tone: "cool",
          me: "밖에 나가면 시야가 하나로 좁아져요. 안에서는 전부 보이고요",
          reply: "…그래서 제가 여기 있는 거군요. 정리해주셔서 감사합니다.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "충분하다고 세 번 쓰셨어요. 그건 안 충분한 거고요",
          reply: "…세 번이나요. 확인해보겠습니다. …두 번이었습니다. 그래도 많군요.",
          next: null,
          effect: { mental: -4, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 정보 담당 안내원 3회차 — 놓친 정보.
 * 축은 **"제일 무서운 건 제가 놓친 정보로 누가 다치는 겁니다"**이다.
 * ⚠️ 큰 사고를 내지 마라. 놓친 정보는 **아무 일도 안 일어난 채로** 발견된다. 그래서 더 오래 남는다.
 */
const BRIEFING_STORY_3: DmStory = {
  id: "briefing_3",
  partnerName: "정보 담당 안내원",
  partnerHandle: "briefing_desk",
  arrivalTitle: "정보 담당 안내원의 DM",
  startNode: "the_missed_line",
  nodes: [
    {
      id: "the_missed_line",
      intro: [
        "어제 3개월 전 자료를 다시 보다가 빠진 줄을 하나 찾았습니다.",
        "그 구역 이상 현상 주기가 하나 안 적혀 있었습니다. 제가 놓친 겁니다.",
        "그 자료로 나간 작전은 무사히 끝났습니다. 아무 일도 없었습니다.",
        "…아무 일도 없었는데 어제 잠을 못 잤습니다. 이게 제일 이상합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 일어난 일이 제일 오래 남아요",
          reply: "…남습니다. 일어난 일은 처리하면 끝인데 이건 처리가 안 됩니다.",
          next: "the_check",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "놓친 걸 3개월 만에 찾아낸 것도 실력이에요",
          reply: "…실력으로 세도 되는 겁니까. 저는 증거로 세고 있었습니다.",
          next: "the_check",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "한 줄 빠진 걸로 잠을 못 자면 이 일 오래 못 해요",
          reply: "…정년까지 할 생각인데요. 하루 두고 생각해보겠습니다.",
          next: "the_check",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_check",
      intro: [
        "생각했습니다. 그리고 검토 절차를 하나 만들었습니다.",
        "제가 만든 자료를 제가 한 번 더 보는 게 아니라, 요원 하나가 훑게 하는 겁니다.",
        "전문가가 아니어도 됩니다. 오히려 모르는 사람이 빈 줄을 잘 봅니다.",
        "…브리핑 중에 자는 요원한테 시켰습니다. 그 사람이 제일 안 읽던 사람이라서요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "제일 안 읽던 사람한테 시킨 게 묘수네요",
          reply: "…묘수라기보다 보복에 가깝습니다. 결과는 좋았습니다만.",
          next: "the_pattern",
          effect: { mental: 12, skills: { sociability: 30, comedy: 10 } },
        },
        {
          tone: "cool",
          me: "읽게 만드는 제일 확실한 방법은 검토를 시키는 거고요",
          reply: "…그것도 계산에 있었습니다. 이제 그 사람은 자료를 다 읽습니다.",
          next: "the_pattern",
          effect: { skills: { knowledge: 45, it: 15 } },
        },
        {
          tone: "bold",
          me: "그러면 그 사람 시간을 뺏는 거잖아요",
          reply: "…30분입니다. 그 30분으로 빈 줄이 두 개 나왔습니다. 값은 했습니다.",
          next: "the_pattern",
          effect: { mental: -3, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_pattern",
      intro: [
        "이상 현상은 패턴이 있습니다. 다들 우연이라고 하는데 아닙니다.",
        "3년치 기록을 검토 절차에 넣고 다시 돌렸더니 주기가 하나 더 나왔습니다.",
        "이건 아직 아무도 모릅니다. 다음 브리핑에 넣을 겁니다. 한 장짜리에요.",
        "…제 업무는 티가 안 납니다. 원래 그런 일입니다. 그래도 오늘은 좀 티를 내고 싶군요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "여기서는 티 내셔도 돼요",
          reply: "…그럼 내겠습니다. 제가 찾았습니다. 3년치를 다 뒤져서요.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, it: 20 },
          },
        },
        {
          tone: "cool",
          me: "그 주기 하나가 다음 3년을 바꿔요",
          reply: "…바꿉니다. 그래서 오늘 야근이 아깝지 않습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50, it: 15 } },
        },
        {
          tone: "bold",
          me: "티를 내려면 이름을 자료에 넣으세요. 작성자 칸에요",
          reply: "…작성자 칸을 만든 적이 없군요. 다음 자료부터 넣겠습니다.",
          next: null,
          effect: {
            mental: 18,
            followers: 320,
            skills: { it: 25, knowledge: 35, sociability: 15 },
          },
        },
      ],
    },
  ],
};

/**
 * 고양이 데리고 다니는 감시자 — 고양이 셋과 지붕으로 다니는 감시 담당(`data/accounts.ts` cat_watcher).
 * 그의 트윗에 **좋아요**를 누르면 DM이 온다.
 *
 * 축은 **"이 도시에서 10년을 버티는 동안 저를 한 번도 배신 안 한 게 저 셋뿐"**이다.
 *
 * ⚠️ 말투는 **담담한 존댓말**이다. 고양이 얘기를 할 때만 문장이 길어진다.
 * ⚠️ 고양이를 죽이지 마라. 3회차는 **늙는 것**까지만 다룬다.
 * ⚠️ 감시 대상·의뢰인을 밝히지 마라("뭘 감시하는지는 말 못 합니다"가 이 계정의 규칙이다).
 * ⚠️ 제일 큰 애의 이름은 끝까지 안 나온다("부르면 옵니다"까지만 쓴다).
 * 줄기: 1회차 털 세우는 경보 → 2회차 도망치는 규칙 → 3회차 막내가 늙는다.
 */
export const CAT_STORY: DmStory = {
  id: "cat_1",
  partnerName: "고양이 데리고 다니는 감시자",
  partnerHandle: "cat_watcher",
  arrivalTitle: "고양이 데리고 다니는 감시자의 DM",
  startNode: "the_alarm",
  nodes: [
    {
      id: "the_alarm",
      intro: [
        "좋아요 감사합니다. 이 시간에 깨어 있는 분이 계시는군요.",
        "밤에만 활동합니다. 낮에는 잡니다. 고양이랑 같은 주기죠.",
        "우리 애들이 털을 세우면 뭔가 있는 겁니다. 10년 동안 백발백중이었어요.",
        "…이 도시에서 제일 정확한 경보 장치가 고양이 세 마리라는 걸 아무도 안 믿습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "저는 믿어요. 10년 백발백중이면 데이터죠",
          reply: "…데이터라고 해주시니 제 사료값이 연구비가 됩니다.",
          next: "why_cats",
          effect: { mental: 5, skills: { sociability: 15, knowledge: 10 } },
        },
        {
          tone: "cool",
          me: "고양이가 반응하는 조건을 기록해두셨어요?",
          reply: "…머리에 있습니다. 종이는 잃어버리니까요. 필요하면 읊어드릴 수 있습니다.",
          next: "why_cats",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "고양이가 놀란 걸 경보로 쓰면 오보도 많을 텐데요",
          reply: "…오보는 없었습니다. 그래서 백발백중이라고 쓴 겁니다.",
          next: "why_cats",
          effect: { mental: -2, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "why_cats",
      intro: [
        "고양이는 거짓말을 안 합니다. 그래서 같이 다닙니다.",
        "우리 애들이 싫어하는 사람은 저도 안 믿습니다. 이건 10년째 지키는 규칙입니다.",
        "사람보다 고양이가 낫다는 소리를 자주 합니다. 진심입니다.",
        "…누가 저한테 혼자 다녀서 외롭지 않냐고 물었습니다. 셋이나 있는데요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "셋이면 혼자가 아니죠",
          reply: "…그렇게 말해주신 분은 두 번째입니다. 첫 번째는 웃었고요.",
          next: "the_ten_years_cat",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "사람은 배신하는데 고양이는 안 한다는 게 축이네요",
          reply: "…그렇게 정리하면 제가 좀 불쌍해 보입니다만, 맞습니다.",
          next: "the_ten_years_cat",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "고양이는 배신을 안 하는 게 아니라 약속을 안 해요",
          reply: "…아. 그건 좀 아픈 정확함입니다. 하루 생각해보겠습니다.",
          next: "the_ten_years_cat",
          delayDays: 1,
          effect: { mental: -5, skills: { knowledge: 35 } },
        },
      ],
    },
    {
      id: "the_ten_years_cat",
      intro: [
        "생각해봤습니다. 약속을 안 하니 어기지도 않는다. 맞는 말입니다.",
        "그런데 지붕에서 떨어진 적이 딱 한 번 있습니다. 정신 차려보니 애들이 아래에 내려와 있더군요.",
        "약속한 적은 없습니다. 그래도 내려와 있었습니다.",
        "…그날 이후로 저는 저 셋을 반려동물이라고 안 부릅니다. 같이 일하는 동료라고 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "동료가 맞네요. 그건 확실해요",
          reply: "…확실합니다. 사료값도 인건비로 처리하고 싶은 심정입니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "약속 없이 온 게 약속보다 센 거고요",
          reply: "…그 문장을 오늘 기록에 남기겠습니다. 머리에요.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "떨어진 건 왜 떨어진 거예요?",
          reply: "…달이 밝은 밤이었습니다. 그림자가 길어지면 발 디딜 데를 잘못 봅니다. 제 실수입니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 고양이 데리고 다니는 감시자 2회차 — 도망치는 규칙.
 * 축은 **"고양이가 먼저 도망가면 저도 도망칩니다. 그게 규칙입니다"**이다.
 */
const CAT_STORY_2: DmStory = {
  id: "cat_2",
  partnerName: "고양이 데리고 다니는 감시자",
  partnerHandle: "cat_watcher",
  arrivalTitle: "고양이 데리고 다니는 감시자의 DM",
  startNode: "the_run_rule",
  nodes: [
    {
      id: "the_run_rule",
      intro: [
        "고양이가 먼저 도망가면 저도 도망칩니다. 그게 규칙입니다.",
        "어제 그 규칙이 처음으로 어려웠습니다. 애들이 도망갔는데 아래에 사람이 있었거든요.",
        "감시가 제 일입니다. 구하는 건 제 일이 아니고요. 그건 다른 사람 몫입니다.",
        "…그래도 규칙을 어길 뻔했습니다. 어기지는 않았습니다. 그게 마음에 걸립니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "규칙을 지킨 건 잘한 거예요. 걸리는 건 별개고요",
          reply: "…별개로 두는 게 되는군요. 하루 생각해보겠습니다.",
          next: "what_i_did_cat",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "도망치면서 할 수 있는 게 있었을 텐데요",
          reply: "…있었을까요. 그건 검토해볼 만합니다. 하루 두겠습니다.",
          next: "what_i_did_cat",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 사람은 어떻게 됐는데요",
          reply: "…모릅니다. 확인을 안 했습니다. 그것도 마음에 걸립니다. 내일 답하겠습니다.",
          next: "what_i_did_cat",
          delayDays: 1,
          effect: { mental: -7, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "what_i_did_cat",
      intro: [
        "확인했습니다. 무사했습니다. 다른 팀이 들어갔더군요.",
        "그리고 알아냈습니다. 그 팀이 들어간 건 제가 도망치면서 지른 소리 때문이었습니다.",
        "저는 조용한 게 직업인데 어제 소리를 질렀습니다. 저도 모르게요.",
        "…도망치면서 할 수 있는 게 있긴 있었군요. 이미 하고 있었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그게 감시자가 할 수 있는 최선이에요",
          reply: "…최선. 그럼 규칙도 지키고 최선도 한 겁니다. 계산이 맞습니다.",
          next: "the_rule_updated",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "소리 지른 걸 규칙에 넣으세요. 그게 절차가 돼요",
          reply: "…절차로 만들면 다음엔 안 잊습니다. 그렇게 하겠습니다.",
          next: "the_rule_updated",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "정체가 들킬 수도 있었어요. 10년 무사한 걸 걸었고요",
          reply: "…걸었습니다. 그건 인정합니다. 그래도 다시 그럴 것 같습니다.",
          next: "the_rule_updated",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "the_rule_updated",
      intro: [
        "규칙을 고쳤습니다. '고양이가 도망가면 나도 도망친다. 도망치면서 소리는 낸다.'",
        "이 일을 10년 했는데 아직 정체를 들킨 적이 없습니다. 그건 안 깨질 겁니다.",
        "소리는 어디서 났는지 모르게 지르는 방법이 있습니다. 지붕이 여러 개니까요.",
        "…감시하다 보면 이 도시 사람들 사정이 다 보입니다. 못 본 척합니다. 소리는 지르고요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "못 본 척하면서 소리는 지르는 게 딱 좋아요",
          reply: "…딱 좋다고 해주시니 제 자리가 분명해집니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 35 } },
        },
        {
          tone: "cool",
          me: "지붕이 여러 개라는 게 이 규칙의 조건이네요",
          reply: "…조건입니다. 지붕을 다 밟아본 사람만 쓸 수 있는 규칙이죠.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그래도 언젠가 들켜요. 소리를 계속 지르면요",
          reply: "…들키면 그때 그만둡니다. 그때까지는 지르겠습니다.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 고양이 데리고 다니는 감시자 3회차 — 막내가 늙는다.
 * 축은 **"제일 무서운 건 우리 애들이 저보다 먼저 가는 겁니다"**이다.
 * ⚠️ 고양이를 죽이지 마라. 결말은 **일하는 방식을 바꾸는 것**까지다.
 */
const CAT_STORY_3: DmStory = {
  id: "cat_3",
  partnerName: "고양이 데리고 다니는 감시자",
  partnerHandle: "cat_watcher",
  arrivalTitle: "고양이 데리고 다니는 감시자의 DM",
  startNode: "the_youngest_cat",
  nodes: [
    {
      id: "the_youngest_cat",
      intro: [
        "우리 막내가 요즘 지붕을 잘 못 올라옵니다. 살이 찐 줄 알았는데 아니더군요.",
        "열두 살입니다. 제가 이 일 시작할 때 데려왔으니까 딱 10년입니다.",
        "제일 무서운 건 우리 애들이 저보다 먼저 가는 겁니다. 늘 알고는 있었습니다.",
        "…아는 것과 지붕 아래에서 저를 올려다보는 걸 보는 건 다릅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 지붕을 그만 타면 되잖아요",
          reply: "…제 일이 지붕인데요. 하루 생각해보겠습니다.",
          next: "the_new_route",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "셋 중 하나만 못 올라오는 거면 배치를 바꾸면 돼요",
          reply: "…배치. 감시 팀 배치처럼요. 그건 생각 못 했습니다. 하루 두겠습니다.",
          next: "the_new_route",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "10년이면 은퇴할 나이예요. 사람으로 치면요",
          reply: "…은퇴. 그 단어를 쓰면 인정하는 게 됩니다. 하룻밤 주십시오.",
          next: "the_new_route",
          delayDays: 1,
          effect: { mental: -8, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "the_new_route",
      intro: [
        "경로를 바꿨습니다. 지붕 구간을 절반으로 줄이고 골목을 늘렸습니다.",
        "느립니다. 감시 효율이 3할쯤 떨어집니다. 계산해봤습니다.",
        "대신 막내가 따라옵니다. 셋이 다 옵니다. 그게 원래 조건이었으니까요.",
        "…경보 장치가 셋일 때 백발백중이었습니다. 둘이면 그 기록이 안 나옵니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "효율보다 그게 맞아요",
          reply: "…맞다고 해주시면 제가 결재를 받은 셈이 됩니다. 결재권자가 저뿐이라서요.",
          next: "who_retires_first",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "3할 떨어진 걸 셋으로 메우면 계산이 맞아요",
          reply: "…맞습니다. 그래서 이건 배려가 아니라 배치입니다. 그렇게 부르겠습니다.",
          next: "who_retires_first",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그래도 언젠가 못 따라오는 날이 와요",
          reply: "…옵니다. 그날엔 그날의 경로를 짜겠습니다. 지금은 이 경로입니다.",
          next: "who_retires_first",
          effect: { mental: -5, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "who_retires_first",
      intro: [
        "어제 새 경로로 돌았습니다. 골목이 늘어서 사람을 더 봤습니다.",
        "지붕에서는 안 보이던 게 보이더군요. 사람들이 밤에 뭘 하고 사는지요.",
        "감시 기록이 좀 달라졌습니다. 나쁘지 않습니다. 오히려 자료가 늘었습니다.",
        "…막내가 골목에서는 제일 앞에 섭니다. 지붕에서 못 하던 걸 여기서 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "자리를 바꾼 게 아니라 자리를 찾은 거네요",
          reply: "…찾았습니다. 저는 그걸 잃는 거라고만 생각했습니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, knowledge: 15 },
          },
        },
        {
          tone: "cool",
          me: "지붕 감시자가 골목 감시자가 된 거고요. 그것도 실력이에요",
          reply: "…10년 만에 배운 게 있군요. 지붕만 밟아본 게 아니게 됐습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "그럼 은퇴는 막내가 아니라 지붕이 한 거네요",
          reply: "…그렇게 정리하면 아무도 은퇴 안 한 게 됩니다. 마음에 듭니다.",
          next: null,
          effect: {
            mental: 18,
            followers: 320,
            skills: { knowledge: 40, sociability: 20 },
          },
        },
      ],
    },
  ],
};

/**
 * 차 모는 운반 담당 — 동료를 태우고 달리는 팀 운전수(`data/accounts.ts` wheelman_city).
 * 그의 트윗을 **리트윗**하면 DM이 온다.
 *
 * 축은 **"핸들을 놓는 순간 다 끝납니다. 그래서 안 놓습니다"**이다.
 *
 * ⚠️ 말투는 **짧은 존댓말**이다. 운반 전문 배달꾼(transporter_van)과 반드시 갈라라 —
 *    그쪽은 **짐**을 옮기는 개인업자(반말), 이쪽은 **동료**를 태우는 팀 소속(존댓말)이다.
 *    그쪽은 뒤를 안 돌아보고, 이쪽은 **백미러를 안 봅니다**. 이유가 다르다.
 * ⚠️ 사망자를 내지 마라. 깨진 무사고 기록은 동료가 크게 다친 선에서 멈춘다.
 * ⚠️ 동료를 이름으로 부르지 마라. "뒷자리"·"동료"로만 쓴다.
 * 줄기: 1회차 매일 아침 도로 → 2회차 깨진 3년 → 3회차 조수석.
 */
export const WHEEL_STORY: DmStory = {
  id: "wheel_1",
  partnerName: "차 모는 운반 담당",
  partnerHandle: "wheelman_city",
  arrivalTitle: "차 모는 운반 담당의 DM",
  startNode: "the_morning_route",
  nodes: [
    {
      id: "the_morning_route",
      intro: [
        "제 글을 퍼가셨군요. 운전 얘기밖에 없는 계정인데요.",
        "이 도시 도로는 어제와 오늘이 다릅니다. 진짜로요.",
        "그래서 매일 아침 같은 길을 한 번씩 돌아봅니다. 남들은 유난이라고 합니다.",
        "…그 유난 덕에 저희 팀이 막다른 골목에 갇힌 적이 한 번도 없습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "유난이 아니라 정비죠",
          reply: "…정비. 차 정비는 다들 인정하는데 길 정비는 안 쳐주더군요.",
          next: "the_seat_belt",
          effect: { skills: { sociability: 15, game: 10 } },
        },
        {
          tone: "cool",
          me: "매일 도는 시간이 아깝지 않아요?",
          reply: "…한 시간입니다. 갇히면 그날이 통째로 날아갑니다. 계산은 끝났습니다.",
          next: "the_seat_belt",
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "도로가 매일 바뀐다는 걸 아무도 안 믿죠",
          reply: "…안 믿습니다. 그래서 제가 돕니다. 믿는 사람이 하나면 충분하니까요.",
          next: "the_seat_belt",
          effect: { mental: -2, skills: { knowledge: 25 } },
        },
      ],
    },
    {
      id: "the_seat_belt",
      intro: [
        "제 차에 타면 안전벨트부터 매세요. 부탁이 아닙니다.",
        "동료들이 뛰어들 때 시동은 이미 걸려 있습니다. 그게 제 준비입니다.",
        "어디로 가라는 말도 없이 그냥 탑니다. 제가 알아서 갈 거라고 믿는다는 뜻이죠.",
        "…그 믿음 하나 때문에 저는 매일 아침 도로를 다시 외웁니다. 부담스럽지만 좋습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "부담스럽지만 좋다는 게 정확한 표현이네요",
          reply: "…둘 다입니다. 하나만 쓰면 거짓말이 됩니다.",
          next: "fast_or_arrive",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "말 안 해도 되는 관계를 만드는 데 몇 년 걸렸어요?",
          reply: "…4년입니다. 처음엔 다들 목적지를 말했습니다. 하루 생각해보겠습니다.",
          next: "fast_or_arrive",
          delayDays: 1,
          effect: { skills: { knowledge: 30 } },
        },
        {
          tone: "bold",
          me: "믿는 게 아니라 확인할 시간이 없어서일 수도 있고요",
          reply: "…그럴 수도 있습니다. 하루 두고 생각해보겠습니다.",
          next: "fast_or_arrive",
          delayDays: 1,
          effect: { mental: -4, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "fast_or_arrive",
      intro: [
        "생각해봤습니다. 확인할 시간이 없는 것도 맞습니다. 다만 그것만은 아니었습니다.",
        "어제 한 명이 타면서 '오른쪽으로'라고 하더군요. 4년 만에 처음이었습니다.",
        "그쪽 길이 막힌 걸 제가 아침에 확인했기 때문에 저는 왼쪽으로 갔습니다.",
        "…도착하고 나서 그 사람이 아무 말 안 하더군요. 그게 답이었습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "말 안 한 게 인정한 거예요",
          reply: "…인정으로 세겠습니다. 그편이 기분이 좋습니다.",
          next: null,
          effect: { mental: 12, skills: { sociability: 30, game: 10 } },
        },
        {
          tone: "cool",
          me: "빨리 가는 것보다 도착하는 게 중요하다는 걸 그쪽도 알았고요",
          reply: "…이거 헷갈리면 죽습니다. 그건 제가 늘 쓰는 문장입니다.",
          next: null,
          effect: { skills: { knowledge: 40 } },
        },
        {
          tone: "bold",
          me: "그 사람은 급했던 거예요. 다음엔 이유를 물어보세요",
          reply: "…운전 중에는 말을 안 합니다. 도착하고 물어보겠습니다. 그건 하겠습니다.",
          next: null,
          effect: { mental: -3, followers: 180, skills: { knowledge: 35 } },
        },
      ],
    },
  ],
};

/**
 * 차 모는 운반 담당 2회차 — 깨진 3년.
 * 축은 **"제일 어려운 운전은 뒷자리에 누가 죽어갈 때입니다"**이다.
 * ⚠️ 그 동료를 죽이지 마라. 크게 다치고 살아난다. 결말은 백미러를 다시 보는 것이 아니다.
 */
const WHEEL_STORY_2: DmStory = {
  id: "wheel_2",
  partnerName: "차 모는 운반 담당",
  partnerHandle: "wheelman_city",
  arrivalTitle: "차 모는 운반 담당의 DM",
  startNode: "the_broken_record",
  nodes: [
    {
      id: "the_broken_record",
      intro: [
        "제일 자랑스러운 기록은 무사고 3년이었습니다. 지금은 깨졌고요.",
        "제 사고는 아니었습니다. 뒷자리에 탄 동료가 이미 다친 상태였습니다.",
        "그날이 제일 어려운 운전이었습니다. 빨리 가야 하는데 흔들리면 안 되고요.",
        "…그 와중에 뒷자리 소리는 다 들립니다. 그래서 그날 이후로 백미러를 안 봅니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "안 보는 게 맞아요. 보면 손이 흔들려요",
          reply: "…맞습니다. 제가 할 수 있는 건 핸들을 안 놓는 것뿐이라서요.",
          next: "did_they_live",
          delayDays: 1,
          effect: { skills: { sociability: 25 } },
        },
        {
          tone: "cool",
          me: "기록이 깨진 게 아니라 다른 종류의 운전이었던 거예요",
          reply: "…항목이 다른 거군요. 그건 생각 못 했습니다. 하루 두겠습니다.",
          next: "did_they_live",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "그 사람은 살았어요?",
          reply: "…살았습니다. 3주 누워 있었고요. 지금은 걷습니다. 하루 두고 마저 쓰겠습니다.",
          next: "did_they_live",
          delayDays: 1,
          effect: { mental: -6, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "did_they_live",
      intro: [
        "그 동료가 퇴원하고 제일 먼저 한 말이 '그날 차가 안 흔들렸다'였습니다.",
        "누워서 천장만 봤는데 그게 기억난다고요. 흔들렸으면 더 아팠을 거라고 했습니다.",
        "저는 그날을 실패로 세고 있었습니다. 기록이 깨졌으니까요.",
        "…그 사람은 그날을 다르게 세고 있었더군요. 3주 동안요.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그쪽 계산이 맞아요",
          reply: "…맞다고 해주시니 기록표를 고쳐야겠습니다. 항목을 하나 더 만들겠습니다.",
          next: "what_i_do_now_wheel",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "무사고는 안 다치는 게 아니라 더 안 다치게 하는 거예요",
          reply: "…정의가 바뀌는군요. 그럼 그날도 무사고입니다. 그렇게 세겠습니다.",
          next: "what_i_do_now_wheel",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "3주 누워서 그 생각만 했으면 그것도 힘들었을 텐데요",
          reply: "…그건 제가 못 물어봤습니다. 다음에 묻겠습니다. 그건 물어야죠.",
          next: "what_i_do_now_wheel",
          effect: { mental: -4, skills: { knowledge: 40 } },
        },
      ],
    },
    {
      id: "what_i_do_now_wheel",
      intro: [
        "차에 비상용 물건이 스무 가지쯤 있습니다. 다 필요했던 것들입니다.",
        "그날 이후로 다섯 개가 늘었습니다. 뒷자리에서 쓰는 것들로요.",
        "쓸 일이 없기를 바라면서 싣습니다. 무게가 늘어서 연비는 나빠졌고요.",
        "…연비는 계산에서 뺐습니다. 그건 제가 정한 항목입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그 다섯 개가 제일 중요한 짐이네요",
          reply: "…제일 무겁고 제일 안 쓰는 짐입니다. 그래도 싣습니다.",
          next: null,
          effect: { mental: 15, followers: 200, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "연비를 뺀 계산은 계산이 아니라 결정이고요",
          reply: "…결정입니다. 계산은 제가 하고 결정도 제가 합니다. 제 차니까요.",
          next: null,
          effect: { mental: 10, followers: 180, skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "백미러는 언제 다시 볼 건데요",
          reply: "…안 봅니다. 앞을 보는 게 제 일이라서요. 뒤는 다른 사람이 봐줍니다.",
          next: null,
          effect: { mental: -3, followers: 220, skills: { knowledge: 40 } },
        },
      ],
    },
  ],
};

/**
 * 차 모는 운반 담당 3회차 — 조수석.
 * 축은 **"조수석은 아무나 안 태웁니다. 이건 예약제입니다"**이다.
 * ⚠️ 운반 전문 배달꾼(transporter_van)의 3회차와 소재가 겹치지 않게 하라 —
 *    그쪽은 **비워둔 자리**, 이쪽은 **예약이 밀린 자리**다. 이쪽 조수석에는 늘 누가 탄다.
 */
const WHEEL_STORY_3: DmStory = {
  id: "wheel_3",
  partnerName: "차 모는 운반 담당",
  partnerHandle: "wheelman_city",
  arrivalTitle: "차 모는 운반 담당의 DM",
  startNode: "the_reservation",
  nodes: [
    {
      id: "the_reservation",
      intro: [
        "조수석은 아무나 안 태웁니다. 이건 예약제입니다. 농담처럼 썼는데 진짜입니다.",
        "지금 예약이 넷 밀려 있습니다. 다들 자기 차례를 압니다.",
        "조수석에 타면 제가 길을 설명해줍니다. 그게 이 자리의 값입니다.",
        "…이 도시 지도는 종이로 안 씁니다. 다 외웠습니다. 그래서 말로만 넘길 수 있습니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "그럼 그 넷은 다음 운전수 후보네요",
          reply: "…후보. 그렇게 부른 적은 없는데 맞는 말입니다.",
          next: "why_i_teach",
          delayDays: 1,
          effect: { skills: { sociability: 25, game: 10 } },
        },
        {
          tone: "cool",
          me: "머리에만 있는 지도는 본인이 없으면 사라져요",
          reply: "…그래서 말로 넘기는 겁니다. 넷한테요. 하루 두고 답하겠습니다.",
          next: "why_i_teach",
          delayDays: 1,
          effect: { skills: { knowledge: 35 } },
        },
        {
          tone: "bold",
          me: "예약제라면서 순서는 본인이 정하잖아요",
          reply: "…제가 정합니다. 급한 순서가 아니라 오래 남을 순서로요.",
          next: "why_i_teach",
          delayDays: 1,
          effect: { mental: -3, skills: { knowledge: 30 } },
        },
      ],
    },
    {
      id: "why_i_teach",
      intro: [
        "왜 넘기냐고 물으시면, 제가 언젠가 못 몰 날이 오기 때문입니다.",
        "핸들을 놓는 순간 다 끝납니다. 그래서 안 놓습니다. 그건 운전 중 얘기고요.",
        "운전 밖에서는 놓을 준비를 해둬야 합니다. 그게 다르다는 걸 최근에 알았습니다.",
        "…언젠가 이 차를 은퇴시키는 날이 오겠죠. 아직은 아닙니다. 그래도 준비는 합니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "준비하는 사람은 늦게 놓아도 돼요",
          reply: "…늦게 놓겠습니다. 준비는 지금부터 하고요.",
          next: "the_last_seat",
          effect: { mental: 15, skills: { sociability: 30 } },
        },
        {
          tone: "cool",
          me: "운전 중과 밖을 나눈 게 답이에요",
          reply: "…나누니까 정리가 됐습니다. 안 나눴으면 계속 붙잡고 있었을 겁니다.",
          next: "the_last_seat",
          effect: { skills: { knowledge: 45 } },
        },
        {
          tone: "bold",
          me: "넷한테 다 넘기면 본인 자리가 없어져요",
          reply: "…없어지면 조수석에 앉겠습니다. 그건 좀 재밌겠군요.",
          next: "the_last_seat",
          effect: { mental: 10, skills: { knowledge: 40, game: 15 } },
        },
      ],
    },
    {
      id: "the_last_seat",
      intro: [
        "어제 예약 첫 번째가 조수석에 탔습니다. 그 사람한테 아침 도로 점검을 시켰습니다.",
        "혼자 한 시간을 돌고 오더니 '진짜로 바뀌었더라'고 하더군요.",
        "10년 동안 아무도 안 믿던 걸 하루 만에 믿게 만들었습니다. 태워보면 됩니다.",
        "…오늘도 다들 무사히 내렸습니다. 제 일은 끝입니다.",
      ],
      choices: [
        {
          tone: "friendly",
          me: "믿는 사람이 둘이 됐네요",
          reply: "…둘이면 하루씩 나눠 돌 수 있습니다. 계산이 갑자기 편해집니다.",
          next: null,
          effect: {
            mental: 20,
            reputation: 5,
            followers: 300,
            skills: { sociability: 35, game: 20 },
          },
        },
        {
          tone: "cool",
          me: "설명 대신 태운 게 제일 빠른 인계였고요",
          reply: "…말로는 10년 걸렸을 겁니다. 한 시간이면 되는 거였습니다.",
          next: null,
          effect: { mental: 15, followers: 280, skills: { knowledge: 50 } },
        },
        {
          tone: "bold",
          me: "이제 나머지 셋도 태우세요. 순서 미루지 말고요",
          reply: "…다음 주에 둘째를 태웁니다. 이미 잡아뒀습니다. 미루는 건 제 방식이 아닙니다.",
          next: null,
          effect: {
            mental: 15,
            followers: 320,
            skills: { knowledge: 40, sociability: 25 },
          },
        },
      ],
    },
  ],
};

/**
 * 전체 스토리 목록. **같은 핸들이 여러 번 나오면 그 순서가 곧 회차다**(1·2·3회차).
 * 회차 해금은 `systems/dmStory.ts`의 `spawnStoryFor`가 처리한다 — 앞 회차를 끝내야 다음이 열린다.
 */
export const DM_STORIES: DmStory[] = [
  KANRA_STORY,
  KANRA_STORY_2,
  KANRA_STORY_3,
  NOCOLOR_STORY,
  NOCOLOR_STORY_2,
  NOCOLOR_STORY_3,
  TARO_STORY,
  TARO_STORY_2,
  TARO_STORY_3,
  SAIKA_STORY,
  SAIKA_STORY_2,
  SAIKA_STORY_3,
  SETTON_STORY,
  SETTON_STORY_2,
  SETTON_STORY_3,
  BAKYURA_STORY,
  BAKYURA_STORY_2,
  BAKYURA_STORY_3,
  COLLECTOR_STORY,
  COLLECTOR_STORY_2,
  COLLECTOR_STORY_3,
  IKOMA_STORY,
  IKOMA_STORY_2,
  IKOMA_STORY_3,
  GETO_STORY,
  GETO_STORY_2,
  GETO_STORY_3,
  BAN_STORY,
  BAN_STORY_2,
  BAN_STORY_3,
  LEAD_STORY,
  LEAD_STORY_2,
  LEAD_STORY_3,
  HIMEHIME_STORY,
  HIMEHIME_STORY_2,
  HIMEHIME_STORY_3,
  SMILE_STORY,
  SMILE_STORY_2,
  SMILE_STORY_3,
  BRO_STORY,
  BRO_STORY_2,
  BRO_STORY_3,
  QUIET_STORY,
  QUIET_STORY_2,
  QUIET_STORY_3,
  CHARGE_STORY,
  CHARGE_STORY_2,
  CHARGE_STORY_3,
  TSUN_STORY,
  TSUN_STORY_2,
  TSUN_STORY_3,
  HAIR_STORY,
  HAIR_STORY_2,
  HAIR_STORY_3,
  CAPTAIN_STORY,
  CAPTAIN_STORY_2,
  CAPTAIN_STORY_3,
  STOPWATCH_STORY,
  STOPWATCH_STORY_2,
  STOPWATCH_STORY_3,
  WINGS_STORY,
  WINGS_STORY_2,
  WINGS_STORY_3,
  GRIT_STORY,
  GRIT_STORY_2,
  GRIT_STORY_3,
  BENT_STORY,
  BENT_STORY_2,
  BENT_STORY_3,
  HUNGRY_STORY,
  HUNGRY_STORY_2,
  HUNGRY_STORY_3,
  SNIPER_STORY,
  SNIPER_STORY_2,
  SNIPER_STORY_3,
  ACTING_STORY,
  ACTING_STORY_2,
  ACTING_STORY_3,
  OPERATOR_STORY,
  OPERATOR_STORY_2,
  OPERATOR_STORY_3,
  SHIELD_STORY,
  SHIELD_STORY_2,
  SHIELD_STORY_3,
  TWIN_ELDER_STORY,
  TWIN_ELDER_STORY_2,
  TWIN_ELDER_STORY_3,
  TWIN_YOUNGER_STORY,
  TWIN_YOUNGER_STORY_2,
  TWIN_YOUNGER_STORY_3,
  SENSEI_STORY,
  SENSEI_STORY_2,
  SENSEI_STORY_3,
  FIRSTYEAR_STORY,
  FIRSTYEAR_STORY_2,
  FIRSTYEAR_STORY_3,
  CALC_STORY,
  CALC_STORY_2,
  CALC_STORY_3,
  CLASSMATE_STORY,
  CLASSMATE_STORY_2,
  CLASSMATE_STORY_3,
  RING_STORY,
  RING_STORY_2,
  RING_STORY_3,
  BLADE_STORY,
  BLADE_STORY_2,
  BLADE_STORY_3,
  PANDA_STORY,
  PANDA_STORY_2,
  PANDA_STORY_3,
  SUPERVISOR_STORY,
  SUPERVISOR_STORY_2,
  SUPERVISOR_STORY_3,
  BOSS_STORY,
  BOSS_STORY_2,
  BOSS_STORY_3,
  WIG_STORY,
  WIG_STORY_2,
  WIG_STORY_3,
  MAYO_STORY,
  MAYO_STORY_2,
  MAYO_STORY_3,
  TRADER_STORY,
  TRADER_STORY_2,
  TRADER_STORY_3,
  GLASSES_STORY,
  GLASSES_STORY_2,
  GLASSES_STORY_3,
  UMBRELLA_STORY,
  UMBRELLA_STORY_2,
  UMBRELLA_STORY_3,
  SADIST_STORY,
  SADIST_STORY_2,
  SADIST_STORY_3,
  CHIEF_STORY,
  CHIEF_STORY_2,
  CHIEF_STORY_3,
  AIDE_STORY,
  AIDE_STORY_2,
  AIDE_STORY_3,
  KUNOICHI_STORY,
  KUNOICHI_STORY_2,
  KUNOICHI_STORY_3,
  COUNSEL_STORY,
  COUNSEL_STORY_2,
  COUNSEL_STORY_3,
  THUNDER_STORY,
  THUNDER_STORY_2,
  THUNDER_STORY_3,
  SILK_STORY,
  SILK_STORY_2,
  SILK_STORY_3,
  VAN_STORY,
  VAN_STORY_2,
  VAN_STORY_3,
  DOC_STORY,
  DOC_STORY_2,
  DOC_STORY_3,
  INFOLADY_STORY,
  INFOLADY_STORY_2,
  INFOLADY_STORY_3,
  VOLT_STORY,
  VOLT_STORY_2,
  VOLT_STORY_3,
  BARKEEP_STORY,
  BARKEEP_STORY_2,
  BARKEEP_STORY_3,
  HIRE_STORY,
  HIRE_STORY_2,
  HIRE_STORY_3,
  INTERN_STORY,
  INTERN_STORY_2,
  INTERN_STORY_3,
  GIANT_STORY,
  GIANT_STORY_2,
  GIANT_STORY_3,
  FORMER_STORY,
  FORMER_STORY_2,
  FORMER_STORY_3,
  BURNING_STORY,
  BURNING_STORY_2,
  BURNING_STORY_3,
  WOLF_STORY,
  WOLF_STORY_2,
  WOLF_STORY_3,
  FROST_STORY,
  FROST_STORY_2,
  FROST_STORY_3,
  SNIPERTWO_STORY,
  SNIPERTWO_STORY_2,
  SNIPERTWO_STORY_3,
  BLOOD_STORY,
  BLOOD_STORY_2,
  BLOOD_STORY_3,
  BRIEFING_STORY,
  BRIEFING_STORY_2,
  BRIEFING_STORY_3,
  CAT_STORY,
  CAT_STORY_2,
  CAT_STORY_3,
  WHEEL_STORY,
  WHEEL_STORY_2,
  WHEEL_STORY_3,
];

/** 이 계정의 회차 목록(선언 순서 = 1·2·3회차). 스토리 계정이 아니면 빈 배열. */
export function chaptersFor(handle: string): DmStory[] {
  return DM_STORIES.filter((s) => s.partnerHandle === handle);
}

/** id로 스토리를 찾는다(구세이브·데이터 변경 대비 undefined 허용). */
export function dmStoryById(id: string | undefined): DmStory | undefined {
  return id ? DM_STORIES.find((s) => s.id === id) : undefined;
}

/** 스토리 안에서 노드를 찾는다. */
export function dmStoryNode(story: DmStory, nodeId: string): DmStoryNode | undefined {
  return story.nodes.find((n) => n.id === nodeId);
}
