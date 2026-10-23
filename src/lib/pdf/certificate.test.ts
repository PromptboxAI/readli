import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { encodeQr } from "@/lib/qr/encode";
import { certificatePdf, textWidth, winAnsi, wrap } from "./certificate";

const input = {
  headline: "A year of Readli Family",
  presentedLine: "Donated by Readli for the Mount Elementary Basket Dinner",
  message: "Thank you for supporting Mount Elementary!",
  qr: encodeQr("https://readli.ai/claim#ABCD-EFGH-JKMN"),
  code: "ABCD-EFGH-JKMN",
  claimHost: "readli.ai",
  termLine: "12 months · No credit card required · Does not renew automatically",
  claimByLine: "One family, one claim. Claim by October 22, 2027.",
  certificateLabel: "MEB-001",
};

describe("printable certificate", () => {
  it("is one US Letter page with the code, instructions and disclosures", () => {
    const pdf = certificatePdf(input);
    const text = pdf.toString("latin1");
    expect(text.startsWith("%PDF-1.4")).toBe(true);
    expect(text).toContain("/MediaBox [0 0 612 792]");
    expect(text).toContain("/Count 1");
    expect(text.trimEnd().endsWith("%%EOF")).toBe(true);
    const start = text.indexOf("stream\n", text.indexOf("4 0 obj")) + 7;
    const len = Number(/4 0 obj\n<< \/Length (\d+)/.exec(text)![1]);
    const content = inflateSync(pdf.subarray(start, start + len)).toString("latin1");
    for (const s of ["(ABCD-EFGH-JKMN)", "(Scan to claim your Readli Family membership.)", "(MEB-001)", "No credit card required", "Does not renew automatically", "(A year of Readli Family)"]) {
      expect(content).toContain(s);
    }
    const startxref = Number(/startxref\n(\d+)/.exec(text)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe("xref");
  });

  it("draws every dark QR module", () => {
    const pdf = certificatePdf(input);
    const text = pdf.toString("latin1");
    const start = text.indexOf("stream\n", text.indexOf("4 0 obj")) + 7;
    const len = Number(/4 0 obj\n<< \/Length (\d+)/.exec(text)![1]);
    const content = inflateSync(pdf.subarray(start, start + len)).toString("latin1");
    const dark = input.qr.modules.flat().filter(Boolean).length;
    const drawn = [...content.matchAll(/([\d.]+) ([\d.]+) ([\d.]+) ([\d.]+) re/g)].slice(1).reduce((n, m) => n + Math.round(Number(m[3]) / Number(m[4])), 0);
    expect(drawn).toBe(dark);
  });

  it("measures and wraps text in the PDF fonts", () => {
    expect(winAnsi("“Hi” · —")).toEqual([0x93, 72, 105, 0x94, 32, 0xb7, 32, 0x97]);
    expect(winAnsi("中")).toEqual([63]);
    expect(textWidth("AAAA", "F4", 10)).toBe(24);
    expect(wrap("one two three four five six", "F1", 12, 60).length).toBeGreaterThan(1);
  });
});
