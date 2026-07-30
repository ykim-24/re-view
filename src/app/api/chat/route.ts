import { NextResponse } from "next/server";
import { generateChatStream } from "@/application/chat-agent";
import type { ChatRequest } from "@/domain/chat/models";
import { errorResponse } from "@/app/api/_error";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as Partial<ChatRequest>;
    if (!body.question) {
      return NextResponse.json({ error: "question is required" }, { status: 400 });
    }
    const stream = generateChatStream({
      question: body.question,
      history: body.history ?? [],
      attachments: body.attachments ?? [],
      scope: body.scope ?? null,
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
