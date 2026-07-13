"use client";

/** Header toggle to add/remove the current PR from the personal review list. */

import { Bookmark, BookmarkCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { useQueue, useQueueActions } from "@/hooks/useQueue";
import { prKey } from "@/lib/pr-key";
import type { DashboardPr } from "@/domain/pull-request/models";

interface ReviewQueueButtonProps {
  pr: DashboardPr;
}

export function ReviewQueueButton({ pr }: ReviewQueueButtonProps) {
  const queue = useQueue();
  const { addToReview, removeFromReview } = useQueueActions();
  const key = prKey(pr);
  const saved = (queue.data?.saved ?? []).some((p) => prKey(p) === key);

  const handleClick = () => {
    if (saved) removeFromReview(key);
    else addToReview(pr);
  };

  return (
    <Tooltip content={saved ? "Remove from my review list" : "Add to my review list"}>
      <Button variant="ghost" size="icon" onClick={handleClick}>
        <QueueIcon saved={saved} />
      </Button>
    </Tooltip>
  );
}

function QueueIcon({ saved }: { saved: boolean }) {
  if (saved) return <BookmarkCheck className="h-4 w-4 text-emerald-400" />;
  return <Bookmark className="h-4 w-4" />;
}
