import "server-only";

/**
 * Runs user-authored code in a Node vm context with a small, controlled surface:
 * `fetch` (auto-logged), `secrets`, `log`/`console`, a shared `ctx` state object,
 * and — for flows — a `components` object exposing each sibling's `.output` and
 * `.run()`. Sync runaway is bounded by the vm timeout, async by an overall
 * deadline; cross-component calls are bounded by cycle + depth guards. This is
 * safe-execution for the single user's own code, not untrusted sandboxing.
 */

import vm from "node:vm";
import {
  getSecretValue,
  listSecretNames,
} from "@/infrastructure/db/integration-secret.repository";
import { componentKey } from "@/domain/integration/component-key";
import { primaryHandlerCode } from "@/domain/integration/component-handlers";
import type {
  Component,
  ComponentRunResult,
  LogLevel,
  RunLog,
  RunResult,
} from "@/domain/integration/models";

const SYNC_TIMEOUT_MS = 5_000;
const TOTAL_TIMEOUT_MS = 30_000;
const MAX_DEPTH = 20;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeObject(value: Record<string, unknown>): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(JSON.stringify(value));
    return isRecord(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function format(args: unknown[]): string {
  return args
    .map((a) => {
      if (typeof a === "string") return a;
      try {
        return JSON.stringify(a);
      } catch {
        return String(a);
      }
    })
    .join(" ");
}

function safeResult(value: unknown): unknown {
  if (value === undefined) return undefined;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return String(value);
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Run timed out after ${ms}ms`)), ms),
    ),
  ]);
}

function wrap(code: string): string {
  return `(async () => {\n${code}\n})()`;
}

interface Runtime {
  start: number;
  logs: RunLog[];
  prefix: { current: string };
  push(level: LogLevel, args: unknown[]): void;
  base: Record<string, unknown>;
}

function makeRuntime(): Runtime {
  const start = Date.now();
  const logs: RunLog[] = [];
  const prefix = { current: "" };
  const push = (level: LogLevel, args: unknown[]) =>
    logs.push({ level, message: prefix.current + format(args), atMs: Date.now() - start });

  const log = Object.assign((...args: unknown[]) => push("info", args), {
    debug: (...args: unknown[]) => push("debug", args),
    error: (...args: unknown[]) => push("error", args),
  });

  const loggedFetch = async (input: string | URL, init?: RequestInit) => {
    const t0 = Date.now();
    const method = init?.method ?? "GET";
    push("debug", [`→ ${method} ${String(input)}`]);
    const res = await fetch(input, init);
    push("debug", [`← ${res.status} ${res.statusText} (${Date.now() - t0}ms)`]);
    return res;
  };

  const secrets = {
    get: (name: string) => getSecretValue(name),
    names: () => listSecretNames(),
  };

  const base: Record<string, unknown> = {
    fetch: loggedFetch,
    log,
    secrets,
    console: {
      log,
      info: log,
      debug: log.debug,
      warn: (...args: unknown[]) => push("info", args),
      error: log.error,
    },
    setTimeout,
    clearTimeout,
    URL,
    URLSearchParams,
    TextEncoder,
    TextDecoder,
  };

  return { start, logs, prefix, push, base };
}

async function runCode(code: string, ctx: Record<string, unknown>): Promise<ComponentRunResult> {
  const rt = makeRuntime();
  const sandbox: Record<string, unknown> = { ...rt.base, ctx };
  vm.createContext(sandbox);
  try {
    const runPromise = vm.runInContext(wrap(code), sandbox, {
      timeout: SYNC_TIMEOUT_MS,
      filename: "command.js",
    }) as Promise<unknown>;
    const result = await withTimeout(runPromise, TOTAL_TIMEOUT_MS);
    return {
      ok: true,
      logs: rt.logs,
      result: safeResult(result),
      ctx: safeObject(ctx),
      durationMs: Date.now() - rt.start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rt.push("error", [message]);
    return {
      ok: false,
      logs: rt.logs,
      error: message,
      ctx: safeObject(ctx),
      durationMs: Date.now() - rt.start,
    };
  }
}

export async function runIntegration(code: string): Promise<RunResult> {
  return runCode(code, {});
}

export async function runFlow(
  components: Component[],
  entryId: string,
  initialCtx: Record<string, unknown>,
): Promise<ComponentRunResult> {
  const rt = makeRuntime();
  const ctx: Record<string, unknown> = { ...initialCtx };
  const byId = new Map<string, Component>();
  const byKey = new Map<string, Component>();
  for (const component of components) {
    byId.set(component.id, component);
    byKey.set(componentKey(component), component);
  }

  const stack: string[] = [];
  let sandbox: Record<string, unknown> = {};

  const runOne = async (component: Component): Promise<unknown> => {
    const key = componentKey(component);
    if (stack.includes(key)) throw new Error(`Cycle detected running "${key}"`);
    if (stack.length >= MAX_DEPTH) throw new Error("Max component call depth exceeded");
    stack.push(key);
    const previous = rt.prefix.current;
    rt.prefix.current = `[${key}] `;
    try {
      const runPromise = vm.runInContext(wrap(primaryHandlerCode(component)), sandbox, {
        timeout: SYNC_TIMEOUT_MS,
        filename: `${key}.js`,
      }) as Promise<unknown>;
      const result = safeResult(await runPromise);
      ctx[key] = result;
      return result;
    } finally {
      stack.pop();
      rt.prefix.current = previous;
    }
  };

  const componentsApi: Record<string, unknown> = {};
  for (const [key, component] of byKey) {
    const handle: Record<string, unknown> = { run: () => runOne(component) };
    Object.defineProperty(handle, "output", { get: () => ctx[key], enumerable: true });
    componentsApi[key] = handle;
  }

  sandbox = { ...rt.base, ctx, components: componentsApi };
  vm.createContext(sandbox);

  const entry = byId.get(entryId);
  if (!entry) {
    return {
      ok: false,
      logs: rt.logs,
      error: "Entry component not found",
      ctx: safeObject(ctx),
      durationMs: Date.now() - rt.start,
    };
  }

  try {
    const result = await withTimeout(runOne(entry), TOTAL_TIMEOUT_MS);
    return {
      ok: true,
      logs: rt.logs,
      result: safeResult(result),
      ctx: safeObject(ctx),
      durationMs: Date.now() - rt.start,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    rt.prefix.current = "";
    rt.push("error", [message]);
    return {
      ok: false,
      logs: rt.logs,
      error: message,
      ctx: safeObject(ctx),
      durationMs: Date.now() - rt.start,
    };
  }
}
