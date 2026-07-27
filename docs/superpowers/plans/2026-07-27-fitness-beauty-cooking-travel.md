# 운동·미용·요리·여행 확장 Implementation Plan

**Goal:** 콘텐츠만 있고 기능이 없던 4개 도메인에 축을 만든다.
운동 = 대회로 증명 + 바디프로필 도전, 미용 = 미용실 미니게임, 요리 = 도감, 여행 = 목적지 선택.

**결정 사항(사용자 확정):**
- 미용실 미니게임은 **타이밍 게이지 / 대화 견디기 두 종을 랜덤 교대**로 낸다.
- 바디프로필: 시작하면 한 달 바디게이지 생성 → 운동으로 채우고, 정신력이 낮으면 휴식·외출·산책에서
  고칼로리 이벤트가 터져 게이지가 깎인다. 30일 안에 다 채우면 성공 → 자동 트윗 + 팔로워 상승.

---

## Task A: 요리 도감 (요리)
- [x] `core/types.ts`: `GameState.cookedDishes: string[]`
- [x] `core/state.ts`: 초기값 `[]`
- [x] `systems/save.ts`: sanitize 폴백
- [x] `systems/cooking.ts` 신규: `recordCooking(state, recipe)` — 신규 등록 시 창작 +8, 전종 완성 1회 보너스
- [x] `ui/grocery.ts`: 주문 성공 시 `recordCooking` 호출 + 상단 「요리 도감」 버튼
- [x] `ui/cookingDexModal.ts` 신규: 9종 그리드(미수집은 실루엣)
- [x] typecheck

## Task B: 여행지 선택형 휴가 (여행)
- [x] `data/vacation.ts`: `VACATION_DESTINATIONS`(당일치기/국내/해외) — 비용·소요 슬롯·회복·스탯 배율·이벤트 수
- [x] `systems/offline.ts`: `doOfflineActivity`에 목적지 인자, 휴가 분기에서 배율·이벤트 수·슬롯 반영
- [x] `ui/offlineModal.ts`: 휴가 클릭 시 목적지 선택 → 선택한 목적지로 실행
- [x] typecheck

## Task C: 마라톤 대회 (운동)
- [x] `data/races.ts` 신규: 5km/10km/하프/풀 (참가비·목표기록·상금·팔로워)
- [x] `core/types.ts`: `pendingRace`, `raceBests`
- [x] `systems/marathon.ts` 신규: `applyRace` / `resolveRace`(onNewDay) / 기록 계산(fitness + staminaMax)
- [x] `systems/time.ts`: onNewDay에 `resolveRace` 연결
- [x] `ui/offlineModal.ts`: 자기개발 탭에 대회 섹션(신청·대기·개인최고기록)
- [x] typecheck

## Task D: 바디프로필 도전 (운동)
- [x] `core/types.ts`: `bodyProfile: { startDay, gauge, binges } | null`
- [x] `systems/bodyProfile.ts` 신규: 시작/운동 적립/고칼로리 유혹/30일 판정
- [x] `systems/offline.ts`: 운동 → 게이지 적립, 휴식·외출·산책 → 고칼로리 롤
- [x] `systems/time.ts`: onNewDay 판정 훅
- [x] `ui/offlineModal.ts`: 게이지 진행바 + 도전 시작 버튼
- [x] typecheck

## Task E: 미용실 미니게임 (미용)
- [x] `data/hairSalon.ts` 신규: 스타일 대화 문항 풀 + 결과 문구
- [x] `systems/hairSalon.ts` 신규: 입장(비용·행동력·시간) + 등급별 보상 적용
- [x] `ui/hairSalonModal.ts` 신규: 타이밍 게이지 / 대화 견디기 랜덤 교대
- [x] `ui/offlineModal.ts`: 자기개발 탭에 미용실 진입
- [x] `styles/main.css`: 게이지·선택지 스타일
- [x] typecheck

## Task G: 진입로 변경 — 상시 메뉴 → 운동 중 제안 팝업 (사용자 지시)
바디프로필·마라톤은 현생 살기 목록에 상시 노출하지 않는다. **운동을 해야 기회가 온다.**
- [x] `systems/offline.ts`: `rollOffer`(운동 후 30%) + `OfflineOutcome.offer`
- [x] `ui/offlineModal.ts`: 결과 안내 → 제안 팝업(`showOffer`) 흐름, 섹션은 **진행 중일 때만** 표시
- [x] 회귀 테스트: 자격 없는 제안은 안 오고, 진행 중이면 재제안 없음

## Task F: 통합 검증
- [x] `npx vitest run --pool=forks` — 34파일 329테스트 통과
- [x] `npm run build`
- [x] 회귀 테스트 추가(`src/__tests__/domainPack.test.ts`)
- [x] 브라우저 확인: 자기개발 탭 · 미용실(대화/타이밍) · 여행 목적지 선택/결과
- [x] 밸런스 실측: 코스별 최소 스펙 완주 가능 / 만렙 입상 (`expectedRecord` 시뮬)
