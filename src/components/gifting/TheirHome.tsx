/** What the recipient controls, and what the giver never sees. Shown to givers and recipients alike. */
export function TheirHome({ giver = "The giver", audience = "giver" }: { giver?: string; audience?: "giver" | "recipient" }) {
  const yours = audience === "recipient";
  const items = [
    ["Account", yours ? "Your own Readli account and sign-in." : "Their own Readli account and sign-in."],
    ["Family circle", yours ? "You choose who joins your family." : "They choose who joins their family."],
    ["Children", yours ? "You set up and manage your kids' profiles." : "They set up and manage their kids' profiles."],
    ["Voices", yours ? "You decide which voices your kids can hear." : "They decide which voices their kids can hear."],
  ];
  return (
    <section aria-labelledby={`their-home-${audience}`} className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-6 ring-2 ring-ink/10 sm:p-8">
      <h2 id={`their-home-${audience}`} className="font-display text-2xl font-semibold">
        {yours ? "Your home, your rules" : "You pay. They run their own home."}
      </h2>
      <ul className="grid gap-3 sm:grid-cols-2">
        {items.map(([title, body]) => (
          <li key={title} className="rounded-2xl bg-ivory p-4">
            <span className="block font-display font-semibold">{title}</span>
            {body}
          </li>
        ))}
      </ul>
      <p className="text-sm">
        {yours
          ? `${giver} paid for the plan, but can't see your family circle, your children or anyone's voice. They only see whether the gift was opened.`
          : "You'll see whether your gift was opened and when it ends. You won't see their family circle, children or voices."}
      </p>
    </section>
  );
}
