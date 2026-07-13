"use client";

/** Placeholder chrome shown while a pull request's data loads. */

import { Skeleton } from "@/components/ui/skeleton";
import { Loader } from "@/components/Loader";

export function WorkspaceSkeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Skeleton className="h-8 w-8 rounded-md" />
        <Skeleton className="h-5 w-5 rounded-full" />
        <div className="space-y-1.5">
          <Skeleton className="h-4 w-64" />
          <Skeleton className="h-3 w-40" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="flex w-[22%] items-center justify-center border-r">
          <Loader label="Loading files…" />
        </div>
        <div className="flex flex-1 items-center justify-center">
          <Loader label="Loading diff…" />
        </div>
      </div>
    </div>
  );
}
