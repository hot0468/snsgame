---
name: game-integration-qa
description: snsgame의 변경사항을 검증할 때 사용. typecheck·build 실행에 더해 data↔systems↔ui 계층 경계면(타입 shape·Record 키·함수 시그니처·id 참조)을 교차 비교해 통합 버그를 잡는다. 기능 구현 완료 후, 여러 계층을 건드린 뒤, 타입/스탯/속성을 확장한 뒤, "검증해줘", "QA", "빌드 확인", "타입 체크", "정합성" 요청 시 반드시 이 스킬을 사용하라.
---

# 통합 QA (경계면 검증)

이 게임의 버그는 대개 "코드가 없다"가 아니라 **"계층이 서로 안 맞물린다"**에서 온다. `data → systems → ui` 단방향 구조라, 한 계층의 변경이 다른 계층에 반영되지 않으면 조용히 깨진다. QA의 핵심은 **존재 확인이 아니라 경계면 교차 비교**다.

## 검증은 점진적으로
전체 완성 후 1회가 아니라 **각 모듈 완료 직후 즉시** 돈다. 늦게 잡을수록 원인 추적이 어렵다.

## 1단계: 기계 검증 (최소 기준)
```bash
npm run typecheck   # 타입 정합성 — 통과가 최소 기준
npm run build       # 필요 시 실제 번들까지 되는지
```
typecheck가 상당수 경계면 버그를 잡지만, **인덱스 접근(`map[key]`)·런타임 undefined·논리 불일치는 못 잡는다.** 그래서 2단계가 필요하다.

## 2단계: 경계면 교차 비교 (핵심)

각 경계에서 **양쪽 파일을 동시에 열어** shape을 대조한다.

### ① 타입 확장 파급 (최빈 버그)
`core/types.ts`의 유니온(`AttributeId`·`SkillStatId`·`ResourceStatId` 등)에 멤버가 추가됐는가? 그렇다면 그 타입을 **키로 쓰는 모든 `Record<...>`**에 새 키가 채워졌는지 확인:
- `data/attributes.ts` 라벨·궁합표
- `core/state.ts` 초기 스탯/자원 매핑
- `data/stats.ts` 라벨
- 트윗 문구(tweets.ts) 속성 매핑
- UI 카테고리·아이콘 목록

하나라도 누락 → 해당 키 접근 시 런타임 `undefined`. `Record<UnionType, X>` 타입이면 typecheck가 잡지만, `{ [k: string]: X }`나 인덱스 접근이면 못 잡으니 **직접 grep으로 대조**한다.

### ② data ↔ systems
- data가 선언한 `EventEffect.customKey`를 systems(`systems/events.ts`의 `CUSTOM_EFFECTS`)가 실제로 처리하는가? 선언만 있고 처리부가 없으면 무효과.
- data의 `id`를 systems가 참조한다면(예: 특정 시나리오 트리거) 철자가 정확히 일치하는가?

### ③ systems ↔ ui
- ui가 호출하는 systems 함수의 **인자 개수·순서·반환 shape**이 실제 시그니처와 일치하는가? (예: `PostTweetResult`의 필드를 ui가 올바른 이름으로 읽는가)
- ui가 읽는 상태 필드를 systems가 실제로 세팅하는가? (한쪽만 있는 필드는 항상 초기값)

### ④ 단방향 의존 위반
- `systems/`가 `ui/`를 import하지 않는가?
- `data/`가 `systems/`·`ui/`를 import하지 않는가?
```bash
# 위반 탐지 예
grep -rn "from \"@/ui" src/systems src/data
grep -rn "from \"@/systems" src/data
```

### ⑤ 저장 호환성 (save.ts 변경 시)
GameState 구조가 바뀌었으면, 기존 localStorage 세이브를 로드할 때 새 필드가 `undefined`가 되지 않도록 기본값 폴백이 있는지 확인한다.

## 3단계: 보고

문제 위주로 압축한다. "존재 확인 통과"류는 생략.
- 각 버그: `파일:라인` + **원인** + **재현 시나리오**(어떤 입력 → 어떤 오작동).
- 원인 계층별로 담당 팀원에게 라우팅:
  - Record 키 누락·로직 불일치 → systems-engineer
  - 데이터 오탈자·스키마 위반 → content-author
  - 잘못된 함수 호출·없는 필드 참조 → ui-builder
- 수정 후 typecheck + 해당 경계면만 재확인한다.

## 빠른 명령 모음
```bash
npm run typecheck                 # 타입
npm run build                     # 번들
grep -rn "Record<AttributeId" src # 속성 매핑 전수 확인
grep -rn "customKey" src          # 특수효과 선언/처리 대조
```
