import "server-only";

/**
 * Server-only Anthropic client factory. The API key never leaves the server.
 * Mirrors the GitHub client: a lazy singleton that throws a clear, actionable
 * error when the key is missing rather than failing deep inside a request.
 */

import Anthropic from "@anthropic-ai/sdk";

let cached: Anthropic | null = null;

export function anthropic(): Anthropic {
  if (cached) return cached;
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Add it to .env.local to use AI insights.",
    );
  }
  cached = new Anthropic({ apiKey, defaultHeaders: { "anthropic-version": "2023-06-01" } });
  return cached;
}
