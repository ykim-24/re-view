/**
 * The steady character reveal shared by every streamed answer in the app, so chat
 * reads at the same pace as insight, auto-review, and the summary. Tokens arrive in
 * bursts; this drains them at a fixed rate on a rAF loop, which keeps the text
 * smooth regardless of network jitter.
 *
 * `push` adds newly received text, `finish` says no more is coming, and `stop`
 * abandons the reveal. `onReveal` receives each newly revealed slice; `onDrained`
 * fires once after `finish` when the buffer has fully caught up.
 */

export const REVEAL_CHARS_PER_MS = 0.18;

interface TypewriterHandlers {
  onReveal(chunk: string): void;
  onDrained(): void;
}

export interface Typewriter {
  push(text: string): void;
  finish(): void;
  stop(): void;
}

export function createTypewriter({ onReveal, onDrained }: TypewriterHandlers): Typewriter {
  let target = "";
  let shown = 0;
  let revealed = 0;
  let lastTime = 0;
  let done = false;
  let killed = false;
  let frame: number | null = null;

  const tick = (time: number) => {
    if (lastTime === 0) lastTime = time;
    const delta = time - lastTime;
    lastTime = time;

    revealed = Math.min(target.length, revealed + delta * REVEAL_CHARS_PER_MS);
    const next = Math.floor(revealed);
    if (next > shown) {
      onReveal(target.slice(shown, next));
      shown = next;
    }

    if (shown >= target.length && done) {
      frame = null;
      lastTime = 0;
      onDrained();
      return;
    }
    frame = requestAnimationFrame(tick);
  };

  const ensureFrame = () => {
    if (killed || frame !== null) return;
    lastTime = 0;
    frame = requestAnimationFrame(tick);
  };

  return {
    push(text: string) {
      if (killed) return;
      target += text;
      ensureFrame();
    },
    finish() {
      if (killed) return;
      done = true;
      ensureFrame();
    },
    stop() {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      killed = true;
      done = true;
    },
  };
}
