import type { GameState } from "@/core/types";
import { GACHA_ITEMS } from "@/data/gacha";
import { pick, randInt } from "@/utils/random";
import { changeFollowers } from "./followers";
import { clampMental } from "./stats";
import { ownedCount } from "./shop";

/**
 * 포토카드/굿즈 가챠(뽑기).
 * 뽑기 비용을 내고 등급별 확률로 결과가 나온다.
 * 대부분 덕질 만족(정신력)이고, 레어 이상은 팔로워 유입/자랑 트윗 가능.
 * 꽝을 제외한 실물은 서랍장(ownedItems)에 들어간다 — 실물 카탈로그는 `data/gacha.ts`.
 */

export const GACHA_COST = 5_000;

export type GachaRarity = "empty" | "common" | "rare" | "sr" | "ssr";

interface RarityDef {
  rarity: GachaRarity;
  label: string;
  weight: number;
  mental: number;
  followers: [number, number];
  /** 자랑 트윗 가능 여부 */
  brag: boolean;
}

const TABLE: RarityDef[] = [
  { rarity: "empty", label: "꽝", weight: 33, mental: -3, followers: [0, 0], brag: false },
  { rarity: "common", label: "일반", weight: 37, mental: 3, followers: [0, 0], brag: false },
  { rarity: "rare", label: "레어", weight: 20, mental: 6, followers: [0, 2], brag: false },
  { rarity: "sr", label: "SR", weight: 8, mental: 9, followers: [2, 6], brag: true },
  { rarity: "ssr", label: "SSR", weight: 2, mental: 14, followers: [6, 16], brag: true },
];

export interface GachaResult {
  rarity: GachaRarity;
  label: string;
  /** 뽑힌 실물의 아이템 id — ui가 이걸로 사진과 프레임을 찾는다. */
  id: string;
  /**
   * 이번에 뽑은 게 그 굿즈의 **몇 번째 사본인지**(0부터). 포토카드에 여러 컷을 등록해 두면
   * 이 순번으로 컷이 갈린다 — 같은 카드를 또 뽑으면 다음 컷이 나온다(data/photoCardImages.ts).
   * 서랍장도 같은 순번으로 그리므로, 방금 본 컷이 서랍장에서도 그대로 보인다.
   */
  copy: number;
  name: string;
  mental: number;
  followers: number;
  brag: boolean;
  message: string;
}

export function canDrawGacha(state: GameState): boolean {
  return state.money >= GACHA_COST;
}

function rollRarity(): RarityDef {
  const total = TABLE.reduce((s, r) => s + r.weight, 0);
  let roll = Math.random() * total;
  for (const r of TABLE) {
    roll -= r.weight;
    if (roll <= 0) return r;
  }
  return TABLE[0];
}

/** 가챠 1회. 비용을 내고 등급별 결과를 적용한다. */
export function drawGacha(state: GameState): GachaResult | null {
  if (!canDrawGacha(state)) return null;
  state.money -= GACHA_COST;
  const def = rollRarity();
  const item = pick(GACHA_ITEMS[def.rarity]);
  const name = item.name;
  // 꽝을 제외한 실물은 서랍장(ownedItems)에 담긴다 — 리졸버 등록은 shop.ts ITEM_INDEX(GACHA_ALL_ITEMS).
  // 사본 순번은 **담기 전 보유 수**다(0부터). 꽝은 담기지 않으니 0으로 둔다.
  const copy = def.rarity === "empty" ? 0 : ownedCount(state, item.id);
  if (def.rarity !== "empty") state.ownedItems.push(item.id);
  state.resources.mental = clampMental(state, state.resources.mental + def.mental);
  const followers = randInt(def.followers[0], def.followers[1]);
  if (followers > 0) changeFollowers(state, followers);

  const msg =
    def.rarity === "empty"
      ? `이런... 「${name}」. 오늘은 꽝이다. (정신력 ${def.mental})`
      : def.rarity === "ssr"
        ? `대박!!! ✨ 「${name}」 SSR 등장!! 이건 자랑해야 한다!`
        : def.rarity === "sr"
          ? `오오 「${name}」 SR 획득! 최애 나왔다 심장 나감 💖`
          : `「${name}」 ${def.label} 획득!`;

  return { rarity: def.rarity, label: def.label, id: item.id, copy, name, mental: def.mental, followers, brag: def.brag, message: msg };
}

/** 자랑(SR·SSR) 트윗 문구 */
export function gachaBragLines(name: string): string[] {
  return [
    `가챠 돌렸는데 「${name}」 떴다 대박!!! 이 맛에 뽑지 오늘 운 다 씀`,
    `「${name}」 실물 영접... 손이 덜덜 떨린다 최애 뽑기 성공 자랑합니다`,
    `드디어 「${name}」 겟했다 그동안의 텅장이 아깝지 않아 ㅠㅠ`,
  ];
}
