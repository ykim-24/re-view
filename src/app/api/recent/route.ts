import { NextResponse } from "next/server";
import { listRecent, recordRecent } from "@/infrastructure/db/recent.repository";
import { errorResponse } from "@/app/api/_error";
import type { DashboardPr } from "@/domain/pull-request/models";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner") ?? undefined;
  const repo = searchParams.get("repo") ?? undefined;
  try {
    return NextResponse.json({ recent: listRecent(owner, repo) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { pr?: DashboardPr };
    if (!body.pr) {
      return NextResponse.json({ error: "pr is required" }, { status: 400 });
    }
    recordRecent(body.pr);
    return NextResponse.json({ recent: listRecent(body.pr.owner, body.pr.repo) });
  } catch (err) {
    return errorResponse(err);
  }
}
