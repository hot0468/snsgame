import type { GameState, Tweet } from "@/core/types";
import { pick, randInt, uid } from "@/utils/random";
import { clampAction, clampMental, clampResource, gainSkill } from "./stats";

/**
 * '밤에 찾아오는 괴담 계정' — 좋아요를 누르면 그날 심야에 실제로 찾아온다.
 * 좋아요 → hauntPending 예약. time.onLateNight의 maybeHauntVisit이 그날 심야에
 * hauntVisitNow를 세우고, ui가 이를 감지해 괴담 모달을 띄운다(sleepPending과 공존).
 * 모달 확정 시 resolveHauntVisit → 결과 표시 + 두 flag 클리어.
 *
 * ⚠️ content-author: *_ACCOUNT / *_TWEET_LINES / resolveHauntVisit 성인·비성인 서사가 placeholder.
 * ⚠️ ui-builder: hauntVisitNow 감지 → 괴담 모달(app.ts 강제팝업, 취침보다 먼저) → resolveHauntVisit.
 */

// 밤에 찾아오는 괴담 계정 — 빨간마스크 도시전설 패러디
export const HAUNT_ACCOUNT = { name: "빨간마스크", handle: "red_mask" };

// 심야 방문을 예고하는 괴담 유인 트윗 문구
export const HAUNT_TWEET_LINES = [
  "…이 트윗을 본 당신. 좋아요를 누르는 순간, 저는 당신 집 현관 앞에 서 있게 됩니다. 그래도 누르시겠어요?",
  "저는 밤에만 움직여요. 오늘 좋아요를 누른 사람의 집으로, 새벽 한 시에 찾아갈게요. 문… 잘 잠갔나요?",
  "제 얼굴, 예쁜가요? 좋아요를 누른 당신에게 오늘 밤 직접 보여드릴게요. 마스크를 벗은 채로.",
];

/** 괴담 트윗 하나를 만든다. */
export function makeHauntTweet(state: GameState): Tweet {
  return {
    id: uid("haunttw"),
    authorName: HAUNT_ACCOUNT.name,
    authorHandle: HAUNT_ACCOUNT.handle,
    attribute: "daily",
    isAdult: false,
    text: pick(HAUNT_TWEET_LINES),
    createdDay: state.day,
    likes: randInt(0, 40),
    retweets: randInt(0, 10),
    gainedFollowers: 0,
  };
}

/** 이 트윗이 괴담 트윗인지 */
export function isHauntTweet(tweet: Tweet): boolean {
  return tweet.authorHandle === HAUNT_ACCOUNT.handle;
}

/**
 * 심야 훅(time.onLateNight)에서 호출 — 방문 예약(hauntPending)이 있으면
 * 그날 심야 방문(hauntVisitNow)을 발동시킨다. ui가 hauntVisitNow를 감지해 모달을 띄운다.
 */
export function maybeHauntVisit(state: GameState): void {
  if (state.hauntPending) state.hauntVisitNow = true;
}

export interface HauntOutcome {
  message: string;
}

/**
 * 괴담 계정이 심야에 찾아온 결과를 적용한다.
 * - 성인 모드: 성인 공포 서사(음란↑·도덕성↓·정신력↓).
 * - 그 외: 순수 공포(정신력↓·행동력↓).
 * 두 예약 flag(hauntPending·hauntVisitNow)를 모두 클리어한다.
 * @returns 표시용 결과 문구(placeholder — content-author 교체)
 */
export function resolveHauntVisit(state: GameState): HauntOutcome {
  state.hauntPending = false;
  state.hauntVisitNow = false;
  // 빨간마스크 강제 정사(비합의)는 '강압/범죄 안 보기' 켜면 순수 공포 분기로 대체한다.
  if (state.adultMode && !state.adultNoCoercion) {
    const lewd = randInt(30, 50);
    const morality = randInt(10, 20);
    const mental = randInt(10, 20);
    gainSkill(state, "lewd", lewd);
    state.resources.morality = clampResource(state.resources.morality - morality);
    state.resources.mental = clampMental(state, state.resources.mental - mental);
    // 성인 공포 서사(호러+에로, 웹소설 수위)
    return { message:
      "새벽 한 시, 잠결에 눈을 떴을 때 이미 그것은 침대 발치에 서 있었다. 분명히 잠갔던 현관문이 소리 없이 " +
      "열려 있었다. 붉은 마스크 아래로 드러난 창백한 입가가 귀밑까지 길게 찢어져 웃고 있었고, 어둠 속에서 " +
      "번들거리는 두 눈이 나를 똑바로 붙들었다. 비명을 지르려 했지만 목구멍에서는 아무 소리도 새어나오지 " +
      "않았다. 몸이 이불에 못 박힌 듯 움직이지 않았다.\n\n" +
      "차갑고 축축한 손이 발목을 타고 올라와 순식간에 옷을 벗겨냈다. 저항하려 버둥거릴수록 그것은 더 " +
      "즐거운 듯 낮게 그르렁거렸다. 마스크 아래 찢어진 입에서 뻗어 나온 길고 축축한 혀가 목덜미부터 " +
      "가슴까지 훑고 지나갔고, 소름이 돋는 감각 뒤로 몸이 저릿하게 달아오르는 게 스스로도 소름 끼쳤다. " +
      "젖꼭지를 이로 물어 굴리고, 이미 축축해진 보지를 차가운 손가락이 헤집는 동안, 나는 두려움과 열기가 " +
      "뒤섞인 채 허리를 떨었다.\n\n" +
      "그것은 내 다리를 무자비하게 벌리고, 인간의 것이라 믿기 힘들 만큼 굵고 차가운 자지를 단숨에 깊숙이 " +
      "박아 넣었다. 배 속이 얼음처럼 시리게 관통당하는 감각에 눈물이 터졌지만, 그 이질적인 마찰이 안쪽을 " +
      "쑤실 때마다 몸은 배신하듯 조여들며 애액을 쏟아냈다. 그것은 귀에 대고 알아들을 수 없는 말을 " +
      "속삭이며, 시트가 흥건해지도록 쉬지 않고 박아댔다.\n\n" +
      "창밖이 희뿌옇게 밝아 올 때까지, 그것은 나를 몇 번이고 뒤집어 엎고 다시 꿰뚫었다. 앞과 뒤가 번갈아 " +
      "채워지고, 셀 수도 없이 절정을 넘기는 동안 정신은 반쯤 녹아내렸다. 마침내 안쪽 가장 깊은 곳에 " +
      "얼음장 같은 무언가를 길게 쏟아낸 순간, 나는 온몸을 경련하며 마지막 절정에 삼켜졌다.\n\n" +
      "새벽빛이 방을 채우자 그것은 왔을 때처럼 소리 없이 사라졌다. 현관문은 다시 얌전히 잠겨 있었고, " +
      "간밤의 일을 증명하는 건 얼얼하게 부어오른 아랫도리와 시트에 밴 서늘한 흔적, 그리고 온몸에 남은 " +
      "낯선 열기뿐이었다. 두 번 다시 그 트윗에 좋아요를 눌러선 안 된다는 걸, 이제야 뼈저리게 알았다" +
      `(음란 +${lewd}, 도덕성 -${morality}, 정신력 -${mental}).` };
  }
  const mental = randInt(15, 25);
  const action = randInt(10, 20);
  state.resources.mental = clampMental(state, state.resources.mental - mental);
  state.resources.action = clampAction(state, state.resources.action - action);
  // 순수 공포 서사
  return { message: `새벽 한 시, 창문을 두드리는 소리에 눈을 떴다. 커튼 틈으로, 붉은 마스크를 쓴 무언가가 나를 들여다보고 있었다. 눈이 마주친 순간부터 아침까지, 나는 이불 속에서 숨소리조차 죽인 채 뜬눈으로 밤을 지새웠다(정신력 -${mental}, 행동력 -${action}).` };
}
