import { useCallback, useEffect, useRef, useState } from "react";
import type { GatheredFile, InsightEvent } from "@/domain/insight/events";

const CHARS_PER_MS = 0.18;

export interface InsightStep {
  id: string;
  label: string;
  status: "pending" | "running" | "done";
  logs: string[];
}

/**
 * Shared driver for the newline-delimited step+token streams (insight and auto
 * review). Parses events into a live step list + gathered files, and reveals the
 * answer tokens with a steady typewriter regardless of network jitter.
 */
export function useEventStream(url: string) {
  const [steps, setSteps] = useState<InsightStep[]>([]);
  const [files, setFiles] = useState<GatheredFile[]>([]);
  const [answer, setAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const targetRef = useRef("");
  const shownRef = useRef(0);
  const accRef = useRef(0);
  const lastTimeRef = useRef(0);
  const doneRef = useRef(false);
  const rafRef = useRef<number | null>(null);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const tick = useCallback((time: number) => {
    if (lastTimeRef.current === 0) lastTimeRef.current = time;
    const dt = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const target = targetRef.current.length;
    accRef.current = Math.min(target, accRef.current + dt * CHARS_PER_MS);
    const shown = Math.floor(accRef.current);
    if (shown !== shownRef.current) {
      shownRef.current = shown;
      setAnswer(targetRef.current.slice(0, shown));
    }

    if (shownRef.current >= target && doneRef.current) {
      rafRef.current = null;
      lastTimeRef.current = 0;
      return;
    }
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const ensureRaf = useCallback(() => {
    if (rafRef.current === null) rafRef.current = requestAnimationFrame(tick);
  }, [tick]);

  const handleEvent = useCallback(
    (event: InsightEvent) => {
      if (event.type === "plan") {
        setSteps(
          event.steps.map((s) => ({
            id: s.id,
            label: s.label,
            status: "pending",
            logs: [],
          })),
        );
      } else if (event.type === "step_start") {
        setSteps((prev) =>
          prev.map((s) => (s.id === event.id ? { ...s, status: "running" } : s)),
        );
      } else if (event.type === "log") {
        setSteps((prev) =>
          prev.map((s) =>
            s.status === "running" ? { ...s, logs: [...s.logs, event.message] } : s,
          ),
        );
      } else if (event.type === "step_end") {
        setSteps((prev) =>
          prev.map((s) => (s.id === event.id ? { ...s, status: "done" } : s)),
        );
      } else if (event.type === "files") {
        setFiles(event.files);
      } else if (event.type === "token") {
        targetRef.current += event.text;
        ensureRaf();
      } else if (event.type === "error") {
        targetRef.current += `\n\n_Error: ${event.message}_`;
        ensureRaf();
      }
    },
    [ensureRaf],
  );

  const run = useCallback(
    async (body: object) => {
      abortRef.current?.abort();
      stopRaf();
      const controller = new AbortController();
      abortRef.current = controller;
      targetRef.current = "";
      shownRef.current = 0;
      accRef.current = 0;
      lastTimeRef.current = 0;
      doneRef.current = false;
      setSteps([]);
      setFiles([]);
      setAnswer("");
      setIsStreaming(true);
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (!res.body) return;
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
            handleEvent(JSON.parse(line) as InsightEvent);
          }
        }
      } catch (err) {
        if (!(err instanceof DOMException && err.name === "AbortError")) {
          const message = err instanceof Error ? err.message : "Stream failed.";
          targetRef.current += `\n\n_Error: ${message}_`;
          ensureRaf();
        }
      } finally {
        doneRef.current = true;
        ensureRaf();
        setIsStreaming(false);
      }
    },
    [url, ensureRaf, handleEvent, stopRaf],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    stopRaf();
    targetRef.current = "";
    shownRef.current = 0;
    accRef.current = 0;
    lastTimeRef.current = 0;
    doneRef.current = false;
    setSteps([]);
    setFiles([]);
    setAnswer("");
    setIsStreaming(false);
  }, [stopRaf]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      stopRaf();
    };
  }, [stopRaf]);

  return { steps, files, answer, isStreaming, run, reset };
}
