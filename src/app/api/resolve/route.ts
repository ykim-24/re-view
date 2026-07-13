import { NextResponse } from "next/server";
import { resolveSymbol } from "@/application/resolve-symbol";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      owner?: string;
      repo?: string;
      ref?: string;
      importerPath?: string;
      symbol?: string;
    };
    if (
      !body.owner ||
      !body.repo ||
      !body.ref ||
      !body.importerPath ||
      !body.symbol
    ) {
      return NextResponse.json(
        { error: "owner, repo, ref, importerPath and symbol are required" },
        { status: 400 },
      );
    }
    const result = await resolveSymbol({
      owner: body.owner,
      repo: body.repo,
      ref: body.ref,
      importerPath: body.importerPath,
      symbol: body.symbol,
    });
    return NextResponse.json(result);
  } catch (err) {
    return errorResponse(err);
  }
}
