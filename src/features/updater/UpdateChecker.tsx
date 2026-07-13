"use client";

/**
 * Mounted once at the app root. Polls the version status and opens the update
 * modal when the local checkout falls behind the remote — at most once per new
 * sha per session, and never for a sha the user already dismissed with "Not now".
 */

import { useEffect, useRef } from "react";
import { DISMISSED_UPDATE_KEY, useVersionCheck } from "@/hooks/useVersionCheck";
import { openModal } from "@/features/modal";

export function UpdateChecker() {
  const { data } = useVersionCheck();
  const promptedSha = useRef<string | null>(null);

  useEffect(() => {
    if (!data?.updateAvailable) return;
    const sha = data.latestSha;
    if (promptedSha.current === sha) return;
    if (localStorage.getItem(DISMISSED_UPDATE_KEY) === sha) return;
    promptedSha.current = sha;
    openModal({ type: "update", status: data });
  }, [data]);

  return null;
}
