import { NextResponse } from "next/server";
import {
  generateInsightStream,
  type InsightInput,
} from "@/application/generate-insight";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<InsightInput>;
    if (
      !body.owner ||
      !body.repo ||
      !body.headRef ||
      !body.path ||
      (!body.selectedText && !body.whole) ||
      body.startLine == null ||
      body.endLine == null
    ) {
      return NextResponse.json(
        { error: "owner, repo, headRef, path and lines are required" },
        { status: 400 },
      );
    }
    const stream = generateInsightStream(body as InsightInput);
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
