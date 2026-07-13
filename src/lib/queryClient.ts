import { QueryClient } from "@tanstack/react-query";

/**
 * A single QueryClient for the whole app. Local-only tool, so we keep things
 * cached aggressively — PR data rarely changes mid-review.
 */
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 1000 * 60 * 5,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}
