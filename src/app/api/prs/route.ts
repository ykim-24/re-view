import { NextResponse } from "next/server";
import { listPullRequests } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";
import type { PrStateFilter } from "@/domain/pull-request/models";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const state = (searchParams.get("state") ?? "open") as PrStateFilter;

  if (!owner || !repo) {
    return NextResponse.json(
      { error: "owner and repo are required" },
      { status: 400 },
    );
  }

  try {
    const prs = await listPullRequests(owner, repo, state);
    return NextResponse.json({ prs });
  } catch (err) {
    return errorResponse(err);
  }
}
