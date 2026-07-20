/** POST { code } — run a saved command and return its logs + result. */

import { NextResponse } from "next/server";
import { runIntegration } from "@/application/run-integration";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { code?: string };
    if (typeof body.code !== "string") {
      return NextResponse.json({ error: "code is required" }, { status: 400 });
    }
    return NextResponse.json(await runIntegration(body.code));
  } catch (err) {
    return errorResponse(err);
  }
}
