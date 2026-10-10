import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";

/** Page frame for the adult-only family pages (invites, gifts, rewards). Never used in Readli Kids. */
export function AdultPage({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <SiteHeader />
      <main className={`mx-auto flex w-full flex-col gap-10 px-4 py-10 sm:px-6 sm:py-14 ${wide ? "max-w-6xl" : "max-w-4xl"}`}>
        {children}
      </main>
      <SiteFooter />
    </>
  );
}

/** Until family accounts arrive (Phase 4), these screens are working previews: nothing is sent or charged. */
export function PreviewNote({ children }: { children?: React.ReactNode }) {
  return (
    <p role="note" className="rounded-2xl bg-lavender/40 px-4 py-3 text-sm">
      <span className="font-semibold">Preview.</span>{" "}
      {children ?? "Family accounts are coming soon, so nothing here is sent or charged yet."}
    </p>
  );
}

export function Eyebrow({ children }: { children: React.ReactNode }) {
  return <p className="font-display text-lg font-semibold text-coral-deep">{children}</p>;
}
