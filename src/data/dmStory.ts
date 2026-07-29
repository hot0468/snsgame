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
      choices: [
        {
          tone: "friendly",
          me: "무슨 일이 생기는데요?",
          reply: "아무 일도 안 생겨요. 그냥 습관처럼 하는 말이에요 🙂",
          next: "twist",
          effect: { followers: 400 },
        },
        {
          tone: "cool",
          me: "알겠어요.",
          reply: "역시 편한 분이에요. 그래서 좋아요.",
          next: "twist",
          effect: { followers: 400 },
        },
        {
          tone: "bold",
          me: "일 생기면 그쪽도 같이 끌고 들어갈 건데요",
          reply: "그것도 재밌겠네요. 그럼 서로 조심하죠 🙂",
          next: "twist",
          effect: { followers: 600, morality: -3 },
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
          effect: { reputation: 5, followers: 150 },
        },
        {
          tone: "cool",
          me: "제 일도 아닌데요.",
          reply: "맞습니다. 아무의 일도 아닙니다. 그래서 대개 아무도 안 합니다.",
          next: "twist",
        },
        {
          tone: "bold",
          me: "그 소문 누가 냈는지부터 알려줘요. 그쪽을 조질게요",
          reply: "그건 우리 방식이 아닙니다. 말리지도 않겠습니다만.",
          next: "twist",
          effect: { morality: -5, reputation: -2 },
        },
      ],
    },
    {
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
          effect: { skills: { sociability: 10 } },
        },
        {
          tone: "cool",
          me: "글은 쓰는 사람이 쓰는 거예요. 제가 조언할 건 없네요.",
          reply: "…맞는 말씀이에요. 제가 너무 남한테 기댔네요.",
          next: "debut",
        },
        {
          tone: "bold",
          me: "시작하면 내 계정에 홍보해줄게요. 대신 그쪽도 나 좀 밀어줘요",
          reply: "아… 그런 방법도 있군요. 네, 그렇게라도 해주시면 감사하죠.",
          next: "debut",
          effect: { followers: 200, morality: -3 },
        },
      ],
    },
    {
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

export const DM_STORIES: DmStory[] = [KANRA_STORY, NOCOLOR_STORY, TARO_STORY, SAIKA_STORY];

/** id로 스토리를 찾는다(구세이브·데이터 변경 대비 undefined 허용). */
export function dmStoryById(id: string | undefined): DmStory | undefined {
  return id ? DM_STORIES.find((s) => s.id === id) : undefined;
}

/** 스토리 안에서 노드를 찾는다. */
export function dmStoryNode(story: DmStory, nodeId: string): DmStoryNode | undefined {
  return story.nodes.find((n) => n.id === nodeId);
}
