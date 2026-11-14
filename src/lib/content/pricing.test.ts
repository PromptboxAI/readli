import { describe, expect, it } from "vitest";
import { annualMonthlyCents, perNightCents, type Pricing } from "./pricing";

describe("perNightCents", () => {
  it("prices $19.99 a month and $179.99 a year per night", () => {
    const p = { familyMonthlyCents: 1999, familyAnnualCents: 17999 } as Pricing;
    expect(perNightCents(p)).toEqual({ monthly: 66, annual: 49 });
  });
});

describe("annualMonthlyCents", () => {
  it("shows $179.99 a year as $15.00 a month", () => {
    expect(annualMonthlyCents({ familyAnnualCents: 17999 } as Pricing)).toBe(1500);
  });
});
