import { deflateSync } from "node:zlib";
import { crc32 } from "@/lib/files/crc32";
import type { QrCode } from "./encode";

/** QR codes keep a quiet zone of 4 light modules on every side so scanners find them in print. */
export const QUIET_MODULES = 4;

/** Scalable artwork for Canva and print: one path of dark squares on a white square. */
export function qrSvg(qr: QrCode, title = "QR code"): string {
  const full = qr.size + QUIET_MODULES * 2;
  const path: string[] = [];
  qr.modules.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      if (!row[x]) continue;
      let run = 1;
      while (row[x + run]) run++;
      path.push(`M${x + QUIET_MODULES} ${y + QUIET_MODULES}h${run}v1h-${run}z`);
      x += run - 1;
    }
  });
  const safeTitle = title.replace(/[<>&"]/g, "");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${full} ${full}" width="1200" height="1200" shape-rendering="crispEdges" role="img" aria-label="${safeTitle}">` +
    `<title>${safeTitle}</title><rect width="${full}" height="${full}" fill="#ffffff"/><path fill="#000000" d="${path.join("")}"/></svg>`
  );
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** A crisp black-on-white PNG about `target` pixels square, each module a whole number of pixels. */
export function qrPng(qr: QrCode, target = 1200): Buffer {
  const full = qr.size + QUIET_MODULES * 2;
  const scale = Math.max(1, Math.floor(target / full));
  const px = full * scale;
  const raw = Buffer.alloc((px + 1) * px, 0xff);
  for (let y = 0; y < px; y++) {
    const rowStart = y * (px + 1);
    raw[rowStart] = 0;
    const my = Math.floor(y / scale) - QUIET_MODULES;
    const row = qr.modules[my];
    if (!row) continue;
    for (let x = 0; x < px; x++) {
      if (row[Math.floor(x / scale) - QUIET_MODULES]) raw[rowStart + 1 + x] = 0;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0);
  ihdr.writeUInt32BE(px, 4);
  ihdr[8] = 8;
  ihdr[9] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
