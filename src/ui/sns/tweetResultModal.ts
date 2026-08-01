import type { AttributeId } from "@/core/types";
import type { GameContext } from "@/ui/context";
import { el, formatNumber } from "@/utils/dom";
import { ATTRIBUTES } from "@/data/attributes";
import {
  masteryGrade,
  masteryNextThreshold,
  masteryTierFor,
  masteryTitle,
} from "@/data/tweetMastery";
import { icon, ATTR_ICON } from "@/ui/icons";

/**
 * 게시 결과 화면 — 트윗을 올린 직후의 성취를 보여준다.
 *
 * 왜 토스트가 아니라 화면인가: 토스트 한 줄로는 숫자가 팔로워 총량에 흡수되어 사라진다.
 * **게이지가 눈앞에서 차오르는 것**이 성취감의 본체다 — 숫자를 크게 쓰는 걸로는 안 된다.
 *
 * ⚠️ 순수 표시다 — 게임 상태를 바꾸지 않는다(적립·보상은 postTweet이 이미 끝냈다).
 * ⚠️ 떡상이면 호출자가 떡상 오버레이를 **먼저** 띄우고, 그게 닫힐 때 이 화면을 연다
 *    (showDdeoksang의 onNext). 두 연출이 자리를 다투지 않게 하는 순서다.
 */
export interface TweetResultPayload {
  attr: AttributeId;
  likes: number;
  retweets: number;
  followerDelta: number;
  /** 이번 트윗 적립 **후**의 갈래 숙련 누적. */
  masteryCount: number;
  /** 이번 트윗으로 오른 새 tier(1~4). 안 올랐으면 0. */
  masteryTierUp: number;
  streak: number;
  statChanges: { label: string; delta: number }[];
  rodeTrend: boolean;
}

/** 숙련 진행 게이지 한 덩이(라벨 + 바 + 등급·칭호 줄). */
function masteryGauge(payload: TweetResultPayload): HTMLElement {
  const label = ATTRIBUTES[payload.attr].label;
  const tier = masteryTierFor(payload.masteryCount);
  const next = masteryNextThreshold(tier);
  const grade = masteryGrade(tier);
  const title = masteryTitle(tier);

  // 게이지는 **현재 tier 구간 안에서의 진행**이다(0부터가 아니라 이전 문턱부터).
  // 그래야 다음 문턱이 늘 눈앞의 목표로 남는다.
  const floor = tier === 0 ? 0 : (masteryNextThreshold(tier - 1) ?? 0);
  const ceil = next ?? payload.masteryCount;
  const span = Math.max(1, ceil - floor);
  // ⚠️ 승급한 트윗은 **가득 찬 바**로 보여준다. 이 계산을 그대로 쓰면 방금 넘은 문턱이
  //    새 구간의 0%가 되어, 승급을 축하하는 화면에서 게이지가 텅 빈 채로 뜬다(실제로 그랬다).
  //    다음 구간의 진행은 다음 트윗부터 보이면 된다.
  const tieredUp = payload.masteryTierUp > 0;
  const pct =
    tieredUp || next === null
      ? 100
      : Math.min(100, ((payload.masteryCount - floor) / span) * 100);
  const countText = tieredUp
    ? `${payload.masteryCount}개 달성`
    : next === null
      ? `${payload.masteryCount} · 만렙`
      : `${payload.masteryCount} / ${next}`;

  return el(
    "div",
    { class: "tweet-result__mastery" },
    el(
      "div",
      { class: "tweet-result__mastery-head" },
      icon(ATTR_ICON[payload.attr], { size: 14 }),
      el("span", {}, `${label} 숙련`),
      el("span", { class: "tweet-result__mastery-count" }, countText),
    ),
    el(
      "div",
      { class: "mastery-bar" },
      // 폭을 인라인으로 주고, 채워지는 애니는 CSS transition이 맡는다.
      el("div", { class: "mastery-bar__fill", style: `width:${pct}%` }),
    ),
    grade
      ? el(
          "div",
          { class: "tweet-result__mastery-tier" },
          el("span", { class: "mastery-grade" }, grade),
          el("span", {}, `${label} ${title ?? ""}`),
        )
      : el(
          "div",
          { class: "tweet-result__mastery-tier tweet-result__mastery-tier--none" },
          `첫 등급까지 ${Math.max(0, (next ?? 0) - payload.masteryCount)}개`,
        ),
  );
}

/** 게시 결과 모달을 띄운다. `onAgain`은 [한 번 더] 버튼이 부른다. */
export function showTweetResult(
  ctx: GameContext,
  payload: TweetResultPayload,
  onAgain: () => void,
): void {
  ctx.openModal((c) => {
    const statText = payload.statChanges
      .map((s) => `${s.label} ${s.delta > 0 ? "+" : ""}${s.delta}`)
      .join(" · ");

    const badges: (HTMLElement | null)[] = [
      payload.rodeTrend ? el("span", { class: "tweet-result__badge" }, "🔥 트렌드 편승") : null,
      payload.streak >= 2
        ? el("span", { class: "tweet-result__badge" }, `⚡ ${payload.streak}연타`)
        : null,
      statText ? el("span", { class: "tweet-result__badge" }, statText) : null,
    ];

    return el(
      "div",
      { class: "modal tweet-result" },
      el("div", { class: "modal__head" }, "트윗 등록!"),
      el(
        "div",
        { class: "modal__body" },
        // 승급했으면 맨 위에 축하 줄 — 갈래당 4번밖에 없는 순간이라 가장 눈에 띄는 자리에 둔다.
        payload.masteryTierUp > 0
          ? el(
              "div",
              { class: "tweet-result__levelup" },
              `🏅 ${ATTRIBUTES[payload.attr].label} ${masteryTitle(payload.masteryTierUp) ?? ""} 달성!`,
            )
          : null,
        el(
          "div",
          { class: "tweet-result__nums" },
          el("div", { class: "tweet-result__num" }, "❤️ ", formatNumber(payload.likes)),
          el("div", { class: "tweet-result__num" }, "🔁 ", formatNumber(payload.retweets)),
          el(
            "div",
            {
              class:
                "tweet-result__num tweet-result__num--follow" +
                (payload.followerDelta < 0 ? " tweet-result__num--bad" : ""),
            },
            "👤 ",
            `${payload.followerDelta >= 0 ? "+" : ""}${formatNumber(payload.followerDelta)}`,
          ),
        ),
        badges.some(Boolean) ? el("div", { class: "tweet-result__badges" }, ...badges) : null,
        masteryGauge(payload),
        el(
          "div",
          { class: "compose-actions" },
          el(
            "button",
            {
              class: "btn btn--ghost",
              onclick: () => {
                c.closeModal();
                // 결과를 닫는 시점이 '행동이 끝난 시점'이다 — 이벤트 판정을 여기로 미룬다.
                c.afterAction("tweet");
              },
            },
            "닫기",
          ),
          // 등록 버튼과 같은 클래스(`btn`)를 쓴다 — `btn--primary`는 이 프로젝트에 없다.
          el("button", { class: "btn", onclick: onAgain }, "한 번 더"),
        ),
      ),
    );
  });
}
