"use client";

/** Per-file "I viewed this and it's good to go" toggle. Local to the session. */

import { Check, Circle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/Tooltip";
import { useReviewStore } from "./store";

interface ViewedToggleProps {
  path: string;
}

export function ViewedToggle({ path }: ViewedToggleProps) {
  const viewed = useReviewStore((s) => s.viewedFiles.has(path));
  const toggleViewed = useReviewStore((s) => s.toggleViewed);

  const handleClick = () => toggleViewed(path);

  return (
    <Tooltip content={viewed ? "Marked viewed — click to unmark" : "Mark as viewed"}>
      <button
        onClick={handleClick}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs",
          viewed && "border-emerald-500/40 bg-emerald-500/10 text-emerald-400",
          !viewed && "text-muted-foreground hover:bg-muted",
        )}
      >
        <ViewedIcon viewed={viewed} />
        Viewed
      </button>
    </Tooltip>
  );
}

function ViewedIcon({ viewed }: { viewed: boolean }) {
  if (viewed) return <Check className="h-3.5 w-3.5" />;
  return <Circle className="h-3.5 w-3.5" />;
}
