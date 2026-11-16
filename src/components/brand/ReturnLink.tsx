"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useBack } from "@/components/nav/BackTrail";

/**
 * A "Back" link that returns to the page the visitor actually came from on this site (Pricing, How it works, a
 * guide...), and otherwise goes to `href`. Coming from another site, or opened fresh, it's a plain link.
 */
export function ReturnLink({ href, className, children }: { href: string; className?: string; children: ReactNode }) {
  const back = useBack({ href, label: "Back" });
  return (
    <Link href={back.href} className={className} onClick={back.onClick} data-testid="return-link">
      {children}
    </Link>
  );
}
