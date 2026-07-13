import { NextResponse } from "next/server";
import { listReviewRequested } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET() {
  try {
    const prs = await listReviewRequested();
    return NextResponse.json({ prs });
  } catch (err) {
    return errorResponse(err);
  }
}
