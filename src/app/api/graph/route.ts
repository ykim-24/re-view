import { NextResponse } from "next/server";
import {
  buildDependencyGraph,
  type ChangedFileInput,
} from "@/application/build-dependency-graph";
import { errorResponse } from "@/app/api/_error";

/** POST { owner, repo, ref, files: { path, patch? }[] } -> dependency graph. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      ref?: string;
      files?: ChangedFileInput[];
    };
    if (!body.owner || !body.repo || !body.ref || !Array.isArray(body.files)) {
      return NextResponse.json(
        { error: "owner, repo, ref and files[] are required" },
        { status: 400 },
      );
    }
    const graph = await buildDependencyGraph({
      owner: body.owner,
      repo: body.repo,
      ref: body.ref,
      files: body.files,
    });
    return NextResponse.json(graph);
  } catch (err) {
    return errorResponse(err);
  }
}
