"use client";

/**
 * Line-art loading animation: a cube that tumbles in quarter-turns with a subtle
 * bounce, resting on a baseline. Used for panel/editor loading states.
 */

import { useRef } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

interface LoaderProps {
  label?: string;
  className?: string;
  /** "sm" renders a bare inline cube (no baseline/label) to replace tiny spinners. */
  size?: "sm" | "lg";
}

export function Loader({ label, className, size = "lg" }: LoaderProps) {
  const ref = useRef<SVGSVGElement | null>(null);

  useGSAP(
    () => {
      const cube = ref.current?.querySelector<SVGRectElement>(".cube");
      if (!cube) return;
      gsap.set(cube, { transformOrigin: "50% 50%" });
      const tl = gsap.timeline({ repeat: -1, repeatDelay: 0.12 });
      for (let turn = 1; turn <= 4; turn++) {
        tl.to(cube, {
          rotation: turn * 90,
          duration: 0.5,
          ease: "back.out(1.5)",
        });
      }
      tl.set(cube, { rotation: 0 });
    },
    { scope: ref },
  );

  if (size === "sm") {
    return (
      <svg
        ref={ref}
        viewBox="16 14 32 28"
        className={cn("h-4 w-4 shrink-0 text-primary", className)}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          className="cube"
          x="22"
          y="18"
          width="20"
          height="20"
          rx="3"
          stroke="currentColor"
          strokeWidth="3"
        />
      </svg>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
      <svg
        ref={ref}
        viewBox="0 0 64 64"
        className="h-12 w-12 text-primary"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <rect
          className="cube"
          x="22"
          y="18"
          width="20"
          height="20"
          rx="3"
          stroke="currentColor"
          strokeWidth="2.5"
        />
        <line
          x1="16"
          y1="44"
          x2="48"
          y2="44"
          stroke="currentColor"
          strokeWidth="2.5"
          className="text-muted-foreground"
          opacity="0.6"
        />
      </svg>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
