import Image from "next/image";
import { PlayButton } from "./PlayButton";

/** On a gift page: the giver's approved Readli voice preview, fetched only when played. */
export function GiftVoicePreview({ code, giverName, book }: { code: string; giverName: string; book: { title: string; coverUrl: string | null } }) {
  return (
    <section className="flex flex-col gap-4 rounded-[var(--radius-panel)] bg-sky/40 p-6 sm:flex-row sm:items-center" data-testid="gift-voice-preview">
      {book.coverUrl && <Image src={book.coverUrl} alt={`Cover of ${book.title}`} width={96} height={128} className="w-24 shrink-0 rounded-2xl shadow-md" />}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <p className="font-display text-xl font-semibold">Hear {giverName} read {book.title}</p>
        <PlayButton label={`${giverName} reads ${book.title}`} endpoint="/api/gifts/preview" body={{ code }} testId="play-gift-preview" />
        <p className="text-sm">Read with {giverName}&apos;s Readli voice. Their original recordings stay private.</p>
      </div>
    </section>
  );
}
