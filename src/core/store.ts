import type { GameState } from "./types";

type Listener = (state: GameState) => void;
type Updater = (draft: GameState) => void;

/**
 * 아주 작은 반응형 스토어.
 * - 프레임워크 없이 상태 변경 → 구독자 재렌더 패턴만 제공한다.
 * - UI는 getState()로 읽고, dispatch()로 바꾸고, subscribe()로 갱신을 듣는다.
 */
export class Store {
  private state: GameState;
  private listeners = new Set<Listener>();
  private notifyScheduled = false;

  constructor(initial: GameState) {
    this.state = initial;
  }

  getState(): GameState {
    return this.state;
  }

  /** 상태를 직접 변형(mutate)하고 재렌더를 예약한다. */
  dispatch(updater: Updater): void {
    updater(this.state);
    this.scheduleNotify();
  }

  /** 스토어 전체를 교체(불러오기 등). */
  replace(next: GameState): void {
    this.state = next;
    this.scheduleNotify();
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 같은 tick 안의 여러 dispatch를 한 번의 렌더로 합친다. */
  private scheduleNotify(): void {
    if (this.notifyScheduled) return;
    this.notifyScheduled = true;
    queueMicrotask(() => {
      this.notifyScheduled = false;
      for (const l of this.listeners) l(this.state);
    });
  }
}
