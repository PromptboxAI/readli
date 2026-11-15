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

export interface Founder {
  name: string;
  title: string;
  /** Path under /public, or null until a photo is supplied. */
  photo: string | null;
  photoAlt: string;
  /** "Why we built Readli", in the founder's own words. One short paragraph each. */
  story: string[];
}

/** Kevin's name, photo and reason for building Readli. Story approved by Kevin (2026-11-15). */
export const FOUNDERS: Founder[] = [
  {
    name: "Kevin Godfrey",
    title: "Founder of Readli",
    photo: "/company/godfrey-family.webp",
    photoAlt: "Kevin Godfrey with his family",
    story: [
      "My mother passed away from cancer. I only knew two of my grandparents, and they were gone when I was very young. My wife lost her father when she was 15. Between us, our kids, Milly, Abby and Henry, have a family tree full of people they'll never get to hear.",
      "I can't remember what my grandparents sounded like, and that's the part that stays with me. A photo keeps a face, but a voice is what makes someone feel close, and it's the first thing you lose.",
      "So I built Readli. Grandma, Grandpa, or anyone who loves your kids records about a minute of their voice, and your children can hear classic storybooks read by them every night, no matter how far away they live.",
      "One day, hearing the people you love read to your children will mean more than you can imagine. I hope Readli gives your family what I wish mine had.",
      "From my family to yours, happy reading.",
    ],
  },
];

/** Our promises about voices, on /company and /about. */
export const PROMISES = [
  "A voice belongs to the person who recorded it. Only they can share it, and they can stop at any time.",
  "Parents choose which children hear each voice. Every newly shared voice starts switched off.",
  "A voice only reads the storybooks in the Readli library. Nobody can type in their own words for it to say.",
  "Family voices are never made public.",
];
