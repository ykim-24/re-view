/**
 * POST { flowId, entryId, ctx } — run a flow's component (by id) with the shared
 * flow state. Loads the flow's components server-side so the entry can reference
 * siblings via `components.<key>`. Returns logs + result plus the mutated ctx.
 */

import { NextResponse } from "next/server";
import { runFlow } from "@/application/run-integration";
import { getFlow } from "@/infrastructure/db/flow.repository";
import { getComponents } from "@/infrastructure/db/component.repository";
import { errorResponse } from "@/app/api/_error";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { flowId?: string; entryId?: string; ctx?: unknown };
    if (!body.flowId || !body.entryId) {
      return NextResponse.json({ error: "flowId and entryId are required" }, { status: 400 });
    }
    const flow = getFlow(body.flowId);
    if (!flow) {
      return NextResponse.json({ error: "flow not found" }, { status: 404 });
    }
    const components = getComponents(flow.nodes.map((node) => node.id));
    const ctx = isRecord(body.ctx) ? body.ctx : {};
    return NextResponse.json(await runFlow(components, body.entryId, ctx));
  } catch (err) {
    return errorResponse(err);
  }
}
