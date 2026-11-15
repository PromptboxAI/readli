/**
 * Real words from Readli families, shared with permission (Kevin, 2026-11-15). Only add quotes a family
 * actually gave us and agreed to publish: never write or edit one. `who` is how they asked to be named.
 */
export interface Testimonial {
  quote: string;
  name: string;
  who: string;
}

export const TESTIMONIALS: Testimonial[] = [
  { quote: "This is so cool!", name: "Ginny V.", who: "Mimi to 5 grandkids" },
  { quote: "It's amazing how this sounds exactly like me!", name: "Andrea", who: "Mom of 3" },
  { quote: "Haha I love this so much!", name: "Kristin", who: "Mom of 2" },
];
