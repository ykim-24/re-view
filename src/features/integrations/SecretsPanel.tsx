"use client";

/** Manage integration secrets (API keys): add, list, delete. Encrypted at rest. */

import { useState, type ChangeEvent } from "react";
import { Trash2, AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/Tooltip";
import { useIntegrationSecrets, useSecretActions } from "@/hooks/useIntegrations";
import type { SecretMeta } from "@/domain/integration/models";

export function SecretsPanel() {
  const { data } = useIntegrationSecrets();
  const { setSecret, removeSecret } = useSecretActions();
  const [name, setName] = useState("");
  const [value, setValue] = useState("");

  const secrets = data?.secrets ?? [];
  const hasKey = data?.hasKey ?? false;

  const handleNameChange = (e: ChangeEvent<HTMLInputElement>) => setName(e.target.value);
  const handleValueChange = (e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value);
  const handleAdd = () => {
    if (!name.trim() || !value.trim()) return;
    setSecret.mutate(
      { name: name.trim(), value },
      {
        onSuccess: () => {
          setName("");
          setValue("");
        },
      },
    );
  };
  const handleRemove = (secretName: string) => removeSecret.mutate(secretName);

  return (
    <div className="space-y-3">
      <div className="text-sm font-medium">Secrets</div>

      {data && !hasKey && (
        <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-300">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>
            Set <code>INTEGRATIONS_SECRET</code> in <code>.env.local</code> to store
            keys (they&apos;re encrypted with it).
          </span>
        </div>
      )}

      <div className="space-y-1">
        {secrets.map((secret) => (
          <SecretRow key={secret.name} secret={secret} onRemove={handleRemove} />
        ))}
        {secrets.length === 0 && (
          <div className="text-xs text-muted-foreground">No secrets yet.</div>
        )}
      </div>

      <div className="space-y-2">
        <Input
          value={name}
          onChange={handleNameChange}
          placeholder="NAME"
          className="h-8 w-full font-mono"
        />
        <div className="flex items-center gap-2">
          <Input
            value={value}
            onChange={handleValueChange}
            type="password"
            placeholder="value"
            className="h-8 min-w-0 flex-1 font-mono"
          />
          <Button
            size="sm"
            onClick={handleAdd}
            disabled={!hasKey || setSecret.isPending}
            className="shrink-0"
          >
            Add
          </Button>
        </div>
      </div>
    </div>
  );
}

interface SecretRowProps {
  secret: SecretMeta;
  onRemove(name: string): void;
}

function SecretRow({ secret, onRemove }: SecretRowProps) {
  const handleRemove = () => onRemove(secret.name);
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
