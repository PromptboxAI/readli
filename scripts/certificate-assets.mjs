#!/usr/bin/env node
/**
 * Builds src/lib/pdf/brand-assets.ts, the fonts and pictures the printable certificate embeds.
 *
 *   node scripts/certificate-assets.mjs <folder with Fredoka-*.ttf and NunitoSans-*.ttf>
 *
 * The fonts come from the brand kit (Fredoka and Nunito Sans, SIL Open Font License). Each one is
 * cut down to the glyphs WinAnsi can show, so a certificate stays small. The mascot and the book
 * covers come from public/. Needs ImageMagick (`convert`) on the PATH.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const fontDir = process.argv[2];
if (!fontDir) {
  console.error("Usage: node scripts/certificate-assets.mjs <fonts folder>");
  process.exit(1);
}

const FONTS = {
  display: "Fredoka-SemiBold.ttf",
  body: "NunitoSans-Regular.ttf",
  bold: "NunitoSans-Bold.ttf",
  heavy: "NunitoSans-ExtraBold.ttf",
};

const COVERS = ["alices-adventures-in-wonderland", "the-tale-of-peter-rabbit", "winnie-the-pooh"];

/** Unicode for WinAnsi codes 128 to 159 (0 where WinAnsi has nothing). */
const WIN_ANSI_HIGH = [
  0x20ac, 0, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6, 0x2030, 0x0160, 0x2039, 0x0152, 0, 0x017d, 0,
  0, 0x2018, 0x2019, 0x201c, 0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a, 0x0153, 0, 0x017e, 0x0178,
];
const winAnsiUnicode = (code) => (code >= 128 && code < 160 ? WIN_ANSI_HIGH[code - 128] : code);

function tables(buf) {
  const out = {};
  const count = buf.readUInt16BE(4);
  for (let i = 0; i < count; i++) {
    const at = 12 + i * 16;
    out[buf.toString("latin1", at, at + 4)] = buf.subarray(buf.readUInt32BE(at + 8), buf.readUInt32BE(at + 8) + buf.readUInt32BE(at + 12));
  }
  return out;
}

/** Unicode to glyph id, from the (3,1) format 4 cmap. */
function cmap4(cmap) {
  const n = cmap.readUInt16BE(2);
  for (let i = 0; i < n; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const encoding = cmap.readUInt16BE(6 + i * 8);
    const off = cmap.readUInt32BE(8 + i * 8);
    if (platform !== 3 || encoding !== 1 || cmap.readUInt16BE(off) !== 4) continue;
    const t = cmap.subarray(off);
    const segs = t.readUInt16BE(6) / 2;
    const ends = 14, starts = ends + segs * 2 + 2, deltas = starts + segs * 2, ranges = deltas + segs * 2;
    return (u) => {
      for (let s = 0; s < segs; s++) {
        const end = t.readUInt16BE(ends + s * 2);
        if (u > end) continue;
        const start = t.readUInt16BE(starts + s * 2);
        if (u < start) return 0;
        const delta = t.readInt16BE(deltas + s * 2);
        const range = t.readUInt16BE(ranges + s * 2);
        if (!range) return (u + delta) & 0xffff;
        const g = t.readUInt16BE(ranges + s * 2 + range + (u - start) * 2);
        return g ? (g + delta) & 0xffff : 0;
      }
      return 0;
    };
  }
  throw new Error("no (3,1) format 4 cmap");
}

function checksum(buf) {
  const padded = Buffer.concat([buf, Buffer.alloc((4 - (buf.length % 4)) % 4)]);
  let sum = 0;
  for (let i = 0; i < padded.length; i += 4) sum = (sum + padded.readUInt32BE(i)) >>> 0;
  return sum;
}

/** The font with only the WinAnsi glyphs (and their components) left in glyf, plus its PDF metrics. */
function subsetFont(file) {
  const buf = readFileSync(join(fontDir, file));
  const t = tables(buf);
  const head = Buffer.from(t.head);
  const unitsPerEm = head.readUInt16BE(18);
  const longLoca = head.readInt16BE(50) === 1;
  const numGlyphs = t.maxp.readUInt16BE(4);
  const loca = (g) => (longLoca ? t.loca.readUInt32BE(g * 4) : t.loca.readUInt16BE(g * 2) * 2);
  const lookup = cmap4(t.cmap);

  const keep = new Set([0]);
  const glyphFor = [];
  for (let code = 32; code <= 255; code++) {
    const u = winAnsiUnicode(code);
    const g = u ? lookup(u) : 0;
    glyphFor.push(g);
    if (g) keep.add(g);
  }
  const queue = [...keep];
  while (queue.length) {
    const g = queue.pop();
    const glyph = t.glyf.subarray(loca(g), loca(g + 1));
    if (glyph.length < 10 || glyph.readInt16BE(0) >= 0) continue;
    let at = 10;
    for (;;) {
      const flags = glyph.readUInt16BE(at);
      const part = glyph.readUInt16BE(at + 2);
      if (!keep.has(part)) keep.add(part), queue.push(part);
      at += 4 + (flags & 1 ? 4 : 2) + (flags & 8 ? 2 : flags & 0x40 ? 4 : flags & 0x80 ? 8 : 0);
      if (!(flags & 0x20)) break;
    }
  }

  const glyfParts = [];
  const newLoca = Buffer.alloc((numGlyphs + 1) * 4);
  let offset = 0;
  for (let g = 0; g < numGlyphs; g++) {
    newLoca.writeUInt32BE(offset, g * 4);
    if (!keep.has(g)) continue;
    const glyph = t.glyf.subarray(loca(g), loca(g + 1));
    const padded = Buffer.concat([glyph, Buffer.alloc((4 - (glyph.length % 4)) % 4)]);
    glyfParts.push(padded);
    offset += padded.length;
  }
  newLoca.writeUInt32BE(offset, numGlyphs * 4);
  head.writeInt16BE(1, 50);
  head.writeUInt32BE(0, 8);
  const post = Buffer.from(t.post.subarray(0, 32));
  post.writeUInt32BE(0x00030000, 0);

  const out = { cmap: t.cmap, glyf: Buffer.concat(glyfParts), head, hhea: t.hhea, hmtx: t.hmtx, loca: newLoca, maxp: t.maxp, name: t.name, "OS/2": t["OS/2"], post };
  for (const extra of ["cvt ", "fpgm", "prep", "gasp"]) if (t[extra]) out[extra] = t[extra];
  const tags = Object.keys(out).sort();
  const dir = Buffer.alloc(12 + tags.length * 16);
  dir.writeUInt32BE(0x00010000, 0);
  dir.writeUInt16BE(tags.length, 4);
  const pow = 2 ** Math.floor(Math.log2(tags.length));
  dir.writeUInt16BE(pow * 16, 6);
  dir.writeUInt16BE(Math.log2(pow), 8);
  dir.writeUInt16BE(tags.length * 16 - pow * 16, 10);
  const bodies = [];
  let at = dir.length;
  tags.forEach((tag, i) => {
    const data = out[tag];
    dir.write(tag, 12 + i * 16, "latin1");
    dir.writeUInt32BE(checksum(data), 16 + i * 16);
    dir.writeUInt32BE(at, 20 + i * 16);
    dir.writeUInt32BE(data.length, 24 + i * 16);
    const padded = Buffer.concat([data, Buffer.alloc((4 - (data.length % 4)) % 4)]);
    bodies.push(padded);
    at += padded.length;
  });
  const font = Buffer.concat([dir, ...bodies]);
  const headAt = dir.readUInt32BE(20 + tags.indexOf("head") * 16);
  font.writeUInt32BE((0xb1b0afba - checksum(font)) >>> 0, headAt + 8);

  const numHMetrics = t.hhea.readUInt16BE(34);
  const advance = (g) => t.hmtx.readUInt16BE(Math.min(g, numHMetrics - 1) * 4);
  const scale = (v) => Math.round((v * 1000) / unitsPerEm);
  const widths = glyphFor.map((g, i) => (g || i === 0 ? scale(advance(g)) : 0));
  const os2 = t["OS/2"];
  const name = file.replace(/\.ttf$/, "");
  return {
    name,
    widths,
    ascent: scale(t.hhea.readInt16BE(4)),
    descent: scale(t.hhea.readInt16BE(6)),
    capHeight: scale(os2.length >= 90 ? os2.readInt16BE(88) : t.hhea.readInt16BE(4)),
    bbox: [36, 38, 40, 42].map((o) => scale(head.readInt16BE(o))),
    data: deflateSync(font, { level: 9 }).toString("base64"),
    length: font.length,
  };
}

function magick(args) {
  return execFileSync("convert", args, { maxBuffer: 64 * 1024 * 1024 });
}

/** An RGB image with its alpha channel as a separate soft mask, both deflated, at `width` pixels wide. */
function maskedImage(file, width) {
  const size = magick([file, "-resize", `${width}x`, "-format", "%w %h", "info:"]).toString().trim().split(" ").map(Number);
  const rgb = magick([file, "-resize", `${width}x`, "-background", "#FFF9ED", "-alpha", "remove", "-depth", "8", "rgb:-"]);
  const alpha = magick([file, "-resize", `${width}x`, "-alpha", "extract", "-depth", "8", "gray:-"]);
  return { width: size[0], height: size[1], rgb: deflateSync(rgb, { level: 9 }).toString("base64"), alpha: deflateSync(alpha, { level: 9 }).toString("base64") };
}

function jpeg(file, width) {
  const data = magick([file, "-resize", `${width}x`, "-strip", "-sampling-factor", "4:2:0", "-quality", "84", "jpg:-"]);
  const dims = execFileSync("identify", ["-format", "%w %h", "jpg:-"], { input: data }).toString().trim().split(" ").map(Number);
  return { width: dims[0], height: dims[1], jpeg: data.toString("base64") };
}

const fonts = Object.fromEntries(Object.entries(FONTS).map(([key, file]) => [key, subsetFont(file)]));
const mascot = maskedImage("public/brand/readi-rest.webp", 300);
const covers = COVERS.map((slug) => ({ slug, ...jpeg(`public/covers/${slug}.webp`, 300) }));

const lines = [
  "/**",
  " * Generated by scripts/certificate-assets.mjs: do not edit by hand.",
  " * Fonts: Fredoka and Nunito Sans (SIL Open Font License), cut down to the WinAnsi glyphs, deflated.",
  " * Widths are per 1000 units for WinAnsi codes 32 to 255; 0 marks a code the font can't show.",
  " */",
  "export interface EmbeddedFont { name: string; widths: number[]; ascent: number; descent: number; capHeight: number; bbox: number[]; data: string; length: number }",
  `export const BRAND_FONTS: Record<"display" | "body" | "bold" | "heavy", EmbeddedFont> = ${JSON.stringify(fonts)};`,
  `export const MASCOT = ${JSON.stringify(mascot)};`,
  `export const COVERS = ${JSON.stringify(covers)};`,
  "",
];
writeFileSync("src/lib/pdf/brand-assets.ts", lines.join("\n"));
for (const f of Object.values(fonts)) console.log(f.name, f.length, "bytes,", f.data.length, "base64");
console.log("mascot", mascot.width, mascot.height, "covers", covers.map((c) => `${c.width}x${c.height} ${c.jpeg.length}`).join(", "));
