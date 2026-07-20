/** TanStack hooks for the retired Phase A saved commands (name + code). */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type { Command, RunResult } from "@/domain/integration/models";

const COMMANDS_KEY = ["commands"] as const;

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
