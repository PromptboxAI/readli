/** Remembers a storyteller invitation in this browser, so it survives a sign-in email that loses the link. */
export const JOIN_COOKIE = "readli_join";

export function readJoinToken(value: string | undefined): string | null {
  const v = value ? decodeURIComponent(value) : "";
  return /^[A-Za-z0-9._~-]{16,200}$/.test(v) ? v : null;
}
