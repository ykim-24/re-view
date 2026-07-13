import "server-only";
import { Octokit } from "@octokit/rest";
import { throttling } from "@octokit/plugin-throttling";
import { retry } from "@octokit/plugin-retry";

/**
 * Octokit with automatic backoff: `retry` retries 5xx/network errors with
 * exponential backoff; `throttling` waits out short rate-limit windows and
 * secondary (abuse) limits. A hard primary-limit exhaustion (long reset) fails
 * fast instead of hanging the request for minutes.
 */
const ResilientOctokit = Octokit.plugin(throttling, retry);

let cached: InstanceType<typeof ResilientOctokit> | null = null;

/** Server-only Octokit factory. The token never leaves the server. */
export function github(): InstanceType<typeof ResilientOctokit> {
  if (cached) return cached;
  const auth = process.env.GITHUB_TOKEN;
  if (!auth) {
    throw new Error(
      "GITHUB_TOKEN is not set. Add it to .env.local (see .env.example).",
    );
  }
  cached = new ResilientOctokit({
    auth,
    userAgent: "re-view-local",
    throttle: {
      onRateLimit: (
        retryAfter: number,
        options: { method?: string; url?: string },
        octokit: { log: { warn: (message: string) => void } },
        retryCount: number,
      ): boolean => {
        octokit.log.warn(`Rate limit hit for ${options.method} ${options.url}`);
        return retryAfter <= 30 && retryCount < 3;
      },
      onSecondaryRateLimit: (
        retryAfter: number,
        options: { method?: string; url?: string },
        octokit: { log: { warn: (message: string) => void } },
        retryCount: number,
      ): boolean => {
        octokit.log.warn(
          `Secondary rate limit for ${options.method} ${options.url}`,
        );
        return retryCount < 3;
      },
    },
  });
  return cached;
}
