/** GET/POST/DELETE retired Phase A saved commands (name + code). */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import {
  listCommands,
  removeCommand,
  upsertCommand,
} from "@/infrastructure/db/command.repository";
import { errorResponse } from "@/app/api/_error";

export async function GET() {
  try {
    return NextResponse.json({ commands: listCommands() });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { id?: string; name?: string; code?: string };
    if (!body.name) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }
    const id = body.id || randomUUID();
    upsertCommand({ id, name: body.name, code: body.code ?? "" });
    return NextResponse.json({ id, commands: listCommands() });
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
    removeCommand(id);
    return NextResponse.json({ commands: listCommands() });
  } catch (err) {
    return errorResponse(err);
  }
}
