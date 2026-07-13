"use client";

/**
 * Left column of the workspace, with Files / Details tabs. Files shows the
 * changed-file tree plus the per-file changes list; Details shows the PR summary.
 */

import { useRef, useState } from "react";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import { cn } from "@/lib/utils";
import { DependencyTree } from "@/features/dependency-tree/DependencyTree";
import { ChangesPanel } from "@/features/changes-list/ChangesPanel";
import { PrSummary } from "./PrSummary";
import type { FileChange, PullRequest } from "@/domain/pull-request/models";

type LeftTab = "files" | "details";

const TABS: { value: LeftTab; label: string }[] = [
  { value: "files", label: "Files" },
  { value: "details", label: "Details" },
];

interface LeftPanelProps {
  owner: string;
  repo: string;
  pr: PullRequest;
  files: FileChange[];
  selectedFile: FileChange | null;
}

export function LeftPanel({
  owner,
  repo,
  pr,
  files,
  selectedFile,
}: LeftPanelProps) {
  const [tab, setTab] = useState<LeftTab>("files");
  const activeIndex = TABS.findIndex((t) => t.value === tab);
  const indicatorRef = useRef<HTMLSpanElement | null>(null);

  useGSAP(
    () => {
      if (!indicatorRef.current) return;
      gsap.to(indicatorRef.current, {
        xPercent: activeIndex * 100,
        duration: 0.3,
        ease: "power3.out",
      });
    },
    { dependencies: [activeIndex] },
  );

  return (
    <div className="flex h-full flex-col">
      <div className="relative flex shrink-0 border-b py-0.75">
        {TABS.map((t) => (
          <TabButton
            key={t.value}
            tab={t}
            active={tab === t.value}
            onSelect={setTab}
          />
        ))}
        <span
          ref={indicatorRef}
          className="absolute bottom-0 left-0 h-0.5 bg-foreground"
          style={{ width: `${100 / TABS.length}%` }}
        />
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {tab === "files" && (
          <FilesTab
            owner={owner}
            repo={repo}
            pr={pr}
            files={files}
            selectedFile={selectedFile}
          />
        )}
        {tab === "details" && <PrSummary pr={pr} />}
      </div>
    </div>
  );
}

interface TabButtonProps {
  tab: { value: LeftTab; label: string };
  active: boolean;
  onSelect(value: LeftTab): void;
}

function TabButton({ tab, active, onSelect }: TabButtonProps) {
  const handleClick = () => onSelect(tab.value);
  return (
    <button
      onClick={handleClick}
      className={cn(
        "flex flex-1 items-center justify-center px-3 py-2 text-xs font-medium transition-colors",
        active && "text-foreground",
        !active && "text-muted-foreground hover:text-foreground",
      )}
    >
      {tab.label}
    </button>
  );
}

function FilesTab({ owner, repo, pr, files, selectedFile }: LeftPanelProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <DependencyTree
        owner={owner}
        repo={repo}
        headRef={pr.head.sha}
        files={files}
      />
      <ChangesPanel file={selectedFile} />
    </div>
  );
}
