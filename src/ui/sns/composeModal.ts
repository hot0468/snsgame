import type { GameContext } from "@/ui/context";
import type { AdultKind, AttributeId, GameState, TweetKind, TweetMedia } from "@/core/types";
import { SLOT_LABELS } from "@/core/state";
import { weekdayLabel } from "@/systems/time";
import { mediaSetFor } from "@/data/mediaTweets";
import { canWriteScam, getActiveAccount, isMentalLow, isSuspended } from "@/core/state";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { isTrending } from "@/data/trends";
import type { TrendTopic } from "@/data/trendTopics";
import { TREND_MULTIPLIER, rideTrend } from "@/systems/trends";
import { canWriteSoul, currentMaxPostSlots, SOUL_MENTAL_COST, timingMultiplier, timingTier } from "@/systems/followers";
import { canPostBySlot, remainingPostSlots } from "@/systems/eggs";
import {
  ADULT_KINDS,
  ADULT_TWEETS,
  GLOOMY_TWEETS,
  SCAM_TWEETS,
  TWEET_KINDS,
  kindTemplatesFor,
  templatesFor,
  type TweetTone,
} from "@/data/tweets";
import { canPostTweet, postScamTweet, postTweet, tweetActionCost } from "@/systems/tweetSystem";
import { availableAdultKinds } from "@/systems/yabam";
import { hasDrawingTool } from "@/systems/shop";
import { maybeSpawnAuthorDM } from "@/systems/author";
import { canPostTchinso } from "@/systems/tchin";
import { TCHINSO_COOLDOWN_DAYS } from "@/data/tchinso";
import { renderTchinsoModal } from "@/ui/tchinsoModal";
import { monthKey } from "@/systems/time";
import {
  ALL_WORKS,
  CREATION_MULTIPLIER,
  fanCreationLines,
  originalCreationLines,
  popularWork,
} from "@/data/works";
import {
  NEW_COSMETIC_MULTIPLIER,
  cosmeticTweetLines,
  monthlyNewCosmetics,
} from "@/data/cosmetics";
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { icon, ATTR_ICON } from "@/ui/icons";
import { showDdeoksang } from "@/ui/ddeoksang";
import { showTweetResult } from "@/ui/sns/tweetResultModal";
import { masteryGrade, masteryTierFor } from "@/data/tweetMastery";
import { COMBO_MAX_STEP } from "@/data/tweetFun";
import { comboControversy, comboMultiplier } from "@/systems/tweetSystem";

/** 창작 모드 — 꺼짐 / 1차창작 / 2차창작 */
type CreationMode = "off" | "original" | "fan";

/** 마법사 단계 — 1: 무엇을 쓸까(카테고리), 2: 어떤 성격으로 쓸까(성격/종류) */
type Step = 1 | 2;

/**
 * 일반 트윗 성격 카드의 표시용 메타(라벨 + 질적 효과 힌트).
 * 힌트는 수치 노출 금지 — 방향성만. 실제 효과 수치는 systems(TWEET_KIND_EFFECTS)가 소유.
 */
const KIND_META: Record<TweetKind, { label: string; hint: string; warn?: boolean }> = {
  // ⚠️ 힌트에 **대가**가 안 보이면 트레이드오프가 성립하지 않는다 —
  //    감성이 "유입↑"만 달고 있던 시절엔 무난·정보를 누를 이유가 화면에 없었다.
  plain: { label: "무난", hint: "안정적 · 소모 없음" },
  provoke: { label: "자극", hint: "🔥 대박 가능 · 논란 위험 · 정신력↓", warn: true },
  info: { label: "정보", hint: "평판↑ · 지식↑ · 꾸준" },
  emotional: { label: "감성", hint: "유입↑ · 정신력↓", warn: true },
  soul: { label: "진심", hint: "🔥 도달 최고 · 정신력 크게 소모", warn: true },
};

/** "일상계" → "일상" 처럼 카테고리 라벨의 '계' 접미사를 뗀다. */
/**
 * 지금 게시하면 반응이 어떨지 알리는 타이밍 배지(슬롯×요일 도달 배율).
 * ⚠️ 배율 숫자를 그대로 보여주지 않는다 — 게임이 계산기가 되지 않게 등급 문구만 쓴다.
 */
function timingBadge(s: GameState): HTMLElement {
  const mul = timingMultiplier(s.day, s.slot);
  const tier = timingTier(mul);
  return el(
    "div",
    { class: `compose-timing compose-timing--${tier.kind}` },
    el("span", {}, tier.label),
    el("span", { class: "compose-timing__when" }, `${weekdayLabel(s.day)}요일 ${SLOT_LABELS[s.slot] ?? ""}`),
  );
}

function categoryLabel(id: AttributeId): string {
  return ATTRIBUTES[id].label.replace(/계$/, "");
}

/**
 * 새 트윗 작성 모달 — 2단계 마법사.
 * - 1단계 "어떤 글을 쓸까?" — 카테고리(속성) 선택. [취소 / 다음]
 * - 2단계 "어떤 분위기로 쓸까?" — 톤(긍정/부정)·성인 종류·창작·홍보 선택. [이전 / 등록]
 *   (우울·기사 모드는 1단계를 건너뛰므로 '이전' 대신 [취소 / 등록])
 * - 유저는 직접 글을 쓰지 않는다. 고른 조건에 맞는 문구가 등록 시 랜덤으로 뽑힌다.
 * - 카테고리 선택지가 없는 모드(우울·기사)는 1단계를 건너뛰고 2단계로 시작한다.
 */
export function renderComposeModal(
  ctx: GameContext,
  preselect?: AttributeId,
  articleTitle?: string,
  trend?: TrendTopic,
): HTMLElement {
  const s = ctx.store.getState();
  const account = getActiveAccount(s);

  // 계정 정지 중이면 게시 불가
  if (isSuspended(account, s.day)) {
    const left = account.suspendedUntilDay - s.day;
    return el(
      "div",
      { class: "modal" },
      el(
        "div",
        { class: "modal__head" },
        "계정 정지 중",
        el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
      ),
      el(
        "div",
        { class: "modal__body" },
        el(
          "p",
          { style: "font-size:15px;line-height:1.6;margin:0" },
          `규정 위반으로 계정이 정지되었습니다. 정지가 풀릴 때까지 게시할 수 없어요. (해제까지 ${left}일)`,
        ),
      ),
    );
  }

  // 기사·실검 트윗 모드에선 우울 모드 무시(뉴스/트렌드에 반응하는 트윗)
  const gloomy = !articleTitle && !trend && isMentalLow(s.resources.mental);

  // 인기 카테고리 등에서 넘어온 preselect가 해금돼 있으면(또는 데려온 반려동물이면) 그 카테고리로 시작
  const ownsPet = (a: AttributeId): boolean =>
    (a === "dog" && s.pets.dog) || (a === "cat" && s.pets.cat);
  const hasPreselect =
    !!preselect && (account.unlockedAttributes.includes(preselect) || ownsPet(preselect));
  // 우울·기사 모드는 카테고리를 고르지 않는다(항상 '일상'으로 게시).
  // 실검 모드는 그 트렌드의 카테고리로 고정(해금 여부와 무관 — 뉴스처럼 그 항목에 대해 쓴다).
  // 그 외에는 1단계에서 직접 고를 때까지 미선택(null) 상태.
  let selectedAttr: AttributeId | null =
    gloomy || articleTitle ? "daily" : trend ? trend.attr : hasPreselect ? (preselect as AttributeId) : null;
  let tone: TweetTone = "positive";
  let adultKind: AdultKind = "sekt";
  // 도덕성이 매우 낮으면 '사기' 모드 선택 가능
  const canScam = !gloomy && !articleTitle && !trend && canWriteScam(s.resources.morality);
  let scamMode = false;

  // 일반 트윗 성격 picker: 선택된 성격(미선택이면 등록 비활성) + 후보 문구 캐시.
  // 후보는 selectedAttr당 1번만 뽑아 캐시 → 카드 클릭(재렌더)에도 문구가 흔들리지 않게 한다.
  // 미디어 판별(mediaSetFor)도 이 시점에 함께 계산해 캐시 → 재렌더에 안정적.
  let selectedKind: TweetKind | null = null;
  type KindCandidate = { text: string; media?: TweetMedia };
  let kindCandidates: Record<TweetKind, KindCandidate> | null = null;
  let kindCandidatesAttr: AttributeId | null = null;

  // 강아지계/고양이계는 산책에서 해당 동물을 '데려와야'만 열린다('사람' 단위 보유).
  const petCats: AttributeId[] = [];
  if (s.pets.dog && !account.unlockedAttributes.includes("dog")) petCats.push("dog");
  if (s.pets.cat && !account.unlockedAttributes.includes("cat")) petCats.push("cat");

  // 선택 가능한 카테고리: 해금된 속성 + 데려온 반려동물 + (성인물 해제 시) 성인
  const baseCats = account.unlockedAttributes.filter((a) => a !== "adult");
  const categories: AttributeId[] = s.adultMode
    ? [...baseCats, ...petCats, "adult"]
    : [...baseCats, ...petCats];

  // 성인 트윗 종류: 해금된 것만 노출(sekt는 항상, meetup/punish/dom은 야밤 리뷰로 해금,
  // group은 groupUnlocked). ADULT_KINDS 순서를 유지하므로 sekt가 맨 앞에 온다.
  const unlockedKinds = availableAdultKinds(account);
  const adultKinds = ADULT_KINDS.filter((k) => unlockedKinds.includes(k.id));
  // 선택된 종류가 해금 목록에 없으면 sekt로 폴백(안전)
  if (!unlockedKinds.includes(adultKind)) adultKind = "sekt";

  // 창작(애니/만화): 창작 도구를 보유해야 열린다. 2차창작은 '봤던 작품'만 대상.
  const canCreate = hasDrawingTool(s);
  const seenWorks = ALL_WORKS.filter((w) => s.seenWorks.includes(w.id));
  const popular = popularWork(monthKey(s.day));
  let creation: CreationMode = "off";
  let fanWorkId: string | null = null;
  /** 지금 창작 트윗을 쓰는 중인지(애니 카테고리 + 도구 보유 + 창작 모드 선택) */
  const isCreating = (): boolean =>
    selectedAttr === "anime" && canCreate && !gloomy && !articleTitle && !trend && !scamMode && creation !== "off";

  // 뷰티 신상품 홍보: 이달의 신상 화장품 중 '보유한' 것만 홍보 대상.
  const ownedNewCosmetics = monthlyNewCosmetics(monthKey(s.day)).filter((c) =>
    s.ownedItems.includes(c.id),
  );
  let cosmeticId: string | null = null;
  /** 지금 뷰티 신상품 홍보 트윗을 쓰는 중인지 */
  const isPromo = (): boolean =>
    selectedAttr === "beauty" && !gloomy && !articleTitle && !trend && !scamMode && cosmeticId != null;

  // 우울·기사·실검 모드는 고를 카테고리가 없으므로(고정) 2단계에서 시작한다.
  const skipStep1 = gloomy || !!articleTitle || !!trend;
  let step: Step = skipStep1 ? 2 : 1;

  const container = el("div", { class: "modal compose-modal" });

  /** 성인 카테고리 선택 = 성인 트윗 */
  const isAdultTweet = () => selectedAttr === "adult";

  /**
   * 일반 트윗(성격 4카드 picker를 쓰는 경로): 특수 모드가 하나도 아닌 보통 계열 트윗.
   * 우울·기사·사기·성인·창작·홍보는 각자 기존 흐름을 쓰므로 제외한다.
   */
  const isGeneralTweet = (): boolean =>
    !gloomy && !articleTitle && !trend && !scamMode && !isAdultTweet() && !isCreating() && !isPromo();

  /** 기사 트윗 모드: 톤에 맞는 반응 + 기사 헤드라인 */
  function articlePool(): string[] {
    const reactions =
      tone === "negative"
        ? ["이건 좀 심각한데...", "요즘 세상 참 흉흉하다", "남 일 같지 않네", "한숨만 나온다"]
        : ["이런 소식 반갑네 👏", "오 이건 좀 흥미로운데?", "다들 이거 봤어?", "생각할 거리가 많은 기사다"];
    return reactions.map((r) => `${r}\n📰 ${articleTitle}`);
  }

  /** 실검 편승 모드: 톤에 맞는 반응 + 실검 키워드(기사 모드와 같은 구조 — 그 항목에 대해 쓴다) */
  function trendPool(): string[] {
    const kw = trend!.keyword;
    const reactions =
      tone === "negative"
        ? ["이거 실화냐...", "하 진짜 답답하다", "이건 좀 아니지 않냐", "다들 이거 어떻게 생각함?"]
        : ["이거 지금 실검 1위 실화? 🔥", "오 이거 완전 화제네 ㅋㅋ", "다들 이거 봤어??", "나만 이거 궁금한 거 아니지?"];
    return reactions.map((r) => `${r}\n🔥 ${kw}`);
  }

  /** 현재 선택(속성·톤/종류)에 맞는 문구 풀 */
  function currentPool(): string[] {
    if (trend) return trendPool();
    if (articleTitle) return articlePool();
    if (gloomy) return GLOOMY_TWEETS;
    if (scamMode) return SCAM_TWEETS;
    if (isAdultTweet()) return ADULT_TWEETS[adultKind];
    if (isCreating()) {
      if (creation === "original") return originalCreationLines();
      const w = seenWorks.find((x) => x.id === fanWorkId);
      return w ? fanCreationLines(w) : [];
    }
    if (isPromo()) {
      const c = ownedNewCosmetics.find((x) => x.id === cosmeticId);
      return c ? cosmeticTweetLines(c) : [];
    }
    return templatesFor(selectedAttr ?? "daily", tone, false);
  }

  /** 이미 올린 내 트윗과 겹치지 않는 문구를 뽑는다(풀이 소진되면 어쩔 수 없이 재사용). */
  function pickFreshText(pool: string[]): string {
    const used = new Set(
      account.timeline
        .filter((t) => t.authorHandle === account.handle && !t.isRetweet)
        .map((t) => t.text),
    );
    const fresh = pool.filter((t) => !used.has(t));
    return pick(fresh.length ? fresh : pool);
  }

  /**
   * 일반 트윗 4성격 후보를 뽑는다 — TWEET_KINDS 순서로 성격당 1줄씩.
   * 이미 올린 내 트윗(used)과, 이번 4장끼리(chosen)의 중복을 피한다(폴백 시 재사용 허용).
   */
  function buildKindCandidates(attr: AttributeId): Record<TweetKind, KindCandidate> {
    const used = new Set(
      account.timeline
        .filter((t) => t.authorHandle === account.handle && !t.isRetweet)
        .map((t) => t.text),
    );
    const chosen = new Set<string>();
    const out = {} as Record<TweetKind, KindCandidate>;
    for (const kind of TWEET_KINDS) {
      const pool = kindTemplatesFor(attr, kind); // 비면 kinds합집합→positive+negative 폴백(항상 채워짐)
      const fresh = pool.filter((t) => !used.has(t) && !chosen.has(t));
      const unchosen = pool.filter((t) => !chosen.has(t));
      const text = pick(fresh.length ? fresh : unchosen.length ? unchosen : pool);
      // 후보가 미디어 세트 문구면 게시 시 미디어가 자동 첨부된다(postTweet). 여기선 표시용으로만 판별.
      out[kind] = { text, media: mediaSetFor(text)?.media };
      chosen.add(text);
    }
    return out;
  }

  /** 성격별 후보 4카드(문구 + 라벨 + 질적 효과 힌트). 하나 선택하면 그 성격·문구로 등록. */
  function renderKindCards(): HTMLElement {
    return el(
      "div",
      { class: "compose-kind-cards" },
      ...TWEET_KINDS.map((kind) => {
        const meta = KIND_META[kind];
        const cand = kindCandidates?.[kind];
        const media = cand?.media;
        // 진심은 정신력을 크게 낸다 — 감당 못 하면 아예 잠근다.
        // 0까지 깎여 우울 모드(20 미만)에 갇히는 것보다 못 쓰게 막는 편이 낫다.
        const locked = kind === "soul" && !canWriteSoul(s);
        return el(
          "button",
          {
            class:
              "compose-kind-card" +
              (kind === "soul" ? " compose-kind-card--soul" : "") +
              (selectedKind === kind ? " compose-kind-card--active" : "") +
              (locked ? " compose-kind-card--locked" : ""),
            disabled: locked,
            onclick: () => {
              if (locked) return;
              selectedKind = kind;
              paint();
            },
          },
          // 롱트윗이면 문구가 길다 → CSS로 3줄 클램프(...말줄임). short는 그대로 보임.
          el(
            "div",
            { class: "compose-kind-card__text" },
            locked ? `지금은 이런 글을 쓸 기운이 없다 (정신력 ${SOUL_MENTAL_COST} 필요)` : (cand?.text ?? ""),
          ),
          // 미디어 후보면 뱃지(📷/🎬) + 축약 프롬프트. 게시 시 media는 자동 첨부됨.
          media
            ? el(
                "div",
                { class: "compose-kind-card__media" },
                el(
                  "span",
                  { class: "compose-kind-card__badge" },
                  media.kind === "video" ? "🎬 영상" : "📷 사진",
                ),
                el("span", { class: "compose-kind-card__prompt" }, media.prompt),
              )
            : null,
          el(
            "div",
            { class: "compose-kind-card__meta" },
            el("span", { class: "compose-kind-card__label" }, meta.label),
            el(
              "span",
              { class: "compose-kind-card__hint" + (meta.warn ? " compose-signal__warn" : "") },
              meta.hint,
            ),
          ),
        );
      }),
    );
  }

  /** 창작 종류 칩(일반/1차창작/2차창작) */
  function creationChip(value: CreationMode, label: string): HTMLElement {
    return el(
      "button",
      {
        class: "chip" + (creation === value ? " chip--active" : ""),
        onclick: () => {
          if (creation === value) return;
          creation = value;
          paint();
        },
      },
      label,
    );
  }

  /** 톤 선택 칩(긍정/부정) */
  function toneChip(value: TweetTone, label: string): HTMLElement {
    return el(
      "button",
      {
        class: "chip" + (value === tone ? " chip--active" : ""),
        onclick: () => {
          if (tone === value) return;
          tone = value;
          paint();
        },
      },
      label,
    );
  }

  /** 단계 제목 */
  function stepTitle(text: string): HTMLElement {
    return el("h3", { class: "compose-step__title" }, text);
  }

  function cancelBtn(): HTMLElement {
    return el("button", { class: "btn btn--ghost", onclick: () => ctx.closeModal() }, "취소");
  }

  /**
   * 2단계에서 1단계(카테고리)로 돌아간다.
   * 우울·기사 모드(skipStep1)는 돌아갈 1단계가 없으므로 대신 취소를 쓴다.
   */
  function backBtn(): HTMLElement {
    return el(
      "button",
      {
        class: "btn btn--ghost",
        onclick: () => {
          step = 1;
          paint();
        },
      },
      "이전",
    );
  }

  /**
   * 카테고리 칩에 붙는 숙련 표시.
   *
   * 등급을 딴 갈래는 등급(B/A/S/SS)을, 아직 첫 문턱(10개) 전이면 **게시 누적**을 `Lv.n`으로 보여준다.
   * ⚠️ 등급만 띄우던 시절엔 10개를 넘기기 전까진 칩이 전부 맨몸이라, 플레이어가
   *    "갈래마다 숙련이 쌓인다"는 사실 자체를 알 방법이 없었다. 초반이야말로 보여줘야 하는 구간이다.
   *    한 번도 안 올린 갈래도 `Lv.0`을 단다 — 아직 안 판 갈래가 어디인지도 정보다.
   */
  function chipMastery(id: AttributeId): { text: string; earned: boolean } {
    const count = s.tweetMastery[id] ?? 0;
    const grade = masteryGrade(masteryTierFor(count));
    // 등급 전엔 숫자만 띄우면 그게 뭔지 알 수 없어 "Lv."을 붙인다.
    // (여기 숫자는 그 갈래 **게시 누적**이다. 10개를 넘기면 등급 B로 승급한다.)
    return grade ? { text: grade, earned: true } : { text: `Lv.${count}`, earned: false };
  }

  /**
   * 연타 콤보 표시 — **지금 몇 연타이고 다음 트윗이 뭘 받는지.**
   *
   * ⚠️ 이 장치는 도달 배수를 올리는 **동시에 논란 확률도 올린다**(같은 얘기만 반복하는 대가).
   *    보상과 리스크가 같이 걸린 선택인데 화면이 아무 말도 안 해서, 플레이어가 존재 자체를
   *    모른 채 굴러가고 있었다(systems/tweetSystem의 bumpTweetStreak — UI 참조가 0이었다).
   *
   * ⚠️ 갈래를 고르기 전엔 **현재 연타**를, 고른 뒤엔 **그 갈래를 골랐을 때의 결과**를 보여준다.
   *    다른 갈래를 고르면 콤보가 1로 끊긴다는 걸 고르는 순간 알아야 선택이 된다.
   */
  function comboBadge(state: GameState, picked: AttributeId | null): HTMLElement | null {
    const streak = state.tweetStreak;
    if (!streak || streak.count <= 0) return null;
    const label = ATTRIBUTES[streak.attr]?.label ?? "";

    // 이번에 그 갈래를 고르면 몇 연타가 되는가(안 골랐으면 현재 연타를 그대로 보여준다).
    const next = picked == null ? streak.count : picked === streak.attr ? streak.count + 1 : 1;
    const capped = Math.min(next, COMBO_MAX_STEP);
    const mul = comboMultiplier(next);
    const risk = comboControversy(next);
    const broken = picked != null && picked !== streak.attr;

    return el(
      "div",
      { class: "compose-hint", style: "margin:0 0 8px" },
      broken
        ? `🔥 ${label} ${streak.count}연타 → 다른 갈래를 고르면 콤보가 끊긴다 (배수 1.0배로 리셋)`
        : `🔥 ${label} ${capped}연타${next > COMBO_MAX_STEP ? "(상한)" : ""} · ` +
          `도달 ×${mul.toFixed(1)}` +
          (risk > 0 ? ` · 논란 위험 +${Math.round(risk * 100)}%` : "") +
          (picked == null ? " — 같은 갈래를 이어 쓰면 올라간다" : ""),
    );
  }

  // ── 1단계: 어떤 글을 쓸까? (카테고리) ────────────────────
  function renderStep1(): HTMLElement {
    const attrChips = el(
      "div",
      { class: "chip-row chip-row--center" },
      ...categories.map((id) => {
        // 숙련 배지 — 칩 목록이 곧 숙련 현황이 된다(별도 도감 화면을 만들지 않는 이유).
        const m = chipMastery(id);
        return el(
          "button",
          {
            class:
              "chip" +
              (!scamMode && id === selectedAttr ? " chip--active" : "") +
              (id === "adult" ? " chip--adult" : ""),
            onclick: () => {
              scamMode = false;
              selectedAttr = id;
              // 애니가 아니면 창작 모드 해제, 뷰티가 아니면 신상품 홍보 해제
              if (id !== "anime") creation = "off";
              if (id !== "beauty") cosmeticId = null;
              paint();
            },
          },
          icon(ATTR_ICON[id], { size: 14 }),
          categoryLabel(id),
          el("span", { class: "chip__grade" + (m.earned ? "" : " chip__grade--raw") }, m.text),
        );
      }),
      canScam
        ? el(
            "button",
            {
              class: "chip chip--scam" + (scamMode ? " chip--active" : ""),
              onclick: () => {
                scamMode = true;
                paint();
              },
            },
            "사기",
          )
        : null,
    );

    // 카테고리(또는 사기)를 고르기 전엔 다음으로 넘어갈 수 없다.
    // 행동력이 부족하면(게시 비용 미달) 아예 다음으로 못 넘어간다 — 트윗 게시가 불가하기 때문.
    const chosen = scamMode || selectedAttr !== null;
    const hasAction = s.resources.action >= tweetActionCost(s);
    const canNext = chosen && hasAction;
    const nextBtn = el(
      "button",
      {
        class: "btn",
        disabled: !canNext,
        onclick: () => {
          if (!canNext) return;
          step = 2;
          paint();
        },
      },
      "다음",
    );

    // 트친소(트친 소개) 진입 — 게시하기 팝업 안으로 옮겨왔다. 주 1회 쿨다운 + 일반 트윗과 동일한
    // 일일 슬롯/행동력 게이트(canPostTweet && canPostBySlot). 누르면 트친소 확인 모달로 전환된다.
    const tchinsoCooldownReady = canPostTchinso(s);
    const tchinsoReady = tchinsoCooldownReady && canPostTweet(s) && canPostBySlot(s);
    const tchinsoDaysLeft = Math.max(0, TCHINSO_COOLDOWN_DAYS - (s.day - account.lastTchinsoDay));
    const tchinsoHint = !tchinsoCooldownReady
      ? `${tchinsoDaysLeft}일 후 가능`
      : !canPostTweet(s)
        ? "행동력이 부족해요"
        : !canPostBySlot(s)
          ? "오늘 게시 슬롯을 다 썼어요"
          : null;
    const tchinsoEntry = el(
      "div",
      { class: "tchinso-entry", style: "margin-top:14px;border-top:1px solid var(--border);padding-top:12px" },
      el(
        "button",
        {
          class: "btn btn--ghost",
          disabled: !tchinsoReady,
          onclick: () => {
            if (tchinsoReady) ctx.openModal(renderTchinsoModal);
          },
        },
        "🤝 트친소 올리기",
      ),
      tchinsoHint ? el("span", { class: "tchinso-entry__hint" }, tchinsoHint) : null,
    );

    return el(
      "div",
      { class: "modal__body compose-step" },
      stepTitle("어떤 글을 쓸까?"),
      timingBadge(s),
      comboBadge(s, selectedAttr),
      attrChips,
      !hasAction
        ? el("div", { class: "compose-hint" }, `행동력이 부족해 트윗할 수 없어요 (게시에 ${tweetActionCost(s)} 필요).`)
        : chosen
          ? null
          : el("div", { class: "compose-hint" }, "카테고리를 골라야 다음으로 넘어갈 수 있어요."),
      el("div", { class: "compose-actions" }, cancelBtn(), nextBtn),
      tchinsoEntry,
    );
  }

  // ── 2단계: 어떤 분위기로 쓸까? (톤/종류/창작/홍보) ────────
  function renderStep2(): HTMLElement {
    // 기사 트윗 헤드라인 안내
    const articleNote = articleTitle
      ? el("div", { class: "article-note" }, `📰 ${articleTitle}`)
      : null;

    // 실검 편승 안내 — articleNote와 같은 자리·톤(재사용). 해금 카테고리가 아니면 preselect가
    // 안 먹어 selectedAttr가 다를 수 있으므로, 여기선 트렌드 존재만 안내(부스트 성사는 게시 시 판정).
    const trendNote = trend
      ? el(
          "div",
          { class: "article-note" },
          `🔥 실시간 검색어 '${trend.keyword}' 편승 중 — 이 주제로 올리면 팔로워 부스트!`,
        )
      : null;

    const gloomyNotice = gloomy
      ? el(
          "div",
          { class: "gloomy-notice" },
          "정신력이 바닥났어요. 지금은 우울한 트윗밖에 써지지 않습니다. 휴식으로 정신력을 회복하세요.",
        )
      : null;

    // 사기 모드는 분위기를 고르지 않는다
    const scamNotice = scamMode
      ? el(
          "div",
          { class: "compose-hint" },
          "사기 트윗은 분위기를 고를 수 없어요. 돈이 들어오지만 평판과 도덕성이 떨어져요.",
        )
      : null;

    // 창작 종류 선택(애니 + 창작 도구 보유 시): 일반 / 1차창작 / 2차창작
    const showCreation =
      selectedAttr === "anime" && canCreate && !gloomy && !articleTitle && !trend && !scamMode;
    const creationChips = showCreation
      ? el(
          "div",
          { class: "chip-row chip-row--center" },
          creationChip("off", "일반"),
          creationChip("original", "1차창작"),
          creationChip("fan", "2차창작"),
        )
      : null;

    // 2차창작이면 '봤던 작품' 선택 + 이달의 인기작 안내
    let fanSection: HTMLElement | null = null;
    if (showCreation && creation === "fan") {
      if (seenWorks.length === 0) {
        fanSection = el(
          "div",
          { class: "gloomy-notice" },
          "감상한 작품이 없어요. 너튜브에서 애니를 시청하거나 미디북스에서 만화를 감상하면 2차창작 대상이 생겨요.",
        );
      } else {
        fanSection = el(
          "div",
          {},
          el(
            "div",
            { class: "compose-label" },
            "2차창작 작품",
          ),
          el(
            "div",
            { class: "chip-row chip-row--center" },
            ...seenWorks.map((w) =>
              el(
                "button",
                {
                  class: "chip" + (fanWorkId === w.id ? " chip--active" : ""),
                  onclick: () => {
                    fanWorkId = w.id;
                    paint();
                  },
                },
                (w.id === popular.id ? "⭐ " : "") + w.title,
              ),
            ),
          ),
        );
      }
    }

    // 뷰티 신상품 홍보: 보유한 이달의 신상 화장품을 골라 홍보하면 팔로워 증가분↑
    const showCosmetic =
      selectedAttr === "beauty" && !gloomy && !articleTitle && !trend && !scamMode;
    let cosmeticSection: HTMLElement | null = null;
    if (showCosmetic && ownedNewCosmetics.length > 0) {
      cosmeticSection = el(
        "div",
        {},
        el(
          "div",
          { class: "compose-label" },
          "신상품 홍보 🆕 (이달의 신상 화장품 · 팔로워 대폭 상승)",
        ),
        el(
          "div",
          { class: "chip-row chip-row--center" },
          el(
            "button",
            {
              class: "chip" + (cosmeticId === null ? " chip--active" : ""),
              onclick: () => {
                cosmeticId = null;
                paint();
              },
            },
            "일반",
          ),
          ...ownedNewCosmetics.map((c) =>
            el(
              "button",
              {
                class: "chip" + (cosmeticId === c.id ? " chip--active" : ""),
                onclick: () => {
                  cosmeticId = c.id;
                  paint();
                },
              },
              "🆕 " + c.name,
            ),
          ),
        ),
      );
    } else if (showCosmetic) {
      cosmeticSection = el(
        "div",
        { class: "compose-hint", style: "margin:2px 0 0" },
        "쇼핑의 '이달의 신상 화장품'을 사서 홍보 트윗을 올리면 팔로워를 더 얻을 수 있어요.",
      );
    }

    // 종류/톤 선택:
    //  - 성인 카테고리 → 성인 '종류' 칩
    //  - 기사 모드 → 긍정/부정 톤(기사 반응이 톤 기반, 기존 유지)
    //  - 그 외 특수 모드(우울·사기·창작·홍보) → 없음
    //  - 일반 트윗 → 톤 대신 아래 성격 4카드(kindCards)로 대체
    const toneChips = isAdultTweet()
      ? el(
          "div",
          { class: "chip-row chip-row--center" },
          ...adultKinds.map((k) =>
            el(
              "button",
              {
                class: "chip" + (k.id === adultKind ? " chip--active" : ""),
                onclick: () => {
                  if (k.id === adultKind) return;
                  adultKind = k.id;
                  paint();
                },
              },
              k.label,
            ),
          ),
        )
      : articleTitle || trend
        ? el(
            "div",
            { class: "chip-row chip-row--center" },
            toneChip("positive", "긍정"),
            toneChip("negative", "부정"),
          )
        : null;

    // 일반 트윗이면 성격 4카드 picker. 후보 문구는 selectedAttr당 1회만 뽑아 캐시.
    let kindCards: HTMLElement | null = null;
    if (isGeneralTweet() && selectedAttr) {
      if (!kindCandidates || kindCandidatesAttr !== selectedAttr) {
        kindCandidates = buildKindCandidates(selectedAttr);
        kindCandidatesAttr = selectedAttr;
        selectedKind = null; // 계열이 바뀌면 선택 초기화
      }
      kindCards = renderKindCards();
    }

    // 2차창작인데 아직 작품을 안 골랐으면 게시 불가
    const needsFanWork = isCreating() && creation === "fan" && !fanWorkId;
    // 일반 트윗인데 성격 카드를 아직 안 골랐으면 게시 불가
    const needsKind = isGeneralTweet() && !selectedKind;
    // 슬롯 게이트: 행동력 부족을 우선 사유로, 그 다음 슬롯 소진
    const slotOk = canPostBySlot(s);
    const postLabel = !canPostTweet(s) ? "행동력 부족" : !slotOk ? "오늘 게시 슬롯 소진" : "등록";
    const postBtn = el(
      "button",
      {
        class: "btn",
        disabled: !canPostTweet(s) || needsFanWork || needsKind || !slotOk,
        onclick: () => {
          const general = isGeneralTweet();
          // 떡상 연출은 게시 결과 화면보다 **먼저** 뜬다(onNext로 결과 화면에 이어진다).
          // 게시 시 여기에 담고, 아래에서 담겨 있으면 오버레이부터 띄운다.
          let ddPayload:
            | { likes: number; retweets: number; gain: number; onNext: () => void }
            | null = null;
          // 일반 트윗은 선택된 성격 카드의 문구를, 특수 모드는 기존 풀에서 뽑는다.
          const finalText =
            general && selectedKind
              ? kindCandidates?.[selectedKind]?.text ?? pickFreshText(currentPool())
              : pickFreshText(currentPool());
          // 사기 트윗은 갈래 숙련이 없으므로 결과 화면을 타지 않는다 — 토스트로 끝낸다.
          if (scamMode) {
            let earned = 0;
            ctx.update((st) => {
              earned = postScamTweet(st, finalText).earned;
            });
            ctx.toast(`사기 트윗 등록... +${earned.toLocaleString("ko-KR")}원`);
            ctx.closeModal();
            ctx.afterAction("tweet");
            return;
          }
          {
            const finalAttr: AttributeId = gloomy || articleTitle ? "daily" : selectedAttr ?? "daily";
            const finalAdult = !gloomy && !articleTitle && !trend && isAdultTweet();
            // 창작 가중 / 뷰티 신상품 홍보 가중
            const creating = isCreating();
            let mult = 1;
            if (creating) {
              if (creation === "original") mult = CREATION_MULTIPLIER.original;
              else if (creation === "fan")
                mult = fanWorkId === popular.id
                  ? CREATION_MULTIPLIER.fanPopular
                  : CREATION_MULTIPLIER.fan;
            } else if (isPromo()) {
              mult = NEW_COSMETIC_MULTIPLIER;
            }
            // 실검 편승 가중 — 트렌드가 있고 게시 카테고리가 그 트렌드의 카테고리와 일치할 때만.
            // (해금 안 된 카테고리면 finalAttr가 daily로 떨어져 자동으로 편승이 안 붙는다.)
            const rode = !!trend && finalAttr === trend.attr;
            if (rode) mult *= TREND_MULTIPLIER;
            // 일반 트윗만 성격 전달. 창작(1차/2차)이면 creation을 넘겨 무조건 미디어 형태로 게시한다.
            const opts: import("@/systems/tweetSystem").PostTweetOptions = creating
              ? { creation: creation as "original" | "fan" }
              : general && selectedKind
                ? { kind: selectedKind }
                : {};
            let delta = 0;
            let unlockedMeeting = false;
            let statChanges: { label: string; delta: number }[] = [];
            let streak = 1;
            let masteryCount = 0;
            let masteryTierUp = 0;
            let likes = 0;
            let retweets = 0;
            ctx.update((st) => {
              const res = postTweet(st, finalAttr, finalText, finalAdult, adultKind, mult, opts);
              delta = res.followerDelta;
              unlockedMeeting = res.unlockedMeeting;
              statChanges = res.statChanges;
              streak = res.streak;
              masteryCount = res.masteryCount;
              masteryTierUp = res.masteryTierUp;
              likes = res.tweet.likes;
              retweets = res.tweet.retweets;
              if (res.ddeoksang) {
                ddPayload = {
                  likes: res.tweet.likes,
                  retweets: res.tweet.retweets,
                  gain: res.followerDelta + res.ddeoksangGain,
                  // 오버레이가 닫히면 결과 화면으로 잇는다. 호출 시점엔 아래 지역변수가 다 채워져 있다.
                  onNext: () => openResult(),
                };
              }
              // 창작 트윗 누적 → 20개 이상이면 작가 계약 제안 DM이 올 수 있다
              if (creating) {
                st.creationTweetCount += 1;
                maybeSpawnAuthorDM(st);
              }
              // 편승 성사 시 트렌드를 '오늘 편승함'으로 기록(부스트 1회/일 보장 — rideTrend가 중복 push 방지).
              if (rode) rideTrend(st, trend!.id);
            });
            if (unlockedMeeting) ctx.toast("🔓 성인 콘텐츠가 풀렸다 — 새로운 만남의 문이 열렸다.");
            // 게시 결과 화면 — 토스트 대신 성과와 숙련 게이지를 보여준다.
            // ⚠️ afterAction은 여기서 부르지 않는다. 결과 모달의 [닫기]가 부른다.
            const openResult = (): void =>
              showTweetResult(
                ctx,
                {
                  attr: finalAttr,
                  likes,
                  retweets,
                  followerDelta: delta,
                  masteryCount,
                  masteryTierUp,
                  streak,
                  statChanges,
                  rodeTrend: rode,
                },
                // [한 번 더] — 작성 모달을 새로 연다(1단계부터). 연타 콤보와 맞물린다.
                () => ctx.openModal((c) => renderComposeModal(c)),
              );
            // 떡상이면 오버레이가 먼저(닫히면 payload의 onNext가 결과 화면을 연다), 아니면 곧장 결과 화면.
            if (ddPayload) showDdeoksang(ctx, ddPayload);
            else openResult();
          }
        },
      },
      postLabel,
    );

    // "오늘 게시 X/Y" 인디케이터 — 상한은 활성 계정 팔로워로 계산(순수 읽기)
    // 게시 슬롯은 전 계정 공유 예산 — 상한은 팔로워 합계 기준.
    const slotMax = currentMaxPostSlots(s);
    const slotUsed = slotMax - remainingPostSlots(s);
    const slotIndicator = el("div", { class: "compose-slots" }, `오늘 게시 ${slotUsed}/${slotMax}`);

    // 슬롯 소진 안내(내일 회복)
    const slotHint = !slotOk
      ? el(
          "div",
          { class: "compose-hint" },
          "오늘 게시 슬롯을 다 썼어요. 팔로워를 더 모으면 하루 게시 수가 늘어나요.",
        )
      : null;

    // 작성 미리보기 신호 — 선택 카테고리의 예상 반응(질적 신호만, 수치 노출 금지).
    // 우울·기사·사기 모드는 카테고리 고정/없음이라 생략.
    let signalEl: HTMLElement | null = null;
    if (!gloomy && !articleTitle && !scamMode && selectedAttr !== null) {
      const attr = selectedAttr;
      const items: HTMLElement[] = [];
      if (isTrending(s.day, attr)) {
        items.push(el("div", { class: "compose-signal__item" }, "🔥 오늘 인기 계열! 반응이 커요"));
      }
      const aff = getAffinity(account.attribute, attr);
      if (aff < 0) {
        items.push(
          el(
            "div",
            { class: "compose-signal__item compose-signal__warn" },
            "⚠️ 내 계정 성향과 안 맞아요 (언팔 위험)",
          ),
        );
      } else if (aff > 0) {
        items.push(el("div", { class: "compose-signal__item" }, "👍 내 계정과 찰떡"));
      } else {
        items.push(el("div", { class: "compose-signal__item" }, "예상 반응: 보통"));
      }
      signalEl = el("div", { class: "compose-signal" }, ...items);
    }

    return el(
      "div",
      { class: "modal__body compose-step" },
      slotIndicator,
      gloomyNotice,
      articleNote,
      trendNote,
      // 고를 게 하나도 없는 모드(우울)에선 분위기 질문을 띄우지 않는다
      gloomy ? null : stepTitle("어떤 분위기로 쓸까?"),
      scamNotice,
      signalEl,
      creationChips ? el("div", { class: "compose-label" }, "창작") : null,
      creationChips,
      fanSection,
      cosmeticSection,
      toneChips,
      kindCards,
      slotHint,
      el("div", { class: "compose-actions" }, skipStep1 ? cancelBtn() : backBtn(), postBtn),
    );
  }

  const head = el(
    "div",
    { class: "modal__head" },
    gloomy ? "새 트윗 (우울 모드)" : articleTitle ? "기사 트윗" : trend ? "실검 트윗" : "새 트윗",
    el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
  );

  function paint() {
    container.replaceChildren(head, step === 1 ? renderStep1() : renderStep2());
  }

  paint();
  return container;
}
