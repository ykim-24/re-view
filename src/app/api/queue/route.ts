import { NextResponse } from "next/server";
import {
  addToReview,
  listQueue,
  markFinished,
  removeFromReview,
  unmarkFinished,
} from "@/infrastructure/db/queue.repository";
import { errorResponse } from "@/app/api/_error";
import type { DashboardPr } from "@/domain/pull-request/models";

export async function GET() {
  try {
    return NextResponse.json(listQueue());
  } catch (err) {
    return errorResponse(err);
  }
}

interface QueueAction {
  action: "add" | "remove" | "finish" | "unfinish";
  pr?: DashboardPr;
  key?: string;
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as QueueAction;

    if ((body.action === "add" || body.action === "finish") && body.pr) {
      if (body.action === "add") addToReview(body.pr);
      else markFinished(body.pr);
      return NextResponse.json(listQueue());
    }

    if ((body.action === "remove" || body.action === "unfinish") && body.key) {
      if (body.action === "remove") removeFromReview(body.key);
      else unmarkFinished(body.key);
      return NextResponse.json(listQueue());
    }

    return NextResponse.json({ error: "Invalid queue action" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}
