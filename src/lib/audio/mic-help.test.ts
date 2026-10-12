import { describe, expect, it } from "vitest";
import { micBlockedSteps, micPlatform } from "./mic-help";

const UA = {
  iosSafari: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
  iosChrome: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0 Mobile/15E148 Safari/604.1",
  androidChrome: "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36",
  samsung: "Mozilla/5.0 (Linux; Android 14; SM-S921B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/26.0 Chrome/122.0 Mobile Safari/537.36",
  facebook: "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/480.0]",
  desktop: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36",
};

describe("blocked microphone help", () => {
  it("recognises the reader's browser", () => {
    expect(micPlatform(UA.iosSafari)).toBe("ios_safari");
    expect(micPlatform(UA.iosChrome)).toBe("ios_chrome");
    expect(micPlatform(UA.androidChrome)).toBe("android_chrome");
    expect(micPlatform(UA.samsung)).toBe("samsung");
    expect(micPlatform(UA.facebook)).toBe("in_app");
    expect(micPlatform(UA.desktop)).toBe("desktop");
  });

  it("sends in-app readers to a real browser and everyone else to their settings", () => {
    expect(micBlockedSteps("in_app").steps.join(" ")).toMatch(/Open in browser/);
    expect(micBlockedSteps("android_chrome").steps.join(" ")).toMatch(/Microphone to Allow/);
    expect(micBlockedSteps("ios_safari").steps.at(-1)).toMatch(/reload/i);
  });
});
