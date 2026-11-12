"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { NavLink } from "@/lib/auth/nav-links";

/** Marks the hero's own sign-up button, so the phone header doesn't show a second one beside it. */
const HERO_CTA = "data-hero-cta";

/**
 * The phone header button for a visitor on a page whose hero has its own sign-up button (Kevin, 2026-11-11).
 * While that button is on screen the header offers Log in; once it scrolls away the header offers the main action.
 */
export function MobileVisitorAction({ primary, primaryClass, logInClass }: { primary: NavLink; primaryClass: string; logInClass: string }) {
  const [heroInView, setHeroInView] = useState(true);
  useEffect(() => {
    const hero = document.querySelector(`[${HERO_CTA}]`);
    if (!hero) {
      setHeroInView(false);
      return;
    }
    // The sticky header covers the top of the page, so a button tucked under it counts as scrolled away.
    const observer = new IntersectionObserver(([entry]) => setHeroInView(entry.isIntersecting), { rootMargin: "-72px 0px 0px 0px" });
    observer.observe(hero);
    return () => observer.disconnect();
  }, []);
  return heroInView ? (
    <Link href="/login" className={logInClass}>
      Log in
    </Link>
  ) : (
    <Link href={primary.href} className={primaryClass}>
      {primary.label}
    </Link>
  );
}
