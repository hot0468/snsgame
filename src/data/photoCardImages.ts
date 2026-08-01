/**
 * 포토카드 사진 — **한 굿즈에 여러 컷을 둘 수 있다.**
 *
 * 파일명은 아이템 id이고, 같은 id로 또 저장하면 어드민/서버가 `__2`, `__3`을 붙인다
 * (vite.config.ts의 uniqueName). 그래서 `gc_sr_photocard.webp`와 `gc_sr_photocard__2.webp`는
 * **같은 굿즈의 다른 컷**이 된다.
 *
 * ⚠️ 아이템 사진(data/itemImages.ts)과 폴더를 갈라 둔 이유가 이것이다 — 저쪽은 id 1:1이라
 *    같은 이름으로 저장하면 '사진 교체'가 맞다. 여기서 같은 이름은 '한 장 추가'다. 합치지 마라.
 *
 * 어느 컷이 나오는지는 `photoForCard`가 **보유 순번**으로 정한다(무작위가 아니다) —
 * 같은 카드의 첫 장과 두 번째 장이 서로 다른 컷이 되고, 다시 열어도 그 카드는 늘 같은 컷이다.
 */

const files = import.meta.glob<string>("../assets/photocards/*.webp", {
  eager: true,
  query: "?url",
  import: "default",
});

/**
 * `gc_sr_photocard__2` → { id: "gc_sr_photocard", n: 2 }. 번호 없는 첫 장은 n=1이다.
 * ⚠️ 파일명 문자열로 정렬하면 안 된다 — `localeCompare`는 `__2`를 `.webp`보다 앞에 놓아서
 *    2번째 컷이 1번째로 온다(실제로 그렇게 뒤집혔다). 반드시 이 **번호로** 정렬하라.
 */
function parseName(fileName: string): { id: string; n: number } {
  const m = /^(.*?)__(\d+)$/.exec(fileName);
  return m ? { id: m[1], n: Number(m[2]) } : { id: fileName, n: 1 };
}

/** 아이템 id → 그 굿즈의 컷들(등록 순). 없는 id가 대부분이라 조회 실패가 정상이다. */
export const PHOTOCARD_IMAGES: Record<string, string[]> = (() => {
  const rows = Object.entries(files).map(([path, url]) => {
    const { id, n } = parseName(path.split("/").pop()!.replace(/\.webp$/, ""));
    return { id, n, url };
  });
  rows.sort((a, b) => a.n - b.n);
  const out: Record<string, string[]> = {};
  for (const r of rows) (out[r.id] ??= []).push(r.url);
  return out;
})();

/** 이 굿즈에 등록된 컷 수(어드민 표시용). */
export function photoCountFor(itemId: string): number {
  return PHOTOCARD_IMAGES[itemId]?.length ?? 0;
}

/**
 * 이 굿즈의 `index`번째 사본이 보여줄 컷. 등록된 장수를 넘어가면 처음으로 돌아간다.
 * @param index 보유 순번(0부터). 서랍장의 n번째 사본, 가챠는 방금 뽑은 사본의 순번.
 */
export function photoForCard(itemId: string, index = 0): string | null {
  const list = PHOTOCARD_IMAGES[itemId];
  if (!list?.length) return null;
  return list[((index % list.length) + list.length) % list.length];
}
