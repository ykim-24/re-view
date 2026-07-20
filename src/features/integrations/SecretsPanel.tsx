"use client";

/**
 * Manage an integration's secrets (API keys), encrypted at rest. Lists the
 * integration's own secrets and shared global ones; new secrets are scoped to
 * this integration or global (an integration secret overrides a global of the
 * same name at run time). Delete is by id.
 */

import { useState, type ChangeEvent } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { cn } from "@/lib/utils";
import { useIntegrationSecrets, useSecretActions } from "@/hooks/useIntegrationApps";
import type { SecretMeta, SecretScope } from "@/domain/integration/models";

interface SecretsPanelProps {
  integrationId: string;
}

export function SecretsPanel({ integrationId }: SecretsPanelProps) {
  const { data } = useIntegrationSecrets(integrationId);
  const { setSecret, removeSecret } = useSecretActions(integrationId);
  const [name, setName] = useState("");
  const [value, setValue] = useState("");
  const [scope, setScope] = useState<SecretScope>("integration");

  const secrets = data?.secrets ?? [];
  const hasKey = data?.hasKey ?? false;
  const own = secrets.filter((s) => s.scope === "integration");
  const global = secrets.filter((s) => s.scope === "global");

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handleValueChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
  const handleScopeIntegration = () => setScope("integration");
  const handleScopeGlobal = () => setScope("global");
  const handleRemove = (id: string) => removeSecret.mutate(id);
  const handleAdd = () => {
    if (!name.trim() || !value.trim()) return;
    setSecret.mutate(
      { name: name.trim(), value, scope },
      {
        onSuccess: () => {
          setName("");
          setValue("");
        },
      },
    );
  };

  return (
    <div className="space-y-4">
      {data && !hasKey && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Set <code>INTEGRATIONS_SECRET</code> in <code>.env.local</code> to store keys
            (they&apos;re encrypted with it).
          </span>
        </div>
      )}

      <SecretGroup title="This integration" secrets={own} onRemove={handleRemove} />
      <SecretGroup title="Global" secrets={global} onRemove={handleRemove} />

      <div className="space-y-2 border-t pt-3">
        <div className="flex items-center gap-1">
          <ScopeButton label="This integration" active={scope === "integration"} onSelect={handleScopeIntegration} />
          <ScopeButton label="Global" active={scope === "global"} onSelect={handleScopeGlobal} />
        </div>
        <Input value={name} onChange={handleNameChange} placeholder="NAME" className="h-8 w-full font-mono" />
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={handleValueChange}
            type="password"
            placeholder="value"
            className="h-8 min-w-0 flex-1 font-mono"
          />
          <Button size="sm" onClick={handleAdd} disabled={!hasKey || setSecret.isPending} className="shrink-0">
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

interface ScopeButtonProps {
  label: string;
  active: boolean;
  onSelect(): void;
}

function ScopeButton({ label, active, onSelect }: ScopeButtonProps) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "rounded-md px-2 py-1 text-xs",
        active && "bg-blue-600 text-white",
        !active && "text-muted-foreground hover:bg-muted hover:text-foreground",
      )}
    >
      {label}
    </button>
  );
}

interface SecretGroupProps {
  title: string;
  secrets: SecretMeta[];
  onRemove(id: string): void;
}

function SecretGroup({ title, secrets, onRemove }: SecretGroupProps) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {secrets.map((secret) => (
        <SecretRow key={secret.id} secret={secret} onRemove={onRemove} />
      ))}
      {secrets.length === 0 && <div className="text-xs text-muted-foreground">None.</div>}
    </div>
  );
}

interface SecretRowProps {
  secret: SecretMeta;
  onRemove(id: string): void;
}

function SecretRow({ secret, onRemove }: SecretRowProps) {
  const handleRemove = () => onRemove(secret.id);
  return (
    <div className="flex items-center justify-between rounded-md border bg-card px-2.5 py-1.5">
      <span className="font-mono text-xs">{secret.name}</span>
      <Tooltip content="Delete secret">
        <button
          onClick={handleRemove}
          className="text-muted-foreground hover:text-destructive"
          aria-label="Delete secret"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </Tooltip>
    </div>
  );
}
