import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StorytellerAvatar } from "./StorytellerAvatar";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("StorytellerAvatar", () => {
  it("asks for an expired photo again once, then shows initials instead of a broken image", () => {
    const { container } = render(<StorytellerAvatar name="Daddy" avatarUrl="/api/people/u1/photo?v=1" tint="bg-sky" />);
    const first = container.querySelector("img")!;
    expect(first.getAttribute("src")).toBe("/api/people/u1/photo?v=1");

    fireEvent.error(first);
    const retry = container.querySelector("img")!;
    expect(retry.getAttribute("src")).toMatch(/^\/api\/people\/u1\/photo\?v=1&retry=\d+$/);

    fireEvent.error(retry);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("D");
  });

  it("notices a photo that already failed before the page became interactive", () => {
    vi.spyOn(HTMLImageElement.prototype, "complete", "get").mockReturnValue(true);
    vi.spyOn(HTMLImageElement.prototype, "naturalWidth", "get").mockReturnValue(0);
    const { container } = render(<StorytellerAvatar name="Daddy" avatarUrl="/api/people/u1/photo?v=1" tint="bg-sky" />);
    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toBe("D");
  });

  it("shows initials when there is no photo", () => {
    const { container } = render(<StorytellerAvatar name="Grandma June" avatarUrl={null} tint="bg-sky" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
