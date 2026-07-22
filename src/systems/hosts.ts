import type { GameState } from "@/core/types";
import { HOSTS_LINES } from "@/data/dstory";

/**
 * hosts 파일 편집 → 로컬 도메인 매핑 규칙(순수 로직, DOM 무관).
 *
 * 메모장(ui/notepad.ts)이 hosts를 열면 `currentHosts`를 보여주고, 저장하면 `saveHosts`로
 * state.hostsFile에 넣는다. 주소창(ui/browser.ts)은 `hostsHasGoedam`으로 goedam.kr 매핑
 * 존재 여부를 판정해, 있으면 괴담 사이트(goedamSiteOpen)로 보낸다.
 *
 * ⚠️ 정답(기본 hosts 내용)의 단일 출처는 data/dstory의 `HOSTS_LINES`다 — 여기서 하드코딩하지 마라.
 */

/** 괴담 사이트 주소(주소창에 직접 입력하는 값). hosts에 매핑을 넣어야 실제로 열린다. */
export const GOEDAM_URL = "goedam.kr";

/** 편집된 hosts 내용(없으면 기본 HOSTS_LINES). */
export function currentHosts(state: GameState): string {
  return state.hostsFile ?? HOSTS_LINES.join("\n");
}

/** 메모장에서 hosts를 저장한다(편집 내용을 state에 영속화). */
export function saveHosts(state: GameState, text: string): void {
  state.hostsFile = text;
}

/**
 * hosts에 `<IPv4>  goedam.kr` 매핑 줄이 (주석 아닌 활성 줄로) 들어 있는지.
 * 진짜 hosts처럼 IP는 아무 IPv4나 허용한다(예시는 127.0.0.1). 줄 앞 '#' 주석은 제외한다.
 */
export function hostsHasGoedam(state: GameState): boolean {
  return currentHosts(state)
    .split("\n")
    .some((line) => /^\s*\d{1,3}(\.\d{1,3}){3}[ \t]+goedam\.kr\b/.test(line));
}
