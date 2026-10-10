import type { Metadata } from "next";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import {
  PRIVACY_EFFECTIVE_DATE,
  PRIVACY_INTRO,
  PRIVACY_IS_DRAFT,
  PRIVACY_SECTIONS,
} from "@/lib/content/privacy-policy";

export const metadata: Metadata = {
  title: "Privacy Policy | Readli",
  description: "How Readli collects, uses, shares and protects family, child and voice information.",
};

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <PolicyDocument
        title="Privacy Policy"
        effectiveDate={PRIVACY_EFFECTIVE_DATE}
        draftNote={PRIVACY_IS_DRAFT || undefined}
        intro={PRIVACY_INTRO}
        sections={PRIVACY_SECTIONS}
      />
      <SiteFooter />
    </>
  );
}
