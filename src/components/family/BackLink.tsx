import Link from "next/link";

/** The way back up from a Readli Family page, named for where it goes. */
export function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex min-h-11 w-fit items-center font-display font-semibold underline-offset-4 hover:underline" data-testid="back-link">
      <span aria-hidden="true">←&nbsp;</span>
      {label}
    </Link>
  );
}
