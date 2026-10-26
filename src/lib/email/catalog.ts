/**
 * Every automated Readli email in the sequence matrix (Kevin, 2026-10-24). Each one has a consent class
 * by its primary purpose, the preference that can turn it off, and an admin switch that is off until
 * someone turns it on in /admin. Invitations and sign-in emails sent straight away stay where they are.
 */

export type EmailCategory = "transactional" | "relationship" | "commercial";

/**
 * Optional email a grown-up can turn off. Marketing is off until they opt in. Invitation reminders go
 * to people who usually have no account yet, so they're stopped with the invitation's own "Stop all
 * Readli invitations" link rather than a setting here.
 */
export type PreferenceTopic = "setup_reminders" | "invitation_reminders" | "feedback_requests" | "marketing";

export const PREFERENCE_TOPICS: { topic: PreferenceTopic; label: string; hint: string }[] = [
  { topic: "setup_reminders", label: "Setup reminders", hint: "A few short emails in your first days, until your voice, storytellers and kids' tablet are set up." },
  { topic: "feedback_requests", label: "Feedback requests", hint: "Now and then, one question about how Readli is going." },
  { topic: "marketing", label: "Bedtime Thursdays and Readli news", hint: "A weekly email with two new stories, and occasional news. Off unless you turn it on." },
];

export interface EmailDefinition {
  id: string;
  name: string;
  sequence: "family_onboarding" | "contributor_onboarding" | "invitation_reminders" | "guest_demo" | "bedtime_thursdays" | "trial" | "billing" | "checkout" | "feedback" | "win_back" | "sponsorship";
  category: EmailCategory;
  /** The preference that turns it off; transactional email has none. */
  topic: PreferenceTopic | null;
}

export const EMAILS: EmailDefinition[] = [
  { id: "F1", name: "Welcome to Readli Family", sequence: "family_onboarding", category: "transactional", topic: null },
  { id: "F2", name: "Record your own voice", sequence: "family_onboarding", category: "relationship", topic: "setup_reminders" },
  { id: "F3", name: "Your voice is ready (Family)", sequence: "family_onboarding", category: "transactional", topic: null },
  { id: "F4", name: "Invite a storyteller", sequence: "family_onboarding", category: "relationship", topic: "setup_reminders" },
  { id: "F5", name: "Set up the kids' tablet", sequence: "family_onboarding", category: "relationship", topic: "setup_reminders" },
  { id: "C1", name: "Welcome to Readli Voice", sequence: "contributor_onboarding", category: "transactional", topic: null },
  { id: "C2", name: "Finish recording your voice", sequence: "contributor_onboarding", category: "relationship", topic: "setup_reminders" },
  { id: "C3", name: "Your voice is ready (Readli Voice)", sequence: "contributor_onboarding", category: "transactional", topic: null },
  { id: "C4", name: "Share your voice with family", sequence: "contributor_onboarding", category: "relationship", topic: "setup_reminders" },
  { id: "I1", name: "Family invitation reminder", sequence: "invitation_reminders", category: "relationship", topic: "invitation_reminders" },
  { id: "I2", name: "Voice invitation reminder", sequence: "invitation_reminders", category: "relationship", topic: "invitation_reminders" },
  { id: "I3", name: "Storyteller hasn't recorded (to the parent)", sequence: "invitation_reminders", category: "relationship", topic: "setup_reminders" },
  { id: "G1", name: "Email me my demo", sequence: "guest_demo", category: "transactional", topic: null },
  { id: "BT1", name: "Bedtime Thursdays", sequence: "bedtime_thursdays", category: "commercial", topic: "marketing" },
  { id: "T1", name: "Trial ends in 3 days", sequence: "trial", category: "transactional", topic: null },
  { id: "T2", name: "Trial credits running low", sequence: "trial", category: "transactional", topic: null },
  { id: "B1", name: "Yearly or prepaid renewal notice", sequence: "billing", category: "transactional", topic: null },
  { id: "B2", name: "Gift ending (to the recipient)", sequence: "billing", category: "transactional", topic: null },
  { id: "B3", name: "Price change notice", sequence: "billing", category: "transactional", topic: null },
  { id: "K1", name: "Abandoned checkout", sequence: "checkout", category: "commercial", topic: "marketing" },
  { id: "K2", name: "Abandoned gift checkout", sequence: "checkout", category: "commercial", topic: "marketing" },
  { id: "FB1", name: "How are bedtimes going?", sequence: "feedback", category: "relationship", topic: "feedback_requests" },
  { id: "W1", name: "Win-back: new stories", sequence: "win_back", category: "commercial", topic: "marketing" },
  { id: "W2", name: "Win-back: last check-in", sequence: "win_back", category: "commercial", topic: "marketing" },
  { id: "S1", name: "Family gift invitation (sponsored)", sequence: "sponsorship", category: "transactional", topic: null },
  { id: "S2", name: "Your gift has arrived (to the sponsor)", sequence: "sponsorship", category: "transactional", topic: null },
  { id: "S3", name: "Gift renewal payment failed (to the sponsor)", sequence: "sponsorship", category: "transactional", topic: null },
  { id: "S4", name: "Gift year ending (to the sponsor)", sequence: "sponsorship", category: "transactional", topic: null },
  { id: "S5", name: "Gift ending (to the family)", sequence: "sponsorship", category: "transactional", topic: null },
];

const BY_ID = new Map(EMAILS.map((e) => [e.id, e]));

export function emailDefinition(id: string): EmailDefinition | null {
  return BY_ID.get(id) ?? null;
}
