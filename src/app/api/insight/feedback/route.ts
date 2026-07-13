import { NextResponse } from "next/server";
import { insertInsightFeedback } from "@/infrastructure/db/insight-feedback.repository";
import { repoKey } from "@/lib/pr-key";
import { errorResponse } from "@/app/api/_error";

interface FeedbackRequest {
  owner?: string;
  repo?: string;
  ref?: string;
  path?: string;
  startLine?: number;
  endLine?: number;
  selectedText?: string;
  insight?: string;
  rating?: "up" | "down";
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as FeedbackRequest;
    if (
      !body.owner ||
      !body.repo ||
      !body.ref ||
      !body.path ||
      body.startLine == null ||
      body.endLine == null ||
      (body.rating !== "up" && body.rating !== "down")
    ) {
      return NextResponse.json(
        { error: "owner, repo, ref, path, lines and rating (up|down) are required" },
        { status: 400 },
      );
    }
    insertInsightFeedback({
      repoKey: repoKey({ owner: body.owner, repo: body.repo }),
      ref: body.ref,
      path: body.path,
      startLine: body.startLine,
      endLine: body.endLine,
      selectedText: body.selectedText ?? "",
      insight: body.insight ?? "",
      rating: body.rating,
      model: "claude-opus-4-8",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
