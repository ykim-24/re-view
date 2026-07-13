"use client";

/**
 * Matrix-style dot loader shown while a "Dig Deeper" insight analyzes: a
 * monochrome grid of dots that pulse in a downward cascade, evoking digging
 * deeper through layers. Transparent background, theme-aware grayscale.
 */

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";

const COLS = 7;
const ROWS = 6;
const GAP = 13;
const OFFSET_X = 11;
const OFFSET_Y = 11;

const DOTS: { cx: number; cy: number; key: string }[] = Array.from(
  { length: ROWS * COLS },
  (_, i) => ({
    cx: OFFSET_X + (i % COLS) * GAP,
    cy: OFFSET_Y + Math.floor(i / COLS) * GAP,
    key: `${Math.floor(i / COLS)}-${i % COLS}`,
  }),
);

export function DigLoader() {
  const ref = useRef<SVGSVGElement | null>(null);

  useGSAP(
    () => {
      const nodes = ref.current?.querySelectorAll<SVGCircleElement>(".dot");
      if (!nodes || nodes.length === 0) return;

      gsap.set(nodes, { transformOrigin: "center" });
      nodes.forEach((node, i) => {
        const diagonal = (i % COLS) + Math.floor(i / COLS);
        gsap.to(node, {
          keyframes: {
            x: [0, -5, 0],
            y: [0, -5, 0],
            opacity: [0.12, 1, 0.12],
            scale: [0.6, 1.1, 0.6],
            easeEach: "sine.inOut",
          },
          duration: 2.2,
          repeat: -1,
          delay: diagonal * 0.12,
        });
      });
    },
    { scope: ref },
  );

  return (
    <div className="flex flex-col items-center justify-center gap-2 py-5">
      <svg
        ref={ref}
        viewBox="0 0 100 87"
        className="h-24 w-28 text-foreground/70"
      >
        {DOTS.map((dot) => (
          <circle
            key={dot.key}
            className="dot"
            cx={dot.cx}
            cy={dot.cy}
            r="2.4"
            fill="currentColor"
          />
        ))}
      </svg>
      <span className="text-[11px] text-muted-foreground">Digging deeper…</span>
    </div>
  );
}
