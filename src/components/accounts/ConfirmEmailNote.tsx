/** After a quick-signup checkout: where the confirming sign-in email went, so a mistyped address shows up now. */
export function ConfirmEmailNote({ email }: { email: string }) {
  return (
    <p role="status" data-testid="confirm-email" className="rounded-2xl bg-mint/50 p-4">
      We sent an email to <strong>{email}</strong> to confirm your address. Open it to sign in to Readli on your other devices. Not your
      email, or it didn&apos;t arrive? Write to admin@readli.ai and we&apos;ll fix it.
    </p>
  );
}
