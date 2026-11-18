import type { CertificateInput } from "@/lib/pdf/certificate";
import { encodeQr } from "@/lib/qr/encode";
import { shortDate } from "./rules";
import type { GiftView, PlaceView } from "./view";

/**
 * The printable card a giver can hand over with a Readli Family gift (Kevin, 2026-11-15). It reuses the
 * complimentary certificate's design, but carries no secret: the family still opens the gift from the
 * invitation email, so a lost or photographed card can't be used by anyone else. Its QR code opens the
 * gift's welcome page (/gift/card/[id]), which explains how to open it and can resend the invitation to
 * the address the giver entered. The giver can change the headline, the names and the note before printing.
 */
export interface CardChoices {
  seat?: number;
  headline?: string;
  to?: string;
  from?: string;
  message?: string;
}

export const CARD_LIMITS = { headline: 40, to: 60, from: 60, message: 200 } as const;

export const HEADLINES = ["A Year of Stories", "A Gift of Stories", "Stories in My Voice", "Bedtime Stories, From Me to You"] as const;

const clean = (v: string | undefined, max: number) => (v ?? "").replace(/\s+/g, " ").trim().slice(0, max);

/** Where the card's QR code goes: the gift's own welcome page, for this family. */
export function cardLink(gift: GiftView, place: PlaceView | null, origin: string): string {
  return `${origin.replace(/\/$/, "")}/gift/card/${gift.id}?seat=${place?.seat ?? 1}`;
}

/** The family the card is for: the seat asked for if it's live, else the first live one. */
export function cardPlace(gift: GiftView, seat?: number): PlaceView | null {
  const live = gift.places.filter((p) => p.state !== "ended");
  return live.find((p) => p.seat === seat) ?? live[0] ?? null;
}

/** What the card says before the giver changes anything. */
export function cardDefaults(gift: GiftView, place: PlaceView | null): Required<Omit<CardChoices, "seat">> {
  return {
    headline: gift.plan === "annual" ? HEADLINES[0] : HEADLINES[1],
    to: place?.name ?? "",
    from: gift.giverName,
    message: gift.message,
  };
}

export function cardInput(gift: GiftView, choices: CardChoices, origin: string, now = new Date()): CertificateInput {
  const place = cardPlace(gift, choices.seat);
  const d = cardDefaults(gift, place);
  const pick = (k: keyof typeof CARD_LIMITS) => (choices[k] === undefined ? d[k] : clean(choices[k], CARD_LIMITS[k]));
  const headline = pick("headline") || d.headline;
  const to = pick("to");
  const from = pick("from");
  const message = pick("message");
  const host = new URL(origin).host.replace(/^www\./, "");
  const delivered = Date.parse(gift.deliverAt) <= now.getTime() && gift.status !== "scheduled";
  const joined = place?.state === "joined";
  const voice = place && place.voice !== "not_shared";

  const steps = joined
    ? ["Your gift is already open in Readli.", "Pick tonight's story and press play.", "No tech skills needed."]
    : delivered
      ? [`Find the email from Readli: "${from || "Someone"} gave your family Readli".`, "Tap Open your gift, then add your kids.", "No app to install and no tech skills needed."]
      : [`Watch for an email from Readli on ${shortDate(new Date(gift.deliverAt))}.`, "Tap Open your gift, then add your kids.", "No app to install and no tech skills needed."];

  return {
    eyebrow: "A GIFT FOR YOUR FAMILY",
    headline,
    presentedLine: [to && `For ${to}`, from && `From ${from}`].filter(Boolean).join(" · ") || "Readli Family",
    extraLines: voice ? [`With stories read in ${from || "your storyteller"}'s own voice`] : [],
    message: message || null,
    qr: encodeQr(cardLink(gift, place, origin), "M"),
    steps,
    qrCaption: "Scan the code to see your gift.",
    scanLine: joined ? "Your stories are ready" : "Your gift arrives by email",
    claimHost: host,
    termLine: gift.plan === "annual" ? "12 months of Readli Family · Paid in full · Does not renew" : `Readli Family, paid monthly by ${from || "the giver"}`,
    claimByLine: delivered ? "Your invitation is in your inbox." : `Arrives ${shortDate(new Date(gift.deliverAt))}`,
    certificateLabel: "Readli Family gift",
    tagline: "Every Book. Every Voice.",
  };
}
