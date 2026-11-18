/** How long a freshly prepared audiobook counts as new, on Readli Kids and the Family bookshelf. */
export const NEWEST_DAYS = 14;

/** A prepared audiobook is new for NEWEST_DAYS after its last sentence was stored. */
export function isNewlyPrepared(preparedAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!preparedAt) return false;
  const at = Date.parse(preparedAt);
  return Number.isFinite(at) && now - at <= NEWEST_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The Family bookshelf's New badge: newly prepared, and not every child who can hear it has finished it yet.
 * `places` holds each child's place in the book, null when not started and 100 when finished.
 */
export function isNewOnFamilyShelf(preparedAt: string | null | undefined, places: readonly (number | null)[], now: number = Date.now()): boolean {
  return isNewlyPrepared(preparedAt, now) && (places.length === 0 || places.some((p) => p !== 100));
}
