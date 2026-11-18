import { afterEach, describe, expect, it, vi } from "vitest";
import { IN_APP_HEADER, IN_APP_SCRIPT, fromAndroidApp } from "./in-app";

function run(referrer: string) {
  Object.defineProperty(document, "referrer", { value: referrer, configurable: true });
  new Function(IN_APP_SCRIPT)();
}

describe("the Android app marker", () => {
  const realFetch = window.fetch;
  afterEach(() => {
    window.fetch = realFetch;
    sessionStorage.clear();
    document.documentElement.removeAttribute("data-app");
  });

  it("leaves ordinary browsing alone", () => {
    const spy = vi.fn();
    window.fetch = spy;
    run("https://www.google.com/");
    expect(document.documentElement.getAttribute("data-app")).toBeNull();
    expect(window.fetch).toBe(spy);
  });

  it("marks the app's tab, remembers it for later pages, and tags same-origin requests only", async () => {
    const spy = vi.fn().mockResolvedValue(new Response("{}"));
    window.fetch = spy;
    run("android-app://ai.readli.app/");
    expect(document.documentElement.getAttribute("data-app")).toBe("android");
    expect(sessionStorage.getItem("readli_app")).toBe("android");

    await window.fetch("/api/billing/checkout", { method: "POST", headers: { "content-type": "application/json" } });
    const sent = new Headers(spy.mock.calls[0]![1].headers);
    expect(sent.get(IN_APP_HEADER)).toBe("android");
    expect(sent.get("content-type")).toBe("application/json");

    await window.fetch("https://api.example.com/x");
    expect(spy.mock.calls[1]![1]).toBeUndefined();

    // A later page in the same tab has an https referrer but stays in app mode.
    document.documentElement.removeAttribute("data-app");
    run("https://readli.ai/family");
    expect(document.documentElement.getAttribute("data-app")).toBe("android");
  });

  it("is what purchase routes check", () => {
    expect(fromAndroidApp(new Request("https://readli.ai/api/billing/checkout", { headers: { [IN_APP_HEADER]: "android" } }))).toBe(true);
    expect(fromAndroidApp(new Request("https://readli.ai/api/billing/checkout"))).toBe(false);
  });
});
