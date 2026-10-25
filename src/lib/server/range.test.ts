import { describe, expect, it } from "vitest";
import { audioResponse, parseRange } from "./range";

describe("byte ranges for narration audio", () => {
  it("reads one open or closed range, and sends the whole file otherwise", () => {
    expect(parseRange("bytes=0-1")).toEqual({ start: 0, end: 1 });
    expect(parseRange("bytes=500-")).toEqual({ start: 500, end: null });
    expect(parseRange("bytes=-500")).toBeNull();
    expect(parseRange("bytes=0-1,5-9")).toBeNull();
    expect(parseRange("bytes=9-3")).toBeNull();
    expect(parseRange(null)).toBeNull();
  });

  it("answers 206 with Content-Range, 416 past the end, and 200 without a range", async () => {
    const object = (n: number) => ({ audio: new Uint8Array(n).buffer, contentType: "audio/mpeg", size: 1000 });
    const part = audioResponse(object(2), { start: 0, end: 1 });
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 0-1/1000");
    expect(part.headers.get("cache-control")).toBe("private, no-store");
    expect(audioResponse(object(0), { start: 1000, end: null }).status).toBe(416);
    const whole = audioResponse(object(1000), null);
    expect(whole.status).toBe(200);
    expect(whole.headers.get("accept-ranges")).toBe("bytes");
  });
});
