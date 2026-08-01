import type { GameState, Tweet } from "@/core/types";
import { clampMental, gainStamina } from "./stats";
import { changeFollowers } from "./followers";
import { pick } from "@/utils/random";

/** 예언 계정('새벽 세 시의 예언') 핸들. 이 계정 트윗에 좋아요하면 예언이 예약된다. */
const OMEN_HANDLE = "omen_0333";

interface ProphecyOutcome {
  text: string;
  money?: number;
  followers?: number;
  mental?: number;
  stamina?: number;
}

/**
 * 예언 실현 결과 풀 — 좋은 것/나쁜 것이 섞인다("믿든 말든").
 * 대부분 사소한 일상 사건으로, 예언이 맞은 듯 아닌 듯 애매하게 실현된다.
 */
const PROPHECY_OUTCOMES: ProphecyOutcome[] = [
  { text: "길에서 접힌 만원짜리를 주웠다. 예언이... 맞았나?", money: 10_000 },
  { text: "오래 연락 없던 친구가 갑자기 밥을 샀다. 기분 좋은 하루였다.", mental: 5 },
  { text: "지갑을 어디서 흘렸다. 예언이 이런 뜻이었을까...", money: -20_000, mental: -3 },
  { text: "우연히 찍힌 사진이 퍼져 팔로워가 조금 늘었다.", followers: 500 },
  { text: "괜히 뒤숭숭한 하루였다. 아무 일도 없었는데 마음이 무겁다.", mental: -4 },
  { text: "미뤄 둔 택배가 도착했다. 소소한 기쁨.", mental: 3 },
  { text: "엘리베이터가 멈췄다는 소식을 들었다. 예언 때문에 계단으로 갔던 게 다행이었나.", mental: 4 },
  { text: "빨간 옷 입은 사람이 부딪히고 사과도 없이 갔다. 어깨가 얼얼하다.", stamina: -6 },
  { text: "잃어버린 줄 알았던 물건이 서랍에서 나왔다. 예언대로 돌아왔다.", mental: 4 },
  { text: "이유 없이 계정 알림이 울렸다. 열어보니 별거 아니었다. 하루 종일 찜찜했다.", mental: -3 },
];

/** 예언 계정 트윗에 좋아요를 누르면 다음 날 실현을 예약한다(이미 예약돼 있으면 무시). */
export function maybeQueueProphecy(state: GameState, tweet: Tweet): void {
  if (tweet.authorHandle !== OMEN_HANDLE) return;
  if (state.pendingProphecy || state.pendingProphecyText) return;
  state.pendingProphecy = true;
}

/** onNewDay 말미 — 예약된 예언이 있으면 하나를 골라 실현한다(결과 문구는 app이 토스트한다). */
export function resolveProphecy(state: GameState): void {
  if (!state.pendingProphecy) return;
  state.pendingProphecy = false;
  const o = pick(PROPHECY_OUTCOMES);
  if (o.money) state.money += o.money;
  if (o.followers) changeFollowers(state, o.followers);
  if (o.mental) state.resources.mental = clampMental(state, state.resources.mental + o.mental);
  if (o.stamina) gainStamina(state, o.stamina);
  state.pendingProphecyText = `🔮 예언이 실현됐다 — ${o.text}`;
}
