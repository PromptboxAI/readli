"use client";

import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { normalizeGiftCode } from "@/lib/gifting/codes";

export function RedeemForm() {
  const id = useId();
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeGiftCode(code);
    if (!normalized) {
      setError("That doesn't look like a gift code. It's 12 letters and numbers, like ABCD-EFGH-JKMN.");
      return;
    }
    router.push(`/gift/open?code=${normalized}`);
  }

  return (
    <form onSubmit={submit} className="flex w-full max-w-md flex-col gap-3" aria-label="Redeem a gift code" noValidate>
      <label htmlFor={`${id}-code`} className="font-display text-lg font-semibold">
        Gift code
      </label>
      <input
        id={`${id}-code`}
        value={code}
        onChange={(e) => {
          setCode(e.target.value);
          setError("");
        }}
        placeholder="ABCD-EFGH-JKMN"
        autoComplete="off"
        autoCapitalize="characters"
        spellCheck={false}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-err` : undefined}
        className="min-h-14 rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-center font-display text-2xl tracking-widest focus:border-ink"
      />
      {error && (
        <p id={`${id}-err`} role="alert" className="font-semibold text-coral-deep">
          {error}
        </p>
      )}
      <button type="submit" className={buttonPrimary}>
        Open my gift
      </button>
    </form>
  );
}
