// 프리텐다드 폰트는 index.html에서 CDN(jsDelivr)으로 로드한다.
import "./styles/main.css";
import { Store } from "./core/store";
import { createInitialState } from "./core/state";
import { loadGame, saveGame } from "./systems/save";
import { createApp } from "./ui/app";

const root = document.getElementById("app");
if (!root) throw new Error("#app 요소를 찾을 수 없습니다");

// 저장본이 있으면 이어서, 없으면 새 게임으로 시작
const initial = loadGame() ?? createInitialState();
const store = new Store(initial);

// 자동 저장: 상태가 바뀔 때마다 localStorage에 기록한다.
// (개발 중 HMR 리로드나 새로고침에도 진행분이 유지됨)
let saveTimer: number | undefined;
store.subscribe(() => {
  if (saveTimer !== undefined) return;
  saveTimer = window.setTimeout(() => {
    saveTimer = undefined;
    saveGame(store.getState());
  }, 300);
});
// 새로고침/HMR 리로드 직전, 디바운스 대기분까지 즉시 저장
window.addEventListener("beforeunload", () => saveGame(store.getState()));

createApp(root, store);
