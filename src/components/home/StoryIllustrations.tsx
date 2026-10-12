import Image from "next/image";

/**
 * Artwork for "Every family has a story" (Kevin, 2026-10-12): family portraits instead of large
 * cartoon scenes, so the section speaks to the grown-ups who read and stays distinct from the hero.
 * Each fills its coloured card; the card supplies the background.
 */

type Person = { name: string; avatar: string };

const MOM: Person = { name: "Mom", avatar: "mom" };
const GRANDPA: Person = { name: "Grandpa", avatar: "grandpa" };
const POOK: Person = { name: "Aunt Pook", avatar: "pook" };
const CHRIS: Person = { name: "Uncle Chris", avatar: "chris" };

function Portrait({ person, size, className = "" }: { person: Person; size: number; className?: string }) {
  return (
    <Image
      src={`/family-voices/${person.avatar}.webp`}
      alt=""
      width={size}
      height={size}
      style={{ width: size, height: size }}
      className={`shrink-0 rounded-full ring-4 ring-surface shadow-[0_8px_18px_-8px_rgba(40,53,72,0.45)] ${className}`}
    />
  );
}

function Wave({ bars = 10, className = "" }: { bars?: number; className?: string }) {
  const heights = [40, 75, 55, 95, 60, 80, 50, 70, 45, 65, 35, 55];
  return (
    <span aria-hidden="true" className={`flex h-4 items-center gap-[3px] ${className}`}>
      {heights.slice(0, bars).map((h, i) => (
        <span key={i} className={`w-[3px] rounded-sm ${i < bars - 3 ? "bg-mint-deep" : "bg-ink/20"}`} style={{ height: `${h}%` }} />
      ))}
    </span>
  );
}

/** Card 1: the different grown-ups a child might hear, each with their own voice. */
export function HearLovedOnes() {
  const people = [MOM, GRANDPA, POOK, CHRIS];
  return (
    <div role="img" aria-label="Portraits of Mom, Grandpa, Aunt Pook and Uncle Chris, each a storyteller" className="flex size-full items-center justify-center px-5">
      <ul className="grid w-full grid-cols-2 gap-2.5">
        {people.map((p) => (
          <li key={p.name} className="flex items-center gap-2.5 rounded-2xl bg-surface/80 p-2">
            <Portrait person={p} size={40} className="ring-2" />
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-semibold leading-tight">{p.name}</span>
              <Wave bars={8} className="mt-1" />
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Card 2: storytellers near and far, all connected to one listener. */
export function FamilyOfStorytellers() {
  return (
    <div
      role="img"
      aria-label="Milly in the middle, connected to Mom, Grandpa and Aunt Pook, with one more relative invited to join"
      className="relative size-full"
    >
      <svg viewBox="0 0 400 250" preserveAspectRatio="none" className="absolute inset-0 size-full" aria-hidden="true">
        <g stroke="#283548" strokeWidth="2.5" strokeDasharray="2 7" strokeLinecap="round" fill="none" opacity="0.45">
          <path d="M200 125 L92 62" />
          <path d="M200 125 L308 62" />
          <path d="M200 125 L92 192" />
          <path d="M200 125 L308 192" />
        </g>
      </svg>
      <Portrait person={GRANDPA} size={52} className="absolute left-[23%] top-[25%] -translate-x-1/2 -translate-y-1/2" />
      <Portrait person={MOM} size={52} className="absolute left-[77%] top-[25%] -translate-x-1/2 -translate-y-1/2" />
      <Portrait person={POOK} size={52} className="absolute left-[23%] top-[77%] -translate-x-1/2 -translate-y-1/2" />
      <span
        aria-hidden="true"
        className="absolute left-[77%] top-[77%] flex size-[52px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-[3px] border-dashed border-ink/45 bg-surface/70 font-display text-2xl font-semibold text-ink/60"
      >
        +
      </span>
      <span className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1">
        <Portrait person={{ name: "Milly", avatar: "milly" }} size={76} />
        <span className="rounded-full bg-surface px-2.5 py-0.5 font-display text-xs font-semibold">Milly</span>
      </span>
    </div>
  );
}

/** Card 3: a page of the story with the current sentence lit, and storytellers to switch between. */
export function MakeStorytimeYourOwn() {
  return (
    <div
      role="img"
      aria-label="A page of a storybook with one sentence highlighted, and three family storytellers to switch between"
      className="flex size-full flex-col items-center justify-center gap-3 px-6"
    >
      <p aria-hidden="true" className="w-full rounded-2xl bg-surface px-4 py-3 text-[13px] font-semibold leading-relaxed text-ink/45">
        Once upon a time there were four little rabbits,{" "}
        <span className="rounded bg-sunshine/70 text-ink">and their names were Flopsy, Mopsy, Cotton-tail,</span> and Peter.
      </p>
      <span aria-hidden="true" className="flex items-center gap-2 rounded-full bg-surface py-1.5 pl-1.5 pr-3">
        <Portrait person={MOM} size={32} className="ring-2" />
        <Portrait person={GRANDPA} size={32} className="ring-2 !ring-coral-deep" />
        <Portrait person={POOK} size={32} className="ring-2" />
        <span className="ml-1 font-display text-xs font-semibold">Switch storyteller</span>
      </span>
    </div>
  );
}
