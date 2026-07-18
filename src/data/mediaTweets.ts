import type { AttributeId, TweetKind, TweetMedia } from "@/core/types";
import type { TweetTone } from "./tweets";
import { media as dailyMedia } from "./categories/daily";
import { media as politicsMedia } from "./categories/politics";
import { media as idolMedia } from "./categories/idol";
import { media as animeMedia } from "./categories/anime";
import { media as actorMedia } from "./categories/actor";
import { media as gamingMedia } from "./categories/gaming";
import { media as foodMedia } from "./categories/food";
import { media as fitnessMedia } from "./categories/fitness";
import { media as beautyMedia } from "./categories/beauty";
import { media as humorMedia } from "./categories/humor";
import { media as infoMedia } from "./categories/info";
import { media as itMedia } from "./categories/it";
import { media as dogMedia } from "./categories/dog";
import { media as catMedia } from "./categories/cat";
import { media as animalMedia } from "./categories/animal";
import { media as plantMedia } from "./categories/plant";
import { media as cookingMedia } from "./categories/cooking";
import { media as adultMedia } from "./categories/adult";

/**
 * '트윗 + 사진/영상(자리) + 관련 멘션 3개'를 한 세트로 묶은 미디어 트윗.
 * 이 세트 트윗을 올리면 그 트윗의 미디어와 전용 멘션이 함께 따라온다(카테고리당 20종).
 * 실제 문구·미디어·멘션은 카테고리별 파일(categories/*.ts)의 media export에 있다.
 */
export interface MediaTweetSet {
  text: string;
  /** @deprecated 죽은 필드 — kind로 대체됨. 기존 엔트리 호환용으로만 남김(더 이상 읽지 않음). */
  tone?: TweetTone;
  media: TweetMedia;
  mentions: string[];
  /** 성격(TweetKind). content-author가 채우면 kindTemplatesFor가 그 성격 카드에 이 미디어 세트를 섞는다. */
  kind: TweetKind;
}

export const MEDIA_TWEET_SETS: Record<AttributeId, MediaTweetSet[]> = {
  daily: dailyMedia,
  politics: politicsMedia,
  idol: idolMedia,
  anime: animeMedia,
  actor: actorMedia,
  gaming: gamingMedia,
  food: foodMedia,
  fitness: fitnessMedia,
  beauty: beautyMedia,
  humor: humorMedia,
  info: infoMedia,
  it: itMedia,
  dog: dogMedia,
  cat: catMedia,
  animal: animalMedia,
  plant: plantMedia,
  cooking: cookingMedia,
  adult: adultMedia,
};

const BY_TEXT = new Map<string, MediaTweetSet>();
for (const list of Object.values(MEDIA_TWEET_SETS)) {
  for (const s of list) BY_TEXT.set(s.text, s);
}

/** 미디어 트윗 세트를 문구로 찾는다(미디어·멘션 귀속용). */
export function mediaSetFor(text: string): MediaTweetSet | undefined {
  return BY_TEXT.get(text);
}

/** 카테고리의 특정 성격(kind) 미디어 세트 트윗 문구들(kind 미태깅 엔트리는 제외). */
export function mediaKindTexts(attr: AttributeId, kind: TweetKind): string[] {
  return MEDIA_TWEET_SETS[attr].filter((s) => s.kind === kind).map((s) => s.text);
}

/** 카테고리의 모든 미디어 세트 트윗 문구(톤 무관) */
export function allMediaSetTexts(attr: AttributeId): string[] {
  return MEDIA_TWEET_SETS[attr].map((s) => s.text);
}
