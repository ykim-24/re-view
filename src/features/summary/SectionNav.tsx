"use client";

/**
 * Notion-style section rail for the summary: a column of dashes on the right that
 * reflect the "##" headings in the rendered markdown. Hovering reveals the titles;
 * clicking scrolls to a section; the section in view is highlighted. Reads the
 * headings straight from the DOM so it needs no id wiring in the markdown.
 */

import { useEffect, useState, type RefObject } from "react";
import { cn } from "@/lib/utils";

interface Section {
  id: string;
  text: string;
}

interface SectionNavProps {
  scrollRef: RefObject<HTMLDivElement | null>;
  /** changes when the rendered content does, so the rail re-reads the headings */
  content: string;
}

export function SectionNav({ scrollRef, content }: SectionNavProps) {
  const [sections, setSections] = useState<Section[]>([]);
  const [active, setActive] = useState("");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const heads = Array.from(container.querySelectorAll("h2")) as HTMLElement[];
    heads.forEach((el, i) => {
      el.dataset.sec = `sec-${i}`;
    });
    setSections(heads.map((el, i) => ({ id: `sec-${i}`, text: el.textContent ?? "" })));
  }, [content, scrollRef]);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container || sections.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        const el = visible[0]?.target as HTMLElement | undefined;
        if (el?.dataset.sec) setActive(el.dataset.sec);
      },
      { root: container, rootMargin: "0px 0px -65% 0px", threshold: 0 },
    );
    container.querySelectorAll("h2").forEach((h) => observer.observe(h));
    return () => observer.disconnect();
  }, [sections, scrollRef]);

  const handleClick = (id: string) => {
    const el = scrollRef.current?.querySelector(`[data-sec="${id}"]`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  if (sections.length < 3) return null;

  return (
    <nav className="group absolute right-5 top-1/2 z-10 flex -translate-y-1/2 flex-col items-end gap-1.5">
      {sections.map((section) => (
        <SectionNavItem
          key={section.id}
          section={section}
          active={active === section.id}
          onClick={handleClick}
        />
      ))}
    </nav>
  );
}

interface SectionNavItemProps {
  section: Section;
  active: boolean;
  onClick(id: string): void;
}

function SectionNavItem({ section, active, onClick }: SectionNavItemProps) {
  const handleClick = () => onClick(section.id);
  return (
    <button
      onClick={handleClick}
      className="flex items-center justify-end gap-2"
      aria-label={section.text}
    >
      <span className="max-w-0 overflow-hidden whitespace-nowrap rounded bg-background/90 text-[11px] text-muted-foreground opacity-0 transition-all duration-200 group-hover:max-w-[180px] group-hover:px-1.5 group-hover:opacity-100">
        {section.text}
      </span>
      <span
        className={cn(
          "h-0.5 rounded-full transition-all",
          active ? "w-6 bg-sky-400" : "w-3 bg-muted-foreground/40 group-hover:w-4",
        )}
      />
    </button>
  );
}
