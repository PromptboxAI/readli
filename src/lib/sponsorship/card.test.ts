import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { cardDefaults, cardInput, cardLink, cardPlace, giftCardPdf } from "./card";
import type { GiftView, PlaceView } from "./view";

const place = (seat: number, name: string, extra: Partial<PlaceView> = {}): PlaceView => ({
  seat,
  name,
  state: "arrives",
  openedAt: null,
  joinedAt: null,
  voice: "offered",
  creditShare: 20,
  nextShare: null,
  nextFrom: null,
  usedThisMonth: 0,
  accessUntil: null,
  ...extra,
});

const gift: GiftView = {
  id: "g1",
  plan: "annual",
  status: "scheduled",
  priceCents: 17999,
  paidAt: "2026-11-15T15:00:00.000Z",
  deliverAt: "2026-12-25T13:00:00.000Z",
  startsAt: null,
  paidThrough: null,
  endsAt: null,
  nextMonthFrom: null,
  nextChargeAt: null,
  giverName: "Nana Rose",
  message: "Can't wait to read to you!",
  places: [place(1, "The Garcia family"), place(2, "Ben and Maya", { voice: "not_shared" })],
  freePlaces: [],
  canChangeFamilies: true,
  refund: null,
};

const NOW = new Date("2026-11-20T12:00:00Z");
const shown = (pdf: Buffer) => {
  const text = pdf.toString("latin1");
  const start = text.indexOf("stream\n", text.indexOf("4 0 obj")) + 7;
  const len = Number(/4 0 obj\n<< \/Length (\d+)/.exec(text)![1]);
  const content = inflateSync(pdf.subarray(start, start + len)).toString("latin1");
  return [...content.matchAll(/\((.*?)\) Tj/g)].map((m) => m[1]).join(" ");
};

describe("printable gift card", () => {
  it("defaults to the family, the giver and their gift note", () => {
    expect(cardDefaults(gift, cardPlace(gift, 2))).toEqual({ headline: "A Year of Stories", to: "Ben and Maya", from: "Nana Rose", message: "Can't wait to read to you!" });
    expect(cardPlace(gift, 9)?.seat).toBe(1);
  });

  it("uses the giver's changes, trimmed to fit", () => {
    const c = cardInput(gift, { seat: 1, headline: "  Stories   in My Voice ", to: "The Garcias", from: "Grandma", message: "x".repeat(400) }, "https://readli.ai", NOW);
    expect(c.headline).toBe("Stories in My Voice");
    expect(c.presentedLine).toBe("For The Garcias · From Grandma");
    expect(c.message).toHaveLength(200);
    expect(c.extraLines).toEqual(["With stories read in Grandma's own voice"]);
  });

  it("carries no gift code, and says when the email arrives", () => {
    const c = cardInput(gift, { seat: 2 }, "https://readli.ai", NOW);
    expect(c.code).toBeUndefined();
    expect(c.qrCaption).toBe("Scan the code to see your gift.");
    expect(c.extraLines).toEqual([]);
    expect(c.steps![0]).toBe("Watch for an email from Readli on Dec 25, 2026.");
    expect(c.steps![2]).toContain("no tech skills needed");
    const text = shown(giftCardPdf(gift, { seat: 2 }, "https://readli.ai", NOW));
    expect(text).toContain("A Year of Stories");
    expect(text).toContain("Your gift arrives by email");
    expect(text).not.toContain("enter this code");
  });

  it("its QR code opens that family's gift page", () => {
    expect(cardLink(gift, cardPlace(gift, 2), "https://readli.ai/")).toBe("https://readli.ai/gift/card/g1?seat=2");
  });

  it("points a delivered gift at the email that already came", () => {
    const sent = { ...gift, status: "active" as const, deliverAt: "2026-11-18T13:00:00.000Z" };
    expect(cardInput(sent, {}, "https://readli.ai", NOW).steps![0]).toBe('Find the email from Readli: "Nana Rose gave your family Readli".');
  });
});
