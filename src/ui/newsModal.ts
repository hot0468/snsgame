import type { GameContext } from "./context";
import { newsHeadlineFor, resolveNews } from "@/systems/news";
import { el, formatNumber } from "@/utils/dom";

/* ============================================================
 * 내 트윗이 기사화 — 다음날 아침 강제 팝업(app.ts가 state.pendingNews로 감지해 띄운다).
 *
 * 정상 보도(distorted=false): [확인]만 → 2차 유입 확정.
 * 왜곡 보도(distorted=true): [해명 트윗]/[무시] 중 선택 → 결과는 결정 시점에 갈린다
 *   (해명은 역풍 확률이 있어 좋을 수도 나쁠 수도 있다).
 * 모든 선택이 resolveNews를 거쳐 pendingNews를 클리어한다(안 하면 매 렌더 재팝업).
 * 참고 패턴: ui/drunkModal.ts(강제팝업 구조·닫기 규약).
 * ============================================================ */

/** 기사화 아침 팝업. */
export function renderNewsModal(ctx: GameContext): HTMLElement {
  const news = ctx.store.getState().pendingNews;
  const headline = news ? newsHeadlineFor(news) : "";
  // newsHeadlineFor는 항상 "[언론사] 헤드라인" 형태로 조립한다 — 카드에 마스트헤드처럼
  // 나눠 보여주려고 여기서만 분리한다(값 자체는 systems가 만든 것, UI는 표시만 나눈다).
  const match = headline.match(/^\[(.+?)\]\s*(.*)$/);
  const outlet = match?.[1] ?? "";
  const headlineText = match?.[2] ?? headline;
  const distorted = news?.distorted ?? false;

  function resolve(action: "ack" | "clarify" | "ignore"): void {
    let delta = 0;
    ctx.update((s) => {
      delta = resolveNews(s, action);
    });
    const good = delta >= 0;
    const deltaLabel = `${delta >= 0 ? "+" : ""}${formatNumber(delta)}`;
    const msg =
      action === "ack"
        ? `기사 덕에 팔로워가 늘었다! ${deltaLabel}`
        : action === "clarify"
          ? good
            ? `해명이 통했다 — 팔로워 ${deltaLabel}`
            : `해명이 역풍을 맞았다... 팔로워 ${deltaLabel}`
          : `그냥 넘어갔다 — 팔로워 ${deltaLabel}`;
    ctx.toast(msg, good ? "good" : "bad");
    ctx.closeModal();
  }

  return el(
    "div",
    { class: "modal" },
    el("div", { class: "modal__head" }, "📰 내 트윗이 기사화됐다"),
    el(
      "div",
      { class: "modal__body" },
      el(
        "p",
        { class: "drunk-modal__lead" },
        distorted
          ? "누군가 내 트윗을 캡처해 기사로 냈다. 그런데… 문맥이 이상하게 잘려나갔다?"
          : "내 트윗이 언론에 소개됐다! 어떤 기사인지 확인해보자.",
      ),
      el(
        "div",
        { class: "news-card" },
        el("div", { class: "news-card__outlet" }, outlet),
        el("div", { class: "news-card__headline" }, headlineText),
        el("p", { class: "news-card__quote" }, `"${news?.tweetText ?? ""}"`),
      ),
      distorted
        ? el(
            "div",
            { class: "compose-actions", style: "gap:10px" },
            el(
              "button",
              { class: "btn btn--ghost", onclick: () => resolve("ignore") },
              "무시",
            ),
            el(
              "button",
              { class: "btn", onclick: () => resolve("clarify") },
              "해명 트윗",
            ),
          )
        : el(
            "div",
            { class: "compose-actions", style: "justify-content:center" },
            el("button", { class: "btn", onclick: () => resolve("ack") }, "확인"),
          ),
    ),
  );
}
