import { NextResponse } from "next/server";
import { searchFiles } from "@/application/search-files";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      ref?: string;
      paths?: string[];
      query?: string;
    };
    if (!body.owner || !body.repo || !body.ref || !Array.isArray(body.paths)) {
      return NextResponse.json(
        { error: "owner, repo, ref and paths[] are required" },
        { status: 400 },
      );
    }
    const matches = await searchFiles({
      owner: body.owner,
      repo: body.repo,
      ref: body.ref,
      paths: body.paths,
      query: body.query ?? "",
    });
    return NextResponse.json({ matches });
  } catch (err) {
    return errorResponse(err);
  }
}
