import type { GameContext } from "./context";
import { el, formatNumber } from "@/utils/dom";

/**
 * 떡상 연출 오버레이 — 대박 트윗 순간의 손맛.
 * 좋아요·리트윗 숫자가 카운트업하고 폭죽 + "떡상 중 🔥" 배너가 뜬다.
 * ⚠️ 순수 표시다 — 게임 상태를 바꾸지 않는다(보상은 systems가 이미 지급했다).
 * 탭하거나 ~2.6초 후 자동으로 닫힌다.
 */
export function showDdeoksang(
  ctx: GameContext,
  opts: { likes: number; retweets: number; gain: number },
): void {
  ctx.openModal((c) => {
    const likesEl = el("span", { class: "ddeoksang__num" }, "0");
    const rtEl = el("span", { class: "ddeoksang__num" }, "0");

    // 폭죽 조각(순수 CSS 애니, 위치만 인라인)
    const sparks = Array.from({ length: 14 }, (_, i) => {
      const angle = (360 / 14) * i;
      return el("span", {
        class: "ddeoksang__spark",
        style: `--a:${angle}deg;--d:${80 + (i % 3) * 26}px`,
      });
    });

    const card = el(
      "div",
      { class: "ddeoksang" },
      el("div", { class: "ddeoksang__fx" }, ...sparks),
      el("div", { class: "ddeoksang__banner" }, "떡상 중 🔥"),
      el(
        "div",
        { class: "ddeoksang__stats" },
        el("div", { class: "ddeoksang__stat" }, el("span", { class: "ddeoksang__ico" }, "❤️"), likesEl),
        el("div", { class: "ddeoksang__stat" }, el("span", { class: "ddeoksang__ico" }, "🔁"), rtEl),
      ),
      el("div", { class: "ddeoksang__gain" }, `팔로워 +${formatNumber(opts.gain)}`),
      el("div", { class: "ddeoksang__hint" }, "탭해서 닫기"),
    );

    // 숫자 카운트업(약 1초, ease-out). requestAnimationFrame은 브라우저 런타임이라 사용 가능.
    const startTs = performance.now();
    const DUR = 1000;
    let raf = 0;
    const tick = (now: number): void => {
      const t = Math.min(1, (now - startTs) / DUR);
      const e = 1 - Math.pow(1 - t, 3);
      likesEl.textContent = formatNumber(Math.round(opts.likes * e));
      rtEl.textContent = formatNumber(Math.round(opts.retweets * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    // 자동 닫힘 + 탭 닫힘(모달 노드는 캐시되므로 타이머/raf를 닫을 때 정리).
    const cleanup = (): void => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
    const timer = window.setTimeout(() => {
      cleanup();
      c.closeModal();
    }, 2600);

    const backdrop = el(
      "div",
      {
        class: "ddeoksang-layer",
        onclick: () => {
          cleanup();
          c.closeModal();
        },
      },
      card,
    );
    return backdrop;
  });
}
