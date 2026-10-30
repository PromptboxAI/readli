"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { COMPANY } from "@/lib/content/company";
import {
  DONATION_USES,
  EVENT_TYPES,
  FLYER_MAX_BYTES,
  ORG_TYPES,
  US_STATES,
  validateDonation,
  type DonationForm,
  type FieldErrors,
} from "@/lib/donations/program";

const input = "min-h-12 w-full rounded-2xl bg-surface px-4 text-base ring-2 ring-ink/20 focus:ring-ink aria-[invalid=true]:ring-coral-deep";
const area = `${input} min-h-28 py-3`;

const FIELD_ORDER: (keyof DonationForm)[] = [
  "orgName", "orgType", "orgWebsite", "orgProof", "orgEin", "orgStreet", "orgCity", "orgState", "orgZip", "contactName", "contactRole", "contactEmail", "contactPhone",
  "eventName", "eventType", "eventDate", "beneficiary", "eventLocation", "eventUrl", "attendance", "donationUse", "certificateOrgName", "notes",
  "confirmAuthorized", "confirmCharitable", "agreeTerms",
];

function fromForm(form: FormData): DonationForm {
  const t = (k: string) => {
    const v = form.get(k);
    return typeof v === "string" ? v : "";
  };
  const on = (k: string) => form.get(k) === "on";
  return {
    orgName: t("orgName"), orgType: t("orgType"), orgWebsite: t("orgWebsite"), orgProof: t("orgProof"), orgEin: t("orgEin"), orgStreet: t("orgStreet"),
    orgCity: t("orgCity"), orgState: t("orgState"), orgZip: t("orgZip"), contactName: t("contactName"), contactRole: t("contactRole"), contactEmail: t("contactEmail"),
    contactPhone: t("contactPhone"), eventName: t("eventName"), eventType: t("eventType"), eventDate: t("eventDate"), beneficiary: t("beneficiary"),
    eventLocation: t("eventLocation"), eventOnline: on("eventOnline"), eventUrl: t("eventUrl"), attendance: t("attendance"), donationUse: t("donationUse"),
    certificateDelivery: t("certificateDelivery"), certificateOrgName: t("certificateOrgName"), notes: t("notes"),
    confirmAuthorized: on("confirmAuthorized"), confirmCharitable: on("confirmCharitable"), agreeTerms: on("agreeTerms"),
  };
}

function Field({ fieldId, label, required, hint, error, children }: { fieldId: string; label: string; required?: boolean; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={fieldId} className="font-semibold">
        {label}
        {required ? <span className="text-coral-deep"> *</span> : <span className="font-normal text-muted"> (optional)</span>}
      </label>
      {hint && (
        <p id={`${fieldId}-hint`} className="text-sm text-muted">
          {hint}
        </p>
      )}
      {children}
      {error && (
        <p id={`${fieldId}-err`} className="text-sm font-semibold text-coral-deep">
          {error}
        </p>
      )}
    </div>
  );
}

/** The donation request form (spec section 2). Checked here first, then again on the server. */
export function DonationRequestForm() {
  const id = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ reference: string | null; email: string } | null>(null);

  const fid = (name: keyof DonationForm | "flyer") => `${id}-${name}`;
  const err = (name: keyof DonationForm) =>
    errors[name] ? (
      <p id={`${fid(name)}-err`} className="text-sm font-semibold text-coral-deep">
        {errors[name]}
      </p>
    ) : null;
  const a11y = (name: keyof DonationForm, hint?: boolean) => ({
    id: fid(name),
    name,
    "aria-invalid": errors[name] ? true : undefined,
    "aria-describedby": [errors[name] ? `${fid(name)}-err` : "", hint ? `${fid(name)}-hint` : ""].filter(Boolean).join(" ") || undefined,
  });

  function focusFirst(found: FieldErrors) {
    const first = FIELD_ORDER.find((k) => found[k]);
    if (first) document.getElementById(fid(first))?.focus();
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const values = fromForm(form);
    const checked = validateDonation(values);
    const flyer = form.get("flyer");
    if (flyer instanceof File && flyer.size > FLYER_MAX_BYTES) {
      setProblem("The flyer is over 10 MB. Please attach a smaller file.");
      return;
    }
    if (!checked.ok) {
      setErrors(checked.errors);
      setProblem("Please fix the highlighted fields.");
      focusFirst(checked.errors);
      return;
    }
    setErrors({});
    setProblem("");
    setBusy(true);
    const res = await fetch("/api/donations", { method: "POST", body: form }).catch(() => null);
    const body = await res?.json().catch(() => null);
    setBusy(false);
    if (!res || !res.ok) {
      const fields = (body?.error?.details?.fields ?? {}) as FieldErrors;
      setErrors(fields);
      setProblem(body?.error?.message ?? "We couldn't send your request. Please try again.");
      focusFirst(fields);
      return;
    }
    setDone({ reference: body?.reference ?? null, email: values.contactEmail.trim() });
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  if (done) {
    return (
      <section aria-live="polite" className="flex flex-col items-center gap-4 rounded-[var(--radius-panel)] bg-mint/50 px-6 py-10 text-center" data-testid="donation-received">
        <ReadiMascot size={110} decorative />
        <h3 className="font-display text-3xl font-semibold">Thank you for helping make a difference!</h3>
        <p className="max-w-lg text-lg">
          We&apos;ve received your Readli Gives Back request. You&apos;ll receive an email at <strong>{done.email}</strong> with your application details, and we&apos;ll
          contact you once your eligibility review is complete.
        </p>
        {done.reference && <p className="font-display text-xl font-semibold">Your reference: {done.reference}</p>}
        <p className="text-sm text-muted">Don&apos;t see the email? Check your spam folder, or write to {COMPANY.email} with your event name.</p>
      </section>
    );
  }

  const legend = "font-display text-2xl font-semibold";
  const group = "flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-7";
  const two = "grid gap-4 sm:grid-cols-2";

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Donation request" data-testid="donation-form">
      <p className="text-sm text-muted">
        Fields marked <span className="text-coral-deep">*</span> are required.
      </p>

      <fieldset className={group}>
        <legend className={`${legend} float-left mb-1 w-full`}>Organization information</legend>
        <Field fieldId={fid("orgName")} error={errors.orgName} label="Organization name" required>
          <input {...a11y("orgName")} className={input} autoComplete="organization" maxLength={160} />
        </Field>
        <Field fieldId={fid("orgType")} error={errors.orgType} label="Organization type" required>
          <select {...a11y("orgType")} className={input} defaultValue="">
            <option value="" disabled>
              Choose one
            </option>
            {Object.entries(ORG_TYPES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <Field fieldId={fid("orgWebsite")} error={errors.orgWebsite} label="Website or official organization page" required hint="Your school's page, PTA site or a public Facebook page all work.">
          <input {...a11y("orgWebsite", true)} className={input} inputMode="url" autoComplete="url" placeholder="oakstreetpta.org" maxLength={300} />
        </Field>
        <Field fieldId={fid("orgProof")} error={errors.orgProof} label="No website? Tell us how we can confirm your organization" hint="For example, a school district email, or the charity your event supports. You can also attach a letter below.">
          <textarea {...a11y("orgProof", true)} className={area} maxLength={600} />
        </Field>
        <div className={two}>
          <Field fieldId={fid("orgEin")} error={errors.orgEin} label="EIN / tax ID" hint="PTAs and school committees often don't have one. That's fine.">
            <input {...a11y("orgEin", true)} className={input} inputMode="numeric" placeholder="12-3456789" maxLength={20} />
          </Field>
          <Field fieldId={fid("orgStreet")} error={errors.orgStreet} label="Street address">
            <input {...a11y("orgStreet")} className={input} autoComplete="street-address" maxLength={200} />
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-[2fr_1.4fr_1fr]">
          <Field fieldId={fid("orgCity")} error={errors.orgCity} label="City">
            <input {...a11y("orgCity")} className={input} autoComplete="address-level2" maxLength={100} />
          </Field>
          <Field fieldId={fid("orgState")} error={errors.orgState} label="State" required>
            <select {...a11y("orgState")} className={input} defaultValue="" autoComplete="address-level1">
              <option value="" disabled>
                Choose
              </option>
              {Object.entries(US_STATES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field fieldId={fid("orgZip")} error={errors.orgZip} label="ZIP code">
            <input {...a11y("orgZip")} className={input} inputMode="numeric" autoComplete="postal-code" maxLength={10} />
          </Field>
        </div>
        <div className={two}>
          <Field fieldId={fid("contactName")} error={errors.contactName} label="Your name" required>
            <input {...a11y("contactName")} className={input} autoComplete="name" maxLength={120} />
          </Field>
          <Field fieldId={fid("contactRole")} error={errors.contactRole} label="Your role or title">
            <input {...a11y("contactRole")} className={input} autoComplete="organization-title" placeholder="PTA fundraising chair" maxLength={120} />
          </Field>
          <Field fieldId={fid("contactEmail")} error={errors.contactEmail} label="Email address" required hint="Your organization's email helps us approve you faster.">
            <input {...a11y("contactEmail", true)} type="email" className={input} autoComplete="email" maxLength={254} />
          </Field>
          <Field fieldId={fid("contactPhone")} error={errors.contactPhone} label="Phone number">
            <input {...a11y("contactPhone")} type="tel" className={input} autoComplete="tel" maxLength={40} />
          </Field>
        </div>
      </fieldset>

      <fieldset className={group}>
        <legend className={`${legend} float-left mb-1 w-full`}>Fundraising event</legend>
        <Field fieldId={fid("eventName")} error={errors.eventName} label="Event name" required>
          <input {...a11y("eventName")} className={input} placeholder="Spring Tricky Tray" maxLength={160} />
        </Field>
        <div className={two}>
          <Field fieldId={fid("eventType")} error={errors.eventType} label="Event type" required>
            <select {...a11y("eventType")} className={input} defaultValue="">
              <option value="" disabled>
                Choose one
              </option>
              {Object.entries(EVENT_TYPES).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <Field fieldId={fid("eventDate")} error={errors.eventDate} label="Event date" required>
            <input {...a11y("eventDate")} type="date" className={input} />
          </Field>
        </div>
        <Field fieldId={fid("beneficiary")} error={errors.beneficiary} label="Who or what does the fundraiser benefit?" required>
          <input {...a11y("beneficiary")} className={input} placeholder="Oak Street Elementary library" maxLength={200} />
        </Field>
        <div className={two}>
          <Field fieldId={fid("eventLocation")} error={errors.eventLocation} label="Event location" hint="City and state.">
            <input {...a11y("eventLocation", true)} className={input} placeholder="Montclair, NJ" maxLength={160} />
          </Field>
          <Field fieldId={fid("attendance")} error={errors.attendance} label="Estimated attendance">
            <input {...a11y("attendance")} className={input} inputMode="numeric" maxLength={9} />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3">
          <input type="checkbox" name="eventOnline" className="size-5" />
          This is an online fundraiser run from the United States
        </label>
        <Field fieldId={fid("eventUrl")} error={errors.eventUrl} label="Public event page or announcement">
          <input {...a11y("eventUrl")} className={input} inputMode="url" placeholder="Link to a flyer, newsletter or event page" maxLength={300} />
        </Field>
        <Field fieldId={fid("donationUse")} error={errors.donationUse} label="How will you use the donation?">
          <select {...a11y("donationUse")} className={input} defaultValue="">
            <option value="">Choose one</option>
            {Object.entries(DONATION_USES).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
        </Field>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fid("flyer")} className="font-semibold">
            Event flyer or supporting letter <span className="font-normal text-muted">(optional)</span>
          </label>
          <p id={`${fid("flyer")}-hint`} className="text-sm text-muted">
            PDF, PNG, JPG or WebP, up to 10 MB. Only the Readli team sees it.
          </p>
          <input id={fid("flyer")} name="flyer" type="file" accept="application/pdf,image/png,image/jpeg,image/webp" aria-describedby={`${fid("flyer")}-hint`} className="text-base" />
        </div>
      </fieldset>

      <fieldset className={group}>
        <legend className={`${legend} float-left mb-1 w-full`}>Donation details</legend>
        <p className="rounded-2xl bg-sunshine/35 px-4 py-3">
          <strong>Requested donation:</strong> One 12-month Readli Family Membership
        </p>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 font-semibold">Preferred certificate delivery</legend>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="certificateDelivery" value="email" defaultChecked className="size-5" />
            Email me the certificate
          </label>
          <label className="flex min-h-11 items-center gap-3">
            <input type="radio" name="certificateDelivery" value="download" className="size-5" />
            I&apos;ll download it from my request page
          </label>
        </fieldset>
        <Field fieldId={fid("certificateOrgName")} error={errors.certificateOrgName} label="Organization name to print on the certificate" hint="We'll use your organization name if you leave this blank.">
          <input {...a11y("certificateOrgName", true)} className={input} maxLength={120} />
        </Field>
        <Field fieldId={fid("notes")} error={errors.notes} label="Anything else we should know?">
          <textarea {...a11y("notes")} className={area} maxLength={2000} />
        </Field>
      </fieldset>

      <fieldset className={group}>
        <legend className={`${legend} float-left mb-1 w-full`}>Please confirm</legend>
        {(
          [
            ["confirmAuthorized", "I confirm that I am authorized to request donations for this organization."],
            ["confirmCharitable", "I confirm the donation will be used for a legitimate charitable or community fundraising activity."],
          ] as const
        ).map(([name, label]) => (
          <div key={name} className="flex flex-col gap-1">
            <label className="flex items-start gap-3">
              <input type="checkbox" {...a11y(name)} className="mt-1 size-5 shrink-0" />
              <span>
                {label} <span className="text-coral-deep">*</span>
              </span>
            </label>
            {err(name)}
          </div>
        ))}
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3">
            <input type="checkbox" {...a11y("agreeTerms")} className="mt-1 size-5 shrink-0" />
            <span>
              I agree to the{" "}
              <Link href="#program-terms" className="font-semibold underline underline-offset-4">
                donation program terms
              </Link>{" "}
              and the{" "}
              <Link href="/privacy" className="font-semibold underline underline-offset-4">
                privacy policy
              </Link>
              . <span className="text-coral-deep">*</span>
            </span>
          </label>
          {err("agreeTerms")}
        </div>
      </fieldset>

      {/* Hidden from people and screen readers; only bots fill it in. */}
      <div aria-hidden="true" className="absolute -left-[9999px] h-px w-px overflow-hidden">
        <label>
          Company fax
          <input name="company_fax" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {problem && (
        <p role="alert" className="rounded-2xl bg-coral/30 p-3 font-semibold">
          {problem}
        </p>
      )}
      <button type="submit" className={`${buttonPrimary} min-h-14 w-full text-xl sm:w-auto sm:self-start`} disabled={busy}>
        {busy ? "Sending…" : "Request Our Readli Donation"}
      </button>
    </form>
  );
}
