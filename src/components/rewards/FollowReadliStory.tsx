import { SocialIcon } from "@/components/brand/SocialIcon";
import { SOCIAL_ACCOUNTS, type SocialPlatform } from "@/lib/content/social";

const TINT: Record<SocialPlatform, string> = {
  facebook: "bg-sky/50",
  instagram: "bg-coral/30",
  tiktok: "bg-lavender/60",
  youtube: "bg-coral/40",
  pinterest: "bg-sunshine/60",
  linkedin: "bg-sky/40",
  threads: "bg-mint/60",
  x: "bg-lavender/40",
};

/**
 * "Follow Readli's Story": adult onboarding and Readli Rewards only, never Readli Kids.
 * Purely optional. Following earns nothing and is never needed to register (Kevin, 2026-10-10).
 */
export function FollowReadliStory({ headingLevel = 2 }: { headingLevel?: 1 | 2 | 3 }) {
  const H = `h${headingLevel}` as "h1" | "h2" | "h3";
  return (
    <section aria-labelledby="follow-heading" className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8" data-testid="follow-readli">
      <div className="flex flex-col gap-2">
        <H id="follow-heading" className="font-display text-2xl font-semibold sm:text-3xl">
          Follow Readli&apos;s Story
        </H>
        <p>New books, behind-the-scenes peeks and Readi&apos;s adventures. Visit any of our official accounts if you&apos;d like to follow along.</p>
      </div>
      <ul aria-label="Readli's official accounts" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {SOCIAL_ACCOUNTS.map((a) => (
          <li key={a.platform}>
            <a
              href={a.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex h-full flex-col items-center gap-2 rounded-3xl p-4 text-center transition-transform hover:-translate-y-0.5 hover:ring-2 hover:ring-ink ${TINT[a.platform]}`}
            >
              <span className="grid size-12 place-items-center rounded-full bg-ink text-white">
                <SocialIcon platform={a.platform} className="size-6" />
              </span>
              <span className="font-display font-semibold leading-tight">{a.name}</span>
              <span className="text-sm text-muted">{a.handle}</span>
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </li>
        ))}
      </ul>
      <p className="text-sm text-muted" data-testid="follow-optional">
        Totally optional. Following isn&apos;t needed for anything, and it doesn&apos;t earn rewards.
      </p>
    </section>
  );
}
