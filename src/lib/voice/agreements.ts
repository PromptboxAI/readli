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
}

/** Records acceptance before recording. Every required line must be ticked; licensing is up to them. */
export async function acceptVoiceAgreement(
  store: VoiceAgreementStore,
  contributor: Contributor,
  input: { statements: readonly string[]; thirdPartyLicensing: boolean; userAgent: string | null },
): Promise<VoiceAgreement> {
  if (!REQUIRED_AGREEMENT_STATEMENTS.every((s) => input.statements.includes(s))) {
    throw new VoiceAgreementError(400, "agreement_required", "Please agree to each required point before you record.");
  }
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
