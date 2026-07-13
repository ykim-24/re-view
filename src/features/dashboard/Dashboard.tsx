"use client";

/**
 * Personal review hub shown on the home page: a "To review" list (PRs you added
 * manually plus ones GitHub requests your review on) and a "Finished" list.
 * Saved/finished state is persisted server-side (SQLite); review-requested PRs
 * are fetched live from GitHub.
 */

import { useMemo } from "react";
import { Check, Inbox, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { Tooltip } from "@/components/Tooltip";
import { useReviewRequested } from "@/hooks/useReviewRequested";
import { useQueue, useQueueActions } from "@/hooks/useQueue";
import { prKey } from "@/lib/pr-key";
import { DashboardPrRow } from "./DashboardPrRow";
import type { DashboardPr, FinishedPr } from "@/domain/pull-request/models";

interface ToReviewItem {
  pr: DashboardPr;
  saved: boolean;
}

export function Dashboard() {
  const requested = useReviewRequested();
  const queue = useQueue();

  const saved = useMemo(() => queue.data?.saved ?? [], [queue.data]);
  const finished = useMemo(() => queue.data?.finished ?? [], [queue.data]);

  const toReview = useMemo<ToReviewItem[]>(() => {
    const finishedKeys = new Set(finished.map(prKey));
    const map = new Map<string, ToReviewItem>();
    for (const pr of saved) {
      const key = prKey(pr);
      if (!finishedKeys.has(key)) map.set(key, { pr, saved: true });
    }
    for (const pr of requested.data?.prs ?? []) {
      const key = prKey(pr);
      if (finishedKeys.has(key) || map.has(key)) continue;
      map.set(key, { pr, saved: false });
    }
    return [...map.values()].sort((a, b) =>
      b.pr.updatedAt.localeCompare(a.pr.updatedAt),
    );
  }, [saved, finished, requested.data]);

  return (
    <div className="mt-10 space-y-8">
      <section>
        <SectionHeader title="To review" count={toReview.length}>
          {(requested.isLoading || queue.isLoading) && <Loader size="sm" />}
        </SectionHeader>
        {requested.isError && (
          <p className="px-1 py-2 text-xs text-destructive">
            Couldn&apos;t load review requests: {requested.error?.message}
          </p>
        )}
        {toReview.length === 0 && (
          <EmptyHint icon={<Inbox className="h-4 w-4" />} text="Nothing to review" />
        )}
        <div className="overflow-hidden rounded-lg border">
          {toReview.map((item) => (
            <DashboardPrRow
              key={prKey(item.pr)}
              pr={item.pr}
              actions={<ToReviewActions pr={item.pr} saved={item.saved} />}
            />
          ))}
        </div>
      </section>

      <section>
        <SectionHeader title="Finished" count={finished.length} />
        {finished.length === 0 && (
          <EmptyHint icon={<Check className="h-4 w-4" />} text="No finished reviews yet" />
        )}
        <div className="overflow-hidden rounded-lg border">
          {finished.map((pr) => (
            <DashboardPrRow
              key={prKey(pr)}
              pr={pr}
              actions={<FinishedActions pr={pr} />}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

interface SectionHeaderProps {
  title: string;
  count: number;
  children?: React.ReactNode;
}

function SectionHeader({ title, count, children }: SectionHeaderProps) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <h2 className="text-sm font-semibold">{title}</h2>
      <span className="text-xs text-muted-foreground">{count}</span>
      {children}
    </div>
  );
}

function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-sm text-muted-foreground">
      {icon}
      {text}
    </div>
  );
}

interface ToReviewActionsProps {
  pr: DashboardPr;
  saved: boolean;
}

function ToReviewActions({ pr, saved }: ToReviewActionsProps) {
  const { markFinished, removeFromReview } = useQueueActions();

  const handleDone = () => markFinished(pr);
  const handleRemove = () => removeFromReview(prKey(pr));

  return (
    <>
      <Tooltip content="Mark reviewed">
        <Button variant="ghost" size="icon" onClick={handleDone}>
          <Check className="h-3.5 w-3.5" />
        </Button>
      </Tooltip>
      {saved && (
        <Tooltip content="Remove from list">
          <Button variant="ghost" size="icon" onClick={handleRemove}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </Tooltip>
      )}
    </>
  );
}

function FinishedActions({ pr }: { pr: FinishedPr }) {
  const { unmarkFinished } = useQueueActions();
  const handleUndo = () => unmarkFinished(prKey(pr));

  return (
    <Tooltip content="Move back to review">
      <Button variant="ghost" size="icon" onClick={handleUndo}>
        <RotateCcw className="h-3.5 w-3.5" />
      </Button>
    </Tooltip>
  );
}
