// Records each book's opening ("How it starts" on its public page) in one Readli voice, for the play
// button on /books/<slug>. Files go to public/samples/books/<slug>.mp3; commit them to publish.
//
//   npm run samples:books -- [--only slug] [--force] [--dry-run]
//
// Reads ELEVENLABS_API_KEY and SAMPLE_VOICE_ID from .env.local (or the environment).
//
// Books that already have a sample are skipped unless --force. Uses ELEVENLABS_MODEL_ID if set,
// otherwise the model Readli narrates with.
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { bookOpening } from "@/lib/library/opening";
import { publicLibrary } from "@/lib/library/public";
import { DEFAULT_MODEL } from "@/lib/voice/elevenlabs";

for (const file of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(file);
  } catch {
    // No such file; the environment may already have the keys.
  }
}

const args = process.argv.slice(2);
const only = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;
const force = args.includes("--force");
const dry = args.includes("--dry-run");
const key = process.env.ELEVENLABS_API_KEY;
const voice = process.env.SAMPLE_VOICE_ID;
if (!dry && (!key || !voice)) {
  console.error("Add ELEVENLABS_API_KEY and SAMPLE_VOICE_ID (the ElevenLabs voice that reads the samples) to .env.local.");
  process.exit(1);
}

const out = join(process.cwd(), "public", "samples", "books");
mkdirSync(out, { recursive: true });
let made = 0;
let chars = 0;
for (const book of publicLibrary()) {
  if (only && book.slug !== only) continue;
  const file = join(out, `${book.slug}.mp3`);
  if (existsSync(file) && !force) continue;
  const text = bookOpening(book.slug).join("\n\n").replace(/…$/, ".");
  if (!text) continue;
  chars += text.length;
  if (dry) {
    console.log(`${book.slug}: ${text.length} characters`);
    continue;
  }
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "content-type": "application/json", accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL }),
  });
  if (!res.ok) {
    console.error(`${book.slug}: ElevenLabs said ${res.status} ${await res.text()}`);
    process.exitCode = 1;
    continue;
  }
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  made += 1;
  console.log(`${book.slug}: saved (${text.length} characters)`);
}
console.log(dry ? `${chars} characters in all.` : `Made ${made} sample${made === 1 ? "" : "s"}, ${chars} characters.`);
