import type { GameContext } from "@/ui/context";
import type { AdultKind, AttributeId, EventTweetDraft, TweetKind, TweetMedia } from "@/core/types";
import { mediaSetFor } from "@/data/mediaTweets";
import { canWriteScam, getActiveAccount, isMentalLow, isSuspended } from "@/core/state";
import { ATTRIBUTES, getAffinity } from "@/data/attributes";
import { isTrending } from "@/data/trends";
import { maxPostSlots } from "@/systems/followers";
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
import { canPostTweet, postScamTweet, postTweet, TWEET_ACTION_COST } from "@/systems/tweetSystem";
import { availableAdultKinds } from "@/systems/yabam";
import { hasDrawingTool } from "@/systems/shop";
import { maybeSpawnAuthorDM } from "@/systems/author";
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
import { postEventTweetDraft, removeEventTweetDraft } from "@/systems/eventTweets";
import { pick } from "@/utils/random";
import { el, mount } from "@/utils/dom";
import { icon, ATTR_ICON } from "@/ui/icons";

/** 창작 모드 — 꺼짐 / 1차창작 / 2차창작 */
type CreationMode = "off" | "original" | "fan";

/** 마법사 단계 — 1: 무엇을 쓸까(카테고리), 2: 어떤 성격으로 쓸까(성격/종류) */
type Step = 1 | 2;

/**
 * 일반 트윗 성격 카드의 표시용 메타(라벨 + 질적 효과 힌트).
 * 힌트는 수치 노출 금지 — 방향성만. 실제 효과 수치는 systems(TWEET_KIND_EFFECTS)가 소유.
 */
const KIND_META: Record<TweetKind, { label: string; hint: string; warn?: boolean }> = {
  plain: { label: "무난", hint: "안정적" },
  provoke: { label: "자극", hint: "🔥 대박 가능 · 논란 위험", warn: true },
  info: { label: "정보", hint: "평판↑ · 꾸준" },
  emotional: { label: "감성", hint: "유입↑" },
};

/** "일상계" → "일상" 처럼 카테고리 라벨의 '계' 접미사를 뗀다. */
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

  // 기사 트윗 모드에선 우울 모드 무시(뉴스에 반응하는 트윗)
  const gloomy = !articleTitle && isMentalLow(s.resources.mental);

  // 인기 카테고리 등에서 넘어온 preselect가 해금돼 있으면(또는 데려온 반려동물이면) 그 카테고리로 시작
  const ownsPet = (a: AttributeId): boolean =>
    (a === "dog" && s.pets.dog) || (a === "cat" && s.pets.cat);
  const hasPreselect =
    !!preselect && (account.unlockedAttributes.includes(preselect) || ownsPet(preselect));
  // 우울·기사 모드는 카테고리를 고르지 않는다(항상 '일상'으로 게시).
  // 그 외에는 1단계에서 직접 고를 때까지 미선택(null) 상태.
  let selectedAttr: AttributeId | null =
    gloomy || articleTitle ? "daily" : hasPreselect ? (preselect as AttributeId) : null;
  let tone: TweetTone = "positive";
  let adultKind: AdultKind = "sekt";
  // 도덕성이 매우 낮으면 '사기' 모드 선택 가능
  const canScam = !gloomy && !articleTitle && canWriteScam(s.resources.morality);
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
    selectedAttr === "anime" && canCreate && !gloomy && !articleTitle && !scamMode && creation !== "off";

  // 뷰티 신상품 홍보: 이달의 신상 화장품 중 '보유한' 것만 홍보 대상.
  const ownedNewCosmetics = monthlyNewCosmetics(monthKey(s.day)).filter((c) =>
    s.ownedItems.includes(c.id),
  );
  let cosmeticId: string | null = null;
  /** 지금 뷰티 신상품 홍보 트윗을 쓰는 중인지 */
  const isPromo = (): boolean =>
    selectedAttr === "beauty" && !gloomy && !articleTitle && !scamMode && cosmeticId != null;

  // 우울·기사 모드는 고를 카테고리가 없으므로 2단계에서 시작한다.
  const skipStep1 = gloomy || !!articleTitle;
  let step: Step = skipStep1 ? 2 : 1;

  const container = el("div", { class: "modal" });

  /** 성인 카테고리 선택 = 성인 트윗 */
  const isAdultTweet = () => selectedAttr === "adult";

  /**
   * 일반 트윗(성격 4카드 picker를 쓰는 경로): 특수 모드가 하나도 아닌 보통 계열 트윗.
   * 우울·기사·사기·성인·창작·홍보는 각자 기존 흐름을 쓰므로 제외한다.
   */
  const isGeneralTweet = (): boolean =>
    !gloomy && !articleTitle && !scamMode && !isAdultTweet() && !isCreating() && !isPromo();

  /** 기사 트윗 모드: 톤에 맞는 반응 + 기사 헤드라인 */
  function articlePool(): string[] {
    const reactions =
      tone === "negative"
        ? ["이건 좀 심각한데...", "요즘 세상 참 흉흉하다", "남 일 같지 않네", "한숨만 나온다"]
        : ["이런 소식 반갑네 👏", "오 이건 좀 흥미로운데?", "다들 이거 봤어?", "생각할 거리가 많은 기사다"];
    return reactions.map((r) => `${r}\n📰 ${articleTitle}`);
  }

  /** 현재 선택(속성·톤/종류)에 맞는 문구 풀 */
  function currentPool(): string[] {
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
        return el(
          "button",
          {
            class: "compose-kind-card" + (selectedKind === kind ? " compose-kind-card--active" : ""),
            onclick: () => {
              selectedKind = kind;
              paint();
            },
          },
          // 롱트윗이면 문구가 길다 → CSS로 3줄 클램프(...말줄임). short는 그대로 보임.
          el("div", { class: "compose-kind-card__text" }, cand?.text ?? ""),
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

  // ── 1단계: 어떤 글을 쓸까? (카테고리) ────────────────────
  function renderStep1(): HTMLElement {
    const attrChips = el(
      "div",
      { class: "chip-row chip-row--center" },
      ...categories.map((id) =>
        el(
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
        ),
      ),
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
    const hasAction = s.resources.action >= TWEET_ACTION_COST;
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

    return el(
      "div",
      { class: "modal__body compose-step" },
      stepTitle("어떤 글을 쓸까?"),
      attrChips,
      !hasAction
        ? el("div", { class: "compose-hint" }, `행동력이 부족해 트윗할 수 없어요 (게시에 ${TWEET_ACTION_COST} 필요).`)
        : chosen
          ? null
          : el("div", { class: "compose-hint" }, "카테고리를 골라야 다음으로 넘어갈 수 있어요."),
      el("div", { class: "compose-actions" }, cancelBtn(), nextBtn),
    );
  }

  // ── 2단계: 어떤 분위기로 쓸까? (톤/종류/창작/홍보) ────────
  function renderStep2(): HTMLElement {
    // 기사 트윗 헤드라인 안내
    const articleNote = articleTitle
      ? el("div", { class: "article-note" }, `📰 ${articleTitle}`)
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
      selectedAttr === "anime" && canCreate && !gloomy && !articleTitle && !scamMode;
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
            `2차창작 작품 · 이달의 인기작 ⭐《${popular.title}》 맞히면 팔로워 대폭 상승`,
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
      selectedAttr === "beauty" && !gloomy && !articleTitle && !scamMode;
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
      : articleTitle
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
          // 일반 트윗은 선택된 성격 카드의 문구를, 특수 모드는 기존 풀에서 뽑는다.
          const finalText =
            general && selectedKind
              ? kindCandidates?.[selectedKind]?.text ?? pickFreshText(currentPool())
              : pickFreshText(currentPool());
          if (scamMode) {
            let earned = 0;
            ctx.update((st) => {
              earned = postScamTweet(st, finalText).earned;
            });
            ctx.toast(`사기 트윗 등록... +${earned.toLocaleString("ko-KR")}원`);
          } else {
            const finalAttr: AttributeId = gloomy || articleTitle ? "daily" : selectedAttr ?? "daily";
            const finalAdult = !gloomy && !articleTitle && isAdultTweet();
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
            // 일반 트윗만 성격 전달, 나머지는 opts 생략 → plain(중립)으로 기존 동작 유지
            const opts = general && selectedKind ? { kind: selectedKind } : {};
            let delta = 0;
            let unlockedMeeting = false;
            ctx.update((st) => {
              const res = postTweet(st, finalAttr, finalText, finalAdult, adultKind, mult, opts);
              delta = res.followerDelta;
              unlockedMeeting = res.unlockedMeeting;
              // 창작 트윗 누적 → 20개 이상이면 작가 계약 제안 DM이 올 수 있다
              if (creating) {
                st.creationTweetCount += 1;
                maybeSpawnAuthorDM(st);
              }
            });
            ctx.toast(
              delta >= 0 ? `트윗 등록! +${delta} 팔로워` : `트윗 등록... ${delta} 팔로워`,
            );
            if (unlockedMeeting) ctx.toast("🔓 성인 콘텐츠가 풀렸다 — 새로운 만남의 문이 열렸다.");
          }
          // 트윗은 슬롯을 넘기지 않는다 — 닫고 이벤트 판정만.
          ctx.closeModal();
          ctx.afterAction("tweet");
        },
      },
      postLabel,
    );

    // "오늘 게시 X/Y" 인디케이터 — 상한은 활성 계정 팔로워로 계산(순수 읽기)
    const slotMax = maxPostSlots(account.followers);
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

  // ── 이벤트 트윗 초안 리스트 (모달 상시 하단 푸터) ──────────
  // 이벤트로 저장한 트윗 소재를 최신순으로 나열하고 골라서 게시/삭제한다.
  // draftsWrap은 재사용 컨테이너 — 단계 전환·게시/삭제 후 repaintDrafts로 fresh state를 다시 그린다.
  const draftsWrap = el("div", { class: "event-drafts" });

  /** 초안 한 줄: 소스 + 미리보기 + 계열/성인 표식 + [게시]/[삭제]. */
  function renderDraftRow(d: EventTweetDraft, slotOk: boolean): HTMLElement {
    return el(
      "div",
      { class: "event-draft" + (d.isAdult ? " event-draft--adult" : "") },
      el(
        "div",
        { class: "event-draft__main" },
        el(
          "div",
          { class: "event-draft__meta" },
          el("span", { class: "event-draft__source" }, d.source),
          el(
            "span",
            { class: "event-draft__tag" },
            d.isAdult ? "🔞 성인" : categoryLabel(d.attr),
          ),
        ),
        el("div", { class: "event-draft__text" }, d.text),
      ),
      el(
        "div",
        { class: "event-draft__actions" },
        el(
          "button",
          {
            class: "btn btn--ghost event-draft__btn",
            disabled: !slotOk,
            onclick: () => {
              let delta: number | null = null;
              ctx.update((st) => {
                const res = postEventTweetDraft(st, d.id);
                delta = res ? res.followerDelta : null;
              });
              if (delta === null) {
                ctx.toast("오늘 게시 한도를 다 써서 지금은 올릴 수 없어요.");
              } else {
                ctx.toast(
                  delta >= 0 ? `트윗 게시! +${delta} 팔로워` : `트윗 게시... ${delta} 팔로워`,
                );
                ctx.afterAction("tweet");
              }
              // paint()로 전체 재구성 — 게시로 슬롯이 소진되면 step2 [등록] 게이트·게시 카운터도
              // fresh state로 다시 읽어야 한다(하단 리스트만 갱신하면 step2가 stale해져 한도 우회).
              paint();
            },
          },
          "게시",
        ),
        el(
          "button",
          {
            class: "btn btn--ghost event-draft__btn",
            onclick: () => {
              ctx.update((st) => removeEventTweetDraft(st, d.id));
              repaintDrafts();
            },
          },
          "삭제",
        ),
      ),
    );
  }

  /** 초안 리스트를 fresh state로 다시 그린다. 없으면 섹션을 비운다(숨김). */
  function repaintDrafts(): void {
    const drafts = ctx.store.getState().eventTweetDrafts;
    if (drafts.length === 0) {
      mount(draftsWrap);
      return;
    }
    const slotOk = canPostBySlot(ctx.store.getState());
    mount(
      draftsWrap,
      el("div", { class: "event-drafts__title" }, `이벤트 트윗 소재 (${drafts.length})`),
      !slotOk
        ? el("div", { class: "compose-hint" }, "오늘 게시 한도 소진 — 내일 다시 올릴 수 있어요.")
        : null,
      // push 순서 = 오래된→최신 이므로 뒤에서 앞으로(최신순) 나열.
      ...[...drafts].reverse().map((d) => renderDraftRow(d, slotOk)),
    );
  }

  const head = el(
    "div",
    { class: "modal__head" },
    gloomy ? "새 트윗 (우울 모드)" : articleTitle ? "기사 트윗" : "새 트윗",
    el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
  );

  function paint() {
    container.replaceChildren(head, step === 1 ? renderStep1() : renderStep2(), draftsWrap);
    repaintDrafts();
  }

  paint();
  return container;
}
