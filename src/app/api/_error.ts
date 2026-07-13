import { NextResponse } from "next/server";

/** Normalize thrown errors (incl. Octokit's) into a JSON error response. */
export function errorResponse(err: unknown): NextResponse {
  const status =
    typeof err === "object" && err !== null && "status" in err
      ? Number((err as { status?: number }).status) || 500
      : 500;
  const message =
    err instanceof Error ? err.message : "Unexpected server error";
  return NextResponse.json({ error: message }, { status });
}
