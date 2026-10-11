import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonPrimary } from "@/components/brand/buttons";
import { MobileMenu } from "@/components/home/MobileMenu";

const NAV = [
  { href: "/#stories", label: "Stories" },
  { href: "/#how-it-works", label: "How it Works" },
  { href: "/#families", label: "For Families" },
  { href: "/pricing", label: "Pricing" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="font-display font-medium hover:underline">
              {item.label}
            </Link>
          ))}
          <Link href="/login" className="font-display font-medium hover:underline">
            Login
          </Link>
          <Link href="/try" className={buttonPrimary}>
            Try It Free
          </Link>
        </nav>
        <MobileMenu>
          <nav
            aria-label="Main"
            className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-3xl border-[3px] border-ink bg-surface p-3 shadow-lg"
          >
            {[...NAV, { href: "/login", label: "Login" }].map((item) => (
              <Link key={item.href} href={item.href} className="min-h-11 rounded-2xl px-3 py-2 font-display hover:bg-ivory">
                {item.label}
              </Link>
            ))}
            <Link href="/try" className={`${buttonPrimary} mt-1`}>
              Try It Free
            </Link>
          </nav>
        </MobileMenu>
      </div>
    </header>
  );
}
