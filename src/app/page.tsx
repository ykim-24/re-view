"use client";

/** Home: add a repo (or jump to a PR) and pick from your saved repos. */

import { useState, type ChangeEvent, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Sparkles, Plug } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parsePrInput, parseRepoInput } from "@/lib/github-url";
import { SavedRepos } from "@/features/dashboard/SavedRepos";
import { openModal } from "@/features/modal";

export default function Home() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleWhatsNew = () => openModal({ type: "changelog" });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    setError(null);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const pr = parsePrInput(value);
    if (pr) {
      router.push(`/pr/${pr.owner}/${pr.repo}/${pr.number}`);
      return;
    }
    const repo = parseRepoInput(value);
    if (repo) {
      router.push(`/repo/${repo.owner}/${repo.repo}`);
      return;
    }
    setError("Enter a repo (owner/repo) or a PR (owner/repo#123)");
  };

  return (
    <main className="flex-1 overflow-y-auto px-6 pb-16 pt-32">
      <div className="mx-auto w-full max-w-3xl">
        <div className="relative inline-block">
          <h1 className="text-3xl font-semibold tracking-tight">re:view</h1>
        </div>
        <p className="mt-2 text-muted-foreground">
          Add a repository to review its pull requests.
        </p>
        <div className="mt-3 flex items-center gap-4">
          <button
            onClick={handleWhatsNew}
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Sparkles className="h-3.5 w-3.5 text-sky-400" />
            What&apos;s new
          </button>
          <Link
            href="/integrations"
            className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <Plug className="h-3.5 w-3.5 text-emerald-400" />
            Integrations
          </Link>
        </div>

        <form onSubmit={handleSubmit} className="mt-8 flex gap-2">
          <Input
            autoFocus
            value={value}
            onChange={handleChange}
            placeholder="enter a repo link: owner/repo"
            className="font-mono"
          />
          <Button type="submit" size="icon">
            <ArrowRight />
          </Button>
        </form>
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        <SavedRepos />
      </div>
    </main>
  );
}
