/**
 * Example family for the homepage tree (Design Revision 001 §2). Demo only:
 * nothing here is a real person, and relationship labels are display-only (Amendment F-8).
 */

/** Mirrors the PRD F-04 family card statuses; kids are listeners, never voices. */
export type MemberStatus = "ready_shared" | "invited" | "not_invited" | "listener";

export type ExampleMember = {
  id: string;
  name: string;
  relation: string;
  status: MemberStatus;
  /** Tailwind background class for the initials avatar. */
  tint: string;
  /** Position on the 1000 x 660 tree canvas (centre of the avatar). */
  x: number;
  y: number;
};

export const STATUS_LABELS: Record<MemberStatus, string> = {
  ready_shared: "Voice ready",
  invited: "Invitation pending",
  not_invited: "Invite to record",
  listener: "Listens to stories",
};

export const EXAMPLE_FAMILY: ExampleMember[] = [
  { id: "june", name: "Grandma June", relation: "Mom's mom", status: "ready_shared", tint: "bg-lavender", x: 150, y: 70 },
  { id: "lou", name: "Grandpa Lou", relation: "Mom's dad", status: "invited", tint: "bg-sky", x: 330, y: 70 },
  { id: "rose", name: "Nana Rose", relation: "Dad's mom", status: "ready_shared", tint: "bg-mint", x: 670, y: 70 },
  { id: "joe", name: "Grandpa Joe", relation: "Dad's dad", status: "not_invited", tint: "bg-sunshine", x: 850, y: 70 },
  { id: "priya", name: "Aunt Priya", relation: "Mom's sister", status: "ready_shared", tint: "bg-sunshine", x: 110, y: 300 },
  { id: "sara", name: "Mom", relation: "Sara, family owner", status: "ready_shared", tint: "bg-coral", x: 330, y: 300 },
  { id: "ben", name: "Dad", relation: "Ben", status: "ready_shared", tint: "bg-sky", x: 670, y: 300 },
  { id: "sam", name: "Uncle Sam", relation: "Dad's brother", status: "not_invited", tint: "bg-lavender", x: 890, y: 300 },
  { id: "ava", name: "Ava", relation: "Cousin", status: "listener", tint: "bg-mint", x: 110, y: 520 },
  { id: "maya", name: "Maya", relation: "Daughter", status: "listener", tint: "bg-coral", x: 390, y: 520 },
  { id: "leo", name: "Leo", relation: "Son", status: "listener", tint: "bg-sunshine", x: 610, y: 520 },
];

/** Connector paths on the same canvas: couples, then drops to each generation's sibling bar. */
export const TREE_LINKS: string[] = [
  "M150 70 H330", // June and Lou
  "M240 70 V225 H110 V300 M240 225 H330 V300", // to Priya and Mom
  "M670 70 H850", // Rose and Joe
  "M760 70 V225 H670 V300 M760 225 H890 V300", // to Dad and Sam
  "M330 300 H670", // Mom and Dad
  "M500 300 V450 H390 V520 M500 450 H610 V520", // to Maya and Leo
  "M110 430 V520", // Priya to Ava, starting below her name
];

export function initials(name: string): string {
  const words = name.replace(/^(Grandma|Grandpa|Nana|Aunt|Uncle)\s+/, "").split(/\s+/);
  return words.map((w) => w[0] ?? "").join("").slice(0, 2).toUpperCase();
}
