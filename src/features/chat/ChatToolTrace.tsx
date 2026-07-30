"use client";

/**
 * The tool calls one answer made, listed inline in the transcript rather than
 * boxed: each call shows its label (Insight on Foo.tsx:12, Reading bar.ts, …) and
 * the resolution logs it emitted, on a rule that runs down through the icon
 * column. Expanded by default — the work is the interesting part — with the header
 * row collapsing it to a one-line summary. Unfolding staggers the rows in; a tool
 * call that lands mid-run expands its own row's height and fades in, so the trace
 * grows rather than jumping (GSAP).
 */

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  Loader2,
  Shovel,
  Sparkles,
  FileCode,
  Search,
  GitPullRequest,
  type LucideIcon,
} from "lucide-react";
import type { ChatToolRun } from "@/domain/chat/models";

const TOOL_ICONS: Record<string, LucideIcon> = {
  insight: Sparkles,
  read_file: FileCode,
  find_symbol: Search,
  list_changed_files: GitPullRequest,
};

export function ChatToolTrace({ tools }: { tools: ChatToolRun[] }) {
  const [expanded, setExpanded] = useState(true);
  const listRef = useRef<HTMLUListElement | null>(null);
  const shownRef = useRef(0);
  const wasExpandedRef = useRef(true);
  const handleToggle = () => setExpanded((e) => !e);

  useGSAP(
    () => {
      const list = listRef.current;
      const unfolded = expanded && !wasExpandedRef.current;
      wasExpandedRef.current = expanded;
      if (!expanded) {
        shownRef.current = 0;
        return;
      }
      if (!list || list.children.length === 0) return;

      const rows = [...list.children];
      const added = rows.slice(shownRef.current);
      shownRef.current = rows.length;

      if (unfolded || added.length === rows.length) {
        gsap.from(rows, {
          opacity: 0,
          y: -4,
          duration: 0.24,
          ease: "power2.out",
          stagger: 0.05,
        });
        return;
      }
      if (added.length === 0) return;
      gsap.from(added, {
        height: 0,
        opacity: 0,
        duration: 0.3,
        ease: "power2.out",
        clearProps: "height",
      });
    },
    { dependencies: [expanded, tools.length] },
  );

  if (tools.length === 0) return null;
  const running = tools.some(({ status }) => status === "running");

  return (
    <div className="mb-3">
      <button
        onClick={handleToggle}
        className="flex items-center gap-1 pb-2 text-left text-[10px] font-medium text-muted-foreground hover:text-foreground"
      >
        <Chevron expanded={expanded} />
        <TraceSummary count={tools.length} running={running} />
      </button>
      {expanded && (
        <ul ref={listRef} className="space-y-1.5">
          {tools.map((tool) => (
            <ChatToolRunItem key={tool.id} tool={tool} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Chevron({ expanded }: { expanded: boolean }) {
  if (expanded) return <ChevronDown className="h-3 w-3 shrink-0" />;
  return <ChevronRight className="h-3 w-3 shrink-0" />;
}

function TraceSummary({ count, running }: { count: number; running: boolean }) {
  if (running) {
    return (
      <span className="flex items-center gap-1">
        <Loader2 className="h-3 w-3 animate-spin text-red-400" />
        Working · {count} step{count === 1 ? "" : "s"}
      </span>
    );
  }
  return (
    <span>
      Used {count} tool{count === 1 ? "" : "s"}
    </span>
  );
}

function ChatToolRunItem({ tool }: { tool: ChatToolRun }) {
  const { name, label, logs, status } = tool;
  const Icon = TOOL_ICONS[name] ?? Shovel;
  return (
    <li className="text-[10px]">
      <div className="flex items-center gap-1.5">
        <Icon className="h-3 w-3 shrink-0 text-muted-foreground" />
        <span className="truncate text-foreground">{label}</span>
        <RunStatus status={status} />
      </div>
      {logs.length > 0 && (
        <ul className="ml-[5px] mt-0.5 space-y-0.5 border-l pl-[13px]">
          {logs.map((log, index) => (
            <li
              key={`${log}-${index}`}
              className="truncate font-mono text-[10px] text-muted-foreground"
            >
              {log}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function RunStatus({ status }: { status: ChatToolRun["status"] }) {
  if (status === "running") {
    return <Loader2 className="ml-auto h-3 w-3 shrink-0 animate-spin text-red-400" />;
  }
  return <Check className="ml-auto h-3 w-3 shrink-0 text-emerald-400" />;
}
