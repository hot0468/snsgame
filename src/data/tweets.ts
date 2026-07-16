import type { AttributeId } from "@/core/types";
import { allSetTexts, setTextsFor } from "./tweetSets";
import { allMediaSetTexts, mediaSetTextsFor } from "./mediaTweets";
import { allLongTexts, longTextsFor } from "./longTweets";
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
import { short as adultShort } from "./categories/adult";

/** 트윗 감정 톤 — 유저는 카테고리(속성)와 이 톤만 고른다. */
export type TweetTone = "positive" | "negative";

/**
 * 성인 트윗 종류(만남추구·체벌·주종관계·그룹)·종류별 문구·모텔 결과 문구는
 * categories/adult.ts로 이관해 관리한다. 기존 import 경로(`@/data/tweets`) 호환을 위해 여기서 re-export.
 */
export { ADULT_KINDS, ADULT_TWEETS, MOTEL_RESULT_TWEETS } from "./categories/adult";

/**
 * 속성별 트윗 문구 템플릿.
 * - positive: 긍정 톤 문구
 * - negative: 부정 톤 문구
 * - adult: 성인물 해제 시에만 섞이는 야한 문구(노골적인 성인 톤)
 * 각 문구는 140자 이내이며, 짧은 것과 긴 것을 섞어 자연스러운 타임라인을 만든다.
 * 유저가 카테고리+톤을 고르면 해당 풀에서 랜덤으로 한 문장이 뽑혀 트윗된다.
 * 실제 문구는 카테고리별 파일(categories/*.ts)의 short export에 있다.
 */
export interface TweetTemplateSet {
  positive: string[];
  negative: string[];
  adult?: string[];
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
  adult: adultShort,
};

/** 속성·톤·성인여부에 맞는 문구 후보를 반환(유저 작성용) */
export function templatesFor(attr: AttributeId, tone: TweetTone, adult: boolean): string[] {
  const set = TWEET_TEMPLATES[attr];
  // 기본 톤 문구 + '트윗+멘션 세트' + '미디어 트윗 세트' 문구
  const base = [
    ...(tone === "negative" ? set.negative : set.positive),
    ...setTextsFor(attr, tone),
    ...mediaSetTextsFor(attr, tone),
    ...longTextsFor(attr, tone),
  ];
  if (adult && set.adult) return [...base, ...set.adult];
  return base;
}

/** 톤과 무관한 전체 문구 후보(남의 계정 타임라인 생성용) */
export function allTemplatesFor(attr: AttributeId, adult: boolean): string[] {
  const set = TWEET_TEMPLATES[attr];
  const base = [
    ...set.positive,
    ...set.negative,
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
