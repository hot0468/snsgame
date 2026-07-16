import type { GameState, Tweet } from "@/core/types";
import { DSTORY_POSTS, DSTORY_TWEET_TEMPLATES, type DstoryPost } from "@/data/dstory";
import { pick, randInt, uid } from "@/utils/random";
import { clampSkill } from "./stats";

/**
 * 'd스토리' — 개인 기술 블로그(티스토리 패러디)의 비밀번호 퍼즐.
 *
 * 진입: **IT계 검색** 결과에 낮은 확률로 링크 트윗이 섞이고(두 글을 다 풀기 전까지만),
 * 그 링크를 누르면 `ui.dstorySiteOpen` 오버레이가 현재 탭 콘텐츠를 덮는다.
 * 글 2개가 각각 비밀번호로 잠겨 있고, 풀면 IT 스탯이 오른다.
 *
 * ## ⚠️ 왜 '오버레이'인가 — 다트 핀과 반대다
 * `systems/dartpin.ts`는 **탭**이어야 했다: 게시판이 매일 갱신되고 힌트 글이 25%로만
 * 섞여 **재방문이 전제**이기 때문이다. d스토리는 그 전제가 없다 — 콘텐츠가 **고정 2글**이고
 * 한 번 풀면 끝이다. 그래서 탭도, `dstoryUnlocked` 같은 해금 플래그도 두지 않는다.
 * 오버레이는 상태에 남지 않으므로 `unlock*` 함수가 이 파일에 **없다**(dartpin과의 유일한
 * 형태 차이다 — 대칭을 맞추겠다고 만들지 마라).
 *
 * 재진입은 이미 보장돼 있다: `isDstoryDone`이 false인 한 링크 트윗이 계속 스폰되므로
 * IT계 검색을 다시 하면 된다. 정답을 찾으러 가는 동안에도 닫히지 않는다 —
 * 정답 소스 둘(개발자 도구·명령 프롬프트)이 **모달**이라 `activeTab`을 건드리지 않고,
 * 오버레이 위에 떴다가 닫히면 d스토리가 그대로 남는다. **이게 퍼즐의 전제다.**
 *
 * ## ⚠️ 광고가 아니다 — adPromo를 붙이지 마라
 * `makeDstoryTweet`에 `adPromo`를 붙이면 `adTweetCard`가 "광고" 라벨을 **무조건** 붙여
 * 톤이 죽는다. 근거는 `systems/dartpin.ts` 헤더가 그대로 적용된다.
 */

/** IT계 검색 결과에 링크 트윗이 섞일 확률(두 글을 다 풀기 전에만 굴린다) */
export const DSTORY_TWEET_CHANCE = 0.2;

/**
 * 게시글 하나를 풀 때 오르는 IT 스탯(999 스케일).
 * 근거: 도서관 오프라인 활동이 지식 +25, Cheat.exe가 전 스킬 +100. 히든 퍼즐 보상이므로
 * 그 사이에 둔다. 2글 다 풀면 +160.
 *
 * ## ⚠️ 소원 가게가 이 보상을 0으로 되돌릴 수 있다 — 버그가 아니다
 * `systems/wish.ts`의 하락 풀이 `SKILL_STAT_IDS`를 펼치므로 `it`도 편입돼 있고,
 * 하락폭(150~250)이 총보상(+160)보다 크다. 즉 소원 한 번(약 10%)이 히든 퍼즐 전체를
 * 날릴 수 있고, 해금된 글은 보상을 재지급하지 않으므로(아래 tryUnlockDstoryPost)
 * **재획득도 불가능**하다.
 *
 * 이걸 알고도 그대로 뒀다(사용자 확정) — 소원 가게는 원래 도박이고, 하드 퍼즐이라고
 * 면제되지 않는다는 판단이다. `wish.ts`에서 `it`을 빼거나 하락폭을 깎지 마라.
 */
export const DSTORY_IT_GAIN = 80;

/** 이 트윗이 d스토리 링크 트윗인지 */
export function isDstoryTweet(tweet: Tweet): boolean {
  return tweet.siteLink === "dstory";
}

/**
 * d스토리 링크 트윗 하나를 만든다(IT계 검색 결과에 낮은 확률로 섞인다).
 * ⚠️ 광고가 아니다 — `adPromo`를 붙이지 않으므로 "광고" 라벨도, 적립도 없다.
 */
export function makeDstoryTweet(state: GameState): Tweet {
  const tpl = pick(DSTORY_TWEET_TEMPLATES);
  return {
    id: uid("dstw"),
    authorName: tpl.authorName,
    authorHandle: tpl.authorHandle,
    attribute: "it",
    isAdult: false,
    text: tpl.text,
    createdDay: state.day,
    likes: randInt(80, 2600),
    retweets: randInt(20, 700),
    gainedFollowers: 0,
    siteLink: "dstory",
  };
}

/** 두 글을 다 풀었는지 — 링크 트윗 스폰 중단 조건 */
export function isDstoryDone(state: GameState): boolean {
  return DSTORY_POSTS.every((p) => state.dstoryUnlockedPosts.includes(p.id));
}

/**
 * 게시글의 비밀번호를 맞춰본다. 맞으면 잠금 해제 + IT +DSTORY_IT_GAIN.
 *
 * - 시간·행동력을 소모하지 않는다(히든 퍼즐이지 행동이 아니다).
 * - 이미 푼 글이면 **상태를 바꾸지 않고** `true`를 반환한다 — 보상 중복 수령 방지이자,
 *   해제된 글이 잠김 화면으로 되돌아가지 않게 하는 장치다.
 * - 비교는 `trim()` + 대소문자 무시다. 설계 문서는 "글1은 대소문자 무시, 글2(IP)는
 *   그대로"라고 나눴지만, 글2의 정답이 숫자와 점뿐이라 lowercase가 **무연산**이다 —
 *   즉 두 규칙의 동작이 같다. 비밀번호 모양을 sniffing해 분기하는 코드를 넣지 마라
 *   (동작은 그대로면서 읽는 사람만 헷갈린다). ⚠️ 단, 글2 정답에 **문자를 넣게 되면**
 *   그때는 실제로 갈린다 — 그 경우에만 분기를 되살려라.
 */
export function tryUnlockDstoryPost(state: GameState, postId: string, input: string): boolean {
  const post = DSTORY_POSTS.find((p) => p.id === postId);
  if (!post) return false;
  if (state.dstoryUnlockedPosts.includes(postId)) return true;

  const ok = input.trim().toLowerCase() === post.password.toLowerCase();
  if (!ok) return false;

  state.dstoryUnlockedPosts.push(postId);
  state.skills.it = clampSkill(state.skills.it + DSTORY_IT_GAIN);
  return true;
}

/** id로 게시글 하나를 찾는다(상세 화면용). 없으면 undefined. */
export function findDstoryPost(id: string): DstoryPost | undefined {
  return DSTORY_POSTS.find((p) => p.id === id);
}
