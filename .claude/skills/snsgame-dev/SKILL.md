---
name: snsgame-dev
description: snsgame(팔로워 100만명 모으기 텍스트 게임) 개발 작업을 조율하는 오케스트레이터. 게임에 기능/콘텐츠/화면/규칙을 추가·수정·확장하거나 밸런스를 조정할 때 이 스킬로 전문가 팀(콘텐츠 작가·시스템 엔지니어·UI 빌더·통합 QA)을 소집한다. "게임에 ~추가", "~기능 만들어", "~시스템 구현", "콘텐츠/이벤트/트윗 추가", "화면/모달 만들어", "밸런스 조정", 그리고 후속 요청 "다시 실행", "재실행", "업데이트", "수정", "보완", "이전 결과 개선", "~부분만 다시" 등에 트리거하라. 단순 질문(코드 설명·위치 찾기)은 팀 없이 직접 답해도 된다.
---

# snsgame 개발 오케스트레이터

`data → systems → ui` 단방향 구조의 텍스트 게임에 기능을 더하는 작업을 **에이전트 팀**으로 조율한다. 대부분의 기능은 여러 계층을 넘나들고 경계면 검증이 필요하므로, 팀 모드가 기본이다.

## 실행 모드: 에이전트 팀 (기본)

리더(오케스트레이터)가 `TeamCreate`로 팀을 꾸리고 `TaskCreate`로 작업을 배분한다. 팀원은 `SendMessage`로 직접 조율한다. **작업에 필요한 팀원만 소집한다** — 팀은 세션당 하나이니 과하게 만들지 않는다.

**팀 로스터 (`.claude/agents/`):**
| 팀원 | 담당 | 언제 소집 |
|------|------|----------|
| `content-author` | `data/` 콘텐츠·밸런스·한국어 창작 | 트윗·이벤트·시나리오·계정 등 콘텐츠 작업 |
| `systems-engineer` | `systems/`·`core/` 규칙·타입·상태 | 게임 규칙·계산·저장·타입 확장 |
| `ui-builder` | `ui/`·`main.css` 화면·모달 | 화면·모달·스타일 |
| `integration-qa` | 계층 경계면 검증 | 2계층 이상 변경, 타입 확장 시 항상 |

**모든 Agent 호출에 `model: "opus"`를 명시한다.**

## Phase 0: 컨텍스트 확인 (항상 먼저)

1. `_workspace/`는 **기능별 계약서 아카이브**다 — 한 기능당 `{기능}_contract.md` 하나가 쌓인다.
   실행 단위 스크래치가 아니다. 요청 성격을 본다:
   - **새 기능** → `_workspace/{기능}_contract.md`를 **새로 추가**한다. 기존 파일은 그대로 둔다.
   - **부분 수정**("~만 다시") → 해당 기능의 계약서를 읽고 그 팀원만 재호출해 개선한다.
   - ⚠️ **`_workspace/`를 `_workspace_prev/`로 회전시키지 마라.** 파일명이 기능별로 이미 분리돼 충돌이
     없으므로 회전은 이득이 없고, `_workspace_prev/`에 남은 과거 계약서를 **덮어써 파괴한다**.
     (`_workspace_prev/`는 이 규칙이 정리되기 전 회전이 한 번 일어나 생긴 잔재다. 읽기 전용으로 두라.)
2. 작업 성격을 분류해 **소집할 팀원**을 정한다(아래 라우팅).

## Phase 1: 작업 분석 & 팀 소집

**작업 유형 → 팀 구성 라우팅:**
| 요청 | 소집 팀원 |
|------|----------|
| 콘텐츠만 추가(트윗/이벤트/시나리오) | content-author + integration-qa |
| 새 게임 규칙/계산 | systems-engineer + integration-qa |
| 새 화면/모달 | ui-builder (+ 필요 시 systems-engineer) + integration-qa |
| 신규 기능(콘텐츠+규칙+화면 전부) | content-author + systems-engineer + ui-builder + integration-qa |
| 타입/스탯/속성 확장 | systems-engineer(주도) + content-author + ui-builder + integration-qa |
| 밸런스 조정 | content-author (+ systems-engineer if 공식 변경) + integration-qa |

단일 팀원으로 끝나는 소규모 작업이고 경계면이 없으면, 팀 없이 해당 스킬을 직접 적용해도 된다(오버헤드 회피). 단, **2계층 이상을 건드리면 반드시 integration-qa를 포함**한다.

## Phase 2: 실행 & 자체 조율

1. `TeamCreate`로 필요한 팀원만 팀 구성.
2. `TaskCreate`로 작업을 의존 관계와 함께 등록. 전형적 흐름:
   - 타입 확장이 있으면 **systems-engineer가 먼저** (types/state 확정) → 그 위에서 content-author·ui-builder 병행.
   - 그 외에는 계층별 작업을 병행하되, ui-builder는 systems 함수 시그니처가 확정된 뒤 착수.
3. 팀원은 완료 즉시 `integration-qa`에 검증을 요청한다(**점진적 QA** — 전체 끝난 뒤가 아니라 모듈 단위로).
4. QA가 경계면 버그를 발견하면 원인 팀원에게 직접 라우팅 → 수정 → 재검증 루프.

## Phase 3: 통합 & 최종 검증

- 모든 모듈 완료 후 `integration-qa`가 `npm run typecheck` + 필요 시 `npm run build`로 전체 검증.
- 통과하면 사용자에게 변경 요약(추가/수정 파일, 새 콘텐츠·기능, 밸런스 값)을 보고한다.

## 데이터 전달 프로토콜

- **태스크 기반**(`TaskCreate`/`TaskUpdate`): 진행·의존 관리.
- **메시지 기반**(`SendMessage`): 시그니처 전달, 타입 확장 파급 알림, QA 버그 라우팅.
- **파일 기반**: 실제 산출물은 `src/`에 직접 쓴다. 최종 코드는 `src/`, 계약서·작업 메모만 `_workspace/`.
  파일명은 **`{기능}_contract.md`** 하나로 통일한다(팀원별·단계별로 쪼개지 마라 — 팀원이 서로의
  제약을 못 읽는다). 계약서 하나에 요청 원문·확정된 설계 결정·통합 위험·팀원별 분배를 함께 담는다.

## 에러 핸들링

- 팀원 작업이 실패하면 1회 재시도. 재실패 시 그 부분 없이 진행하고 **보고서에 누락을 명시**한다.
- 상충하는 설계 판단(밸런스 값·규칙 해석)은 임의로 지우지 말고 출처를 병기해 사용자에게 판단을 넘긴다.
- typecheck가 계속 깨지면 원인 계층을 격리해(어느 파일부터 깨지는지) 해당 팀원에게 좁혀 전달한다.

## 후속 작업 지원

이 스킬은 신규 기능뿐 아니라 재실행·수정·보완도 처리한다. Phase 0에서 요청 성격으로 **새 기능**(계약서 추가)인지 **부분 수정**(기존 계약서를 읽고 관련 팀원만 재소집)인지 판별한다. 어느 쪽이든 기존 계약서는 지우지도 옮기지도 않는다.

## 테스트 시나리오

**정상 흐름:** "아이돌덕 이벤트 3개 추가해줘"
→ Phase 0: 새 기능 = `_workspace/idolevents_contract.md` 추가(기존 계약서는 그대로) → Phase 1: content-author + integration-qa 소집 → content-author가 events.ts 스키마·기존 아이돌덕 이벤트 확인 후 3개 작성(EventEffect 준수, 밸런스 기존 범위) → integration-qa가 typecheck + id 중복/customKey 대조 → 통과 → 요약 보고.

**에러 흐름:** "새 속성 '스포츠계' 추가하고 관련 트윗·화면까지"
→ 타입 확장 = systems-engineer 주도 소집 → systems가 `AttributeId`에 "sports" 추가 → typecheck가 `Record<AttributeId,...>` 여러 곳에서 키 누락 에러 → integration-qa가 누락 파일 목록화 → attributes.ts(궁합표)는 content-author, state.ts(초기값)는 systems-engineer, UI 카테고리는 ui-builder에 라우팅 → 각자 새 키 채움 → 재검증 통과 → 보고.

## 변경 이력 관리

하네스 자체를 수정(에이전트/스킬 추가·변경)했다면 `CLAUDE.md`의 변경 이력 테이블에 날짜·내용·대상·사유를 기록한다.
