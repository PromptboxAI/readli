import { currentAdult } from "@/lib/auth/adult";
import { fail } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";
import { giftCardPdf } from "@/lib/sponsorship/card";
import { sponsorshipContext } from "@/lib/sponsorship/http";
import { sponsorGifts } from "@/lib/sponsorship/view";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * The giver's printable gift card as a PDF, shown inline for the live preview or as a download with
 * ?download=1. Only the giver can make it, and making it changes nothing about the gift.
 */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await sponsorshipContext();
  if (!ctx) return fail(404, "not_found", "Not found.");
  const user = await currentAdult();
  if (!user) return fail(401, "sign_in_required", "Please sign in to continue.");
  // The preview redraws as the giver types, so this allows more than the other gift actions.
  if (!allow(`gift-card:${user.id}`, 90, 60_000)) return fail(429, "slow_down", "That's a lot at once. Please wait a minute and try again.");
  const gift = (await sponsorGifts(ctx.db, user.id)).find((g) => g.id === id);
  if (!gift) return fail(404, "not_found", "We couldn't find that gift.");

  const q = new URL(req.url).searchParams;
  const text = (k: string) => (q.has(k) ? (q.get(k) ?? "") : undefined);
  const seat = Number(q.get("seat"));
  const pdf = giftCardPdf(gift, { seat: Number.isInteger(seat) ? seat : undefined, headline: text("headline"), to: text("to"), from: text("from"), message: text("message") }, ctx.base);
  const download = q.get("download") === "1";
  return new Response(new Uint8Array(pdf), {
    headers: {
      "content-type": "application/pdf",
      "content-disposition": `${download ? "attachment" : "inline"}; filename="readli-gift-card.pdf"`,
      "cache-control": "private, no-store",
      "x-robots-tag": "noindex",
    },
  });
}
