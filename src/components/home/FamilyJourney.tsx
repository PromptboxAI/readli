"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";

/**
 * Guided journey (designer brief, 2026-10-23): one Readli Family story in five steps that visitors
 * click through at their own pace (no autoplay, Kevin 2026-10-23). Replaces "Every family has a story" in the same spot, so the page doesn't grow.
 * Each screen redraws a real app screen (My voice, invitations, trial offer, Prepare, Kids player) with
 * the example family from the homepage tree. Marketing picture only: nothing here is interactive app UI.
 */

const BOOK = { title: "The Three Billy Goats Gruff", short: "Billy Goats Gruff", cover: "/covers/the-three-billy-goats-gruff.webp" };
/** Kevin's own Readli voice reading page 1, trimmed from his screen recording (2026-10-23). */
const SAMPLE_SRC = "/samples/grandpa-kevin-billy-goats-gruff.mp3";

const GRANDPA = { name: "Grandpa Kevin", portrait: "/family-voices/grandpa.webp" };
const HOUSEHOLDS = [
  { name: "Sara's family", parent: "Sara", tint: "bg-coral", kids: "Maya and Leo" },
  { name: "Annabel's family", parent: "Annabel", tint: "bg-sunshine", kids: "Ava" },
];

function Initials({ name, tint, size = "size-10 text-base" }: { name: string; tint: string; size?: string }) {
  return (
    <span aria-hidden="true" className={`grid ${size} shrink-0 place-items-center rounded-full border-[3px] border-ink font-display font-semibold ${tint}`}>
      {name}
    </span>
  );
}

function Grandpa({ size = "size-10" }: { size?: string }) {
  return <Image src={GRANDPA.portrait} alt="" width={56} height={56} className={`${size} shrink-0 rounded-full border-[3px] border-ink object-cover`} />;
}

function Check() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path d="M6 12.5l4 4L18 8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function Cover({ w = 56 }: { w?: number }) {
  return <Image src={BOOK.cover} alt="" width={w} height={Math.round((w * 4) / 3)} className="aspect-[3/4] shrink-0 rounded-md object-cover shadow-[2px_3px_0_rgba(40,53,72,0.16)]" style={{ width: w }} />;
}

function SamplePlayer() {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  useEffect(() => {
    const a = audio.current;
    return () => a?.pause();
  }, []);
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-ivory p-2.5 ring-1 ring-ink/10">
      <audio ref={audio} src={SAMPLE_SRC} preload="none" onEnded={() => setPlaying(false)} />
      <button
        type="button"
        onClick={() => {
          const a = audio.current;
          if (!a) return;
          if (a.paused) {
            void a
              .play()
              .then(() => setPlaying(true))
              .catch(() => setPlaying(false));
          } else {
            a.pause();
            setPlaying(false);
          }
        }}
        className="grid size-11 shrink-0 place-items-center rounded-full bg-coral-deep text-white"
        aria-label={playing ? "Pause Grandpa Kevin's sample" : "Play Grandpa Kevin's sample"}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <span className="min-w-0 text-sm">
        <span className="block font-semibold">{BOOK.short}, page 1</span>
        <span className="block text-muted">Read by {GRANDPA.name} · 0:29</span>
      </span>
    </div>
  );
}

/** Phone-sized card that holds one app screen. */
function Screen({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex h-full flex-col gap-3 rounded-[28px] bg-surface p-4 text-left shadow-[0_24px_50px_-22px_rgba(40,53,72,0.45)] ring-1 ring-ink/5 sm:p-5">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-mint-deep">{label}</p>
      {children}
    </div>
  );
}

const STEPS: { title: string; body: string; screen: ReactNode }[] = [
  {
    title: "Grandpa records his voice, free",
    body: "He reads a short script, then hears and approves a real story in his own voice.",
    screen: (
      <Screen label="My voice">
        <div className="flex items-center gap-3">
          <Grandpa size="size-14" />
          <div>
            <p className="font-display text-xl font-semibold leading-tight">Your voice is ready</p>
            <p className="text-sm text-muted">Listen before you share it.</p>
          </div>
        </div>
        <div className="flex gap-3">
          <Cover />
          <div className="flex min-w-0 flex-1 flex-col justify-center">
            <SamplePlayer />
          </div>
        </div>
        <ul className="flex flex-col gap-1.5 text-sm">
          <li className="flex items-center gap-2">
            <Check /> Read a 1 to 2 minute script
          </li>
          <li className="flex items-center gap-2">
            <Check /> Free to record
          </li>
        </ul>
        <p className="mt-auto flex items-center gap-2 rounded-2xl bg-mint/40 px-3 py-2.5 text-sm font-bold text-mint-deep">
          <Check /> Sample approved. Sounds like me.
        </p>
      </Screen>
    ),
  },
  {
    title: "He sends it to both his children",
    body: "Sara and Annabel live in different homes. Each invitation carries the same approved sample.",
    screen: (
      <Screen label="Invite storytellers">
        {HOUSEHOLDS.map((h) => (
          <div key={h.parent} className="flex items-center gap-3 rounded-2xl bg-ivory p-3 ring-1 ring-ink/10">
            <Initials name={h.parent.charAt(0)} tint={h.tint} />
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">To {h.parent}</span>
              <span className="block truncate text-sm text-muted">With Grandpa Kevin&apos;s {BOOK.short} sample</span>
            </span>
            <span className="shrink-0 rounded-full bg-sky/60 px-2.5 py-0.5 text-xs font-bold">Sent</span>
          </div>
        ))}
        <p className="mt-auto text-sm text-muted">His recordings stay private. Only the sample travels.</p>
      </Screen>
    ),
  },
  {
    title: "Parents listen, start Family, and add Grandpa",
    body: "Sara hears the sample, starts a Readli Family trial, and turns Grandpa Kevin on for her kids.",
    screen: (
      <Screen label="Sara's invitation">
        <p className="font-display text-xl font-semibold leading-tight">Hear Grandpa Kevin read to your children every night</p>
        <SamplePlayer />
        <span className={`${buttonPrimary} pointer-events-none min-h-11 text-base`}>Start Your Free Family Trial</span>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-ivory p-3 ring-1 ring-ink/10">
          <Grandpa />
          <span className="min-w-0 flex-1 font-semibold">{GRANDPA.name}</span>
          <span className="shrink-0 rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold">Storyteller on</span>
        </div>
      </Screen>
    ),
  },
  {
    title: "Each home prepares the same book",
    body: `Both families prepare ${BOOK.short} in Grandpa Kevin's voice, ready for bedtime in each house.`,
    screen: (
      <Screen label="Prepare narration">
        <div className="flex items-center gap-3">
          <Cover w={48} />
          <div className="min-w-0">
            <p className="font-display text-lg font-semibold leading-tight">{BOOK.title}</p>
            <p className="text-sm text-muted">Read by {GRANDPA.name}</p>
          </div>
        </div>
        {HOUSEHOLDS.map((h) => (
          <div key={h.name} className="flex flex-col gap-2 rounded-2xl bg-ivory p-3 ring-1 ring-ink/10">
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold">{h.name}</span>
              <span className="flex items-center gap-1 rounded-full bg-mint px-2.5 py-0.5 text-xs font-bold">
                <Check /> Ready to play
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-ink/10">
              <div className="h-full w-full rounded-full bg-ink" />
            </div>
          </div>
        ))}
      </Screen>
    ),
  },
  {
    title: "Kids switch storytellers, no extra charge",
    body: "Any voice already prepared plays free. Maya picks Grandpa Kevin tonight and Mom tomorrow.",
    screen: (
      <div className="flex h-full flex-col gap-3 rounded-[28px] bg-plum p-4 text-left text-white shadow-[0_24px_50px_-22px_rgba(40,53,72,0.45)] sm:p-5">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-sunshine">Readli Kids</p>
        <div className="flex items-center gap-3">
          <Cover w={48} />
          <p className="font-display text-lg font-semibold leading-tight">{BOOK.title}</p>
        </div>
        <div className="mt-auto flex flex-col gap-3 rounded-[22px] bg-surface p-3 text-ink">
          <p className="font-display text-lg font-semibold">Who reads to you?</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { n: "Grandpa Kevin", i: "K", t: "bg-lavender", on: true },
              { n: "Mom", i: "S", t: "bg-coral", on: false },
              { n: "Dad", i: "B", t: "bg-sky", on: false },
            ].map((x) => (
              <span key={x.n} className={`flex flex-col items-center gap-1.5 rounded-2xl p-2 ${x.on ? "bg-sunshine" : "bg-ivory ring-2 ring-ink/10"}`}>
                {x.on ? <Grandpa /> : <Initials name={x.i} tint={x.t} />}
                <span className="text-center font-display text-sm font-semibold leading-tight">{x.n}</span>
                <span className="rounded-full bg-mint px-1.5 py-0.5 text-[10px] font-bold">Ready here</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    ),
  },
];

const navButton = "flex min-h-11 items-center gap-1 rounded-full px-4 font-display font-semibold disabled:opacity-35";

function Arrow({ back = false }: { back?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="size-5" aria-hidden="true">
      <path d={back ? "M15 5l-7 7 7 7" : "M9 5l7 7-7 7"} fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function FamilyJourney() {
  const [step, setStep] = useState(0);
  const current = STEPS[step]!;
  const last = STEPS.length - 1;

  const nav = (
    <div className="flex items-center justify-between gap-2">
      <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className={`${navButton} hover:bg-ink/5`}>
        <Arrow back /> Back
      </button>
      <div className="flex items-center">
        {STEPS.map((s, i) => (
          <button key={s.title} type="button" onClick={() => setStep(i)} aria-label={`Step ${i + 1}: ${s.title}`} aria-current={i === step ? "step" : undefined} className="grid size-8 place-items-center">
            <span className={`block h-2.5 rounded-full transition-all ${i === step ? "w-6 bg-plum" : "w-2.5 bg-ink/25"}`} />
          </button>
        ))}
      </div>
      <button type="button" onClick={() => setStep((s) => Math.min(last, s + 1))} disabled={step === last} className={`${navButton} bg-plum text-white`}>
        Next <Arrow />
      </button>
    </div>
  );

  return (
    <section id="family-journey" aria-labelledby="journey-heading" className="scroll-mt-20 bg-ivory">
      <div className="mx-auto grid max-w-6xl items-center gap-5 px-4 py-10 sm:px-6 lg:grid-cols-[1.25fr_1fr] lg:gap-12 lg:py-10">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-[13px] font-extrabold uppercase tracking-[0.16em] text-coral-deep">One voice, two homes</p>
            <h2 id="journey-heading" className="font-display text-3xl font-semibold sm:text-4xl">
              How Grandpa Kevin reads to every grandchild
            </h2>
          </div>

          {/* Desktop: all five steps, the current one opened up. */}
          <ol className="hidden flex-col gap-1.5 lg:flex">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <button
                  type="button"
                  onClick={() => setStep(i)}
                  aria-current={i === step ? "step" : undefined}
                  className={`flex w-full items-start gap-3 rounded-[18px] px-4 py-2 text-left transition-colors ${i === step ? "bg-lavender/40" : "hover:bg-ink/5"}`}
                >
                  <span className={`grid size-8 shrink-0 place-items-center rounded-full font-display font-semibold ${i === step ? "bg-plum text-white" : "bg-ink/10"}`}>{i + 1}</span>
                  <span className="min-w-0 pt-1">
                    <span className="block font-display text-lg font-semibold leading-tight">{s.title}</span>
                    {i === step && <span className="mt-1 block text-ink/80">{s.body}</span>}
                  </span>
                </button>
              </li>
            ))}
          </ol>

          <div className="hidden flex-wrap gap-3 lg:flex">
            <Link href="/try" className={buttonPrimary}>
              Record a voice for free
            </Link>
            <Link href="/pricing" className={buttonSecondary}>
              See how Readli Family works
            </Link>
          </div>
        </div>

        <div className="mx-auto flex w-full max-w-sm flex-col gap-3">
          <div aria-live="polite" className="h-[330px]">
            <div key={step} className="journey-screen h-full">
              {current.screen}
            </div>
          </div>
          {nav}

          {/* Phones and tablets: the current step's words under the screen. */}
          <div className="flex flex-col items-center gap-3 text-center lg:hidden">
            <p className="font-display text-xl font-semibold">
              {step + 1}. {current.title}
            </p>
            <p className="max-w-md text-ink/80">{current.body}</p>
            <div className="mt-1 flex w-full flex-col gap-3">
              <Link href="/try" className={`${buttonPrimary} w-full`}>
                Record a voice for free
              </Link>
              <Link href="/pricing" className={`${buttonSecondary} w-full`}>
                See how Readli Family works
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
