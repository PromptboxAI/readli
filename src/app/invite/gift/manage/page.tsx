import { redirect } from "next/navigation";

/** Readli's gift is Sponsored Family, at /gift/family (Kevin, 2026-10-30). Charity codes come from admin Complimentary. */
export default function Page() {
  redirect("/gift/family");
}
