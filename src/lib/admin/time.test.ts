import { describe, expect, it } from "vitest";
import { adminDate, adminDateTime } from "./time";

describe("admin times", () => {
  it("show Eastern time whatever the server's time zone", () => {
    expect(adminDateTime("2026-11-02T16:45:00Z")).toBe("Nov 2, 11:45 AM EST");
    expect(adminDateTime("2026-07-01T16:45:00Z", true)).toBe("Jul 1, 2026, 12:45 PM EDT");
    expect(adminDate("2026-11-02T03:00:00Z")).toBe("Nov 1, 2026");
    expect(adminDate("2026-11-02T16:45:00Z", false)).toBe("Nov 2");
  });
});
