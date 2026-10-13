"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Wordmark } from "@/components/brand/Wordmark";
import { AccountMenu } from "@/components/home/AccountMenu";
import type { NavLink } from "@/lib/auth/nav-links";

type Tab = { label: string; icon: string; href: string; match: string[] } | { label: string; icon: string; items: NavLink[]; match: string[] };

/**
 * Parent Portal sections: Home | Books | Family | Kids | More. Only pages that exist today are linked;
 * Privacy joins More when that page lands. Kids sets up Readli Kids devices.
 */
const NAV: Tab[] = [
  { label: "Home", icon: "⌂", href: "/family", match: ["/family"] },
  { label: "Books", icon: "▤", href: "/family/books", match: ["/family/books"] },
  {
    label: "Family",
    icon: "♥",
    match: ["/family/kids", "/family/narrators", "/family/my-voice"],
    items: [
      { href: "/family/kids", label: "Child profiles" },
      { href: "/family/narrators", label: "Family Circle and storytellers" },
      { href: "/family/my-voice", label: "My Voice" },
    ],
  },
  { label: "Kids", icon: "☺", href: "/family/devices", match: ["/family/devices"] },
  {
    label: "More",
    icon: "≡",
    match: ["/family/controls", "/family/billing", "/family/credits", "/family/account"],
    items: [
      { href: "/family/controls", label: "All parent controls" },
      { href: "/family/billing", label: "Plan and billing" },
      { href: "/family/credits", label: "Credits" },
      { href: "/family/devices", label: "Devices" },
      { href: "/family/account", label: "Account settings" },
    ],
  },
];

function isActive(tab: Tab, path: string): boolean {
  return tab.match.some((m) => (m === "/family" ? path === m : path === m || path.startsWith(`${m}/`)));
}

/** A tab that opens a short list, above the bar on phones and below it on desktop. */
function MenuTab({ tab, active, phone }: { tab: Extract<Tab, { items: NavLink[] }>; active: boolean; phone?: boolean }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);
  return (
    <div ref={ref} className={phone ? "relative flex flex-1 justify-center" : "relative"}>
      <button type="button" aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)} className={phone ? phoneTab(active) : desktopTab(active)}>
        {phone && <span aria-hidden="true" className="text-xl leading-none">{tab.icon}</span>}
        {tab.label}
        {!phone && <span aria-hidden="true" className="text-xs">▾</span>}
      </button>
      {open && (
        <div
          id={id}
          className={`absolute z-40 flex w-64 flex-col gap-0.5 rounded-3xl border-[3px] border-ink bg-surface p-3 text-left shadow-lg ${phone ? "right-0 bottom-full mb-3" : "left-0 mt-2"}`}
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          {tab.items.map((l) => (
            <Link key={l.href} href={l.href} className="block rounded-2xl px-3 py-2 font-display font-medium hover:bg-ivory">
              {l.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

const desktopTab = (active: boolean) =>
  `flex min-h-11 cursor-pointer items-center gap-1 rounded-full px-4 font-display font-medium ${active ? "bg-ink text-white" : "hover:bg-ink/10"}`;
const phoneTab = (active: boolean) =>
  `flex min-h-14 w-full cursor-pointer flex-col items-center justify-center gap-0.5 font-display text-xs font-semibold ${active ? "text-coral-deep" : "text-ink"}`;

/** The Parent Portal's own navigation: app tabs on desktop, a bottom bar on phones, Sign out in the account menu. */
export function ParentNav({ account }: { account: { name: string; email: string | null; initials: string; badge: string | null; links: NavLink[] } }) {
  const path = usePathname() ?? "";
  const tabs = (phone?: boolean) =>
    NAV.map((tab) =>
      "items" in tab ? (
        <MenuTab key={tab.label} tab={tab} active={isActive(tab, path)} phone={phone} />
      ) : phone ? (
        <Link key={tab.label} href={tab.href} aria-current={isActive(tab, path) ? "page" : undefined} className={`flex-1 ${phoneTab(isActive(tab, path))}`}>
          <span aria-hidden="true" className="text-xl leading-none">
            {tab.icon}
          </span>
          {tab.label}
        </Link>
      ) : (
        <Link key={tab.label} href={tab.href} aria-current={isActive(tab, path) ? "page" : undefined} className={desktopTab(isActive(tab, path))}>
          {tab.label}
        </Link>
      ),
    );
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
