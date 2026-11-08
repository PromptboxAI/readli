/** A book cover on the kids bookshelf, with the title spelled out when there is no art. */
export function KidsCover({ url, tint, title }: { url: string | null; tint: string; title: string }) {
  return (
    <span className={`relative block aspect-[3/4] overflow-hidden rounded-2xl shadow-[0_4px_0_rgb(40_53_72/0.12)] ring-2 ring-ink/10 ${tint}`}>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element -- static catalog cover art
        <img src={url} alt="" className="size-full object-cover" />
      ) : (
        <span className="grid size-full place-items-center p-2 text-center font-display font-semibold">{title}</span>
      )}
    </span>
  );
}
