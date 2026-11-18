import { certificateHeadline, claimByLabel, presentedLine } from "@/lib/gifting/complimentary-copy";
import { certificatePdf } from "@/lib/pdf/certificate";
import { encodeQr } from "@/lib/qr/encode";
import { qrPng, qrSvg } from "@/lib/qr/render";
import { claimLink, claimPath, type MembershipArtwork } from "./complimentary";

/**
 * A membership's printable artwork. Everything is drawn from the one stored code, so the QR code,
 * the printed manual code and the certificate always redeem the same membership. Making artwork
 * never issues or changes anything.
 */
export function membershipQr(art: MembershipArtwork, origin: string) {
  return encodeQr(claimLink(origin, art.code, claimPath(art.batch.program)), "M");
}

export function membershipQrPng(art: MembershipArtwork, origin: string): Buffer {
  return qrPng(membershipQr(art, origin));
}

export function membershipQrSvg(art: MembershipArtwork, origin: string): string {
  return qrSvg(membershipQr(art, origin), `Readli gift ${art.certificate}`);
}

/** Readli Gives Back certificates use the spec's wording (2026-10-30); the retail value is the live annual price. */
export interface CertificateOptions {
  retailValue?: string;
}

export function membershipCertificate(art: MembershipArtwork, origin: string, opts: CertificateOptions = {}): Buffer {
  const b = art.batch;
  const claimBy = claimByLabel(b.claimBy);
  const host = new URL(origin).host.replace(/^www\./, "");
  if (b.program === "readli_gives_back") {
    return certificatePdf(
      {
        eyebrow: "READLI GIVES BACK",
        headline: "A Whole Year of Stories Awaits!",
        presentedLine: "You've won a Readli Family Annual Membership! Enjoy 12 months of personalized family storytelling with Readli.",
        extraLines: [`Donated by Readli.ai${b.supportingName ? ` · Proudly supporting ${b.supportingName}` : ""}`],
        message: null,
        qr: membershipQr(art, origin),
        code: art.code,
        claimHost: host,
        claimPath: "/redeem",
        scanLine: "Scan to activate your membership.",
        termLine: `12-Month Family Membership${opts.retailValue ? ` · Retail-equivalent value ${opts.retailValue}` : ""} · No credit card required`,
        claimByLine: claimBy ? `Activate by ${claimBy}` : "Single-use code",
        finePrint:
          "Valid for one new or eligible Readli Family membership. Single-use code. No cash value. Cannot be resold or exchanged for cash. Subject to Readli membership and gift terms. Does not renew automatically.",
        tagline: "Every Book. Every Voice.",
        certificateLabel: art.certificate,
      },
      `Readli Gives Back certificate ${art.certificate}`,
    );
  }
  return certificatePdf(
    {
      headline: certificateHeadline(b.months),
      presentedLine: presentedLine({ sponsorName: b.sponsorName, sponsorIsReadli: b.sponsorIsReadli, eventName: b.eventName }, false),
      message: b.message,
      qr: membershipQr(art, origin),
      code: art.code,
      claimHost: host,
      termLine: `${b.months === 1 ? "1 month" : `${b.months} months`} · No credit card required · Does not renew automatically`,
      claimByLine: `One family, one claim.${claimBy ? ` Claim by ${claimBy}.` : ""}`,
      certificateLabel: art.certificate,
    },
    `Readli gift certificate ${art.certificate}`,
  );
}
