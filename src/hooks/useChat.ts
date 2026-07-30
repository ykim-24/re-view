"use client";

/**
 * Drives /api/chat: posts the question with the staged attachments and the page
 * scope, then folds the newline-delimited `ChatEvent`s into the chat store so the
 * panel renders the answer and its tool trace as they arrive. Answer text goes
 * through the shared typewriter so it reveals at the same steady pace as insight,
 * auto-review, and the summary instead of landing in bursts.
 */

import { useCallback, useEffect, useRef } from "react";
import { createTypewriter, type Typewriter } from "@/lib/typewriter";
import { useChatStore } from "@/features/chat/chat.store";
import type { ChatEvent } from "@/domain/chat/events";
import type { ChatRequest, ChatTurn } from "@/domain/chat/models";

export function useChat() {
  const abortRef = useRef<AbortController | null>(null);
  const revealRef = useRef<Typewriter | null>(null);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      revealRef.current?.stop();
    };
  }, []);

  const send = useCallback(async (question: string) => {
    const {
      messages,
      staged,
      scope,
      addUserMessage,
      startAssistant,
      appendToken,
      startTool,
      logTool,
      endTool,
      failAssistant,
      finishStreaming,
    } = useChatStore.getState();

    const history: ChatTurn[] = messages
      .filter(({ failed }) => !failed)
      .map(({ role, text }) => ({ role, text }));
    const attachments = [...staged];
    const answerId = `a-${messages.length}-${Date.now()}`;

    addUserMessage(question, attachments);
    startAssistant(answerId);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    const body: ChatRequest = { history, question, attachments, scope };

    revealRef.current?.stop();
    const reveal = createTypewriter({
      onReveal: (chunk) => appendToken(answerId, chunk),
      onDrained: finishStreaming,
    });
    revealRef.current = reveal;

    const handleEvent = (event: ChatEvent) => {
      if (event.type === "token") {
        reveal.push(event.text);
      } else if (event.type === "tool_start") {
        startTool(answerId, { id: event.id, name: event.name, label: event.label });
      } else if (event.type === "tool_log") {
        logTool(answerId, event.id, event.message);
      } else if (event.type === "tool_end") {
        endTool(answerId, event.id, event.summary);
      } else if (event.type === "error") {
        failAssistant(answerId, `Error: ${event.message}`);
      }
    };

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!res.body) {
        failAssistant(answerId, "Error: the chat stream did not start.");
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          handleEvent(JSON.parse(line) as ChatEvent);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === "AbortError")) {
        const message = err instanceof Error ? err.message : "Chat failed.";
        failAssistant(answerId, `Error: ${message}`);
      }
    } finally {
      reveal.finish();
    }
  }, []);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    revealRef.current?.stop();
    useChatStore.getState().finishStreaming();
  }, []);

  return { send, stop };
}
