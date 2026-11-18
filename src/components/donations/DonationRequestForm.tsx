"use client";

import Link from "next/link";
import { useId, useRef, useState, type ReactNode } from "react";
import { buttonPrimary } from "@/components/brand/buttons";
import { ReadiMascot } from "@/components/brand/ReadiMascot";
import { FilePicker } from "@/components/donations/FilePicker";
import { COMPANY } from "@/lib/content/company";
import { FLYER_MAX_BYTES, validateDonation, type DonationForm, type FieldErrors } from "@/lib/donations/program";

const input = "min-h-12 w-full rounded-2xl bg-surface px-4 text-base ring-2 ring-ink/20 focus:ring-ink aria-[invalid=true]:ring-coral-deep";
const area = `${input} min-h-44 py-3`;

const FIELD_ORDER: (keyof DonationForm)[] = ["contactName", "contactEmail", "orgName", "eventName", "eventDate", "notes", "confirmAuthorized"];

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
    confirmAuthorized: on("confirm"), confirmCharitable: on("confirm"), agreeTerms: on("confirm"),
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

  const two = "grid gap-4 sm:grid-cols-2";

  return (
    <form ref={formRef} onSubmit={submit} noValidate className="flex flex-col gap-5" aria-label="Donation request" data-testid="donation-form">
      <div className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-surface p-5 ring-2 ring-ink/10 sm:p-7">
        <div className={two}>
          <Field fieldId={fid("contactName")} error={errors.contactName} label="Your name" required>
            <input {...a11y("contactName")} className={input} autoComplete="name" maxLength={120} />
          </Field>
          <Field fieldId={fid("contactEmail")} error={errors.contactEmail} label="Email address" required>
            <input {...a11y("contactEmail")} type="email" className={input} autoComplete="email" maxLength={254} />
          </Field>
          <Field fieldId={fid("orgName")} error={errors.orgName} label="Organization name" required>
            <input {...a11y("orgName")} className={input} autoComplete="organization" placeholder="Oak Street PTA" maxLength={160} />
          </Field>
          <Field fieldId={fid("eventName")} error={errors.eventName} label="Event name" required>
            <input {...a11y("eventName")} className={input} placeholder="Spring Tricky Tray" maxLength={160} />
          </Field>
          <Field fieldId={fid("eventDate")} error={errors.eventDate} label="Event date" required>
            <input {...a11y("eventDate")} type="date" className={input} />
          </Field>
        </div>
        <Field
          fieldId={fid("notes")}
          error={errors.notes}
          label="Tell us about your fundraiser"
          required
          hint="Who it helps, how you'll use the membership (raffle, auction, basket), and a link to your school, PTA or event page if you have one."
        >
          <textarea {...a11y("notes", true)} className={area} maxLength={2000} />
        </Field>
        <FilePicker id={fid("flyer")} name="flyer" label="Event flyer or supporting letter" hint="PDF or image, up to 10 MB. Only the Readli team sees it." />
        <div className="flex flex-col gap-1">
          <label className="flex items-start gap-3">
            <input type="checkbox" {...a11y("confirmAuthorized")} name="confirm" className="mt-1 size-5 shrink-0" />
            <span>
              I can request donations for this organization, the membership will go to a charitable or community fundraiser, and I agree to the{" "}
              <Link href="#program-terms" className="font-semibold underline underline-offset-4">
                program terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="font-semibold underline underline-offset-4">
                privacy policy
              </Link>
              . <span className="text-coral-deep">*</span>
            </span>
          </label>
          {err("confirmAuthorized")}
        </div>
      </div>

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
