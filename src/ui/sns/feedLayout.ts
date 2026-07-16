/**
 * 추천탭 피드 배치 규칙 (순수 함수 — DOM/상태 비의존, 테스트 가능).
 *
 * 실제 SNS 추천탭처럼 내 트윗 사이사이에 광고 카드를 규칙적으로 끼워 넣는다.
 * 광고 카드를 전부 피드 끝에 몰아넣으면 트윗이 몇 개만 쌓여도 광고가 화면 밖으로
 * 밀려나 "광고가 안 뜬다"고 느끼게 되므로, 스크롤 도중 자연스럽게 마주치도록 섞는다.
 */

/**
 * 광고 삽입 간격: 트윗 N개마다 광고 1개.
 *
 * 근거:
 * - 1이나 2면 피드가 광고로 도배돼 내 트윗을 읽는 흐름이 끊긴다.
 * - 4 이상이면 광고 상한(8개)을 다 소화하려면 트윗이 32개 필요해, 초반엔 결국
 *   대부분의 광고가 피드 끝에 몰려 지금 버그와 같은 체감이 된다.
 * - 3은 한 화면(대략 트윗 3~4개)마다 광고가 한 번 보이는 밀도로, 실제 SNS
 *   추천탭의 체감 간격과 가깝다.
 */
export const AD_FEED_INTERVAL = 3;

/**
 * 타임라인 트윗과 광고를 교차 배치한다.
 *
 * - 첫 카드는 항상 트윗이다(트윗이 있는 한). 광고는 `interval`번째 트윗 **뒤에** 붙는다.
 * - 남은 광고(트윗보다 광고가 많은 경우)는 버리지 않고 피드 끝에 순서대로 덧붙인다.
 * - 트윗이 0개면 광고만 순서대로 반환한다(호출부에서 안내 문구를 앞에 둔다).
 */
export function interleaveFeed<T>(tweets: T[], ads: T[], interval: number = AD_FEED_INTERVAL): T[] {
  const step = Math.max(1, Math.floor(interval));
  const out: T[] = [];
  let ai = 0;
  tweets.forEach((t, i) => {
    out.push(t);
    if ((i + 1) % step === 0 && ai < ads.length) out.push(ads[ai++]);
  });
  // 소진되지 않은 광고는 피드 끝에.
  for (; ai < ads.length; ai++) out.push(ads[ai]);
  return out;
}
