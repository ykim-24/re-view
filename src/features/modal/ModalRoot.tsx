"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useModalStore } from "./store";
import type { Artifact, ModalDescriptor } from "./types";

/**
 * Always-mounted. Each modal is toggled via its `open` prop (never conditionally
 * mounted) — same reasoning as Flow: avoids Radix leaving pointer-events stuck.
 */
export function ModalRoot() {
  const active = useModalStore((s) => s.active);
  const close = useModalStore((s) => s.close);

  const onOpenChange = (open: boolean) => {
    if (!open) close();
  };

  return (
    <>
      <ErrorModal active={active} onOpenChange={onOpenChange} />
      <ShortcutsModal active={active} onOpenChange={onOpenChange} />
      <ArtifactModal active={active} onOpenChange={onOpenChange} />
    </>
  );
}

function ArtifactModal({ active, onOpenChange }: ModalProps) {
  const data = active?.type === "artifact" ? active : null;
  return (
    <Dialog open={data !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="truncate">
            {artifactTitle(data?.artifact)}
          </DialogTitle>
          <DialogDescription className="sr-only">
            Artifact preview
          </DialogDescription>
        </DialogHeader>
        {data && <ArtifactBody artifact={data.artifact} />}
      </DialogContent>
    </Dialog>
  );
}

function artifactTitle(artifact: Artifact | undefined): string {
  if (!artifact) return "Preview";
  if (artifact.kind === "image") return artifact.alt?.trim() || "Image";
  return "Preview";
}

function ArtifactBody({ artifact }: { artifact: Artifact }) {
  if (artifact.kind === "image") {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={artifact.src}
        alt={artifact.alt ?? ""}
        className="mx-auto max-h-[75vh] w-auto rounded-md object-contain"
      />
    );
  }
  return null;
}

interface ModalProps {
  active: ModalDescriptor | null;
  onOpenChange: (open: boolean) => void;
}

function ErrorModal({ active, onOpenChange }: ModalProps) {
  const data = active?.type === "error" ? active : null;
  return (
    <Dialog open={data !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{data?.title ?? "Error"}</DialogTitle>
          <DialogDescription className="whitespace-pre-wrap wrap-break-words">
            {data?.message}
          </DialogDescription>
        </DialogHeader>
      </DialogContent>
    </Dialog>
  );
}

function ShortcutsModal({ active, onOpenChange }: ModalProps) {
  return (
    <Dialog open={active?.type === "shortcuts"} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl min-h-115 flex flex-col">
        <DialogHeader>
          <DialogTitle>Keyboard & mouse</DialogTitle>
          <DialogDescription>
            How to drive the review workspace.
          </DialogDescription>
        </DialogHeader>
        <ul className="space-y-2 text-sm text-muted-foreground">
          <li>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              ⌘ / Ctrl
            </kbd>{" "}
            + click a symbol in the diff → jump to its definition
          </li>
          <li>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              ⌘ / Ctrl + K
            </kbd>{" "}
            → comment on the selected lines (or the cursor line)
          </li>
          <li>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              ⌘ / Ctrl + Shift + P
            </kbd>{" "}
            → jump to a changed file
          </li>
          <li>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              ⌘ / Ctrl + Shift + F
            </kbd>{" "}
            → search text across changed files
          </li>
          <li>
            <kbd className="rounded bg-muted px-1.5 py-0.5 text-foreground">
              ⌘ / Ctrl + Shift + M
            </kbd>{" "}
            → mark the current file viewed, jump to the next unviewed (wraps around)
          </li>
          <li>Select lines in the diff → a Comment button appears</li>
          <li>Click a changed file in the left tree → open its diff</li>
          <li>Expand a file in the tree → see the files it imports</li>
        </ul>
      </DialogContent>
    </Dialog>
  );
}
