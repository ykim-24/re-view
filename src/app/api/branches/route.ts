import { NextResponse } from "next/server";
import { listBranches } from "@/infrastructure/github/branch.repository";
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
    const data = await listBranches(owner, repo);
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
