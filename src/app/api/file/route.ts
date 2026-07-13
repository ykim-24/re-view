import { NextResponse } from "next/server";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const path = searchParams.get("path");
  const ref = searchParams.get("ref");

  if (!owner || !repo || !path || !ref) {
    return NextResponse.json(
      { error: "owner, repo, path and ref are required" },
      { status: 400 },
    );
  }

  try {
    const content = await getFileContent(owner, repo, path, ref);
    return NextResponse.json({ path, ref, content, exists: content !== null });
  } catch (err) {
    return errorResponse(err);
  }
}
