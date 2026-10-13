"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { initials } from "@/lib/content/example-family";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

interface Account {
  name: string;
  email: string | null;
}

/** The grown-up signed in on this device, or null. Read from the local session, so it costs no request. */
function useAccount(): Account | null {
  const [account, setAccount] = useState<Account | null>(null);
  useEffect(() => {
    if (!url || !key) return;
    const auth = createBrowserClient(url, key).auth;
    const set = (user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined) => {
      if (!user) return setAccount(null);
      const meta = user.user_metadata ?? {};
      const named = [meta.full_name, meta.name].find((v): v is string => typeof v === "string" && Boolean(v.trim()));
      setAccount({ name: named?.trim() || user.email?.split("@")[0] || "Grown-up", email: user.email ?? null });
    };
    auth.getSession().then(({ data }) => set(data.session?.user));
    const { data } = auth.onAuthStateChange((_event, session) => set(session?.user));
    return () => data.subscription.unsubscribe();
  }, []);
  return account;
}

const ACCOUNT_LINKS = [
  { href: "/family", label: "My family" },
  { href: "/family/account", label: "Account settings" },
];

function SignOut({ className }: { className: string }) {
  return (
    <form action="/auth/signout" method="post">
      <button type="submit" className={className}>
        Sign out
      </button>
    </form>
  );
}

/** Right side of the desktop header: Login and Try It Free for visitors, an account menu once signed in. */
export function HeaderActions({ linkClass }: { linkClass: string }) {
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const menuId = useId();
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

  if (!account) {
    return (
      <>
        <Link href="/login" className={linkClass}>
          Login
        </Link>
        <Link href="/try" className={buttonPrimary}>
          Try It Free
        </Link>
      </>
    );
  }
  const item = "block w-full rounded-2xl px-3 py-2 text-left font-display hover:bg-ivory";
  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className="flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-[3px] border-ink bg-surface py-1 pr-4 pl-1 font-display font-semibold hover:-translate-y-0.5"
      >
        <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-mint text-sm">
          {initials(account.name) || "?"}
        </span>
        <span className="max-w-32 truncate">{account.name}</span>
        <span aria-hidden="true" className={`text-xs transition-transform ${open ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>
      {open && (
        <div
          id={menuId}
          className="absolute right-0 mt-2 flex w-60 flex-col gap-1 rounded-3xl border-[3px] border-ink bg-surface p-3 shadow-lg"
          onClick={(e) => (e.target as HTMLElement).closest("a") && setOpen(false)}
        >
          {account.email && <p className="truncate px-3 pb-2 text-sm text-muted">{account.email}</p>}
          {ACCOUNT_LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={item}>
              {l.label}
            </Link>
          ))}
          <hr className="my-1 border-ink/15" />
          <SignOut className={`${item} cursor-pointer text-coral-deep`} />
        </div>
      )}
    </div>
  );
}

/** Bottom of the phone menu: Login and Try It Free for visitors, account links once signed in. */
export function MobileAccountItems({ linkClass }: { linkClass: string }) {
  const account = useAccount();
  if (!account) {
    return (
      <>
        <Link href="/login" className={linkClass}>
          Login
        </Link>
        <Link href="/try" className={`${buttonPrimary} mt-1`}>
          Try It Free
        </Link>
      </>
    );
  }
  return (
    <>
      <hr className="my-1 border-ink/15" />
      <p className="truncate px-3 text-sm text-muted">{account.name}</p>
      {ACCOUNT_LINKS.map((l) => (
        <Link key={l.href} href={l.href} className={linkClass}>
          {l.label}
        </Link>
      ))}
      <SignOut className={`${linkClass} w-full cursor-pointer text-left text-coral-deep`} />
    </>
  );
}
