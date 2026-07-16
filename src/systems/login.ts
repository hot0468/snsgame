import type { GameState } from "@/core/types";
import { getActiveAccount } from "@/core/state";

/**
 * 계정명 길이 상한. 계정명은 트윗 작성자·좌측 네비·프로필 헤더에 그대로 박히므로
 * 너무 길면 한 줄 레이아웃이 깨진다. 한글 기준으로 넉넉한 20자.
 */
export const LOGIN_NAME_MAX = 20;

/**
 * 계정 아이디(handle) 길이 상한. `@handle` 형태로 이름 옆에 붙어 렌더되므로 이름보다 짧아야 한다.
 * 실제 트위터와 같은 15자.
 */
export const LOGIN_HANDLE_MAX = 15;

/**
 * 계정 아이디 허용 문자. 영문·숫자·밑줄.
 * 근거: 기존 계정 생성 경로(systems/accountSystem.ts의 createNewAccount)가 이미
 * `/[^a-zA-Z0-9_]/`를 걸러내고 UI 플레이스홀더도 "핸들(영문/숫자)"라 안내한다.
 * 로그인만 다른 문자셋을 허용하면 두 경로가 어긋나므로 같은 규칙을 따른다.
 * 다만 createNewAccount는 조용히 제거(보정)하는 반면, 로그인은 사용자가 명시적으로 입력하는
 * 화면이라 **거부하고 이유를 알린다** — 입력한 아이디가 말없이 바뀌면 더 놀랍기 때문이다.
 */
const HANDLE_PATTERN = /^[a-zA-Z0-9_]+$/;

/** 입력값 검증 결과. ok가 false면 reason을 화면에 띄운다. */
export interface LoginResult {
  ok: boolean;
  reason?: string;
}

/**
 * 계정명·아이디를 확정하고 게임을 시작한다(loggedIn = true).
 * 기존 초기 계정을 수정한다 — 새로 만들지 않는다(activeAccountId 참조 유지).
 */
export function submitLogin(state: GameState, name: string, handle: string): LoginResult {
  const trimmedName = name.trim();
  if (!trimmedName) {
    return { ok: false, reason: "계정명을 입력해 주세요." };
  }
  if (trimmedName.length > LOGIN_NAME_MAX) {
    return { ok: false, reason: `계정명은 ${LOGIN_NAME_MAX}자까지 쓸 수 있어요.` };
  }

  // 사용자는 습관적으로 "@id"라고 적는다. 앞의 @는 표기일 뿐이라 벗겨낸 뒤 검증한다.
  // (@만 입력한 경우는 벗기면 빈 문자열이 되어 아래 빈값 검사에 걸린다.)
  const trimmedHandle = handle.trim().replace(/^@+/, "");
  if (!trimmedHandle) {
    return { ok: false, reason: "계정 아이디를 입력해 주세요." };
  }
  if (trimmedHandle.length > LOGIN_HANDLE_MAX) {
    return { ok: false, reason: `계정 아이디는 ${LOGIN_HANDLE_MAX}자까지 쓸 수 있어요.` };
  }
  if (!HANDLE_PATTERN.test(trimmedHandle)) {
    return { ok: false, reason: "계정 아이디는 영문·숫자·밑줄(_)만 쓸 수 있어요." };
  }

  // 새 계정을 만들지 않는다 — activeAccountId가 이미 이 계정을 가리키고 있어,
  // 새로 만들면 그 참조를 전부 갈아야 한다(계약서 참조).
  const account = getActiveAccount(state);
  account.name = trimmedName;
  account.handle = trimmedHandle;
  state.loggedIn = true;
  return { ok: true };
}
