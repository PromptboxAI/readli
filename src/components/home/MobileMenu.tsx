"use client";

import { useRef } from "react";

/** Phone menu. Works without JS as a plain <details>; with JS it closes once a link inside is tapped. */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  return (
    <details
      ref={ref}
      className="relative md:hidden"
      onClick={(e) => {
        if ((e.target as HTMLElement).closest("a")) ref.current?.removeAttribute("open");
      }}
    >
      <summary className="flex min-h-12 cursor-pointer list-none items-center rounded-full border-[3px] border-ink px-4 font-display font-semibold [&::-webkit-details-marker]:hidden">
        Menu
      </summary>
      {children}
    </details>
  );
}
