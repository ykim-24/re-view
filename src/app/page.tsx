"use client";

/** Home: add a repo (or jump to a PR) and pick from your saved repos. */

import { useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { parsePrInput, parseRepoInput } from "@/lib/github-url";
import { SavedRepos } from "@/features/dashboard/SavedRepos";

export default function Home() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    <main className="flex-1 overflow-y-auto px-6 py-16">
      <div className="mx-auto w-full max-w-3xl">
        <h1 className="text-3xl font-semibold tracking-tight">re:view</h1>
        <p className="mt-2 text-muted-foreground">
          Add a repository to review its pull requests.
        </p>

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
