export interface SeededRandom {
  next: () => number
  range: (minimum: number, maximum: number) => number
  int: (minimum: number, maximum: number) => number
}

export function seedToUint32(seed: string): number {
  let hash = 2166136261

  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }

  return hash >>> 0
}

export function createPrng(seed: string | number): SeededRandom {
  let state = typeof seed === 'string' ? seedToUint32(seed) : seed >>> 0

  const next = (): number => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }

  return {
    next,
    range: (minimum, maximum) => minimum + (maximum - minimum) * next(),
    int: (minimum, maximum) => Math.floor(minimum + (maximum - minimum + 1) * next()),
  }
}

export function hash2d(seed: number, x: number, z: number): number {
  let value = seed ^ Math.imul(x, 0x27d4eb2d) ^ Math.imul(z, 0x165667b1)
  value = Math.imul(value ^ (value >>> 15), value | 1)
  value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
  return ((value ^ (value >>> 14)) >>> 0) / 4294967296
}

export function smoothstep(value: number): number {
  return value * value * (3 - 2 * value)
}
