import { certificateHeadline, claimByLabel, presentedLine } from "@/lib/gifting/complimentary-copy";
import { certificatePdf } from "@/lib/pdf/certificate";
import { encodeQr } from "@/lib/qr/encode";
import { qrPng, qrSvg } from "@/lib/qr/render";
import { claimLink, type MembershipArtwork } from "./complimentary";

/**
 * A membership's printable artwork. Everything is drawn from the one stored code, so the QR code,
 * the printed manual code and the certificate always redeem the same membership. Making artwork
 * never issues or changes anything.
 */
export function membershipQr(art: MembershipArtwork, origin: string) {
  return encodeQr(claimLink(origin, art.code), "M");
}

export function membershipQrPng(art: MembershipArtwork, origin: string): Buffer {
  return qrPng(membershipQr(art, origin));
}

export function membershipQrSvg(art: MembershipArtwork, origin: string): string {
  return qrSvg(membershipQr(art, origin), `Readli gift ${art.certificate}`);
}

export function membershipCertificate(art: MembershipArtwork, origin: string): Buffer {
  const b = art.batch;
  const claimBy = claimByLabel(b.claimBy);
  return certificatePdf(
    {
      headline: certificateHeadline(b.months),
      presentedLine: presentedLine({ sponsorName: b.sponsorName, sponsorIsReadli: b.sponsorIsReadli, eventName: b.eventName }, false),
      message: b.message,
      qr: membershipQr(art, origin),
      code: art.code,
      claimHost: new URL(origin).host.replace(/^www\./, ""),
      termLine: `${b.months === 1 ? "1 month" : `${b.months} months`} · No credit card required · Does not renew automatically`,
      claimByLine: `One family, one claim.${claimBy ? ` Claim by ${claimBy}.` : ""}`,
      certificateLabel: art.certificate,
    },
    `Readli gift certificate ${art.certificate}`,
  );
}
