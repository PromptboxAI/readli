import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonPrimary } from "@/components/brand/buttons";
import { AccountNav } from "@/components/home/AccountNav";
import { MobileMenu } from "@/components/home/MobileMenu";

const NAV = [
  { href: "/#stories", label: "Stories" },
  { href: "/#how-it-works", label: "How it Works" },
  { href: "/#families", label: "For Families" },
  { href: "/pricing", label: "Pricing" },
];

const desktopLink = "font-display font-medium hover:underline";
const mobileLink = "min-h-11 rounded-2xl px-3 py-2 font-display hover:bg-ivory";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={desktopLink}>
              {item.label}
            </Link>
          ))}
          <AccountNav linkClass={desktopLink} buttonClass={`${desktopLink} cursor-pointer`} />
          <Link href="/try" className={buttonPrimary}>
            Try It Free
          </Link>
        </nav>
        <MobileMenu>
          <nav
            aria-label="Main"
            className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-3xl border-[3px] border-ink bg-surface p-3 shadow-lg"
          >
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className={mobileLink}>
                {item.label}
              </Link>
            ))}
            <AccountNav linkClass={mobileLink} buttonClass={`${mobileLink} cursor-pointer text-left`} />
            <Link href="/try" className={`${buttonPrimary} mt-1`}>
              Try It Free
            </Link>
          </nav>
        </MobileMenu>
      </div>
    </header>
  );
}
