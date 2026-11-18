// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { MyVoiceSharing } from "./MyVoiceSharing";

afterEach(cleanup);

describe("MyVoiceSharing with no family voice yet", () => {
  it("says nothing is recorded only when there's no recording", () => {
    render(<MyVoiceSharing initial={[]} storyteller />);
    expect(screen.getByTestId("no-families").textContent).toBe("You haven't recorded your voice yet.");
  });

  it("says no family uses it yet once a recording exists", () => {
    render(<MyVoiceSharing initial={[]} storyteller recorded />);
    expect(screen.getByTestId("no-families").textContent).toMatch(/^No families use your voice yet/);
    expect(screen.queryByText(/haven't recorded/)).toBeNull();
  });
});
