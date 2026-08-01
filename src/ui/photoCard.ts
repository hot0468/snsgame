// 카드 스타일은 이 컴포넌트가 직접 들고 온다 — 어드민 편집기(admin-media.html)는 main.css를
// 안 불러오는데 거기서도 카드를 그려야 하기 때문이다(styles/photoCard.css 주석 참조).
import "@/styles/photoCard.css";
import { GACHA_RARITY_OF, isFramedCard } from "@/data/gacha";
import { frameForRarity } from "@/data/frameImages";
import { imageForItem } from "@/data/itemImages";
import { photoForCard } from "@/data/photoCardImages";
import { el } from "@/utils/dom";

/**
 * 포토카드/굿즈 카드 — **사진은 사용자가 넣고, 프레임은 등급이 정한다.**
 *
 * 사진: `src/assets/photocards/{아이템id}.webp` — 같은 id로 여러 장을 등록할 수 있고
 * (`__2`, `__3`), 그중 **몇 번째 사본인지(opts.copy)** 로 컷이 갈린다. 어드민
 * `admin-media.html`의 「포토카드」 모드에서 등록한다. 없으면 빈 카드로 나온다.
 *
 * 프레임 화려함은 common → rare → sr → ssr 순으로 올라간다(스타일은 styles/photoCard.css `.pcard--*`):
 * common 무광 테두리 / rare 색 테두리 + 옅은 광택 / sr 그라데이션 테두리 + 광택 스윕 + 글로우 /
 * ssr 홀로그램 테두리 + 빠른 스윕 + 반짝임 + 맥동 글로우.
 *
 * 프레임 **그림**이 `src/assets/frames/`에 있으면 CSS 테두리 대신 그 모양이 덮인다
 * (`pcard--imgframe`). 그림은 알파만 쓰이고 색은 등급이 칠한다 — data/frameImages.ts 참조.
 *
 * ⚠️ 등급은 인자로 받지 않고 **아이템 id로 찾는다**(GACHA_RARITY_OF) — 호출부마다 등급을
 *    다시 적으면 데이터와 어긋난다. 가챠 결과·서랍장·어드민이 모두 같은 카드를 보게 하려는 것이다.
 */
export function renderPhotoCard(
  itemId: string,
  name: string,
  opts: { size?: "sm" | "lg"; label?: string; rarity?: string; copy?: number } = {},
): HTMLElement {
  // opts.rarity는 **어드민 미리보기 전용 우회로**다(같은 사진을 4등급에 끼워 비교하려는 것).
  // 게임 화면에서는 넘기지 마라 — 넘기는 순간 표시 등급이 데이터와 어긋난다.
  const rarity = opts.rarity ?? GACHA_RARITY_OF[itemId] ?? "common";
  // 포토카드 전용 사진(여러 컷 가능)이 우선, 없으면 기존 아이템 사진으로 폴백한다.
  const url = photoForCard(itemId, opts.copy ?? 0) ?? imageForItem(itemId);
  const size = opts.size ?? "lg";
  // 배지·아크릴·폴라로이드처럼 카드가 아닌 실물은 **프레임 없이 사진만** 보여준다.
  // (opts.rarity를 넘긴 어드민 프레임 미리보기는 예외 — 거기선 일부러 프레임을 씌워 비교한다.)
  const framed = opts.rarity ? true : isFramedCard(itemId);
  // 프레임 그림이 있으면 CSS 테두리를 끄고(그 등급만) 사진 위에 그림을 덮는다.
  const frame = framed ? frameForRarity(rarity) : null;

  return el(
    "div",
    {
      class:
        `pcard pcard--${rarity} pcard--${size}` +
        (frame ? " pcard--imgframe" : "") +
        (framed ? "" : " pcard--plain"),
    },
    el(
      "div",
      { class: "pcard__frame" },
      el(
        "div",
        {
          class: "pcard__photo" + (url ? "" : " pcard__photo--none"),
          style: url ? `background-image:url(${url})` : "",
        },
        url ? null : el("span", { class: "pcard__ph" }, "🎴"),
      ),
      // 광택·반짝임은 프레임 위를 덮는 레이어다(사진을 가리지 않게 pointer-events 없음).
      el("div", { class: "pcard__shine" }),
      // 프레임 그림은 <img>가 아니라 **마스크**로 쓴다 — 그림의 알파(선·장식)만 남기고
      // 색은 등급 그라데이션이 칠하므로, 그림 한 장으로 4등급을 다 낸다(data/frameImages.ts).
      frame ? el("div", { class: "pcard__framing", style: `--frame-src:url(${frame})` }) : null,
      opts.label ? el("span", { class: "pcard__grade" }, opts.label) : null,
    ),
    size === "lg" ? el("div", { class: "pcard__name" }, name) : null,
  );
}
