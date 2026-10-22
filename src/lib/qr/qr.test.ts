import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodeQr } from "./encode";
import { qrPng, qrSvg, QUIET_MODULES } from "./render";

/** Reads the 15-bit format word from its first copy around the top-left finder. */
function formatWord(m: boolean[][]): number {
  const cells: [number, number][] = [];
  for (let i = 0; i <= 5; i++) cells.push([8, i]);
  cells.push([8, 7], [8, 8], [7, 8]);
  for (let i = 9; i < 15; i++) cells.push([14 - i, 8]);
  return cells.reduce((w, [x, y], i) => w | ((m[y]![x] ? 1 : 0) << i), 0);
}

function bchValid(word: number): boolean {
  let rem = (word ^ 0x5412) >>> 0;
  for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10);
  return rem === 0;
}

describe("QR codes", () => {
  it("pick the smallest version for a claim link, with finders, timing and a valid format word", () => {
    const qr = encodeQr("https://readli.ai/claim#ABCD-EFGH-JKMN");
    expect(qr.version).toBe(3);
    expect(qr.size).toBe(29);
    for (const [cx, cy] of [
      [3, 3],
      [qr.size - 4, 3],
      [3, qr.size - 4],
    ]) {
      expect(qr.modules[cy]![cx]).toBe(true);
      expect(qr.modules[cy - 2]![cx]).toBe(false);
      expect(qr.modules[cy - 3]![cx]).toBe(true);
    }
    for (let i = 8; i < qr.size - 8; i++) expect(qr.modules[6]![i]).toBe(i % 2 === 0);
    const word = formatWord(qr.modules);
    expect(bchValid(word)).toBe(true);
    expect(((word ^ 0x5412) >>> 13) & 3).toBe(0);
  });

  it("are the same every time for the same link and differ between links", () => {
    const a = encodeQr("https://readli.ai/claim#ABCD-EFGH-JKMN");
    const b = encodeQr("https://readli.ai/claim#ABCD-EFGH-JKMN");
    const c = encodeQr("https://readli.ai/claim#ABCD-EFGH-JKMP");
    expect(a.modules).toEqual(b.modules);
    expect(a.modules).not.toEqual(c.modules);
  });

  it("grow for longer links and refuse what won't fit", () => {
    expect(encodeQr("x".repeat(100)).version).toBeGreaterThan(4);
    expect(encodeQr("x".repeat(120), "Q").version).toBe(9);
    expect(() => encodeQr("x".repeat(400))).toThrow();
  });

  it("render as a crisp PNG with a quiet zone and as SVG", () => {
    const qr = encodeQr("https://readli.ai/claim#ABCD-EFGH-JKMN");
    const png = qrPng(qr);
    expect(png.subarray(1, 4).toString("latin1")).toBe("PNG");
    const width = png.readUInt32BE(16);
    const full = qr.size + QUIET_MODULES * 2;
    expect(width % full).toBe(0);
    expect(width).toBeGreaterThanOrEqual(1100);
    const idat = png.indexOf("IDAT");
    const raw = inflateSync(png.subarray(idat + 4, idat + 4 + png.readUInt32BE(idat - 4)));
    expect(raw.length).toBe((width + 1) * width);
    const scale = width / full;
    const half = Math.floor(scale / 2);
    const px = (mx: number, my: number) => raw[(my * scale + half) * (width + 1) + 1 + mx * scale + half];
    expect(px(0, 0)).toBe(0xff);
    expect(px(QUIET_MODULES, QUIET_MODULES)).toBe(0);
    const svg = qrSvg(qr, "Readli gift MEB-001");
    expect(svg).toContain(`viewBox="0 0 ${full} ${full}"`);
    expect(svg).toContain("<title>Readli gift MEB-001</title>");
  });
});
