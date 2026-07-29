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
          effect: { money: 30_000, morality: -3 },
        },
      ],
    },
    {
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
        },
        {
          tone: "cool",
          me: "제 이름이 왜 나와요? 그쪽 일이잖아요.",
          reply: "맞는 말이다. 그래서 미리 알리는 거다. 모르고 당하는 것보단 낫다.",
          next: "visitor",
        },
        {
          tone: "bold",
          me: "그 사람 누군지 알아내서 제가 먼저 만나볼게요",
          reply: "…하지 마라. 그런 건 나 같은 사람이 하는 일이다.",
          next: "visitor",
          effect: { morality: -3, skills: { sociability: 10 } },
        },
      ],
    },
    {
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
          effect: { morality: -3, mental: 5 },
        },
        {
          tone: "cool",
          me: "저는 아무 말도 안 할게요. 그게 제일 안전해요.",
          reply: "그게 맞다. 조용한 게 제일 좋은 답일 때가 많다.",
          next: "morning",
        },
        {
          tone: "bold",
          me: "미안한데 이건 못 참아요. 제가 제일 먼저 올릴게요",
          reply: "…그래. 언젠가 이런 날이 올 줄 알았다. 원망은 안 한다.",
          next: "morning",
          effect: { followersPct: 18, morality: -12, reputation: -8 },
        },
      ],
    },
    {
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
        },
        {
          tone: "cool",
          me: "그날 뭐가 있는데요?",
          reply: "아무 일도 없습니다. 당신이 아무것도 안 하면요.",
          next: "thursday",
        },
        {
          tone: "bold",
          me: "그날 뭐가 있는지 알아내면 되겠네요",
          reply: "…그것도 방법입니다. 우리는 막지 않습니다. 막은 적도 없고요.",
          next: "thursday",
          effect: { skills: { knowledge: 10 } },
        },
      ],
    },
    {
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
