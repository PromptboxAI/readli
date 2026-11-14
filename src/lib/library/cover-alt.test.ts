import { describe, expect, it } from "vitest";
import { coverAlt } from "./cover-alt";

describe("coverAlt", () => {
  it("names the book and its author", () => {
    expect(coverAlt({ title: "The Velveteen Rabbit", author: "Margery Williams" })).toBe(
      "Illustrated Readli cover of The Velveteen Rabbit by Margery Williams, a classic children's story",
    );
  });
  it("leaves out a traditional author", () => {
    expect(coverAlt({ title: "The Little Red Hen", author: "Traditional" })).toBe("Illustrated Readli cover of The Little Red Hen, a classic children's story");
  });
});
