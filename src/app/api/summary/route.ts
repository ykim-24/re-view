import { NextResponse } from "next/server";
import { generateSummaryStream } from "@/application/generate-summary";
import { getSummary } from "@/infrastructure/db/summary.repository";
import { summaryKey, type SummaryTarget } from "@/lib/pr-key";
import { errorResponse } from "@/app/api/_error";

interface TargetInput {
  kind?: string;
  owner?: string;
  repo?: string;
  number?: number | string | null;
  base?: string | null;
  head?: string | null;
}

/** Build a SummaryTarget from loose request params, or null if incomplete. */
function parseTarget(input: TargetInput): SummaryTarget | null {
  const { kind, owner, repo } = input;
  if (!owner || !repo) return null;
  if (kind === "pr") {
    const number = Number(input.number);
    if (!number) return null;
    return { kind: "pr", owner, repo, number };
  }
  if (kind === "compare") {
    if (!input.base || !input.head) return null;
    return { kind: "compare", owner, repo, base: input.base, head: input.head };
  }
  return null;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const target = parseTarget({
    kind: searchParams.get("kind") ?? undefined,
    owner: searchParams.get("owner") ?? undefined,
    repo: searchParams.get("repo") ?? undefined,
    number: searchParams.get("number"),
    base: searchParams.get("base"),
    head: searchParams.get("head"),
  });
  if (!target) {
    return NextResponse.json({ error: "invalid summary target" }, { status: 400 });
  }
  try {
    return NextResponse.json(getSummary(summaryKey(target)));
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as TargetInput & { mode?: string };
    const target = parseTarget(body);
    if (!target) {
      return NextResponse.json({ error: "invalid summary target" }, { status: 400 });
    }
    const mode = body.mode === "update" ? "update" : "generate";
    const stream = generateSummaryStream(target, mode);
    return new Response(stream, {
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
