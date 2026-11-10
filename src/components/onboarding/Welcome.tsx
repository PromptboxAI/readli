import Image from "next/image";
import Link from "next/link";
import { AskName } from "@/components/account/AskName";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { buttonPrimary } from "@/components/brand/buttons";
import { CATALOG } from "@/lib/library/catalog";

/** A handful of covers so a newcomer sees the kind of books Readli reads. */
const SAMPLE = 6;

const COPY = {
  family: {
    eyebrow: "Welcome to Readli Family",
    title: "Bedtime stories, read in the voices your kids love",
    lead: "Readli reads classic children's books aloud in your own voice, and in the voices of grandparents and anyone else you invite. Your kids listen in Readli Kids, a calm, ad-free space made just for them.",
    how: [
      ["Record your voice", "Read a short passage out loud, about one minute. You do it once."],
      ["Add your kids and family", "Each child gets their own bookshelf. Invite a co-parent, grandparents and anyone else who reads to them."],
      ["Pick a story, they listen", "Choose a book and whose voice reads it. It appears on your kids' bookshelves, ready for bedtime."],
    ],
  },
  storyteller: {
    eyebrow: "Welcome to Readli Voice",
    title: "Read bedtime stories to the kids you love, from anywhere",
    lead: "Readli turns a few minutes of your voice into classic children's books read by you. The families you share with hear you at bedtime, even when you're miles away. It's free for storytellers, always.",
    how: [
      ["Record your voice", "Read a short passage out loud, about one minute. You do it once."],
      ["Share it with a family", "Say yes to the family who invited you, or invite one yourself. Parents choose which kids hear you."],
      ["They hear you at bedtime", "Your voice reads the stories, and you stay in control: stop sharing any time."],
    ],
  },
} as const;

/**
 * The page before setup's first step, for someone who may never have seen the website: what Readli is,
 * how it works and a glimpse of the library, then "Let's get started!". A short video will replace the
 * top of this page later.
 */
export function Welcome({
  kind,
  startHref,
  name,
  askName,
  nameNext,
}: {
  kind: "family" | "storyteller";
  startHref: string;
  name?: string | null;
  /** The signed-in name to keep or change before starting. Sign-in fills it from Google, which may be a business or a nickname. */
  askName?: string | null;
  /** Saving the name is the start button itself: it saves, then goes here (the new-signup welcome). */
  nameNext?: string;
}) {
  const copy = COPY[kind];
  const books = CATALOG.filter((b) => b.coverUrl).slice(0, SAMPLE);
  return (
    <div className="flex flex-col gap-8" data-testid="onboarding-welcome">
      <section className="flex flex-col items-center gap-5 rounded-[var(--radius-panel)] bg-sky/40 px-5 py-8 text-center sm:flex-row sm:gap-8 sm:px-10 sm:py-10 sm:text-left">
        <ReadiMascot size={120} decorative />
        <div className="flex flex-col gap-3">
          <p className="text-sm font-bold tracking-wider uppercase">{name ? `Hi ${name}! ` : ""}{copy.eyebrow}</p>
          <h1 className="font-display text-3xl leading-tight font-semibold sm:text-4xl">{copy.title}</h1>
          <p className="text-lg">{copy.lead}</p>
        </div>
      </section>

      <section className="flex flex-col gap-3" aria-labelledby="welcome-how-h">
        <h2 id="welcome-how-h" className="font-display text-2xl font-semibold">
          How it works
        </h2>
        <ol className="grid gap-3 sm:grid-cols-3">
          {copy.how.map(([title, text], i) => (
            <li key={title} className="flex flex-col gap-2 rounded-3xl bg-surface p-5 ring-2 ring-ink/10">
              <span aria-hidden="true" className="grid size-9 place-items-center rounded-full bg-sunshine font-display font-semibold">
                {i + 1}
              </span>
              <p className="font-display text-lg font-semibold">{title}</p>
              <p className="text-muted">{text}</p>
            </li>
          ))}
        </ol>
      </section>

      {books.length > 0 && (
        <section className="flex flex-col gap-3" aria-labelledby="welcome-library-h">
          <h2 id="welcome-library-h" className="font-display text-2xl font-semibold">
            A peek at the library
          </h2>
          <p className="text-muted">Timeless stories, from Peter Rabbit to Winnie-the-Pooh, with new books every week.</p>
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {books.map((b) => (
              <li key={b.slug} className="min-w-0">
                <span className="block overflow-hidden rounded-xl bg-bookcase shadow-[0_3px_0_rgba(40,53,72,0.12)]">
                  <Image src={b.coverUrl!} alt={b.title} width={160} height={213} className="aspect-[3/4] w-full object-cover" />
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {askName !== undefined && (
        <AskName
          initial={askName ?? ""}
          label={kind === "family" ? "First, what should your family call you?" : "First, what should the kids call you?"}
          hint={
            kind === "family"
              ? "This is how you'll appear to your kids and the storytellers you invite. We filled it in from your sign-in, so change it if it isn't right."
              : "Families see this name on invitations and in Readli Kids. We filled it in from your sign-in, so change it if it isn't right."
          }
          placeholder={kind === "family" ? "Mom, Dad, Kevin…" : "Grandpa Joe, Nana, Aunt Sue…"}
          next={nameNext}
          submitLabel={nameNext ? "Let's get started!" : undefined}
        />
      )}

      {nameNext && askName !== undefined ? (
        <p className="text-sm text-muted">It takes about five minutes, and you can stop and come back any time.</p>
      ) : (
      <div className="flex flex-col items-center gap-2 border-t border-ink/10 pt-6 sm:items-start">
        <Link href={startHref} className={buttonPrimary} data-testid="welcome-start">
          Let&apos;s get started!
        </Link>
        <p className="text-center text-sm text-muted sm:text-left">It takes about five minutes, and you can stop and come back any time.</p>
      </div>
      )}
    </div>
  );
}
