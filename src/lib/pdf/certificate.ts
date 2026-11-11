import { deflateSync } from "node:zlib";
import type { QrCode } from "@/lib/qr/encode";
import { QUIET_MODULES } from "@/lib/qr/render";
import { LOGO, WIN_ANSI_EXTRA } from "./assets";
import { BRAND_FONTS, COVERS, MASCOT } from "./brand-assets";

/**
 * The printable complimentary membership certificate: one US Letter page (8.5 × 11 in) in the
 * Readli brand fonts (Fredoka and Nunito Sans, embedded), with Readi, a few storybook covers and
 * a short "what's inside" so whoever wins it at a raffle knows what it is. The QR code is drawn
 * module by module from the same claim link as the manual code printed beside it.
 */
export interface CertificateInput {
  headline: string;
  presentedLine: string;
  message: string | null;
  qr: QrCode;
  code: string;
  claimHost: string;
  termLine: string;
  claimByLine: string;
  certificateLabel: string;
  /** Above the headline; "GIFT CERTIFICATE" unless set. */
  eyebrow?: string;
  /** Short lines under the presented line, e.g. "Proudly supporting Oak Street PTA". */
  extraLines?: string[];
  /** The bold line beside the QR code. */
  scanLine?: string;
  /** Where to type the code; "/claim" unless set. */
  claimPath?: string;
  /** Small print along the bottom of the page. */
  finePrint?: string;
  /** A short line at the very bottom; "Every Book. Every Voice." unless set. */
  tagline?: string;
}

/** body: Nunito Sans Regular, bold: Bold, heavy: ExtraBold, display: Fredoka SemiBold. */
export type Font = keyof typeof BRAND_FONTS;
const FONT_KEYS = Object.keys(BRAND_FONTS) as Font[];
const fontRes = (f: Font) => `F${FONT_KEYS.indexOf(f) + 1}`;

const PAGE_W = 612;
const PAGE_H = 792;

type RGB = readonly [number, number, number];
const hex = (h: number): RGB => [(h >> 16) & 255, (h >> 8) & 255, h & 255];
const IVORY = hex(0xfff9ed);
/** `c` laid over ivory at `amount` (0 to 1), for the soft color fields. */
const tint = (c: RGB, amount: number): RGB => c.map((v, i) => Math.round(IVORY[i]! + (v - IVORY[i]!) * amount)) as unknown as RGB;

const COLORS = {
  ink: hex(0x283548),
  ivory: IVORY,
  coral: hex(0xff7967),
  coralDeep: hex(0xc9402f),
  sunshine: hex(0xffce58),
  sky: hex(0x7bc7f3),
  mint: hex(0x9ce2bc),
  lavender: hex(0xcbb7f5),
  plum: hex(0x44354f),
  muted: hex(0x5b6676),
  white: hex(0xffffff),
  black: hex(0x000000),
  skySoft: tint(hex(0x7bc7f3), 0.28),
  sunSoft: tint(hex(0xffce58), 0.35),
  mintSoft: tint(hex(0x9ce2bc), 0.45),
  lavenderSoft: tint(hex(0xcbb7f5), 0.4),
} as const;
type Color = keyof typeof COLORS;

const rgb = (c: Color) => COLORS[c].map((v) => (v / 255).toFixed(3)).join(" ");
const n = (v: number) => (Math.round(v * 100) / 100).toString();

/** WinAnsi bytes for a string; characters it can't show become "?". */
export function winAnsi(text: string): number[] {
  return [...text].map((ch) => {
    const code = ch.codePointAt(0)!;
    if (WIN_ANSI_EXTRA[ch] !== undefined) return WIN_ANSI_EXTRA[ch]!;
    if ((code >= 32 && code < 127) || (code >= 160 && code <= 255)) return code;
    return 63;
  });
}

export function textWidth(text: string, font: Font, size: number, tracking = 0): number {
  const widths = BRAND_FONTS[font].widths;
  const bytes = winAnsi(text);
  return bytes.reduce((w, b) => w + (widths[b - 32] || widths[63 - 32]!), 0) * (size / 1000) + tracking * bytes.length;
}

function pdfString(text: string): string {
  return winAnsi(text)
    .map((b) => (b === 0x28 || b === 0x29 || b === 0x5c ? `\\${String.fromCharCode(b)}` : b < 127 ? String.fromCharCode(b) : `\\${b.toString(8).padStart(3, "0")}`))
    .join("");
}

/** Greedy word wrap to `max` points wide. */
export function wrap(text: string, font: Font, size: number, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && textWidth(next, font, size) > max) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** Shrinks `size` until `text` fits in `max` points, down to `min`. */
function fit(text: string, font: Font, size: number, max: number, min: number, tracking = 0): number {
  while (size > min && textWidth(text, font, size, tracking) > max) size -= 0.5;
  return size;
}

class Canvas {
  readonly ops: string[] = [];

  fill(color: Color) {
    this.ops.push(`${rgb(color)} rg`);
  }
  stroke(color: Color, width: number, dash?: [number, number]) {
    this.ops.push(`${rgb(color)} RG ${n(width)} w ${dash ? `[${dash.map(n).join(" ")}] 0 d` : "[] 0 d"} 1 J`);
  }
  /** A rounded rectangle whose top edge is `top` points below the top of the page. */
  roundRect(x: number, top: number, w: number, h: number, r: number) {
    const y = PAGE_H - top - h;
    const k = r * 0.5523;
    this.ops.push(
      `${n(x + r)} ${n(y)} m ${n(x + w - r)} ${n(y)} l ${n(x + w - r + k)} ${n(y)} ${n(x + w)} ${n(y + r - k)} ${n(x + w)} ${n(y + r)} c`,
      `${n(x + w)} ${n(y + h - r)} l ${n(x + w)} ${n(y + h - r + k)} ${n(x + w - r + k)} ${n(y + h)} ${n(x + w - r)} ${n(y + h)} c`,
      `${n(x + r)} ${n(y + h)} l ${n(x + r - k)} ${n(y + h)} ${n(x)} ${n(y + h - r + k)} ${n(x)} ${n(y + h - r)} c`,
      `${n(x)} ${n(y + r)} l ${n(x)} ${n(y + r - k)} ${n(x + r - k)} ${n(y)} ${n(x + r)} ${n(y)} c h`,
    );
  }
  circle(cx: number, cy: number, r: number) {
    this.roundRect(cx - r, cy - r, r * 2, r * 2, r);
  }
  /** A four-point sparkle centred on (cx, cy) from the top of the page. */
  sparkle(cx: number, cy: number, r: number, color: Color) {
    const y = PAGE_H - cy;
    const w = r * 0.28;
    this.fill(color);
    this.ops.push(
      `${n(cx)} ${n(y + r)} m ${n(cx + w)} ${n(y + w)} l ${n(cx + r)} ${n(y)} l ${n(cx + w)} ${n(y - w)} l ${n(cx)} ${n(y - r)} l ${n(cx - w)} ${n(y - w)} l ${n(cx - r)} ${n(y)} l ${n(cx - w)} ${n(y + w)} l h f`,
    );
  }
  /** An image `w` wide with its top-left corner at (x, top), turned `deg` degrees about its centre. */
  image(name: string, x: number, top: number, w: number, h: number, deg = 0) {
    const a = (deg * Math.PI) / 180;
    const cos = Math.cos(a), sin = Math.sin(a);
    const cx = x + w / 2, cy = PAGE_H - top - h / 2;
    this.ops.push(`q ${n(cos)} ${n(sin)} ${n(-sin)} ${n(cos)} ${n(cx)} ${n(cy)} cm ${n(w)} 0 0 ${n(h)} ${n(-w / 2)} ${n(-h / 2)} cm /${name} Do Q`);
  }
  /** Text with its baseline `top` points below the top of the page, centred on `cx` unless `left` or `right` is set. */
  text(s: string, font: Font, size: number, color: Color, top: number, opts: { cx?: number; left?: number; right?: number; tracking?: number } = {}) {
    const tracking = opts.tracking ?? 0;
    const width = textWidth(s, font, size, tracking) - tracking;
    const x = opts.left ?? (opts.right !== undefined ? opts.right - width : (opts.cx ?? PAGE_W / 2) - width / 2);
    this.ops.push(`BT /${fontRes(font)} ${n(size)} Tf ${n(tracking)} Tc ${rgb(color)} rg ${n(x)} ${n(PAGE_H - top)} Td (${pdfString(s)}) Tj ET`);
  }
}

/** A storybook cover with a white mat, turned `deg` degrees. */
function cover(c: Canvas, i: number, x: number, top: number, w: number, deg: number) {
  const img = COVERS[i]!;
  const h = (w * img.height) / img.width;
  const mat = 3.5;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a), sin = Math.sin(a);
  c.ops.push(`q ${n(cos)} ${n(sin)} ${n(-sin)} ${n(cos)} ${n(x + w / 2)} ${n(PAGE_H - top - h / 2)} cm`);
  c.fill("ink");
  c.ops.push(`${n(-w / 2 - mat + 2)} ${n(-h / 2 - mat - 2.5)} ${n(w + mat * 2)} ${n(h + mat * 2)} re f`);
  c.fill("white");
  c.stroke("ink", 1.25);
  c.ops.push(`${n(-w / 2 - mat)} ${n(-h / 2 - mat)} ${n(w + mat * 2)} ${n(h + mat * 2)} re B`);
  c.ops.push(`${n(w)} 0 0 ${n(h)} ${n(-w / 2)} ${n(-h / 2)} cm /Cover${i + 1} Do Q`);
}

const FEATURES: { title: string; body: string; dot: Color }[] = [
  { title: "Classic storybooks, read aloud", body: "Peter Rabbit, Winnie-the-Pooh, Alice and dozens more bedtime favorites.", dot: "coral" },
  { title: "In the voices your kids love", body: "Grandma, Grandpa or anyone in the family records about a minute, and Readli reads every story in their voice.", dot: "sunshine" },
  { title: "Private and family-first", body: "Voices stay in your family circle, and every storyteller approves their own.", dot: "mint" },
];

function draw(c: Canvas, input: CertificateInput) {
  const margin = 22;
  const frame = { x: margin, top: margin, w: PAGE_W - margin * 2, h: PAGE_H - margin * 2, r: 22 };
  const inner = { x: frame.x + 30, w: frame.w - 60 };
  const cx = PAGE_W / 2;

  c.fill("white");
  c.ops.push(`0 0 ${PAGE_W} ${PAGE_H} re f`);
  c.fill("ivory");
  c.roundRect(frame.x, frame.top, frame.w, frame.h, frame.r);
  c.ops.push("f");

  // Soft corner shapes, clipped to the frame.
  c.ops.push("q");
  c.roundRect(frame.x, frame.top, frame.w, frame.h, frame.r);
  c.ops.push("W n");
  c.fill("sunshine");
  c.circle(frame.x + 6, frame.top + 6, 62);
  c.ops.push("f");
  c.fill("sky");
  c.circle(frame.x + frame.w - 2, frame.top + 30, 40);
  c.ops.push("f");
  c.fill("mint");
  c.circle(frame.x + frame.w - 4, frame.top + frame.h - 4, 52);
  c.ops.push("f");
  c.fill("lavender");
  c.circle(frame.x + 2, frame.top + frame.h - 34, 30);
  c.ops.push("f");
  c.ops.push("Q");

  c.stroke("ink", 3.5);
  c.roundRect(frame.x, frame.top, frame.w, frame.h, frame.r);
  c.ops.push("S");
  c.stroke("coral", 1, [1.5, 4]);
  c.roundRect(frame.x + 9, frame.top + 9, frame.w - 18, frame.h - 18, frame.r - 7);
  c.ops.push("S");

  // Logo.
  const logoW = 44;
  const logoH = (logoW * LOGO.height) / LOGO.width;
  const word = "Readli";
  const wordSize = 28;
  const rowW = logoW + 8 + textWidth(word, "display", wordSize);
  const rowLeft = cx - rowW / 2;
  let top = frame.top + 34;
  c.ops.push(`q ${n(logoW)} 0 0 ${n(logoH)} ${n(rowLeft)} ${n(PAGE_H - top - logoH)} cm /Logo Do Q`);
  c.text(word, "display", wordSize, "ink", top + logoH / 2 + wordSize * 0.34, { left: rowLeft + logoW + 8 });
  top += logoH + 32;

  // Eyebrow between two sparkles.
  const eyebrow = input.eyebrow ?? "GIFT CERTIFICATE";
  const eyeW = textWidth(eyebrow, "heavy", 11.5, 2.6);
  c.text(eyebrow, "heavy", 11.5, "coralDeep", top, { tracking: 2.6 });
  c.sparkle(cx - eyeW / 2 - 14, top - 4, 6.5, "sunshine");
  c.sparkle(cx + eyeW / 2 + 12, top - 4, 6.5, "sunshine");
  top += 44;

  const headSize = fit(input.headline, "display", 42, inner.w, 24);
  c.text(input.headline, "display", headSize, "ink", top);
  top += 28;

  for (const line of wrap(input.presentedLine, "bold", 14.5, inner.w - 40).slice(0, 2)) {
    c.text(line, "bold", 14.5, "ink", top);
    top += 19;
  }
  for (const line of input.extraLines ?? []) {
    top += 1;
    for (const l of wrap(line, "bold", 12.5, inner.w - 40).slice(0, 2)) {
      c.text(l, "bold", 12.5, "coralDeep", top);
      top += 17;
    }
  }
  if (input.message) {
    top += 3;
    for (const line of wrap(`“${input.message}”`, "body", 12.5, inner.w - 60).slice(0, 3)) {
      c.text(line, "body", 12.5, "plum", top);
      top += 16.5;
    }
  }
  const headerBottom = top - 6;

  // The footer, measured up from the bottom of the frame.
  const fine = input.finePrint ? wrap(input.finePrint, "body", 8, inner.w - 70).slice(0, 3) : [];
  const tagline = input.tagline ?? "Every Book. Every Voice.";
  const bottom = frame.top + frame.h - 22;
  const footerTop = bottom - 16 - fine.length * 10 - 34;

  // "What's inside": a fan of storybook covers beside three lines on what the membership is.
  const textX = inner.x + 206;
  const textW = inner.x + inner.w - 20 - textX;
  const features = FEATURES.map((f) => ({ ...f, lines: wrap(f.body, "body", 10, textW - 15).slice(0, 2) }));
  const featuresH = 22 + features.reduce((h, f) => h + 13.5 + f.lines.length * 12.5 + 5, 0);
  const panelH = Math.max(150, featuresH + 34);
  const ticketH = 176;

  // The panel and the ticket share the space between the header and the footer.
  const free = footerTop - headerBottom - panelH - ticketH;
  const gap = Math.max(14, Math.min(52, free / 3));
  const panelTop = headerBottom + gap + Math.max(0, (free - gap * 3) / 2);
  const ticketTop = panelTop + panelH + gap;

  c.fill("skySoft");
  c.roundRect(inner.x, panelTop, inner.w, panelH, 18);
  c.ops.push("f");
  const coverW = 70;
  const fanX = inner.x + 24;
  const fanTop = panelTop + (panelH - 112) / 2;
  cover(c, 0, fanX, fanTop + 6, coverW, 9);
  cover(c, 2, fanX + 82, fanTop + 6, coverW, -9);
  cover(c, 1, fanX + 41, fanTop - 6, coverW + 8, 0);
  c.sparkle(fanX + 2, fanTop - 6, 6, "sunshine");
  c.sparkle(fanX + 160, fanTop + 116, 5, "coral");

  let ft = panelTop + 17 + 17;
  c.text("What's inside", "display", 17, "ink", ft, { left: textX });
  ft += 22;
  for (const f of features) {
    c.fill(f.dot);
    c.circle(textX + 4.5, ft - 4, 4.5);
    c.ops.push("f");
    c.text(f.title, "heavy", 11.5, "ink", ft, { left: textX + 15 });
    ft += 13.5;
    for (const l of f.lines) {
      c.text(l, "body", 10, "muted", ft, { left: textX + 15 });
      ft += 12.5;
    }
    ft += 5;
  }

  // The claim ticket: a coupon card with the QR code on the left and how to claim on the right.
  c.fill("white");
  c.stroke("coral", 1.75, [6, 4]);
  c.roundRect(inner.x, ticketTop, inner.w, ticketH, 18);
  c.ops.push("B");

  const box = 148;
  const boxX = inner.x + 16;
  const boxTop = ticketTop + (ticketH - box) / 2;
  c.stroke("ink", 2);
  c.fill("white");
  c.roundRect(boxX, boxTop, box, box, 12);
  c.ops.push("B");
  const qrSide = box - 8;
  const full = input.qr.size + QUIET_MODULES * 2;
  const mod = qrSide / full;
  const qx = boxX + (box - qrSide) / 2 + QUIET_MODULES * mod;
  const qTop = boxTop + (box - qrSide) / 2 + QUIET_MODULES * mod;
  c.fill("black");
  const rects: string[] = [];
  input.qr.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let run = 1;
      while (row[x + run]) run++;
      rects.push(`${n(qx + x * mod)} ${n(PAGE_H - qTop - (y + 1) * mod)} ${n(run * mod)} ${n(mod)} re`);
      x += run - 1;
    }
  });
  c.ops.push("% qr", rects.join(" "), "f");

  const colX = boxX + box + 22;
  const colW = inner.x + inner.w - 20 - colX;
  let tt = ticketTop + 34;
  for (const l of wrap(input.scanLine ?? "Scan to claim your Readli Family membership.", "display", 17, colW - 70).slice(0, 2)) {
    c.text(l, "display", 17, "ink", tt, { left: colX });
    tt += 21;
  }
  tt += 1;
  c.text(`Or visit ${input.claimHost}${input.claimPath ?? "/claim"} and enter this code:`, "body", 11, "ink", tt, { left: colX });
  tt += 12;

  const codeSize = fit(input.code, "heavy", 23, colW - 28, 14, 2.5);
  const pillH = codeSize + 20;
  c.fill("sunSoft");
  c.stroke("sunshine", 1.5);
  c.roundRect(colX, tt, colW, pillH, pillH / 2);
  c.ops.push("B");
  c.text(input.code, "heavy", codeSize, "ink", tt + pillH / 2 + codeSize * 0.36, { cx: colX + colW / 2, tracking: 2.5 });
  tt += pillH + 18;
  c.text("Then create your family circle and start listening.", "body", 10, "muted", tt, { left: colX });

  // Readi, perched on the ticket's top edge.
  const mascotW = 74;
  const mascotH = (mascotW * MASCOT.height) / MASCOT.width;
  c.image("Mascot", inner.x + inner.w - mascotW - 14, ticketTop - mascotH + 30, mascotW, mascotH);

  // Footer.
  let ft2 = footerTop + 11;
  c.text(input.termLine, "body", 10.5, "ink", ft2);
  ft2 += 14;
  c.text(input.claimByLine, "bold", 10.5, "ink", ft2);
  ft2 += 6;
  for (const l of fine) {
    ft2 += 10;
    c.text(l, "body", 8, "muted", ft2);
  }
  c.text(tagline, "display", 11.5, "coralDeep", bottom);
  c.text(input.certificateLabel, "bold", 8.5, "muted", bottom, { left: frame.x + 44 });
  c.text(input.claimHost, "bold", 8.5, "muted", bottom, { right: frame.x + frame.w - 44 });
}

type Obj = (string | Buffer)[];

/** The certificate as PDF bytes. */
export function certificatePdf(input: CertificateInput, title = "Readli gift certificate"): Buffer {
  const canvas = new Canvas();
  draw(canvas, input);
  const content = deflateSync(Buffer.from(canvas.ops.join("\n"), "latin1"));

  // Objects 1 to 4 are fixed (the tests read the content stream from object 4); the rest follow.
  const objects: Obj[] = [];
  const add = (o: Obj) => objects.push(o);
  add(["<< /Type /Catalog /Pages 2 0 R >>"]);
  add(["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"]);
  add([""]); // the page, filled in once the resources are numbered
  add([`<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`, content, "\nendstream"]);

  const stream = (dict: string, data: Buffer): number => add([`<< ${dict} /Length ${data.length} >>\nstream\n`, data, "\nendstream"]);

  const fontRefs = FONT_KEYS.map((key, i) => {
    const f = BRAND_FONTS[key];
    const tag = `READL${String.fromCharCode(65 + i)}`;
    const file = stream(`/Filter /FlateDecode /Length1 ${f.length}`, Buffer.from(f.data, "base64"));
    const descriptor = add([
      `<< /Type /FontDescriptor /FontName /${tag}+${f.name} /Flags 32 /FontBBox [${f.bbox.join(" ")}] /ItalicAngle 0 ` +
        `/Ascent ${f.ascent} /Descent ${f.descent} /CapHeight ${f.capHeight} /StemV 80 /FontFile2 ${file} 0 R >>`,
    ]);
    const widths = f.widths.map((w) => w || f.widths[63 - 32]);
    return add([
      `<< /Type /Font /Subtype /TrueType /BaseFont /${tag}+${f.name} /FirstChar 32 /LastChar 255 /Widths [${widths.join(" ")}] ` +
        `/Encoding /WinAnsiEncoding /FontDescriptor ${descriptor} 0 R >>`,
    ]);
  });

  const masked = (img: { width: number; height: number; rgb: string; alpha: string }) => {
    const alpha = Buffer.from(img.alpha, "base64");
    const rgbData = Buffer.from(img.rgb, "base64");
    const mask = stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode`, alpha);
    return stream(`/Type /XObject /Subtype /Image /Width ${img.width} /Height ${img.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask ${mask} 0 R`, rgbData);
  };
  const images: Record<string, number> = { Logo: masked(LOGO), Mascot: masked(MASCOT) };
  COVERS.forEach((cv, i) => {
    images[`Cover${i + 1}`] = stream(`/Type /XObject /Subtype /Image /Width ${cv.width} /Height ${cv.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode`, Buffer.from(cv.jpeg, "base64"));
  });

  objects[2] = [
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R /Resources << ` +
      `/Font << ${fontRefs.map((r, i) => `/F${i + 1} ${r} 0 R`).join(" ")} >> ` +
      `/XObject << ${Object.entries(images).map(([k, r]) => `/${k} ${r} 0 R`).join(" ")} >> >> >>`,
  ];
  const info = add([`<< /Title (${pdfString(title)}) /Producer (Readli) >>`]);

  const parts: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let length = parts[0]!.length;
  const offsets: number[] = [];
  objects.forEach((obj, i) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${i + 1} 0 obj\n`, "latin1"), ...obj.map((p) => (typeof p === "string" ? Buffer.from(p, "latin1") : p)), Buffer.from("\nendobj\n", "latin1")]);
    parts.push(chunk);
    length += chunk.length;
  });
  const xref = [`xref\n0 ${objects.length + 1}\n`, "0000000000 65535 f \n", ...offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`)].join("");
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${info} 0 R >>\nstartxref\n${length}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}
