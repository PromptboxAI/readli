"use client";

import Link from "next/link";
import type { MouseEvent, ReactNode } from "react";

/**
 * A "Back" link that returns to the page the visitor actually came from on this site (Pricing, How it works, a
 * guide...), and otherwise goes to `href`. Coming from another site, or opened fresh, it's a plain link.
 */
export function ReturnLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    try {
      const from = document.referrer ? new URL(document.referrer) : null;
      if (from && from.origin === window.location.origin && from.pathname !== window.location.pathname && window.history.length > 1) {
        e.preventDefault();
        window.history.back();
      }
    } catch {
      // A referrer that isn't a URL: follow the link.
    }
  };
  return (
    <Link href={href} className={className} onClick={onClick} data-testid="return-link">
      {children}
    </Link>
  );
}
