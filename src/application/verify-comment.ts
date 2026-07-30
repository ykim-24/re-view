import "server-only";

/**
 * Stepped "verify comment" pipeline. Given a reviewer's comment on a line of a
 * PR, we deterministically gather the code it refers to — read the commented
 * file around the anchor line and resolve the symbols there by following imports
 * — then ask Claude to judge whether the reviewer's point actually holds and to
 * draft a reply the PR author can post. The assessment streams first; a sentinel
 * in the model's output splits off the suggested reply so the UI can render it in
 * its own box. Progress is emitted as newline-delimited JSON.
 */

import { anthropic } from "@/infrastructure/anthropic/client";
import { getFileContent } from "@/infrastructure/github/pull-request.repository";
import { resolveSymbol } from "./resolve-symbol";
import type {
  GatheredFile,
  InsightEvent,
  StepPlanEntry,
} from "@/domain/insight/events";

export interface VerifyCommentInput {
  owner: string;
  repo: string;
  headRef: string;
  path: string;
  line: number | null;
  author: string;
  body: string;
  thread: { author: string; body: string }[];
}

interface RelatedDefinition {
  name: string;
  path: string;
  line: number;
  snippet: string;
}

const MAX_IDENTIFIERS = 8;
const MAX_RELATED = 6;
const WINDOW_RADIUS = 60;
const REPLY_SENTINEL = "@@SUGGESTED_REPLY@@";

const KEYWORDS = new Set([
  "const", "let", "var", "function", "return", "if", "else", "for", "while",
  "import", "export", "from", "type", "interface", "class", "new", "await",
  "async", "this", "true", "false", "null", "undefined", "void", "string",
  "number", "boolean", "extends", "implements", "readonly", "static", "default",
  "switch", "case", "break", "continue", "throw", "try", "catch", "finally",
  "typeof", "instanceof", "enum", "namespace", "super", "yield", "delete",
]);

function extractIdentifiers(text: string): string[] {
  const matches = text.match(/[A-Za-z_$][\w$]*/g) ?? [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const m of matches) {
    if (m.length < 3 || KEYWORDS.has(m) || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

function windowAround(content: string, line: number): string {
  const lines = content.split("\n");
  const from = Math.max(0, line - 1 - WINDOW_RADIUS);
  const to = Math.min(lines.length, line + WINDOW_RADIUS);
  const numbered = lines
    .slice(from, to)
    .map((text, i) => `${from + i + 1}\t${text}`)
    .join("\n");
  return numbered;
}

async function resolveOne(
  input: VerifyCommentInput,
  name: string,
): Promise<{ def: RelatedDefinition | null; log: string }> {
  const res = await resolveSymbol({
    owner: input.owner,
    repo: input.repo,
    ref: input.headRef,
    importerPath: input.path,
    symbol: name,
  }).catch(() => null);
  if (!res) return { def: null, log: `\`${name}\` → could not resolve` };
  if (res.kind === "external") {
    return { def: null, log: `\`${name}\` → external module ${res.specifier ?? ""}` };
  }
  if (res.kind === "unresolved" || !res.content || !res.path || !res.line) {
    return { def: null, log: `\`${name}\` → no definition found` };
  }
  if (res.path === input.path) return { def: null, log: "" };
  const lines = res.content.split("\n");
  const snippet = lines
    .slice(res.line - 1, Math.min(lines.length, res.line + 40))
    .join("\n");
  return {
    def: { name, path: res.path, line: res.line, snippet },
    log: `Resolved \`${name}\` → ${res.path}:${res.line}`,
  };
}

const SYSTEM_PROMPT = `You are helping a pull-request author evaluate a reviewer's comment. You have been given the reviewer's comment, the file and line it targets, the surrounding code, and the resolved definitions of the symbols in that code. Judge the comment on the merits — do NOT reflexively agree, and do NOT reflexively defend the author's code. Reason from the code you were given; do not ask for more context.

Respond in two parts, separated by a line containing exactly ${REPLY_SENTINEL}.

Part 1 — the assessment (markdown), with these sections:
- **Verdict** — one line: is the reviewer's point valid, partly valid, or off-base? Say why in a phrase.
- **Reasoning** — 1–4 sentences grounded in the specific code. Reference files/symbols as inline code. If the reviewer is right, say what's actually wrong and how to fix it; if they're mistaken, say what they likely missed.

Part 2 — after the ${REPLY_SENTINEL} line, the suggested reply the author could post, written in the first person as the author replying to the reviewer. Keep it courteous, specific, and short (2–4 sentences). If the reviewer is right, acknowledge and state the fix; if they're wrong, explain the misunderstanding politely with a concrete pointer. Output only the reply text — no headings, no preamble.`;

function buildPrompt(
  input: VerifyCommentInput,
  fileWindow: string | null,
  related: RelatedDefinition[],
): string {
  let prompt = `Reviewer comment by @${input.author} on ${input.path}`;
  prompt += input.line ? `:${input.line}\n` : "\n";
  prompt += `\n"""\n${input.body}\n"""\n`;

  const priorThread = input.thread.filter((c) => c.body !== input.body);
  if (priorThread.length > 0) {
    prompt += `\nEarlier in this thread:\n`;
    for (const c of priorThread) {
      prompt += `@${c.author}: ${c.body}\n`;
    }
  }

  if (fileWindow) {
    prompt += `\nCode around the commented line (${input.path}):\n\`\`\`\n${fileWindow}\n\`\`\`\n`;
  }
  if (related.length > 0) {
    prompt += `\nResolved definitions referenced by that code:\n`;
    for (const def of related) {
      prompt += `\n— \`${def.name}\` (${def.path}:${def.line})\n\`\`\`\n${def.snippet}\n\`\`\`\n`;
    }
  }
  return prompt;
}

export function generateCommentVerificationStream(
  input: VerifyCommentInput,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: InsightEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        const plan: StepPlanEntry[] = [
          { id: "read", label: "Reading commented file" },
          { id: "deps", label: "Resolving referenced code" },
          { id: "verify", label: "Verifying the comment" },
        ];
        send({ type: "plan", steps: plan });

        send({ type: "step_start", id: "read", label: "Reading commented file" });
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

        const anchor = input.line ?? 1;
        const fileWindow = full ? windowAround(full, anchor) : null;

        const related: RelatedDefinition[] = [];
        const seen = new Set<string>();
        send({ type: "step_start", id: "deps", label: "Resolving referenced code" });
        if (fileWindow) {
          const idents = extractIdentifiers(fileWindow).slice(0, MAX_IDENTIFIERS);
          for (const name of idents) {
            if (related.length >= MAX_RELATED) break;
            const { def, log } = await resolveOne(input, name);
            if (log) send({ type: "log", message: log });
            if (def) {
              const key = `${def.path}:${def.line}`;
              if (!seen.has(key)) {
                seen.add(key);
                related.push(def);
              }
            }
          }
        }
        if (related.length === 0) {
          send({ type: "log", message: "No cross-file definitions to gather" });
        }
        send({ type: "step_end", id: "deps" });

        const files: GatheredFile[] = [
          { path: input.path, reason: "commented file" },
          ...related.map((r) => ({ path: r.path, reason: `defines ${r.name}` })),
        ];
        send({ type: "files", files });

        send({ type: "step_start", id: "verify", label: "Verifying the comment" });
        const stream = anthropic().messages.stream({
          model: "claude-opus-4-8",
          max_tokens: 8192,
          thinking: { type: "adaptive" },
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: "user",
              content: buildPrompt(input, fileWindow, related),
            },
          ],
        });

        let mode: "assess" | "reply" = "assess";
        let carry = "";
        const keep = REPLY_SENTINEL.length - 1;
        const feed = (delta: string) => {
          if (mode === "reply") {
            send({ type: "reply", text: delta });
            return;
          }
          carry += delta;
          const idx = carry.indexOf(REPLY_SENTINEL);
          if (idx !== -1) {
            const before = carry.slice(0, idx).replace(/\n+$/, "");
            if (before) send({ type: "token", text: before });
            const after = carry.slice(idx + REPLY_SENTINEL.length).replace(/^\n+/, "");
            mode = "reply";
            carry = "";
            if (after) send({ type: "reply", text: after });
            return;
          }
          if (carry.length > keep) {
            send({ type: "token", text: carry.slice(0, carry.length - keep) });
            carry = carry.slice(carry.length - keep);
          }
        };

        stream.on("text", feed);
        await stream.finalMessage();
        if (mode === "assess" && carry) send({ type: "token", text: carry });
        send({ type: "step_end", id: "verify" });
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Verification failed.";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}
