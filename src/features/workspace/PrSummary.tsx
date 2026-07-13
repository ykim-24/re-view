"use client";

/** PR overview shown under the left panel's "Details" tab. */

import { ExternalLink, GitPullRequest } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Markdown } from "@/components/Markdown";
import { CollapsibleSection } from "@/components/CollapsibleSection";
import { PrComments } from "./PrComments";
import { PrCommits } from "./PrCommits";
import type { Label, PullRequest } from "@/domain/pull-request/models";

interface PrSummaryProps {
  pr: PullRequest;
}

export function PrSummary({ pr }: PrSummaryProps) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <div className="shrink-0 p-4 text-sm">
        <div className="mb-3 flex items-start gap-2">
          <GitPullRequest className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
          <h2 className="font-medium leading-snug">{pr.title}</h2>
        </div>

        <div className="mb-4 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <Badge variant="secondary">#{pr.number}</Badge>
          <StateBadge pr={pr} />
          <span>{pr.author.login}</span>
        </div>

        <div className="mb-4 text-xs text-muted-foreground">
          <code>{pr.base.ref}</code> ← <code>{pr.head.ref}</code>
        </div>

        {pr.labels.length > 0 && (
          <div className="mb-1 flex flex-wrap gap-1.5">
            {pr.labels.map((label) => (
              <LabelChip key={label.name} label={label} />
            ))}
          </div>
        )}

        <a
          href={pr.url}
          target="_blank"
          rel="noreferrer"
          className={cn(buttonVariants({ variant: "outline", size: "sm" }), "mt-3")}
        >
          <ExternalLink className="mr-1 h-3.5 w-3.5" />
          Open on GitHub
        </a>
      </div>

      <CollapsibleSection title="Description" className="border-t" fill>
        <div className="h-full overflow-y-auto">
          <Description body={pr.body} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Commits" className="border-t" fill>
        <div className="h-full overflow-y-auto">
          <PrCommits owner={pr.owner} repo={pr.repo} number={pr.number} />
        </div>
      </CollapsibleSection>

      <CollapsibleSection title="Comments" className="border-t" fill>
        <div className="h-full overflow-y-auto">
          <PrComments owner={pr.owner} repo={pr.repo} number={pr.number} />
        </div>
      </CollapsibleSection>
    </div>
  );
}

function StateBadge({ pr }: { pr: PullRequest }) {
  if (pr.merged) return <Badge className="bg-purple-500/15 text-purple-400">Merged</Badge>;
  if (pr.state === "closed")
    return <Badge className="bg-red-500/15 text-red-400">Closed</Badge>;
  return <Badge className="bg-emerald-500/15 text-emerald-400">Open</Badge>;
}

function LabelChip({ label }: { label: Label }) {
  return (
    <span
      className="rounded-full border px-2 py-0.5 text-[11px]"
      style={{ borderColor: `#${label.color}`, color: `#${label.color}` }}
    >
      {label.name}
    </span>
  );
}

function Description({ body }: { body: string }) {
  if (!body.trim()) {
    return (
      <p className="px-4 py-3 text-xs text-muted-foreground/70">No description.</p>
    );
  }
  return (
    <div className="px-4 py-3 text-sm">
      <Markdown>{body}</Markdown>
    </div>
  );
}
