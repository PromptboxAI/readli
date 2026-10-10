import Link from "next/link";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import { Face, SKIN } from "@/components/home/StoryIllustrations";

type Approval = "approved" | "not_approved" | "awaiting";

type Storyteller = {
  name: string;
  approval: Approval;
  tint: string;
  face: Omit<Parameters<typeof Face>[0], "cx" | "cy" | "r">;
};

/** Example storytellers for the illustration. Not real data, and not a working settings panel. */
const STORYTELLERS: Storyteller[] = [
  { name: "Mom", approval: "approved", tint: "bg-sunshine", face: { skin: SKIN[0], hair: "#5a3a2a", style: "long" } },
  { name: "Grandpa", approval: "approved", tint: "bg-sky", face: { skin: SKIN[3], hair: "#e9e4dc", style: "bald", glasses: true } },
  { name: "Aunt Sarah", approval: "not_approved", tint: "bg-coral/70", face: { skin: SKIN[0], hair: "#b5532f", style: "long" } },
  { name: "Uncle Mike", approval: "awaiting", tint: "bg-lavender", face: { skin: SKIN[2], hair: "#2b211c", style: "short" } },
];

const ROW: Record<Approval, string> = {
  approved: "bg-mint/45",
  not_approved: "bg-coral/20",
  awaiting: "bg-ink/[0.06] text-ink/60",
};

const STATUS: Record<Approval, { label: string; className: string }> = {
  approved: { label: "Approved", className: "bg-mint/70 text-ink" },
  not_approved: { label: "Not approved", className: "bg-coral/30 text-coral-deep" },
  awaiting: { label: "Awaiting voice-owner permission", className: "text-ink/60" },
};

function StatusIcon({ approval }: { approval: Approval }) {
  if (approval === "approved")
    return (
      <svg viewBox="0 0 20 20" className="size-4 shrink-0">
        <circle cx="10" cy="10" r="10" fill="var(--color-mint-deep)" />
        <path d="M5.5 10.5 8.5 13.5 14.5 7" stroke="white" strokeWidth="2.4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  if (approval === "not_approved")
    return (
      <svg viewBox="0 0 20 20" className="size-4 shrink-0">
        <circle cx="10" cy="10" r="10" fill="var(--color-coral-deep)" />
        <path d="M6.5 6.5 13.5 13.5 M13.5 6.5 6.5 13.5" stroke="white" strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg viewBox="0 0 20 20" className="size-4 shrink-0 text-[#8a6fd1]">
      <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="2" fill="none" />
      <path d="M10 5.5V10l3 2" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" />
    </svg>
  );
}

function Toggle({ on, disabled }: { on: boolean; disabled?: boolean }) {
  return (
    <span
      className={`relative h-8 w-14 shrink-0 rounded-full transition-colors ${
        on ? "bg-mint-deep" : disabled ? "bg-ink/10" : "bg-ink/25"
      }`}
    >
      <span
        className={`absolute top-1 size-6 rounded-full bg-white shadow-[0_2px_3px_rgba(40,53,72,0.25)] ${on ? "right-1" : "left-1"} ${
          disabled ? "opacity-70" : ""
        }`}
      />
    </span>
  );
}

function FaceAvatar({ face, tint, className = "" }: { face: Storyteller["face"]; tint: string; className?: string }) {
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-full border-[3px] border-surface ${tint} ${className}`}>
      <svg viewBox="0 0 60 60" className="size-full">
        <Face cx={30} cy={33} r={17} {...face} />
      </svg>
    </span>
  );
}

const ILLUSTRATION_LABEL =
  "Illustration of the Readli Family parent controls: Manage voices for Milly. Mom and Grandpa are approved, Aunt Sarah is not approved, and Uncle Mike is awaiting the voice owner's permission.";

/** Marketing illustration of the parental voice controls. The real approval portal lives in Readli Family. */
function VoicePermissionsIllustration() {
  return (
    <div role="img" aria-label={ILLUSTRATION_LABEL} className="relative mx-auto w-full max-w-lg pb-16 pt-6 sm:px-6">
      {/* Backdrop shapes */}
      <div aria-hidden="true" className="absolute inset-x-6 top-0 h-3/4 rounded-[45%_55%_40%_60%] bg-sky/60" />
      <div aria-hidden="true" className="absolute -right-2 top-10 size-28 rounded-full bg-sunshine sm:size-36" />
      <div aria-hidden="true" className="absolute bottom-4 left-0 h-32 w-40 rounded-[50%_50%_40%_40%] bg-mint" />
      <div aria-hidden="true" className="absolute bottom-6 -right-4 size-28 rounded-full bg-mint/80" />
      <svg aria-hidden="true" viewBox="0 0 40 40" className="absolute left-4 top-0 size-10 text-sunshine sm:left-10">
        <path d="M6 30 16 22 M18 6 20 18 M34 10 26 20" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <svg aria-hidden="true" viewBox="0 0 16 16" className="absolute -right-1 top-1/2 size-6 text-coral">
        <path d="M0 4 C0 -2 8 -3 8 3 C8 -3 16 -2 16 4 C16 10 8 14 8 16 C8 14 0 10 0 4Z" fill="currentColor" />
      </svg>

      <div className="relative rotate-1 rounded-[2rem] border-[3px] border-ink bg-surface p-4 shadow-[0_8px_0_rgba(40,53,72,0.9)] sm:p-6">
        <div className="flex items-center gap-3 sm:gap-4">
          <FaceAvatar face={{ skin: SKIN[0], hair: "#6b4430", style: "bun" }} tint="bg-lavender" className="size-14 sm:size-16" />
          <div className="min-w-0">
            <p className="font-display text-xl font-semibold leading-tight sm:text-2xl">Manage voices for Milly</p>
            <p className="text-sm text-muted">Choose who can read stories to this child.</p>
          </div>
        </div>
        <ul className="mt-4 flex flex-col gap-2.5 sm:gap-3">
          {STORYTELLERS.map((s) => {
            const status = STATUS[s.approval];
            return (
              <li key={s.name} className={`flex items-center gap-3 rounded-2xl p-2.5 sm:p-3 ${ROW[s.approval]}`}>
                <FaceAvatar
                  face={s.face}
                  tint={s.tint}
                  className={`size-12 sm:size-14 ${s.approval === "awaiting" ? "opacity-70" : ""}`}
                />
                <div className="flex min-w-0 flex-1 flex-col items-start gap-1">
                  <p className="font-display text-lg font-semibold leading-none">{s.name}</p>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full text-xs font-bold sm:text-sm ${
                      s.approval === "awaiting" ? "" : "px-2.5 py-1"
                    } ${status.className}`}
                  >
                    <StatusIcon approval={s.approval} />
                    {status.label}
                  </span>
                </div>
                <Toggle on={s.approval === "approved"} disabled={s.approval === "awaiting"} />
              </li>
            );
          })}
        </ul>
      </div>

      <ReadiMascot size={96} decorative className="animate-bob absolute -bottom-1 -left-1 sm:-left-4" />
    </div>
  );
}

const POINTS = [
  { text: "Voices are private by default.", tint: "bg-coral/35", icon: "lock" },
  { text: "Parents approve storytellers for each child.", tint: "bg-mint", icon: "people" },
  { text: "Permissions can be changed or revoked.", tint: "bg-sunshine", icon: "gear" },
] as const;

function PointIcon({ icon }: { icon: (typeof POINTS)[number]["icon"] }) {
  return (
    <svg viewBox="0 0 24 24" className="size-6" fill="currentColor" aria-hidden="true">
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

const DOTS = ["text-coral", "text-mint-deep", "text-sunshine"];

export function FamilyVoices() {
  return (
    <section id="family-privacy" aria-labelledby="family-voices-heading" className="scroll-mt-20 overflow-hidden bg-ivory">
      {/* Mobile: headline, illustration, then the copy. Desktop: copy left, illustration right. */}
      <div className="mx-auto grid max-w-6xl items-center gap-x-10 gap-y-8 px-4 py-14 sm:px-6 md:grid-cols-[1fr_1.05fr] md:grid-rows-[auto_auto] md:py-20">
        <div className="flex flex-col gap-3 md:self-end">
          <p className="font-display text-sm font-semibold uppercase tracking-[0.18em] text-coral-deep">Made for families</p>
          <h2 id="family-voices-heading" className="font-display text-4xl font-semibold leading-[1.05] sm:text-5xl lg:text-6xl">
            {["Your family", "Your voices", "Your rules"].map((line, i) => (
              <span key={line} className="block">
                {line}
                <span className={DOTS[i]}>.</span>{" "}
              </span>
            ))}
          </h2>
        </div>

        <div className="md:col-start-2 md:row-span-2 md:row-start-1">
          <VoicePermissionsIllustration />
        </div>

        <div className="flex flex-col gap-6 md:self-start">
          <p className="max-w-xl text-lg">
            Family voices stay private until they&apos;re shared. And you decide which approved storytellers your child can
            listen to.
          </p>
          <ul className="flex flex-col gap-3">
            {POINTS.map((p) => (
              <li key={p.text} className="flex items-center gap-4">
                <span className={`grid size-12 shrink-0 place-items-center rounded-2xl text-ink ${p.tint}`}>
                  <PointIcon icon={p.icon} />
                </span>
                <span className="text-lg">{p.text}</span>
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
