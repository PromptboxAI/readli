import type { Metadata } from "next";
import { PolicyDocument } from "@/components/legal/PolicyDocument";
import { SiteHeader } from "@/components/home/SiteHeader";
import { SiteFooter } from "@/components/home/sections";
import { VOICE_AGREEMENT_EFFECTIVE_DATE, VOICE_AGREEMENT_INTRO, VOICE_AGREEMENT_SECTIONS } from "@/lib/content/voice-agreement";

export const metadata: Metadata = {
  title: "Voice Recording & AI Training Agreement | Readli",
  description: "What you agree to when you record a Readli voice: service, Readli technology development, and optional licensing.",
};

export default function VoiceAgreementPage() {
  return (
    <>
      <SiteHeader />
      <PolicyDocument
        title="Voice Recording & AI Training Agreement"
        effectiveDate={VOICE_AGREEMENT_EFFECTIVE_DATE}
        draftNote
        intro={VOICE_AGREEMENT_INTRO}
        sections={VOICE_AGREEMENT_SECTIONS}
      />
      <SiteFooter />
    </>
  );
}
