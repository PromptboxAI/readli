import { describe, expect, it } from "vitest";
import { crc32 } from "./crc32";
import { zip } from "./zip";

describe("zip", () => {
  it("compute the standard CRC-32", () => {
    expect(crc32(Buffer.from("123456789"))).toBe(0xcbf43926);
  });

  it("store each file with a central directory a zip reader can list", () => {
    const out = zip([
      { name: "MEB-001.pdf", data: Buffer.from("%PDF one") },
      { name: "MEB-002.pdf", data: Buffer.from("%PDF two!") },
    ]);
    expect(out.readUInt32LE(0)).toBe(0x04034b50);
    const end = out.length - 22;
    expect(out.readUInt32LE(end)).toBe(0x06054b50);
    expect(out.readUInt16LE(end + 10)).toBe(2);
    const dirStart = out.readUInt32LE(end + 16);
    expect(out.readUInt32LE(dirStart)).toBe(0x02014b50);
    expect(out.subarray(dirStart + 46, dirStart + 46 + 11).toString()).toBe("MEB-001.pdf");
    expect(out.subarray(30 + 11, 30 + 11 + 8).toString()).toBe("%PDF one");
  });
});
