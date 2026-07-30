"use client";

/**
 * Keeps the Ask Lizard transcript on disk, one thread per PR (keyed by prKey), the
 * same shape as the review-draft sync: hydrate when the PR comes into scope,
 * debounce-save afterwards, flush on the way out. Hydration yields to a live
 * conversation — if the user got a question in before the fetch landed, the saved
 * copy is dropped rather than overwriting them. Threads only persist for PRs — a
 * compare view's base…head isn't in its route, so a saved thread there could not be
 * told apart from another comparison of the same repo.
 *
 * `useEraseChat` is the eraser button's other half: it clears the store and removes
 * the row, so "erase" means gone rather than gone-until-reload.
 */

import { useCallback, useEffect } from "react";
import { api } from "@/lib/apiClient";
import { prKey } from "@/lib/pr-key";
import { useChatStore } from "@/features/chat/chat.store";
import type { ChatMessage, ChatScope } from "@/domain/chat/models";

const DEBOUNCE_MS = 600;

interface StoredThread {
  messages: ChatMessage[];
}

function threadKey(scope: ChatScope | null): string | null {
  if (!scope || scope.kind !== "pr") return null;
  const { owner, repo, number } = scope;
  if (!owner || !repo || number === undefined) return null;
  return prKey({ owner, repo, number });
}

/** The saved-thread key for the scope currently in view, or null if it isn't saved. */
export function useChatThreadKey(): string | null {
  return threadKey(useChatStore((s) => s.scope));
}

export function useChatHistorySync() {
  const key = useChatThreadKey();

  useEffect(() => {
    if (!key) return;
    let cancelled = false;
    let ready = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = () => {
      const { messages } = useChatStore.getState();
      void api.post("/api/chat-history", { key, messages });
    };

    api
      .get<StoredThread>(`/api/chat-history?key=${encodeURIComponent(key)}`)
      .then(({ messages }) => {
        if (cancelled) return;
        const live = useChatStore.getState();
        if (live.messages.length === 0 && !live.isStreaming) live.hydrate(messages);
        ready = true;
      })
      .catch(() => {
        if (!cancelled) ready = true;
      });

    const unsubscribe = useChatStore.subscribe((state, previous) => {
      if (!ready || state.messages === previous.messages) return;
      clearTimeout(timer);
      timer = setTimeout(save, DEBOUNCE_MS);
    });

    return () => {
      cancelled = true;
      const wasReady = ready;
      ready = false;
      clearTimeout(timer);
      unsubscribe();
      if (wasReady) save();
      useChatStore.getState().hydrate([]);
    };
  }, [key]);
}

export function useEraseChat() {
  const key = useChatThreadKey();

  return useCallback(() => {
    useChatStore.getState().clear();
    if (!key) return;
    void api.del(`/api/chat-history?key=${encodeURIComponent(key)}`);
  }, [key]);
}
