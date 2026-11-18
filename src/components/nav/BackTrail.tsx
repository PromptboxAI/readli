"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useEffect, useSyncExternalStore } from "react";
import { backTarget, moveTo, nameEntry, pushEntry, replaceEntry, type Trail } from "@/lib/nav/trail";

/**
 * One shared way back for every Back arrow and breadcrumb: it returns to the page the visitor actually
 * came from in this tab (Home's Play → Listen → Back is Home again), and only uses the page's fixed
 * `fallback` when they arrived here directly (a fresh tab, an email link, another site).
 *
 * <BackTrail /> in the root layout keeps the tab's trail in step with the browser's history: every
 * history.pushState/replaceState (which is how Next.js navigates) and every Back/Forward.
 */

const KEY = "readli-trail";
const STATE_KEY = "__readliTrail";

let trail: Trail = { entries: [], index: -1 };
let way: ReturnType<typeof backTarget> = null;
let started = false;
const listeners = new Set<() => void>();

const here = () => `${window.location.pathname}${window.location.search}${window.location.hash}`;

function set(next: Trail) {
  if (next === trail) return;
  trail = next;
  const t = backTarget(trail);
  // A new snapshot only when the way back changed, so React doesn't re-render for nothing.
  if (t?.url !== way?.url || t?.label !== way?.label || t?.steps !== way?.steps) way = t;
  try {
    sessionStorage.setItem(KEY, JSON.stringify(trail));
  } catch {
    // Private mode or blocked storage: the trail still works for this page's lifetime.
  }
  for (const l of listeners) l();
}

function load(): Trail {
  try {
    const t = JSON.parse(sessionStorage.getItem(KEY) ?? "null") as Trail | null;
    if (t && Array.isArray(t.entries) && typeof t.index === "number" && t.entries.every((e) => e && typeof e.url === "string")) return t;
  } catch {
    // Unreadable: start afresh.
  }
  return { entries: [], index: -1 };
}

/** A same-site URL as a path with its query and anchor; null for anything else. */
function toPath(url: string | URL | null | undefined): string | null {
  if (url == null) return null;
  try {
    const u = new URL(String(url), window.location.href);
    return u.origin === window.location.origin ? `${u.pathname}${u.search}${u.hash}` : null;
  } catch {
    return null;
  }
}

/** History state carrying which trail entry it is, keeping whatever else (Next.js's own state) it holds. */
function tag(state: unknown, index: number): unknown {
  if (state !== null && state !== undefined && (typeof state !== "object" || Array.isArray(state))) return state;
  return { ...((state as object | null) ?? {}), [STATE_KEY]: index };
}

const indexOf = (state: unknown): number | null => {
  const v = state && typeof state === "object" ? (state as Record<string, unknown>)[STATE_KEY] : undefined;
  return typeof v === "number" ? v : null;
};

/** The page heading, kept as the page's name so a Back link to it can say "The Lion and the Mouse". */
const heading = () => document.querySelector("main h1, h1")?.textContent;

function start() {
  if (started || typeof window === "undefined") return;
  started = true;
  const saved = load();
  const at = indexOf(window.history.state);
  if (at !== null) {
    // A reload, or Back/Forward into this document from another one.
    trail = moveTo(saved, at, here());
  } else {
    // A new page load: carry on the trail only when the visitor came from the page the trail is on.
    let carried = false;
    try {
      const ref = document.referrer ? new URL(document.referrer) : null;
      const top = saved.entries[saved.index];
      carried = Boolean(ref && top && ref.origin === window.location.origin && top.url.split(/[?#]/)[0] === ref.pathname && window.history.length > 1);
    } catch {
      carried = false;
    }
    trail = carried ? pushEntry(saved, here()) : { entries: [{ url: here() }], index: 0 };
  }

  const push = window.history.pushState.bind(window.history);
  const replace = window.history.replaceState.bind(window.history);
  window.history.pushState = (state: unknown, unused: string, url?: string | URL | null) => {
    const path = toPath(url) ?? here();
    const next = pushEntry(nameEntry(trail, heading()), path);
    push(tag(state, next.index), unused, url);
    set(next);
  };
  window.history.replaceState = (state: unknown, unused: string, url?: string | URL | null) => {
    const path = toPath(url) ?? here();
    const next = replaceEntry(trail, path);
    replace(tag(state, next.index), unused, url);
    set(next);
  };
  window.addEventListener("popstate", (e) => {
    const index = indexOf(e.state);
    if (index !== null) return set(moveTo(trail, index, here()));
    // An entry the trail never tagged, such as a same-page #anchor link: a new step on this page.
    const next = trail.entries[trail.index]?.url.split(/[?#]/)[0] === window.location.pathname ? pushEntry(trail, here()) : { entries: [{ url: here() }], index: 0 };
    replace(tag(window.history.state, next.index), "");
    set(next);
  });
  // Name the page as the visitor leaves it, whether by a link or by a full page load.
  document.addEventListener("click", () => set(nameEntry(trail, heading())), true);
  window.addEventListener("pagehide", () => set(nameEntry(trail, heading())));

  replace(tag(window.history.state, trail.index), "");
  set({ ...trail });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Mounted once in the root layout so the trail follows every page from the first one. */
export function BackTrail() {
  useEffect(() => start(), []);
  return null;
}

export type BackFallback = { href: string; label: string };

/**
 * The way back from this page: the page the visitor came from when there is one, otherwise `fallback`.
 * `returning` says which. The server render (and the first client render) always shows the fallback.
 */
export function useBack(fallback: BackFallback): { href: string; label: string; returning: boolean; onClick: (e: MouseEvent<HTMLAnchorElement>) => void } {
  const target = useSyncExternalStore(
    subscribe,
    () => way,
    () => null,
  );
  const onClick = (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const now = backTarget(trail);
    if (!now) return;
    e.preventDefault();
    window.history.go(-now.steps);
  };
  return target ? { href: target.url, label: target.label, returning: true, onClick } : { href: fallback.href, label: fallback.label, returning: false, onClick };
}

/**
 * A link back to where the visitor came from, or to `fallback`, usable from server pages. `look` sets the
 * words around the label: "arrow" is "← Home", "back-to" is "Back to Home", "plain" is just "Home".
 */
export function BackTo({
  fallback,
  look = "arrow",
  className,
  testId = "back-link",
}: {
  fallback: BackFallback;
  look?: "arrow" | "back-to" | "plain";
  className?: string;
  testId?: string;
}) {
  const back = useBack(fallback);
  return (
    <Link href={back.href} className={className} onClick={back.onClick} data-testid={testId} data-returning={back.returning ? "true" : undefined}>
      {look === "arrow" && <span aria-hidden="true">←&nbsp;</span>}
      {look === "back-to" && back.label !== "Back" ? `Back to ${back.label}` : back.label}
    </Link>
  );
}
