import Link from "next/link";

/** The two halves of Complimentary memberships: giving them, and the list of who has one. */
export function ComplimentaryTabs({ current }: { current: "give" | "who" }) {
  const tab = (active: boolean) =>
    `rounded-full px-4 py-2 font-display font-semibold ${active ? "bg-ink text-ivory" : "bg-surface ring-2 ring-ink/15 hover:ring-ink/40"}`;
  return (
    <nav aria-label="Complimentary memberships" className="flex flex-wrap gap-2">
      <Link href="/admin/complimentary" aria-current={current === "give" ? "page" : undefined} className={tab(current === "give")}>
        Give a membership
      </Link>
      <Link href="/admin/complimentary/memberships" aria-current={current === "who" ? "page" : undefined} className={tab(current === "who")}>
        Who has a membership
      </Link>
    </nav>
  );
}
