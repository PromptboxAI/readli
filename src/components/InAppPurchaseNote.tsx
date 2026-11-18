import { IN_APP_PURCHASE_MESSAGE } from "@/lib/android/in-app";

/** Shown only inside the Android app, where the purchase buttons beside it are hidden. */
export function InAppPurchaseNote({ className = "" }: { className?: string }) {
  return (
    <p data-app-note className={`rounded-2xl bg-surface/80 p-3 text-sm ring-2 ring-ink/10 ${className}`}>
      {IN_APP_PURCHASE_MESSAGE}
    </p>
  );
}
