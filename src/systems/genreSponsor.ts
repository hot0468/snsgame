import type { AttributeId, Email, GameState } from "@/core/types";
import { pushEmail } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import {
  SPONSOR_BODY,
  SPONSOR_BRANDS,
  SPONSOR_CONTROVERSY_LINE,
  SPONSOR_DECLINE_LINES,
  SPONSOR_OK_LINES,
  SPONSOR_TIERS,
  type SponsorTierOffer,
} from "@/data/genreSponsor";
import { changeFollowers, masteryTier } from "./followers";
import { clampResource } from "./stats";
import { addSchedule } from "./time";
import { chance, pick, uid } from "@/utils/random";

/**
 * 갈래 협찬 — 한 갈래를 깊게 판 사람에게만 오는 제안.
 *
 * 갈래 숙련의 보상이 도달 배율(만렙 ×1.32) 하나뿐이라, 300개를 한 갈래에 몰아넣는
 * 지루함에 비해 이득이 너무 작았다. 배율을 더 올리는 대신 **여러 갈래에 흩뿌리면
 * 영영 못 받는 것**을 하나 만든다.
 *
 * ⚠️ **가장 깊게 판 갈래 하나만 본다.** 갈래마다 따로 굴리면 숙련 2를 여러 개 찍은
 *    균형형이 오히려 메일을 더 많이 받는다 — 특화 보상이라는 취지가 뒤집힌다.
 *
 * ⚠️ 한 번에 하나만 떠 있는다. 답 안 한 제안이 있으면 새로 안 보낸다.
 */

/** 하루에 제안이 올 확률(자격이 될 때). */
export const SPONSOR_MAIL_CHANCE = 0.06;

/** 지금 가장 깊게 판 갈래와 그 tier. 아무 갈래도 문턱을 못 넘으면 null. */
export function topMastery(state: GameState): { attr: AttributeId; tier: number } | null {
  let best: { attr: AttributeId; tier: number } | null = null;
  for (const id of Object.keys(ATTRIBUTES) as AttributeId[]) {
    const tier = masteryTier(state, id);
    if (tier <= 0) continue;
    if (!best || tier > best.tier) best = { attr: id, tier };
  }
  return best;
}

/** 그 tier에서 받을 수 있는 제안(없으면 null). 표는 minTier 내림차순이라 첫 매치가 최고 등급이다. */
export function sponsorOfferFor(tier: number): SponsorTierOffer | null {
  return SPONSOR_TIERS.find((t) => tier >= t.minTier) ?? null;
}

/** 답을 기다리는 협찬 제안이 있는지. */
export function hasPendingSponsor(state: GameState): boolean {
  return state.emails.some((e) => e.sponsorOffer && !e.sponsorOffer.responded);
}

/**
 * 하루에 한 번 굴린다(`time.onNewDay`).
 * @returns 제안을 보냈으면 true
 */
export function maybeSpawnSponsorOffer(state: GameState): boolean {
  if (state.gameOver) return false;
  if (hasPendingSponsor(state)) return false;
  const top = topMastery(state);
  if (!top) return false;
  const offer = sponsorOfferFor(top.tier);
  if (!offer) return false;
  if (!chance(SPONSOR_MAIL_CHANCE)) return false;

  const genre = ATTRIBUTES[top.attr]?.label ?? "그쪽";
  const brand = pick([...(SPONSOR_BRANDS[top.attr] ?? ["이름 없는 브랜드"])]);
  const body = SPONSOR_BODY.replaceAll("{brand}", brand)
    .replaceAll("{genre}", genre)
    .replaceAll("{label}", offer.label)
    .replaceAll("{money}", offer.money.toLocaleString("ko-KR"));

  const mail: Email = {
    id: uid("mail"),
    from: `${brand} 마케팅팀`,
    subject: `[협찬 제안] ${genre} ${offer.label} 문의드립니다`,
    body,
    day: state.day,
    read: false,
    sponsorOffer: {
      attr: top.attr,
      brand,
      label: offer.label,
      money: offer.money,
      followers: offer.followers,
      reputation: offer.reputation,
      controversyChance: offer.controversyChance,
      responded: false,
    },
  };
  pushEmail(state, mail);
  addSchedule(state, `${brand} 협찬 제안 도착`, "sns");
  return true;
}

/**
 * 협찬을 수락한다 — 계약금·팔로워를 받고 평판을 조금 내준다.
 *
 * ⚠️ 뒷광고 논란은 `rollControversy`(아무 논란이나)가 아니라 `ctrl_paid_promo`를 직접 지정한다
 *    (systems/events의 sponsorDeal과 같은 이유 — 협찬엔 뒷광고 논란이라야 말이 된다).
 * @returns 결과 문구(이미 답했거나 없는 메일이면 "")
 */
export function acceptSponsor(state: GameState, emailId: string): string {
  const mail = state.emails.find((e) => e.id === emailId);
  const offer = mail?.sponsorOffer;
  if (!offer || offer.responded) return "";
  offer.responded = true;

  state.money += offer.money;
  changeFollowers(state, offer.followers);
  state.resources.reputation = clampResource(state.resources.reputation + offer.reputation);
  addSchedule(state, `${offer.brand} 협찬 (+${offer.money.toLocaleString("ko-KR")}원)`, "sns");

  if (!state.pendingControversy && chance(offer.controversyChance)) {
    state.pendingControversy = "ctrl_paid_promo";
    return SPONSOR_CONTROVERSY_LINE;
  }
  return pick([...SPONSOR_OK_LINES]);
}

/** 협찬을 거절한다 — 아무것도 안 받는 대신 평판이 조금 오른다. */
export function declineSponsor(state: GameState, emailId: string): string {
  const mail = state.emails.find((e) => e.id === emailId);
  const offer = mail?.sponsorOffer;
  if (!offer || offer.responded) return "";
  offer.responded = true;
  state.resources.reputation = clampResource(state.resources.reputation + 1);
  addSchedule(state, `${offer.brand} 협찬 거절`, "sns");
  return pick([...SPONSOR_DECLINE_LINES]);
}
