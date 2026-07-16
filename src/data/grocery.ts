/**
 * 마켓걸리버 — 식재료 배달. 장바구니에 담은 재료 '조합'으로 요리가 결정된다.
 * 레시피에 없는 조합이면 "오늘 요리는 망했다!".
 */

export interface Ingredient {
  id: string;
  name: string;
  emoji: string;
  price: number;
}

export const INGREDIENTS: Ingredient[] = [
  { id: "noodle", name: "면", emoji: "🍜", price: 2_000 },
  { id: "egg", name: "계란", emoji: "🥚", price: 1_500 },
  { id: "greenonion", name: "파", emoji: "🌿", price: 1_000 },
  { id: "pork", name: "돼지고기", emoji: "🥓", price: 6_000 },
  { id: "beef", name: "소고기", emoji: "🥩", price: 9_000 },
  { id: "kimchi", name: "김치", emoji: "🥬", price: 4_000 },
  { id: "tofu", name: "두부", emoji: "🍥", price: 2_000 },
  { id: "rice", name: "밥", emoji: "🍚", price: 1_500 },
  { id: "seaweed", name: "김", emoji: "🍙", price: 2_000 },
  { id: "flour", name: "밀가루", emoji: "🌾", price: 2_500 },
  { id: "cheese", name: "치즈", emoji: "🧀", price: 3_500 },
  { id: "milk", name: "우유", emoji: "🥛", price: 2_500 },
  { id: "tomato", name: "토마토", emoji: "🍅", price: 3_000 },
  { id: "onion", name: "양파", emoji: "🧅", price: 1_500 },
  { id: "potato", name: "감자", emoji: "🥔", price: 2_000 },
  { id: "carrot", name: "당근", emoji: "🥕", price: 1_500 },
];

const ING_BY_ID = new Map(INGREDIENTS.map((i) => [i.id, i]));
export function ingredientById(id: string): Ingredient | undefined {
  return ING_BY_ID.get(id);
}

export interface Recipe {
  id: string;
  name: string;
  emoji: string;
  /** 필요한 재료(순서 무관, 이 '집합'과 정확히 일치해야 완성) */
  ingredients: string[];
  /** 완성 후 올릴 수 있는 요리 트윗 문구 */
  tweetLines: string[];
}

export const RECIPES: Recipe[] = [
  {
    id: "ramen",
    name: "라면",
    emoji: "🍜",
    ingredients: ["noodle", "egg", "greenonion"],
    tweetLines: [
      "라면에 계란 파 팍팍 넣어 끓였더니 이 조합은 역시 진리다 후루룩 순삭 🍜",
      "오늘 저녁은 계란 파 라면 완벽하게 끓였다 국물까지 싹 비움",
    ],
  },
  {
    id: "egg_roll",
    name: "계란말이",
    emoji: "🍳",
    ingredients: ["egg", "greenonion"],
    tweetLines: [
      "계란말이 예쁘게 말렸다 파 송송 넣으니 색감도 살고 밥도둑 완성 🍳",
      "폭신폭신 계란말이 성공 반찬 하나로 한 끼 뚝딱",
    ],
  },
  {
    id: "kimchi_stew",
    name: "김치찌개",
    emoji: "🍲",
    ingredients: ["kimchi", "pork", "tofu"],
    tweetLines: [
      "돼지고기 김치찌개 두부까지 넣어 팔팔 끓였더니 이 국물 미쳤다 🍲",
      "묵은지에 돼지고기 두부 넣고 끓인 김치찌개 밥 두 공기 순삭",
    ],
  },
  {
    id: "kimchi_fried_rice",
    name: "김치볶음밥",
    emoji: "🍚",
    ingredients: ["kimchi", "rice", "egg"],
    tweetLines: [
      "김치볶음밥에 계란후라이 딱 올리니 이게 국룰이지 완벽한 한 끼 🍚",
      "냉장고 김치로 볶음밥 뚝딱 계란 얹으니 비주얼까지 완성",
    ],
  },
  {
    id: "gimbap",
    name: "김밥",
    emoji: "🍙",
    ingredients: ["rice", "seaweed", "egg", "carrot"],
    tweetLines: [
      "김밥 말기 성공 계란 당근 넣어 색깔까지 예쁘게 말았다 소풍 가고 싶다 🍙",
      "집에서 김밥 한 줄 말았는데 단면 예술이라 자랑 투척",
    ],
  },
  {
    id: "tomato_pasta",
    name: "토마토 파스타",
    emoji: "🍝",
    ingredients: ["noodle", "tomato", "onion"],
    tweetLines: [
      "토마토 파스타 직접 만들었는데 양파 볶은 향까지 살아서 집이 이탈리안 레스토랑 🍝",
      "생토마토로 소스부터 끓인 파스타 완성 이 맛에 요리하지",
    ],
  },
  {
    id: "potato_pancake",
    name: "감자전",
    emoji: "🥔",
    ingredients: ["potato", "flour"],
    tweetLines: [
      "비 오는 날엔 감자전이지 겉바속촉 제대로 부쳤다 🥔",
      "감자 갈아서 부친 감자전 막걸리 부르는 맛 완성",
    ],
  },
  {
    id: "beef_stirfry",
    name: "소고기볶음",
    emoji: "🥘",
    ingredients: ["beef", "onion", "greenonion"],
    tweetLines: [
      "소고기 양파 파 넣고 센 불에 볶았더니 불향까지 완벽 오늘 요리 대성공 🥘",
      "소고기볶음 간이 딱 맞게 됐다 밥 위에 올려 먹으니 천국",
    ],
  },
  {
    id: "cheese_omelet",
    name: "치즈 오믈렛",
    emoji: "🧀",
    ingredients: ["egg", "cheese", "milk"],
    tweetLines: [
      "우유 넣어 부드럽게 만든 치즈 오믈렛 반 가르니 치즈가 주르륵 🧀",
      "브런치 느낌 나는 치즈 오믈렛 성공 아침부터 호강한다",
    ],
  },
];

/** 재료 조합(중복 무시, 집합)으로 레시피를 찾는다. 없으면 null(요리 실패). */
export function matchRecipe(ingredientIds: string[]): Recipe | null {
  const set = [...new Set(ingredientIds)].sort().join(",");
  return RECIPES.find((r) => [...r.ingredients].sort().join(",") === set) ?? null;
}

/** 요리 실패(레시피 없는 조합) 트윗 문구 */
export function failTweetLines(): string[] {
  return [
    "오늘 요리는 완전히 망했다... 정체불명의 무언가가 탄생함 ㅋㅋ 그냥 시켜 먹을걸",
    "레시피도 없이 냉장고 털어 넣었더니 이게 음식이 맞나 싶은 대참사가 나왔다 하하",
    "요리 실패ㅠ 큰맘 먹고 도전했는데 결과물이 처참해서 오늘 저녁은 결국 배달이다",
  ];
}
