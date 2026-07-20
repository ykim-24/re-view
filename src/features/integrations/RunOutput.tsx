"use client";

/** Renders an integration run's captured logs (levels + timing) and its result. */

import { Loader } from "@/components/Loader";
import { cn } from "@/lib/utils";
import type { LogLevel, RunLog, RunResult } from "@/domain/integration/models";

const LEVEL_CLASS: Record<LogLevel, string> = {
  info: "text-foreground",
  debug: "text-muted-foreground",
  error: "text-red-400",
};

interface RunOutputProps {
  result: RunResult | null;
  isRunning: boolean;
}

export function RunOutput({ result, isRunning }: RunOutputProps) {
  if (isRunning) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader label="Running…" size="sm" />
      </div>
    );
  }
  if (!result) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        Run a command to see its logs and output.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      <StatusBar result={result} />
      <LogList logs={result.logs} />
      {result.result !== undefined && <ResultBlock value={result.result} />}
    </div>
  );
}

function StatusBar({ result }: { result: RunResult }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <span
        className={cn(
          "rounded px-1.5 py-0.5 font-medium",
          result.ok ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400",
        )}
      >
        {result.ok ? "OK" : "Failed"}
      </span>
      <span className="text-muted-foreground">{result.durationMs}ms</span>
      <span className="text-muted-foreground">· {result.logs.length} log lines</span>
    </div>
  );
}

function LogList({ logs }: { logs: RunLog[] }) {
  if (logs.length === 0) {
    return <div className="text-xs text-muted-foreground">No log output.</div>;
  }
  return (
    <div className="max-h-[40vh] overflow-y-auto rounded-md bg-tab-strip p-2 font-mono text-xs shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]">
      {logs.map((line, i) => (
        <div key={i} className="flex gap-2 whitespace-pre-wrap break-words py-0.5">
          <span className="shrink-0 text-muted-foreground/60 tabular-nums">
            {line.atMs}ms
          </span>
          <span className="shrink-0 select-none text-muted-foreground/40">|</span>
          <span className={cn("min-w-0", LEVEL_CLASS[line.level])}>{line.message}</span>
        </div>
      ))}
    </div>
  );
}

function ResultBlock({ value }: { value: unknown }) {
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Result
      </div>
      <pre className="max-h-[30vh] overflow-auto rounded-md bg-tab-strip p-2 font-mono text-xs shadow-[inset_0_1px_3px_rgba(0,0,0,0.55)]">
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
