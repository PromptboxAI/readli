import { unsubscribeGiftRecipient } from "@/lib/gifting/delivery";
import { withRecipient } from "@/lib/invitations/http";

export const dynamic = "force-dynamic";

/** One-click unsubscribe from a gift email's List-Unsubscribe header (RFC 8058). Only POST changes anything. */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return withRecipient(req, async ({ db, secret }) => {
    const ok = await unsubscribeGiftRecipient(db, secret, token);
    const body = ok ? "Done. Readli won't email you again." : "This link isn't valid.";
    const html = req.headers.get("content-type")?.includes("form") ?? false;
    return new Response(html ? page(`<p>${body}</p>`) : body, {
      status: ok ? 200 : 404,
      headers: { "content-type": html ? "text/html; charset=utf-8" : "text/plain" },
    });
  });
}

/** The footer link opens a confirm button, so link scanners that follow it don't unsubscribe anyone. */
export async function GET() {
  return new Response(page(`<p>Stop all emails from Readli to this address?</p><form method="post"><button type="submit">Stop Readli emails</button></form>`), {
    headers: { "content-type": "text/html; charset=utf-8" },
  });
}

const page = (inner: string) =>
  `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><title>Readli emails</title></head><body style="font-family:Arial,Helvetica,sans-serif;max-width:480px;margin:48px auto;padding:0 16px;color:#2a2340">${inner}</body></html>`;
