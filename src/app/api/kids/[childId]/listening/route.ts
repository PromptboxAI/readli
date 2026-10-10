import { NextResponse } from "next/server";
import { withFamily } from "@/lib/family/http";
import { startListening, stopListening } from "@/lib/family/service";

export const dynamic = "force-dynamic";

type Params = { params: Promise<{ childId: string }> };

/** Starts or keeps alive this child's listening session, within the family's concurrent stream limit. */
export async function POST(_req: Request, { params }: Params) {
  const { childId } = await params;
  return withFamily(async ({ store, actor }) => {
    await startListening(store, actor, childId);
    return NextResponse.json({ ok: true });
  });
}

export async function DELETE(_req: Request, { params }: Params) {
  const { childId } = await params;
  return withFamily(async ({ store, actor }) => {
    await stopListening(store, actor, childId);
    return NextResponse.json({ ok: true });
  });
}
