import { describe, expect, it } from "vitest";
import { bookPath, publicSlug, slugFromPublic } from "./paths";
import { publicBook } from "./public";

describe("public book paths", () => {
  it("puts The Owl and the Kitty-Cat at a URL that matches its title", () => {
    expect(publicBook("the-owl-and-the-pussy-cat")?.title).toBe("The Owl and the Kitty-Cat");
    expect(bookPath("the-owl-and-the-pussy-cat")).toBe("/books/the-owl-and-the-kitty-cat");
    expect(slugFromPublic("the-owl-and-the-kitty-cat")).toBe("the-owl-and-the-pussy-cat");
  });

  it("leaves every other book at its own slug", () => {
    expect(publicSlug("peter-rabbit")).toBe("peter-rabbit");
    expect(slugFromPublic("peter-rabbit")).toBe("peter-rabbit");
  });
});
