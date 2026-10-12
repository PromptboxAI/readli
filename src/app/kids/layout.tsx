import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo/site";

/** Everything under /kids is a child profile inside a family account, so none of it belongs in search. */
export const metadata: Metadata = { robots: PRIVATE_ROBOTS };

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
