"use client";

/**
 * Syncs the in-memory review store with its SQLite-persisted counterpart for the
 * open PR. On mount it hydrates staged comments / body / event / viewed marks
 * from the server; while mounted it debounce-saves every change (so an
 * in-progress review survives a server restart); on unmount it flushes a final
 * save and resets the local store for the next PR. Persistence is keyed by prKey.
 */

import { useEffect, useRef } from "react";
import { api } from "@/lib/apiClient";
import { prKey } from "@/lib/pr-key";
import { useReviewStore } from "@/features/review/store";
import type { ReviewDraftState } from "@/domain/pull-request/models";

const DEBOUNCE_MS = 500;

function snapshot(): ReviewDraftState {
  const s = useReviewStore.getState();
  return { drafts: s.drafts, body: s.body, event: s.event, viewed: [...s.viewedFiles] };
}

export function useReviewDraftSync(owner: string, repo: string, number: number) {
  const readyRef = useRef(false);
  const key = prKey({ owner, repo, number });

  useEffect(() => {
    readyRef.current = false;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const save = (state: ReviewDraftState) => {
      void api.post("/api/review-draft", { key, ...state });
    };

    api
      .get<ReviewDraftState>(`/api/review-draft?key=${encodeURIComponent(key)}`)
      .then((data) => {
        if (cancelled) return;
        useReviewStore.getState().hydrate(data);
        readyRef.current = true;
      })
      .catch(() => {
        if (!cancelled) readyRef.current = true;
      });

    const unsubscribe = useReviewStore.subscribe(() => {
      if (!readyRef.current) return;
      clearTimeout(timer);
      timer = setTimeout(() => save(snapshot()), DEBOUNCE_MS);
    });

    return () => {
      cancelled = true;
      const wasReady = readyRef.current;
      readyRef.current = false;
      clearTimeout(timer);
      unsubscribe();
      if (wasReady) save(snapshot());
      useReviewStore.getState().reset();
    };
  }, [key]);
}
