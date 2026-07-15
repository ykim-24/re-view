"use client";

/**
 * "What's new" modal — renders the latest release's notes from CHANGELOG.md as
 * markdown. Opened via openModal({ type: "changelog" }).
 */

import { Sparkles } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Markdown } from "@/components/Markdown";
import { Loader } from "@/components/Loader";
import { useChangelog } from "@/hooks/useChangelog";
import type { ModalDescriptor } from "@/features/modal/types";

interface ChangelogModalProps {
  active: ModalDescriptor | null;
  onOpenChange(open: boolean): void;
}

/** The most recent release section (first "## ..." block) of the changelog. */
function latestEntry(md: string): string {
  const start = md.indexOf("## ");
  if (start === -1) return md.trim();
  const rest = md.slice(start);
  const next = rest.indexOf("\n## ");
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

export function ChangelogModal({ active, onOpenChange }: ChangelogModalProps) {
  const open = active?.type === "changelog";
  const changelog = useChangelog();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Sparkles className="h-5 w-5 text-sky-400" />
            What&apos;s new
          </DialogTitle>
          <DialogDescription className="sr-only">
            Release notes for re:view
          </DialogDescription>
        </DialogHeader>
        <div className="rev-subtle-scroll max-h-[65vh] overflow-y-auto rounded-lg bg-tab-strip px-5 py-4 shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]">
          {open && changelog.isLoading && (
            <div className="flex items-center justify-center py-10">
              <Loader label="Loading changelog…" />
            </div>
          )}
          {open && changelog.data && (
            <Markdown className="rev-summary text-sm" allowHtml={false}>
              {latestEntry(changelog.data.content)}
            </Markdown>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
