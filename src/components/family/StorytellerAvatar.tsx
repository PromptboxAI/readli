import { initials } from "@/lib/content/example-family";

/** Selfie avatar, or tinted initials until the person adds a selfie. */
export function StorytellerAvatar({
  name,
  avatarUrl,
  tint,
  size = "md",
  muted = false,
}: {
  name: string;
  avatarUrl: string | null;
  tint: string;
  size?: "xs" | "sm" | "md" | "lg";
  muted?: boolean;
}) {
  const dims = { xs: "size-8 text-xs", sm: "size-10 text-base", md: "size-14 text-xl", lg: "size-24 text-3xl" }[size];
  const ring = muted ? "border-dashed border-ink/40 opacity-70" : "border-ink";
  if (avatarUrl) {
    // eslint-disable-next-line @next/next/no-img-element -- user selfies come from signed storage URLs
    return <img src={avatarUrl} alt="" className={`${dims} shrink-0 rounded-full border-[3px] object-cover ${ring}`} />;
  }
  return (
    <span aria-hidden="true" className={`grid ${dims} shrink-0 place-items-center rounded-full border-[3px] font-display font-semibold text-ink ${tint} ${ring}`}>
      {initials(name)}
    </span>
  );
}
