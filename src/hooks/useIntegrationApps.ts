/** TanStack hooks for the integration app model: integrations (apps) and their flows. */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/apiClient";
import type {
  Component,
  ComponentRunResult,
  ComponentType,
  Flow,
  FlowNode,
  Integration,
  SecretMeta,
  SecretScope,
} from "@/domain/integration/models";

const INTEGRATIONS_KEY = ["integration-apps"] as const;
const flowsKey = (integrationId: string) => ["flows", integrationId] as const;

export function useIntegrations() {
  return useQuery<{ integrations: Integration[] }>({
    queryKey: INTEGRATIONS_KEY,
    queryFn: () => api.get<{ integrations: Integration[] }>("/api/integrations"),
  });
}

export function useIntegration(id: string) {
  return useQuery<{ integration: Integration | null }>({
    queryKey: [...INTEGRATIONS_KEY, id],
    queryFn: () =>
      api.get<{ integration: Integration | null }>(
        `/api/integrations?id=${encodeURIComponent(id)}`,
      ),
  });
}

export function useIntegrationActions() {
  const qc = useQueryClient();
  const save = useMutation<
    { id: string; integrations: Integration[] },
    Error,
    { id?: string; name: string; description?: string }
  >({
    mutationFn: (body) =>
      api.post<{ id: string; integrations: Integration[] }>("/api/integrations", body),
    onSuccess: (data) => qc.setQueryData(INTEGRATIONS_KEY, { integrations: data.integrations }),
  });
  const remove = useMutation<{ integrations: Integration[] }, Error, string>({
    mutationFn: (id) =>
      api.del<{ integrations: Integration[] }>(`/api/integrations?id=${encodeURIComponent(id)}`),
    onSuccess: (data) => qc.setQueryData(INTEGRATIONS_KEY, data),
  });
  return { saveIntegration: save, removeIntegration: remove };
}

export function useFlows(integrationId: string) {
  return useQuery<{ flows: Flow[] }>({
    queryKey: flowsKey(integrationId),
    queryFn: () =>
      api.get<{ flows: Flow[] }>(
        `/api/flows?integrationId=${encodeURIComponent(integrationId)}`,
      ),
  });
}

export function useFlow(id: string) {
  return useQuery<{ flow: Flow | null }>({
    queryKey: ["flow", id],
    queryFn: () => api.get<{ flow: Flow | null }>(`/api/flows?id=${encodeURIComponent(id)}`),
  });
}

export function useFlowActions(integrationId: string) {
  const qc = useQueryClient();
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: flowsKey(integrationId) });
    qc.invalidateQueries({ queryKey: ["flow"] });
  };
  const save = useMutation<
    { id: string; flow: Flow | null },
    Error,
    { id?: string; name: string; description?: string; nodes?: FlowNode[] }
  >({
    mutationFn: (body) =>
      api.post<{ id: string; flow: Flow | null }>("/api/flows", { integrationId, ...body }),
    onSuccess: invalidate,
  });
  const remove = useMutation<{ ok: true }, Error, string>({
    mutationFn: (id) => api.del<{ ok: true }>(`/api/flows?id=${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
  return { saveFlow: save, removeFlow: remove };
}

const componentsKey = (ids: string[]) => ["components", ids.join(",")] as const;

export function useComponents(ids: string[]) {
  return useQuery<{ components: Component[] }>({
    queryKey: componentsKey(ids),
    enabled: ids.length > 0,
    queryFn: () =>
      api.get<{ components: Component[] }>(
        `/api/components?ids=${encodeURIComponent(ids.join(","))}`,
      ),
  });
}

export function useComponentActions() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["components"] });
  const save = useMutation<
    { id: string; component: Component | null },
    Error,
    {
      id?: string;
      type: ComponentType;
      name: string;
      config?: Record<string, unknown>;
      code?: string;
    }
  >({
    mutationFn: (body) =>
      api.post<{ id: string; component: Component | null }>("/api/components", body),
    onSuccess: invalidate,
  });
  const remove = useMutation<{ ok: true }, Error, string>({
    mutationFn: (id) => api.del<{ ok: true }>(`/api/components?id=${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
  return { saveComponent: save, removeComponent: remove };
}

export function useRunComponent() {
  return useMutation<
    ComponentRunResult,
    Error,
    { flowId: string; entryId: string; ctx: Record<string, unknown> }
  >({
    mutationFn: (body) => api.post<ComponentRunResult>("/api/components/run", body),
  });
}

interface SecretsData {
  secrets: SecretMeta[];
  hasKey: boolean;
}

export function useIntegrationSecrets(integrationId: string) {
  return useQuery<SecretsData>({
    queryKey: ["integration-secrets", integrationId],
    queryFn: () =>
      api.get<SecretsData>(
        `/api/integrations/secrets?integrationId=${encodeURIComponent(integrationId)}`,
      ),
  });
}

export function useSecretActions(integrationId: string) {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ["integration-secrets"] });
  const set = useMutation<
    { ok: true },
    Error,
    { name: string; value: string; scope: SecretScope }
  >({
    mutationFn: (body) => api.post<{ ok: true }>("/api/integrations/secrets", { integrationId, ...body }),
    onSuccess: invalidate,
  });
  const remove = useMutation<{ ok: true }, Error, string>({
    mutationFn: (id) =>
      api.del<{ ok: true }>(`/api/integrations/secrets?id=${encodeURIComponent(id)}`),
    onSuccess: invalidate,
  });
  return { setSecret: set, removeSecret: remove };
}
