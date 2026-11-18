import { describe, expect, it } from "vitest";
import { findDemoBook } from "./demo-books";
import { welcomeStoryText } from "./welcome-stories";

describe("welcomeStoryText", () => {
  it("reads The Lion and the Mouse whole, ending included", () => {
    const text = welcomeStoryText("the-lion-and-the-mouse")!;
    expect(text).toContain("A Lion lay asleep in the forest");
    expect(text).toContain("even a Mouse can help a Lion");
  });

  it("reads only the opening passage of a longer book", () => {
    expect(welcomeStoryText("winnie-the-pooh")).toBe(findDemoBook("winnie-the-pooh")!.passageText);
  });

  it("has nothing for a book that isn't a demo book", () => {
    expect(welcomeStoryText("not-a-book")).toBeNull();
  });
});
