/** GET/POST/DELETE integrations (apps). Deleting one cascades to its flows and their components. */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getIntegration,
  listIntegrations,
  removeIntegration,
  upsertIntegration,
} from "@/infrastructure/db/integration.repository";
import { listFlows, removeFlow } from "@/infrastructure/db/flow.repository";
import { removeComponents } from "@/infrastructure/db/component.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET(req: Request) {
  const id = new URL(req.url).searchParams.get("id");
  try {
    if (id) {
      return NextResponse.json({ integration: getIntegration(id) });
    }
    return NextResponse.json({ integrations: listIntegrations() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: string;
      name?: string;
      description?: string;
    };
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const id = body.id || randomUUID();
    upsertIntegration({ id, name: body.name, description: body.description ?? "" });
    return NextResponse.json({ id, integrations: listIntegrations() });
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
    for (const flow of listFlows(id)) {
      removeComponents(flow.nodes.map((node) => node.id));
      removeFlow(flow.id);
    }
    removeIntegration(id);
    return NextResponse.json({ integrations: listIntegrations() });
  } catch (err) {
    return errorResponse(err);
  }
}
