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

/** Kevin's name, photo and reason for building Readli (2026-10-24). Story in his own words. */
export const FOUNDERS: Founder[] = [
  {
    name: "Kevin Godfrey",
    title: "Founder of Readli",
    photo: "/company/godfrey-family.webp",
    photoAlt: "Kevin Godfrey with his family",
    story: [
      "I built Readli for my three kids, Milly, Abby and Henry. I wanted them to fall asleep hearing the voices of the people who love them, even when those people couldn't be there in person.",
      "That idea grew into something bigger: a way for grandparents, aunts, uncles and loved ones to be part of bedtime, no matter how far away they live.",
      "And because these voices belong to real people, I believe they should always remain in the hands of the people who shared them. It's how I'd want my own family's voices treated.",
    ],
  },
];
