/**
 * Thin fetch wrapper for our own /api/* route handlers. Mirrors Flow's
 * lib/apiClient.ts — small, typed, throws on non-2xx.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function handle<T>(res: Response): Promise<T> {
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      void 0;
    }
    throw new ApiError(message, res.status);
  }
  return (await res.json()) as T;
}

export const api = {
  async get<T>(path: string): Promise<T> {
    return handle<T>(await fetch(path, { method: "GET" }));
  },
  async post<T>(path: string, body: unknown): Promise<T> {
    return handle<T>(
      await fetch(path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }),
    );
  },
};
