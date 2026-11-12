import Link from "next/link";
import { Wordmark } from "@/components/brand/Wordmark";
import { buttonPrimary } from "@/components/brand/buttons";
import { AccountMenu } from "@/components/home/AccountMenu";
import { MobileMenu } from "@/components/home/MobileMenu";
import { accountBadge, accountInitials, accountLinks, navState, primaryAction, type NavLink } from "@/lib/auth/nav-state";

const NAV: NavLink[] = [
  { href: "/#stories", label: "Stories" },
  { href: "/#how-it-works", label: "How it Works" },
  { href: "/#families", label: "For Families" },
  { href: "/pricing", label: "Pricing" },
];

const desktopLink = "font-display font-medium hover:underline";
const mobileLink = "min-h-11 rounded-2xl px-3 py-2 font-display hover:bg-ivory";
const mobileLogin = `${mobileLink} font-bold text-mint-deep`;
const compactPrimary = `${buttonPrimary} min-h-11 px-4 text-base`;

/**
 * The public site header. It knows who is visiting before the page is sent, so a signed-in grown-up
 * never sees the visitor buttons first. A kids device gets no account menu or sign-out.
 */
export async function SiteHeader({ hidePrimary = false }: { hidePrimary?: boolean } = {}) {
  const nav = await navState();
  const primary = hidePrimary ? null : primaryAction(nav);
  const account =
    nav.kind === "adult" ? { name: nav.name, email: nav.email, initials: accountInitials(nav.name, nav.email), avatarUrl: nav.avatarUrl ?? null, badge: accountBadge(nav), links: accountLinks(nav) } : null;
  return (
    <header className="sticky top-0 z-30 border-b border-ink/10 bg-ivory/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <Wordmark />
        <nav aria-label="Main" className="hidden items-center gap-6 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={desktopLink}>
              {item.label}
            </Link>
          ))}
          {nav.kind === "visitor" && (
            <Link href="/login" className={desktopLink}>
              Log in
            </Link>
          )}
          {primary && (
            <Link href={primary.href} className={buttonPrimary}>
              {primary.label}
            </Link>
          )}
          {account && <AccountMenu {...account} />}
        </nav>
        <div className="flex items-center gap-2 md:hidden">
          {primary && (
            <Link href={primary.href} className={compactPrimary}>
              {primary.label}
            </Link>
          )}
          {account ? (
            <AccountMenu {...account} compact />
          ) : (
            <MobileMenu>
              <nav
                aria-label="Main"
                className="absolute right-0 mt-2 flex w-56 flex-col gap-1 rounded-3xl border-[3px] border-ink bg-surface p-3 shadow-lg"
              >
                {/* Returning visitors look for Log in first, so it leads the menu and stands out. */}
                {nav.kind === "visitor" && (
                  <>
                    <Link href="/login" className={mobileLogin}>
                      Log in
                    </Link>
                    <hr className="my-1 border-ink/15" />
                  </>
                )}
                {NAV.map((item) => (
                  <Link key={item.href} href={item.href} className={mobileLink}>
                    {item.label}
                  </Link>
                ))}
              </nav>
            </MobileMenu>
          )}
        </div>
      </div>
    </header>
  );
}
