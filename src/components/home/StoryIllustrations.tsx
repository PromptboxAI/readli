/**
 * Artwork for "Every family has a story" (v2, Kevin 2026-10-13): family portraits instead of cartoon
 * scenes, so the section feels warmer and doesn't repeat the hero's highlighted story.
 */
import Image from "next/image";

type Person = "mom" | "grandpa" | "pook" | "chris" | "milly";

const NAMES: Record<Person, string> = { mom: "Mom", grandpa: "Grandpa", pook: "Aunt Pook", chris: "Uncle Kevin", milly: "Milly" };
const RING = "rounded-full shadow-[0_0_0_4px_var(--color-surface),0_10px_20px_-10px_rgba(40,53,72,0.5)]";

function Portrait({ who, size, className = "" }: { who: Person; size: number; className?: string }) {
  return (
    <Image
      src={`/family-voices/${who}.webp`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** The family's storytellers side by side like a photo, with Grandpa reading. */
export function HearLovedOnes() {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="flex">
        {(["mom", "grandpa", "pook", "chris"] as const).map((who, i) => (
          <Portrait key={who} who={who} size={64} className={`${RING} ${i > 0 ? "-ml-3.5" : ""}`} />
        ))}
      </div>
      <span className="inline-flex items-center gap-2.5 rounded-full bg-surface py-2 pr-4 pl-2 text-sm shadow-[0_10px_24px_-14px_rgba(40,53,72,0.45)]">
        <Portrait who="grandpa" size={30} />
        <span>
          <span className="font-display font-semibold">Grandpa</span> <span className="text-muted">is reading</span>
        </span>
        <span className="flex h-4.5 items-center gap-[3px]">
          {[40, 80, 55, 100, 60, 85, 45].map((h, i) => (
            <i key={i} className="w-[3px] rounded-sm bg-mint-deep" style={{ height: `${h}%` }} />
          ))}
        </span>
      </span>
    </div>
  );
}

/** Milly at the centre of her family, with room to invite one more. */
export function FamilyOfStorytellers() {
  const around: [Person | "invite", string, string][] = [
    ["grandpa", "50%", "0%"],
    ["mom", "100%", "50%"],
    ["pook", "0%", "50%"],
    ["invite", "50%", "100%"],
  ];
  return (
    <div className="flex h-full items-center justify-center">
      <div className="relative size-[168px] rounded-full border-2 border-surface/90">
        {around.map(([who, left, top]) => (
          <span key={who} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left, top }}>
            {who === "invite" ? (
              <span className={`flex size-11 items-center justify-center bg-surface font-display text-xl font-semibold text-mint-deep ${RING}`}>
                +
              </span>
            ) : (
              <Portrait who={who} size={48} className={RING} />
            )}
          </span>
        ))}
        <span className="absolute top-1/2 left-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-1.5">
          <Portrait who="milly" size={84} className={RING} />
          <span className="rounded-full bg-surface px-3 py-0.5 font-display text-sm font-semibold">Milly</span>
        </span>
      </div>
    </div>
  );
}

/** A book with its storytellers to pick from; switching keeps your place. */
export function MakeStorytimeYourOwn() {
  return (
    <div className="flex h-full items-center justify-center gap-4 px-5">
      <Image
        src="/covers/the-tale-of-peter-rabbit.webp"
        alt=""
        width={92}
        height={123}
        className="w-[92px] shrink-0 -rotate-[4deg] rounded-[10px] shadow-[4px_6px_0_rgba(40,53,72,0.18)]"
      />
      <span className="flex w-[190px] flex-col gap-2">
        {(["mom", "grandpa", "pook"] as const).map((who) => {
          const on = who === "grandpa";
          return (
            <span
              key={who}
              className={`flex items-center gap-2.5 rounded-2xl py-1.5 pr-2.5 pl-1.5 font-display text-sm font-semibold ${
                on ? "bg-surface shadow-[0_0_0_2px_var(--color-coral-deep),0_10px_22px_-14px_rgba(40,53,72,0.5)]" : "bg-surface/55"
              }`}
            >
              <Portrait who={who} size={34} />
              {NAMES[who]}
              {on && <span className="ml-auto font-sans text-[10px] font-bold tracking-wider text-coral-deep uppercase">Reading</span>}
            </span>
          );
        })}
      </span>
    </div>
  );
}
