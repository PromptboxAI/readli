import type { Metadata } from "next";
import Link from "next/link";
import { buttonPrimary, buttonSecondary } from "@/components/brand/buttons";
import { AdultPage, Eyebrow } from "@/components/invites/AdultPage";
import { requireAdmin } from "@/lib/admin/access";
import { QC_MESSAGES, type QcIssue } from "@/lib/audio/qc";
import { MAX_GUEST_PREVIEWS, serverConfig } from "@/lib/server/config";
import { guestPreviewsAllowed } from "@/lib/server/demo-settings";
import { summarizeVoiceEvents, voiceEventSink, voiceModelCounts, type VoiceQualityMetrics } from "@/lib/server/voice-analytics";
import { activePreset, FALLBACK_MODEL, VOICE_PRESETS, voiceSettings } from "@/lib/voice/elevenlabs";
import { fetchProviderModels } from "@/lib/voice/model-watch";
import { updateDemoPreviewsAction } from "./actions";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Voice quality | Readli admin", robots: { index: false } };

const DAYS = 30;
const ISSUE_LABEL: Record<string, string> = {
  silent: "Silent",
  too_short: "Too little speech",
  too_quiet: "Too quiet",
  clipping: "Clipping (too loud)",
  noisy: "Background noise",
  long_pause: "Long pauses",
};
const pct = (x: number | null) => (x === null ? "No decisions yet" : `${Math.round(x * 100)}%`);

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
      <p className="text-sm text-muted">{label}</p>
      <p className="font-display text-2xl font-semibold">{value}</p>
      {note && <p className="text-xs text-muted">{note}</p>}
    </div>
  );
}

function Table({ rows }: { rows: { label: string; value: string; note?: string }[] }) {
  return (
    <table className="w-full text-left">
      <tbody>
        {rows.map((r) => (
          <tr key={r.label} className="border-b border-ink/10 align-top">
            <th scope="row" className="py-2 pr-4 font-semibold">{r.label}</th>
            <td className="py-2 pr-4 tabular-nums">{r.value}</td>
            <td className="py-2 text-sm text-muted [overflow-wrap:anywhere]">{r.note ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

async function loadMetrics(): Promise<VoiceQualityMetrics | null> {
  const sink = voiceEventSink(serverConfig());
  if (!sink) return null;
  try {
    return summarizeVoiceEvents(await sink.since(new Date(Date.now() - DAYS * 86_400_000).toISOString()), DAYS);
  } catch (err) {
    console.error("voice quality metrics failed", err);
    return null;
  }
}

type Search = Promise<{ ok?: string; err?: string }>;

/** How voice recordings and clones are going, the settings that make them, and the demo allowance. */
export default async function VoiceQualityPage({ searchParams }: { searchParams: Search }) {
  await requireAdmin("/admin/voice-quality");
  const { ok, err } = await searchParams;
  const config = serverConfig();
  const allowed = await guestPreviewsAllowed(config);
  const m = await loadMetrics();
  const model = config.elevenLabsModel;
  const settings = voiceSettings(model) as Record<string, number | boolean>;
  const preset = activePreset();
  const models = await fetchProviderModels(config.elevenLabsKey, model);
  const newModels = models?.filter((x) => x.isNew) ?? [];
  const byModel = await voiceModelCounts(config);

  return (
    <AdultPage wide>
      <header className="flex flex-col gap-2">
        <Eyebrow>Admin</Eyebrow>
        <h1 className="font-display text-4xl font-semibold">Voice quality</h1>
        <p className="text-lg">Recordings, clones and demo stories over the last {DAYS} days.</p>
      </header>
      {ok && <p role="status" className="rounded-2xl bg-mint/40 px-4 py-3">{ok}</p>}
      {err && <p role="alert" className="rounded-2xl bg-coral/25 px-4 py-3">{err}</p>}

      {newModels.length > 0 && (
        <section role="status" className="flex flex-col gap-2 rounded-3xl bg-sunshine/40 p-4" data-testid="new-models">
          <h2 className="font-display text-xl font-semibold">New from ElevenLabs</h2>
          {newModels.map((x) => (
            <p key={x.id}>
              <strong>{x.name}</strong> (<code>{x.id}</code>){x.description ? `: ${x.description}` : ""}
            </p>
          ))}
          <p className="text-sm">
            Readli uses <code>{model}</code>. Switching changes every voice and means stories are prepared again, so ask
            Claude to test the new model on a preview first.
          </p>
        </section>
      )}

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold">Recording and cloning</h2>
        {m ? (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Recordings submitted" value={String(m.recordings.guest + m.recordings.account)} note={`${m.recordings.guest} demo · ${m.recordings.account} signed in`} />
            <Stat label="Recording retries" value={String(m.restarts)} note="Start over after a finished take, or Record again" />
            <Stat label="Voices made" value={String(m.clones.guest + m.clones.account)} note={`${m.clones.guest} demo · ${m.clones.account} signed in`} />
            <Stat label="Voice Studio acceptance" value={pct(m.acceptanceRate)} note={`${m.accountKept} kept · ${m.accountDiscarded} recorded again`} />
            <Stat label={`"Doesn't sound like me"`} value={String(m.doesntSoundLikeMe)} />
            <Stat label="Re-recorded after that" value={String(m.rerecordsAfterFeedback)} note="Successful new takes after asking how to improve" />
            <Stat label="Tips opened" value={String(m.tipsOpened)} />
            <Stat label="Used a take with warnings" value={String(m.usedWithWarnings)} />
          </div>
        ) : (
          <p>Events appear here once the database is connected.</p>
        )}
        {m && Object.keys(m.warnings).length > 0 && (
          <>
            <h3 className="font-display text-xl font-semibold">Quality warnings shown</h3>
            <Table
              rows={Object.entries(m.warnings)
                .sort((a, b) => b[1] - a[1])
                .map(([issue, count]) => ({ label: ISSUE_LABEL[issue] ?? issue, value: String(count), note: QC_MESSAGES[issue as QcIssue] }))}
            />
          </>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold">Demo stories</h2>
        {m && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Stories generated" value={String(m.previews.generated)} />
            <Stat label="Free replays" value={String(m.previews.replayed)} note="Served from storage, no ElevenLabs cost" />
            <Stat label="Characters billed" value={m.previews.characters.toLocaleString("en-US")} />
            <Stat
              label="ElevenLabs cost"
              value={`$${m.previews.usd.toFixed(2)}`}
              note={m.previews.generated ? `$${(m.previews.usd / m.previews.generated).toFixed(3)} per story, at planning rates` : "At planning rates"}
            />
          </div>
        )}
        <form action={updateDemoPreviewsAction} className="flex flex-wrap items-end gap-3 rounded-3xl bg-surface p-4 ring-2 ring-ink/10">
          <label className="flex flex-col gap-1">
            <span className="font-semibold">Stories per demo session</span>
            <input
              name="previews"
              type="number"
              min={1}
              max={MAX_GUEST_PREVIEWS}
              defaultValue={allowed}
              className="w-28 rounded-xl border-2 border-ink/20 px-3 py-2"
            />
          </label>
          <button type="submit" className={buttonPrimary}>Save</button>
          <p className="text-sm text-muted">Applies to new demo sessions. Replays never count.</p>
        </form>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-2xl font-semibold">Generation settings</h2>
        <Table
          rows={[
            { label: "Model", value: model, note: `Falls back to ${FALLBACK_MODEL} if it rejects a read` },
            { label: "Preset", value: preset, note: "ELEVENLABS_VOICE_PRESET: natural, closer or expressive" },
            { label: "Stability", value: String(settings.stability) },
            { label: "Similarity", value: String(settings.similarity_boost) },
            { label: "Style exaggeration", value: "style" in settings ? String(settings.style) : "Not available on this model" },
            { label: "Speaker boost", value: "use_speaker_boost" in settings ? (settings.use_speaker_boost ? "On" : "Off") : "Not available on this model" },
            { label: "Speed", value: "Not set (model default)" },
            { label: "Cloning", value: "Instant Voice Clone", note: "Noise clean-up on when the browser hears a noisy room; the reader can switch it" },
          ]}
        />
        {byModel && (
          <>
            <h3 className="font-display text-xl font-semibold">Voices on each model</h3>
            <Table
              rows={Object.entries(byModel)
                .sort((a, b) => b[1] - a[1])
                .map(([id, count]) => ({
                  label: id === "unpinned" ? "Not pinned yet" : id,
                  value: String(count),
                  note: id === model ? "New voices get this model" : id === "unpinned" ? "Made before models were pinned; reads with the current model" : "Owners can hear the new version and switch",
                }))}
            />
            {m && (
              <p className="text-sm text-muted">
                Last {DAYS} days: {m.modelPreviews} heard their voice on the new version, {m.modelSwitches} switched.
              </p>
            )}
          </>
        )}
        {models && (
          <p className="text-sm text-muted">
            Reading models ElevenLabs offers this account: {models.map((x) => x.id).join(", ")}. Checked once a day.
          </p>
        )}
        <p className="text-sm text-muted">
          Presets: {Object.entries(VOICE_PRESETS).map(([k, v]) => `${k} ${v.stability}/${v.similarity_boost}`).join(" · ")} (stability/similarity).
        </p>
      </section>

      <Link href="/admin" className={`${buttonSecondary} self-start`}>
        Back to the admin overview
      </Link>
    </AdultPage>
  );
}
