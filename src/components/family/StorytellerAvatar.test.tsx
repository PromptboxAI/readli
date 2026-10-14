import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { StorytellerAvatar } from "./StorytellerAvatar";

afterEach(cleanup);

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

  it("shows initials when there is no photo", () => {
    const { container } = render(<StorytellerAvatar name="Grandma June" avatarUrl={null} tint="bg-sky" />);
    expect(container.querySelector("img")).toBeNull();
  });
});
