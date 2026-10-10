import Image from "next/image";
import Link from "next/link";
import { buttonPrimary } from "@/components/brand/buttons";

type Approval = "approved" | "not_approved" | "awaiting";

type Storyteller = { name: string; avatar: string; approval: Approval; status: string; row: string };

/** Example storytellers for the illustration (Kevin's "Family Voices Shared Safely" design). Not a working settings panel. */
const STORYTELLERS: Storyteller[] = [
  { name: "Mom", avatar: "mom", approval: "approved", status: "Voice shared with family", row: "bg-sunshine/30" },
  { name: "Grandpa", avatar: "grandpa", approval: "approved", status: "Voice shared with family", row: "bg-mint/35" },
  { name: "Aunt Pook", avatar: "pook", approval: "not_approved", status: "Not approved for Milly", row: "bg-sky/25" },
  { name: "Uncle Chris", avatar: "chris", approval: "awaiting", status: "Awaiting voice-owner permission", row: "bg-lavender/30" },
];

function Toggle({ approval }: { approval: Approval }) {
  const on = approval === "approved";
  const disabled = approval === "awaiting";
  return (
    <span
      className={`relative h-8 w-14 shrink-0 rounded-full sm:h-9 sm:w-16 ${
        on ? "bg-mint-deep" : disabled ? "bg-ink/10" : "bg-ink/25"
      }`}
    >
      <span
        className={`absolute top-1 size-6 rounded-full bg-white shadow-[0_2px_3px_rgba(40,53,72,0.25)] sm:size-7 ${on ? "right-1" : "left-1"} ${
          disabled ? "opacity-60" : ""
        }`}
      />
    </span>
  );
}

function Avatar({ name, size, className = "" }: { name: string; size: number; className?: string }) {
  return (
    <Image
      src={`/family-voices/${name}.webp`}
      alt=""
      width={size}
      height={size}
      className={`shrink-0 rounded-full ring-4 ring-surface ${className}`}
    />
  );
}

function Heart({ className }: { className: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className={className}>
      <path d="M0 4 C0 -2 8 -3 8 3 C8 -3 16 -2 16 4 C16 10 8 14 8 16 C8 14 0 10 0 4Z" fill="currentColor" />
    </svg>
  );
}

const ILLUSTRATION_LABEL =
  "Illustration of Readli Family parent controls: Manage voices for Milly. Mom and Grandpa are switched on, Aunt Pook is not approved for Milly, and Uncle Chris is awaiting the voice owner's permission.";

/** Marketing illustration of the parental voice controls. The real approval portal lives in Readli Family. */
function VoicePermissionsIllustration() {
  return (
    <div role="img" aria-label={ILLUSTRATION_LABEL} className="relative mx-auto w-full max-w-xl py-2">
      
      <Heart className="absolute -left-3 top-1/4 hidden sm:block size-6 text-coral" />
      <Heart className="absolute -right-3 bottom-1/4 hidden sm:block size-5 text-coral-strong" />

      <div className="relative mx-1 rounded-[2rem] bg-surface p-4 shadow-[0_18px_40px_-18px_rgba(40,53,72,0.35)] ring-1 ring-ink/5 sm:mx-6 sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 pt-1">
            <p className="font-display text-xs font-semibold uppercase tracking-[0.18em] text-mint-deep">Readli Family</p>
            <p className="mt-1 font-display text-xl font-semibold leading-tight sm:text-3xl">Manage voices for Milly</p>
            <p className="mt-1 text-sm text-muted sm:text-base">Choose who can read stories to this child.</p>
          </div>
          <span className="relative shrink-0">
            <Avatar name="milly" size={96} className="size-16 sm:size-24" />
            <svg aria-hidden="true" viewBox="0 0 24 24" className="absolute -right-3 -top-2 size-6 text-sunshine">
              <path d="M6 4 9 9 M16 2 15 8 M22 10 17 12" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
            </svg>
          </span>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5 sm:gap-3">
          {STORYTELLERS.map((s) => (
            <li key={s.name} className={`flex items-center gap-3 rounded-2xl p-2.5 sm:gap-4 sm:p-3 ${s.row}`}>
              <Avatar name={s.avatar} size={64} className="size-12 sm:size-16" />
              <div className="min-w-0 flex-1">
                <p className="font-display text-lg font-semibold leading-tight">{s.name}</p>
                <p className="text-sm text-ink/75">{s.status}</p>
              </div>
              <Toggle approval={s.approval} />
            </li>
          ))}
        </ul>
      </div>

    </div>
  );
}

const POINTS = [
  {
    title: "Voices are private by default",
    body: "Recording a voice doesn't automatically share it with anyone.",
    tint: "bg-sunshine/45 text-[#7a4f0f]",
    icon: "lock",
  },
  {
    title: "Parents approve storytellers",
    body: "You choose exactly which voices appear for each child.",
    tint: "bg-mint/50 text-mint-deep",
    icon: "people",
  },
  {
    title: "Permissions can be changed or revoked",
    body: "Update your child's storytellers anytime.",
    tint: "bg-sky/35 text-ink",
    icon: "gear",
  },
] as const;

function PointIcon({ icon }: { icon: (typeof POINTS)[number]["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" className="size-7" fill="currentColor" aria-hidden="true">
      {icon === "lock" && (
        <>
          <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth="2.4" fill="none" />
          <rect x="5" y="10" width="14" height="11" rx="3" />
          <circle cx="12" cy="15.5" r="1.6" fill="white" />
        </>
      )}
      {icon === "people" && (
        <>
          <circle cx="12" cy="8" r="3.2" />
          <circle cx="5.5" cy="10" r="2.4" />
          <circle cx="18.5" cy="10" r="2.4" />
          <path d="M6.5 20a5.5 5.5 0 0 1 11 0Z" />
          <path d="M1 19a4.5 4.5 0 0 1 6.5-4 7 7 0 0 0-1.6 4Z" />
          <path d="M23 19a4.5 4.5 0 0 0-6.5-4 7 7 0 0 1 1.6 4Z" />
        </>
      )}
      {icon === "gear" && (
        <path
          fillRule="evenodd"
          d="M10.3 2h3.4l.5 2.6 1.7.8 2.2-1.5 2.4 2.4-1.5 2.2.8 1.7 2.6.5v3.4l-2.6.5-.8 1.7 1.5 2.2-2.4 2.4-2.2-1.5-1.7.8-.5 2.6h-3.4l-.5-2.6-1.7-.8-2.2 1.5-2.4-2.4 1.5-2.2-.8-1.7L2 13.7v-3.4l2.6-.5.8-1.7-1.5-2.2 2.4-2.4 2.2 1.5 1.7-.8ZM12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
        />
      )}
    </svg>
  );
}

export function FamilyVoices() {
  return (
    <section id="family-privacy" aria-labelledby="family-voices-heading" className="scroll-mt-20 overflow-hidden bg-ivory">
      {/* Mobile: headline, illustration, then the copy. Desktop: copy left, illustration right. */}
      <div className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.1fr] md:grid-rows-[auto_auto] md:py-20">
        <div className="flex flex-col gap-4 md:self-end">
          <p className="flex items-center gap-2 font-display text-sm font-semibold uppercase tracking-[0.18em] text-mint-deep">
            <svg viewBox="0 0 24 24" className="size-6" aria-hidden="true">
              <path d="M12 2 4 5v6c0 5 3.4 9.4 8 11 4.6-1.6 8-6 8-11V5Z" fill="currentColor" />
              <path d="m8.5 12 2.5 2.5 4.5-5" stroke="white" strokeWidth="2.2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            Made for families
          </p>
          <h2 id="family-voices-heading" className="font-display text-4xl font-semibold leading-[1.05] text-plum sm:text-5xl">
            <span className="block">Your family. </span>
            <span className="block text-coral-strong">Your voices. </span>
            <span className="block">Your rules.</span>
          </h2>
        </div>

        <div className="md:col-start-2 md:row-span-2 md:row-start-1 md:self-center">
          <VoicePermissionsIllustration />
        </div>

        <div className="flex flex-col gap-6 md:self-start">
          <p className="max-w-xl text-lg sm:text-xl">
            Family voices stay private until they&apos;re shared. And you decide which approved storytellers your child can
            listen to.
          </p>
          <ul className="flex flex-col gap-4">
            {POINTS.map((p) => (
              <li key={p.title} className="flex items-center gap-4">
                <span className={`grid size-14 shrink-0 place-items-center rounded-full sm:size-16 ${p.tint}`}>
                  <PointIcon icon={p.icon} />
                </span>
                <span>
                  <span className="block font-display text-lg font-semibold text-plum">{p.title}</span>
                  <span className="block text-ink/80">{p.body}</span>
                </span>
              </li>
            ))}
          </ul>
          <div>
            <Link href="/parents/safety" className={buttonPrimary}>
              Learn about family privacy &amp; safety <span aria-hidden="true">→</span>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
