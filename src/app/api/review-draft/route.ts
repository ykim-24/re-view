/**
 * Read/write/clear the persisted unsubmitted review state for a PR, keyed by
 * prKey. GET returns the saved state (or an empty default), POST upserts it, and
 * DELETE clears it. Backs the client-side review-draft sync so an in-progress
 * review survives reloads and server restarts.
 */

import { NextResponse } from "next/server";
import {
  deleteReviewDraft,
  getReviewDraft,
  saveReviewDraft,
} from "@/infrastructure/db/review-draft.repository";
import type { ReviewDraftState } from "@/domain/pull-request/models";
import { errorResponse } from "@/app/api/_error";

const EMPTY: ReviewDraftState = { drafts: [], body: "", event: "COMMENT", viewed: [] };

interface SaveBody extends Partial<ReviewDraftState> {
  key?: string;
}

export async function GET(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }
  try {
    return NextResponse.json(getReviewDraft(key) ?? EMPTY);
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as SaveBody;
    if (!body.key) {
      return NextResponse.json({ error: "missing key" }, { status: 400 });
    }
    saveReviewDraft(body.key, {
      drafts: body.drafts ?? [],
      body: body.body ?? "",
      event: body.event ?? "COMMENT",
      viewed: body.viewed ?? [],
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const key = new URL(req.url).searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "missing key" }, { status: 400 });
  }
  try {
    deleteReviewDraft(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
