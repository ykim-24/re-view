import { NextResponse } from "next/server";
import { getPullRequestHeadSha } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const number = Number(searchParams.get("number"));

  if (!owner || !repo || !number) {
    return NextResponse.json(
      { error: "owner, repo and number are required" },
      { status: 400 },
    );
  }

  try {
    const sha = await getPullRequestHeadSha(owner, repo, number);
    return NextResponse.json({ sha });
  } catch (err) {
    return errorResponse(err);
  }
}
