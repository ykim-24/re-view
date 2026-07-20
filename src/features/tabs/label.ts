/** Derives a tab label from an app href: repo name, plus the PR/branch if on one. */

export function tabLabel(href: string): string {
  const [path, query = ""] = href.split("?");
  const parts = path.split("/").filter(Boolean);

  if (parts.length === 0) return "New tab";

  if (parts[0] === "repo") {
    const repo = parts[2] ?? "repo";
    if (parts[3] === "compare") {
      const head = new URLSearchParams(query).get("head");
      return head ? `${repo}/${head}` : `${repo}/compare`;
    }
    return repo;
  }

  if (parts[0] === "pr") {
    return `${parts[2] ?? "repo"}/#${parts[3] ?? ""}`;
  }

  if (parts[0] === "integrations") return "integrations";

  return path;
}
