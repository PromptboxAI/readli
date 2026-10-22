/**
 * One status pill for every Readli invitation, whichever way it went: a family inviting a storyteller
 * (Family storytellers) or a storyteller sharing their voice with a family (My voice).
 */
export type InvitationPillState = "sent" | "opened" | "accepted" | "declined" | "withdrawn" | "expired";

const PILLS: Record<InvitationPillState, { label: string; tone: string }> = {
  sent: { label: "Invitation sent", tone: "bg-sunshine" },
  opened: { label: "Opened", tone: "bg-sky" },
  accepted: { label: "Accepted", tone: "bg-mint" },
  declined: { label: "Declined", tone: "bg-ink/10" },
  withdrawn: { label: "Withdrawn", tone: "bg-ink/10" },
  expired: { label: "Expired", tone: "bg-ink/10" },
};

export const invitationPillLabel = (state: InvitationPillState) => PILLS[state].label;

export function InvitationPill({ state }: { state: InvitationPillState }) {
  return <span className={`w-fit shrink-0 rounded-full px-3 py-1 text-sm font-bold ${PILLS[state].tone}`}>{PILLS[state].label}</span>;
}
