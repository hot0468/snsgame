import type { AttributeId, TweetKind } from "@/core/types";
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
  /** @deprecated 죽은 필드 — kind로 대체됨. 기존 엔트리 호환용으로만 남김(더 이상 읽지 않음). */
  tone?: TweetTone;
  /** 성격(TweetKind). content-author가 채우면 kindTemplatesFor가 그 성격 카드에 이 장문을 섞는다. */
  kind: TweetKind;
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

/** 카테고리의 특정 성격(kind) 장문 트윗 문구들(kind 미태깅 엔트리는 제외). */
export function longKindTexts(attr: AttributeId, kind: TweetKind): string[] {
  return LONG_TWEETS[attr].filter((t) => t.kind === kind).map((t) => t.text);
}

/** 카테고리의 모든 장문 트윗 문구(톤 무관) */
export function allLongTexts(attr: AttributeId): string[] {
  return LONG_TWEETS[attr].map((t) => t.text);
}
