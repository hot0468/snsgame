import type { Video } from "@/data/videos";
import type { YoutubeImage } from "@/data/youtubeImages";
import { YOUTUBE_IMAGES } from "@/data/youtubeImages";
import { hashInt } from "@/utils/random";

/**
 * 너튜브 영상 ↔ 썸네일 매칭.
 * 파일명(카테고리)이 영상의 attribute와 **정확히 같으면** 그 이미지를 붙인다.
 *
 * ⚠️ 트윗 이미지(systems/mediaImages.ts)와 성격이 다르다 — 저쪽은 본문 부분일치다.
 *    여기에 부분일치를 들이지 마라. 'info'가 제목 어딘가에 들어 있어서 붙는 일은 없어야 한다.
 */

/**
 * 후보 목록을 받아 영상에 붙일 썸네일을 고른다.
 *
 * ⚠️ **여기서 Math.random·pick을 쓰면 안 된다.** 앱은 스토어가 바뀔 때마다 화면을
 *    통째로 다시 그린다(ui/app.ts). 렌더마다 난수를 굴리면 같은 영상의 썸네일이
 *    매번 바뀌어 깜빡인다. 그래서 영상 id를 시드로 한 해시에 고정한다.
 *    systems/mediaImages.ts의 pickImage가 같은 이유로 남긴 선례다.
 *
 * (YOUTUBE_IMAGES는 실제 폴더 기반이라 비어 있을 수 있어, 테스트를 위해 후보를 인자로 받는다.)
 */
export function pickVideoImage(video: Video, images: readonly YoutubeImage[]): string | null {
  const matches = images.filter((img) => img.category === video.attribute);
  if (matches.length === 0) return null;
  return matches[hashInt(`tubeImg:${video.id}`) % matches.length].url;
}

/** 영상에 붙일 썸네일 URL. 그 카테고리 이미지가 없으면 null — 호출부는 그라데이션으로 폴백한다. */
export function imageForVideo(video: Video): string | null {
  return pickVideoImage(video, YOUTUBE_IMAGES);
}
