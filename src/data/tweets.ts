import type { AttributeId, TweetKind } from "@/core/types";
import { TWEET_KINDS } from "@/core/types";
import { allSetTexts } from "./tweetSets";
import { allMediaSetTexts, mediaKindTexts } from "./mediaTweets";
import { allLongTexts, longKindTexts } from "./longTweets";
import { short as dailyShort } from "./categories/daily";
import { short as politicsShort } from "./categories/politics";
import { short as idolShort } from "./categories/idol";
import { short as animeShort } from "./categories/anime";
import { short as actorShort } from "./categories/actor";
import { short as gamingShort } from "./categories/gaming";
import { short as foodShort } from "./categories/food";
import { short as fitnessShort } from "./categories/fitness";
import { short as beautyShort } from "./categories/beauty";
import { short as humorShort } from "./categories/humor";
import { short as infoShort } from "./categories/info";
import { short as itShort } from "./categories/it";
import { short as dogShort } from "./categories/dog";
import { short as catShort } from "./categories/cat";
import { short as animalShort } from "./categories/animal";
import { short as plantShort } from "./categories/plant";
import { short as cookingShort } from "./categories/cooking";
import { short as financeShort } from "./categories/finance";
import { short as sportsShort } from "./categories/sports";
import { short as fashionShort } from "./categories/fashion";
import { short as travelShort } from "./categories/travel";
import { short as adultShort } from "./categories/adult";

/** 트윗 감정 톤 — NPC 타임라인 생성·기사 모드용(플레이어 톤 선택은 성격으로 대체됨). */
export type TweetTone = "positive" | "negative";

/** 트윗 성격 4종 고정 순서(UI 카드 순서). 타입은 core/types.ts. */
export { TWEET_KINDS };
export type { TweetKind } from "@/core/types";

/**
 * 성인 트윗 종류(만남추구·체벌·주종관계·그룹)·종류별 문구·모텔 결과 문구는
 * categories/adult.ts로 이관해 관리한다. 기존 import 경로(`@/data/tweets`) 호환을 위해 여기서 re-export.
 */
export { ADULT_KINDS, ADULT_TWEETS, MOTEL_RESULT_TWEETS } from "./categories/adult";

/**
 * 속성별 트윗 문구 템플릿.
 * - kinds: 성격(TweetKind)별 문구 풀. **단일 소스** — 플레이어 4성격 후보와 NPC 피드가 모두 여기서 나간다.
 * - adult: 성인물 해제 시에만 섞이는 야한 문구(노골적인 성인 톤)
 * - positive/negative: (레거시·옵셔널) 성인 계열(adult.ts)만 아직 보유. kinds가 비었을 때의 폴백으로만 읽힌다.
 *   일반 계열 17개는 kinds로 이관 후 이 두 배열을 지운다(옵셔널이라 삭제해도 typecheck 통과).
 * 각 문구는 140자 이내이며, 짧은 것과 긴 것을 섞어 자연스러운 타임라인을 만든다.
 * 실제 문구는 카테고리별 파일(categories/*.ts)의 short export에 있다.
 */
export interface TweetTemplateSet {
  /**
   * 성격(TweetKind)별 플레이어 작성 후보 풀 & NPC 피드 소스. 카테고리 파일(categories/*.ts)이 채운다.
   * 일반 계열 17개는 4키(plain/provoke/info/emotional)를 모두 채운다.
   * 특정 성격 풀이 비면 kindTemplatesFor가 kinds 전체 합집합으로 폴백한다.
   */
  kinds?: Partial<Record<TweetKind, string[]>>;
  adult?: string[];
  /** @deprecated 성인 계열(adult.ts)만 잔존. kinds로 완전 이관 후 이 두 필드는 타입에서 제거 예정. */
  positive?: string[];
  /** @deprecated positive 참조. */
  negative?: string[];
}

/** 한 세트의 kinds 4종 풀을 TWEET_KINDS 순서로 이어붙인 합집합. 없으면 빈 배열. */
function kindsUnion(set: TweetTemplateSet): string[] {
  if (!set.kinds) return [];
  return TWEET_KINDS.flatMap((k) => set.kinds?.[k] ?? []);
}

export const TWEET_TEMPLATES: Record<AttributeId, TweetTemplateSet> = {
  daily: dailyShort,
  politics: politicsShort,
  idol: idolShort,
  anime: animeShort,
  actor: actorShort,
  gaming: gamingShort,
  food: foodShort,
  fitness: fitnessShort,
  beauty: beautyShort,
  humor: humorShort,
  info: infoShort,
  it: itShort,
  dog: dogShort,
  cat: catShort,
  animal: animalShort,
  plant: plantShort,
  cooking: cookingShort,
  finance: financeShort,
  sports: sportsShort,
  fashion: fashionShort,
  travel: travelShort,
  adult: adultShort,
};

/**
 * 속성·성인여부에 맞는 문구 후보를 반환(유저 작성 일반 트윗 폴백용).
 * kinds 단일 소스로 재배선 — 4성격 picker(kindTemplatesFor)와 같은 풀을 쓴다.
 * `_tone`은 시그니처 호환용으로만 남겨 두며 더 이상 참조하지 않는다(article 모드는 UI가 자체 처리).
 */
export function templatesFor(attr: AttributeId, _tone: TweetTone, adult: boolean): string[] {
  const set = TWEET_TEMPLATES[attr];
  const base = kindsUnion(set);
  if (adult && set.adult) return [...base, ...set.adult];
  return base;
}

/**
 * 성격(TweetKind)별 플레이어 작성 후보 풀을 반환한다(4성격 picker가 성격당 1줄씩 뽑을 때 사용).
 * 풀 = short kinds[kind] ∪ 그 계열 롱트윗 중 kind일치 ∪ 그 계열 미디어세트 중 kind일치.
 * → 한 성격 카드에 짧은글/장문/미디어가 섞여 나온다(롱/미디어는 content가 kind를 채운 뒤부터 섞임).
 * 합쳐도 비면 그 계열의 kinds 전체 합집합으로, 그래도 비면 positive/negative로 최후 폴백.
 */

/**
 * '진심' 성격 공용 문구 풀.
 *
 * ⚠️ 다른 성격과 달리 **갈래별로 나누지 않는다.** 혼을 갈아넣는 글은 주제가 무엇이든
 *    말투가 같기 때문이고, 23개 갈래에 각각 쓰는 대신 공용 풀 하나로 두는 게
 *    톤의 일관성에도 맞는다. 갈래별 색을 넣고 싶으면 categories/*.ts의 kinds.soul을
 *    채워라 — kindTemplatesFor가 그걸 이 풀과 **합쳐서** 준다.
 */
export const SOUL_TWEETS: string[] = [
  "이 얘기 꺼내면 다들 오글거린다고 할 거 아는데 그래도 한 번은 쓰고 싶었어요. 나는 잘하고 싶어서 여기까지 온 게 아니라 그냥 그만두는 방법을 몰라서 왔습니다. 그게 부끄러운 일인 줄 알았는데 요즘은 그것도 재능인가 싶어요.",
  "새벽에 쓰는 글은 아침에 지운다는 말이 있죠. 근데 오늘은 안 지울 겁니다. 나는 나를 오래 미워했고 그 시간이 아깝다는 걸 이제야 압니다. 미워하는 데 쓴 시간만큼만 나한테 잘해줬어도 지금쯤 다른 사람이 됐을 텐데.",
  "누가 물어본 적 없지만 말하고 싶어요. 저는 매일 아침에 오늘도 그만둘까 생각하고, 매일 밤에 내일은 해보자고 합니다. 그 사이에 있는 하루가 제 인생입니다. 대단한 결심 같은 건 한 번도 해본 적 없어요.",
  "잘 지내냐고 물어보면 늘 잘 지낸다고 했는데 사실 아니었습니다. 근데 거짓말이었다기보다는, 그렇게 말해야 진짜 그렇게 될 것 같아서였어요. 지금은 조금 나아졌습니다. 정말로요.",
  "제가 제일 무서워하는 건 실패가 아니라 아무 일도 안 일어나는 겁니다. 욕이라도 먹으면 살아 있는 것 같은데, 조용하면 내가 여기 왜 있나 싶어져요. 이런 마음으로 글을 쓰는 게 맞나 싶으면서도 씁니다.",
  "고맙다는 말을 제때 못 하는 사람입니다. 늦어서 이제 못 하게 된 말들이 몇 개 있어요. 그 사람들은 아마 모를 거고, 알 필요도 없겠지만, 그래도 여기에라도 적어둡니다. 고마웠습니다.",
  "성공한 사람들 글을 읽으면 다들 어느 순간 결심을 하더라고요. 저는 그런 순간이 없었습니다. 그냥 어제 하던 걸 오늘도 했고 그게 몇 년 됐어요. 결심한 적 없이 여기까지 온 사람도 있다는 게 누군가한테는 위로가 되면 좋겠습니다.",
  "요즘 제일 자주 하는 생각은 '이걸 언제까지 할 수 있을까'입니다. 답은 모르겠고, 아마 답을 아는 사람은 없을 거예요. 그래도 오늘은 했습니다. 그거면 오늘치는 된 것 같아요.",
];

export function kindTemplatesFor(attr: AttributeId, kind: TweetKind): string[] {
  const set = TWEET_TEMPLATES[attr];
  const pool = [
    ...(set.kinds?.[kind] ?? []),
    ...longKindTexts(attr, kind),
    ...mediaKindTexts(attr, kind),
    // 진심은 갈래별 풀이 (아직) 없어도 늘 제 톤으로 나와야 한다 — 공용 풀을 합친다.
    ...(kind === "soul" ? SOUL_TWEETS : []),
  ];
  if (pool.length > 0) return pool;
  const union = kindsUnion(set);
  if (union.length > 0) return union;
  return [...(set.positive ?? []), ...(set.negative ?? [])];
}

/** 톤과 무관한 전체 문구 후보(남의 계정 타임라인 생성용). NPC 피드도 kinds에서 나간다. */
export function allTemplatesFor(attr: AttributeId, adult: boolean): string[] {
  const set = TWEET_TEMPLATES[attr];
  // kinds가 단일 소스. kinds 없는 계열(성인)만 레거시 positive/negative로 폴백.
  const short =
    kindsUnion(set).length > 0
      ? kindsUnion(set)
      : [...(set.positive ?? []), ...(set.negative ?? [])];
  const base = [
    ...short,
    ...allSetTexts(attr),
    ...allMediaSetTexts(attr),
    ...allLongTexts(attr),
  ];
  if (adult && set.adult) return [...base, ...set.adult];
  return base;
}

/**
 * 도덕성이 매우 낮을 때만 쓸 수 있는 사기성 트윗 문구.
 * 돈을 벌지만 평판이 크게 떨어진다.
 */
export const SCAM_TWEETS: string[] = [
  "【마감임박】 이 링크로 가입만 하면 하루 30만원 보장! 선착순 놓치지 마세요 👉",
  "제가 쓰는 재테크 비법 무료로 풉니다 DM 주시면 원금 보장 투자처 알려드려요",
  "코인 정보방 무료 오픈, 딱 오늘까지만! 이번 떡상 놓치면 평생 후회함",
  "명품 정가 90% 세일 공동구매 진행합니다 입금 순으로 배송, 서두르세요",
  "무료나눔 이벤트! 팔로우+리트윗하고 링크에 정보만 입력하면 기프티콘 쏩니다",
  "월 500 부업 노하우 전자책 무료 배포 중, 지금 신청 안 하면 손해예요",
];

/**
 * 정신력이 바닥났을 때만 쓸 수 있는 우울한 트윗 문구.
 * 속성과 무관하게 이 풀만 노출된다.
 */
export const GLOOMY_TWEETS: string[] = [
  "다 놓고 싶다",
  "아무것도 하기 싫어",
  "왜 사는 걸까 요즘 자꾸 그런 생각만 든다",
  "밤이 너무 길다, 잠도 안 오고 마음만 무거워서 천장만 보다가 새벽을 다 보냈다",
  "괜찮은 척하는 것도 이제 지친다",
  "나만 이렇게 뒤처지는 것 같아서 숨이 막히고 아무것도 손에 안 잡히는 하루였다",
  "웃는 법을 잊어버린 것 같아",
  "누군가 그냥 괜찮냐고 한마디만 물어봐 줬으면 좋겠는 밤",
  "열심히 산다고 뭐가 달라지긴 하나 싶어",
  "그냥 조용히 사라지고 싶은 기분이 드는 날이 있다, 오늘이 딱 그런 날",
];
