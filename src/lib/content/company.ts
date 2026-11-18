/** Who runs Readli, as the Privacy Policy and Terms name it. One place, so every page says the same thing. */
export const COMPANY = {
  legalName: "Promptbox, LLC",
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

/** Kevin's name, photo and reason for building Readli. Story in Kevin's own words (2026-11-15). */
export const FOUNDERS: Founder[] = [
  {
    name: "Kevin Godfrey",
    title: "Founder, Readli",
    photo: "/company/godfrey-family.webp",
    photoAlt: "Kevin Godfrey with his family",
    story: [
      "My mother passed away from cancer. I lost the only two grandparents I ever knew when I was very young. My wife lost her father when she was just 15.",
      "Between us, our three children, Milly, Abby, and Henry, have a family tree filled with people they'll never get to hear.",
      "I have pictures of my grandparents, but I can't remember what their voices sounded like. That's the part that stays with me. Photos remind us what someone looked like, but there's something about hearing a familiar voice that brings them back in a way a picture never can.",
      "And once that voice is gone, it's gone.",
      "That's why I built Readli.",
      "With just a minute of recording, Grandma, Grandpa, or anyone your children love can share their voice. Readli uses it to bring classic storybooks to life, so your kids can hear the people they love reading to them at bedtime, whether they're across the country or just down the road.",
      "Today, it's a bedtime story. Years from now, it could be something your children treasure more than anything.",
      "I built Readli because I wish I could hear those voices again. My hope is that your family never has to wish for the same thing.",
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
