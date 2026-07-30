import { NextResponse } from "next/server";
import {
  generateCommentVerificationStream,
  type VerifyCommentInput,
} from "@/application/verify-comment";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<VerifyCommentInput>;
    if (
      !body.owner ||
      !body.repo ||
      !body.headRef ||
      !body.path ||
      !body.body
    ) {
      return NextResponse.json(
        { error: "owner, repo, headRef, path and body are required" },
        { status: 400 },
      );
    }
    const input: VerifyCommentInput = {
      owner: body.owner,
      repo: body.repo,
      headRef: body.headRef,
      path: body.path,
      line: body.line ?? null,
      author: body.author ?? "reviewer",
      body: body.body,
      thread: body.thread ?? [],
    };
    const stream = generateCommentVerificationStream(input);
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
