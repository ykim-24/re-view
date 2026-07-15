"use client";

/**
 * The "update available" modal. Shows the local → remote version jump and applies
 * the update in place (git fast-forward + npm install when deps changed). On a
 * code-only update it offers a reload; when dependencies changed it asks for a
 * dev-server restart. "Not now" remembers the sha so it won't nag until the next.
 */

import { Download, RefreshCw, RotateCw } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { openModal } from "@/features/modal";
import { DISMISSED_UPDATE_KEY, useApplyUpdate } from "@/hooks/useVersionCheck";
import type { ModalDescriptor } from "@/features/modal/types";
import type { VersionStatus } from "@/domain/system/version";

interface UpdateModalProps {
  active: ModalDescriptor | null;
  onOpenChange(open: boolean): void;
}

export function UpdateModal({ active, onOpenChange }: UpdateModalProps) {
  const data = active?.type === "update" ? active : null;
  const handleClose = () => onOpenChange(false);

  return (
    <Dialog open={data !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Update available</DialogTitle>
          <DialogDescription>A newer version of re:view is ready to install.</DialogDescription>
        </DialogHeader>
        {data && (
          <UpdateBody key={data.status.latestSha} status={data.status} onClose={handleClose} />
        )}
      </DialogContent>
    </Dialog>
  );
}

interface UpdateBodyProps {
  status: VersionStatus;
  onClose(): void;
}

function UpdateBody({ status, onClose }: UpdateBodyProps) {
  const update = useApplyUpdate();

  const handleUpdate = () => update.mutate();
  const handleReload = () => window.location.reload();
  const handleChangelog = () => openModal({ type: "changelog" });
  const handleDismiss = () => {
    localStorage.setItem(DISMISSED_UPDATE_KEY, status.latestSha);
    onClose();
  };

  if (update.isSuccess && update.data.needsRestart) {
    return (
      <Result
        tone="restart"
        message="Update applied. Restart the dev server (npm run dev) to load the new dependencies."
        actionLabel="Close"
        onAction={onClose}
      />
    );
  }

  if (update.isSuccess) {
    return (
      <Result
        tone="reload"
        message="Updated to the latest version. Reload to see the changes."
        actionLabel="Reload"
        onAction={handleReload}
      />
    );
  }

  if (update.isPending) {
    return (
      <div className="flex items-center justify-center gap-3 py-6 text-sm text-muted-foreground">
        <Loader size="sm" /> Updating…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <VersionSummary status={status} />
      {update.isError && (
        <p className="rounded-md border border-destructive/40 bg-destructive/10 p-2 text-xs text-destructive">
          {update.error.message}
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <button
          onClick={handleChangelog}
          className="text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          What&apos;s new
        </button>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleDismiss}>
            Not now
          </Button>
          <Button onClick={handleUpdate} className="gap-1.5">
            <Download className="h-4 w-4" />
            Update now
          </Button>
        </div>
      </div>
    </div>
  );
}

function VersionSummary({ status }: { status: VersionStatus }) {
  const bumped = status.currentVersion !== status.latestVersion;
  return (
    <div className="space-y-2 text-sm">
      {bumped && (
        <div className="flex items-center gap-2 font-mono">
          <span className="text-muted-foreground">v{status.currentVersion}</span>
          <span className="text-muted-foreground">→</span>
          <span className="font-medium text-emerald-400">v{status.latestVersion}</span>
        </div>
      )}
      <p className="text-muted-foreground">
        {status.behind} new commit{status.behind === 1 ? "" : "s"} on the remote.
      </p>
    </div>
  );
}

interface ResultProps {
  tone: "reload" | "restart";
  message: string;
  actionLabel: string;
  onAction(): void;
}

function Result({ tone, message, actionLabel, onAction }: ResultProps) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">{message}</p>
      <div className="flex justify-end">
        <Button onClick={onAction} className="gap-1.5">
          <ResultIcon tone={tone} />
          {actionLabel}
        </Button>
      </div>
    </div>
  );
}

function ResultIcon({ tone }: { tone: "reload" | "restart" }) {
  if (tone === "reload") return <RotateCw className="h-4 w-4" />;
  return <RefreshCw className="h-4 w-4" />;
}
