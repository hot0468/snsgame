---
name: game-content-authoring
description: snsgame(팔로워 100만명 모으기)의 src/data/ 콘텐츠를 제작·확장·밸런싱할 때 사용. 트윗 문구·이벤트·만남 시나리오(웹소설)·계정·도서·미디어·트렌드 등 게임 콘텐츠를 추가하거나 수정하거나, 밸런스(팔로워/스탯/소지금 효과)를 조정하거나, 한국어 게임 텍스트를 쓸 때 반드시 이 스킬을 사용하라. "트윗 추가", "이벤트 만들어", "만남 시나리오", "새 계정", "밸런스 조정", "콘텐츠 더" 같은 요청에 트리거.
---

# 게임 콘텐츠 작성 (data/)

snsgame의 콘텐츠는 `src/data/`에 **선언형 데이터**로 산다. 규칙(효과가 어떻게 적용되는지)은 `systems/`가 처리하므로, 여기서는 **무엇을** 만 선언한다. 콘텐츠의 두 축은 **① TS 인터페이스 정합성**과 **② 한국어 창작 품질**이며, 둘 중 하나만 어긋나도 실패다.

## 작업 순서 (항상 이 순서)

1. **대상 파일을 연다.** 파일 상단 주석 + `interface`/`type` 선언을 읽는다. 스키마가 곧 계약이다.
2. **기존 항목 3~5개를 읽는다.** 형식·톤·값 범위를 흡수한다. 한 예시만 베끼지 말고 *패턴*을 이해한다(오버피팅 금지).
3. **작성한다.** 스키마를 정확히 지키고, 기존 결에 맞춘다.
4. **`npm run typecheck`로 검증한다.** 통과가 최소 기준. 실패하면 고친 뒤 넘긴다.
5. **요약 보고.** 추가한 id·제목·핵심 효과, 그리고 systems/ui 연동이나 타입 확장이 필요한 부분을 명시한다.

## 파일 지도 (무엇이 어디에)

| 콘텐츠 | 파일 | 핵심 인터페이스 |
|--------|------|----------------|
| 트윗 문구 템플릿 | `data/tweets.ts`, `data/longTweets.ts`, `data/tweetSets.ts` | 속성별 문구 |
| 이벤트(선택지) | `data/events.ts` | `GameEvent` / `EventChoice` / `EventEffect` |
| 만남 시나리오(웹소설) | `data/meetings.ts` | `MeetingScenario` (pages + choices) |
| 랜덤 계정·트윗 생성 | `data/accounts.ts` | 계정 페르소나 |
| 속성·궁합표 | `data/attributes.ts` | `AttributeId` 매핑 |
| 스탯 정의 | `data/stats.ts` | `StatId` 라벨 |
| 도서/미디어/영상 | `data/books.ts`, `data/media.ts`, `data/videos.ts`, `data/mediaTweets.ts` | 각 파일 상단 |
| 반응·컨트로버시·트렌드 | `data/reactions.ts`, `data/controversies.ts`, `data/trends.ts` | 각 파일 상단 |
| 쇼핑·집·직업·식료품 등 | `data/shop.ts`, `data/housing.ts`, `data/jobs.ts`, `data/grocery.ts` 등 | 각 파일 상단 |

새 카테고리 콘텐츠는 `data/categories/` 하위에 있을 수 있으니 유사 파일을 먼저 grep한다.

## 공유 효과 스키마 — `EventEffect`

이벤트·만남 등 여러 콘텐츠가 **같은** `EventEffect`로 결과를 선언한다(정의: `data/events.ts`). 값이 음수면 감소.

```ts
interface EventEffect {
  action?: number;        // 행동력
  mental?: number;        // 정신력
  morality?: number;      // 도덕성
  reputation?: number;    // 평판
  money?: number;         // 소지금
  followers?: number;     // 팔로워 고정 증감
  followersPct?: number;  // 팔로워 % 증감 (-10 = 10% 감소)
  skills?: Partial<Record<SkillStatId, number>>; // 세부 스탯
  unlockAttribute?: AttributeId;  // 트윗 속성 해금
  customKey?: "..."       // 선언형으로 못 담는 특수효과 → systems가 처리
}
```

**customKey 규칙:** 코인 펌핑, 유료채널 개설처럼 단순 수치로 표현 못 하는 효과는 `customKey`로 *이름만* 선언하고, 실제 로직은 systems-engineer가 `systems/events.ts`의 `CUSTOM_EFFECTS`에 구현하게 위임한다. **data에서 로직을 짜지 않는다.**

## 밸런스 값 기준

절대 규칙은 없다. **기존 항목의 값 분포가 곧 기준**이다. 새로 쓰기 전 같은 파일에서 유사 항목의 followers/money/스탯 값을 훑고 그 안에서 정한다.

- **양날의 선택지**로 설계한다: 큰 팔로워 이득에는 정신력·도덕성 등의 비용을 붙인다(meetings.ts 예시 참고 — "사람으로서 가까워진다"는 mental +6·followers 25, "동료가 된다"는 mental -6·followers 45).
- `followers` 고정값은 소규모 상호작용(수십), 큰 사건은 `followersPct`로 규모 비례.
- 극단값은 서사적 근거가 분명할 때만.

## 한국어 창작 톤 가이드

게임 톤: **가볍고 유머러스, SNS 현실감, 때로 자극적/성인**. 진지한 문학이 아니라 몰입되는 오락이다.

- **트윗:** 실제 트위터 말투. 짧고, 구어체, 이모지·해시태그 자연스럽게. 속성(일상/정치/아이돌덕/개그 등)마다 화법이 다르다 — 해당 속성 기존 문구의 어투를 맞춘다.
- **만남 시나리오(meetings.ts):** 웹소설 형식. `pages` 배열은 한 화면씩 넘겨 읽는 장문(합계 1000자 이상). `{name}`은 상대 이름으로 치환되니 그대로 쓴다. 마지막 페이지 끝에서 선택의 기로로 이어지고, `choices`가 그 결말을 가른다.
- **성인 콘텐츠:** `adultOnly: true`인 항목은 계정 성인물 해제 시에만 후보. 요청이 있을 때만 작성하며 톤을 맞춘다.
- **실제 인물/브랜드 금지:** 이 게임은 패러디/창작이다(도서·미디어 모두 가상). 실존 인물·상표를 쓰지 않는다.

## 흔한 실수 (경계면 버그 예방)

- **새 `AttributeId`/`SkillStatId`를 data에서 임의로 쓰지 말 것.** 그 값은 `core/types.ts`의 유니온 + 여러 `Record` 매핑(라벨·궁합·초기값)에 등록돼야 한다. 타입 확장이 필요하면 systems-engineer에게 위임하고, data 값은 그 후에 채운다.
- **`id` 중복/오탈자.** 파일 내 유일해야 하고, systems가 id로 콘텐츠를 참조하는 경우 철자가 정확히 일치해야 한다.
- **스키마 필수 필드 누락.** `?`가 없는 필드는 반드시 채운다.
