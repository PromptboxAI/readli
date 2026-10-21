import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo/site";

/** Everything under /family is a signed-in grown-up's own account, so none of it belongs in search. */
export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default function FamilyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
