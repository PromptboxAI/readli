import { describe, expect, it } from "vitest";
import { kidsModeRoute } from "./kids-mode";

/** Every grown-up API route in the app. A kids device must get "deny" for each one. */
const GROWN_UP_API = [
  "/api/voice",
  "/api/voice/sample",
  "/api/account",
  "/api/account/export",
  "/api/account/photo",
  "/api/billing/checkout",
  "/api/billing/portal",
  "/api/family/books/the-tale-of-peter-rabbit/narration",
  "/api/family/children",
  "/api/family/children/kid-1",
  "/api/family/household",
  "/api/family/kids/kid-1/storytellers",
  "/api/family/narration-credits",
  "/api/family/narrators",
  "/api/family/narrators/slots",
  "/api/family/notifications",
  "/api/family/reset",
  "/api/family/voices",
  "/api/family/voices/voice-1/share",
  "/api/gifts/redeem",
  "/api/guest/clone",
  "/api/guest/recording",
  "/api/guest/session",
  "/api/demo/generate",
  "/api/invites",
  "/api/invites/inv-1",
  "/api/invites/accept",
  "/api/people/user-1/photo",
  "/api/admin/anything",
];

describe("Kids Mode routes", () => {
  it("refuses every grown-up API route", () => {
    for (const path of GROWN_UP_API) expect(kidsModeRoute(path), path).toBe("deny");
  });

  it("allows the child's own bookshelf, player, playback and leaving", () => {
    for (const path of [
      "/api/kids/kid-1/books/the-tale-of-peter-rabbit",
      "/api/kids/kid-1/favorites",
      "/api/kids/kid-1/listening",
      "/api/kids/kid-1/narrators",
      "/api/kids/kid-1/progress",
      "/api/kids/narrations",
      "/api/narration/audio/token",
      "/api/family/session",
    ]) {
      expect(kidsModeRoute(path), path).toBe("allow");
    }
  });

  it("does not let a look-alike path through", () => {
    expect(kidsModeRoute("/api/family/session/extra")).toBe("deny");
    expect(kidsModeRoute("/api/kidsx")).toBe("deny");
  });

  it("sends grown-up pages back to the bookshelf and leaves public pages open", () => {
    for (const path of ["/admin", "/admin/plans", "/family/billing", "/family/my-voice", "/family/kids", "/voice", "/voice/record", "/billing/narrator-slots", "/gift/open", "/rewards", "/invite/family", "/signup", "/signup/family", "/welcome", "/try", "/r/abc"]) {
      expect(kidsModeRoute(path), path).toBe("to_kids");
    }
    for (const path of ["/", "/kids", "/kids/listen/the-tale-of-peter-rabbit", "/family", "/login", "/auth/callback", "/books", "/help", "/pricing", "/privacy", "/voices", "/tryout"]) {
      expect(kidsModeRoute(path), path).toBe("allow");
    }
  });
});
