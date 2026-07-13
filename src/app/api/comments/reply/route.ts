import { NextResponse } from "next/server";
import { replyToReviewComment } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";

interface ReplyRequest {
  owner?: string;
  repo?: string;
  number?: number;
  commentId?: number;
  body?: string;
}

export async function POST(req: Request) {
  try {
    const input = (await req.json()) as ReplyRequest;
    if (
      !input.owner ||
      !input.repo ||
      !input.number ||
      !input.commentId ||
      !input.body
    ) {
      return NextResponse.json(
        { error: "owner, repo, number, commentId and body are required" },
        { status: 400 },
      );
    }
    const comment = await replyToReviewComment(
      input.owner,
      input.repo,
      input.number,
      input.commentId,
      input.body,
    );
    return NextResponse.json(comment);
  } catch (err) {
    return errorResponse(err);
  }
}
