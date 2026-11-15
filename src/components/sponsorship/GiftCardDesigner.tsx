"use client";

import Image from "next/image";
import { useId, useMemo, useState } from "react";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { encodeQr } from "@/lib/qr/encode";
import { CARD_LIMITS, cardDefaults, cardInput, cardLink, cardPlace, HEADLINES, type CardChoices } from "@/lib/sponsorship/card-copy";
import type { GiftView } from "@/lib/sponsorship/view";

const field = "w-full rounded-2xl border-[3px] border-ink/20 bg-surface px-4 py-3 text-lg font-normal focus:border-ink";
const PREVIEW_COVERS = ["/covers/alices-adventures-in-wonderland.webp", "/covers/the-tale-of-peter-rabbit.webp", "/covers/winnie-the-pooh.webp"];
const FEATURES = [
  { title: "Classic storybooks, read aloud", body: "Peter Rabbit, Winnie-the-Pooh, Alice and dozens more bedtime favorites.", dot: "bg-coral" },
  { title: "In the voices your kids love", body: "Grandma, Grandpa or anyone in the family records about a minute, and Readli reads every story in their voice.", dot: "bg-sunshine" },
  { title: "Private and family-first", body: "Voices stay in your family circle, and every storyteller approves their own.", dot: "bg-mint" },
];

/**
 * The giver changes the card's words and sees it redraw as they type. The preview is drawn in HTML to the
 * same layout as the PDF, so it works on every phone; "Open the PDF" shows the exact file that prints.
 */
export function GiftCardDesigner({ gift, origin }: { gift: GiftView; origin: string }) {
  const id = useId();
  const live = gift.places.filter((p) => p.state !== "ended");
  const [seat, setSeat] = useState(live[0]?.seat ?? 1);
  const place = cardPlace(gift, seat);
  const [text, setText] = useState(() => cardDefaults(gift, place));
  const choices: CardChoices = { seat, ...text };
  const card = cardInput(gift, choices, origin);
  const link = cardLink(gift, place, origin);
  const qr = useMemo(() => encodeQr(link, "M"), [link]);

  const query = new URLSearchParams({ seat: String(seat), headline: text.headline, to: text.to, from: text.from, message: text.message }).toString();
  const pdfUrl = `/api/sponsorships/${gift.id}/card?${query}`;

  function pickFamily(next: number) {
    setSeat(next);
    const p = cardPlace(gift, next);
    setText((t) => ({ ...t, to: p?.name ?? "" }));
  }

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <form className="flex flex-col gap-5 rounded-[28px] bg-surface p-5 ring-2 ring-ink/10 sm:p-6" onSubmit={(e) => e.preventDefault()}>
        {live.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 font-semibold">Which family is this card for?</legend>
            <div className="flex flex-wrap gap-2">
              {live.map((p) => (
                <label key={p.seat} className={`cursor-pointer rounded-full px-4 py-2 font-semibold ring-2 ${seat === p.seat ? "bg-sunshine/60 ring-ink" : "bg-ivory ring-ink/15"}`}>
                  <input type="radio" name={`${id}-seat`} className="sr-only" checked={seat === p.seat} onChange={() => pickFamily(p.seat)} />
                  {p.name}
                </label>
              ))}
            </div>
          </fieldset>
        )}
        <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-headline`}>
          Headline
          <input id={`${id}-headline`} list={`${id}-headlines`} className={field} value={text.headline} maxLength={CARD_LIMITS.headline} onChange={(e) => setText({ ...text, headline: e.target.value })} />
          <datalist id={`${id}-headlines`}>
            {HEADLINES.map((h) => (
              <option key={h} value={h} />
            ))}
          </datalist>
        </label>
        <div className="flex flex-wrap gap-2" aria-label="Headline ideas">
          {HEADLINES.map((h) => (
            <button key={h} type="button" className="rounded-full bg-ivory px-3 py-1.5 text-sm font-semibold ring-2 ring-ink/10 hover:ring-ink/30" onClick={() => setText({ ...text, headline: h })}>
              {h}
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-to`}>
            For
            <input id={`${id}-to`} className={field} value={text.to} maxLength={CARD_LIMITS.to} placeholder="The Garcia family" onChange={(e) => setText({ ...text, to: e.target.value })} />
          </label>
          <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-from`}>
            From
            <input id={`${id}-from`} className={field} value={text.from} maxLength={CARD_LIMITS.from} placeholder="Grandma Rose" onChange={(e) => setText({ ...text, from: e.target.value })} />
          </label>
        </div>
        <label className="flex flex-col gap-1 font-semibold" htmlFor={`${id}-message`}>
          Your note
          <textarea id={`${id}-message`} rows={3} className={field} value={text.message} maxLength={CARD_LIMITS.message} placeholder="Can't wait to read to you every night!" onChange={(e) => setText({ ...text, message: e.target.value })} />
          <span className="text-sm font-normal text-muted">
            {text.message.length}/{CARD_LIMITS.message}. Changing it here only changes the printed card, not your gift email.
          </span>
        </label>
        <p className="rounded-2xl bg-sky/20 px-4 py-3 text-base">
          The QR code opens a welcome page for this family&apos;s gift, where they can ask for their invitation email again. The card can&apos;t open the gift by itself, so it&apos;s safe to hand over or post a photo of. The family still opens it from the email Readli sends them.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={`${pdfUrl}&download=1`} className={buttonPrimary} download>
            Download to print
          </a>
          <a href={pdfUrl} target="_blank" rel="noopener" className={buttonSecondary}>
            Open the PDF
          </a>
          <button type="button" className="font-semibold underline underline-offset-4" onClick={() => setText(cardDefaults(gift, place))}>
            Start over
          </button>
        </div>
      </form>

      <figure className="flex flex-col gap-2 lg:sticky lg:top-6">
        <div className="@container mx-auto w-full max-w-[560px]" aria-label="Preview of your printed card">
          <div className="relative aspect-[8.5/11] overflow-hidden rounded-[3cqw] bg-white p-[3.6cqw] shadow-[0_24px_50px_-28px_rgba(40,53,72,0.45)] ring-1 ring-ink/10">
            <div className="relative flex h-full flex-col items-center overflow-hidden rounded-[3.6cqw] border-[0.6cqw] border-ink bg-ivory px-[5cqw] pt-[5cqw] pb-[3cqw] text-center">
              <span className="absolute -top-[9cqw] -left-[9cqw] size-[20cqw] rounded-full bg-sunshine" aria-hidden="true" />
              <span className="absolute top-[-2cqw] -right-[7cqw] size-[13cqw] rounded-full bg-sky" aria-hidden="true" />
              <span className="absolute -right-[9cqw] -bottom-[9cqw] size-[17cqw] rounded-full bg-mint" aria-hidden="true" />
              <span className="absolute bottom-[3cqw] -left-[5cqw] size-[10cqw] rounded-full bg-lavender" aria-hidden="true" />
              <p className="relative flex items-center gap-[1.4cqw] font-display text-[4.6cqw] font-semibold">
                <Image src="/brand/readi-icon.webp" alt="" width={48} height={48} className="h-auto w-[7cqw]" />
                Readli
              </p>
              <p className="relative mt-[3.4cqw] text-[1.9cqw] font-extrabold tracking-[0.4cqw] text-coral-deep">{card.eyebrow}</p>
              <p className="relative mt-[2.4cqw] font-display text-[6.6cqw] leading-tight font-semibold break-words">{card.headline}</p>
              <p className="relative mt-[1.6cqw] text-[2.4cqw] font-bold">{card.presentedLine}</p>
              {card.extraLines?.map((l) => (
                <p key={l} className="relative text-[2.1cqw] font-bold text-coral-deep">
                  {l}
                </p>
              ))}
              {card.message && <p className="relative mt-[1cqw] line-clamp-3 max-w-[80%] text-[2.1cqw] text-plum">&ldquo;{card.message}&rdquo;</p>}

              <div className="relative mt-auto flex w-full items-center gap-[3cqw] rounded-[3cqw] bg-sky/30 p-[3cqw] text-left">
                <div className="relative h-[19cqw] w-[26cqw] shrink-0" aria-hidden="true">
                  {PREVIEW_COVERS.map((src, i) => (
                    <Image
                      key={src}
                      src={src}
                      alt=""
                      width={96}
                      height={128}
                      className="absolute top-[1cqw] h-auto w-[11cqw] border-[0.5cqw] border-white shadow-[0.4cqw_0.5cqw_0_rgba(40,53,72,0.6)]"
                      style={{ left: `${i * 7.5}cqw`, transform: `rotate(${[9, 0, -9][i]}deg)`, zIndex: i === 1 ? 2 : 1 }}
                    />
                  ))}
                </div>
                <div className="flex flex-col gap-[0.8cqw]">
                  <p className="font-display text-[2.8cqw] font-semibold">What&apos;s inside</p>
                  {FEATURES.map((f) => (
                    <div key={f.title} className="flex gap-[1.2cqw]">
                      <span className={`mt-[0.6cqw] size-[1.5cqw] shrink-0 rounded-full ${f.dot}`} />
                      <p className="text-[1.6cqw] leading-snug text-muted">
                        <span className="block font-extrabold text-ink">{f.title}</span>
                        {f.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative mt-[3cqw] flex w-full items-center gap-[3.4cqw] rounded-[3cqw] border-[0.3cqw] border-dashed border-coral bg-white p-[2.6cqw] text-left">
                <QrPreview modules={qr.modules} />
                <div className="flex flex-col gap-[0.9cqw]">
                  <p className="font-display text-[2.9cqw] font-semibold">{card.scanLine}</p>
                  <ol className="flex flex-col gap-[0.7cqw]">
                    {card.steps?.map((s, i) => (
                      <li key={s} className="flex items-start gap-[1.2cqw] text-[1.85cqw]">
                        <span className="flex size-[2.8cqw] shrink-0 items-center justify-center rounded-full bg-sunshine/50 text-[1.6cqw] font-extrabold">{i + 1}</span>
                        {s}
                      </li>
                    ))}
                  </ol>
                  <p className="text-[1.6cqw] text-muted">{card.qrCaption}</p>
                </div>
              </div>

              <p className="relative mt-[3cqw] text-[1.8cqw]">{card.termLine}</p>
              <p className="relative text-[1.8cqw] font-bold">{card.claimByLine}</p>
              <p className="relative mt-[1.4cqw] font-display text-[2cqw] font-semibold text-coral-deep">{card.tagline}</p>
            </div>
          </div>
        </div>
        <figcaption className="text-center text-sm text-muted">Preview. Prints on one US Letter page (8.5 × 11 in).</figcaption>
      </figure>
    </div>
  );
}

function QrPreview({ modules }: { modules: boolean[][] }) {
  const size = modules.length;
  const path = modules.flatMap((row, y) => row.map((on, x) => (on ? `M${x + 2} ${y + 2}h1v1h-1z` : ""))).join("");
  return (
    <svg viewBox={`0 0 ${size + 4} ${size + 4}`} className="size-[22cqw] shrink-0 rounded-[1.4cqw] border-[0.35cqw] border-ink bg-white" role="img" aria-label="QR code that opens the gift's welcome page">
      <path d={path} fill="#000" />
    </svg>
  );
}
