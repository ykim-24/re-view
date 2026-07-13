"use client";

/**
 * Repo landing chooser: pick whether to review the repo's pull requests or to
 * compare branches. Two large cards with the same staggered entrance the PR
 * grid uses.
 */

import { useEffect, useRef } from "react";
import Link from "next/link";
import { gsap } from "gsap";
import { useGSAP } from "@gsap/react";
import {
  ArrowLeft,
  ExternalLink,
  GitPullRequest,
  GitBranch,
  type LucideIcon,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { useRepoActions } from "@/hooks/useSavedRepos";

interface RepoHomeProps {
  owner: string;
  repo: string;
}

interface ChoiceDescriptor {
  href: string;
  Icon: LucideIcon;
  title: string;
  description: string;
  accent: string;
}

export function RepoHome({ owner, repo }: RepoHomeProps) {
  const { saveRepo } = useRepoActions();
  useEffect(() => {
    saveRepo(owner, repo);
  }, [owner, repo, saveRepo]);

  const gridRef = useRef<HTMLDivElement | null>(null);
  useGSAP(
    () => {
      const el = gridRef.current;
      if (!el) return;
      gsap.from(el.querySelectorAll("[data-pr-card]"), {
        opacity: 0,
        scale: 0.94,
        duration: 0.35,
        ease: "power2.out",
        stagger: 0.06,
        overwrite: "auto",
      });
    },
    { dependencies: [] },
  );

  const choices: ChoiceDescriptor[] = [
    {
      href: `/repo/${owner}/${repo}/pulls`,
      Icon: GitPullRequest,
      title: "Pull requests",
      description: "Review open and past PRs with inline comments and auto review.",
      accent: "group-hover:text-emerald-400",
    },
    {
      href: `/repo/${owner}/${repo}/branches`,
      Icon: GitBranch,
      title: "Branches",
      description: "Check out any branch and compare it against another.",
      accent: "group-hover:text-sky-400",
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center gap-3 border-b px-4 py-2.5">
        <Tooltip content="Home">
          <Link
            href="/"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Tooltip>
        <div className="min-w-0">
          <div className="truncate font-medium">
            {owner}/{repo}
          </div>
          <div className="text-xs text-muted-foreground">What do you want to review?</div>
        </div>
        <Tooltip content="Open on GitHub" className="ml-auto flex">
          <a
            href={`https://github.com/${owner}/${repo}`}
            target="_blank"
            rel="noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
        </Tooltip>
      </header>

      <div className="flex min-h-0 flex-1 items-center overflow-y-auto px-6 py-16">
        <div
          ref={gridRef}
          className="mx-auto grid w-full max-w-3xl grid-cols-1 gap-4 sm:grid-cols-2"
        >
          {choices.map((choice) => (
            <ChoiceCard key={choice.href} choice={choice} />
          ))}
        </div>
      </div>
    </div>
  );
}

function ChoiceCard({ choice }: { choice: ChoiceDescriptor }) {
  const { href, Icon, title, description, accent } = choice;
  return (
    <Link
      data-pr-card="true"
      href={href}
      className="group flex h-56 flex-col justify-between rounded-xl border bg-card p-5 transition-colors hover:border-primary/50 hover:bg-muted/50"
    >
      <Icon className={cn("h-8 w-8 text-muted-foreground transition-colors", accent)} />
      <div>
        <div className="text-xl font-semibold tracking-tight">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
    </Link>
  );
}
