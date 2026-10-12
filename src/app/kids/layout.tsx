import type { Metadata } from "next";

/** Readli Kids saves to a home screen as its own app that opens on the bookshelf. */
export const metadata: Metadata = {
  manifest: "/kids/app.webmanifest",
  appleWebApp: { capable: true, title: "Readli Kids", statusBarStyle: "default" },
};

export default function KidsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
