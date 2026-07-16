import type { GameContext } from "./context";
import {
  LOGIN_HANDLE_MAX,
  LOGIN_NAME_MAX,
  submitLogin,
  type LoginResult,
} from "@/systems/login";
import { el } from "@/utils/dom";

// snsView.ts의 브랜드 로고와 같은 모양(그쪽은 모듈 내부 const라 export되지 않아 여기서 다시 둔다).
const X_LOGO =
  `<svg viewBox="0 0 24 24" width="34" height="34" fill="currentColor" aria-hidden="true">` +
  `<path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68` +
  `l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>`;

/**
 * 게임의 첫 화면 — 계정명·아이디를 입력해 로그인한다(모달 아님, 전체 화면).
 *
 * 이 노드는 app.ts가 캐시해 재사용한다(모달 노드 캐시와 같은 이유):
 * 입력 도중 재렌더가 돌아도 입력값·에러 문구가 날아가지 않아야 한다.
 * 따라서 내부 상태는 이 클로저가 들고, 갱신은 paint()로만 한다.
 */
export function renderLoginScreen(ctx: GameContext): HTMLElement {
  const container = el("div", { class: "login" });

  let error: string | null = null;

  const nameInput = el("input", {
    class: "dm__input",
    type: "text",
    placeholder: "계정명",
    autocomplete: "off",
    maxlength: LOGIN_NAME_MAX,
  }) as HTMLInputElement;

  const handleInput = el("input", {
    class: "dm__input",
    type: "text",
    placeholder: "계정 아이디",
    autocomplete: "off",
    spellcheck: "false",
    autocapitalize: "off",
    // +1은 앞에 붙이는 "@" 몫. submitLogin이 선행 @를 벗겨낸 뒤 길이를 재므로,
    // 상한 그대로 걸면 "@" + 15자를 치는 사람이 한 글자 손해를 본다.
    maxlength: LOGIN_HANDLE_MAX + 1,
  }) as HTMLInputElement;

  function submit(): void {
    // 규칙(검증·계정 반영·loggedIn 전환)은 systems가 판단한다. UI는 결과만 표시.
    // dispatch는 updater를 동기로 실행하므로 result는 update 직후 확정된다.
    let result: LoginResult = { ok: false };
    ctx.update((s) => {
      result = submitLogin(s, nameInput.value, handleInput.value);
    });

    if (result.ok) return; // loggedIn=true → app이 본 화면으로 넘어간다.
    error = result.reason ?? "로그인하지 못했어요. 입력값을 확인해 주세요.";
    paint();
  }

  function field(label: string, input: HTMLInputElement, hint?: string): HTMLElement {
    return el(
      "label",
      { class: "login__field" },
      el("span", { class: "login__label" }, label),
      el("div", { class: "login__input-row" }, input),
      hint ? el("span", { class: "login__hint" }, hint) : null,
    );
  }

  function paint(): void {
    // form + type=submit 버튼 → 어느 입력칸에서든 Enter로 제출된다(브라우저 기본 동작).
    const form = el(
      "form",
      {
        class: "login__form",
        onsubmit: (e: Event) => {
          e.preventDefault();
          submit();
        },
      },
      field("계정명", nameInput, "SNS에 표시될 이름이에요."),
      field("계정 아이디", handleInput, "영문·숫자·밑줄(_)만 쓸 수 있어요."),
      error ? el("p", { class: "login__error", role: "alert" }, error) : null,
      el("button", { class: "btn login__submit", type: "submit" }, "로그인"),
    );

    container.replaceChildren(
      el(
        "div",
        { class: "login__card" },
        el("div", { class: "login__brand", html: X_LOGO }),
        el("h1", { class: "login__title" }, "지금 시작하기"),
        el("p", { class: "login__sub" }, "계정명과 아이디를 정하면 첫 트윗을 쓸 수 있어요."),
        form,
      ),
    );
  }

  paint();
  // 첫 진입 시 계정명 칸에 커서를 둔다(이후 paint에서는 포커스를 빼앗지 않는다).
  queueMicrotask(() => nameInput.focus());
  return container;
}
