import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  REQUIRED_AGREEMENT_STATEMENTS,
  THIRD_PARTY_LICENSING_STATEMENT,
  VOICE_AGREEMENT_VERSION,
} from "@/lib/content/voice-agreement";

/**
 * The Voice Recording & AI Training Agreement, per contributor. Accepted before the microphone starts;
 * every later change is a new row, so the history shows exactly what each contributor allowed and when.
 * Service and Readli development rights come together; third-party licensing is a separate opt-in.
 */

export interface VoiceRights {
  service: boolean;
  readliDevelopment: boolean;
  thirdPartyLicensing: boolean;
}

export interface VoiceAgreement {
  id: string;
  version: string;
  event: "accepted" | "updated" | "withdrawn";
  rights: VoiceRights;
  agreedAt: string;
}

export interface NewAgreement {
  version: string;
  event: VoiceAgreement["event"];
  rights: VoiceRights;
  adultOwnerDeclared: boolean;
  statements: readonly string[];
  contributorName: string | null;
  contributorEmail: string | null;
  source: "pre_recording" | "settings" | "support";
  userAgent: string | null;
  supersedesId: string | null;
  /** Where the contributor was (US-NY, GB, ...), from the request; null when unknown. */
  jurisdiction?: string | null;
}

export interface VoiceAgreementStore {
  record(contributorId: string, agreement: NewAgreement): Promise<VoiceAgreement>;
  /** Newest first. */
  history(contributorId: string): Promise<VoiceAgreement[]>;
}

export class VoiceAgreementError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly userMessage: string,
  ) {
    super(userMessage);
  }
}

export interface Contributor {
  id: string;
  name: string | null;
  email: string | null;
  jurisdiction?: string | null;
}

/**
 * Jurisdictions where independent third-party licensing isn't offered (Kevin, 2026-10-12, decision 6:
 * biometric privacy laws). Mirrors licensing_restricted_jurisdictions, which is what the database checks
 * before any recording enters a licensed dataset; this list only decides whether the opt-in is offered.
 * Only US locations are eligible, and an unknown location never is.
 */
export const LICENSING_RESTRICTED_JURISDICTIONS = ["US-IL", "US-TX", "US-WA"] as const;

export function licensingAvailable(jurisdiction: string | null | undefined): boolean {
  return Boolean(jurisdiction && /^US-[A-Z0-9]{1,3}$/.test(jurisdiction) && !(LICENSING_RESTRICTED_JURISDICTIONS as readonly string[]).includes(jurisdiction));
}

/** The request's location from Vercel's geolocation headers, as COUNTRY or COUNTRY-REGION. */
export function requestJurisdiction(headers: Headers): string | null {
  const country = headers.get("x-vercel-ip-country")?.toUpperCase() ?? "";
  if (!/^[A-Z]{2}$/.test(country)) return null;
  const region = headers.get("x-vercel-ip-country-region")?.toUpperCase() ?? "";
  return /^[A-Z0-9]{1,3}$/.test(region) ? `${country}-${region}` : country;
}

const licensingUnavailable = () =>
  new VoiceAgreementError(409, "licensing_unavailable", "Licensing your recordings to other companies isn't offered where you are. Untick that option to continue.");

/** Records acceptance before recording. Every required line must be ticked; licensing is up to them. */
export async function acceptVoiceAgreement(
  store: VoiceAgreementStore,
  contributor: Contributor,
  input: { statements: readonly string[]; thirdPartyLicensing: boolean; userAgent: string | null },
): Promise<VoiceAgreement> {
  if (!REQUIRED_AGREEMENT_STATEMENTS.every((s) => input.statements.includes(s))) {
    throw new VoiceAgreementError(400, "agreement_required", "Please agree to each required point before you record.");
  }
  if (input.thirdPartyLicensing && !licensingAvailable(contributor.jurisdiction)) throw licensingUnavailable();
  const current = (await store.history(contributor.id))[0] ?? null;
  const statements = [...REQUIRED_AGREEMENT_STATEMENTS, ...(input.thirdPartyLicensing ? [THIRD_PARTY_LICENSING_STATEMENT] : [])];
  return store.record(contributor.id, {
    version: VOICE_AGREEMENT_VERSION,
    event: "accepted",
    rights: { service: true, readliDevelopment: true, thirdPartyLicensing: input.thirdPartyLicensing },
    adultOwnerDeclared: true,
    statements,
    contributorName: contributor.name,
    contributorEmail: contributor.email,
    source: "pre_recording",
    userAgent: input.userAgent,
    supersedesId: current?.id ?? null,
    jurisdiction: contributor.jurisdiction ?? null,
  });
}

/**
 * Turns the optional third-party licensing permission on or off, as a new row in the history.
 * Turning it off stops future licensing; it can't recall copies already licensed.
 */
export async function setThirdPartyLicensing(
  store: VoiceAgreementStore,
  contributor: Contributor,
  on: boolean,
  userAgent: string | null,
): Promise<VoiceAgreement> {
  const current = (await store.history(contributor.id))[0];
  if (!current || !current.rights.service || !current.rights.readliDevelopment) {
    throw new VoiceAgreementError(409, "no_agreement", "Record your Readli voice first, then you can choose this.");
  }
  if (on && current.version !== VOICE_AGREEMENT_VERSION) {
    throw new VoiceAgreementError(409, "agreement_outdated", "Please record again under the current Voice Recording Agreement first.");
  }
  if (on && !licensingAvailable(contributor.jurisdiction)) throw licensingUnavailable();
  if (current.rights.thirdPartyLicensing === on) return current;
  return store.record(contributor.id, {
    version: current.version,
    event: "updated",
    rights: { ...current.rights, thirdPartyLicensing: on },
    adultOwnerDeclared: true,
    statements: on ? [THIRD_PARTY_LICENSING_STATEMENT] : [`Turned off: ${THIRD_PARTY_LICENSING_STATEMENT}`],
    contributorName: contributor.name,
    contributorEmail: contributor.email,
    source: "settings",
    userAgent,
    supersedesId: current.id,
    jurisdiction: contributor.jurisdiction ?? null,
  });
}

/**
 * Withdraws AI-training permission (Readli development and third-party licensing) as a new row. The
 * recordings stop appearing in voice_recordings_usable for development or licensing at once; the
 * Readli service right, sharing with families and the recordings themselves are unchanged. Deleting
 * the recordings is a separate request (recording deletion).
 */
export async function withdrawTrainingRights(store: VoiceAgreementStore, contributor: Contributor, userAgent: string | null): Promise<VoiceAgreement> {
  const current = (await store.history(contributor.id))[0];
  if (!current) throw new VoiceAgreementError(409, "no_agreement", "There's no voice agreement to change.");
  if (!current.rights.readliDevelopment && !current.rights.thirdPartyLicensing) return current;
  return store.record(contributor.id, {
    version: current.version,
    event: "updated",
    rights: { service: current.rights.service, readliDevelopment: false, thirdPartyLicensing: false },
    adultOwnerDeclared: true,
    statements: ["Withdrew permission to use my recordings to develop Readli's voice technology or to license them to other companies."],
    contributorName: contributor.name,
    contributorEmail: contributor.email,
    source: "settings",
    userAgent,
    supersedesId: current.id,
    jurisdiction: contributor.jurisdiction ?? null,
  });
}

/** The agreement a new recording is made under: theirs, current version, and still in force. */
export async function agreementInForce(store: VoiceAgreementStore, contributorId: string, agreementId: string | null): Promise<VoiceAgreement> {
  const current = (await store.history(contributorId))[0];
  if (
    !agreementId ||
    !current ||
    current.id !== agreementId ||
    current.version !== VOICE_AGREEMENT_VERSION ||
    !current.rights.service ||
    !current.rights.readliDevelopment
  ) {
    throw new VoiceAgreementError(400, "agreement_required", "Please accept the Voice Recording Agreement again before we make your voice.");
  }
  return current;
}

// ---------------------------------------------------------------------------
// Stores
// ---------------------------------------------------------------------------

export class MemoryVoiceAgreementStore implements VoiceAgreementStore {
  readonly rows: (NewAgreement & VoiceAgreement & { contributorId: string })[] = [];

  async record(contributorId: string, a: NewAgreement) {
    const row = { ...a, id: randomUUID(), contributorId, agreedAt: new Date().toISOString() };
    this.rows.push(row);
    return { id: row.id, version: row.version, event: row.event, rights: { ...row.rights }, agreedAt: row.agreedAt };
  }

  async history(contributorId: string) {
    return this.rows
      .filter((r) => r.contributorId === contributorId)
      .reverse()
      .map((r) => ({ id: r.id, version: r.version, event: r.event, rights: { ...r.rights }, agreedAt: r.agreedAt }));
  }
}

type Row = Record<string, unknown>;

const fromRow = (r: Row): VoiceAgreement => ({
  id: r.id as string,
  version: r.agreement_version as string,
  event: r.event as VoiceAgreement["event"],
  rights: {
    service: Boolean(r.service_rights),
    readliDevelopment: Boolean(r.readli_development_rights),
    thirdPartyLicensing: Boolean(r.third_party_licensing),
  },
  agreedAt: r.agreed_at as string,
});

const COLUMNS = "id, agreement_version, event, service_rights, readli_development_rights, third_party_licensing, agreed_at";

export class SupabaseVoiceAgreementStore implements VoiceAgreementStore {
  constructor(private readonly db: SupabaseClient) {}

  async record(contributorId: string, a: NewAgreement) {
    const { data, error } = await this.db
      .from("voice_rights_agreements")
      .insert({
        contributor_id: contributorId,
        agreement_version: a.version,
        event: a.event,
        service_rights: a.rights.service,
        readli_development_rights: a.rights.readliDevelopment,
        third_party_licensing: a.rights.thirdPartyLicensing,
        adult_owner_declared: a.adultOwnerDeclared,
        statements: a.statements,
        contributor_name: a.contributorName,
        contributor_email: a.contributorEmail,
        source: a.source,
        user_agent: a.userAgent,
        supersedes_id: a.supersedesId,
        jurisdiction: a.jurisdiction ?? null,
      })
      .select(COLUMNS)
      .single();
    if (error) throw new Error(`save voice agreement: ${error.message}`);
    return fromRow(data as Row);
  }

  async history(contributorId: string) {
    const { data, error } = await this.db
      .from("voice_rights_agreements")
      .select(COLUMNS)
      .eq("contributor_id", contributorId)
      .order("agreed_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw new Error(`read voice agreements: ${error.message}`);
    return ((data ?? []) as Row[]).map(fromRow);
  }
}
