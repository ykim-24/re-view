/** TanStack hooks for custom integrations: secrets vault and retired saved commands. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { Command, RunResult, SecretMeta } from "@/domain/integration/models";

const SECRETS_KEY = ["integration-secrets"] as const;
const COMMANDS_KEY = ["commands"] as const;

interface SecretsData {
  secrets: SecretMeta[];
  hasKey: boolean;
}

export function useIntegrationSecrets() {
  return useQuery<SecretsData>({
    queryKey: SECRETS_KEY,
    queryFn: () => api.get<SecretsData>("/api/integrations/secrets"),
  });
}

export function useSecretActions() {
  const qc = useQueryClient();
  const set = useMutation<SecretsData, Error, { name: string; value: string }>({
    mutationFn: (body) => api.post<SecretsData>("/api/integrations/secrets", body),
    onSuccess: (data) => qc.setQueryData(SECRETS_KEY, data),
  });
  const remove = useMutation<SecretsData, Error, string>({
    mutationFn: (name) =>
      api.del<SecretsData>(`/api/integrations/secrets?name=${encodeURIComponent(name)}`),
    onSuccess: (data) => qc.setQueryData(SECRETS_KEY, data),
  });
  return { setSecret: set, removeSecret: remove };
}

export function useCommands() {
  return useQuery<{ commands: Command[] }>({
    queryKey: COMMANDS_KEY,
    queryFn: () => api.get<{ commands: Command[] }>("/api/commands"),
  });
}

export function useCommandActions() {
  const qc = useQueryClient();
  const save = useMutation<
    { id: string; commands: Command[] },
    Error,
    { id?: string; name: string; code: string }
  >({
    mutationFn: (body) =>
      api.post<{ id: string; commands: Command[] }>("/api/commands", body),
    onSuccess: (data) => qc.setQueryData(COMMANDS_KEY, { commands: data.commands }),
  });
  const remove = useMutation<{ commands: Command[] }, Error, string>({
    mutationFn: (id) =>
      api.del<{ commands: Command[] }>(`/api/commands?id=${encodeURIComponent(id)}`),
    onSuccess: (data) => qc.setQueryData(COMMANDS_KEY, data),
  });
  return { saveCommand: save, removeCommand: remove };
}

export function useRunCommand() {
  return useMutation<RunResult, Error, string>({
    mutationFn: (code) => api.post<RunResult>("/api/commands/run", { code }),
  });
}
