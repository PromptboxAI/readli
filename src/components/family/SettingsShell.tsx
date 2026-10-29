import Link from "next/link";
import { BackLink } from "@/components/family/BackLink";
import { FamilyShell, PreviewNote } from "@/components/family/FamilyShell";
import { phoneHref, SETTINGS_HOME, SETTINGS_SECTIONS, type SettingsSection } from "@/lib/family/settings-nav";

const icon = (paths: React.ReactNode) => (
  <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5 shrink-0" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    {paths}
  </svg>
);

const ICONS: Record<SettingsSection, React.ReactNode> = {
  account: icon(
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>,
  ),
  plan: icon(
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="M3 10h18M7 15h4" />
    </>,
  ),
  "kids-mode": icon(
    <>
      <rect x="6" y="2" width="12" height="20" rx="3" />
      <path d="M11 18h2" />
    </>,
  ),
};

const TITLES: Record<SettingsSection, string> = { account: "Account", plan: "Plan & credits", "kids-mode": "Kids Mode" };

/**
 * Settings: the grown-up's account, the family's plan and credits, and Kids Mode, in one place. Desktop
 * keeps the sections in a rail beside the page; phones get a list of sections and a way back to it. Only
 * a family's parents see Plan & credits and Kids Mode.
 *
 * `list` is the Settings home on phones: the sections with a short summary each, under a way back to
 * the page that opened Settings. The section itself then shows from tablet width up.
 */
export function SettingsShell({
  current,
  guardian,
  back,
  list,
  children,
}: {
  current: SettingsSection;
  guardian: boolean;
  back?: { href: string; label: string };
  list?: Partial<Record<SettingsSection, string>>;
  children: React.ReactNode;
}) {
  const sections = SETTINGS_SECTIONS.filter((s) => guardian || !s.guardianOnly);
  const rail = sections.length > 1;
  const phoneList = rail && list;
  return (
    <FamilyShell wide>
      <PreviewNote />
      <div className={`grid items-start gap-8 ${rail ? "md:grid-cols-[13rem_minmax(0,1fr)]" : ""}`} data-testid="settings">
        {rail && (
          <nav aria-label="Settings" className="sticky top-24 hidden flex-col gap-1 md:flex">
            <p className="mb-2 ml-3 font-display text-2xl font-semibold">Settings</p>
            {sections.map((s) => (
              <Link
                key={s.id}
                href={s.href}
                aria-current={s.id === current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-2xl px-3 font-display font-medium ${s.id === current ? "bg-surface font-semibold ring-2 ring-ink/10" : "hover:bg-ink/5"}`}
              >
                {ICONS[s.id]}
                {s.label}
              </Link>
            ))}
            <hr className="mx-3 my-2 border-ink/10" />
            <Link href="/help" className="flex min-h-11 items-center px-3 text-sm text-muted hover:underline">
              Help and contact
            </Link>
          </nav>
        )}

        {phoneList && (
          <div className="flex flex-col gap-4 md:hidden" data-testid="settings-list">
            {back && <BackLink href={back.href} label={back.label} />}
            <h1 className="font-display text-4xl font-semibold">Settings</h1>
            <ul className="divide-y-2 divide-ink/5 overflow-hidden rounded-3xl bg-surface ring-2 ring-ink/10">
              {sections.map((s) => (
                <li key={s.id}>
                  <Link href={phoneHref(s.id)} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-ivory">
                    {ICONS[s.id]}
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="font-display text-lg font-semibold">{s.label}</span>
                      {list[s.id] && <span className="truncate text-sm text-muted">{list[s.id]}</span>}
                    </span>
                    <span aria-hidden="true" className="text-muted">
                      ›
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
            <Link href="/help" className="ml-1 text-sm text-muted underline underline-offset-4">
              Help and contact
            </Link>
          </div>
        )}

        <div className={`min-w-0 flex-col gap-5 ${phoneList ? "hidden md:flex" : "flex"}`}>
          {rail ? (
            <div className="md:hidden">
              <BackLink href={SETTINGS_HOME} label="Settings" />
            </div>
          ) : (
            back && <BackLink href={back.href} label={back.label} />
          )}
          {rail && back && (
            <div className="hidden md:block">
              <BackLink href={back.href} label={back.label} />
            </div>
          )}
          <h1 className="font-display text-4xl font-semibold">{rail ? TITLES[current] : "Settings"}</h1>
          {children}
        </div>
      </div>
    </FamilyShell>
  );
}
