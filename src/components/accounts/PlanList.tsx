/** Tick list for what an account includes (or, with `cross`, leaves out). */
export function PlanList({ items, cross = false, className = "" }: { items: readonly string[]; cross?: boolean; className?: string }) {
  return (
    <ul className={`flex flex-col gap-2 ${className}`}>
      {items.map((t) => (
        <li key={t} className="flex gap-2">
          <span aria-hidden="true" className={`mt-0.5 grid size-5 shrink-0 place-items-center rounded-full text-xs font-bold ${cross ? "bg-ink/10" : "bg-mint"}`}>
            {cross ? "✕" : "✓"}
          </span>
          {cross ? <span className="text-muted">{t}</span> : t}
        </li>
      ))}
    </ul>
  );
}
