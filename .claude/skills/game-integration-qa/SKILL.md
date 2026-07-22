---
name: game-integration-qa
description: snsgame의 변경사항을 검증할 때 사용. typecheck·build 실행에 더해 data↔systems↔ui 계층 경계면(타입 shape·Record 키·함수 시그니처·id 참조)을 교차 비교해 통합 버그를 잡는다. 기능 구현 완료 후, 여러 계층을 건드린 뒤, 타입/스탯/속성을 확장한 뒤, "검증해줘", "QA", "빌드 확인", "타입 체크", "정합성" 요청 시 반드시 이 스킬을 사용하라.
---

# 통합 QA (경계면 검증)

이 게임의 버그는 대개 "코드가 없다"가 아니라 **"계층이 서로 안 맞물린다"**에서 온다. `data → systems → ui` 단방향 구조라, 한 계층의 변경이 다른 계층에 반영되지 않으면 조용히 깨진다. QA의 핵심은 **존재 확인이 아니라 경계면 교차 비교**다.

## 검증 시점: 기본 1회, 파급 큰 변경만 점진
기본은 **전체 완성 후 1회**다(모듈마다 돌면 QA 컨텍스트가 다회 부팅돼 토큰이 배로 든다 — snsgame-dev Phase 2와 동일 규칙). 단 **타입/스탯/속성 확장처럼 파급이 넓은 변경**은 예외로 각 모듈 직후 즉시 돈다 — 늦게 잡을수록 재작업이 커진다.

## 1단계: 기계 검증 (최소 기준)
```bash
npm run typecheck   # 타입 정합성 — 통과가 최소 기준
npm run build       # 필요 시 실제 번들까지 되는지
npm test            # 상설 회귀 테스트(vitest)
```
typecheck가 상당수 경계면 버그를 잡지만, **인덱스 접근(`map[key]`)·런타임 undefined·논리 불일치는 못 잡는다.** 그래서 2단계가 필요하다.

**⚠️ typecheck 통과로 PASS 판정하지 마라.** 이 저장소에서 실제로 잡힌 버그들은 **전부 typecheck를 통과했다**: 야근률이 등급과 반대로 설정됨 / 힌트가 조회수로 들통남 / 행동력 상한이 조용히 100으로 깎임 / "gaming 해금 시 game>0" 불변식이 거짓 / 자격증 5종이 며칠씩 같은 항목 고정. 전부 **런타임으로 굴려야** 나왔다.

## 1.5단계: 헤드리스 구동 (수치·확률·불변식을 건드렸다면 필수)

`npm test`로 안 덮이는 일회성 검증은 esbuild로 실제 코드를 번들해 Node에서 굴린다. **읽고 추론하지 말고 구동하라.**

```bash
SP="<스크래치패드>"
cat > "$SP/chk.ts" <<'EOF'
import { createInitialState } from "@/core/state";
import { doWork } from "@/systems/employment";   // 실제 게임 함수를 부른다
// ... 상태를 만들고 굴려서 수치를 출력
EOF
npx esbuild "$SP/chk.ts" --bundle --format=esm --platform=node \
  --outfile="$SP/chk.mjs" --alias:@=./src --log-level=error && node "$SP/chk.mjs"
rm -f "$SP/chk.ts" "$SP/chk.mjs"   # 일회성이면 지운다
```

지킬 것:
- **헬퍼가 아니라 실제 진입점을 불러라.** `clampAction`을 직접 부르는 건 증명이 아니다 — `doWork()`를 불러 행동력이 실제로 105가 되는지 봐라.
- **상수는 소스에서 import해라.** 스크립트에 값을 하드코딩하면 실제와 다른 걸 재고도 통과한다(실제로 그런 오보고가 있었다).
- **빌드 실패 시 즉시 중단하라.** node가 이전 번들을 그대로 실행해 가짜 PASS를 낸 적이 있다.
- 확률·분포는 **표본을 크게**(2만~30만 회) 잡아라.
- ⚠️ 파일이 CRLF일 수 있다(`git checkout` 후). 텍스트를 정규식으로 파싱하는 스크립트면 `tr -d '\r'`로 정규화하라.

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

### ①-B 클램프 오분류 (typecheck가 절대 못 잡는 최빈 버그)

스탯은 상한이 셋이고 클램프도 셋인데 **전부 `number → number`**라 바꿔 써도 컴파일된다. 현재 138곳.

| 좌변 | 올바른 클램프 | 상한 |
|---|---|---|
| `state.skills.*` | `clampSkill(v)` | 999 |
| `state.resources.action` | `clampAction(state, v)` | 100 + 보너스 |
| `state.resources.{mental,morality,reputation}` | `clampResource(v)` | 100 |

```bash
# 교차 오분류 탐지 (전부 0건이어야 정상)
grep -rn "clampResource(state.skills\|clampSkill(state.resources" src/
grep -rn "clampAction(state, state.skills\|clampAction(state, state.resources.\(mental\|morality\|reputation\)" src/
grep -rn "clampResource(state.resources.action\|Math.min(100, state.resources.action" src/
# 스킬 쓰기가 전부 clampSkill을 거치는지 (누락 = 그 경로만 무제한/미클램프)
grep -rn "state.skills\.\w* =" src/ | grep -v clampSkill
```
**런타임으로도 확인하라**: 치트로 상한을 올린 뒤 근무 → 105인가(100 아님)? 같은 상태에서 평판·도덕성은 여전히 100에서 막히는가?

### ①-C 스케일 환산 누락
스킬(0~999)을 `requirement` 같은 **0~100 기준 값과 비교**하는데 `skillTo100()`을 안 거치면 **전원 합격 또는 전원 불합격**이 된다. 선례: `employment.ts` `competence()`, `certification.ts` `examScore()`. 실제 수치로 검산하라(스킬 500 → 약 50).

### ①-D 결정론
날마다 뽑는 목록에 `Math.random()`이 있으면 재렌더마다 바뀐다. 같은 day로 여러 번 호출해 **동일한지 구동 확인**하고, 장기 분포가 편중되지 않는지(특정 항목이 며칠씩 고정) 시뮬레이션하라.

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
