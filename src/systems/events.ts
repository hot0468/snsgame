import type { GameState, SkillStatId, Tweet } from "@/core/types";
import { dominantAttribute, getActiveAccount } from "@/core/state";
import {
  GAME_EVENTS,
  type EventEffect,
  type EventTrigger,
  type GameEvent,
} from "@/data/events";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { MAX_SKILL } from "@/data/stats";
import { getTrendingCategories } from "@/data/trends";
import { allTemplatesFor } from "@/data/tweets";
import { pick, randInt, uid } from "@/utils/random";
import { calcTweetOutcome, changeFollowers } from "./followers";
import { clampAction, clampResource, clampSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";
import { unlockAttribute } from "./attributeUnlock";

/** 행동 1회당 이벤트가 발생할 기본 확률 */
export const EVENT_BASE_CHANCE = 0.3;

/**
 * 트리거에 맞는 이벤트 하나를 확률적으로 고른다.
 * - 기본 확률을 통과해야 하고, condition을 만족하는 후보들 중 weight로 가중 추첨.
 * - 발생하지 않으면 null.
 */
export function rollEvent(state: GameState, trigger: EventTrigger): GameEvent | null {
  if (Math.random() >= EVENT_BASE_CHANCE) return null;

  const candidates = GAME_EVENTS.filter(
    (e) => e.triggers.includes(trigger) && (e.condition?.(state) ?? true),
  );
  if (candidates.length === 0) return null;

  const total = candidates.reduce((sum, e) => sum + (e.weight ?? 1), 0);
  let roll = Math.random() * total;
  for (const e of candidates) {
    roll -= e.weight ?? 1;
    if (roll <= 0) return e;
  }
  return candidates[candidates.length - 1];
}

/**
 * 오늘의 인기 카테고리 중 하나에 편승한다.
 * - 해당 카테고리 트윗이 랜덤으로 내 타임라인에 생성된다.
 * - 그 카테고리가 내 계정 색과 잘 맞으면(궁합>0) 팔로워가 늘고, 안 맞으면 깎인다.
 */
function jumpOnTrend(state: GameState): string {
  const account = getActiveAccount(state);
  const attr = pick(getTrendingCategories(state.day));
  const used = new Set(
    account.timeline
      .filter((t) => t.authorHandle === account.handle && !t.isRetweet)
      .map((t) => t.text),
  );
  const pool = allTemplatesFor(attr, account.adultMode);
  const fresh = pool.filter((t) => !used.has(t));
  const text = pick(fresh.length ? fresh : pool);
  const outcome = calcTweetOutcome(state, attr);
  const affinity = getAffinity(account.attribute, attr); // 1 동일 / -1 상충 / 0 중립

  const base = 15 + Math.floor(account.followers * 0.03);
  const delta =
    affinity > 0
      ? base + randInt(5, 25)
      : affinity < 0
        ? -(base + randInt(5, 25))
        : randInt(-6, 8);

  const tweet: Tweet = {
    id: uid("trendtw"),
    authorName: account.name,
    authorHandle: account.handle,
    attribute: attr,
    isAdult: false,
    text,
    createdDay: state.day,
    likes: outcome.likes,
    retweets: outcome.retweets,
    gainedFollowers: delta,
  };
  account.timeline.unshift(tweet);
  changeFollowers(state, delta);
  account.attribute = dominantAttribute(account); // 편승 트윗도 성향에 반영

  const tag = `#${ATTRIBUTES[attr].label}`;
  if (delta > 0) return `${tag} 트렌드에 올라탔다! 계정 색과 잘 맞아 팔로워 +${delta}.`;
  if (delta < 0) return `${tag} 트렌드에 편승했지만 계정 색과 안 맞았다... 팔로워 ${delta}.`;
  return `${tag} 트렌드에 편승했지만 반응은 미지근했다.`;
}

/**
 * 논란 '역공(맞대응)' — 개그·어휘력 감각에 걸린 도박.
 * 성공하면 사이다 발언으로 팔로워가 크게 늘고, 실패하면 기름을 부어 더 크게 잃는다.
 */
function counterAttack(state: GameState): string {
  const account = getActiveAccount(state);
  const wit = (state.skills.comedy + state.skills.vocabulary) / 2; // 0~999
  const success = Math.random() < 0.25 + (wit / MAX_SKILL) * 0.5; // 25%~75%
  if (success) {
    const gain = Math.round(account.followers * 0.12) + 30;
    changeFollowers(state, gain);
    state.resources.mental = clampResource(state.resources.mental + 5);
    return `재치 있는 맞대응이 사이다로 통했다! 구경하던 사람들이 몰려와 팔로워가 +${gain} 늘었다.`;
  }
  const loss = Math.round(account.followers * 0.2) + 20;
  changeFollowers(state, -loss);
  state.resources.mental = clampResource(state.resources.mental - 12);
  state.resources.reputation = clampResource(state.resources.reputation - 8);
  return `괜히 기름을 부었다. 역풍이 거세지며 팔로워가 ${-loss} 빠지고 평판도 더 떨어졌다.`;
}

/**
 * 야외 노출 촬영 — 적발 리스크가 걸린 도박.
 * 성공하면 아찔한 컷이 터져 팔로워가 크게 늘고, 실패하면 행인에게 걸려 망신·평판 하락.
 */
export function outdoorShoot(state: GameState): string {
  const account = getActiveAccount(state);
  const caught = Math.random() < 0.35; // 35% 적발
  if (caught) {
    const loss = Math.round(account.followers * 0.05) + 10;
    changeFollowers(state, -loss);
    state.resources.reputation = clampResource(state.resources.reputation - 12);
    state.resources.mental = clampResource(state.resources.mental - 10);
    state.resources.morality = clampResource(state.resources.morality - 3);
    return (
      `촬영 도중 지나가던 행인에게 딱 걸렸다! 소란이 일고 망신만 당한 채 도망쳤다. ` +
      `평판이 크게 떨어지고 팔로워도 ${loss} 빠졌다.`
    );
  }
  const gain = Math.round(account.followers * 0.15) + 70;
  changeFollowers(state, gain);
  state.skills.lewd = clampSkill(state.skills.lewd + 20);
  state.skills.beauty = clampSkill(state.skills.beauty + 5);
  state.resources.morality = clampResource(state.resources.morality - 5);
  return `아무도 없는 틈을 노려 아찔한 컷을 건졌다. 대담한 야외 촬영물이 폭발적으로 퍼지며 팔로워가 +${gain} 늘었다!`;
}

/**
 * 동료에게 계정을 공개했을 때의 결과.
 * 내 타임라인에 성인글/부정적인(정치) 글이 없으면 친해져 친화력이 오르고,
 * 있으면 이미지가 나빠져 회사에서 평판이 떨어진다.
 */
function coworkerFollow(state: GameState): string {
  const account = getActiveAccount(state);
  const myTweets = account.timeline.filter(
    (t) => t.authorHandle === account.handle && !t.isRetweet,
  );
  const hasAdult = account.attribute === "adult" || myTweets.some((t) => t.isAdult);
  const hasNegative = myTweets.some((t) => t.attribute === "politics");

  if (hasAdult || hasNegative) {
    state.resources.reputation = clampResource(state.resources.reputation - 12);
    state.resources.mental = clampResource(state.resources.mental - 6);
    const what = hasAdult ? "낯 뜨거운 성인글" : "예민한 정치글";
    return (
      `동료가 계정을 보더니 표정이 굳었다. ${what}이 그대로 드러나 회사에 어색한 소문이 돌았다. ` +
      `평판이 크게 떨어졌다.`
    );
  }
  state.skills.sociability = clampSkill(state.skills.sociability + 20);
  state.resources.mental = clampResource(state.resources.mental + 3);
  return "동료가 계정을 보고 '오, 잘 관리하시네요' 하며 웃었다. 덕분에 자연스럽게 친해져 친화력이 올랐다.";
}

const won = (n: number) => n.toLocaleString("ko-KR");

/**
 * 급등 종목 제보 — 현금의 30%를 걸고 50% 확률로 대박/손실.
 * 성공하면 투자금의 3배를 회수(순이익 2배), 실패하면 투자금을 날린다.
 */
function coinPump(state: GameState): string {
  const invest = Math.floor(state.money * 0.3);
  if (invest < 1000) return "투자할 현금이 부족해 눈물을 머금고 지켜만 봤다.";
  state.money -= invest;
  if (Math.random() < 0.5) {
    const payout = invest * 3;
    state.money += payout;
    return `대박! 종목이 떡상했다. 투자한 ${won(invest)}원이 ${won(payout)}원으로 돌아왔다!`;
  }
  return `물렸다... 종목이 곤두박질쳐 투자한 ${won(invest)}원을 그대로 날렸다.`;
}

/** 유료 구독 채널 개설 — 개설 플래그를 켜고 초기 구독자 유입. */
function openPaidChannel(state: GameState): string {
  state.paidChannelJoined = true;
  state.skills.lewd = clampSkill(state.skills.lewd + 10);
  changeFollowers(state, 20);
  addSchedule(state, "유료 구독 채널 개설", "system");
  return "유료 구독 채널을 개설했다. 골수팬들이 하나둘 구독하기 시작했다. 이제 매달 구독 수익이 정산된다.";
}

/** 단체 회식 참석 — 저녁 시간 블록과 정신력을 소모하고 동료와 조금 가까워진다. */
function companyDinner(state: GameState): string {
  state.resources.mental = clampResource(state.resources.mental - 12);
  state.skills.sociability = clampSkill(state.skills.sociability + 10);
  advanceTime(state, 1); // 저녁 시간 블록 소모
  return "억지로 잔을 부딪히다 보니 밤이 깊었다. 시간과 정신력을 쏟았지만 동료들과는 조금 가까워졌다.";
}

/** 계정 해킹 랜섬 — 몸값을 지불하고 50% 확률로 잠금 해제/먹튀. */
function hackRansom(state: GameState): string {
  const account = getActiveAccount(state);
  const ransom = Math.min(state.money, 5000);
  state.money -= ransom;
  if (Math.random() < 0.5) {
    state.resources.mental = clampResource(state.resources.mental - 5);
    return `요구한 ${won(ransom)}원을 보내자 거짓말처럼 계정 잠금이 풀렸다. 안도했지만 뒷맛이 영 찜찜하다.`;
  }
  const loss = Math.round(account.followers * 0.08) + 20;
  changeFollowers(state, -loss);
  state.resources.mental = clampResource(state.resources.mental - 12);
  return `돈만 받고 해커는 잠적했다. 계정은 그대로 털린 채 스팸이 도배됐고, 팔로워도 ${loss} 빠졌다.`;
}

/** 복권 — 1,000원에 등수별 당첨. */
function lottery(state: GameState): string {
  state.money -= 1000;
  const r = Math.random();
  if (r < 0.6) return "꽝. 역시 복권은 세금이라더니... 1,000원만 날렸다.";
  if (r < 0.9) {
    state.money += 5000;
    return "5등 당첨! 5,000원을 받았다. 본전은 넘겼다.";
  }
  if (r < 0.99) {
    state.money += 50000;
    return "오! 4등 당첨, 50,000원이다! 오늘 운수 좋은 날.";
  }
  state.money += 1_000_000;
  return "이럴 수가... 1등 당첨! 1,000,000원이 통장에 꽂혔다!!";
}

/** customKey → 특수 효과 로직(결과 문구 반환) */
const CUSTOM_EFFECTS: Record<NonNullable<EventEffect["customKey"]>, (s: GameState) => string> = {
  trendWave: jumpOnTrend,
  counterAttack,
  outdoorShoot,
  coworkerFollow,
  coinPump,
  openPaidChannel,
  companyDinner,
  hackRansom,
  lottery,
};

/** 선언형 효과를 상태에 적용. customKey가 있으면 동적 결과 문구를 반환한다. */
export function applyEffect(state: GameState, effect: EventEffect): string | void {
  // 행동력만 상한이 가변(clampAction) — 나머지 리소스는 고정 100(clampResource)이다.
  if (effect.action) state.resources.action = clampAction(state, state.resources.action + effect.action);
  if (effect.mental) state.resources.mental = clampResource(state.resources.mental + effect.mental);
  if (effect.morality)
    state.resources.morality = clampResource(state.resources.morality + effect.morality);
  if (effect.reputation)
    state.resources.reputation = clampResource(state.resources.reputation + effect.reputation);
  if (effect.money) state.money = Math.max(0, state.money + effect.money);

  if (effect.followers) changeFollowers(state, effect.followers);
  if (effect.followersPct) {
    const followers = getActiveAccount(state).followers;
    changeFollowers(state, Math.round(followers * (effect.followersPct / 100)));
  }

  for (const [skill, amount] of Object.entries(effect.skills ?? {})) {
    const key = skill as SkillStatId;
    state.skills[key] = clampSkill(state.skills[key] + (amount ?? 0));
  }

  const account = getActiveAccount(state);
  // ⚠️ push 직접 호출 금지 — 해금 부수효과(게임 스킬 기준선 등)를 단일 관문이 보장한다.
  if (effect.unlockAttribute && unlockAttribute(state, account, effect.unlockAttribute)) {
    addSchedule(
      state,
      `새 트윗 속성 해금: ${ATTRIBUTES[effect.unlockAttribute].label}`,
      "system",
    );
  }

  if (effect.customKey) return CUSTOM_EFFECTS[effect.customKey](state);
}

/**
 * 이벤트 선택지를 확정 적용한다.
 * @returns 결과 문구
 */
export function resolveEvent(
  state: GameState,
  event: GameEvent,
  choiceIndex: number,
): string {
  const choice = event.choices[choiceIndex];
  if (!choice) return "";
  const dynamic = applyEffect(state, choice.effect);
  addSchedule(state, event.title, "system");
  return dynamic || choice.result;
}
