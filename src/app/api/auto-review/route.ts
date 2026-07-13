import { NextResponse } from "next/server";
import { generatePrReviewStream } from "@/application/generate-pr-review";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      number?: number;
    };
    if (!body.owner || !body.repo || !body.number) {
      return NextResponse.json(
        { error: "owner, repo and number are required" },
        { status: 400 },
      );
    }
    const stream = generatePrReviewStream(body.owner, body.repo, body.number);
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
