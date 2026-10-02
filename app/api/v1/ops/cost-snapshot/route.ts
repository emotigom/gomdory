import { NextResponse } from "next/server";

import { withObs } from "@/lib/http/withObs";
import { getCostSnapshot } from "@/lib/ops/costSnapshot";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export const GET = withObs(async () => {
  const snapshot = await getCostSnapshot();
  return NextResponse.json({ ok: true, snapshot });
}, { errorKind: "storage" });
