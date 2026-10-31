import { NextResponse } from "next/server";
import { formFile, text, withDonations } from "@/lib/donations/http";
import { validateDonation, type DonationForm } from "@/lib/donations/program";
import { clientHash, submitDonationRequest } from "@/lib/donations/server";
import { fail } from "@/lib/server/http";
import { allow, clientAddress } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** A Readli Gives Back request (multipart, so a flyer can come with it). Public: no account needed. */
export async function POST(req: Request) {
  const address = clientAddress(req);
  if (!allow(`donation:${address}`, 5, 10 * 60_000)) return fail(429, "slow_down", "Please wait a few minutes and try again.");
  const form = await req.formData().catch(() => null);
  if (!form) return fail(400, "bad_form", "Please fill in the form and try again.");
  // A hidden field people never see; bots that fill everything in are quietly thanked and ignored.
  if (text(form, "company_fax").trim()) return NextResponse.json({ reference: null }, { headers: { "cache-control": "no-store" } });
  const yes = (name: string) => text(form, name) === "on" || text(form, name) === "true";
  const input: DonationForm = {
    orgName: text(form, "orgName"),
    orgType: text(form, "orgType"),
    orgWebsite: text(form, "orgWebsite"),
    orgProof: text(form, "orgProof"),
    orgEin: text(form, "orgEin"),
    orgStreet: text(form, "orgStreet"),
    orgCity: text(form, "orgCity"),
    orgState: text(form, "orgState"),
    orgZip: text(form, "orgZip"),
    contactName: text(form, "contactName"),
    contactRole: text(form, "contactRole"),
    contactEmail: text(form, "contactEmail"),
    contactPhone: text(form, "contactPhone"),
    eventName: text(form, "eventName"),
    eventType: text(form, "eventType"),
    eventDate: text(form, "eventDate"),
    beneficiary: text(form, "beneficiary"),
    eventLocation: text(form, "eventLocation"),
    eventOnline: yes("eventOnline"),
    eventUrl: text(form, "eventUrl"),
    attendance: text(form, "attendance"),
    donationUse: text(form, "donationUse"),
    certificateDelivery: text(form, "certificateDelivery"),
    certificateOrgName: text(form, "certificateOrgName"),
    notes: text(form, "notes"),
    // The form has one checkbox that covers all three.
    confirmAuthorized: yes("confirm") || yes("confirmAuthorized"),
    confirmCharitable: yes("confirm") || yes("confirmCharitable"),
    agreeTerms: yes("confirm") || yes("agreeTerms"),
  };
  const checked = validateDonation(input);
  if (!checked.ok) return fail(400, "invalid", "Please fix the highlighted fields.", { fields: checked.errors });
  const flyer = await formFile(form, "flyer");
  return withDonations(async (ctx) => {
    const { reference } = await submitDonationRequest(ctx, checked.value, { flyer, client: clientHash(ctx.secret, address) });
    return NextResponse.json({ reference }, { headers: { "cache-control": "no-store" } });
  });
}
