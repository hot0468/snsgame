import type { GameState, Tweet } from "@/core/types";
import { pick, randInt, sample, uid } from "@/utils/random";
import {
  GENERIC_AD_TEMPLATES,
  YOUTUBE_AD_TEMPLATES,
  MEDIBOOKS_AD_TEMPLATES,
  STEAM_AD_TEMPLATES,
  AD_REWARD,
  type AdTweetTemplate,
} from "@/data/adTweets";

/**
 * 추천탭 광고 트윗 시스템.
 * - 매일 2개의 광고 트윗이 추천탭 상단에 스폰된다(onNewDay 훅).
 * - 광고는 미디어 형식이며, 미디어 클릭 시 트윗당 1회 +AD_REWARD원 적립(claimed 플래그).
 * - 앱 홍보 광고(adPromo.app)의 '바로가기'는 해당 브라우저 탭(youtube/medibooks/steam)을 해금한다.
 */

/** 하루에 스폰되는 광고 트윗 수 */
export const DAILY_AD_TWEET_COUNT = 2;
/** adTweets 풀 상한(초과분은 오래된 것부터 제거) */
export const AD_TWEETS_MAX = 8;

/** 광고 트윗 템플릿을 실제 Tweet 객체로 만든다. */
export function buildAdTweet(state: GameState, tpl: AdTweetTemplate): Tweet {
  return {
    id: uid("adtweet"),
    authorName: tpl.authorName,
    authorHandle: tpl.authorHandle,
    attribute: tpl.attribute,
    isAdult: false,
    text: tpl.text,
    createdDay: state.day,
    likes: randInt(5, 320),
    retweets: randInt(1, 90),
    gainedFollowers: 0,
    media: { kind: tpl.media.kind, prompt: tpl.media.prompt },
    adPromo: { reward: AD_REWARD, claimed: false, app: tpl.app },
  };
}

/**
 * 오늘자 광고 트윗을 DAILY_AD_TWEET_COUNT개 생성해 adTweets 앞(unshift)에 넣는다.
 * 규칙:
 * - 미해금 앱(youtube/medibooks/steam)이 있으면 그 앱 홍보 광고를 우선 포함한다.
 * - 잠긴 앱이 하루 칸 수보다 많으면(예: 3개 잠금 vs 2칸) sample로 랜덤하게 골라 번갈아 노출한다.
 * - 남는 칸은 일반 광고(GENERIC)로 채운다.
 * - 동일 앱 홍보는 하루 안에 중복 편성하지 않는다(잠긴 앱마다 최대 1개).
 * - 상한(AD_TWEETS_MAX) 초과분은 오래된 것(뒤)부터 제거.
 */
export function spawnDailyAdTweets(state: GameState): void {
  const templates: AdTweetTemplate[] = [];
  // 이미 추천탭에 떠 있는 광고 문구(중복 편성 방지용). 같은 문구는 다시 올리지 않는다.
  const usedTexts = new Set(state.adTweets.map((t) => t.text));

  // 이 풀에서 아직 안 쓴(usedTexts에 없는) 템플릿을 뽑는다.
  // 남은 게 없으면 null(칸을 건너뛰어 중복을 만들지 않는다).
  const pickUnused = (pool: readonly AdTweetTemplate[]): AdTweetTemplate | null => {
    const fresh = pool.filter((t) => !usedTexts.has(t.text));
    if (fresh.length === 0) return null;
    const chosen = pick(fresh);
    usedTexts.add(chosen.text);
    return chosen;
  };

  // 미해금 앱별 템플릿 풀을 모은다(잠긴 앱마다 최대 1개 편성).
  const lockedPools: AdTweetTemplate[][] = [];
  if (!state.youtubeUnlocked && YOUTUBE_AD_TEMPLATES.length > 0) {
    lockedPools.push(YOUTUBE_AD_TEMPLATES);
  }
  if (!state.medibooksUnlocked && MEDIBOOKS_AD_TEMPLATES.length > 0) {
    lockedPools.push(MEDIBOOKS_AD_TEMPLATES);
  }
  if (!state.steamUnlocked && STEAM_AD_TEMPLATES.length > 0) {
    lockedPools.push(STEAM_AD_TEMPLATES);
  }
  // 잠긴 앱이 여럿이면 하루 칸 수만큼 랜덤으로 골라(sample) 특정 앱만 계속 뜨지 않게 번갈아 노출.
  for (const poolForApp of sample(lockedPools, DAILY_AD_TWEET_COUNT)) {
    const t = pickUnused(poolForApp);
    if (t) templates.push(t);
  }

  // 남는 칸은 일반 광고로 채우되, 이미 떠 있는 문구와는 중복되지 않게 뽑는다.
  while (templates.length < DAILY_AD_TWEET_COUNT) {
    const t = pickUnused(GENERIC_AD_TEMPLATES);
    if (!t) break;
    templates.push(t);
  }
  // 잠긴 앱이 칸 수 이상이면 앱 홍보만으로 채워지므로 잘라 하루 상한을 지킨다.
  const todays = templates.slice(0, DAILY_AD_TWEET_COUNT);

  for (let i = todays.length - 1; i >= 0; i--) {
    state.adTweets.unshift(buildAdTweet(state, todays[i]));
  }

  if (state.adTweets.length > AD_TWEETS_MAX) {
    state.adTweets.length = AD_TWEETS_MAX;
  }
}

/**
 * 광고 트윗의 미디어를 클릭했을 때 적립을 처리한다.
 * adPromo가 있고 아직 미적립(!claimed)이면 money += reward, claimed=true, reward 반환.
 * 이미 적립됐거나 대상이 아니면 0.
 */
export function claimAdReward(state: GameState, tweetId: string): number {
  const tweet = state.adTweets.find((t) => t.id === tweetId);
  if (!tweet?.adPromo || tweet.adPromo.claimed) return 0;
  const reward = tweet.adPromo.reward;
  state.money += reward;
  tweet.adPromo.claimed = true;
  return reward;
}

/** 광고 '바로가기'로 해당 앱 탭을 해금한다. */
export function unlockAppTab(state: GameState, app: "youtube" | "medibooks" | "steam"): void {
  if (app === "youtube") state.youtubeUnlocked = true;
  else if (app === "medibooks") state.medibooksUnlocked = true;
  else if (app === "steam") state.steamUnlocked = true;
}

/**
 * day1 시드용: adTweets가 비어 있으면 1회 스폰한다.
 * onNewDay는 day 진행 시에만 타므로 게임 시작 시엔 광고가 비어 있다.
 * ui가 추천탭 최초 렌더 시 호출한다(systems는 렌더 시점을 모름).
 */
export function ensureAdTweetsSeeded(state: GameState): void {
  if (state.adTweets.length === 0) {
    spawnDailyAdTweets(state);
  }
}
