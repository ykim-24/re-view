/** GET /api/version — is the local checkout behind the remote default branch? */

import { NextResponse } from "next/server";
import { getVersionStatus } from "@/infrastructure/system/updater";
import { errorResponse } from "@/app/api/_error";

export async function GET() {
  try {
    return NextResponse.json(await getVersionStatus());
  } catch (err) {
    return errorResponse(err);
  }
}
