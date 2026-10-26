"use client";

import { useRef } from "react";

export const CODE_LENGTH = 6;

/**
 * Six boxes for the emailed sign-in code, one digit each. Typing moves on, Backspace moves back, and
 * pasting (or the phone's "from Messages/Mail" suggestion, which fills the first box) spreads the
 * digits across the boxes. Calls onComplete once all six are filled.
 */
export function CodeBoxes({
  value,
  onChange,
  onComplete,
  disabled = false,
  labelledBy,
}: {
  value: string;
  onChange: (code: string) => void;
  onComplete?: (code: string) => void;
  disabled?: boolean;
  labelledBy: string;
}) {
  const boxes = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => value[i] ?? "");

  const set = (code: string, focus: number) => {
    const next = code.replace(/\D/g, "").slice(0, CODE_LENGTH);
    onChange(next);
    boxes.current[Math.min(focus, CODE_LENGTH - 1)]?.focus();
    if (next.length === CODE_LENGTH) onComplete?.(next);
  };

  const typed = (i: number, raw: string) => {
    const got = raw.replace(/\D/g, "");
    if (!got) return;
    // More than one digit at once is a paste or an autofilled code: fill from this box on.
    const code = (value.slice(0, i) + got).slice(0, CODE_LENGTH);
    set(code, code.length);
  };

  return (
    <div role="group" aria-labelledby={labelledBy} className="flex w-full max-w-sm gap-1.5 sm:gap-2" data-testid="code-boxes">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            boxes.current[i] = el;
          }}
          aria-label={`Digit ${i + 1} of ${CODE_LENGTH}`}
          className="h-14 w-0 min-w-0 flex-1 rounded-2xl border-[3px] border-ink/20 bg-surface text-center font-display text-2xl font-semibold focus:border-ink disabled:opacity-60 sm:text-3xl"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          pattern="[0-9]*"
          maxLength={i === 0 ? CODE_LENGTH : 1}
          autoFocus={i === 0}
          disabled={disabled}
          value={d}
          onFocus={(e) => e.target.select()}
          onChange={(e) => typed(i, e.target.value)}
          onPaste={(e) => {
            e.preventDefault();
            typed(i, e.clipboardData.getData("text"));
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace") {
              e.preventDefault();
              if (d) set(value.slice(0, i) + value.slice(i + 1), i);
              else if (i > 0) set(value.slice(0, i - 1) + value.slice(i), i - 1);
            } else if (e.key === "ArrowLeft" && i > 0) boxes.current[i - 1]?.focus();
            else if (e.key === "ArrowRight" && i < CODE_LENGTH - 1) boxes.current[i + 1]?.focus();
          }}
        />
      ))}
    </div>
  );
}
