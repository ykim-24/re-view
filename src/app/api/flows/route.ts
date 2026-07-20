/**
 * GET/POST/DELETE flows. GET lists by `?integrationId=` or fetches one by `?id=`.
 * DELETE cascades to the components the flow references.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getFlow,
  listFlows,
  removeFlow,
  upsertFlow,
} from "@/infrastructure/db/flow.repository";
import { removeComponents } from "@/infrastructure/db/component.repository";
import type { FlowNode } from "@/domain/integration/models";
import { errorResponse } from "@/app/api/_error";

function isFlowNode(value: unknown): value is FlowNode {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { id?: unknown }).id === "string" &&
    typeof (value as { order?: unknown }).order === "number"
  );
}

function parseNodes(value: unknown): FlowNode[] {
  if (!Array.isArray(value)) return [];
  return value.filter(isFlowNode);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const integrationId = searchParams.get("integrationId");
  try {
    if (id) {
      return NextResponse.json({ flow: getFlow(id) });
    }
    if (!integrationId) {
      return NextResponse.json({ error: "id or integrationId is required" }, { status: 400 });
    }
    return NextResponse.json({ flows: listFlows(integrationId) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: string;
      integrationId?: string;
      name?: string;
      description?: string;
      nodes?: unknown;
    };
    if (!body.integrationId) {
      return NextResponse.json({ error: "integrationId is required" }, { status: 400 });
    }
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const id = body.id || randomUUID();
    upsertFlow({
      id,
      integrationId: body.integrationId,
      name: body.name,
      description: body.description ?? "",
      nodes: parseNodes(body.nodes),
    });
    return NextResponse.json({ id, flow: getFlow(id) });
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
    const flow = getFlow(id);
    if (flow) {
      removeComponents(flow.nodes.map((node) => node.id));
      removeFlow(id);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
