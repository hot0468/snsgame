/** 난수 유틸 모음. 나중에 시드 고정이 필요하면 이 파일만 교체하면 된다. */

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** 배열에서 중복 없이 n개 뽑기 */
export function sample<T>(arr: readonly T[], n: number): T[] {
  const copy = [...arr];
  const out: T[] = [];
  while (out.length < n && copy.length > 0) {
    const i = Math.floor(Math.random() * copy.length);
    out.push(copy.splice(i, 1)[0]);
  }
  return out;
}

export function chance(p: number): boolean {
  return Math.random() < p;
}

/**
 * 문자열 시드 → 32bit 정수 해시(결정론적).
 *
 * ⚠️ ui/shop.ts의 `h*31 + c` 곱셈 해시를 그대로 쓰면 안 된다. 그 방식은 선형이라
 *    시드가 `${id}:${day}` 꼴일 때 day만 바뀌면 모든 후보의 해시에 '같은 상수'가 더해진다.
 *    상수 덧셈은 mod 2^32에서 순서를 거의 보존하므로(오버플로로 되감기는 소수만 예외)
 *    날짜가 바뀌어도 상위 슬롯이 특정 항목에 고정돼 버린다.
 *    그래서 마지막에 murmur3 방식의 아발란치 믹싱으로 선형성을 깬다.
 */
export function hashInt(seed: string): number {
  let h = 2166136261; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0; // FNV-1a
  }
  // murmur3 fmix32 — 입력 1비트 변화가 출력 전 비트로 퍼진다.
  h ^= h >>> 16;
  h = Math.imul(h, 2246822507) >>> 0;
  h ^= h >>> 13;
  h = Math.imul(h, 3266489909) >>> 0;
  h ^= h >>> 16;
  return h >>> 0;
}

/**
 * 해시를 0 이상 1 미만의 균등 실수로 환산한다(hashInt는 32bit 부호 없는 정수).
 * 확률 판정에 Math.random 대신 쓰는 결정론적 대체물.
 */
export function hashUnit(seed: string): number {
  return hashInt(seed) / 2 ** 32;
}

let idCounter = 0;
/** 세션 내 고유 id 생성 */
export function uid(prefix = "id"): string {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}_${idCounter}`;
}
