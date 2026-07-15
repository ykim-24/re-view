/** GET /api/changelog — the repo's CHANGELOG.md, for the in-app changelog modal. */

import { NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { errorResponse } from "@/app/api/_error";

export async function GET() {
  try {
    const content = await readFile(
      path.join(process.cwd(), "CHANGELOG.md"),
      "utf8",
    ).catch(() => "");
    return NextResponse.json({ content });
  } catch (err) {
    return errorResponse(err);
  }
}
