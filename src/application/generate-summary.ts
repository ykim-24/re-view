import "server-only";

/**
 * A persisted, well-sectioned overview of what a PR or branch comparison does,
 * with clickable source citations, plus an audit section flagging what's worth
 * checking. Streams the same InsightEvent protocol as the auto review, then saves
 * the result keyed by target and tagged with the head sha it reflects. "update"
 * mode feeds the previous summary plus only the commits since it was written, so
 * a moved head refreshes cheaply instead of regenerating from scratch.
 */

import { anthropic } from "@/infrastructure/anthropic/client";
import { getPullRequest } from "@/infrastructure/github/pull-request.repository";
import { compareRefs } from "@/infrastructure/github/branch.repository";
import {
  gatherFileBodies,
  gatherDefinitions,
  type FileBody,
  type RelatedDefinition,
  type Log,
} from "./change-context";
import { summaryKey, type SummaryTarget } from "@/lib/pr-key";
import { getSummary, upsertSummary } from "@/infrastructure/db/summary.repository";
import type { FileChange } from "@/domain/pull-request/models";
import type { InsightEvent } from "@/domain/insight/events";

const MODEL = "claude-opus-4-8";

const SYSTEM_PROMPT = `You are a senior engineer writing a briefing that helps a reviewer understand a set of changes fast. You're given the change's title/description, each changed file (its diff plus its full current content), and the definitions of symbols the diff references (resolved from a repo-wide index).

Write markdown, verbose but skimmable, using these sections and headings exactly:

## Overview
One tight paragraph: what this change set does and the intent behind it.

## Key changes
Grouped by feature/area (not necessarily one bullet per file). Each bullet says what changed and why it matters. Cite the code it comes from.

## How it works
Walk the notable logic and data flow across the files — how the pieces connect end to end. Cite as you go.

## Notable files
The handful of files that matter most, one line each on its role. Cite each.

## Audit — worth checking
A reasonably thorough list of things a reviewer should look at closely: likely bugs, risky edge cases, unhandled cases, destructive migrations, security/permission concerns, TODOs, anything surprising or inconsistent. Tag each with \`high\` / \`med\` / \`low\`. This is not a full line-by-line review — it flags what deserves a closer look. If you genuinely find nothing notable, say so briefly.

CITATIONS — this is important. Whenever you reference code, link to it so the reader can click straight to it. Use a markdown link with a \`source:\` href:
- \`[label](source:path/to/file.ts#L42)\` for a line
- \`[label](source:path/to/file.ts#L42-L60)\` for a range
- \`[label](source:path/to/file.ts)\` when no specific line
Only cite files that appear under a "###" heading in the Changed files list below (those are the ones the reader can open) — use their EXACT path, and pick line numbers from that file's current content. For a referenced definition that is NOT a changed file, mention it by name in \`inline code\` without a source link. Cite generously — every concrete claim in Key changes, How it works, Notable files, and Audit should carry at least one source link. Keep the link label short (a filename, symbol, or a few words).

Be specific and grounded in the provided code.`;

interface DiffSource {
  title: string;
  description: string;
  headSha: string;
  contextLine: string;
  files: FileChange[];
}

async function loadDiffSource(target: SummaryTarget): Promise<DiffSource> {
  if (target.kind === "pr") {
    const { pr, files } = await getPullRequest(
      target.owner,
      target.repo,
      target.number,
    );
    return {
      title: `PR #${pr.number}: ${pr.title}`,
      description: pr.body,
      headSha: pr.head.sha,
      contextLine: `base \`${pr.base.ref}\` ← head \`${pr.head.ref}\``,
      files,
    };
  }
  const cmp = await compareRefs(
    target.owner,
    target.repo,
    target.base,
    target.head,
  );
  return {
    title: `${target.base}...${target.head}`,
    description: "",
    headSha: cmp.head.sha,
    contextLine: `comparing base \`${target.base}\` ← head \`${target.head}\` (${cmp.aheadBy} ahead, ${cmp.behindBy} behind)`,
    files: cmp.files,
  };
}

function renderContext(bodies: FileBody[], related: RelatedDefinition[]): string {
  let out = `Changed files (${bodies.length}):\n`;
  for (const file of bodies) {
    out += `\n### ${file.path} (${file.status}, +${file.additions}/-${file.deletions})\n`;
    if (file.patch) out += `Diff:\n\`\`\`diff\n${file.patch}\n\`\`\`\n`;
    if (file.content) out += `Current file:\n\`\`\`\n${file.content}\n\`\`\`\n`;
  }
  if (related.length > 0) {
    out += `\nReferenced definitions (resolved from the repo index):\n`;
    for (const def of related) {
      out += `\n— \`${def.name}\` (${def.path}:${def.line})\n\`\`\`\n${def.snippet}\n\`\`\`\n`;
    }
  }
  return out;
}

function buildGeneratePrompt(
  source: DiffSource,
  bodies: FileBody[],
  related: RelatedDefinition[],
): string {
  let prompt = `${source.title}\n${source.contextLine}\n`;
  if (source.description.trim()) {
    prompt += `\nDescription:\n${source.description}\n`;
  }
  prompt += `\n${renderContext(bodies, related)}`;
  return prompt;
}

function buildUpdatePrompt(
  source: DiffSource,
  previous: string,
  bodies: FileBody[],
  related: RelatedDefinition[],
): string {
  return (
    `${source.title}\n${source.contextLine}\n\n` +
    `An earlier summary of this change set is below. Since it was written, new commits landed — their incremental diff and context follow. Update the summary so it reflects the current state: keep accurate existing content and the section structure, revise what changed, and refresh the "Audit — worth checking" section. Output the COMPLETE updated summary (all sections), not just a delta.\n\n` +
    `=== EXISTING SUMMARY ===\n${previous}\n\n` +
    `=== NEW CHANGES SINCE THEN ===\n${renderContext(bodies, related)}`
  );
}

export function generateSummaryStream(
  target: SummaryTarget,
  mode: "generate" | "update",
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const { owner, repo } = target;
  const key = summaryKey(target);

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: InsightEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const log: Log = (message) => send({ type: "log", message });

      try {
        send({
          type: "plan",
          steps: [
            { id: "read", label: "Reading changes" },
            { id: "deps", label: "Resolving referenced definitions" },
            { id: "write", label: mode === "update" ? "Updating summary" : "Writing summary" },
          ],
        });

        send({ type: "step_start", id: "read", label: "Reading changes" });
        const source = await loadDiffSource(target);

        const existing = mode === "update" ? getSummary(key) : null;
        let contextFiles = source.files;
        if (existing && existing.headSha !== source.headSha) {
          log(`Diffing ${existing.headSha.slice(0, 7)}…${source.headSha.slice(0, 7)}`);
          const delta = await compareRefs(
            owner,
            repo,
            existing.headSha,
            source.headSha,
          ).catch(() => null);
          if (delta && delta.files.length > 0) contextFiles = delta.files;
        }

        const bodies = await gatherFileBodies(
          owner,
          repo,
          source.headSha,
          contextFiles,
          log,
        );
        send({ type: "step_end", id: "read" });

        send({ type: "step_start", id: "deps", label: "Resolving referenced definitions" });
        const related = await gatherDefinitions(owner, repo, contextFiles, log);
        send({ type: "step_end", id: "deps" });

        send({
          type: "files",
          files: [
            ...bodies.map((b) => ({ path: b.path, reason: b.status })),
            ...related.map((r) => ({ path: r.path, reason: `defines ${r.name}` })),
          ],
        });

        const useUpdate = mode === "update" && existing !== null;
        const prompt = useUpdate
          ? buildUpdatePrompt(source, existing!.content, bodies, related)
          : buildGeneratePrompt(source, bodies, related);

        send({
          type: "step_start",
          id: "write",
          label: useUpdate ? "Updating summary" : "Writing summary",
        });
        let full = "";
        const stream = anthropic().messages.stream({
          model: MODEL,
          max_tokens: 20000,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content: prompt }],
        });
        stream.on("text", (delta) => {
          full += delta;
          send({ type: "token", text: delta });
        });
        await stream.finalMessage();
        send({ type: "step_end", id: "write" });

        if (full.trim()) {
          upsertSummary({
            key,
            kind: target.kind,
            owner,
            repo,
            headSha: source.headSha,
            content: full,
            model: MODEL,
          });
        }

        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Summary failed.";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}
