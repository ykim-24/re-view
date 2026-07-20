/**
 * Types for custom integrations. An Integration is an app; it owns Flows (its
 * capabilities/routes), and a Flow arranges Components (placed logic blocks, like
 * React components) via lightweight node references. `Command` is the retired
 * Phase A flat-command shape, kept only until that UI is replaced.
 */

export interface SecretMeta {
  name: string;
  createdAt: string;
}

export type LogLevel = "info" | "debug" | "error";

export interface RunLog {
  level: LogLevel;
  message: string;
  atMs: number;
}

export interface RunResult {
  ok: boolean;
  logs: RunLog[];
  result?: unknown;
  error?: string;
  durationMs: number;
}

/** A run that also carries the (possibly mutated) shared flow state back out. */
export interface ComponentRunResult extends RunResult {
  ctx: Record<string, unknown>;
}

/** Retired Phase A "saved command" (name + code). Superseded by Component. */
export interface Command {
  id: string;
  name: string;
  code: string;
  createdAt: string;
  updatedAt: string;
}

/** An app: a container for flows plus its own global config (e.g. secrets). */
export interface Integration {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  updatedAt: string;
}

/** The kinds of component we support; grows as we build more. */
export type ComponentType = "button" | "sequence";

/** A placed logic block. Belongs to a flow via that flow's node references. */
export interface Component {
  id: string;
  type: ComponentType;
  name: string;
  config: Record<string, unknown>;
  code: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * A flow's reference to one component: which component and its explicit order.
 * `order` is sparse (gaps) so inserts take a midpoint without renumbering peers.
 */
export interface FlowNode {
  id: string;
  order: number;
}

/** A capability of an integration; arranges components on a canvas. */
export interface Flow {
  id: string;
  integrationId: string;
  name: string;
  description: string;
  nodes: FlowNode[];
  createdAt: string;
  updatedAt: string;
}
