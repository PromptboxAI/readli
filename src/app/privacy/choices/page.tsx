import type { Metadata } from "next";
import Link from "next/link";
import { AdsChoice } from "@/components/legal/AdsChoice";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { publicPageMetadata } from "@/lib/seo/site";

export const metadata: Metadata = publicPageMetadata({
  title: "Do Not Sell or Share My Personal Information | Readli",
  description: "Opt out of Readli sharing website activity with Meta for advertising.",
  path: "/privacy/choices",
});

/** The "Do Not Sell or Share" page the footer links to, for US state privacy laws such as California's. */
export default function PrivacyChoicesPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 sm:px-6">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Do Not Sell or Share My Personal Information</h1>
        <p>
          Readli doesn&apos;t sell personal information for money. On some public website pages for grown-ups, we use the Meta Pixel to measure and improve
          our ads on Facebook and Instagram. Some state laws, including California&apos;s, call that &quot;sharing&quot; for advertising, so you can turn it off here.
        </p>
        <p>
          When you make a demo voice, create an account, start a checkout or pay, our servers also tell Meta, with a hashed email address for account
          actions. Opting out here stops those too. The pixel never runs in Readli Kids or the parent portal, and Meta never gets voice recordings or
          anything about children from Readli.
        </p>
        <AdsChoice />
        <p className="text-sm">
          Your choice is saved in this browser, so make it again on other browsers and devices, or after clearing site data. A Global Privacy Control signal
          from your browser counts as opting out. Questions: admin@readli.ai. More in our{" "}
          <Link href="/privacy#cookies-and-analytics" className="font-semibold underline underline-offset-4">
            Privacy Policy
          </Link>
          .
        </p>
      </main>
      <SiteFooter />
    </>
  );
}
