/** 프레임워크 없이 DOM을 다루기 위한 얇은 헬퍼. */

type AttrValue = string | number | boolean | undefined | EventListener;
type Attrs = Record<string, AttrValue>;
type Child = Node | string | null | undefined | false;

/**
 * 요소 생성 헬퍼.
 *   el("button", { class: "btn", onclick: fn }, "라벨")
 * on* 키는 이벤트 리스너로 등록된다.
 */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  ...children: Child[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") {
      node.addEventListener(key.slice(2).toLowerCase(), value as EventListener);
    } else if (key === "class") {
      node.className = String(value);
    } else if (key === "html") {
      node.innerHTML = String(value);
    } else {
      node.setAttribute(key, String(value));
    }
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return node;
}

/** 컨테이너를 비우고 새 자식들로 교체 */
export function mount(container: HTMLElement, ...children: Child[]): void {
  container.replaceChildren(
    ...children.filter((c): c is Node | string => c !== null && c !== undefined && c !== false)
      .map((c) => (c instanceof Node ? c : document.createTextNode(String(c)))),
  );
}

/** 1000 → "1,000" */
export function formatNumber(n: number): string {
  return n.toLocaleString("ko-KR");
}

/**
 * 가로 스크롤 컨테이너를 마우스 드래그/휠로 스와이프할 수 있게 한다.
 * - 포인터 드래그로 좌우 스크롤(드래그 중엔 내부 버튼 클릭이 취소됨).
 * - 세로 휠을 가로 스크롤로 변환.
 */
export function enableDragScroll(elm: HTMLElement): void {
  let down = false;
  let startX = 0;
  let startLeft = 0;
  let moved = false;
  let captured = false;

  elm.style.cursor = "grab";

  elm.addEventListener("pointerdown", (e) => {
    down = true;
    moved = false;
    captured = false;
    startX = e.clientX;
    startLeft = elm.scrollLeft;
  });
  elm.addEventListener("pointermove", (e) => {
    if (!down) return;
    const dx = e.clientX - startX;
    // 임계값을 넘겨 '드래그'로 판정된 순간에만 포인터를 캡처한다.
    // (즉시 캡처하면 단순 클릭이 자식 버튼에 전달되지 않아 선택이 안 됨)
    if (!moved && Math.abs(dx) > 4) {
      moved = true;
      elm.style.cursor = "grabbing";
      try {
        elm.setPointerCapture(e.pointerId);
        captured = true;
      } catch {
        /* 무시 */
      }
    }
    if (moved) elm.scrollLeft = startLeft - dx;
  });
  const release = (e: PointerEvent) => {
    if (!down) return;
    down = false;
    elm.style.cursor = "grab";
    if (captured) {
      captured = false;
      try {
        elm.releasePointerCapture(e.pointerId);
      } catch {
        /* 무시 */
      }
    }
  };
  elm.addEventListener("pointerup", release);
  elm.addEventListener("pointercancel", release);
  // 드래그였으면 자식 버튼 클릭(선택)을 취소한다.
  elm.addEventListener(
    "click",
    (e) => {
      if (moved) {
        e.stopPropagation();
        e.preventDefault();
        moved = false;
      }
    },
    true,
  );
  // 세로 휠 → 가로 스크롤
  elm.addEventListener(
    "wheel",
    (e) => {
      if (e.deltaY !== 0 && Math.abs(e.deltaY) >= Math.abs(e.deltaX)) {
        elm.scrollLeft += e.deltaY;
        e.preventDefault();
      }
    },
    { passive: false },
  );
}
