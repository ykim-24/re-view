"use client";

/**
 * Keeps the chat store's scope in sync with the route, so a question asked from
 * anywhere knows which repo (and PR) is on screen. The workspace layers the head
 * ref and the open file on top of this via `setScope` once the PR has loaded —
 * this hook only fills in what the URL alone can tell us, and re-runs on
 * navigation so leaving a repo clears the scope. Navigating to a view without code
 * also closes the chat, since the launcher is not offered there.
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useChatStore } from "./chat.store";
import { scopeHasCode, type ChatScope } from "@/domain/chat/models";

function parseRoute(pathname: string): ChatScope {
  const parts = pathname.split("/").filter(Boolean);
  const [section, owner, repo, ...rest] = parts;

  if (section === "pr" && owner && repo && rest[0]) {
    const number = Number(rest[0]);
    if (Number.isFinite(number)) {
      return {
        kind: "pr",
        label: `pull request ${owner}/${repo}#${number}`,
        route: pathname,
        owner,
        repo,
        number,
      };
    }
  }
  if (section === "repo" && owner && repo && rest[0] === "compare") {
    return {
      kind: "compare",
      label: `a branch comparison in ${owner}/${repo}`,
      route: pathname,
      owner,
      repo,
    };
  }
  if (section === "repo" && owner && repo) {
    const page = rest[0] ?? "overview";
    return {
      kind: "other",
      label: `${owner}/${repo} (${page})`,
      route: pathname,
      owner,
      repo,
    };
  }
  if (section === "integrations") {
    return { kind: "other", label: "the integrations page", route: pathname };
  }
  return { kind: "other", label: "the re:view home dashboard", route: pathname };
}

export function useChatScope() {
  const pathname = usePathname();

  useEffect(() => {
    const scope = parseRoute(pathname);
    const { setScope, close } = useChatStore.getState();
    setScope(scope);
    if (!scopeHasCode(scope)) close();
  }, [pathname]);
}
