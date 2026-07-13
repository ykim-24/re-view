import { NextResponse } from "next/server";
import { loadTypeContext } from "@/application/load-type-context";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      ref?: string;
      path?: string;
    };
    if (!body.owner || !body.repo || !body.ref || !body.path) {
      return NextResponse.json(
        { error: "owner, repo, ref and path are required" },
        { status: 400 },
      );
    }
    const ctx = await loadTypeContext({
      owner: body.owner,
      repo: body.repo,
      ref: body.ref,
      path: body.path,
    });
    return NextResponse.json(ctx);
  } catch (err) {
    return errorResponse(err);
  }
}
