"use client";

import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { useEffect, useState } from "react";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Whether a grown-up is signed in on this device. Read from the local session, so it costs no request. */
function useSignedIn(): boolean {
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    if (!url || !key) return;
    const auth = createBrowserClient(url, key).auth;
    auth.getSession().then(({ data }) => setSignedIn(Boolean(data.session)));
    const { data } = auth.onAuthStateChange((_event, session) => setSignedIn(Boolean(session)));
    return () => data.subscription.unsubscribe();
  }, []);
  return signedIn;
}

/** "Login" for visitors; "My family" and "Sign out" once a grown-up is signed in. */
export function AccountNav({ linkClass, buttonClass }: { linkClass: string; buttonClass: string }) {
  if (!useSignedIn()) {
    return (
      <Link href="/login" className={linkClass}>
        Login
      </Link>
    );
  }
  return (
    <>
      <Link href="/family" className={linkClass}>
        My family
      </Link>
      <form action="/auth/signout" method="post" className="contents">
        <button type="submit" className={buttonClass}>
          Sign out
        </button>
      </form>
    </>
  );
}
