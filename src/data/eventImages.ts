/**
 * 이벤트 창에 붙는 이미지.
 *
 * **파일명이 곧 이벤트 id다.** `src/assets/events/lost_wallet.webp`를 넣으면
 * id가 `lost_wallet`인 이벤트(data/events.ts)의 팝업 상단에 자동으로 붙는다 —
 * 코드를 고칠 필요가 없다. 목록을 손으로 적지 마라, glob이 전부다.
 *
 * ⚠️ 미디어 트윗 이미지(data/mediaImages.ts)와 반대로 **선명해야 한다** —
 * 이벤트 장면을 보여주는 그림이라 흐리게 만들 이유가 없다(아이템 이미지와 같은 축).
 * webp·png·jpg 모두 받는다.
 */
const files = import.meta.glob<string>("../assets/events/*.{webp,png,jpg,jpeg}", {
  eager: true,
  query: "?url",
  import: "default",
});

/** 이벤트 id → 이미지 URL. 파일명(확장자 제외)이 이벤트 id와 일치하는 것을 매핑한다. */
export const EVENT_IMAGES: Record<string, string> = {};
for (const [path, url] of Object.entries(files)) {
  const id = path
    .split("/")
    .pop()!
    .replace(/\.(webp|png|jpe?g)$/i, "");
  EVENT_IMAGES[id] = url as string;
}

/** 해당 이벤트에 붙일 이미지 URL(없으면 null). */
export function eventImage(eventId: string): string | null {
  return EVENT_IMAGES[eventId] ?? null;
}
