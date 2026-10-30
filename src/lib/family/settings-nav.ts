/** The sections of Settings, in rail order. Account is the Settings page itself on desktop. */
export type SettingsSection = "account" | "parents" | "plan" | "kids-mode";

export const SETTINGS_HOME = "/family/settings";

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string; href: string; guardianOnly: boolean }[] = [
  { id: "account", label: "Account", href: SETTINGS_HOME, guardianOnly: false },
  { id: "parents", label: "Parents", href: `${SETTINGS_HOME}/parents`, guardianOnly: true },
  { id: "plan", label: "Plan & credits", href: `${SETTINGS_HOME}/plan`, guardianOnly: true },
  { id: "kids-mode", label: "Kids Mode", href: `${SETTINGS_HOME}/kids-mode`, guardianOnly: true },
];

/** Where each section opens from the phone list. Account has its own page there, so the list can stay a list. */
export const phoneHref = (id: SettingsSection) => (id === "account" ? `${SETTINGS_HOME}/account` : SETTINGS_SECTIONS.find((s) => s.id === id)!.href);

/** Pages Settings can be opened from, longest first so a nested page wins over its parent. */
const PLACES: [string, string][] = [
  ["/family/narrators", "Family storytellers"],
  ["/family/my-voice", "My Voice"],
  ["/family/books", "Books"],
  ["/family/kids", "Family"],
  ["/family", "Home"],
  ["/voice", "My Voice"],
  ["/books", "Books"],
  ["/help", "Help"],
];

/**
 * The way back from Settings to the page that opened it, from the `from` the account menu adds. Only a
 * plain same-site path is used, never another site or Settings itself; anything else goes Home.
 */
export function settingsBack(from: string | string[] | undefined | null): { href: string; label: string } {
  const home = { href: "/family", label: "Home" };
  if (typeof from !== "string" || from.length > 200 || !/^\/[A-Za-z0-9/_-]*$/.test(from) || from.startsWith("//")) return home;
  if (from === SETTINGS_HOME || from.startsWith(`${SETTINGS_HOME}/`)) return home;
  if (from === "/") return { href: "/", label: "Home" };
  const place = PLACES.find(([p]) => from === p || from.startsWith(`${p}/`));
  return { href: from, label: place ? place[1] : "Back" };
}

/** A link into Settings that remembers the page it was opened from. */
export function settingsLink(href: string, from: string | null): string {
  if (!from || from === SETTINGS_HOME || from.startsWith(`${SETTINGS_HOME}/`)) return href;
  return `${href}${href.includes("?") ? "&" : "?"}from=${encodeURIComponent(from)}`;
}
