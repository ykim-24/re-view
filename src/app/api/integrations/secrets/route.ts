/**
 * GET/POST/DELETE integration secrets, scoped global or per-integration. GET
 * lists what an integration can use (its own + globals) via `?integrationId=`.
 * Encrypted at rest; only names/metadata are returned.
 */

import { NextResponse } from "next/server";
import {
  listSecretsForIntegration,
  removeSecret,
  setSecret,
} from "@/infrastructure/db/integration-secret.repository";
import { hasSecretKey } from "@/infrastructure/crypto/secret-box";
import type { SecretScope } from "@/domain/integration/models";
import { errorResponse } from "@/app/api/_error";

function toScope(value: unknown): SecretScope {
  return value === "integration" ? "integration" : "global";
}

export async function GET(req: Request) {
  const integrationId = new URL(req.url).searchParams.get("integrationId") ?? "";
  try {
    return NextResponse.json({
      secrets: listSecretsForIntegration(integrationId),
      hasKey: hasSecretKey(),
    });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      name?: string;
      value?: string;
      scope?: unknown;
      integrationId?: string;
    };
    if (!body.name || !body.value) {
      return NextResponse.json({ error: "name and value are required" }, { status: 400 });
    }
    if (!hasSecretKey()) {
      return NextResponse.json(
        { error: "Set INTEGRATIONS_SECRET in .env.local to store secrets." },
        { status: 400 },
      );
    }
    const scope = toScope(body.scope);
    if (scope === "integration" && !body.integrationId) {
      return NextResponse.json(
        { error: "integrationId is required for an integration-scoped secret" },
        { status: 400 },
      );
    }
    setSecret({
      name: body.name,
      value: body.value,
      scope,
      integrationId: body.integrationId ?? "",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }
    removeSecret(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
