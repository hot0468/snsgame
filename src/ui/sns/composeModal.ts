import type { GameContext } from "@/ui/context";
import type { AdultKind, AttributeId } from "@/core/types";
import { canWriteScam, getActiveAccount, isMentalLow, isSuspended } from "@/core/state";
import { ATTRIBUTES } from "@/data/attributes";
import {
  ADULT_KINDS,
  ADULT_TWEETS,
  GLOOMY_TWEETS,
  SCAM_TWEETS,
  templatesFor,
  type TweetTone,
} from "@/data/tweets";
import { canPostTweet, postScamTweet, postTweet } from "@/systems/tweetSystem";
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
import { pick } from "@/utils/random";
import { el } from "@/utils/dom";
import { icon, ATTR_ICON } from "@/ui/icons";
import { renderSleepModal } from "./sleepModal";

/** 창작 모드 — 꺼짐 / 1차창작 / 2차창작 */
type CreationMode = "off" | "original" | "fan";

/** "일상계" → "일상" 처럼 카테고리 라벨의 '계' 접미사를 뗀다. */
function categoryLabel(id: AttributeId): string {
  return ATTRIBUTES[id].label.replace(/계$/, "");
}

/**
 * 새 트윗 작성 모달.
 * - 유저는 직접 글을 쓰지 않는다. 카테고리(속성) + 긍정/부정 톤만 고르면
 *   등록 시 해당 조건에 맞는 문구가 랜덤으로 뽑혀 트윗된다.
 * - 계정의 성인물 해제가 켜져 있으면 야한 문구도 섞인다.
 * - 정신력이 바닥나면(우울 모드) 우울한 트윗만 랜덤으로 써진다.
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
  const initialAttr =
    preselect && (account.unlockedAttributes.includes(preselect) || ownsPet(preselect))
      ? preselect
      : account.unlockedAttributes[0] ?? "daily";
  let selectedAttr: AttributeId = gloomy ? "daily" : initialAttr;
  let tone: TweetTone = "positive";
  let adultKind: AdultKind = "sekt";
  // 도덕성이 매우 낮으면 '사기' 모드 선택 가능
  const canScam = !gloomy && !articleTitle && canWriteScam(s.resources.morality);
  let scamMode = false;

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

  const container = el("div", { class: "modal" });

  /** 성인 카테고리 선택 = 성인 트윗 */
  const isAdultTweet = () => selectedAttr === "adult";

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
    return templatesFor(selectedAttr, tone, false);
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

  function rerender() {
    // 기사 트윗 헤드라인 안내
    const articleNote = articleTitle
      ? el("div", { class: "article-note" }, `📰 ${articleTitle}`)
      : null;

    // 우울 모드·기사 모드에선 카테고리 선택을 감춘다
    const attrChips =
      gloomy || articleTitle
        ? null
        : el(
            "div",
            { class: "chip-row" },
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

    // 창작 종류 선택(애니 + 창작 도구 보유 시): 일반 / 1차창작 / 2차창작
    const showCreation =
      selectedAttr === "anime" && canCreate && !gloomy && !articleTitle && !scamMode;
    const creationChips = showCreation
      ? el(
          "div",
          { class: "chip-row" },
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
            { class: "chip-row" },
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
          { class: "chip-row" },
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

    // 성인 카테고리면 톤 대신 '종류' 선택, 아니면 긍정/부정 톤 (사기·창작·홍보 모드는 톤 선택 없음)
    const toneChips =
      gloomy || articleTitle || scamMode || isCreating() || isPromo()
        ? null
        : isAdultTweet()
          ? el(
              "div",
              { class: "chip-row" },
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
          : el(
              "div",
              { class: "chip-row" },
              toneChip("positive", "긍정"),
              toneChip("negative", "부정"),
            );

    const gloomyNotice = gloomy
      ? el(
          "div",
          { class: "gloomy-notice" },
          "정신력이 바닥났어요. 지금은 우울한 트윗밖에 써지지 않습니다. 휴식으로 정신력을 회복하세요.",
        )
      : null;

    // 2차창작인데 아직 작품을 안 골랐으면 게시 불가
    const needsFanWork = isCreating() && creation === "fan" && !fanWorkId;
    const postBtn = el(
      "button",
      {
        class: "btn",
        disabled: !canPostTweet(s) || needsFanWork,
        onclick: () => {
          const finalText = pickFreshText(currentPool());
          let needsSleepChoice = false;
          if (scamMode) {
            let earned = 0;
            ctx.update((st) => {
              const r = postScamTweet(st, finalText);
              earned = r.earned;
              needsSleepChoice = r.needsSleepChoice;
            });
            ctx.toast(`사기 트윗 등록... +${earned.toLocaleString("ko-KR")}원`);
          } else {
            const finalAttr: AttributeId = gloomy || articleTitle ? "daily" : selectedAttr;
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
            let delta = 0;
            ctx.update((st) => {
              const r = postTweet(st, finalAttr, finalText, finalAdult, adultKind, mult);
              delta = r.followerDelta;
              needsSleepChoice = r.needsSleepChoice;
              // 창작 트윗 누적 → 20개 이상이면 작가 계약 제안 DM이 올 수 있다
              if (creating) {
                st.creationTweetCount += 1;
                maybeSpawnAuthorDM(st);
              }
            });
            ctx.toast(
              delta >= 0 ? `트윗 등록! +${delta} 팔로워` : `트윗 등록... ${delta} 팔로워`,
            );
          }
          // 저녁 트윗이면 취침 선택 팝업으로 전환, 아니면 닫고 이벤트 판정
          if (needsSleepChoice) {
            ctx.openModal(renderSleepModal);
          } else {
            ctx.closeModal();
            ctx.afterAction("tweet");
          }
        },
      },
      canPostTweet(s) ? (scamMode ? "사기 트윗 등록" : "트윗 등록") : "행동력 부족",
    );

    const body = el(
      "div",
      { class: "modal__body" },
      gloomyNotice,
      articleNote,
      attrChips ? el("div", { class: "compose-label" }, "카테고리") : null,
      attrChips,
      creationChips ? el("div", { class: "compose-label" }, "창작") : null,
      creationChips,
      fanSection,
      cosmeticSection,
      toneChips
        ? el("div", { class: "compose-label" }, isAdultTweet() ? "종류" : "톤 선택")
        : null,
      toneChips,
      el("div", { class: "compose-actions" }, postBtn),
    );

    container.replaceChildren(head, body);
  }

  const head = el(
    "div",
    { class: "modal__head" },
    gloomy ? "새 트윗 (우울 모드)" : articleTitle ? "기사 트윗" : "새 트윗",
    el("button", { class: "popup__close", onclick: () => ctx.closeModal() }, "✕"),
  );

  function paint() {
    rerender();
  }

  paint();
  return container;
}
