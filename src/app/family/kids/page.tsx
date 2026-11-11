import { redirect } from "next/navigation";

/** The Family tab moved to /family (My Family); older links still land there. */
export default function KidsRedirect() {
  redirect("/family");
}
