import { BackTo } from "@/components/nav/BackTrail";

/**
 * The way back from a Readli Family page: to the page the visitor came from, or, when they arrived here
 * directly, to `href`, named `label`.
 */
export function BackLink({ href, label }: { href: string; label: string }) {
  return <BackTo fallback={{ href, label }} className="flex min-h-11 w-fit items-center font-display font-semibold underline-offset-4 hover:underline" />;
}
