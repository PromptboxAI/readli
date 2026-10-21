"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Wordmark } from "@/components/brand/Wordmark";
import { AccountMenu } from "@/components/home/AccountMenu";
import type { NavLink } from "@/lib/auth/nav-links";

type Tab = { label: string; href: string; match: string[]; icon: React.ReactNode };

const icon = (paths: React.ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

/**
 * Parent Portal sections: Home | Books | Family | Parent Controls. Family is the kids and who reads to them
 * (each child's profile is where Readli Kids opens); Parent Controls opens every setting directly, including
 * Kids Mode devices, credits, billing, storytellers and voices.
 */
const NAV: Tab[] = [
  { label: "Home", href: "/family", match: ["/family"], icon: icon(<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />) },
  {
    label: "Books",
    href: "/family/books",
    match: ["/family/books"],
    icon: icon(
      <>
        <path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" />
        <path d="M4 19V5" />
      </>,
    ),
  },
  {
    label: "Family",
    href: "/family/kids",
    match: ["/family/kids"],
    icon: icon(
      <>
        <circle cx="9" cy="8" r="3" />
        <circle cx="17" cy="9" r="2.5" />
        <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
        <path d="M15 15c2.8 0 6 1.5 6 5" />
      </>,
    ),
  },
  {
    label: "Parent Controls",
    href: "/family/controls",
    match: ["/family/controls", "/family/narrators", "/family/my-voice", "/family/devices", "/family/credits", "/family/billing", "/family/account"],
    icon: icon(
      <>
        <path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" />
        <circle cx="16" cy="6" r="2" />
        <circle cx="10" cy="12" r="2" />
        <circle cx="18" cy="18" r="2" />
      </>,
    ),
  },
];

function isActive(tab: Tab, path: string): boolean {
  return tab.match.some((m) => (m === "/family" ? path === m : path === m || path.startsWith(`${m}/`)));
}

const desktopTab = (active: boolean) =>
  `flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-4 font-display font-medium ${active ? "bg-ink text-white" : "hover:bg-ink/10"}`;
const phoneTab = (active: boolean) =>
  `flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center gap-0.5 px-1 text-center font-display text-xs leading-tight font-semibold ${active ? "text-coral-deep" : "text-ink"}`;

/** The Parent Portal's own navigation: tabs on desktop, a bottom bar on phones, Sign out in the account menu. */
export function ParentNav({ account }: { account: { name: string; email: string | null; initials: string; avatarUrl: string | null; badge: string | null; links: NavLink[] } }) {
  const path = usePathname() ?? "";
  const tabs = (phone?: boolean) =>
    NAV.map((tab) => {
      const active = isActive(tab, path);
      return (
        <Link key={tab.label} href={tab.href} aria-current={active ? "page" : undefined} className={phone ? phoneTab(active) : desktopTab(active)}>
          {phone && tab.icon}
          {tab.label}
        </Link>
      );
    });
  return (
    <>
      <header className="sticky top-0 z-30 border-b border-ink/10 bg-ivory/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2">
            <Wordmark />
            {account.badge && <span className="rounded-full bg-sunshine px-2.5 py-0.5 text-xs font-bold">{account.badge}</span>}
          </div>
          <nav aria-label="Readli Family" className="hidden items-center gap-1 md:flex">
            {tabs()}
          </nav>
          <div className="hidden md:block">
            <AccountMenu {...account} />
          </div>
          <div className="md:hidden">
            <AccountMenu {...account} compact />
          </div>
        </div>
      </header>
      <nav aria-label="Readli Family" className="fixed inset-x-0 bottom-0 z-30 flex border-t-2 border-ink/15 bg-surface pb-[env(safe-area-inset-bottom)] md:hidden">
        {tabs(true)}
      </nav>
    </>
  );
}
