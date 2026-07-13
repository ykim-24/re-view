/** POST /api/update — fast-forward the local checkout to the remote default branch. */

import { NextResponse } from "next/server";
import { applyUpdate } from "@/infrastructure/system/updater";
import { errorResponse } from "@/app/api/_error";

export async function POST() {
  try {
    return NextResponse.json(await applyUpdate());
  } catch (err) {
    return errorResponse(err);
  }
}
