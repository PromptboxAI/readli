/**
 * Readli Gives Back (Kevin, 2026-10-30): complimentary 12-month Readli Family memberships for school,
 * PTA, library and nonprofit fundraisers. Safe for client components: no server-only imports.
 *
 * Phase 1 sends every request to a person for review. The form, its rules and the automatic checks
 * live here so the page, the API and the admin portal agree.
 */

export const ORG_TYPES = {
  school: "Elementary school or school district",
  preschool: "Preschool or early learning program",
  pta: "PTA, PTO or parent organization",
  library: "Public library or literacy program",
  nonprofit: "Registered nonprofit or charity",
  hospital: "Children's hospital or family charity",
  committee: "Fundraising committee for an eligible organization",
  youth: "Youth or family community program",
  other: "Other",
} as const;
export type OrgType = keyof typeof ORG_TYPES;

export const EVENT_TYPES = {
  raffle: "Raffle",
  silent_auction: "Silent auction",
  live_auction: "Live auction",
  tricky_tray: "Tricky tray",
  basket_dinner: "Basket dinner or basket auction",
  gala: "Fundraising gala or dinner",
  school_fair: "School fair or carnival",
  online: "Online fundraiser",
  other: "Other charitable event",
} as const;
export type EventType = keyof typeof EVENT_TYPES;

export const DONATION_USES = {
  raffle: "Raffle prize",
  silent_auction: "Silent auction item",
  live_auction: "Live auction item",
  tricky_tray: "Tricky tray prize",
  gift_basket: "Part of a gift basket",
  door_prize: "Door prize",
  other: "Other",
} as const;
export type DonationUse = keyof typeof DONATION_USES;

export const US_STATES: Record<string, string> = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California", CO: "Colorado", CT: "Connecticut", DE: "Delaware",
  DC: "District of Columbia", FL: "Florida", GA: "Georgia", HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland", MA: "Massachusetts", MI: "Michigan", MN: "Minnesota",
  MS: "Mississippi", MO: "Missouri", MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey", NM: "New Mexico",
  NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio", OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island",
  SC: "South Carolina", SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont", VA: "Virginia", WA: "Washington",
  WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming", PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands", AS: "American Samoa", MP: "Northern Mariana Islands",
};

/** The winner's membership: always a year, and the certificate can be claimed for a year after the event. */
export const DONATION_MONTHS = 12;
export const CLAIM_MONTHS_AFTER_EVENT = 12;
/** How far ahead an event may be when the request comes in, and how recently it may have happened. */
export const EVENT_MAX_DAYS_AHEAD = 365;
export const EVENT_MAX_DAYS_PAST = 14;
export const FLYER_MAX_BYTES = 10 * 1024 * 1024;
export const FLYER_TYPES = ["application/pdf", "image/png", "image/jpeg", "image/webp"] as const;

export type DonationStatus = "pending" | "needs_info" | "approved" | "rejected";
export const STATUS_LABELS: Record<DonationStatus, string> = {
  pending: "Under review",
  needs_info: "More information needed",
  approved: "Approved",
  rejected: "Not approved",
};

export interface DonationForm {
  orgName: string;
  orgType: string;
  orgWebsite: string;
  orgProof: string;
  orgEin: string;
  orgStreet: string;
  orgCity: string;
  orgState: string;
  orgZip: string;
  contactName: string;
  contactRole: string;
  contactEmail: string;
  contactPhone: string;
  eventName: string;
  eventType: string;
  eventDate: string;
  beneficiary: string;
  eventLocation: string;
  eventOnline: boolean;
  eventUrl: string;
  attendance: string;
  donationUse: string;
  certificateDelivery: string;
  certificateOrgName: string;
  notes: string;
  confirmAuthorized: boolean;
  confirmCharitable: boolean;
  agreeTerms: boolean;
}

export interface ValidDonation {
  orgName: string;
  orgType: OrgType;
  orgWebsite: string | null;
  orgProof: string | null;
  orgEin: string | null;
  orgStreet: string | null;
  orgCity: string | null;
  orgState: string | null;
  orgZip: string | null;
  contactName: string;
  contactRole: string | null;
  contactEmail: string;
  contactPhone: string | null;
  eventName: string;
  eventType: EventType;
  eventDate: string;
  beneficiary: string;
  eventLocation: string | null;
  eventOnline: boolean;
  eventUrl: string | null;
  attendance: number | null;
  donationUse: DonationUse | null;
  certificateDelivery: "email" | "download";
  certificateOrgName: string | null;
  notes: string | null;
}

export type FieldErrors = Partial<Record<keyof DonationForm, string>>;

const clean = (v: string | undefined, max: number) => v?.replace(/\s+/g, " ").trim().slice(0, max) || null;
const cleanBlock = (v: string | undefined, max: number) => v?.replace(/\r\n/g, "\n").trim().slice(0, max) || null;

/** "oakstreetpta.org" → "https://oakstreetpta.org". Null for anything that isn't a web address. */
export function normalizeUrl(input: string | undefined): string | null {
  const v = input?.trim();
  if (!v) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(v) ? v : `https://${v}`);
    if (!/^https?:$/.test(url.protocol) || !url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString().slice(0, 300);
  } catch {
    return null;
  }
}

const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/** Checks the request form. Every message is written for the person filling it in. */
export function validateDonation(form: DonationForm, at = new Date()): { ok: true; value: ValidDonation } | { ok: false; errors: FieldErrors } {
  const errors: FieldErrors = {};
  const orgName = clean(form.orgName, 160);
  if (!orgName) errors.orgName = "Enter your organization's name.";
  if (!(form.orgType in ORG_TYPES)) errors.orgType = "Choose the kind of organization.";
  const orgWebsite = normalizeUrl(form.orgWebsite);
  const orgProof = cleanBlock(form.orgProof, 600);
  if (form.orgWebsite.trim() && !orgWebsite) errors.orgWebsite = "That web address doesn't look right.";
  else if (!orgWebsite && !orgProof) errors.orgWebsite = "Add your organization's website or official page, or tell us how we can confirm your organization.";
  const orgEin = clean(form.orgEin, 20);
  if (orgEin && !/^\d{2}-?\d{7}$/.test(orgEin)) errors.orgEin = "An EIN is 9 digits, like 12-3456789. You can leave it blank.";
  const orgState = form.orgState ? form.orgState.toUpperCase() : null;
  if (!orgState || !US_STATES[orgState]) errors.orgState = "Choose your state.";
  const orgZip = clean(form.orgZip, 10);
  if (orgZip && !/^\d{5}(-\d{4})?$/.test(orgZip)) errors.orgZip = "Enter a 5-digit ZIP code.";
  const contactName = clean(form.contactName, 120);
  if (!contactName) errors.contactName = "Enter your name.";
  const contactEmail = clean(form.contactEmail, 254)?.toLowerCase() ?? null;
  if (!contactEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) errors.contactEmail = "Enter an email address we can reach you at.";
  const contactPhone = clean(form.contactPhone, 40);
  if (contactPhone && contactPhone.replace(/\D/g, "").length < 10) errors.contactPhone = "Enter a 10-digit phone number, or leave it blank.";

  const eventName = clean(form.eventName, 160);
  if (!eventName) errors.eventName = "Enter the name of your event.";
  if (!(form.eventType in EVENT_TYPES)) errors.eventType = "Choose the kind of event.";
  let eventDate: string | null = null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(form.eventDate) || Number.isNaN(day(form.eventDate).getTime())) errors.eventDate = "Enter the date of your event.";
  else {
    const today = Date.UTC(at.getUTCFullYear(), at.getUTCMonth(), at.getUTCDate());
    const diff = Math.round((day(form.eventDate).getTime() - today) / 86_400_000);
    if (diff < -EVENT_MAX_DAYS_PAST) errors.eventDate = "This event has already happened. We can only donate to upcoming events.";
    else if (diff > EVENT_MAX_DAYS_AHEAD) errors.eventDate = "Please apply within a year of your event.";
    else eventDate = form.eventDate;
  }
  const beneficiary = clean(form.beneficiary, 200);
  if (!beneficiary) errors.beneficiary = "Tell us who or what the fundraiser benefits.";
  const eventLocation = clean(form.eventLocation, 160);
  const eventUrl = normalizeUrl(form.eventUrl);
  if (form.eventUrl.trim() && !eventUrl) errors.eventUrl = "That web address doesn't look right.";
  let attendance: number | null = null;
  if (form.attendance.trim()) {
    attendance = Number(form.attendance.replace(/,/g, ""));
    if (!Number.isInteger(attendance) || attendance < 0 || attendance > 1_000_000) errors.attendance = "Enter a whole number, or leave it blank.";
  }
  const donationUse = form.donationUse ? (form.donationUse in DONATION_USES ? (form.donationUse as DonationUse) : null) : null;
  if (form.donationUse && !donationUse) errors.donationUse = "Choose how you'll use the donation.";

  if (!form.confirmAuthorized) errors.confirmAuthorized = "Please confirm you're authorized to request donations for this organization.";
  if (!form.confirmCharitable) errors.confirmCharitable = "Please confirm the donation is for a charitable or community fundraiser.";
  if (!form.agreeTerms) errors.agreeTerms = "Please agree to the program terms and privacy policy.";

  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    value: {
      orgName: orgName!,
      orgType: form.orgType as OrgType,
      orgWebsite,
      orgProof,
      orgEin,
      orgStreet: clean(form.orgStreet, 200),
      orgCity: clean(form.orgCity, 100),
      orgState,
      orgZip,
      contactName: contactName!,
      contactRole: clean(form.contactRole, 120),
      contactEmail: contactEmail!,
      contactPhone,
      eventName: eventName!,
      eventType: form.eventType as EventType,
      eventDate: eventDate!,
      beneficiary: beneficiary!,
      eventLocation,
      eventOnline: form.eventOnline || form.eventType === "online",
      eventUrl,
      attendance,
      donationUse,
      certificateDelivery: form.certificateDelivery === "download" ? "download" : "email",
      certificateOrgName: clean(form.certificateOrgName, 120),
      notes: cleanBlock(form.notes, 2000),
    },
  };
}

/** The certificate's claim-by date: a year after the event, at the end of that day (UTC). YYYY-MM-DD. */
export function claimByForEvent(eventDate: string): string {
  const d = day(eventDate);
  const target = new Date(Date.UTC(d.getUTCFullYear() + CLAIM_MONTHS_AFTER_EVENT / 12, d.getUTCMonth(), d.getUTCDate()));
  // 29 February rolls back to the 28th rather than forward into March.
  if (target.getUTCMonth() !== d.getUTCMonth()) target.setUTCDate(0);
  return target.toISOString().slice(0, 10);
}

export function eventDateLabel(eventDate: string): string {
  return day(eventDate).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function money(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}
