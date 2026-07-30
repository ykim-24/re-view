/**
 * Wire protocol for the chat agent. The server emits these as newline-delimited
 * JSON while it runs the tool loop: `tool_start`/`tool_log`/`tool_end` narrate
 * each tool call (insight, dig deeper, reads, symbol lookups) so the UI can show
 * the work as it happens, and `token` carries the streamed answer text.
 */

export type ChatEvent =
  | { type: "tool_start"; id: string; name: string; label: string }
  | { type: "tool_log"; id: string; message: string }
  | { type: "tool_end"; id: string; summary: string }
  | { type: "token"; text: string }
  | { type: "error"; message: string }
  | { type: "done" };
