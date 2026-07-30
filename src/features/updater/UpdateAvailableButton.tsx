"use client";

/**
 * Global update affordance that lives in the tab strip, so it surfaces at the
 * top of every page whenever the local checkout is behind the remote. Clicking
 * it (re)opens the update modal — the persistent way back to an update the user
 * dismissed with "Not now" (the auto-prompt fires at most once per sha).
 */

import { ArrowUpCircle } from "lucide-react";
import { Tooltip } from "@/components/Tooltip";
import { useVersionCheck } from "@/hooks/useVersionCheck";
import { openModal } from "@/features/modal";

function behindLabel(behind: number): string {
  if (behind === 1) return "1 commit behind";
  return `${behind} commits behind`;
}

export function UpdateAvailableButton() {
  const { data } = useVersionCheck();

  if (!data?.updateAvailable) return null;

  const handleClick = () => openModal({ type: "update", status: data });

  return (
    <div className="ml-auto flex shrink-0 items-center pr-2">
      <Tooltip content={`Update available · ${behindLabel(data.behind)}`}>
        <button
          onClick={handleClick}
          className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium text-amber-400 transition-colors hover:bg-amber-400/10 hover:text-amber-300"
        >
          <ArrowUpCircle className="h-3.5 w-3.5" />
          Update
        </button>
      </Tooltip>
    </div>
  );
}
