"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import type { NavLink } from "@/lib/auth/nav-links";
import { settingsLink, SETTINGS_HOME } from "@/lib/family/settings-nav";

const item = "block w-full rounded-2xl px-3 py-2 text-left font-display font-medium hover:bg-ivory";
const tones = { offer: "text-mint-deep", danger: "text-coral-deep" } as const;

/**
 * The signed-in grown-up's account button and menu. Sign out lives here, never in the main nav.
 * On phones the menu also carries the public site links, since there is no separate Menu.
 */
export function AccountMenu(props: { name: string; email: string | null; initials: string; avatarUrl?: string | null; badge: string | null; links: NavLink[]; explore?: NavLink[]; compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [brokenPhoto, setBrokenPhoto] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  const name = props.name || "Your account";
  // Settings remembers the page it was opened from, so its way back returns there.
  const path = usePathname();
  const href = (l: NavLink) => (l.href === SETTINGS_HOME ? settingsLink(l.href, path) : l.href);
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
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        aria-label={props.compact ? (props.name ? `Account menu for ${props.name}` : "Account menu") : undefined}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-[3px] border-ink bg-surface py-1 pr-3 pl-1 font-display font-semibold"
      >
        {/* Initials under the photo, so the circle is never blank while the photo loads or if it can't. */}
        <span aria-hidden="true" className="relative grid size-9 place-items-center overflow-hidden rounded-full bg-mint text-sm">
          {props.initials}
          {props.avatarUrl && brokenPhoto !== props.avatarUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- a permission-checked route, not a static asset
            <img src={props.avatarUrl} alt="" onError={() => setBrokenPhoto(props.avatarUrl!)} className="absolute inset-0 size-full object-cover" />
          )}
        </span>
        {!props.compact && <span className="max-w-32 truncate">{props.name ? props.name.split(" ")[0] : "Account"}</span>}
        <span aria-hidden="true" className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {open && (
        <div
          id={id}
          className="absolute right-0 z-40 mt-2 flex w-72 max-w-[calc(100vw-2rem)] flex-col gap-0.5 rounded-3xl border-[3px] border-ink bg-surface p-3 text-left shadow-lg"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          <div className="mb-1 border-b border-ink/15 px-3 pb-2">
            <p className="truncate font-display font-semibold">{name}</p>
            {props.email && <p className="truncate text-sm text-muted">{props.email}</p>}
            {props.badge && <p className="mt-1 inline-block rounded-full bg-sunshine px-2.5 py-0.5 text-xs font-bold">{props.badge}</p>}
          </div>
          <nav aria-label="Account" className="flex flex-col gap-0.5">
            {props.links.map((l, i) => (
              <span key={l.href} className="contents">
                {l.tone === "offer" && props.links[i - 1]?.tone !== "offer" && <hr className="my-1 border-ink/15" />}
                <Link href={href(l)} className={`${item} ${l.tone ? tones[l.tone] : ""}`}>
                  {l.label}
                </Link>
              </span>
            ))}
          </nav>
          {props.explore && props.explore.length > 0 && (
            <nav aria-label="Explore Readli" className="flex flex-col gap-0.5">
              <hr className="my-1 border-ink/15" />
              <p className="px-3 pt-1 text-xs font-bold tracking-wider text-muted uppercase">Explore Readli</p>
              {props.explore.map((l) => (
                <Link key={l.href} href={l.href} className={item}>
                  {l.label}
                </Link>
              ))}
            </nav>
          )}
          <hr className="my-1 border-ink/15" />
          <form action="/auth/signout" method="post">
            <button type="submit" className={`${item} cursor-pointer ${tones.danger}`}>
              Sign out
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
