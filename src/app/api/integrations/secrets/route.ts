/** GET/POST/DELETE integration secrets (encrypted at rest; only names returned). */

import { NextResponse } from "next/server";
import {
  listSecrets,
  removeSecret,
  setSecret,
} from "@/infrastructure/db/integration-secret.repository";
import { hasSecretKey } from "@/infrastructure/crypto/secret-box";
import { errorResponse } from "@/app/api/_error";

export async function GET() {
  try {
    return NextResponse.json({ secrets: listSecrets(), hasKey: hasSecretKey() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; value?: string };
    if (!body.name || !body.value) {
      return NextResponse.json({ error: "name and value are required" }, { status: 400 });
    }
    if (!hasSecretKey()) {
      return NextResponse.json(
        { error: "Set INTEGRATIONS_SECRET in .env.local to store secrets." },
        { status: 400 },
      );
    }
    setSecret(body.name, body.value);
    return NextResponse.json({ secrets: listSecrets(), hasKey: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const name = new URL(req.url).searchParams.get("name");
    if (!name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    removeSecret(name);
    return NextResponse.json({ secrets: listSecrets(), hasKey: hasSecretKey() });
  } catch (err) {
    return errorResponse(err);
  }
}
