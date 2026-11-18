import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { bookSampleSrc } from "./samples";

const file = join(process.cwd(), "public", "samples", "books", "zz-test-book.mp3");

afterEach(() => rmSync(file, { force: true }));

describe("book samples", () => {
  it("offers a sample only once its recording is saved", () => {
    expect(bookSampleSrc("zz-test-book")).toBeNull();
    mkdirSync(join(file, ".."), { recursive: true });
    writeFileSync(file, "");
    expect(bookSampleSrc("zz-test-book")).toBe("/samples/books/zz-test-book.mp3");
  });
});
