/** Who runs Readli, as the Privacy Policy and Terms name it. One place, so every page says the same thing. */
export const COMPANY = {
  legalName: "Readli.ai LLC",
  street: "2168 Nesconset Hwy, Ste 101",
  city: "Stony Brook",
  region: "NY",
  postalCode: "11790",
  country: "US",
  email: "admin@readli.ai",
} as const;

export const COMPANY_ADDRESS = `${COMPANY.street}, ${COMPANY.city}, ${COMPANY.region} ${COMPANY.postalCode}`;

/** "Readli.ai LLC · Stony Brook, NY": short enough for a footer. */
export const COMPANY_SHORT = `${COMPANY.legalName} · ${COMPANY.city}, ${COMPANY.region}`;

export interface Founder {
  name: string;
  title: string;
  /** Path under /public, or null until a photo is supplied. */
  photo: string | null;
  photoAlt: string;
  /** "Why we built Readli", in the founder's own words. One short paragraph each. */
  story: string[];
}

/** Kevin's name, photo and reason for building Readli (2026-10-24). The story lines are his to approve. */
export const FOUNDERS: Founder[] = [
  {
    name: "Kevin Godfrey",
    title: "Founder",
    photo: "/company/godfrey-family.webp",
    photoAlt: "Kevin Godfrey with his family",
    story: [
      "I built Readli for Milly, Abby and Henry. I wanted them to hear the people who love them at bedtime, even on the nights we can't all be in the same room.",
      "It grew from there to grandparents, aunts, uncles and anyone whose voice a child loves. Every voice stays in the hands of the person who recorded it, because that's how I want my own family's voices treated.",
    ],
  },
];
