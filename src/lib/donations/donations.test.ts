import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { claimLink, claimPath, type MembershipArtwork } from "@/lib/admin/complimentary";
import { membershipCertificate } from "@/lib/admin/complimentary-artwork";
import { claimByForEvent, normalizeUrl, validateDonation, type DonationForm } from "./program";
import { eventKey, isOfficialEmail, screen, type PriorRequest } from "./screening";
import { occasionFor, requestsCsv, statusToken, type AdminRequest } from "./server";

const AT = new Date("2026-10-30T12:00:00Z");

const form = (over: Partial<DonationForm> = {}): DonationForm => ({
  orgName: "Oak Street PTA",
  orgType: "pta",
  orgWebsite: "oakstreetpta.org",
  orgProof: "",
  orgEin: "",
  orgStreet: "",
  orgCity: "Montclair",
  orgState: "nj",
  orgZip: "07042",
  contactName: "Dana Lee",
  contactRole: "Fundraising chair",
  contactEmail: "Dana@OakStreetPTA.org",
  contactPhone: "",
  eventName: "Spring Tricky Tray",
  eventType: "tricky_tray",
  eventDate: "2027-03-14",
  beneficiary: "Oak Street Elementary library",
  eventLocation: "Montclair, NJ",
  eventOnline: false,
  eventUrl: "",
  attendance: "250",
  donationUse: "tricky_tray",
  certificateDelivery: "email",
  certificateOrgName: "",
  notes: "",
  confirmAuthorized: true,
  confirmCharitable: true,
  agreeTerms: true,
  ...over,
});

const valid = (over: Partial<DonationForm> = {}) => {
  const r = validateDonation(form(over), AT);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};

describe("donation request form", () => {
  it("accepts a typical PTA request and tidies it", () => {
    const v = valid();
    expect(v).toMatchObject({ orgState: "NJ", contactEmail: "dana@oakstreetpta.org", orgWebsite: "https://oakstreetpta.org/", attendance: 250, orgEin: null });
  });

  it("lets a group without a website or EIN apply with other proof", () => {
    expect(validateDonation(form({ orgWebsite: "", orgProof: "Letter from the principal attached" }), AT).ok).toBe(true);
    const r = validateDonation(form({ orgWebsite: "", orgProof: "" }), AT);
    expect(r.ok ? null : r.errors.orgWebsite).toMatch(/website/);
  });

  it("needs the acknowledgments, a US state and an upcoming event", () => {
    const r = validateDonation(form({ confirmAuthorized: false, agreeTerms: false, orgState: "ON", eventDate: "2026-09-01" }), AT);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(Object.keys(r.errors).sort()).toEqual(["agreeTerms", "confirmAuthorized", "eventDate", "orgState"]);
    const far = validateDonation(form({ eventDate: "2028-01-01" }), AT);
    expect(far.ok ? null : far.errors.eventDate).toMatch(/within a year/);
  });

  it("only takes real web addresses", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeNull();
    expect(normalizeUrl("https://user:pw@example.org")).toBeNull();
    expect(normalizeUrl("www.example.org/pta")).toBe("https://www.example.org/pta");
  });

  it("gives the winner a year after the event to redeem", () => {
    expect(claimByForEvent("2027-03-14")).toBe("2028-03-14");
    expect(claimByForEvent("2028-02-29")).toBe("2029-02-28");
  });
});

describe("automatic checks", () => {
  const prior = (over: Partial<PriorRequest>): PriorRequest => ({
    id: "p1",
    status: "pending",
    eventKey: "x",
    orgName: "Other",
    eventDate: "2027-01-01",
    contactEmail: "someone@else.org",
    createdAt: "2026-10-29T00:00:00Z",
    ...over,
  });

  it("passes an official request with nothing to flag", () => {
    expect(screen(valid(), [], AT)).toEqual([]);
    expect(isOfficialEmail("pta@oakstreet.k12.nj.us", null)).toBe(true);
  });

  it("flags a personal address, a short link and bulk asks, but never a missing EIN", () => {
    const codes = screen(valid({ contactEmail: "dana@gmail.com", eventUrl: "bit.ly/abc", notes: "Could we get 20 codes to resell?" }), [], AT).map((f) => f.code);
    expect(codes).toEqual(["personal_email", "short_link", "bulk_terms"]);
  });

  it("matches the same event however it's typed, and spots approved duplicates", () => {
    const v = valid();
    expect(eventKey({ ...v, orgName: "The  Oak-Street PTA", eventName: "spring tricky tray!" })).toBe(eventKey(v));
    expect(screen(v, [prior({ eventKey: eventKey(v) })], AT).map((f) => f.code)).toEqual(["duplicate_event"]);
    expect(screen(v, [prior({ eventKey: eventKey(v), status: "approved" })], AT).map((f) => f.code)).toEqual(["already_donated"]);
    expect(screen(v, [prior({ eventKey: eventKey(v), status: "rejected" })], AT)).toEqual([]);
  });

  it("notices one email applying for many organizations", () => {
    const v = valid();
    const codes = screen(v, [prior({ contactEmail: v.contactEmail, orgName: "Elm PTA" })], AT).map((f) => f.code);
    expect(codes).toContain("contact_many_orgs");
  });
});

describe("certificates and links", () => {
  it("maps how the prize is used to the certificate's occasion", () => {
    expect(occasionFor("tricky_tray", "gala")).toBe("raffle");
    expect(occasionFor(null, "silent_auction")).toBe("auction");
    expect(occasionFor("gift_basket", "raffle")).toBe("gift_basket");
    expect(occasionFor(null, "school_fair")).toBe("fundraiser");
  });

  it("sends Readli Gives Back winners to /redeem and everyone else to /claim", () => {
    expect(claimPath("readli_gives_back")).toBe("/redeem");
    expect(claimPath(null)).toBe("/claim");
    expect(claimLink("https://readli.ai", "ABCD-EFGH-JKMN", "/redeem")).toBe("https://readli.ai/redeem#ABCD-EFGH-JKMN");
  });

  it("derives a stable status link that differs per request and secret", () => {
    expect(statusToken("s", "a")).toBe(statusToken("s", "a"));
    expect(statusToken("s", "a")).not.toBe(statusToken("s", "b"));
    expect(statusToken("t", "a")).not.toBe(statusToken("s", "a"));
    expect(statusToken("s", "a")).toMatch(/^[A-Za-z0-9_-]{32}$/);
  });

  it("prints the program's wording, value and redemption page", () => {
    const art: MembershipArtwork = {
      giftId: "g1",
      certificate: "STT-001",
      code: "ABCD-EFGH-JKMN",
      recipientName: null,
      batch: {
        id: "b1", label: null, prefix: "STT", sponsorName: "Readli", sponsorIsReadli: true, eventName: "Spring Tricky Tray", occasion: "raffle", months: 12,
        message: null, claimBy: "2028-03-14T23:59:59.000Z", createdAt: "2026-10-30T00:00:00Z", program: "readli_gives_back", supportingName: "Oak Street PTA",
      },
    };
    const pdf = membershipCertificate(art, "https://readli.ai", { retailValue: "$179.99" });
    const text = pdf.toString("latin1");
    const start = text.indexOf("stream\n", text.indexOf("4 0 obj")) + 7;
    const len = Number(/4 0 obj\n<< \/Length (\d+)/.exec(text)![1]);
    const content = inflateSync(pdf.subarray(start, start + len)).toString("latin1");
    for (const s of ["(READLI GIVES BACK)", "(A Whole Year of Stories Awaits!)", "Proudly supporting Oak Street PTA", "readli.ai/redeem", "$179.99", "(Activate by March 14, 2028)", "No cash value", "(Every Book. Every Voice.)"]) {
      expect(content).toContain(s);
    }
  });
});

describe("CSV export", () => {
  it("quotes commas and defuses spreadsheet formulas", () => {
    const row = { reference: "RGB-ABC234", status: "approved", orgName: "=HYPERLINK(1)", orgType: "pta", state: "NJ", eventName: "Gala, 2027", eventType: "gala", eventDate: "2027-03-14", contactEmail: "a@b.org", createdAt: "2026-10-30T00:00:00Z", flags: [], batchId: "b", redemption: "unredeemed" } as unknown as AdminRequest;
    const line = requestsCsv([row]).split("\n")[1];
    expect(line).toContain("'=HYPERLINK(1)");
    expect(line).toContain('"Gala, 2027"');
  });
});
