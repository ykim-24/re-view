import { create } from "zustand";
import {
  sameAttachment,
  type ChatAttachment,
  type ChatMessage,
  type ChatScope,
} from "@/domain/chat/models";

/**
 * The chat conversation and its panel state. Held in a store (not the panel) so
 * the transcript survives closing the panel, and so anything on the page can
 * open the chat with context already attached — the selection wheel's "Ask
 * Question", a file button, or the gecko launcher itself. `scope` is written by
 * whichever view knows where the user is: the route-level pieces come from the
 * pathname, and the workspace overwrites it with the PR's head ref and open file
 * so the agent's tools read the right blobs.
 */

interface ChatState {
  open: boolean;
  messages: ChatMessage[];
  staged: ChatAttachment[];
  scope: ChatScope | null;
  isStreaming: boolean;

  openChat(attachment?: ChatAttachment): void;
  close(): void;
  toggle(): void;
  clear(): void;
  hydrate(messages: ChatMessage[]): void;

  attach(attachment: ChatAttachment): void;
  detach(id: string): void;
  setScope(scope: ChatScope | null): void;

  addUserMessage(text: string, attachments: ChatAttachment[]): void;
  startAssistant(id: string): void;
  appendToken(id: string, text: string): void;
  startTool(id: string, tool: { id: string; name: string; label: string }): void;
  logTool(id: string, toolId: string, message: string): void;
  endTool(id: string, toolId: string, summary: string): void;
  failAssistant(id: string, message: string): void;
  finishStreaming(): void;
}

function updateMessage(
  messages: ChatMessage[],
  id: string,
  change: (message: ChatMessage) => ChatMessage,
): ChatMessage[] {
  return messages.map((message) => (message.id === id ? change(message) : message));
}

function updateTool(
  message: ChatMessage,
  toolId: string,
  change: (tool: ChatMessage["tools"][number]) => ChatMessage["tools"][number],
): ChatMessage {
  return {
    ...message,
    tools: message.tools.map((tool) => (tool.id === toolId ? change(tool) : tool)),
  };
}

export const useChatStore = create<ChatState>((set) => ({
  open: false,
  messages: [],
  staged: [],
  scope: null,
  isStreaming: false,

  openChat: (attachment) =>
    set((s) => {
      if (!attachment) return { open: true };
      const exists = s.staged.some((a) => sameAttachment(a, attachment));
      return { open: true, staged: exists ? s.staged : [...s.staged, attachment] };
    }),
  close: () => set({ open: false }),
  toggle: () => set((s) => ({ open: !s.open })),
  clear: () => set({ messages: [], staged: [] }),
  hydrate: (messages) => set({ messages, staged: [], isStreaming: false }),

  attach: (attachment) =>
    set((s) => {
      const exists = s.staged.some((a) => sameAttachment(a, attachment));
      if (exists) return {};
      return { staged: [...s.staged, attachment] };
    }),
  detach: (id) => set((s) => ({ staged: s.staged.filter((a) => a.id !== id) })),
  setScope: (scope) => set({ scope }),

  addUserMessage: (text, attachments) =>
    set((s) => ({
      staged: [],
      isStreaming: true,
      messages: [
        ...s.messages,
        {
          id: `u-${s.messages.length}-${text.length}-${Date.now()}`,
          role: "user",
          text,
          attachments,
          tools: [],
        },
      ],
    })),

  startAssistant: (id) =>
    set((s) => ({
      messages: [
        ...s.messages,
        { id, role: "assistant", text: "", attachments: [], tools: [] },
      ],
    })),

  appendToken: (id, text) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({ ...m, text: m.text + text })),
    })),

  startTool: (id, { id: toolId, name, label }) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({
        ...m,
        tools: [...m.tools, { id: toolId, name, label, logs: [], status: "running" }],
      })),
    })),

  logTool: (id, toolId, message) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) =>
        updateTool(m, toolId, (tool) => ({ ...tool, logs: [...tool.logs, message] })),
      ),
    })),

  endTool: (id, toolId, summary) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) =>
        updateTool(m, toolId, (tool) => ({ ...tool, status: "done", summary })),
      ),
    })),

  failAssistant: (id, message) =>
    set((s) => ({
      messages: updateMessage(s.messages, id, (m) => ({
        ...m,
        failed: true,
        text: m.text ? `${m.text}\n\n_${message}_` : `_${message}_`,
      })),
    })),

  finishStreaming: () => set({ isStreaming: false }),
}));
