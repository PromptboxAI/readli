"use client";

import { useRouter } from "next/navigation";
import { buttonQuiet } from "@/components/brand/buttons";

export function ResetButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonQuiet}
      onClick={async () => {
        await fetch("/api/family/reset", { method: "POST" });
        router.refresh();
      }}
    >
      Reset the preview family
    </button>
  );
}
