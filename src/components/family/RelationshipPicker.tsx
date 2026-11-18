"use client";

import { useId, useState } from "react";
import { RELATIONSHIP_MAX, RELATIONSHIPS } from "@/lib/invites/family-invites";

const chip = (on: boolean) =>
  `cursor-pointer rounded-full px-4 py-2 font-display ring-2 has-[:focus-visible]:outline has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-coral-deep ${on ? "bg-ink text-white ring-ink" : "bg-ivory ring-ink/15"}`;

/**
 * How a family describes someone: a suggestion, their own words ("Other"), or no label. "" means no label.
 * Display only; a label never shares a voice, uses a narrator slot or approves anyone for a child.
 */
export function RelationshipPicker({ legend, value, onChange }: { legend: React.ReactNode; value: string; onChange: (value: string) => void }) {
  const id = useId();
  const suggested = (RELATIONSHIPS as readonly string[]).includes(value);
  const [other, setOther] = useState(value !== "" && !suggested);
  const mode = other ? "other" : suggested ? value : "";
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="font-display text-lg font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {RELATIONSHIPS.map((r) => (
          <label key={r} className={chip(mode === r)}>
            <input
              type="radio"
              name={`${id}-relationship`}
              value={r}
              checked={mode === r}
              onChange={() => {
                setOther(false);
                onChange(r);
              }}
              className="sr-only"
            />
            {r}
          </label>
        ))}
        <label className={chip(mode === "other")}>
          <input
            type="radio"
            name={`${id}-relationship`}
            value="other"
            checked={mode === "other"}
            onChange={() => {
              setOther(true);
              onChange(suggested ? "" : value);
            }}
            className="sr-only"
          />
          Other…
        </label>
        <label className={chip(mode === "")}>
          <input
            type="radio"
            name={`${id}-relationship`}
            value=""
            checked={mode === ""}
            onChange={() => {
              setOther(false);
              onChange("");
            }}
            className="sr-only"
          />
          No label
        </label>
      </div>
      {other && (
        <label className="flex flex-col gap-1 text-sm font-semibold">
          In your own words
          <input
            className="min-h-12 rounded-2xl border-[3px] border-ink/20 bg-surface px-4 text-lg font-normal focus:border-ink"
            value={value}
            maxLength={RELATIONSHIP_MAX}
            placeholder="Nanny Pat, Bonus mom, Neighbor…"
            onChange={(e) => onChange(e.target.value)}
            autoComplete="off"
          />
        </label>
      )}
    </fieldset>
  );
}
