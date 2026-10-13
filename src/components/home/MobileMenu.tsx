"use client";

import { useEffect, useRef } from "react";

/**
 * Phone menu. Works without JS as a plain <details>; with JS it closes once a link inside is tapped,
 * when someone taps anywhere outside it, or on Escape.
 */
export function MobileMenu({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDetailsElement>(null);
  useEffect(() => {
    const close = () => ref.current?.removeAttribute("open");
    const onPointerDown = (e: PointerEvent) => {
      if (ref.current?.open && !ref.current.contains(e.target as Node)) close();
    };
    const onKeyDown = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);
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
