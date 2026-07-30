import "server-only";

/**
 * The chat agent behind the gecko button. Unlike the insight pipeline — which
 * gathers a fixed context bundle and asks once — this runs a tool loop so a
 * question can pull exactly what it needs: `insight` (the same read → resolve →
 * map-usages gather the ⌘I panel runs, with `deep` for the Dig Deeper second
 * hop), `read_file`, `find_symbol` against the repo symbol index, and
 * `list_changed_files` for the PR in view.
 *
 * The page the user is on and anything they highlighted are injected as context
 * up front, so "what does this do?" resolves against the selection without the
 * agent having to search for it. Progress streams as newline-delimited
 * `ChatEvent`s: one tool_start/tool_log/tool_end group per call, then tokens.
 *
 * A question that needs many tools can exhaust the turn budget before the model
 * writes anything, which would leave the user staring at a trace and no answer —
 * so if nothing was streamed by the time the loop ends, the gathered context gets
 * one final pass with tools switched off to force a written answer.
 */

import type Anthropic from "@anthropic-ai/sdk";
import { anthropic } from "@/infrastructure/anthropic/client";
import {
  getFileContent,
  getPullRequest,
} from "@/infrastructure/github/pull-request.repository";
import { lookupDefinitions } from "@/infrastructure/db/code-index.repository";
import { repoKey } from "@/lib/pr-key";
import { resolveDefinition, type RelatedDefinition } from "./insight-context";
import {
  countOccurrences,
  extractIdentifiers,
  rankedIdentifiers,
  sliceLines,
  windowFile,
} from "@/domain/insight/gather";
import type { ChatEvent } from "@/domain/chat/events";
import type {
  ChatAttachment,
  ChatRequest,
  ChatScope,
  ChatTurn,
} from "@/domain/chat/models";

const MODEL = "claude-opus-4-8";
const MAX_TURNS = 16;
const MAX_READ_LINES = 400;
const DEFAULT_REF = "HEAD";

const SYSTEM_PROMPT = `You are the assistant inside re:view, a local PR review tool built around tracing how code connects. You are talking to the single engineer who is reviewing a pull request right now.

You have tools that read the actual repository — use them rather than guessing:
- \`insight\` is the strongest one: given a file and line range it reads the file, resolves the symbols that range references by following imports, and reports how often each is used. Set \`deep\` to true to take a second resolution hop and pull whole defining files (this is the "Dig Deeper" mode) when the first pass isn't enough to answer confidently.
- \`read_file\` reads a file (optionally a line range) at the ref in view.
- \`find_symbol\` looks a symbol up in the repo-wide index and tells you where it is defined.
- \`list_changed_files\` lists the files the pull request touches, with add/delete counts.

Rules of engagement:
- If the user attached a selection, that is what "this"/"it"/"here" refers to. Run \`insight\` on it before answering anything non-trivial about it.
- Ground every claim in something a tool returned. Reference files as inline code with paths (\`src/features/foo/Bar.tsx\`) and give line numbers when you have them.
- Answer at the length the question deserves — a direct question gets a direct answer in a sentence or two, no headers. Reach for structure only for genuinely multi-part answers.
- Never claim you cannot see the code. If a tool came up empty, say what you tried and what you'd need.
- Markdown is rendered. Keep code excerpts short and fenced.`;

interface ToolContext {
  scope: ChatScope | null;
  send(event: ChatEvent): void;
}

function scopeRef(scope: ChatScope | null): string {
  return scope?.ref ?? DEFAULT_REF;
}

function describeScope(scope: ChatScope | null): string {
  if (!scope) return "The user is not on a repository page.";
  const lines = [`The user is looking at: ${scope.label} (route ${scope.route}).`];
  if (scope.owner && scope.repo) {
    lines.push(`Repository: ${scope.owner}/${scope.repo}.`);
  }
  if (scope.number !== undefined) lines.push(`Pull request: #${scope.number}.`);
  if (scope.ref) lines.push(`File reads resolve at ref ${scope.ref}.`);
  if (scope.openPath) lines.push(`Open file in the diff viewer: ${scope.openPath}.`);
  return lines.join("\n");
}

function describeAttachments(attachments: ChatAttachment[]): string {
  if (attachments.length === 0) return "";
  const parts = attachments.map((attachment) => {
    const { kind, path, startLine, endLine, text } = attachment;
    if (kind === "file") return `— whole file \`${path}\``;
    const range =
      startLine === undefined ? "" : ` lines ${startLine}–${endLine ?? startLine}`;
    const body = text ? `\n\`\`\`\n${text}\n\`\`\`` : "";
    return `— selection in \`${path}\`${range}${body}`;
  });
  return `\nThe user attached this context to the question:\n${parts.join("\n")}\n`;
}

const TOOLS: Anthropic.Tool[] = [
  {
    name: "insight",
    description:
      "Read a file, resolve the definitions of the symbols a line range references (following imports and the repo index), and map how often each is used. The best tool for 'what does this do / how does this connect'. Set deep for a second resolution hop with whole defining files.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative file path" },
        startLine: { type: "integer", description: "1-based first line" },
        endLine: { type: "integer", description: "1-based last line, inclusive" },
        deep: {
          type: "boolean",
          description: "Take a second resolution hop and include full definition files",
        },
      },
      required: ["path", "startLine", "endLine"],
    },
  },
  {
    name: "read_file",
    description: "Read a file at the ref in view. Omit the range to read from the top.",
    input_schema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Repo-relative file path" },
        startLine: { type: "integer", description: "1-based first line" },
        endLine: { type: "integer", description: "1-based last line, inclusive" },
      },
      required: ["path"],
    },
  },
  {
    name: "find_symbol",
    description:
      "Look an exported symbol up in the repo-wide symbol index and get the files and lines where it is defined.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Exact symbol name" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_changed_files",
    description:
      "List the files the pull request in view changes, with per-file added/removed line counts.",
    input_schema: { type: "object", properties: {} },
  },
];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function readString(input: unknown, key: string): string | null {
  if (!isRecord(input)) return null;
  const value = input[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function readNumber(input: unknown, key: string): number | null {
  if (!isRecord(input)) return null;
  const value = input[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function readBoolean(input: unknown, key: string): boolean {
  return isRecord(input) && input[key] === true;
}

async function runInsightTool(
  ctx: ToolContext,
  id: string,
  input: unknown,
): Promise<string> {
  const { scope, send } = ctx;
  const path = readString(input, "path");
  if (!path) return "Error: path is required.";
  if (!scope?.owner || !scope.repo) {
    return "Error: no repository is in view, so the file cannot be read.";
  }
  const startLine = readNumber(input, "startLine") ?? 1;
  const endLine = readNumber(input, "endLine") ?? startLine;
  const deep = readBoolean(input, "deep");
  const target = { owner: scope.owner, repo: scope.repo, ref: scopeRef(scope) };

  const content = await getFileContent(
    scope.owner,
    scope.repo,
    path,
    target.ref,
  ).catch(() => null);
  if (content === null) return `Error: could not read ${path} at ${target.ref}.`;
  send({ type: "tool_log", id, message: `Read ${path} (${content.split("\n").length} lines)` });

  const selected = sliceLines(content, startLine, endLine);
  const maxIdentifiers = deep ? 12 : 8;
  const maxRelated = deep ? 10 : 6;

  const related: RelatedDefinition[] = [];
  const seen = new Set<string>();
  const add = (def: RelatedDefinition) => {
    const key = `${def.path}:${def.line}`;
    if (seen.has(key) || related.length >= maxRelated) return;
    seen.add(key);
    related.push(def);
  };

  for (const name of rankedIdentifiers(selected, content).slice(0, maxIdentifiers)) {
    const { def, log } = await resolveDefinition(target, path, name, deep);
    if (log) send({ type: "tool_log", id, message: log });
    if (def) add(def);
  }

  if (deep) {
    for (const parent of [...related].slice(0, 4)) {
      if (related.length >= maxRelated) break;
      for (const name of extractIdentifiers(parent.snippet).slice(0, 6)) {
        if (related.length >= maxRelated) break;
        const { def } = await resolveDefinition(target, parent.path, name, true);
        if (!def) continue;
        add(def);
        send({
          type: "tool_log",
          id,
          message: `Resolved \`${name}\` → ${def.path}:${def.line}`,
        });
      }
    }
  }

  const corpus = [content, ...related.map(({ snippet }) => snippet)];
  const sections = [
    `File: ${path} (lines ${startLine}–${endLine})`,
    `Selected code:\n\`\`\`\n${selected}\n\`\`\``,
    `Surrounding file:\n\`\`\`\n${windowFile(content, startLine, endLine)}\n\`\`\``,
  ];
  if (related.length > 0) {
    const defs = related
      .map(
        ({ name, path: defPath, line, snippet }) =>
          `— \`${name}\` (${defPath}:${line})\n\`\`\`\n${snippet}\n\`\`\``,
      )
      .join("\n");
    sections.push(`Resolved definitions the selection references:\n${defs}`);
    const usage = related
      .map(({ name }) => `- \`${name}\` referenced ${countOccurrences(name, corpus)}×`)
      .join("\n");
    sections.push(`Usage across the gathered code:\n${usage}`);
  } else {
    sections.push("No cross-file definitions resolved for this range.");
  }
  send({
    type: "tool_log",
    id,
    message: `Gathered ${related.length} definition${related.length === 1 ? "" : "s"}`,
  });
  return sections.join("\n\n");
}

async function runReadFileTool(
  ctx: ToolContext,
  id: string,
  input: unknown,
): Promise<string> {
  const { scope, send } = ctx;
  const path = readString(input, "path");
  if (!path) return "Error: path is required.";
  if (!scope?.owner || !scope.repo) {
    return "Error: no repository is in view, so the file cannot be read.";
  }
  const ref = scopeRef(scope);
  const content = await getFileContent(scope.owner, scope.repo, path, ref).catch(
    () => null,
  );
  if (content === null) return `Error: could not read ${path} at ${ref}.`;

  const startLine = readNumber(input, "startLine") ?? 1;
  const endLine = readNumber(input, "endLine");
  const capped = Math.min(
    endLine ?? Number.MAX_SAFE_INTEGER,
    startLine + MAX_READ_LINES - 1,
  );
  const body = sliceLines(content, startLine, capped);
  send({ type: "tool_log", id, message: `Read ${path}:${startLine}–${capped}` });
  return `${path} lines ${startLine}–${capped}:\n\`\`\`\n${body}\n\`\`\``;
}

function runFindSymbolTool(ctx: ToolContext, id: string, input: unknown): string {
  const { scope, send } = ctx;
  const name = readString(input, "name");
  if (!name) return "Error: name is required.";
  if (!scope?.owner || !scope.repo) {
    return "Error: no repository is in view, so the index cannot be queried.";
  }
  const hits = lookupDefinitions(repoKey({ owner: scope.owner, repo: scope.repo }), name);
  send({
    type: "tool_log",
    id,
    message: `\`${name}\` → ${hits.length} definition${hits.length === 1 ? "" : "s"} in the index`,
  });
  if (hits.length === 0) {
    return `No indexed definition of \`${name}\`. The index only holds exported symbols from the default branch, so a local or unexported symbol will not appear.`;
  }
  const rows = hits
    .map(({ kind, path, line }) => `- ${kind} \`${name}\` — ${path}:${line}`)
    .join("\n");
  return `Indexed definitions of \`${name}\`:\n${rows}`;
}

async function runListChangedFilesTool(
  ctx: ToolContext,
  id: string,
): Promise<string> {
  const { scope, send } = ctx;
  if (!scope?.owner || !scope.repo || scope.number === undefined) {
    return "Error: no pull request is in view.";
  }
  const { pr, files } = await getPullRequest(scope.owner, scope.repo, scope.number);
  send({ type: "tool_log", id, message: `${files.length} changed files in #${scope.number}` });
  const rows = files
    .map(
      ({ path, status, additions, deletions }) =>
        `- ${path} (${status}, +${additions}/-${deletions})`,
    )
    .join("\n");
  return `PR #${scope.number} "${pr.title}" by ${pr.author.login} changes ${files.length} files:\n${rows}`;
}

function toolLabel(name: string, input: unknown): string {
  const path = readString(input, "path");
  if (name === "insight") {
    const startLine = readNumber(input, "startLine");
    const range = startLine === null ? "" : `:${startLine}`;
    const deep = readBoolean(input, "deep") ? " (deep)" : "";
    return `Insight on ${path ?? "selection"}${range}${deep}`;
  }
  if (name === "read_file") return `Reading ${path ?? "file"}`;
  if (name === "find_symbol") return `Finding ${readString(input, "name") ?? "symbol"}`;
  if (name === "list_changed_files") return "Listing changed files";
  return name;
}

async function runTool(
  ctx: ToolContext,
  id: string,
  name: string,
  input: unknown,
): Promise<string> {
  if (name === "insight") return runInsightTool(ctx, id, input);
  if (name === "read_file") return runReadFileTool(ctx, id, input);
  if (name === "find_symbol") return runFindSymbolTool(ctx, id, input);
  if (name === "list_changed_files") return runListChangedFilesTool(ctx, id);
  return `Error: unknown tool ${name}.`;
}

function buildMessages({
  history,
  question,
  attachments,
  scope,
}: ChatRequest): Anthropic.MessageParam[] {
  const messages: Anthropic.MessageParam[] = history.map(({ role, text }: ChatTurn) => ({
    role,
    content: text,
  }));
  messages.push({
    role: "user",
    content: `${describeScope(scope)}\n${describeAttachments(attachments)}\nQuestion: ${question}`.replace(
      /\n{3,}/g,
      "\n\n",
    ),
  });
  return messages;
}

export function generateChatStream(request: ChatRequest): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: ChatEvent) =>
        controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      const ctx: ToolContext = { scope: request.scope, send };
      const messages = buildMessages(request);
      let answered = false;
      const forwardText = (delta: string) => {
        answered = true;
        send({ type: "token", text: delta });
      };

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          const stream = anthropic().messages.stream({
            model: MODEL,
            max_tokens: 8192,
            thinking: { type: "adaptive" },
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            messages,
          });
          stream.on("text", forwardText);
          const message = await stream.finalMessage();

          const calls = message.content.filter(
            (block): block is Anthropic.ToolUseBlock => block.type === "tool_use",
          );
          if (calls.length === 0) break;

          messages.push({ role: "assistant", content: message.content });
          const results: Anthropic.ToolResultBlockParam[] = [];
          for (const { id, name, input } of calls) {
            send({ type: "tool_start", id, name, label: toolLabel(name, input) });
            const output = await runTool(ctx, id, name, input).catch((err: unknown) =>
              err instanceof Error ? `Error: ${err.message}` : "Error: tool failed.",
            );
            send({ type: "tool_end", id, summary: `${output.length} chars gathered` });
            results.push({ type: "tool_result", tool_use_id: id, content: output });
          }
          messages.push({ role: "user", content: results });
          if (answered) send({ type: "token", text: "\n\n" });
        }

        if (!answered) {
          const closing = anthropic().messages.stream({
            model: MODEL,
            max_tokens: 8192,
            thinking: { type: "adaptive" },
            system: SYSTEM_PROMPT,
            tools: TOOLS,
            tool_choice: { type: "none" },
            messages,
          });
          closing.on("text", forwardText);
          await closing.finalMessage();
        }
        send({ type: "done" });
        controller.close();
      } catch (err) {
        const message = err instanceof Error ? err.message : "Chat failed.";
        send({ type: "error", message });
        controller.close();
      }
    },
  });
}
