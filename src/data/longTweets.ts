import type { AttributeId } from "@/core/types";
import type { TweetTone } from "./tweets";
import { long as dailyLong } from "./categories/daily";
import { long as politicsLong } from "./categories/politics";
import { long as idolLong } from "./categories/idol";
import { long as animeLong } from "./categories/anime";
import { long as actorLong } from "./categories/actor";
import { long as gamingLong } from "./categories/gaming";
import { long as foodLong } from "./categories/food";
import { long as fitnessLong } from "./categories/fitness";
import { long as beautyLong } from "./categories/beauty";
import { long as humorLong } from "./categories/humor";
import { long as infoLong } from "./categories/info";
import { long as itLong } from "./categories/it";
import { long as dogLong } from "./categories/dog";
import { long as catLong } from "./categories/cat";
import { long as animalLong } from "./categories/animal";
import { long as plantLong } from "./categories/plant";
import { long as cookingLong } from "./categories/cooking";
import { long as adultLong } from "./categories/adult";

/**
 * 130~140자 분량의 장문 트윗 모음(카테고리당 10개).
 * 톤별로 작성창·타임라인 문구 풀에 함께 섞인다.
 * 실제 문구는 카테고리별 파일(categories/*.ts)의 long export에 있다.
 */
export interface LongTweet {
  text: string;
  tone: TweetTone;
}

export const LONG_TWEETS: Record<AttributeId, LongTweet[]> = {
  daily: dailyLong,
  politics: politicsLong,
  idol: idolLong,
  anime: animeLong,
  actor: actorLong,
  gaming: gamingLong,
  food: foodLong,
  fitness: fitnessLong,
  beauty: beautyLong,
  humor: humorLong,
  info: infoLong,
  it: itLong,
  dog: dogLong,
  cat: catLong,
  animal: animalLong,
  plant: plantLong,
  cooking: cookingLong,
  adult: adultLong,
};

/** 카테고리·톤에 맞는 장문 트윗 문구들 */
export function longTextsFor(attr: AttributeId, tone: TweetTone): string[] {
  return LONG_TWEETS[attr].filter((t) => t.tone === tone).map((t) => t.text);
}

/** 카테고리의 모든 장문 트윗 문구(톤 무관) */
export function allLongTexts(attr: AttributeId): string[] {
  return LONG_TWEETS[attr].map((t) => t.text);
}
