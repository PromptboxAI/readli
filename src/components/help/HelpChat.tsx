"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Fragment, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";

/**
 * The "Need help?" chat bubble (Kevin, 2026-11-15). Answers come from /api/help-chat, which reads
 * Readli's own Help Center, guides and legal pages. "Talk to a person" emails the chat to support.
 * Never shown to children: Readli Kids, the player and the recording screens leave it out.
 */

type Turn = { role: "user" | "assistant"; content: string };
type View = "chat" | "person" | "sent";

const SUPPORT = "admin@readli.ai";
const STORE = "readli-help-chat";
const MAX_CHARS = 1000;

/** Children's screens, admin, recording and print pages. */
const HIDDEN = [/^\/kids(\/|$)/, /^\/admin(\/|$)/, /^\/voice\/record/, /^\/try\/demo/, /^\/family\/books\/[^/]+\/listen/, /^\/help\/print/];
/** Pages with the parents' tab bar along the bottom on phones. */
const TAB_BAR = /^\/(family|home)(\/|$)/;

const STARTERS = ["How does Readli work?", "How do I invite Grandma to record?", "What does the Family plan include?"];

export function HelpChat({ enabled }: { enabled: boolean }) {
  const pathname = usePathname() ?? "/";
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("chat");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const token = useRef<string | null>(null);
  const list = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORE) ?? "null") as { turns?: Turn[] } | null;
      if (Array.isArray(saved?.turns)) setTurns(saved.turns.filter((t) => t && typeof t.content === "string"));
    } catch {}
  }, []);

  useEffect(() => {
    try {
      sessionStorage.setItem(STORE, JSON.stringify({ turns }));
    } catch {}
    list.current?.scrollTo({ top: list.current.scrollHeight });
  }, [turns]);

  useEffect(() => {
    if (!open) return;
    if (!token.current) void fetchToken();
    const t = setTimeout(() => input.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!enabled || HIDDEN.some((re) => re.test(pathname))) return null;

  async function fetchToken(): Promise<string | null> {
    const res = await fetch("/api/help-chat", { cache: "no-store" }).catch(() => null);
    const body = (await res?.json().catch(() => null)) as { token?: string } | null;
    token.current = body?.token ?? null;
    return token.current;
  }

  async function ask(question: string) {
    const q = question.trim();
    if (!q || busy) return;
    setError("");
    setDraft("");
    setBusy(true);
    const history: Turn[] = [...turns, { role: "user", content: q }];
    setTurns([...history, { role: "assistant", content: "" }]);
    try {
      let res = await send(history);
      if (res.status === 401) {
        await fetchToken();
        res = await send(history);
      } else if (res.status === 429 && res.headers.get("content-type")?.includes("json")) {
        const code = ((await res.clone().json().catch(() => null)) as { error?: { code?: string } } | null)?.error?.code;
        if (code === "slow_down") {
          await new Promise((r) => setTimeout(r, 1600));
          res = await send(history);
        }
      }
      if (!res.ok || !res.body) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null;
        throw new Error(body?.error?.message ?? `Sorry, something went wrong. You can email us at ${SUPPORT}.`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let answer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        answer += decoder.decode(value, { stream: true });
        setTurns([...history, { role: "assistant", content: answer }]);
      }
    } catch (err) {
      setTurns(history.slice(0, -1));
      setDraft(q);
      setError(err instanceof Error ? err.message : `Sorry, something went wrong. You can email us at ${SUPPORT}.`);
    } finally {
      setBusy(false);
      input.current?.focus();
    }
  }

  async function send(history: Turn[]) {
    const t = token.current ?? (await fetchToken());
    return fetch("/api/help-chat", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: t, messages: history }),
    });
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    void ask(draft);
  }

  function startOver() {
    setTurns([]);
    setError("");
    setView("chat");
  }

  const lift = TAB_BAR.test(pathname) ? "bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-6" : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6";

  return (
    <>
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`fixed right-4 z-40 inline-flex min-h-12 items-center gap-2 rounded-full bg-ink px-5 font-display text-lg font-semibold text-white shadow-[0_6px_20px_rgba(40,53,72,0.35)] transition-transform hover:-translate-y-0.5 active:scale-[0.97] sm:right-6 print:hidden ${lift}`}
          aria-haspopup="dialog"
        >
          <ChatIcon />
          Need help?
        </button>
      )}
      {open && (
        <div
          role="dialog"
          aria-modal="false"
          aria-labelledby="help-chat-title"
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[85dvh] flex-col overflow-hidden rounded-t-3xl border-2 border-ink/15 bg-surface shadow-[0_10px_40px_rgba(40,53,72,0.3)] sm:inset-x-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,calc(100dvh-3rem))] sm:w-[400px] sm:rounded-3xl print:hidden"
        >
          <header className="flex items-center gap-3 bg-mint/50 px-5 py-4">
            <span aria-hidden className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-mint-deep">
              <ChatIcon />
            </span>
            <div className="min-w-0 flex-1">
              <h2 id="help-chat-title" className="font-display text-xl font-semibold text-plum">
                Readli help
              </h2>
              <p className="text-sm text-muted">From our Help Center</p>
            </div>
            {turns.length > 0 && view === "chat" && (
              <button type="button" onClick={startOver} className="rounded-full px-2 py-1 text-sm font-semibold text-ink underline underline-offset-4">
                New chat
              </button>
            )}
            <button type="button" onClick={() => setOpen(false)} aria-label="Close help chat" className="grid h-11 w-11 place-items-center rounded-full hover:bg-surface/70">
              <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </header>

          {view === "chat" && (
            <>
              <div ref={list} className="flex min-h-48 flex-1 flex-col gap-3 overflow-y-auto px-4 py-4" aria-live="polite">
                <Bubble role="assistant">
                  Hi! I can answer questions about Readli: family voices, books, plans and privacy. What would you like to know?
                </Bubble>
                {turns.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {STARTERS.map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => void ask(s)}
                        className="rounded-full border-2 border-ink/20 bg-surface px-3 py-1.5 text-left text-sm font-semibold text-ink hover:border-ink/50"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
                {turns.map((t, i) => (
                  <Bubble key={i} role={t.role}>
                    {t.content ? <RichText text={t.content} onLink={() => setOpen(window.innerWidth >= 640)} /> : <Typing />}
                  </Bubble>
                ))}
                {error && (
                  <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm text-ink">
                    {error}
                  </p>
                )}
              </div>
              <form onSubmit={onSubmit} className="flex flex-col gap-2 border-t-2 border-ink/10 px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] sm:pb-3">
                <div className="flex items-end gap-2">
                  <label htmlFor="help-chat-input" className="sr-only">
                    Your question
                  </label>
                  <textarea
                    id="help-chat-input"
                    ref={input}
                    value={draft}
                    onChange={(e) => setDraft(e.target.value.slice(0, MAX_CHARS))}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        void ask(draft);
                      }
                    }}
                    rows={1}
                    placeholder="Ask a question…"
                    className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border-2 border-ink/20 bg-surface px-3 py-2 text-base focus:border-ink focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    aria-label="Send"
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-coral-deep text-white disabled:opacity-40"
                  >
                    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M5 12h13M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted">AI answers can make mistakes.</span>
                  <button type="button" onClick={() => setView("person")} className="font-semibold text-coral-deep underline underline-offset-4">
                    Talk to a person
                  </button>
                </div>
              </form>
            </>
          )}

          {view === "person" && <PersonForm turns={turns} token={token} fetchToken={fetchToken} page={pathname} onBack={() => setView("chat")} onSent={() => setView("sent")} />}

          {view === "sent" && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-10 text-center">
              <p className="font-display text-2xl font-semibold text-plum">Thanks, we&apos;ve got it.</p>
              <p>Our team will reply to you by email.</p>
              <button type="button" onClick={startOver} className="rounded-full bg-ink px-5 py-2.5 font-semibold text-white">
                Back to chat
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function PersonForm({
  turns,
  token,
  fetchToken,
  page,
  onBack,
  onSent,
}: {
  turns: Turn[];
  token: React.RefObject<string | null>;
  fetchToken: () => Promise<string | null>;
  page: string;
  onBack: () => void;
  onSent: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const hasChat = turns.some((t) => t.role === "user");

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const t = token.current ?? (await fetchToken());
    const res = await fetch("/api/help-chat/handoff", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ token: t, email: form.get("email"), name: form.get("name"), note: form.get("note"), transcript: turns, page }),
    }).catch(() => null);
    setBusy(false);
    if (res?.ok) return onSent();
    const body = (await res?.json().catch(() => null)) as { error?: { message?: string } } | null;
    setError(body?.error?.message ?? `That didn't send. Please email us at ${SUPPORT}.`);
  }

  const field = "min-h-11 w-full rounded-xl border-2 border-ink/20 bg-surface px-3 py-2 text-base focus:border-ink focus:outline-none";
  return (
    <form onSubmit={submit} className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-5">
      <p className="font-display text-xl font-semibold text-plum">Talk to a person</p>
      <p className="text-sm">
        {hasChat ? "We'll send our team this chat so you don't have to repeat yourself. " : ""}We&apos;ll reply by email.
      </p>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your email
        <input name="email" type="email" required autoComplete="email" className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        Your name <span className="font-normal text-muted">(optional)</span>
        <input name="name" type="text" autoComplete="name" maxLength={100} className={field} />
      </label>
      <label className="flex flex-col gap-1 text-sm font-semibold">
        {hasChat ? "Anything to add?" : "How can we help?"}
        <textarea name="note" rows={4} maxLength={2000} required={!hasChat} className={`${field} resize-none`} />
      </label>
      <p className="text-xs text-muted">Please don&apos;t include passwords or card numbers.</p>
      {error && (
        <p role="alert" className="rounded-xl bg-coral/15 px-3 py-2 text-sm">
          {error}
        </p>
      )}
      <div className="mt-auto flex items-center justify-between gap-3 pt-2">
        <button type="button" onClick={onBack} className="font-semibold underline underline-offset-4">
          Back
        </button>
        <button type="submit" disabled={busy} className="rounded-full bg-coral-deep px-5 py-2.5 font-semibold text-white disabled:opacity-50">
          {busy ? "Sending…" : "Send to our team"}
        </button>
      </div>
    </form>
  );
}

function Bubble({ role, children }: { role: Turn["role"]; children: ReactNode }) {
  const mine = role === "user";
  return (
    <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed ${mine ? "self-end rounded-br-md bg-sunshine/45" : "self-start rounded-bl-md bg-mint/30"}`}>
      {children}
    </div>
  );
}

function Typing() {
  return (
    <span className="inline-flex gap-1 py-1" aria-label="Writing an answer">
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-2 w-2 animate-bounce rounded-full bg-ink/50" style={{ animationDelay: `${i * 120}ms` }} />
      ))}
    </span>
  );
}

const TOKEN = /(\[[^\]]+\]\([^)\s]+\)|\*\*[^*]+\*\*|[\w.+-]+@[\w-]+\.[\w.]+[a-z])/i;

/** Answers allow [links](/path) to Readli pages, **bold**, bare emails, and "- " or "1. " lists. Nothing else renders as HTML. */
function RichText({ text, onLink }: { text: string; onLink: () => void }) {
  const blocks = text.split(/\n{2,}/);
  return (
    <>
      {blocks.map((block, b) => {
        const lines = block.split("\n").filter((l) => l.trim());
        const items = lines.filter((l) => /^\s*([-*•]|\d+\.)\s+/.test(l));
        if (items.length && items.length === lines.length) {
          const ordered = /^\s*\d+\./.test(lines[0]!);
          const Tag = ordered ? "ol" : "ul";
          return (
            <Tag key={b} className={`my-1.5 flex flex-col gap-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}>
              {items.map((l, i) => (
                <li key={i}>
                  <Inline text={l.replace(/^\s*([-*•]|\d+\.)\s+/, "")} onLink={onLink} />
                </li>
              ))}
            </Tag>
          );
        }
        return (
          <p key={b} className={b > 0 ? "mt-2" : undefined}>
            {lines.map((l, i) => (
              <Fragment key={i}>
                {i > 0 && <br />}
                <Inline text={l} onLink={onLink} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </>
  );
}

function Inline({ text, onLink }: { text: string; onLink: () => void }) {
  return text.split(TOKEN).map((part, i) => {
    if (i % 2 === 0) return <Fragment key={i}>{part}</Fragment>;
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      const [, label, href] = link as unknown as [string, string, string];
      if (href.startsWith("/") && !href.startsWith("//"))
        return (
          <Link key={i} href={href} onClick={onLink} className="font-semibold text-coral-deep underline underline-offset-4">
            {label}
          </Link>
        );
      if (href.startsWith("mailto:"))
        return (
          <a key={i} href={href} className="font-semibold text-coral-deep underline underline-offset-4">
            {label}
          </a>
        );
      return <Fragment key={i}>{label}</Fragment>;
    }
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    return (
      <a key={i} href={`mailto:${part}`} className="font-semibold text-coral-deep underline underline-offset-4">
        {part}
      </a>
    );
  });
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.5 4v-4h0A1.5 1.5 0 0 1 4 14.5z" />
      <path d="M9 9.5h6M9 12.5h3.5" />
    </svg>
  );
}
