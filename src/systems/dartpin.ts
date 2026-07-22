import type { GameState, Tweet } from "@/core/types";
import { DARTPIN_POSTS, DARTPIN_TWEET_TEMPLATES, type DartpinPost } from "@/data/dartpin";
import { getActiveAccount } from "@/core/state";
import { chance, pick, randInt, sample, uid } from "@/utils/random";

/**
 * '다트 핀' — 익명 게시판 사이트(네이트 판 패러디). 브라우저 **탭**으로 열린다.
 *
 * 진입: 둘러보기 피드에 낮은 확률로 '링크가 달린 트윗'이 섞이고(미해금 때만),
 * 그 링크를 누르면 `unlockDartpin`으로 **탭이 해금**되고 그 탭으로 이동한다
 * (`ui/context.ts`의 `BrowserTabId`, `ui/browser.ts`의 `DARTPIN_TAB`).
 *
 * ## ⚠️ 왜 '탭'인가 — 단발 사이트로 바꾸지 마라
 * 도깨비상점·O넷·경매처럼 `ui.*SiteOpen` 플래그로 한 번 열고 마는 **오버레이 사이트**로
 * 만들고 싶을 수 있다(초기 설계가 실제로 그랬다). 그러면 **기능이 죽는다**:
 * 게시판은 **하루 단위로 갱신**되고(`ensureDartpinBoard`) 힌트 글은 `DARTPIN_HINT_CHANCE`
 * (25%)로 **드물게** 섞인다. 즉 이 콘텐츠는 **재방문이 전제**다 — 단발 진입이면 히든 힌트
 * 3종을 영영 못 보고 끝난다. 탭은 `dartpinUnlocked` 이후 상시 남으므로 재방문이 보장된다.
 * 그래서 해금 후 별도 재진입 경로(네이놈 검색 등)가 **필요 없다** — 탭 자체가 재진입로다.
 *
 * ## ⚠️ 광고 시스템(systems/adTweets.ts)과 별개다 — adPromo로 되돌리지 마라
 * `adPromo.app`도 "트윗 링크 → 탭 해금"이라 **형태가 같아 재사용하고 싶어진다.**
 * 실제로 대상(탭 해금)까지 같다. 그럼에도 분리한 이유는 둘이다:
 * 1. **라벨** — `adPromo`가 붙은 트윗은 `ui/sns/snsView.ts`의 `adTweetCard`가 그리며,
 *    거기서 "광고" 라벨이 **무조건** 붙는다. 다트 핀은 일반인의 바이럴 공유라 광고 라벨이
 *    붙으면 톤이 죽는다. 라벨을 조건부로 바꾸려면 기존 3앱 광고가 전부 타는 코드를
 *    건드려야 해서 회귀 위험만 커진다.
 * 2. **의미** — `adPromo`의 `reward`/`claimed`는 미디어 클릭 적립용이고, `adTweetCard`는
 *    미디어 클릭을 적립으로 오버라이드하며 상세 열기(`onOpen`)를 막는다. 공유 트윗엔
 *    적립 개념이 없어 더미 값을 들고 다니게 되고, 위 동작들도 전부 해롭다.
 *
 * 그래서 `Tweet.siteLink`라는 별도 축을 뒀다. 광고 풀(state.adTweets)도 타지 않으므로
 * 기존 3앱 광고 동작은 **한 줄도 바뀌지 않는다.**
 */

/** 다트 핀 주소(브라우저 urlbar 표시용) */
export const DARTPIN_URL = "dartpin.com";

/** 하루 게시판에 노출되는 글 수 */
export const DARTPIN_BOARD_SIZE = 14;

/**
 * 하루 게시판에 힌트 글이 섞일 확률. 섞이더라도 **최대 1개**다.
 * 게시판은 매일 갱신되므로 낮아도 계속 플레이하면 언젠가 만난다 — '드물게'의 의도.
 */
export const DARTPIN_HINT_CHANCE = 0.25;

/** 둘러보기 피드에 발견 트윗이 섞일 확률(미해금일 때만 굴린다) */
export const DARTPIN_TWEET_CHANCE = 0.15;

/** 이 트윗이 다트 핀 발견 트윗인지 */
export function isDartpinTweet(tweet: Tweet): boolean {
  return tweet.siteLink === "dartpin";
}

/**
 * 다트 핀 발견 트윗 하나를 만든다(둘러보기 피드에 낮은 확률로 섞인다).
 * ⚠️ 광고가 아니다 — `adPromo`를 붙이지 않으므로 "광고" 라벨도, 적립도 없다.
 */
export function makeDartpinTweet(state: GameState): Tweet {
  const tpl = pick(DARTPIN_TWEET_TEMPLATES);
  return {
    id: uid("dptw"),
    authorName: tpl.authorName,
    authorHandle: tpl.authorHandle,
    attribute: "daily",
    isAdult: false,
    text: tpl.text,
    createdDay: state.day,
    // 바이럴 공유답게 남의 트윗치곤 반응이 좀 붙어 있다(광고 수치와 무관).
    likes: randInt(120, 4200),
    retweets: randInt(30, 900),
    gainedFollowers: 0,
    siteLink: "dartpin",
  };
}

/** 링크를 눌러 다트 핀을 발견했다 — 이후 발견 트윗은 더 스폰되지 않는다. */
export function unlockDartpin(state: GameState): void {
  state.dartpinUnlocked = true;
}

/** 힌트 글 / 일반 글 풀 */
const HINT_POSTS = (): DartpinPost[] => DARTPIN_POSTS.filter((p) => p.hint);
const NORMAL_POSTS = (): DartpinPost[] => DARTPIN_POSTS.filter((p) => !p.hint);

/**
 * 오늘자 게시판을 편성한다.
 * - 일반 글로 채우되, DARTPIN_HINT_CHANCE 확률로 힌트 글 **1개**를 끼워 넣는다.
 * - 힌트 글은 목록 안 임의 위치에 들어간다(항상 맨 위면 힌트인 게 티난다).
 */
function rollBoard(): string[] {
  const normals = NORMAL_POSTS();
  const hints = HINT_POSTS();

  const withHint = hints.length > 0 && chance(DARTPIN_HINT_CHANCE);
  const normalCount = Math.min(normals.length, withHint ? DARTPIN_BOARD_SIZE - 1 : DARTPIN_BOARD_SIZE);
  const ids = sample(normals, normals.length).slice(0, normalCount).map((p) => p.id);

  if (withHint) {
    const hint = pick(hints);
    // 목록 안 임의 위치에 끼워 넣는다.
    ids.splice(randInt(0, ids.length), 0, hint.id);
  }
  return ids;
}

/**
 * 게시판 스냅샷이 없거나 오늘 것이 아니면 새로 편성한다.
 * ui가 사이트 렌더 시 호출한다(systems는 렌더 시점을 모른다 — ensureAdTweetsSeeded와 같은 패턴).
 */
export function ensureDartpinBoard(state: GameState): void {
  if (state.dartpinBoard && state.dartpinBoard.day === state.day) return;
  state.dartpinBoard = { day: state.day, postIds: rollBoard() };
}

/**
 * 오늘 게시판의 글 목록을 반환한다.
 * ⚠️ 먼저 `ensureDartpinBoard`를 호출해야 한다(호출 안 됐으면 빈 배열).
 * 데이터에서 사라진 id는 조용히 걸러낸다(콘텐츠가 갱신된 구세이브 대비).
 */
export function getDartpinBoard(state: GameState): DartpinPost[] {
  const ids = state.dartpinBoard?.postIds ?? [];
  return ids
    .map((id) => DARTPIN_POSTS.find((p) => p.id === id))
    .filter((p): p is DartpinPost => p !== undefined);
}

/** id로 게시물 하나를 찾는다(상세 화면용). 없으면 undefined. */
export function findDartpinPost(id: string): DartpinPost | undefined {
  return DARTPIN_POSTS.find((p) => p.id === id);
}

/** 이 글 작성자에게 이미 쪽지를 보냈는지(활성 계정 기준, 중복 방지·버튼 상태용). */
export function hasDartpinAuthorDM(state: GameState, postId: string): boolean {
  return getActiveAccount(state).dms.some((t) => t.dartpinHelp === postId);
}

export type DartpinDMResult = "sent" | "already" | "none";

/**
 * 다트 핀 글 작성자에게 쪽지를 보낸다 → 작성자의 상세 도움 DM이 활성 계정 쪽지함에 도착한다.
 * - 글에 `dm` 정의가 없으면 "none"(ui가 일반 반려 토스트를 띄운다).
 * - 이미 보낸 글이면 "already"(중복 스레드를 만들지 않는다).
 * - 처음이면 스레드를 만들어 unshift하고 "sent".
 *
 * 스레드는 일반 대화로 렌더된다(플래그 없음). 첫 줄은 플레이어 질문(me), 그 뒤가 작성자 답장(partner).
 */
export function sendDartpinAuthorDM(state: GameState, post: DartpinPost): DartpinDMResult {
  if (!post.dm) return "none";
  if (hasDartpinAuthorDM(state, post.id)) return "already";

  const day = state.day;
  const messages = [
    { id: uid("dmm"), from: "me" as const, text: post.dm.question, day },
    // 빈 줄(간격용)은 버블에선 버린다 — 각 줄이 하나의 말풍선이 된다.
    ...post.dm.reply
      .filter((line) => line.trim().length > 0)
      .map((line) => ({ id: uid("dmm"), from: "partner" as const, text: line, day })),
  ];

  getActiveAccount(state).dms.unshift({
    id: uid("dm"),
    partnerName: post.dm.name,
    partnerHandle: post.dm.handle,
    attribute: "daily",
    isAdult: false,
    messages,
    unread: true,
    metOffline: false,
    wantsToMeet: false,
    dartpinHelp: post.id,
  });
  return "sent";
}
