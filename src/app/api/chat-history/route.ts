/**
 * The saved Ask Lizard transcript for one PR: GET reads it, POST replaces it
 * (an empty list deletes the row), DELETE erases it. Rows are user data read back
 * from SQLite, so everything is normalized field by field on the way out rather
 * than trusted — an older or hand-edited row yields a usable message or is dropped.
 */

import { NextResponse } from "next/server";
import {
  deleteChatThread,
  getChatThread,
  upsertChatThread,
} from "@/infrastructure/db/chat.repository";
import { errorResponse } from "@/app/api/_error";
import type {
  ChatAttachment,
  ChatMessage,
  ChatToolRun,
} from "@/domain/chat/models";

const MAX_STORED_MESSAGES = 40;

function readKey(req: Request): string | null {
  return new URL(req.url).searchParams.get("key");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function toAttachment(value: unknown): ChatAttachment | null {
  if (!isRecord(value)) return null;
  const { id, kind, path, startLine, endLine, text } = value;
  if (typeof id !== "string" || typeof path !== "string") return null;
  if (kind !== "selection" && kind !== "file") return null;
  return {
    id,
    kind,
    path,
    startLine: optionalNumber(startLine),
    endLine: optionalNumber(endLine),
    text: typeof text === "string" ? text : undefined,
  };
}

function toToolRun(value: unknown): ChatToolRun | null {
  if (!isRecord(value)) return null;
  const { id, name, label, logs, status, summary } = value;
  if (typeof id !== "string" || typeof name !== "string" || typeof label !== "string") {
    return null;
  }
  return {
    id,
    name,
    label,
    logs: Array.isArray(logs) ? logs.filter((log) => typeof log === "string") : [],
    status: status === "running" ? "running" : "done",
    summary: typeof summary === "string" ? summary : undefined,
  };
}

function mapDefined<T>(value: unknown, convert: (item: unknown) => T | null): T[] {
  if (!Array.isArray(value)) return [];
  const out: T[] = [];
  for (const item of value) {
    const converted = convert(item);
    if (converted) out.push(converted);
  }
  return out;
}

function toChatMessage(value: unknown): ChatMessage | null {
  if (!isRecord(value)) return null;
  const { id, role, text, attachments, tools, failed } = value;
  if (typeof id !== "string" || typeof text !== "string") return null;
  if (role !== "user" && role !== "assistant") return null;
  return {
    id,
    role,
    text,
    attachments: mapDefined(attachments, toAttachment),
    tools: mapDefined(tools, toToolRun),
    failed: failed === true,
  };
}

function parseStored(raw: string | null): ChatMessage[] {
  if (!raw) return [];
  try {
    return mapDefined(JSON.parse(raw), toChatMessage).slice(-MAX_STORED_MESSAGES);
  } catch {
    return [];
  }
}

export async function GET(req: Request) {
  const key = readKey(req);
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  try {
    return NextResponse.json({ messages: parseStored(getChatThread(key)) });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body: unknown = await req.json();
    if (!isRecord(body) || typeof body.key !== "string" || !body.key) {
      return NextResponse.json({ error: "key is required" }, { status: 400 });
    }
    const messages = mapDefined(body.messages, toChatMessage).slice(
      -MAX_STORED_MESSAGES,
    );
    if (messages.length === 0) {
      deleteChatThread(body.key);
      return NextResponse.json({ ok: true });
    }
    upsertChatThread(body.key, JSON.stringify(messages));
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function DELETE(req: Request) {
  const key = readKey(req);
  if (!key) return NextResponse.json({ error: "key is required" }, { status: 400 });
  try {
    deleteChatThread(key);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return errorResponse(err);
  }
}
