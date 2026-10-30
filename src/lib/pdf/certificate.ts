import { deflateSync } from "node:zlib";
import type { QrCode } from "@/lib/qr/encode";
import { QUIET_MODULES } from "@/lib/qr/render";
import { HELVETICA_BOLD_WIDTHS, HELVETICA_WIDTHS, LOGO, WIN_ANSI_EXTRA } from "./assets";

/**
 * The printable complimentary membership certificate: one US Letter page (8.5 × 11 in), drawn as
 * vector shapes and the PDF base fonts so it prints sharp anywhere. The QR code is drawn module by
 * module from the same claim link as the manual code printed under it.
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
  /** The bold line under the QR code. */
  scanLine?: string;
  /** Where to type the code; "/claim" unless set. */
  claimPath?: string;
  /** Small print along the bottom of the page. */
  finePrint?: string;
  /** A short line at the very bottom, e.g. "Every Book. Every Voice." */
  tagline?: string;
}

type Font = "F1" | "F2" | "F3" | "F4";
const PAGE_W = 612;
const PAGE_H = 792;

const COLORS = {
  ink: [0x28, 0x35, 0x48],
  ivory: [0xff, 0xf9, 0xed],
  surface: [0xff, 0xfe, 0xf9],
  sunshine: [0xff, 0xce, 0x58],
  mint: [0x9c, 0xe2, 0xbc],
  coral: [0xff, 0x79, 0x67],
  plum: [0x44, 0x35, 0x4f],
  muted: [0x5b, 0x66, 0x76],
  black: [0, 0, 0],
  white: [0xff, 0xff, 0xff],
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
  const bytes = winAnsi(text);
  if (font === "F4") return bytes.length * 600 * (size / 1000) + tracking * bytes.length;
  const table = font === "F2" ? HELVETICA_BOLD_WIDTHS : HELVETICA_WIDTHS;
  return bytes.reduce((w, b) => w + (table[b - 32] ?? 556), 0) * (size / 1000) + tracking * bytes.length;
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

class Canvas {
  readonly ops: string[] = [];

  fill(color: Color) {
    this.ops.push(`${rgb(color)} rg`);
  }
  stroke(color: Color, width: number) {
    this.ops.push(`${rgb(color)} RG ${n(width)} w`);
  }
  roundRect(x: number, y: number, w: number, h: number, r: number) {
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
  /** Text with its baseline `top` points below the top of the page, centred on `cx` unless `left` is set. */
  text(s: string, font: Font, size: number, color: Color, top: number, opts: { cx?: number; left?: number; tracking?: number } = {}) {
    const tracking = opts.tracking ?? 0;
    const x = opts.left ?? (opts.cx ?? PAGE_W / 2) - (textWidth(s, font, size, tracking) - tracking) / 2;
    this.ops.push(`BT /${font} ${n(size)} Tf ${n(tracking)} Tc ${rgb(color)} rg ${n(x)} ${n(PAGE_H - top)} Td (${pdfString(s)}) Tj ET`);
  }
}

function draw(c: Canvas, input: CertificateInput) {
  const margin = 30;
  const frame = { x: margin, y: margin, w: PAGE_W - margin * 2, h: PAGE_H - margin * 2, r: 24 };

  c.fill("surface");
  c.ops.push(`0 0 ${PAGE_W} ${PAGE_H} re f`);
  c.fill("ivory");
  c.roundRect(frame.x, frame.y, frame.w, frame.h, frame.r);
  c.ops.push("f");

  c.ops.push("q");
  c.roundRect(frame.x, frame.y, frame.w, frame.h, frame.r);
  c.ops.push("W n");
  c.fill("sunshine");
  c.circle(frame.x + 14, PAGE_H - margin - 14, 49);
  c.ops.push("f");
  c.fill("mint");
  c.circle(frame.x + frame.w - 19, frame.y + 19, 56);
  c.ops.push("f");
  c.fill("coral");
  c.circle(frame.x + frame.w - 40, PAGE_H - margin - 37, 10);
  c.ops.push("f");
  c.ops.push("Q");

  c.stroke("ink", 4.5);
  c.roundRect(frame.x, frame.y, frame.w, frame.h, frame.r);
  c.ops.push("S");

  const logoW = 48;
  const logoH = (logoW * LOGO.height) / LOGO.width;
  const word = "Readli";
  const wordSize = 28.5;
  const rowW = logoW + 8 + textWidth(word, "F2", wordSize);
  const rowLeft = PAGE_W / 2 - rowW / 2;
  let top = margin + 36;
  c.ops.push(`q ${n(logoW)} 0 0 ${n(logoH)} ${n(rowLeft)} ${n(PAGE_H - top - logoH)} cm /Logo Do Q`);
  c.text(word, "F2", wordSize, "ink", top + logoH / 2 + wordSize * 0.36, { left: rowLeft + logoW + 8 });
  top += logoH + 30;

  c.text(input.eyebrow ?? "GIFT CERTIFICATE", "F2", 11, input.eyebrow ? "plum" : "ink", top, { tracking: 1.6 });
  top += 40;

  let headSize = 37.5;
  while (headSize > 22 && textWidth(input.headline, "F2", headSize) > frame.w - 80) headSize -= 1;
  c.text(input.headline, "F2", headSize, "ink", top);
  top += 26;

  for (const line of wrap(input.presentedLine, "F1", 15, frame.w - 100).slice(0, 2)) {
    c.text(line, "F1", 15, "ink", top);
    top += 19;
  }
  for (const line of input.extraLines ?? []) {
    top += 2;
    for (const l of wrap(line, "F2", 13.5, frame.w - 100).slice(0, 2)) {
      c.text(l, "F2", 13.5, "plum", top);
      top += 18;
    }
  }
  if (input.message) {
    top += 4;
    for (const line of wrap(`“${input.message}”`, "F3", 12.75, frame.w - 120).slice(0, 3)) {
      c.text(line, "F3", 12.75, "plum", top);
      top += 16;
    }
  }

  const compact = Boolean(input.finePrint);
  const box = compact ? 200 : 228;
  const boxTop = Math.max(top + (compact ? 20 : 28), 270);
  const boxX = PAGE_W / 2 - box / 2;
  c.fill("white");
  c.stroke("ink", 2.25);
  c.roundRect(boxX, PAGE_H - boxTop - box, box, box, 15);
  c.ops.push("B");
  const qrSide = box - 12;
  const full = input.qr.size + QUIET_MODULES * 2;
  const mod = qrSide / full;
  const qx = PAGE_W / 2 - qrSide / 2 + QUIET_MODULES * mod;
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
  c.ops.push(rects.join(" "), "f");
  top = boxTop + box + (compact ? 26 : 30);

  c.text(input.scanLine ?? "Scan to claim your Readli Family membership.", "F2", 18, "ink", top);
  top += 22;
  c.text(`Or visit ${input.claimHost}${input.claimPath ?? "/claim"} and enter this code:`, "F1", 12, "ink", top);
  top += 30;
  c.text(input.code, "F4", 24, "ink", top, { tracking: 1.5 });

  if (input.finePrint) {
    const fine = wrap(input.finePrint, "F1", 8.25, frame.w - 120).slice(0, 3);
    let bottom = PAGE_H - margin - 14 - (input.tagline ? 14 : 0) - fine.length * 10.5;
    c.text(input.termLine, "F1", 11.25, "ink", bottom - 34);
    c.text(input.claimByLine, "F2", 11.25, "ink", bottom - 18);
    for (const l of fine) {
      bottom += 10.5;
      c.text(l, "F1", 8.25, "muted", bottom);
    }
    if (input.tagline) c.text(input.tagline, "F2", 10.5, "plum", PAGE_H - margin - 14);
  } else {
    c.text(input.termLine, "F1", 11.25, "ink", PAGE_H - margin - 46);
    c.text(input.claimByLine, "F1", 11.25, "muted", PAGE_H - margin - 30);
  }
  c.text(input.certificateLabel, "F1", 9, "muted", PAGE_H - margin - 12, { left: frame.x + 24 });
}

/** The certificate as PDF bytes. */
export function certificatePdf(input: CertificateInput, title = "Readli gift certificate"): Buffer {
  const canvas = new Canvas();
  draw(canvas, input);
  const content = deflateSync(Buffer.from(canvas.ops.join("\n"), "latin1"));
  const rgbData = Buffer.from(LOGO.rgb, "base64");
  const alphaData = Buffer.from(LOGO.alpha, "base64");

  const objects: (string | Buffer)[][] = [
    ["<< /Type /Catalog /Pages 2 0 R >>"],
    ["<< /Type /Pages /Kids [3 0 R] /Count 1 >>"],
    [
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE_W} ${PAGE_H}] /Contents 4 0 R ` +
        "/Resources << /Font << /F1 5 0 R /F2 6 0 R /F3 7 0 R /F4 8 0 R >> /XObject << /Logo 9 0 R >> >> >>",
    ],
    [`<< /Length ${content.length} /Filter /FlateDecode >>\nstream\n`, content, "\nendstream"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>"],
    ["<< /Type /Font /Subtype /Type1 /BaseFont /Courier-Bold /Encoding /WinAnsiEncoding >>"],
    [
      `<< /Type /XObject /Subtype /Image /Width ${LOGO.width} /Height ${LOGO.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /SMask 10 0 R /Length ${rgbData.length} >>\nstream\n`,
      rgbData,
      "\nendstream",
    ],
    [
      `<< /Type /XObject /Subtype /Image /Width ${LOGO.width} /Height ${LOGO.height} /ColorSpace /DeviceGray /BitsPerComponent 8 /Filter /FlateDecode /Length ${alphaData.length} >>\nstream\n`,
      alphaData,
      "\nendstream",
    ],
    [`<< /Title (${pdfString(title)}) /Producer (Readli) >>`],
  ];

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
  parts.push(Buffer.from(`${xref}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Info ${objects.length} 0 R >>\nstartxref\n${length}\n%%EOF\n`, "latin1"));
  return Buffer.concat(parts);
}
