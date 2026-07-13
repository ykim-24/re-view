import { NextResponse } from "next/server";
import { getCommitDetail } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const sha = searchParams.get("sha");

  if (!owner || !repo || !sha) {
    return NextResponse.json(
      { error: "owner, repo and sha are required" },
      { status: 400 },
    );
  }

  try {
    const commit = await getCommitDetail(owner, repo, sha);
    return NextResponse.json(commit);
  } catch (err) {
    return errorResponse(err);
  }
}
