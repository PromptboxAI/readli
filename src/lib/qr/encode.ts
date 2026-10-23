/**
 * A small QR code encoder (ISO/IEC 18004) for complimentary membership links: byte mode, versions
 * 1 to 10, error correction M or Q. Readli encodes short claim URLs only, so this covers them without
 * a dependency. No imports, so it runs anywhere (server routes, tests, the browser).
 */
export type QrEcc = "M" | "Q";

export interface QrCode {
  version: number;
  size: number;
  /** modules[y][x], true = dark. */
  modules: boolean[][];
}

const ECC_BLOCK_LEN: Record<QrEcc, number[]> = {
  M: [10, 16, 26, 18, 24, 16, 18, 22, 22, 26],
  Q: [13, 22, 18, 26, 18, 24, 18, 22, 20, 24],
};
const ECC_BLOCKS: Record<QrEcc, number[]> = {
  M: [1, 1, 1, 2, 2, 4, 4, 4, 5, 5],
  Q: [1, 1, 2, 2, 4, 4, 6, 6, 8, 8],
};
const ECC_FORMAT_BITS: Record<QrEcc, number> = { M: 0, Q: 3 };
const MAX_VERSION = 10;

function rawDataModules(ver: number): number {
  let result = (16 * ver + 128) * ver + 64;
  if (ver >= 2) {
    const numAlign = Math.floor(ver / 7) + 2;
    result -= (25 * numAlign - 10) * numAlign - 55;
    if (ver >= 7) result -= 36;
  }
  return result;
}

function dataCodewords(ver: number, ecc: QrEcc): number {
  return Math.floor(rawDataModules(ver) / 8) - ECC_BLOCK_LEN[ecc][ver - 1]! * ECC_BLOCKS[ecc][ver - 1]!;
}

function alignmentPositions(ver: number): number[] {
  if (ver === 1) return [];
  const size = ver * 4 + 17;
  const numAlign = Math.floor(ver / 7) + 2;
  const step = Math.floor((ver * 8 + numAlign * 3 + 5) / (numAlign * 4 - 4)) * 2;
  const result = [6];
  for (let pos = size - 7; result.length < numAlign; pos -= step) result.splice(1, 0, pos);
  return result;
}

function gfMul(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

function rsDivisor(degree: number): number[] {
  const result = new Array<number>(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMul(result[j]!, root);
      if (j + 1 < result.length) result[j]! ^= result[j + 1]!;
    }
    root = gfMul(root, 0x02);
  }
  return result;
}

function rsRemainder(data: number[], divisor: number[]): number[] {
  const result = new Array<number>(divisor.length).fill(0);
  for (const b of data) {
    const factor = b ^ result.shift()!;
    result.push(0);
    divisor.forEach((coef, i) => (result[i]! ^= gfMul(coef, factor)));
  }
  return result;
}

const bit = (x: number, i: number) => ((x >>> i) & 1) !== 0;

function encodeData(bytes: Uint8Array, ver: number, ecc: QrEcc): number[] {
  const bits: number[] = [];
  const push = (val: number, len: number) => {
    for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1);
  };
  push(0b0100, 4);
  push(bytes.length, ver <= 9 ? 8 : 16);
  for (const b of bytes) push(b, 8);
  const capacity = dataCodewords(ver, ecc) * 8;
  push(0, Math.min(4, capacity - bits.length));
  push(0, (8 - (bits.length % 8)) % 8);
  for (let pad = 0xec; bits.length < capacity; pad ^= 0xec ^ 0x11) push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < bits.length; i += 8) out.push(bits.slice(i, i + 8).reduce((a, b) => (a << 1) | b, 0));
  return out;
}

function addEccAndInterleave(data: number[], ver: number, ecc: QrEcc): number[] {
  const numBlocks = ECC_BLOCKS[ecc][ver - 1]!;
  const eccLen = ECC_BLOCK_LEN[ecc][ver - 1]!;
  const raw = Math.floor(rawDataModules(ver) / 8);
  const numShort = numBlocks - (raw % numBlocks);
  const shortLen = Math.floor(raw / numBlocks);
  const divisor = rsDivisor(eccLen);
  const blocks: number[][] = [];
  for (let i = 0, k = 0; i < numBlocks; i++) {
    const dat = data.slice(k, k + shortLen - eccLen + (i < numShort ? 0 : 1));
    k += dat.length;
    const block = [...dat];
    if (i < numShort) block.push(0);
    blocks.push(block.concat(rsRemainder(dat, divisor)));
  }
  const result: number[] = [];
  for (let i = 0; i < blocks[0]!.length; i++) {
    blocks.forEach((block, j) => {
      if (i !== shortLen - eccLen || j >= numShort) result.push(block[i]!);
    });
  }
  return result;
}

class Grid {
  readonly modules: boolean[][];
  readonly isFunction: boolean[][];
  readonly size: number;
  constructor(size: number) {
    this.size = size;
    this.modules = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
    this.isFunction = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  }
  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y]![x] = dark;
    this.isFunction[y]![x] = true;
  }
}

function drawFunctionPatterns(g: Grid, ver: number) {
  const size = g.size;
  for (let i = 0; i < size; i++) {
    g.setFunction(6, i, i % 2 === 0);
    g.setFunction(i, 6, i % 2 === 0);
  }
  for (const [cx, cy] of [
    [3, 3],
    [size - 4, 3],
    [3, size - 4],
  ] as const) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const x = cx + dx;
        const y = cy + dy;
        if (x >= 0 && x < size && y >= 0 && y < size) g.setFunction(x, y, dist !== 2 && dist !== 4);
      }
    }
  }
  const pos = alignmentPositions(ver);
  const last = pos.length - 1;
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue;
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) g.setFunction(pos[i]! + dx, pos[j]! + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
      }
    }
  }
  drawFormatBits(g, "M", 0);
  if (ver >= 7) {
    let rem = ver;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (ver << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      g.setFunction(a, b, bit(bits, i));
      g.setFunction(b, a, bit(bits, i));
    }
  }
}

function drawFormatBits(g: Grid, ecc: QrEcc, mask: number) {
  const size = g.size;
  const data = (ECC_FORMAT_BITS[ecc] << 3) | mask;
  let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  const bits = ((data << 10) | rem) ^ 0x5412;
  for (let i = 0; i <= 5; i++) g.setFunction(8, i, bit(bits, i));
  g.setFunction(8, 7, bit(bits, 6));
  g.setFunction(8, 8, bit(bits, 7));
  g.setFunction(7, 8, bit(bits, 8));
  for (let i = 9; i < 15; i++) g.setFunction(14 - i, 8, bit(bits, i));
  for (let i = 0; i < 8; i++) g.setFunction(size - 1 - i, 8, bit(bits, i));
  for (let i = 8; i < 15; i++) g.setFunction(8, size - 15 + i, bit(bits, i));
  g.setFunction(8, size - 8, true);
}

function drawCodewords(g: Grid, data: number[]) {
  const size = g.size;
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j;
        const upward = ((right + 1) & 2) === 0;
        const y = upward ? size - 1 - vert : vert;
        if (!g.isFunction[y]![x] && i < data.length * 8) {
          g.modules[y]![x] = bit(data[i >>> 3]!, 7 - (i & 7));
          i++;
        }
      }
    }
  }
}

const MASKS: ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0,
];

function applyMask(g: Grid, mask: number) {
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.isFunction[y]![x] && MASKS[mask]!(x, y)) g.modules[y]![x] = !g.modules[y]![x];
    }
  }
}

/** The standard's four penalty rules; the lowest-scoring mask is used. */
export function penalty(m: boolean[][]): number {
  const size = m.length;
  let score = 0;
  const lines: boolean[][] = [];
  for (let y = 0; y < size; y++) lines.push(m[y]!);
  for (let x = 0; x < size; x++) lines.push(m.map((row) => row[x]!));
  const finderLike = [
    [true, false, true, true, true, false, true, false, false, false, false],
    [false, false, false, false, true, false, true, true, true, false, true],
  ];
  for (const line of lines) {
    let run = 1;
    for (let i = 1; i <= size; i++) {
      if (i < size && line[i] === line[i - 1]) run++;
      else {
        if (run >= 5) score += 3 + (run - 5);
        run = 1;
      }
    }
    for (let i = 0; i + 11 <= size; i++) {
      for (const pat of finderLike) if (pat.every((v, k) => line[i + k] === v)) score += 40;
    }
  }
  for (let y = 0; y + 1 < size; y++) {
    for (let x = 0; x + 1 < size; x++) {
      const c = m[y]![x];
      if (m[y]![x + 1] === c && m[y + 1]![x] === c && m[y + 1]![x + 1] === c) score += 3;
    }
  }
  const dark = m.reduce((n, row) => n + row.filter(Boolean).length, 0);
  const total = size * size;
  score += Math.floor(Math.abs(dark * 20 - total * 10) / total) * 10;
  return score;
}

/** Encodes text as UTF-8 in the smallest version that fits. Throws if it needs more than version 10. */
export function encodeQr(text: string, ecc: QrEcc = "M"): QrCode {
  const bytes = new TextEncoder().encode(text);
  let ver = 1;
  for (; ver <= MAX_VERSION; ver++) {
    const header = 4 + (ver <= 9 ? 8 : 16);
    if (header + bytes.length * 8 <= dataCodewords(ver, ecc) * 8) break;
  }
  if (ver > MAX_VERSION) throw new Error("QR text too long");
  const codewords = addEccAndInterleave(encodeData(bytes, ver, ecc), ver, ecc);
  const size = ver * 4 + 17;
  let best: Grid | null = null;
  let bestScore = Infinity;
  for (let mask = 0; mask < 8; mask++) {
    const g = new Grid(size);
    drawFunctionPatterns(g, ver);
    drawCodewords(g, codewords);
    applyMask(g, mask);
    drawFormatBits(g, ecc, mask);
    const score = penalty(g.modules);
    if (score < bestScore) {
      best = g;
      bestScore = score;
    }
  }
  return { version: ver, size, modules: best!.modules };
}
