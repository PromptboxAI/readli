/** Large on/off switch (48px target). */
export function Toggle({
  checked,
  disabled,
  label,
  onChange,
}: {
  checked: boolean;
  disabled?: boolean;
  label: string;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-10 w-[4.5rem] shrink-0 items-center rounded-full border-[3px] border-ink transition-colors disabled:cursor-not-allowed disabled:border-ink/30 disabled:bg-ink/10 ${checked ? "bg-mint" : "bg-surface"}`}
    >
      <span
        aria-hidden="true"
        className={`absolute size-7 rounded-full border-[3px] border-ink bg-white transition-transform ${checked ? "translate-x-[2.1rem]" : "translate-x-0.5"} ${disabled ? "border-ink/30" : ""}`}
      />
    </button>
  );
}
