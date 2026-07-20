/**
 * GET/POST/DELETE components. GET fetches one by `?id=` or a batch by
 * `?ids=a,b,c` (used to resolve a flow's node references). Flow membership/order
 * is owned by the flow's `nodes`, so this route is pure component CRUD.
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  getComponent,
  getComponents,
  removeComponent,
  upsertComponent,
} from "@/infrastructure/db/component.repository";
import type { ComponentType } from "@/domain/integration/models";
import { errorResponse } from "@/app/api/_error";

function isComponentType(value: unknown): value is ComponentType {
  return value === "button" || value === "sequence";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const ids = searchParams.get("ids");
  try {
    if (id) {
      return NextResponse.json({ component: getComponent(id) });
    }
    if (ids !== null) {
      const list = ids.split(",").map((v) => v.trim()).filter(Boolean);
      return NextResponse.json({ components: getComponents(list) });
    }
    return NextResponse.json({ error: "id or ids is required" }, { status: 400 });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      id?: string;
      type?: unknown;
      name?: string;
      config?: unknown;
      code?: string;
    };
    if (!isComponentType(body.type)) {
      return NextResponse.json({ error: "valid type is required" }, { status: 400 });
    }
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const id = body.id || randomUUID();
    upsertComponent({
      id,
      type: body.type,
      name: body.name,
      config: isRecord(body.config) ? body.config : {},
      code: body.code ?? "",
    });
    return NextResponse.json({ id, component: getComponent(id) });
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
    removeComponent(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
