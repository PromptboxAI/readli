/**
 * Readli Accessibility Statement, from Kevin's draft "Readli_Accessibility_Statement_DRAFT.docx" (2026-10-10).
 * Not published from the draft: the [IMPLEMENTATION CHECK] note (set up a process to log, answer and fix
 * accessibility requests) and the closing pre-publication testing checklist. Never label this WCAG certified
 * or fully ADA compliant without substantiation.
 */

import type { PolicySection } from "@/lib/content/privacy-policy";

/** The draft says to set the real effective date when it is published. */
export const ACCESSIBILITY_EFFECTIVE_DATE = "October 10, 2026";

export const ACCESSIBILITY_INTRO: string[] = [
  "At Readli, we want stories to be enjoyable and accessible to families with a wide range of needs and abilities. This statement covers readli.ai and Readli’s web-based experiences. It describes our accessibility goals and how to contact us for help. This is a commitment and feedback statement, not a certification that every feature currently meets an accessibility standard.",
];

export const ACCESSIBILITY_SECTIONS: PolicySection[] = [
  {
    id: "our-accessibility-goal",
    title: "Our accessibility goal",
    paragraphs: [
      {
        text: "We are designing and improving Readli with the Web Content Accessibility Guidelines (WCAG) 2.2, Level AA, as a technical target where applicable. Our goal is for people using keyboards, screen readers, magnification, voice controls, captions, and other assistive technologies to be able to navigate and enjoy the service.",
      },
      {
        text: "Accessibility is an ongoing process. Some features may be new, under development, or provided through third parties, and we cannot promise that all content and functions are fully accessible at all times.",
      },
    ],
  },
  {
    id: "features-and-design-practices-we-are-working-toward",
    title: "Features and design practices we are working toward",
    paragraphs: [
      {
        text: "Clear headings, understandable navigation, readable contrast and text resizing; meaningful labels for buttons, links, forms, and family voice permissions; visible keyboard focus and controls usable without a mouse.",
      },
      {
        text: "Accessible recording consent and voice-enrollment instructions, including a readable continuous teleprompter and clear start/stop controls; alternative ways to contact support when a microphone or audio input is difficult to use.",
      },
      {
        text: "Accessible book navigation and playback controls, narrator choices, and read-along text where available; controls for pausing or stopping moving content and animations where applicable; text alternatives for essential imagery and appropriately captioned or transcribed instructional media.",
      },
      {
        text: "Parent settings, child-profile controls, invitations, voice permissions, gifting, and billing interactions designed to be understandable and usable with assistive technology.",
      },
    ],
  },
  {
    id: "help-and-accommodations",
    title: "Help and accommodations",
    paragraphs: [
      {
        text: "If a feature is difficult to use, a document is inaccessible, or you need help completing an action, contact us. Please tell us the page or feature, what happened, and the device or assistive technology you use if you are comfortable sharing it. Do not include passwords, full payment-card details, or sensitive child or voice recordings in an ordinary support email.",
      },
      {
        text: "We will review accessibility feedback and work toward a reasonable solution or an alternative way to access the information or service when feasible.",
      },
    ],
  },
  {
    id: "third-party-services",
    title: "Third-party services",
    paragraphs: [
      {
        text: "Some features may depend on outside providers, including speech processing, authentication, billing, embedded media, or external links. We cannot control every aspect of their interfaces, but accessibility concerns about experiences reached through Readli can be reported to us and will be evaluated.",
      },
    ],
  },
  {
    id: "feedback-and-contact",
    title: "Feedback and contact",
    paragraphs: [
      { lead: "Email", text: "admin@readli.ai" },
      { lead: "Mailing address", text: "Readli.ai LLC, 2168 Nesconset Hwy, Ste 101, Stony Brook, NY 11790" },
      { lead: "Website", text: "https://readli.ai" },
      {
        text: "When you contact us, you may request an accessible format or alternative means of communication. We aim to respond reasonably promptly, but do not state a guaranteed response deadline at this time.",
      },
    ],
  },
  {
    id: "updates",
    title: "Updates",
    paragraphs: [
      {
        text: "We will revise this statement when our accessibility practices, supported features, or testing results materially change. Last updated: October 10, 2026.",
      },
    ],
  },
];
