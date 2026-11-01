"use client";

import { buttonPrimary } from "@/components/brand/buttons";

/** Opens the browser's print dialog; hidden on the printed page itself. */
export function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} className={`${buttonPrimary} w-fit print:hidden`}>
      Print this page
    </button>
  );
}
