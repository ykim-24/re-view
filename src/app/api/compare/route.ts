import { NextResponse } from "next/server";
import { compareRefs } from "@/infrastructure/github/branch.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const owner = searchParams.get("owner");
  const repo = searchParams.get("repo");
  const base = searchParams.get("base");
  const head = searchParams.get("head");

  if (!owner || !repo || !base || !head) {
    return NextResponse.json(
      { error: "owner, repo, base and head are required" },
      { status: 400 },
    );
  }

  try {
    const data = await compareRefs(owner, repo, base, head);
    return NextResponse.json(data);
  } catch (err) {
    return errorResponse(err);
  }
}
