"use client";

/**
 * A titled section whose body collapses and expands with a GSAP height/opacity
 * animation. Owns its collapsed state; the first render is not animated. With
 * `fill`, the open body grows to fill remaining space (used by the file tree);
 * otherwise it sizes to its content (used by the changes panel). During the
 * tween flex-grow is neutralized so an explicit height can animate, then cleared.
 */

import { useRef, useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";

const DURATION = 0.28;

interface CollapsibleSectionProps {
  title: string;
  count?: number;
  defaultCollapsed?: boolean;
  fill?: boolean;
  className?: string;
  children: ReactNode;
}

export function CollapsibleSection({
  title,
  count,
  defaultCollapsed = false,
  fill = false,
  className,
  children,
}: CollapsibleSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstRun = useRef(true);

  const handleToggle = () => setCollapsed((v) => !v);

  useGSAP(
    () => {
      // Fill sections share flex space with siblings; animating their height
      // fights the flex layout, so they collapse instantly (no jank).
      if (fill) return;
      const el = bodyRef.current;
      if (!el) return;
      if (firstRun.current) {
        firstRun.current = false;
        if (collapsed) gsap.set(el, { height: 0, opacity: 0, flexGrow: 0 });
        return;
      }

      gsap.killTweensOf(el);
      const finish = () => gsap.set(el, { clearProps: "height,flexGrow,opacity" });

      if (collapsed) {
        gsap.set(el, { flexGrow: 0, height: el.offsetHeight, opacity: 1 });
        gsap.to(el, { height: 0, opacity: 0, duration: DURATION, ease: "power2.inOut" });
        return;
      }

      gsap.set(el, { flexGrow: 0, height: "auto", opacity: 1 });
      const target = el.offsetHeight;
      gsap.fromTo(
        el,
        { height: 0, opacity: 0 },
        {
          height: target,
          opacity: 1,
          duration: DURATION,
          ease: "power2.out",
          onComplete: finish,
        },
      );
    },
    { dependencies: [collapsed] },
  );

  return (
    <div
      className={cn(
        "flex flex-col",
        fill && !collapsed && "min-h-0 flex-1",
        (collapsed || !fill) && "shrink-0",
        className,
      )}
    >
      <button
        onClick={handleToggle}
        className="sticky top-0 z-20 flex shrink-0 items-center gap-1 border-b bg-background px-3 py-2 hover:bg-muted"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 transition-transform text-muted-foreground",
            !collapsed && "rotate-90",
          )}
        />
        <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {title}
        </span>
        {count !== undefined && (
          <span className="ml-auto text-xs text-muted-foreground">{count}</span>
        )}
      </button>
      <SectionBody fill={fill} collapsed={collapsed} bodyRef={bodyRef}>
        {children}
      </SectionBody>
    </div>
  );
}

interface SectionBodyProps {
  fill: boolean;
  collapsed: boolean;
  bodyRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
}

function SectionBody({ fill, collapsed, bodyRef, children }: SectionBodyProps) {
  if (fill) {
    if (collapsed) return null;
    return (
      <div className="min-h-0 flex-1 overflow-hidden duration-150 animate-in fade-in">
        {children}
      </div>
    );
  }
  return (
    <div ref={bodyRef} className="overflow-hidden">
      {children}
    </div>
  );
}
