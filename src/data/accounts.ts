import type { Account, AttributeId, Tweet } from "@/core/types";
import { pick, randInt, uid, chance } from "@/utils/random";
import { ALL_ATTRIBUTE_IDS, ATTRIBUTES } from "./attributes";
import { allTemplatesFor } from "./tweets";
import { maybeEventTweet } from "./tweetEvents";
import { makeMedia } from "./media";
import { mediaSetFor } from "./mediaTweets";

const NAME_PREFIX = [
  "구름", "달빛", "새벽", "고양", "라라", "민트", "초코", "하늘",
  "느긋한", "심심한", "배고픈", "졸린", "행복한", "우울한",
];
const NAME_SUFFIX = [
  "토끼", "너구리", "감자", "여우", "곰돌이", "판다", "덕후", "요정",
  "0v0", "n", "_", "쨩", "님",
];

/** 랜덤 유저 이름/핸들 생성(반응·계정 생성 등에서 공용으로 사용) */
export function randomName(): { name: string; handle: string } {
  const name = `${pick(NAME_PREFIX)}${pick(NAME_SUFFIX)}`;
  const handle = `${pick(["", "the_", "im_", "just_"])}${Math.random().toString(36).slice(2, 7)}`;
  return { name, handle };
}

const BIO_BY_ATTR: Record<AttributeId, string[]> = {
  daily: ["평범한 직장인의 소소한 일상", "그냥 사는 얘기 합니다"],
  politics: ["세상 돌아가는 이야기", "생각을 나눕니다"],
  idol: ["최애만 보고 삽니다", "덕질이 삶의 원동력"],
  anime: ["이번 분기 애니 정주행 중", "굿즈 지름신 강림 계정"],
  actor: ["믿고 보는 배우 덕질", "영화관이 내 집"],
  gaming: ["게임하는 사람", "랭커 지망생"],
  food: ["먹는 게 제일 좋아", "맛집 탐험가"],
  fitness: ["오운완 인증 계정", "건강한 몸에 건강한 정신"],
  beauty: ["뷰티 정보 공유", "화장품 리뷰합니다"],
  humor: ["웃기고 싶은 사람", "드립이 인생"],
  info: ["꿀팁·생활정보 공유", "알아두면 쓸모있는 정보 계정"],
  it: ["IT·테크 소식 정리", "개발자의 기록장"],
  dog: ["우리 강아지 자랑만 합니다", "댕댕이가 세상의 전부인 집사"],
  cat: ["우리 고양이 주접 계정", "냥이 집사의 덕질 계정"],
  animal: ["길냥이 밥 주는 사람", "동물권에 관심 많은 계정"],
  plant: ["식집사의 초록 일지", "반려식물 키우는 중"],
  cooking: ["집밥 짓는 사람", "오늘도 뭐 해 먹지 고민 중"],
  adult: ["성인 컨텐츠 주의", "은밀한 취향 계정"],
};

/** 남의 트윗 한 개 생성 */
function makeForeignTweet(
  attr: AttributeId,
  author: { name: string; handle: string },
  adultMode: boolean,
  day: number,
): Tweet {
  // 아이돌/애니/배우 트윗은 가끔 행사 안내 트윗으로 뜬다(참여하기 대상)
  const ev = maybeEventTweet(attr, day);
  const isAdult = !ev && (ATTRIBUTES[attr].adultOnly || (adultMode && chance(0.2)));
  const text = ev ? ev.text : pick(allTemplatesFor(attr, adultMode));
  const tweet: Tweet = {
    id: uid("ftweet"),
    authorName: author.name,
    authorHandle: author.handle,
    attribute: attr,
    isAdult,
    text,
    createdDay: day,
    likes: randInt(0, 500),
    retweets: randInt(0, 120),
    gainedFollowers: 0,
    event: ev?.event,
  };
  // 미디어 세트 트윗이면 그 미디어를, 아니면 확률적으로 랜덤 미디어 첨부
  const mset = mediaSetFor(text);
  if (mset) tweet.media = mset.media;
  else if (!ev && chance(0.35)) tweet.media = makeMedia(attr);
  // 일부 트윗은 난도가 높아, 어휘력이 낮으면 글자가 깨져 보인다(행사 트윗 제외).
  // 난이도는 어휘력과 같은 0~999 스킬 스케일이다(구 25~95 → 250~950).
  if (!ev && chance(0.4)) tweet.difficulty = randInt(250, 950);
  return tweet;
}

/**
 * 탐색용 랜덤 계정 하나 생성.
 * adultMode가 꺼져 있으면 성인계 계정/트윗은 제외한다.
 */
export function makeRandomAccount(adultMode: boolean, day: number): Account {
  const pool = adultMode
    ? ALL_ATTRIBUTE_IDS
    : ALL_ATTRIBUTE_IDS.filter((a) => !ATTRIBUTES[a].adultOnly);
  const attr = pick(pool);
  const author = randomName();
  const timeline = Array.from({ length: randInt(2, 3) }, () =>
    makeForeignTweet(attr, author, adultMode, day - randInt(0, 3)),
  );
  return {
    id: uid("acct"),
    name: author.name,
    handle: author.handle,
    attribute: attr,
    isAdult: ATTRIBUTES[attr].adultOnly,
    bio: pick(BIO_BY_ATTR[attr]),
    followers: randInt(50, 50_000),
    timeline,
    followed: false,
  };
}

/** 특정 성향(카테고리)의 남 트윗 하나 생성(검색·카테고리 탭용) */
export function makeTweetOfAttribute(attr: AttributeId, adultMode: boolean, day: number): Tweet {
  return makeForeignTweet(attr, randomName(), adultMode, day);
}

/** 이스터에그 트윗 문구 풀 */
const EGG_LINES: Record<import("@/core/types").EggKind, string[]> = {
  coin: [
    "이 코인 지금 안 사면 평생 후회함... 가즈아 🚀 #떡상각 #존버는승리한다",
    "내부 정보인데 이번 주 이 코인 무조건 간다 나만 알기 아까워서 풀어요",
    "영끌해서 풀매수 했다 이번엔 진짜 인생 역전이다 다들 타라",
  ],
  pyramid: [
    "月 1000만원 부업 궁금하신 분? 누구나 가능합니다 관심 있으면 DM 주세요 💰",
    "저는 이 사업으로 경제적 자유를 찾았어요. 함께 성장할 분 모십니다 🙌",
    "평범한 직장인에서 인생이 바뀌었습니다. 설명회 오시면 다 알려드려요!",
  ],
  animal: [
    "우리 동네 길고양이 너무 귀엽지 않나요 🐈 오늘도 밥 주고 왔어요 냥복치사량",
    "강아지 산책 인증 오늘도 행복 🐕 이 세상 강아지들 다 지켜주고 싶다",
    "퇴근하고 길냥이 츄르 주는 게 유일한 낙임... 얘가 이제 날 알아봐요 ㅠㅠ",
  ],
};

const EGG_ATTR: Record<import("@/core/types").EggKind, AttributeId> = {
  coin: "it",
  pyramid: "info",
  animal: "daily",
};

/** 좋아요 시 특수 이벤트가 붙는 이스터에그 트윗을 만든다. */
export function makeEggTweet(kind: import("@/core/types").EggKind, day: number): Tweet {
  const author = randomName();
  const attr = EGG_ATTR[kind];
  return {
    id: uid("egg"),
    authorName: author.name,
    authorHandle: author.handle,
    attribute: attr,
    isAdult: false,
    text: pick(EGG_LINES[kind]),
    createdDay: day,
    likes: randInt(0, 800),
    retweets: randInt(0, 200),
    gainedFollowers: 0,
    egg: kind,
  };
}

/**
 * 정체불명 도시 괴담·익명 조직 톤의 '소문' 트윗 저자(고정 패러디 핸들).
 * 익명 채팅방/도시전설 분위기를 살린 오마주 — 특정 작품 인용이 아닌 오리지널.
 */
const RUMOR_AUTHORS: { name: string; handle: string }[] = [
  { name: "이름없는 타로", handle: "taro_nanashi" },
  { name: "칸라칸라", handle: "kanra_bot" },
  { name: "밤의 셋톤", handle: "setton_night" },
  { name: "무색의 무리", handle: "nocolor_crew" },
  { name: "골목 목격담", handle: "alley_witness" },
  { name: "도시괴담 수집가", handle: "urban_legend_kr" },
];

/** 소문 트윗 문구 풀(오리지널 창작 — 익명 채팅방/도시전설 톤). */
const RUMOR_LINES: string[] = [
  "어젯밤 골목에서 목 없는 라이더 봤다는 애들 왜 이렇게 많냐;; 나만 못 봄?",
  "그 무리 있잖아. 색깔이 없는 게 색깔이래. 누가 멤버인지 아무도 모름",
  "이 동네 요즘 진짜 이상해. 다들 아는데 아무도 정체를 몰라",
  "검은 오토바이가 소리도 없이 지나갔는데 헤드라이트가 안 켜져 있었음. 실화냐",
  "익명 채팅방에서 만난 사람이 알고 보니 옆자리 동료였다는 썰 ㅋㅋㅋ 소름",
  "누가 우리 동네 소문을 다 알고 있는데, 정작 본인은 어디에도 없대",
  "그 사람들 다 같은 편이라는데 서로가 누군지도 모른다니까 그게 더 무섭",
  "밤마다 목 없는 그림자가 골목을 돈다는 얘기, 그냥 괴담인 줄 알았는데…",
  "정체불명 계정이 사건 터지기 전에 항상 먼저 알고 있음. 대체 뭐 하는 애냐",
  "이 도시엔 아는 사람만 아는 규칙이 있대. 나는 아직 초대 못 받음 ㅠ",
  "요즘 횡단보도에서 누가 등을 슬쩍 민다는 얘기 진짜임? 돌아보면 아무도 없었대 소름",
  "'밀치는 손' 목격담마다 인상착의가 다 달라. 정체가 아예 없는 사람 같대",
  "밤길 지나고 나니 옷소매만 소리 없이 잘려 있었다는 사람 늘어남… '베는 남자' 실화냐",
  "아프지도 피도 안 나는데 코트만 싹둑 잘려 있었대. 근데 아무도 그 사람을 못 봤다니까",
  "무너지는 간판 아래서 애를 밀어내고 이름도 안 밝히고 사라진 택배기사… 이 도시의 진짜 영웅 아니냐",
  "위기 때마다 나타나 사람 구하고 유니폼 차림으로 조용히 사라진다는 그 택배 아저씨, 실존함?",
];

/** 소문 트윗을 만든다(고정 패러디 핸들 + 오리지널 문구). 피드에 낮은 확률로 섞인다. */
export function makeRumorTweet(day: number): Tweet {
  const author = pick(RUMOR_AUTHORS);
  return {
    id: uid("rumor"),
    authorName: author.name,
    authorHandle: author.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(RUMOR_LINES),
    createdDay: day,
    likes: randInt(0, 500),
    retweets: randInt(0, 150),
    gainedFollowers: 0,
  };
}

/** 신규 게시글 탐색용: 저자 계정 없이 트윗만 랜덤 생성 */
export function makeRandomTweet(adultMode: boolean, day: number): Tweet {
  // 낮은 확률로 정체불명 소문 트윗이 피드에 섞인다.
  if (chance(0.08)) return makeRumorTweet(day);
  const pool = adultMode
    ? ALL_ATTRIBUTE_IDS
    : ALL_ATTRIBUTE_IDS.filter((a) => !ATTRIBUTES[a].adultOnly);
  const attr = pick(pool);
  const author = randomName();
  return makeForeignTweet(attr, author, adultMode, day);
}
