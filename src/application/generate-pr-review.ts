import "server-only";

/**
 * PR-wide "auto review" with code context. Beyond the diff hunks, it hands Claude
 * the full content of each changed file and the definitions of the symbols the
 * diff references (resolved through the repo index) — so the review understands
 * what the change depends on, not just the changed lines. One streamed call.
 */

import { anthropic } from "@/infrastructure/anthropic/client";
import { getPullRequest } from "@/infrastructure/github/pull-request.repository";
import {
  gatherFileBodies,
  gatherDefinitions,
  type FileBody,
  type RelatedDefinition,
  type Log,
} from "./change-context";
import type { PullRequest } from "@/domain/pull-request/models";
import type { InsightEvent } from "@/domain/insight/events";

const SYSTEM_PROMPT = `You are a senior engineer doing a focused pull-request review. You're given the PR description, each changed file (its diff plus its full current content), and the definitions of symbols the diff references (resolved from a repo-wide index — code the diff depends on but doesn't show).

Respond in markdown:
- **Summary** — 2–3 sentences on what the PR does.
- **Findings** — grouped by file (use the path as an inline-code subheading). Each finding is a bullet tagged with severity (\`high\` / \`med\` / \`low\`): bugs, risks, edge cases, and concrete suggestions, referencing the relevant lines or symbols. Use the full-file and resolved-definition context to catch cross-file issues (a changed call that no longer matches its definition, a missed caller, an unhandled return shape). Prioritize real correctness/safety issues over style nits.
- **Verdict** — one line: approve, or what must change first.

Be specific and grounded in the provided code. Keep it skimmable.`;

function buildPrompt(
  pr: PullRequest,
  bodies: FileBody[],
  related: RelatedDefinition[],
): string {
  let prompt = `PR #${pr.number}: ${pr.title}\n`;
  if (pr.body.trim()) prompt += `\nDescription:\n${pr.body}\n`;
  prompt += `\nChanged files (${bodies.length}):\n`;
  for (const file of bodies) {
    prompt += `\n### ${file.path} (${file.status}, +${file.additions}/-${file.deletions})\n`;
    if (file.patch) prompt += `Diff:\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;
    if (file.content) prompt += `Current file:\n\`\`\`\n${file.content}\n\`\`\`\n`;
  }
  if (related.length > 0) {
    prompt += `\nReferenced definitions (resolved from the repo index):\n`;
    for (const def of related) {
      prompt += `\n— \`${def.name}\` (${def.path}:${def.line})\n\`\`\`\n${def.snippet}\n\`\`\`\n`;
    }
  }
  return prompt;
}

export function generatePrReviewStream(
  owner: string,
  repo: string,
  number: number,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: InsightEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const log: Log = (message) => send({ type: "log", message });
      try {
        send({
          type: "plan",
          steps: [
            { id: "read", label: "Reading changed files" },
            { id: "deps", label: "Resolving referenced definitions" },
            { id: "review", label: "Reviewing" },
          ],
        });

        send({ type: "step_start", id: "read", label: "Reading changed files" });
        const { pr, files } = await getPullRequest(owner, repo, number);
        const bodies = await gatherFileBodies(owner, repo, pr.head.sha, files, log);
        send({ type: "step_end", id: "read" });

        send({ type: "step_start", id: "deps", label: "Resolving referenced definitions" });
        const related = await gatherDefinitions(owner, repo, files, log);
        send({ type: "step_end", id: "deps" });

        send({
          type: "files",
          files: [
            ...bodies.map((b) => ({ path: b.path, reason: b.status })),
            ...related.map((r) => ({ path: r.path, reason: `defines ${r.name}` })),
          ],
        });

        send({ type: "step_start", id: "review", label: "Reviewing" });
        const stream = anthropic().messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 16000,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: buildPrompt(pr, bodies, related) }],
        });
        stream.on("text", (delta) => send({ type: "token", text: delta }));
        await stream.finalMessage();
        send({ type: "step_end", id: "review" });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Review failed.";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}
