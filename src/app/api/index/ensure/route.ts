import { NextResponse } from "next/server";
import { ensureRepoIndex } from "@/application/build-repo-index";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { owner?: string; repo?: string };
    if (!body.owner || !body.repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 },
      );
    }
    const meta = await ensureRepoIndex(body.owner, body.repo);
    return NextResponse.json(meta);
  } catch (err) {
    return errorResponse(err);
  }
}
