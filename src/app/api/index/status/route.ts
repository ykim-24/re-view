import { NextResponse } from "next/server";
import { getRepoIndexMeta } from "@/infrastructure/db/code-index.repository";
import { repoKey } from "@/lib/pr-key";
import { errorResponse } from "@/app/api/_error";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  if (!owner || !repo) {
    return NextResponse.json(
      { error: "owner and repo are required" },
      { status: 400 },
    );
  }
  try {
    const meta = getRepoIndexMeta(repoKey({ owner, repo }));
    return NextResponse.json(meta);
  } catch (err) {
    return errorResponse(err);
  }
}
