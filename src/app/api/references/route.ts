import { NextResponse } from "next/server";
import { searchSymbolReferences } from "@/infrastructure/github/pull-request.repository";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      symbol?: string;
    };
    if (!body.owner || !body.repo || !body.symbol) {
      return NextResponse.json(
        { error: "owner, repo and symbol are required" },
        { status: 400 },
      );
    }
    const references = await searchSymbolReferences(
      body.owner,
      body.repo,
      body.symbol,
    );
    return NextResponse.json({ references });
  } catch (err) {
    return errorResponse(err);
  }
}
