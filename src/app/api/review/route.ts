import { NextResponse } from "next/server";
import { submitReview } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";
import type { SubmitReviewInput } from "@/domain/pull-request/models";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<SubmitReviewInput>;
    if (!body.owner || !body.repo || !body.number || !body.event) {
      return NextResponse.json(
        { error: "owner, repo, number and event are required" },
        { status: 400 },
      );
    }
    const result = await submitReview({
      owner: body.owner,
      repo: body.repo,
      number: body.number,
      event: body.event,
      body: body.body ?? "",
      comments: body.comments ?? [],
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
