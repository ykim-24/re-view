"use client";

/** Shown behind the error modal when a PR fails to load; offers retry / back. */

import Link from "next/link";
import { RefreshCw } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";

interface WorkspaceLoadErrorProps {
  onRetry(): void;
  retrying: boolean;
}

export function WorkspaceLoadError({ onRetry, retrying }: WorkspaceLoadErrorProps) {
  const handleRetry = () => onRetry();

  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm text-muted-foreground">
        This pull request couldn’t be loaded.
      </p>
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handleRetry} disabled={retrying}>
          <RetryIcon retrying={retrying} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
        <Link href="/" className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
          Back
        </Link>
      </div>
    </div>
  );
}

function RetryIcon({ retrying }: { retrying: boolean }) {
  if (retrying) return <Loader size="sm" className="mr-1" />;
  return <RefreshCw className="mr-1 h-3.5 w-3.5" />;
}
