import type { Metadata } from "next";
import { PRIVATE_ROBOTS } from "@/lib/seo/site";

/**
 * Everything under /kids is a child profile inside a family account, so none of it belongs in search.
 * Readli Kids saves to a home screen as its own app that opens on the bookshelf.
 */
export const metadata: Metadata = {
  robots: PRIVATE_ROBOTS,
  manifest: "/kids/app.webmanifest",
  appleWebApp: { capable: true, title: "Readli Kids", statusBarStyle: "default" },
};

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
