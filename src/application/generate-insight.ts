import "server-only";

/**
 * Stepped "insight" pipeline. Rather than letting the model burn tokens
 * searching, we deterministically gather context first — read the selection's
 * file, resolve the symbols it references by following imports, optionally take a
 * second hop ("go deeper"), and count usages — then hand it all to Claude to
 * analyze. Progress (steps, logs, the gathered file tree, and the streamed
 * answer) is emitted as newline-delimited JSON so the UI can show the work live.
 */

import { anthropic } from "@/infrastructure/anthropic/client";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import {
  resolveDefinition,
  type RelatedDefinition,
} from "./insight-context";
import {
  countOccurrences,
  extractIdentifiers,
  windowFile,
} from "@/domain/insight/gather";
import type {
  GatheredFile,
  InsightEvent,
  StepPlanEntry,
} from "@/domain/insight/events";

export interface InsightInput {
  owner: string;
  repo: string;
  headRef: string;
  path: string;
  startLine: number;
  endLine: number;
  selectedText: string;
  deep?: boolean;
  whole?: boolean;
}

const SYSTEM_PROMPT = `You are a senior engineer giving a code reviewer a fast, high-signal insight about a snippet from a pull request. The relevant context has already been gathered for you: the selection's surrounding file, the resolved definitions of the symbols it references (followed through imports), and how often those symbols are used. Analyze from what you've been given — do NOT ask for more context or say you'd need to see more.

Respond in markdown with these sections:
- **What it does** — 1–3 sentences. If the selection is sizable or non-obvious, add a short fenced code excerpt (\`\`\`ts) of the key lines.
- **How it connects** — how the selection uses the resolved definitions; reference the specific files by path as inline code (e.g. \`domains/foo/bar.ts\`) and call out the cross-file links.
- **Watch for** — concrete risks, edge cases, or likely bugs. Omit entirely if there are genuinely none.

Only reference files and symbols present in the provided context. Be specific and grounded. Keep it tight — a reviewer is skimming.`;

function buildAnalysisPrompt(
  input: InsightInput,
  fileExcerpt: string | null,
  related: RelatedDefinition[],
  usage: string[],
): string {
  let prompt = `File: ${input.path} (selection: lines ${input.startLine}–${input.endLine})\n\nSelected code:\n\`\`\`\n${input.selectedText}\n\`\`\`\n`;
  if (fileExcerpt) {
    prompt += `\nSurrounding file (full call site and imports):\n\`\`\`\n${fileExcerpt}\n\`\`\`\n`;
  }
  if (related.length > 0) {
    prompt += `\nResolved definitions the selection references:\n`;
    for (const def of related) {
      prompt += `\n— \`${def.name}\` (${def.path}:${def.line})\n\`\`\`\n${def.snippet}\n\`\`\`\n`;
    }
  }
  if (usage.length > 0) {
    prompt += `\nUsage across the gathered code:\n${usage.map((u) => `- ${u}`).join("\n")}\n`;
  }
  return prompt;
}

export function generateInsightStream(
  input: InsightInput,
): ReadableStream<Uint8Array> {
  const deep = Boolean(input.deep);
  const maxIdentifiers = deep ? 12 : 8;
  const maxRelated = deep ? 10 : 6;
  const target = {
    owner: input.owner,
    repo: input.repo,
    ref: input.headRef,
  };

  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: InsightEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const plan: StepPlanEntry[] = [
          { id: "read", label: "Reading file" },
          { id: "deps", label: "Resolving dependencies" },
        ];
        if (deep) plan.push({ id: "deepen", label: "Following second hop" });
        plan.push({ id: "usage", label: "Mapping usages" });
        plan.push({ id: "analyze", label: "Analyzing" });
        send({ type: "plan", steps: plan });

        const related: RelatedDefinition[] = [];
        const seen = new Set<string>();
        const add = (def: RelatedDefinition) => {
          const key = `${def.path}:${def.line}`;
          if (seen.has(key) || related.length >= maxRelated) return;
          seen.add(key);
          related.push(def);
        };

        send({ type: "step_start", id: "read", label: "Reading file" });
        const full = await getFileContent(
          input.owner,
          input.repo,
          input.path,
          input.headRef,
        ).catch(() => null);
        send({
          type: "log",
          message: full
            ? `Read ${input.path} (${full.split("\n").length} lines)`
            : `Could not read ${input.path}`,
        });
        send({ type: "step_end", id: "read" });

        const whole = Boolean(input.whole) && full !== null;
        const source = whole && full ? full : input.selectedText;

        send({ type: "step_start", id: "deps", label: "Resolving dependencies" });
        const idents = extractIdentifiers(source).slice(0, maxIdentifiers);
        for (const name of idents) {
          const { def, log } = await resolveDefinition(target, input.path, name, deep);
          if (log) send({ type: "log", message: log });
          if (def) add(def);
        }
        send({ type: "step_end", id: "deps" });

        if (deep) {
          send({ type: "step_start", id: "deepen", label: "Following second hop" });
          const firstHop = [...related];
          for (const parent of firstHop.slice(0, 4)) {
            if (related.length >= maxRelated) break;
            const names = extractIdentifiers(parent.snippet).slice(0, 6);
            for (const name of names) {
              if (related.length >= maxRelated) break;
              const { def } = await resolveDefinition(target, parent.path, name, true);
              if (def) {
                add(def);
                send({ type: "log", message: `Resolved \`${name}\` → ${def.path}:${def.line}` });
              }
            }
          }
          if (related.length === firstHop.length) {
            send({ type: "log", message: "No further definitions found" });
          }
          send({ type: "step_end", id: "deepen" });
        }

        send({ type: "step_start", id: "usage", label: "Mapping usages" });
        const corpus = [full ?? input.selectedText, ...related.map((r) => r.snippet)];
        const usage: string[] = [];
        for (const def of related) {
          const count = countOccurrences(def.name, corpus);
          usage.push(`\`${def.name}\` referenced ${count}×`);
          send({
            type: "log",
            message: `\`${def.name}\` referenced ${count}× in gathered files`,
          });
        }
        if (related.length === 0) {
          send({ type: "log", message: "No external symbols to map" });
        }
        send({ type: "step_end", id: "usage" });

        const files: GatheredFile[] = [
          { path: input.path, reason: whole ? "whole file" : "selection" },
          ...related.map((r) => ({ path: r.path, reason: `defines ${r.name}` })),
        ];
        send({ type: "files", files });

        send({ type: "step_start", id: "analyze", label: "Analyzing" });
        let promptInput = input;
        let fileExcerpt: string | null = null;
        if (whole && full) {
          const lineCount = full.split("\n").length;
          promptInput = {
            ...input,
            selectedText: windowFile(full, 1, lineCount),
            startLine: 1,
            endLine: lineCount,
          };
        } else if (full) {
          fileExcerpt = windowFile(full, input.startLine, input.endLine);
        }
        const stream = anthropic().messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: buildAnalysisPrompt(promptInput, fileExcerpt, related, usage),
            },
          ],
        });
        stream.on("text", (delta) => send({ type: "token", text: delta }));
        await stream.finalMessage();
        send({ type: "step_end", id: "analyze" });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Insight failed.";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}
