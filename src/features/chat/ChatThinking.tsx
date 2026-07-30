"use client";

/**
 * The waiting state for an answer that has no text yet — a shimmering "Slithering…"
 * line rather than a bare cursor, so a long tool run never looks like a dead reply.
 * The label cycles while it waits so it reads as progress, not a frozen frame.
 */

import { useEffect, useState } from "react";

const LABELS = ["Slithering…", "Thinking…", "Reading the code…", "Piecing it together…"];
const ROTATE_MS = 2600;

export function ChatThinking() {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIndex((i) => (i + 1) % LABELS.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-400" />
      <span className="animate-pulse">{LABELS[index]}</span>
    </span>
  );
}
