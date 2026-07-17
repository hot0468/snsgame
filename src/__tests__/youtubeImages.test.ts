import { describe, it, expect } from "vitest";
import type { Video } from "@/data/videos";
import type { YoutubeImage } from "@/data/youtubeImages";
import { pickVideoImage } from "@/systems/youtubeImages";

/**
 * 너튜브 썸네일 매칭 회귀 테스트.
 *
 * 핵심은 두 가지다.
 * 1. **정확일치** — 트윗 이미지(부분일치)와 다른 축이다. 제목 글자를 뒤지면 안 된다.
 * 2. **결정론** — 앱은 스토어가 바뀔 때마다 화면을 통째로 다시 그리므로, 매칭에 난수가
 *    들어가면 같은 영상의 썸네일이 렌더마다 바뀌어 깜빡인다.
 *
 * YOUTUBE_IMAGES는 실제 폴더 기반이라 비어 있을 수 있어(그러면 무엇을 넣어도 통과한다),
 * 후보 배열을 직접 넘기는 pickVideoImage를 검증한다.
 */

function video(over: Partial<Video>): Video {
  return {
    id: "v1",
    title: "영상 제목",
    channel: "채널",
    attribute: "animal",
    views: "조회수 1만회",
    age: "1일 전",
    hue: 0,
    tweetLines: [],
    ...over,
  } as Video;
}

// data/youtubeImages.ts가 파일명에서 만들어내는 것과 같은 모양
const img = (file: string): YoutubeImage => ({
  category: file.split("__")[0],
  file,
  url: `/${file}.webp`,
});

const IMAGES = [img("animal"), img("idol"), img("humor")];

describe("pickVideoImage", () => {
  it("카테고리가 같으면 매칭한다", () => {
    expect(pickVideoImage(video({ attribute: "idol" }), IMAGES)).toBe("/idol.webp");
  });

  it("그 카테고리 이미지가 없으면 null (그라데이션 폴백)", () => {
    expect(pickVideoImage(video({ attribute: "politics" }), IMAGES)).toBeNull();
  });

  it("후보가 아예 없으면 null", () => {
    expect(pickVideoImage(video({}), [])).toBeNull();
  });

  it("정확일치다 — 제목에 카테고리 글자가 들어 있어도 붙지 않는다", () => {
    // 트윗 이미지처럼 부분일치를 들이면 여기서 깨진다. 두 축을 섞지 마라.
    const t = video({ attribute: "politics", title: "animal 특집! idol도 나옵니다", channel: "humor" });
    expect(pickVideoImage(t, IMAGES)).toBeNull();
  });

  it("같은 영상은 100번 조회해도 같은 썸네일", () => {
    const pool = [img("animal"), img("animal__2"), img("animal__3")];
    const v = video({ id: "vid_42", attribute: "animal" });
    const first = pickVideoImage(v, pool);
    expect(first).not.toBeNull();
    for (let i = 0; i < 100; i++) expect(pickVideoImage(v, pool)).toBe(first);
  });
});

/**
 * 중복 이름 접미사(`animal__2`) 회귀.
 *
 * 파일명이 곧 카테고리라, 중복 저장으로 붙는 `__N`을 떼지 않으면 그 장은 **영영 안 붙는다**
 * ("animal__2"라는 카테고리를 가진 영상은 없다). typecheck로는 절대 안 잡힌다.
 *
 * ⚠️ 구분자는 vite.config.ts의 DEDUP_SEP과 **한 쌍**이다. 한쪽만 바꾸면 여기서 깨진다.
 */
describe("중복 이름 접미사 — 파일명 __N을 떼고 매칭한다", () => {
  it("접미사가 붙은 장도 원래 카테고리로 매칭된다", () => {
    expect(pickVideoImage(video({ attribute: "animal" }), [img("animal__2")])).toBe(
      "/animal__2.webp",
    );
  });

  it("같은 카테고리의 여러 장이 모두 후보가 된다", () => {
    const pool = [img("animal"), img("animal__2"), img("animal__3")];
    const picked = new Set(
      Array.from({ length: 60 }, (_, i) =>
        pickVideoImage(video({ id: `vid_${i}`, attribute: "animal" }), pool),
      ),
    );
    // 영상 id마다 해시로 갈리므로 한 장에 고정되면 안 된다
    expect(picked.size).toBeGreaterThan(1);
    for (const url of picked) expect(pool.some((p) => p.url === url)).toBe(true);
  });

  it("접미사가 카테고리를 넘나들지 않는다", () => {
    expect(pickVideoImage(video({ attribute: "idol" }), [img("animal__2")])).toBeNull();
  });
});
