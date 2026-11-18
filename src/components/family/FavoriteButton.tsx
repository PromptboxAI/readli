"use client";

/** Heart toggle for one child's favorite stories. Favorites only arrange the shelf; they never change who may read or cost credits. */
export function FavoriteButton({ title, on, onToggle }: { title: string; on: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Favorite: ${title}`}
      onClick={onToggle}
      className="grid size-12 shrink-0 place-items-center rounded-full text-2xl hover:bg-coral/20"
    >
      <span aria-hidden="true" className={`transition-transform duration-200 motion-safe:active:scale-125 ${on ? "scale-110 text-coral-deep" : "text-ink/30"}`}>
        ♥
      </span>
    </button>
  );
}
