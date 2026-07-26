import type { GameState, SkillStatId, Tweet } from "@/core/types";
import { dominantAttribute, getActiveAccount, MORNING_SLOT, pushTimeline } from "@/core/state";
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
import { chance, pick, randInt, uid } from "@/utils/random";
import { calcTweetOutcome, changeFollowers } from "./followers";
import { clampAction, clampResource, clampSkill, gainSkill } from "./stats";
import { addSchedule, advanceTime } from "./time";
import { unlockAttribute } from "./attributeUnlock";
import { spawnFanDM } from "./dm";
import { LOTTERY_LUCK_CAP } from "./ohaasa";

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
  const pool = allTemplatesFor(attr, state.adultMode);
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
  pushTimeline(account, tweet);
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

/** 대형 협찬 수락 — 목돈·팔로워는 이미 선언형 effect가 줬다. 여기선 낮은 확률로 뒷광고 논란만 굴린다. */
const SPONSOR_CONTROVERSY_CHANCE = 0.25;
function sponsorDeal(state: GameState): string {
  addSchedule(state, "대형 협찬 계약", "sns");
  // rollControversy는 '아무 논란이나' 랜덤이라 여기 못 쓴다 — 협찬엔 뒷광고 논란이라야 말이 된다.
  // pendingControversy를 직접 지정하고, 이미 진행 중인 논란이 있으면 덮지 않는다.
  if (!state.pendingControversy && chance(SPONSOR_CONTROVERSY_CHANCE)) {
    state.pendingControversy = "ctrl_paid_promo";
    return "두둑한 계약금이 입금됐다. 그런데 며칠 뒤, 협찬 트윗을 두고 뭔가 술렁이기 시작했다…";
  }
  return "두둑한 계약금이 입금됐다. 광고 표기도 깔끔히 달아 잡음 없이 마무리했다.";
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
  // 오하아사 운세로 쌓인 로또 운이 꽝 경계를 낮춘다(상위 등수 경계는 유지). 추첨 직후 소진.
  const shift = Math.min(state.lotteryLuck, LOTTERY_LUCK_CAP) * 0.02;
  state.lotteryLuck = 0;
  const r = Math.random();
  if (r < 0.6 - shift) return "꽝. 역시 복권은 세금이라더니... 1,000원만 날렸다.";
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

/** 종합소득세 실효세율(성실 납부 기준). 축소 신고 적발 시 이 세액의 2배를 추징한다. */
const TAX_RATE = 0.22;
/** 축소 신고 시 실제로 내는 낮은 세율 */
const TAX_DODGE_RATE = 0.08;
/** 축소 신고가 세무조사에 걸릴 확률 */
const TAX_AUDIT_CHANCE = 0.3;

/** 종합소득세 성실 납부 — 소지금 비례 세액을 내고 떳떳함(평판)을 얻는다. */
function taxPay(state: GameState): string {
  const tax = Math.floor(state.money * TAX_RATE);
  state.money -= tax;
  state.resources.reputation = clampResource(state.resources.reputation + 5);
  return `성실하게 ${won(tax)}원을 납부했다. 지갑은 쓰라리지만 뒤탈 없이 깔끔하고, 떳떳함이 남았다.`;
}

/**
 * 종합소득세 축소 신고 — 도덕성을 깎고 적게 낸다. 낮은 확률로 세무조사에 걸리면
 * 성실 세액의 2배를 가산세로 추징당한다(소지금을 넘지 않는 선에서).
 */
function taxDodge(state: GameState): string {
  state.resources.morality = clampResource(state.resources.morality - 8);
  if (Math.random() < TAX_AUDIT_CHANCE) {
    const penalty = Math.min(state.money, Math.floor(state.money * TAX_RATE * 2));
    state.money -= penalty;
    state.resources.mental = clampResource(state.resources.mental - 10);
    return `하필 세무조사 대상에 걸렸다! 축소 신고가 들통나 가산세까지 붙어 ${won(penalty)}원을 추징당했다. 괜히 욕심부렸다...`;
  }
  const tax = Math.floor(state.money * TAX_DODGE_RATE);
  state.money -= tax;
  return `수입을 슬쩍 줄여 신고했다. ${won(tax)}원만 내고 넘어갔다. 양심은 좀 찔리지만 지갑은 지켰다.`;
}

/**
 * 고액 후원자 난교(성인) — 저택에서 밤샘. 이튿날 타임블록을 전부 넘겨 '2일 뒤 아침'에 멈춘다.
 * 목돈·음란도는 크게 오르고 도덕성·정신력을 크게 소모한다. 그룹 플레이가 해금된다.
 */
function whaleOrgy(state: GameState): string {
  state.money += 1_000_000;
  state.skills.lewd = clampSkill(state.skills.lewd + 45);
  state.resources.morality = clampResource(state.resources.morality - 18);
  state.resources.mental = clampResource(state.resources.mental - 8);
  getActiveAccount(state).groupUnlocked = true;

  addSchedule(state, "고액 후원자 저택 — 밤샘", "offline");

  // 2일 뒤 아침까지 시간 스킵. advanceTime이 취침/회복/정산 훅을 정상 처리한다.
  // slot은 매 호출 반드시 증가하므로 target 도달이 보장된다(무한루프 없음).
  const target = state.day + 2;
  while (!(state.day >= target && state.slot === MORNING_SLOT)) advanceTime(state, 1);

  /* content-author: 고액 후원자 저택 난교 서사(성인) */
  return (
    "통장에 백만 원이 찍힌 그날 밤, 후원자는 주소 하나를 보내왔다. 도심을 벗어난 외진 주택가, 담장이 높은 고즈넉한 단독주택이었다. 대문을 밀고 들어서자 은은한 조명과 낮게 깔린 음악이 후끈한 정액 냄새와 섞여 코를 찔렀다.\n\n" +

    "그런데 거실에 들어선 순간 나는 문 앞에 얼어붙었다. 나를 부른 후원자는 혼자가 아니었다. 넓은 거실 곳곳에 낯선 남자들이 스무 명도 넘게, 이미 바지 지퍼를 내리고 단단하게 선 좆을 꺼낸 채 나를 음침한 눈빛으로 훑으며 기다리고 있었다. 돌아서려 했지만 이미 늦었다. 여러 손이 동시에 달려들어 부드럽게, 그러나 거절할 수 없는 힘으로 나를 안쪽으로 끌고 갔다.\n\n" +

    "그들은 곧 내 손목과 발목을 부드러운 끈으로 단단히 묶어 옴짝달싹 못 하게 만들었다. 저항할 수 없는 채로 수십 개의 손이 동시에 온몸을 더듬기 시작했다. 블라우스를 찢듯이 벗겨내고 브라를 벗기자 커다란 가슴이 출렁이며 드러났고, 남자들이 경쟁하듯 젖꼭지를 빨아대고 세게 꼬집고 비틀었다. 치마를 걷어 올리고 팬티를 벗겨내자 이미 축축하게 젖어 흘러내리는 보지를 손가락 여러 개가 거칠게 헤집었다. 클리토리스를 문지르고, G스팟을 긁어대며 애액을 질질 짜냈다. 엉덩이 구멍까지 손가락이 쑤셔 들어와 꿈틀거리는 내 몸을 희롱했다. 사방에서 쏟아지는 더러운 욕설과 함께 머릿속이 하얘졌고, 묶인 몸은 그저 그들의 손길에 떨며 애액을 뿜을 뿐이었다.\n\n" +

    "밤이 깊어지자 희롱은 본격적인 난교로 바뀌었다. 한 남자가 뒤에서 두꺼운 좆을 자궁까지 쑤셔 박아 넣는 순간, 앞에 선 남자의 지린내 나는 자지를 입에 깊숙이 물려야 했다. 목구멍까지 처박히며 눈물이 줄줄 흘렀지만, 뒤에서는 허리를 미친 듯이 흔들며 보지를 마구 찔러댔다. 한 명이 보지 안에 뜨거운 정액을 왕창 싸지르고 물러나면, 곧바로 다음 남자가 미끄러운 정액을 윤활제로 삼아 더 깊이 박아 넣었다. 앞뒤 구멍이 동시에 채워지기도 했고, 세 명이 동시에 몸을 쓰며 가슴, 보지, 입을 번갈아 범했다.\n\n" +

    "정액이 섞인 애액이 허벅지와 바닥을 흥건히 적시고, 내 몸은 이미 정액범벅이 되었다. 남자들이 번갈아 가며 나를 탐하는 동안 나는 몇 번이나 절정을 넘겼는지 셀 수조차 없었다. 자궁을 때리는 충격에 눈이 뒤집히고, 몸이 경련하며 오줌처럼 애액을 분수처럼 뿜어냈다. 누군가는 내 얼굴에, 가슴에, 머리카락에 정액을 뿌려댔고, 입 안 가득 정액을 받아 삼키게 했다.\n\n" +

    "그렇게 밤이 새고 날이 밝고 다시 밤이 오도록, 저택 안의 난교는 끝없이 이어졌다. 이틀 동안 나는 거의 잠도 자지 못한 채 계속해서 좆에 찔리고, 정액을 주입당하고, 온몸의 구멍이라는 구멍은 모두 사용당했다. 정신을 차렸을 땐 이미 이틀이 지나 있었다. 창으로 아침 햇살이 비껴들었고, 온몸은 녹초가 된 채 정액과 애액으로 번들거리고 부어 있었다. 보지는 벌어진 채로 계속 경련하고, 항문은 화끈거리며 정액을 흘리고 있었다.\n\n" +

    "죄책감과 강렬한 쾌감, 해방감이 뒤섞인 낯선 기분 속에서, 후원자가 머리맡에 남긴 두툼한 봉투만이 지난 이틀이 꿈이 아니었음을 증명하고 있었다."
  );
}

/**
 * 검정 봉고 납치 난교(성인) — 산책 중 음란 높을 때.
 * 운전자 포함 3명에게 유린당한 뒤 공터에 버려진다. 그룹 해금.
 */
/**
 * 벽고(벽 구멍) — 산책 중 담벼락 구멍에 몸을 넣었다가 끼여 빠지지 못하고 비합의로 당하는 조우.
 * 봉고와 같은 강압/범죄 계열이라 effect 프로필·해금(groupUnlocked)을 동일하게 맞춘다.
 */
export function wallHoleOrgy(state: GameState): string {
  state.skills.lewd = clampSkill(state.skills.lewd + 55);
  state.resources.morality = clampResource(state.resources.morality - 16);
  state.resources.mental = clampResource(state.resources.mental - 14);
  state.resources.reputation = clampResource(state.resources.reputation - 4);
  changeFollowers(state, 30);
  getActiveAccount(state).groupUnlocked = true;

  addSchedule(state, "벽고 — 비합의", "offline");

  return (
    "인적 없는 골목의 낡은 담벼락에, 사람 하나 들어갈 만한 커다란 구멍이 뻥 뚫려 있었다. " +
    "호기심 반, 달아오른 몸이 시키는 대로 반쯤 홀린 듯 하반신을 그 안으로 밀어 넣은 순간, 허리가 구멍에 꽉 끼여 앞으로도 뒤로도 빠지지 않았다.\n\n" +

    "버둥거리는 사이 벽 반대편에서 인기척이 다가왔다. 빠져나오려 발버둥 칠수록 몸은 더 깊이 끼였고, 엉덩이만 무방비하게 벽 밖으로 내밀린 꼴이 되었다. 낯선 손들이 치마를 걷어 올리고 팬티를 끌어내리는 게 느껴졌지만, 낀 채로는 돌아볼 수도, 막을 수도 없었다.\n\n" +

    "누군지도 모르는 남자들이 번갈아 뒤에서 몸을 붙여 왔다. 벽에 짓눌린 채 허리를 붙잡히고, 저항 한 번 제대로 못 한 채로 계속 관통당했다. 한 명이 물러나면 곧바로 다음 사람의 차례였고, 벽 이편의 나는 그들의 얼굴조차 보지 못했다.\n\n" +

    "얼마나 지났을까, 인기척이 하나둘 멀어지고 나서야 겨우 몸을 비틀어 구멍에서 빠져나왔다. 옷은 흐트러지고 다리는 후들거렸으며, 원치 않았는데도 끝까지 반응해 버린 몸에 수치심과 쾌감이 뒤섞여 밀려왔다. 비틀거리며 골목을 빠져나오는 내내, 방금 일어난 일이 현실이 맞는지 실감이 나지 않았다."
  );
}

export function blackVanOrgy(state: GameState): string {
  state.skills.lewd = clampSkill(state.skills.lewd + 55);
  state.resources.morality = clampResource(state.resources.morality - 16);
  state.resources.mental = clampResource(state.resources.mental - 14);
  state.resources.reputation = clampResource(state.resources.reputation - 4);
  changeFollowers(state, 35);
  getActiveAccount(state).groupUnlocked = true;

  addSchedule(state, "검정 봉고 — 납치 난교", "offline");

  return (
    "골목 입구에 검은 봉고 한 대가 시동을 건 채 서 있었다. 조수석 창이 내려가더니 중년 남자가 길을 물었다. " +
    "지도를 보여 주겠다며 손짓하길래 가까이 다가간 순간, 슬라이딩 도어가 거칠게 열리며 남자 둘이 뛰어내렸다.\n\n" +

    "입에 재갈이 쑤셔 박히고 팔이 뒤로 꺾인 채 차 안으로 처박혔다. 뒷좌석은 트렁크까지 시트가 완전히 접혀 성인 하나가 누울 만큼 넓은 평평한 공간으로 되어 있었고, 그 위에 내 몸이 거칠게 내동댕이쳐졌다. 문이 닫히자 차 안은 칠흑처럼 어두워졌고, 엔진 소리와 남자들의 거친 숨소리, 지퍼 여는 소리만이 울렸다. 운전석의 남자까지 몸을 돌리자, 좁은 공간에 세 명의 남자가 나를 완전히 둘러쌌다.\n\n" +

    "블라우스가 찢어지고 브라가 벗겨지며 가슴이 드러났다. 치마는 허리까지 걷어 올려지고 팬티는 한 번에 찢겨 나갔다. 한 명이 손목을 머리 위로 꺾어 고정하고, 다른 둘이 허벅지를 세게 벌렸다. 이미 단단하게 선 두꺼운 좆 하나가 목구멍 깊숙이 처박히고, 동시에 보지 속으로 또 다른 좆이 미친 듯이 쑤셔 들어왔다. 차가 덜컹거릴 때마다 좆이 자궁을 세게 때렸고, 천장에 머리가 부딪힐 정도로 허리를 들어 올려 박아댔다.\n\n" +

    "남자들은 교대하며 계속해서 박아댔다. 한 명이 보지에 사정하고 물러나면 바로 다음 좆이 정액이 가득한 보지 안으로 미끄러지듯 들어왔다. 입 안에는 정액과 침이 섞여 넘쳐흘렀고, 가슴은 손자국과 빨아먹은 자국으로 가득했다. 좆을 빨다가 목이 메이고, 보지는 정액으로 범벅이 되어 질퍽질퍽 소리를 내며 계속해서 관통당했다. 창밖으로 고속도로와 외곽 길이 스쳐 지나갔지만, 나는 한 번도 제대로 몸을 일으키지 못한 채 좆에 꽂힌 상태로 계속 흔들렸다.\n\n" +

    "어느 한적한 공터에 차가 멈추자 트렁크 문이 활짝 열렸다. 차가운 밤공기가 들어오며 헤드램프 불빛이 내 벌어진 다리 사이를 비췄다. 그들은 나를 문턱에 걸치듯 눕힌 채 야외에서 이어서 박아댔다. 한 명은 보지에, 또 한 명은 입에, 남은 한 명은 가슴 사이로 좆을 문지르며 사정했다. 다리가 부들부들 떨리고, 정액이 허벅지를 타고 흙바닥으로 뚝뚝 떨어졌다. 세 번째, 네 번째 사정이 배와 얼굴, 가슴 위에 뿌려진 뒤에도 그들은 웃으며 내 보지를 손가락으로 헤집으며 마지막 애액을 짜냈다.\n\n" +

    "엔진 소리가 멀어지고 나서야 공터의 적막이 내려앉았다. 옷은 반쯤 찢긴 채 흩어져 있었고, 다리는 후들거려 바로 서지도 못했다. 보지는 활짝 벌어진 채로 정액을 꾸역꾸역 흘리고 있었고, 온몸이 정액과 땀, 흙으로 더럽혀져 있었다. 버려졌다는 공포와, 끝까지 몸이 쾌감에 반응해 버린 수치심과 쾌락이 한꺼번에 밀려왔다. 한참을 비틀거리며 걷다 겨우 큰길을 찾아냈을 때, 손에 남은 건 흙 묻은 스마트폰과 꺼질 듯한 배터리뿐이었다."
  );
}

/**
 * 크루 합동 훈련(성인) — 합방 리허설을 가장한 그룹 플레이.
 * 음란·친화 상승, 정신·도덕 소모. 그룹 해금 유지/강화.
 */
function crewGangDrill(state: GameState): string {
  state.skills.lewd = clampSkill(state.skills.lewd + 40);
  state.skills.sociability = clampSkill(state.skills.sociability + 15);
  state.resources.morality = clampResource(state.resources.morality - 12);
  state.resources.mental = clampResource(state.resources.mental - 8);
  changeFollowers(state, 55);
  getActiveAccount(state).groupUnlocked = true;

  addSchedule(state, "크루 합동 훈련", "offline");

  return (
    "합동 훈련 장소는 크루 멤버의 연습용 원룸이었다. 카메라 삼각대는 세워져 있었지만 빨간불은 꺼져 있었다. " +
    "'호흡, 교대, 각도.' 누군가 농담처럼 말하자 웃음이 터졌고, 곧 웃음은 옷 벗는 소리로 바뀌었다.\n\n" +

    "소파와 매트 위에서 멤버들이 번갈아 달라붙었다. 합방에서 쓰던 닉네임을 부르며 허리를 맞추고, " +
    "타이머를 맞춰 가며 교대했다. 한 명이 입과 허리를 쓰는 동안 다른 멤버가 옆에서 대기했다가 바로 이어받는 " +
    "리듬은, 방송용 큐시트처럼 잔인할 만큼 정확했다. 정액이 배 위에 떨어질 때마다 '컷' 대신 짧은 탄성이 나왔다.\n\n" +

    "훈련이 끝났을 때 몸은 녹초였고, 단톡에는 '오늘 호흡 좋았음' 한 줄만 남았다. 합방 퀄이 오른 만큼, " +
    "오프의 경계선은 더 흐려져 있었다."
  );
}

/** 좋아요를 본 상대가 맞팔하며 DM을 보내온다 — 실제 팬 DM 스레드를 하나 생성한다. */
function mutualFollowDM(state: GameState): string {
  spawnFanDM(state);
  return "좋아요를 본 상대가 반갑게 맞팔하며 DM을 보내왔다. 새 인연이 하나 생겼다.";
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
  sponsorDeal,
  taxPay,
  taxDodge,
  whaleOrgy,
  blackVanOrgy,
  crewGangDrill,
  mutualFollowDM,
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
    gainSkill(state, skill as SkillStatId, amount ?? 0);
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
