import type { Metadata, Viewport } from "next";
import { Fredoka, Nunito_Sans } from "next/font/google";
import { ScrollToTop } from "@/components/ScrollToTop";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL, baseOpenGraph, indexable } from "@/lib/seo/site";
import "./globals.css";

const fredoka = Fredoka({ subsets: ["latin"], variable: "--font-fredoka", display: "swap" });
const nunitoSans = Nunito_Sans({ subsets: ["latin"], variable: "--font-nunito-sans", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Readli: Every Book. Every Voice.",
  description: SITE_DESCRIPTION,
  applicationName: SITE_NAME,
  openGraph: baseOpenGraph,
  twitter: { card: "summary_large_image" },
  // Preview deployments stay out of search results; production pages opt out one by one.
  robots: indexable() ? undefined : { index: false, follow: false },
  verification: siteVerification(),
};

/** Search Console and Bing Webmaster Tools ownership tags, set from Vercel env vars once Kevin has the codes. */
function siteVerification(): Metadata["verification"] {
  const google = process.env.GOOGLE_SITE_VERIFICATION;
  const bing = process.env.BING_SITE_VERIFICATION;
  if (!google && !bing) return undefined;
  return { ...(google ? { google } : {}), ...(bing ? { other: { "msvalidate.01": bing } } : {}) };
}

export const viewport: Viewport = {
  themeColor: "#FFF9ED",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${fredoka.variable} ${nunitoSans.variable}`}>
      <body className="min-h-dvh antialiased">
        <ScrollToTop />
        {children}
      </body>
    </html>
  );
}
